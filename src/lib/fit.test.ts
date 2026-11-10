import { Decoder, Stream } from "@garmin/fitsdk";
import { describe, expect, it } from "vitest";
import { VELO_TO_10K } from "@/engine/fixtures";
import { generatePlan } from "@/engine";
import { workoutFit, workoutSteps } from "./fit";

// Un profil qui court déjà : assez de volume pour avoir du fractionné en phase spécifique.
const profile = { ...VELO_TO_10K, reference5kSec: 1650, currentRunMinutes: 150 };
const plan = generatePlan(profile);
const find = (kind: string) => {
  for (const w of plan.weeks) {
    const s = w.sessions.find((x) => x.kind === kind);
    if (s) return { w, s };
  }
  throw new Error(kind);
};

function decode(bytes: Uint8Array) {
  const decoder = new Decoder(Stream.fromByteArray(Array.from(bytes)));
  expect(decoder.isFIT()).toBe(true);
  expect(decoder.checkIntegrity()).toBe(true);
  const { messages, errors } = decoder.read();
  expect(errors).toEqual([]);
  return messages as Required<typeof messages>;
}

describe("export Garmin (.FIT)", () => {
  it("écrit un fractionné valide : échauffement, répétitions avec récup, retour au calme", () => {
    const { w, s } = find("fractionne");
    const m = decode(
      workoutFit(profile, w, s, "Transio S9 Fractionné", new Date("2026-11-06T10:00:00Z"))!,
    );
    expect(m.fileIdMesgs[0].type).toBe("workout");
    expect(m.workoutMesgs[0]).toMatchObject({ sport: "running", wktName: "Transio S9 Fractionné" });
    const steps = m.workoutStepMesgs;
    expect(m.workoutMesgs[0].numValidSteps).toBe(steps.length);
    expect(steps[0]).toMatchObject({
      intensity: "warmup",
      durationType: "time",
      durationTime: 900,
    });
    expect(steps[1]).toMatchObject({
      intensity: "interval",
      durationTime: 120,
      targetType: "speed",
    });
    // 5:20–5:30 /km → 3,03 à 3,13 m/s
    expect(steps[1].customTargetSpeedLow).toBeCloseTo(3.03, 2);
    expect(steps[1].customTargetSpeedHigh).toBeCloseTo(3.125, 2);
    expect(steps[2]).toMatchObject({ intensity: "rest", durationTime: 90 });
    expect(steps[3]).toMatchObject({ durationType: "repeatUntilStepsCmplt", durationStep: 1 });
    expect(steps[3].repeatSteps).toBeGreaterThanOrEqual(4);
    expect(steps.at(-1)).toMatchObject({ intensity: "cooldown" });
  });

  it("met le test à la distance de l'objectif, et n'exporte pas le renfo", () => {
    const { w, s } = find("test");
    const steps = workoutSteps(profile, w, s)!;
    expect(steps.find((x) => x.wktStepName === "Test")).toMatchObject({
      durationType: "distance",
      durationValue: 1_000_000,
    });
    const r = find("renfo");
    expect(workoutFit(profile, r.w, r.s, "x")).toBeNull();
  });

  it("laisse la cible ouverte sans temps de référence", () => {
    const { w, s } = find("endurance");
    const steps = workoutSteps(VELO_TO_10K, w, s)!;
    expect(steps.every((x) => x.targetType === "open")).toBe(true);
    decode(workoutFit(VELO_TO_10K, w, s, "Footing")!);
  });
});
