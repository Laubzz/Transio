import { describe, expect, it } from "vitest";
import { VELO_TO_10K } from "./fixtures";
import { generatePlan, maxIncrease, phaseOf, startMinutes } from "./plan";
import { PEAK_RUN_MINUTES, RULES } from "./rules";
import type { Profile } from "./types";

const plan = generatePlan(VELO_TO_10K);
const builds = plan.weeks.filter((w) => !w.deload && w.phase !== "test");

describe("generatePlan", () => {
  it("crée une semaine par semaine de plan, numérotées à partir de 1", () => {
    expect(plan.weeks).toHaveLength(12);
    expect(plan.weeks.map((w) => w.index)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it("enchaîne les phases dans l'ordre et finit par le test", () => {
    const order = ["base", "rythme", "specifique", "test"];
    const phases = plan.weeks.map((w) => order.indexOf(w.phase));
    expect(phases).toEqual([...phases].sort((a, b) => a - b));
    expect(plan.weeks.at(-1)!.phase).toBe("test");
    expect(plan.weeks.at(-1)!.sessions.some((s) => s.kind === "test")).toBe(true);
  });

  it("ne dépasse jamais la hausse autorisée entre deux semaines de construction", () => {
    for (let i = 1; i < builds.length; i++) {
      const prev = builds[i - 1].runMinutes;
      expect(builds[i].runMinutes - prev).toBeLessThanOrEqual(maxIncrease(prev));
    }
  });

  it("ne dépasse jamais le pic prévu pour l'objectif", () => {
    for (const w of plan.weeks) expect(w.runMinutes).toBeLessThanOrEqual(PEAK_RUN_MINUTES["10k"]);
  });

  it("allège une semaine sur quatre", () => {
    const deloads = plan.weeks.filter((w) => w.deload).map((w) => w.index);
    expect(deloads).toEqual([4, 8]);
    for (const i of deloads) {
      expect(plan.weeks[i - 1].runMinutes).toBeLessThan(plan.weeks[i - 2].runMinutes);
    }
  });

  it("répartit exactement les minutes de course de chaque semaine", () => {
    for (const w of plan.weeks) {
      const run = w.sessions.filter((s) => s.impact).reduce((a, s) => a + s.durationMin, 0);
      expect(run).toBe(w.runMinutes);
    }
  });

  it("fait de la sortie longue (ou du test) la séance de course la plus longue", () => {
    for (const w of plan.weeks) {
      const runs = w.sessions.filter((s) => s.impact);
      const last = runs.at(-1)!;
      expect(["sortie-longue", "test"]).toContain(last.kind);
      for (const r of runs) expect(r.durationMin).toBeLessThanOrEqual(last.durationMin);
    }
  });

  it("commence en course-marche quand on vient du vélo", () => {
    const kinds = plan.weeks[0].sessions.map((s) => s.kind);
    expect(kinds).toContain("course-marche");
    expect(kinds).not.toContain("fractionne");
  });

  it("garde le sport d'origine et la muscu dans la semaine (double sport)", () => {
    for (const w of plan.weeks) {
      const kinds = w.sessions.map((s) => s.kind);
      expect(kinds).toContain("sport-origine");
      expect(kinds).toContain("renfo");
      expect(new Set(w.sessions.map((s) => s.day)).size).toBe(w.sessions.length);
    }
  });

  it("n'a pas de séance intense en semaine allégée", () => {
    for (const w of plan.weeks.filter((w) => w.deload)) {
      expect(w.sessions.map((s) => s.kind)).not.toContain("fractionne");
      expect(w.sessions.map((s) => s.kind)).not.toContain("tempo");
    }
  });

  it("refuse une durée de plan hors limites", () => {
    expect(() => generatePlan({ ...VELO_TO_10K, weeks: 4 })).toThrow(RangeError);
    expect(() => generatePlan({ ...VELO_TO_10K, weeks: RULES.maxWeeks + 1 })).toThrow(RangeError);
  });
});

describe("startMinutes", () => {
  // 2 sorties : le minimum (30 + 40 min) laisse voir l'effet du sport d'origine et des blessures.
  const twoRuns: Profile = { ...VELO_TO_10K, runDaysPerWeek: 2 };

  it("part plus bas après une blessure du membre inférieur", () => {
    const sportCo: Profile = { ...twoRuns, originSport: "sport-co" };
    const hurt: Profile = { ...sportCo, injuries: [{ zone: "genou", year: 2024 }] };
    expect(startMinutes(hurt)).toBeLessThan(startMinutes(sportCo));
  });

  it("ne réduit pas pour une blessure hors membre inférieur", () => {
    const back: Profile = { ...VELO_TO_10K, injuries: [{ zone: "dos", year: 2024 }] };
    expect(startMinutes(back)).toBe(startMinutes(VELO_TO_10K));
  });

  it("part plus haut pour un sport collectif, déjà habitué aux impacts", () => {
    expect(startMinutes({ ...twoRuns, originSport: "sport-co" })).toBeGreaterThan(
      startMinutes(twoRuns),
    );
  });

  it("ne descend jamais sous 30 min par sortie et 40 min de sortie longue", () => {
    for (const runDaysPerWeek of [2, 3, 4] as const) {
      const hurt: Profile = {
        ...VELO_TO_10K,
        originSport: "natation",
        weeklyHoursPast: 1,
        runDaysPerWeek,
        injuries: [{ zone: "genou", year: 2024 }],
      };
      for (const w of generatePlan(hurt).weeks) {
        const runs = w.sessions.filter((s) => s.impact);
        const long = runs.find((s) => s.kind === "sortie-longue" || s.kind === "test")!;
        expect(Math.min(...runs.map((s) => s.durationMin))).toBeGreaterThanOrEqual(30);
        expect(long.durationMin).toBeGreaterThanOrEqual(40);
      }
    }
  });
});

describe("phaseOf", () => {
  it("répartit base, rythme et spécifique sur un plan de 12 semaines", () => {
    const phases = Array.from({ length: 12 }, (_, i) => phaseOf(i + 1, 12));
    expect(phases.filter((p) => p === "base")).toHaveLength(4);
    expect(phases.filter((p) => p === "rythme")).toHaveLength(3);
    expect(phases.filter((p) => p === "specifique")).toHaveLength(4);
    expect(phases.filter((p) => p === "test")).toHaveLength(1);
  });
});

describe("suite du plan (deuxième cycle)", () => {
  const next: Profile = { ...VELO_TO_10K, goal: "semi", cycle: 2, startRunMinutes: 100, weeks: 12 };
  const p2 = generatePlan(next);

  it("repart du volume atteint au cycle précédent", () => {
    expect(startMinutes(next)).toBe(100);
    expect(p2.weeks[0].runMinutes).toBe(100);
  });

  it("ne refait pas de course-marche", () => {
    for (const w of p2.weeks) {
      expect(w.sessions.map((s) => s.kind)).not.toContain("course-marche");
    }
  });

  it("garde les garde-fous de progression", () => {
    const b = p2.weeks.filter((w) => !w.deload && w.phase !== "test");
    for (let i = 1; i < b.length; i++) {
      expect(b[i].runMinutes - b[i - 1].runMinutes).toBeLessThanOrEqual(
        maxIncrease(b[i - 1].runMinutes),
      );
    }
    expect(Math.max(...p2.weeks.map((w) => w.runMinutes))).toBeLessThanOrEqual(
      PEAK_RUN_MINUTES.semi,
    );
  });
});
