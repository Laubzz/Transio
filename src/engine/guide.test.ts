import { describe, expect, it } from "vitest";
import { VELO_TO_10K } from "./fixtures";
import { KEY_KINDS } from "./guide";
import { generatePlan } from "./plan";
import type { Profile } from "./types";
import { buildWorkout } from "./workout";

const guide: Profile = {
  ...VELO_TO_10K,
  keepOriginSport: false,
  strengthPerWeek: 3,
  strengthSplit: { salle: 2, maison: 1 },
};

describe("renfo du guide du coureur", () => {
  const plan = generatePlan(guide);

  it("3 sorties, 2 séances en salle et 1 à la maison, un seul jour de repos", () => {
    for (const w of plan.weeks.filter((w) => w.phase !== "test")) {
      const runs = w.sessions.filter((s) => s.impact);
      const renfo = w.sessions.filter((s) => s.kind === "renfo");
      expect(runs).toHaveLength(3);
      expect(renfo.filter((s) => s.place === "salle")).toHaveLength(2);
      expect(renfo.filter((s) => s.place === "maison")).toHaveLength(1);
      expect(new Set(w.sessions.map((s) => s.day)).size).toBe(6);
    }
  });

  it("le renfo de la veille d'une séance clé est léger, sans Nordic ni pliométrie", () => {
    for (const w of plan.weeks) {
      for (const s of w.sessions.filter((s) => s.kind === "renfo")) {
        const keyNext = w.sessions.some((x) => x.day === s.day + 1 && KEY_KINDS.has(x.kind));
        if (keyNext) expect(s.light).toBe(true);
        if (s.light && s.place === "maison") {
          const names = buildWorkout(guide, w, s).exercises.map((e) => e.code);
          expect(names).not.toContain("E18");
          expect(names).not.toContain("E24");
        }
      }
    }
  });

  it("le jour dédié à la maison reprend le guide : fente bulgare, Nordic, Copenhague", () => {
    const w = plan.weeks.find((w) =>
      w.sessions.some((s) => s.place === "maison" && !s.light && !w.deload),
    )!;
    const s = w.sessions.find((s) => s.place === "maison" && !s.light)!;
    const codes = buildWorkout(guide, w, s).exercises.map((e) => e.code);
    expect(codes).toEqual(expect.arrayContaining(["E13", "E18", "E10", "E19"]));
  });

  it("ajoute les routines courtes autour des séances de course", () => {
    const w = plan.weeks[4];
    for (const s of w.sessions.filter((s) => s.impact)) {
      const titles = (buildWorkout(guide, w, s).routines ?? []).map((r) => r.title);
      if (s.kind === "tempo" || s.kind === "fractionne") {
        expect(titles).toEqual(["Activation avant la séance", "Le soir : tronc et pieds"]);
      }
      if (s.kind === "sortie-longue") expect(titles).toEqual([]);
    }
  });

  it("sans le mode guide, pas de routines", () => {
    const classic = generatePlan({ ...VELO_TO_10K, keepOriginSport: false });
    const w = classic.weeks[4];
    for (const s of w.sessions)
      expect(buildWorkout(classic.profile, w, s).routines).toBeUndefined();
  });

  it("refuse plus de 4 séances de renfo", () => {
    expect(() => generatePlan({ ...guide, strengthSplit: { salle: 3, maison: 2 } })).toThrow();
  });
});

describe("durée du renfo à la maison", () => {
  it("dure au moins 40 min, même en semaine allégée ou de course", () => {
    for (const p of [
      guide,
      { ...VELO_TO_10K, strengthPlace: "maison" as const, strengthPerWeek: 2 },
    ]) {
      for (const w of generatePlan(p).weeks) {
        for (const s of w.sessions.filter((x) => x.place === "maison")) {
          expect(s.durationMin).toBeGreaterThanOrEqual(40);
        }
      }
    }
  });
});
