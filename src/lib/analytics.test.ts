import { describe, expect, it } from "vitest";
import { VELO_TO_10K } from "@/engine/fixtures";
import { journal, strengthRecords, summary, weeklyStats } from "./analytics";
import { createState, recordFeedback } from "./state";

const base = createState(VELO_TO_10K, "2026-11-09");
const w1 = base.plan.weeks[0];
const run = w1.sessions.find((s) => s.impact)!;
const renfo = w1.sessions.find((s) => s.kind === "renfo")!;

describe("analyses", () => {
  it("ne compte aucune semaine avant le début du plan", () => {
    expect(weeklyStats(base, "2026-11-06")).toEqual([]);
    expect(summary(base, "2026-11-06").ratio).toBeNull();
  });

  it("compte la course faite avec la durée réelle et la charge sRPE", () => {
    const s = recordFeedback(base, 1, run.day, { done: true, rpe: 5, durationMin: 30 });
    const [week] = weeklyStats(s, "2026-11-15");
    expect(week.doneRun).toBe(30);
    expect(week.load).toBe(150);
    expect(week.done).toBe(1);
    expect(week.due).toBe(w1.sessions.length);
  });

  it("prend la durée prévue quand la durée réelle n'est pas notée", () => {
    const s = recordFeedback(base, 1, run.day, { done: true, rpe: 4 });
    expect(weeklyStats(s, "2026-11-15")[0].doneRun).toBe(run.durationMin);
  });

  it("calcule le ratio sur les semaines terminées, à partir de deux", () => {
    let s = base;
    for (const w of [1, 2]) {
      for (const x of s.plan.weeks[w - 1].sessions) {
        s = recordFeedback(s, w, x.day, { done: true, rpe: x.targetRpe });
      }
    }
    // Mardi de la semaine 2 : une seule semaine terminée.
    expect(summary(s, "2026-11-17").ratio).toBeNull();
    // Mardi de la semaine 3 : semaines 1 et 2 terminées ; la semaine 3 entamée est ignorée.
    const r = summary(s, "2026-11-24");
    const [l1, l2] = r.weeks.map((w) => w.load);
    expect(r.ratio).toBeCloseTo(l2 / ((l1 + l2) / 2));
  });

  it("ne compte que les séances déjà passées comme dues", () => {
    const [week] = weeklyStats(base, "2026-11-09");
    expect(week.due).toBe(w1.sessions.filter((s) => s.day === 0).length);
  });

  it("liste le journal du plus récent au plus ancien et garde les records muscu", () => {
    let s = recordFeedback(base, 1, renfo.day, {
      done: true,
      rpe: 6,
      strength: [
        { exercise: "Presse", sets: 4, reps: 10, loadKg: 80 },
        { exercise: "  ", sets: 3, reps: 10, loadKg: 20 },
      ],
    });
    s = recordFeedback(s, 1, run.day, { done: true, rpe: 4 });
    const j = journal(s);
    expect(j).toHaveLength(2);
    expect(j[0].date > j[1].date).toBe(true);
    expect(s.feedback[`1-${renfo.day}`].strength).toHaveLength(1);
    expect(strengthRecords(s)).toEqual([
      { exercise: "Presse", loadKg: 80, reps: 10, date: "2026-11-09" },
    ]);
  });
});
