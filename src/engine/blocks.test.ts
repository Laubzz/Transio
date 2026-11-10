import { describe, expect, it } from "vitest";
import { adjustPlan } from "./adjust";
import { VELO_TO_10K } from "./fixtures";
import { formCurve } from "./form";
import { generatePlan, lastBuildUpTo, plannedLoad, rebuildFrom, strengthBlocksOf } from "./plan";
import type { Plan, PlanObjective, Profile } from "./types";
import { buildWorkout } from "./workout";

const blocks = (haut: number, bas: number, extra: Partial<Profile> = {}): Profile => ({
  ...VELO_TO_10K,
  keepOriginSport: false,
  strengthPerWeek: haut + bas,
  strengthBlocks: { haut, bas },
  ...extra,
});

describe("blocs de renforcement", () => {
  it("place 2 séances haut du corps et 1 bas du corps chaque semaine", () => {
    const plan = generatePlan(blocks(2, 1));
    for (const w of plan.weeks) {
      const renfo = w.sessions.filter((s) => s.kind === "renfo");
      expect(renfo.map((s) => s.focus).sort()).toEqual(["bas", "haut", "haut"]);
      expect(new Set(w.sessions.map((s) => s.day)).size).toBe(w.sessions.length);
    }
  });

  it("alterne les blocs en commençant par le bas du corps", () => {
    expect(strengthBlocksOf(blocks(2, 2))).toEqual(["bas", "haut", "bas", "haut"]);
    expect(strengthBlocksOf({ ...VELO_TO_10K, strengthPerWeek: 2 })).toEqual([
      undefined,
      undefined,
    ]);
  });

  it("donne des exercices du haut du corps, sans pliométrie", () => {
    const plan = generatePlan(blocks(1, 1, { strengthPlace: "salle" }));
    const week = plan.weeks[5];
    const haut = week.sessions.find((s) => s.focus === "haut")!;
    const bas = week.sessions.find((s) => s.focus === "bas")!;
    const up = buildWorkout(plan.profile, week, haut).exercises.map((e) => e.name);
    expect(up).toContain("Développé couché");
    expect(up).not.toContain("Presse à cuisses");
    expect(up.some((n) => n.startsWith("Sauts"))).toBe(false);
    expect(buildWorkout(plan.profile, week, bas).exercises.map((e) => e.name)).toContain(
      "Presse à cuisses",
    );
  });

  it("ajoute 10 min et un bloc de mobilité quand il est demandé", () => {
    const sans = generatePlan(blocks(1, 1)).weeks[0];
    const avec = generatePlan(blocks(1, 1, { mobility: true }));
    const s = avec.weeks[0].sessions.find((x) => x.kind === "renfo")!;
    expect(s.durationMin).toBe(sans.sessions.find((x) => x.kind === "renfo")!.durationMin + 10);
    expect(s.description).toContain("mobilité");
    const names = buildWorkout(avec.profile, avec.weeks[0], s).exercises.map((e) => e.name);
    expect(names).toContain("Chat-vache");
  });

  it("refuse plus de 4 séances de renforcement", () => {
    expect(() => generatePlan(blocks(3, 2))).toThrow(RangeError);
  });
});

