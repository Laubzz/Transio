import { describe, expect, it } from "vitest";
import { VELO_TO_10K } from "./fixtures";
import { goalPaceNeed, goalPaceStep } from "./goalPace";
import { generatePlan, raceMinutes, runMinutesOf, splitRun, startMinutes } from "./plan";
import { LONG_RUN_TARGET } from "./rules";
import type { Goal, Profile } from "./types";
import { buildWorkout } from "./workout";

// 5 km en 23:56, comme un coureur qui vise 10 km en 50 min environ.
const novice: Profile = { ...VELO_TO_10K, keepOriginSport: false, reference5kSec: 1436 };
const longRuns = (p: Profile) =>
  generatePlan(p)
    .weeks.filter((w) => w.phase !== "test")
    .map((w) => w.sessions.find((s) => s.kind === "sortie-longue")!.durationMin);

describe("durée des sorties avant le test", () => {
  it("fait au moins une sortie aussi longue que la course visée, même en partant de zéro", () => {
    for (const goal of ["5k", "10k"] as Goal[]) {
      for (const runDaysPerWeek of [2, 3, 4] as const) {
        const p = { ...novice, goal, runDaysPerWeek };
        const race = raceMinutes(p, goal === "5k" ? 5 : 10);
        expect(Math.max(...longRuns(p))).toBeGreaterThanOrEqual(race);
      }
    }
  });

  it("amène la sortie longue d'un 10 km à 1 h 15 avant le test", () => {
    expect(Math.max(...longRuns(novice))).toBe(LONG_RUN_TARGET["10k"]);
  });

  it("allonge la sortie longue sans jamais raccourcir les autres séances sous 15 min", () => {
    for (const w of generatePlan(novice).weeks.filter((x) => !x.deload && x.phase !== "test")) {
      const runs = w.sessions.filter((s) => s.impact);
      expect(Math.min(...runs.map((s) => s.durationMin))).toBeGreaterThanOrEqual(15);
      expect(runMinutesOf(w)).toBe(w.runMinutes);
    }
  });

  it("garde la part habituelle de la sortie longue à gros volume", () => {
    expect(splitRun(60, 3, "10k")).toEqual([20, 15, 25]);
    expect(splitRun(140, 3, "10k").at(-1)).toBe(75);
    expect(splitRun(300, 3, "10k").at(-1)).toBe(90);
  });

  it("donne au test la durée de la course, avec échauffement et retour au calme", () => {
    const plan = generatePlan(novice);
    const test = plan.weeks.at(-1)!.sessions.find((s) => s.kind === "test")!;
    expect(test.durationMin).toBe(25 + raceMinutes(novice, 10));
    expect(runMinutesOf(plan.weeks.at(-1)!)).toBeLessThan(plan.weeks.at(-2)!.runMinutes);
  });
});

describe("volume de départ de quelqu'un qui court déjà", () => {
  it("repart de 90 % du volume actuel, sans course-marche", () => {
    const p = { ...novice, currentRunMinutes: 120 };
    expect(startMinutes(p)).toBe(105);
    expect(startMinutes(novice)).toBe(60);
    const plan = generatePlan(p);
    expect(plan.weeks.some((w) => w.sessions.some((s) => s.kind === "course-marche"))).toBe(false);
    expect(generatePlan(novice).weeks[0].sessions.some((s) => s.kind === "course-marche")).toBe(
      true,
    );
  });

  it("ne dépasse pas le volume maximal visé pour l'objectif", () => {
    expect(startMinutes({ ...novice, currentRunMinutes: 600 })).toBe(210);
  });
});

describe("séances à l'allure objectif", () => {
  const steps = (p: Profile) => {
    const plan = generatePlan(p);
    return plan.weeks.flatMap((w) =>
      w.sessions
        .filter((s) => s.kind === "tempo")
        .map((s) =>
          buildWorkout(p, w, s)
            .blocks.filter((b) => b.distanceM)
            .map((b) => `${b.repeat}x${b.distanceM! / 1000}`)
            .join("+"),
        ),
    );
  };

  it("suit la progression 3 × 1 km, 4 × 1 km, 2 × 2 km… sur les semaines de qualité", () => {
    const runner = { ...novice, runDaysPerWeek: 2 as const, currentRunMinutes: 100 };
    expect(steps(runner)).toEqual(["3x1", "4x1", "2x2", "1x2+1x1+1x2", "5x1", "3x2"]);
  });

  it("commence par 3 × 1 km et ne recule jamais dans la progression", () => {
    const s = steps(novice);
    expect(s[0]).toBe("3x1");
    const km = s.map((x) =>
      x
        .split("+")
        .reduce((a, part) => a + Number(part.split("x")[0]) * Number(part.split("x")[1]), 0),
    );
    for (let i = 1; i < km.length; i++) expect(km[i]).toBeGreaterThanOrEqual(km[i - 1]);
  });

  it("court les kilomètres à l'allure objectif, avec échauffement et retour au calme", () => {
    const plan = generatePlan(novice);
    const w = plan.weeks.find((x) => x.sessions.some((s) => s.kind === "tempo"))!;
    const blocks = buildWorkout(
      novice,
      w,
      w.sessions.find((s) => s.kind === "tempo")!,
    ).blocks;
    expect(blocks[0].label).toBe("Échauffement");
    expect(blocks.at(-1)!.label).toBe("Retour au calme");
    expect(blocks[1]).toMatchObject({ intensity: "objectif", distanceM: 1000, recoverySec: 120 });
    // 5 km en 23:56 : allure 10 km entre 4:57 et 5:05 /km.
    expect(blocks[1].workSec).toBeGreaterThanOrEqual(297);
    expect(blocks[1].workSec).toBeLessThanOrEqual(305);
  });

  it("prévoit la durée qu'il faut à la séance et l'adapte au temps disponible", () => {
    expect(goalPaceNeed(novice, 0)).toBe(35);
    expect(goalPaceStep(novice, 5, 60)).toEqual([2, 2, 2]);
    expect(goalPaceStep(novice, 5, 20)).toEqual([1, 1, 1]);
    expect(goalPaceNeed({ ...novice, goal: "trail" }, 0)).toBeNull();
  });
});
