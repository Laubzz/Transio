import { describe, expect, it } from "vitest";
import { VELO_TO_10K } from "./fixtures";
import { equivalent5k, formatDuration, formatPace, paces, parseDuration } from "./paces";
import { generatePlan } from "./plan";
import type { Profile, SessionKind } from "./types";
import { buildWorkout, strengthPlaceFor, target } from "./workout";

// 5 km en 25 min : 5:00 /km. Court déjà : assez de volume pour avoir du fractionné.
const withRef: Profile = { ...VELO_TO_10K, reference5kSec: 25 * 60, currentRunMinutes: 150 };
const plan = generatePlan(withRef);
const find = (kind: SessionKind) => {
  for (const w of plan.weeks) {
    const s = w.sessions.find((x) => x.kind === kind);
    if (s) return { w, s };
  }
  throw new Error(`pas de séance ${kind}`);
};

/** Durée totale d'une séance de course détaillée, en minutes. */
const total = (blocks: ReturnType<typeof buildWorkout>["blocks"]) =>
  blocks.reduce((a, b) => a + b.repeat * (b.workSec + (b.recoverySec ?? 0)), 0) / 60;

describe("allures", () => {
  it("calcule les allures à partir du temps sur 5 km", () => {
    const p = paces(25 * 60, "10k");
    expect(p.endurance).toEqual([360, 390]); // 6:00–6:30
    expect(p.seuil).toEqual([315, 325]);
    expect(p.vma).toEqual([290, 300]);
    expect(p.objectif).toEqual([310, 318]);
    expect(paces(25 * 60, "trail").objectif).toBeNull();
  });

  it("lit et écrit les durées", () => {
    expect(parseDuration("25:30")).toBe(1530);
    expect(parseDuration("1:02:15")).toBe(3735);
    expect(parseDuration("25:75")).toBeNull();
    expect(parseDuration("abc")).toBeNull();
    expect(formatDuration(1530)).toBe("25:30");
    expect(formatPace(330)).toBe("5:30");
  });

  it("donne un temps 5 km équivalent cohérent", () => {
    expect(equivalent5k(5000, 1500)).toBe(1500);
    expect(equivalent5k(10000, 3120)).toBeLessThan(1560);
  });

  it("affiche une allure si la référence existe, sinon un repère au ressenti", () => {
    expect(target(withRef, "seuil")).toBe("5:15–5:25 /km");
    expect(target(VELO_TO_10K, "seuil")).toMatch(/phrases courtes/);
  });
});

describe("détail des séances", () => {
  it("découpe le fractionné : échauffement, répétitions à allure VMA, retour au calme", () => {
    const { w, s } = find("fractionne");
    const wo = buildWorkout(withRef, w, s);
    expect(wo.blocks.map((b) => b.label)).toEqual([
      "Échauffement",
      "Fractionné",
      "Retour au calme",
    ]);
    expect(wo.blocks[1].intensity).toBe("vma");
    expect(wo.blocks[1].repeat).toBeGreaterThanOrEqual(4);
  });

  it("garde une durée proche de celle prévue", () => {
    for (const kind of ["endurance", "sortie-longue", "tempo"] as const) {
      const { w, s } = find(kind);
      expect(
        Math.abs(total(buildWorkout(withRef, w, s).blocks) - s.durationMin),
      ).toBeLessThanOrEqual(5);
    }
    // La course-marche ne concerne que ceux qui ne courent pas encore.
    const novice = generatePlan({ ...withRef, currentRunMinutes: 0 });
    const walk = novice.weeks[0].sessions.find((x) => x.kind === "course-marche")!;
    expect(
      Math.abs(
        total(buildWorkout(novice.profile, novice.weeks[0], walk).blocks) - walk.durationMin,
      ),
    ).toBeLessThanOrEqual(5);
  });

  it("propose des exercices à la maison ou en salle selon le choix", () => {
    const { w, s } = find("renfo");
    const home = buildWorkout({ ...withRef, strengthPlace: "maison" }, w, s);
    const gym = buildWorkout({ ...withRef, strengthPlace: "salle" }, w, s);
    expect(home.place).toBe("maison");
    expect(gym.place).toBe("salle");
    expect(home.exercises[0].name).toMatch(/Mollets/);
    expect(gym.exercises.some((e) => e.name === "Presse à cuisses")).toBe(true);
  });

  it("alterne maison et salle d'une semaine à l'autre avec « les deux »", () => {
    const p: Profile = { ...withRef, strengthPlace: "les-deux" };
    const places = plan.weeks.slice(0, 4).map((w) => {
      const s = w.sessions.find((x) => x.kind === "renfo")!;
      return strengthPlaceFor(p, w, s);
    });
    expect(new Set(places)).toEqual(new Set(["maison", "salle"]));
    expect(places[0]).not.toBe(places[1]);
  });

  it("invite à donner une référence quand il n'y en a pas", () => {
    const { w, s } = find("endurance");
    expect(buildWorkout(VELO_TO_10K, w, s).notes.join(" ")).toMatch(/temps sur 5 km/);
    expect(buildWorkout(withRef, w, s).notes).toHaveLength(0);
  });
});
