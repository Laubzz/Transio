import { describe, expect, it } from "vitest";
import { VELO_TO_10K } from "@/engine/fixtures";
import { summary } from "./analytics";
import {
  advice,
  freeDayFor,
  periodOn,
  proposeMiss,
  recordMissed,
  saveFreeSession,
  saveMetrics,
  savePeriod,
} from "./coaching";
import {
  lastSession,
  lastStrength,
  oneRepMax,
  runAnalysis,
  runSummary,
  weeklyRunMetrics,
} from "./insights";
import {
  createState,
  feedbackKey,
  mergeActivities,
  recordFeedback,
  recoveryAlert,
  reviewWeek,
} from "./state";

const base = createState({ ...VELO_TO_10K, reference5kSec: 1650 }, "2026-11-09");
const w1 = base.plan.weeks[0];
const [mon, tue, thu, sat, sun] = w1.sessions; // renfo, course, course, vélo, sortie longue

describe("séance non réalisée", () => {
  it("propose d'alléger après fatigue, sinon de reporter à un jour libre", () => {
    expect(proposeMiss(base, 1, tue.day, "fatigue", "2026-11-10").action).toBe("alleger");
    expect(proposeMiss(base, 1, tue.day, "temps", "2026-11-10")).toEqual({
      action: "reporter",
      movedTo: 2,
    });
    expect(freeDayFor(base, 1, sun.day, "2026-11-15")).toBeNull();
  });

  it("reporte la séance à un jour libre de la semaine", () => {
    const s = recordMissed(base, 1, tue.day, { cause: "temps", action: "reporter", movedTo: 2 });
    const moved = s.plan.weeks[0].sessions.find((x) => x.day === 2)!;
    expect(moved.kind).toBe(tue.kind);
    expect(moved.movedFrom).toBe(1);
    expect(moved.note).toMatch(/Reportée du mardi/);
    expect(s.plan.weeks[0].sessions.some((x) => x.day === 1)).toBe(false);
    expect(() =>
      recordMissed(base, 1, tue.day, { cause: "temps", action: "reporter", movedTo: 3 }),
    ).toThrow();
  });

  it("allège les 2 séances suivantes après une maladie", () => {
    const s = recordMissed(base, 1, tue.day, { cause: "maladie", action: "alleger" });
    expect(s.feedback[feedbackKey(1, tue.day)]).toMatchObject({
      done: false,
      missed: { cause: "maladie" },
    });
    const after = s.plan.weeks[0].sessions;
    expect(after.find((x) => x.day === thu.day)!.durationMin).toBeLessThan(thu.durationMin);
    expect(after.find((x) => x.day === sat.day)!.durationMin).toBeLessThan(sat.durationMin);
    expect(after.find((x) => x.day === sun.day)!.durationMin).toBe(sun.durationMin);
  });

  it("ajoute du temps à la prochaine séance facile", () => {
    const s = recordMissed(base, 1, tue.day, { cause: "meteo", action: "ajouter" });
    expect(s.plan.weeks[0].sessions.find((x) => x.day === thu.day)!.durationMin).toBeGreaterThan(
      thu.durationMin,
    );
  });
});

describe("séances libres, conseils, métriques, périodes", () => {
  it("compte une séance libre dans la charge de la semaine", () => {
    const s = saveFreeSession(base, {
      date: "2026-11-11",
      sport: "course",
      durationMin: 30,
      rpe: 4,
    });
    const week = summary(s, "2026-11-15").weeks[0];
    expect(week.load).toBe(120);
    expect(week.doneRun).toBe(30);
    expect(week.free).toBe(1);
    expect(week.plannedLoad).toBeGreaterThan(0);
    expect(() =>
      saveFreeSession(base, { date: "2026-11-11", sport: "course", durationMin: 2, rpe: 4 }),
    ).toThrow();
  });

  it("conseille de lever le pied quand c'est plus dur que prévu", () => {
    expect(advice(base).level).toBe("none");
    let s = recordFeedback(base, 1, tue.day, {
      done: true,
      rpe: tue.targetRpe + 3,
      sensation: "bof",
    });
    s = recordFeedback(s, 1, thu.day, { done: true, rpe: thu.targetRpe + 3, sensation: "bof" });
    expect(advice(s)).toMatchObject({ level: "bad", title: "Lève le pied" });
    const easy = recordFeedback(base, 1, tue.day, {
      done: true,
      rpe: tue.targetRpe,
      sensation: "bien",
    });
    expect(advice(easy).title).toBe("Dans la cible");
  });

  it("maintient le volume au bilan quand la VFC baisse", () => {
    let s = base;
    for (const [i, hrv] of [
      [-28, 60],
      [-21, 62],
      [-14, 61],
      [-7, 60],
      [0, 50],
    ] as const) {
      const d = new Date(Date.UTC(2026, 10, 9 + i)).toISOString().slice(0, 10);
      s = saveMetrics(s, d, { hrv });
    }
    expect(recoveryAlert(s.metrics!, "2026-11-09")?.[0]).toMatch(/VFC en baisse/);
    for (const x of w1.sessions) s = recordFeedback(s, 1, x.day, { done: true, rpe: x.targetRpe });
    s = reviewWeek(s, 1);
    expect(s.reviews[0].decision).toBe("maintenir");
    expect(saveMetrics(s, "2026-11-09", {}).metrics?.["2026-11-09"]).toBeUndefined();
  });

  it("repère la période du jour", () => {
    const s = savePeriod(base, {
      start: "2026-11-16",
      end: "2026-11-27",
      label: "Entreprise",
      busy: true,
    });
    expect(periodOn(s, "2026-11-20")?.label).toBe("Entreprise");
    expect(periodOn(s, "2026-11-28")).toBeNull();
    expect(() =>
      savePeriod(base, { start: "2026-11-20", end: "2026-11-10", label: "x" }),
    ).toThrow();
  });
});