describe("courses objectifs", () => {
  const withRace = (o: PlanObjective): Plan => {
    const plan = { ...generatePlan({ ...VELO_TO_10K, reference5kSec: 1500 }), objectives: [o] };
    return rebuildFrom(plan, o.week, lastBuildUpTo(plan, o.week - 1));
  };
  const race = (priority: PlanObjective["priority"]): PlanObjective => ({
    week: 6,
    day: 6,
    priority,
    label: "10 km de la ville",
    distanceKm: 10,
    prepFor: "Semi de printemps",
  });

  it("place la course le jour J et affûte la semaine d'un objectif principal", () => {
    const plan = withRace(race("principal"));
    const w = plan.weeks[5];
    const s = w.sessions.find((x) => x.day === 6)!;
    expect(s.kind).toBe("objectif");
    expect(s.objective?.label).toBe("10 km de la ville");
    expect(s.targetRpe).toBe(9);
    expect(w.objective).toBe("principal");
    expect(w.runMinutes).toBeLessThan(plan.weeks[4].runMinutes);
    expect(w.sessions.some((x) => x.kind === "tempo" || x.kind === "fractionne")).toBe(false);
    expect(w.sessions.some((x) => x.day === 5)).toBe(false);
    expect(plan.weeks[6].deload).toBe(true);
  });

  it("allège moins la semaine d'un objectif secondaire et vise un effort contrôlé", () => {
    const main = withRace(race("principal")).weeks[5];
    const plan = withRace(race("secondaire"));
    const w = plan.weeks[5];
    const s = w.sessions.find((x) => x.kind === "objectif")!;
    expect(w.runMinutes).toBeGreaterThan(main.runMinutes);
    expect(s.targetRpe).toBe(8);
    expect(buildWorkout(plan.profile, w, s).notes.join(" ")).toContain("Semi de printemps");
    expect(plan.weeks[6].deload).toBe(false);
  });

  it("ne compte pas la semaine de course dans la progression", () => {
    const base = generatePlan({ ...VELO_TO_10K, reference5kSec: 1500 });
    const plan = withRace(race("secondaire"));
    expect(lastBuildUpTo(plan, 6)).toBe(lastBuildUpTo(base, 5));
    // La semaine d'après reprend au plus 10 % (ou 15 min) au-dessus de la dernière construction.
    expect(plan.weeks[6].runMinutes).toBeLessThanOrEqual(lastBuildUpTo(base, 5) + 15);
  });

  it("garde la course quand un bilan fait reconstruire la suite", () => {
    const plan = withRace(race("principal"));
    const week = plan.weeks[1];
    const { plan: next } = adjustPlan(plan, {
      weekIndex: 2,
      sessions: week.sessions.map(() => ({ done: true, rpe: 5, pain: "douleur" as const })),
    });
    expect(next.weeks[5].sessions.some((s) => s.kind === "objectif")).toBe(true);
  });
});

describe("semaines modifiées à la main", () => {
  it("garde leurs séances quand le plan est reconstruit", () => {
    const plan = generatePlan(VELO_TO_10K);
    const w5 = plan.weeks[4];
    const edited = {
      ...w5,
      edited: true,
      sessions: w5.sessions.filter((s) => s.kind !== "renfo"),
    };
    const weeks = plan.weeks.map((w) => (w.index === 5 ? edited : w));
    const { plan: next, decision } = adjustPlan(
      { ...plan, weeks },
      { weekIndex: 2, sessions: plan.weeks[1].sessions.map(() => ({ done: false })) },
    );
    expect(decision).toBe("maintenir");
    expect(next.weeks[4].edited).toBe(true);
    expect(next.weeks[4].sessions.some((s) => s.kind === "renfo")).toBe(false);
    expect(next.weeks[4].sessions).toHaveLength(edited.sessions.length);
  });
});

describe("courbes de forme", () => {
  it("fait monter la fatigue plus vite que la condition", () => {
    const c = formCurve(Array(14).fill(300));
    expect(c[13].fatigue).toBeGreaterThan(c[13].fitness);
    expect(c[13].form).toBeLessThan(0);
  });

  it("rend de la fraîcheur après quelques jours de repos", () => {
    const c = formCurve([...Array(21).fill(300), ...Array(7).fill(0)]);
    expect(c[27].form).toBeGreaterThan(c[20].form);
    expect(c[27].form).toBeGreaterThan(0);
  });

  it("suit la charge prévue d'une semaine", () => {
    const w = generatePlan(VELO_TO_10K).weeks[0];
    expect(plannedLoad(w)).toBe(w.sessions.reduce((a, s) => a + s.durationMin * s.targetRpe, 0));
  });
});