describe("analyses des courses", () => {
  const run = (
    id: number,
    date: string,
    km: number,
    min: number,
    avgHr?: number,
    cadence?: number,
  ) => ({
    id,
    date,
    sport: "course" as const,
    name: `Course ${id}`,
    distanceM: km * 1000,
    movingSec: min * 60,
    avgHr,
    maxHr: 190,
    cadence,
  });
  const s = mergeActivities(base, [
    run(1, "2026-11-10", 3, 21, 140, 168), // 7:00/km : dans la zone facile (6:30–7:00)
    run(2, "2026-11-12", 3, 15, 175, 176), // 5:00/km : trop vite pour un footing
    run(3, "2026-11-15", 5, 50, 138, 170),
  ]);

  it("rapproche chaque course du plan et donne un verdict d'allure", () => {
    const rows = runAnalysis(s);
    expect(rows.map((r) => r.planned?.kind)).toEqual([
      "course-marche",
      "course-marche",
      "sortie-longue",
    ]);
    expect(rows.map((r) => r.verdict)).toEqual([
      "Dans la cible",
      "Trop vite",
      "Plus lent que prévu",
    ]);
    expect(runSummary(rows)).toMatchObject({
      kmSinceStart: 11,
      longestKm: 5,
      easyInTarget: 1,
      easyTotal: 3,
    });
  });

  it("calcule efficacité, cadence et répartition facile / intense par semaine", () => {
    const m = weeklyRunMetrics(s)[0];
    expect(m.cadence).toBe(171);
    expect(m.efficiency).toBeGreaterThan(0);
    expect(m.hardMin).toBe(15);
    expect(m.easyMin).toBe(71);
    expect(m.easyShare).toBe(83);
  });

  it("estime le 1RM et retrouve la dernière perf d'un exercice", () => {
    let t = recordFeedback(base, 1, mon.day, {
      done: true,
      rpe: 6,
      strength: [{ exercise: "Presse", sets: 4, reps: 10, loadKg: 90 }],
    });
    t = saveFreeSession(t, {
      date: "2026-11-14",
      sport: "renfo",
      durationMin: 40,
      rpe: 6,
      strength: [{ exercise: "presse", sets: 4, reps: 8, loadKg: 100 }],
    });
    const [presse] = oneRepMax(t);
    expect(presse.points).toEqual([
      { date: "2026-11-09", oneRm: 120 },
      { date: "2026-11-14", oneRm: 126.7 },
    ]);
    expect(lastStrength(t, "Presse", "2026-11-14")).toMatchObject({
      loadKg: 90,
      date: "2026-11-09",
    });
  });

  it("retrouve la dernière séance avec son activité Strava", () => {
    const l = lastSession(s, "2026-11-15", (x) => x.kind)!;
    expect(l.date).toBe("2026-11-15");
    expect(l.title).toBe("sortie-longue");
    expect(l.activity?.id).toBe(3);
    expect(l.noted).toBe(false);
  });
});

describe("allègement sans toucher aux séances déjà notées", () => {
  it("saute une séance déjà faite", () => {
    const done = recordFeedback(base, 1, tue.day, { done: true, rpe: 3 });
    const s = recordMissed(done, 1, mon.day, { cause: "fatigue", action: "alleger" });
    const after = s.plan.weeks[0].sessions;
    expect(after.find((x) => x.day === tue.day)!.durationMin).toBe(tue.durationMin);
    expect(after.find((x) => x.day === thu.day)!.durationMin).toBeLessThan(thu.durationMin);
    expect(after.find((x) => x.day === sat.day)!.durationMin).toBeLessThan(sat.durationMin);
  });
});
