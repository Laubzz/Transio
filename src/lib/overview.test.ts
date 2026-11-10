import { describe, expect, it } from "vitest";
import { VELO_TO_10K } from "@/engine/fixtures";
import { saveFreeSession } from "./coaching";
import { overview, trend } from "./overview";
import { createState, recordFeedback } from "./state";

// Plan qui commence le lundi 5 janvier 2026 : renfo lundi, course mardi, jeudi et dimanche.
const base = () => {
  let s = createState({ ...VELO_TO_10K, strengthPerWeek: 1 }, "2026-01-05");
  s = recordFeedback(s, 1, 0, { done: true, rpe: 6, durationMin: 40 }); // lundi 5
  s = recordFeedback(s, 1, 1, { done: true, rpe: 3, durationMin: 20 }); // mardi 6
  s = recordFeedback(s, 1, 3, { done: false }); // jeudi 8, pas faite
  s = recordFeedback(s, 2, 1, { done: true, rpe: 8, durationMin: 30 }); // mardi 13
  return saveFreeSession(s, { date: "2026-01-14", sport: "velo", durationMin: 60, rpe: 5 });
};

describe("vue d'ensemble", () => {
  it("additionne charge, durée et séances sur 7 jours, et compare à la période d'avant", () => {
    const o = overview(base(), "2026-01-14", 7); // du 8 au 14 janvier
    expect(o.count).toBe(2);
    expect(o.minutes).toBe(90);
    expect(o.load).toBe(30 * 8 + 60 * 5);
    expect(o.prevLoad).toBe(40 * 6 + 20 * 3);
    expect(trend(o.load, o.prevLoad)).toBe(80);
    expect(trend(o.load, 0)).toBeNull();
  });

  it("répartit les minutes par intensité ressentie", () => {
    const o = overview(base(), "2026-01-14", 30);
    expect(o.intensity).toEqual({ low: 20, mid: 100, high: 30 });
  });

  it("donne une valeur par jour sur 7 jours et par semaine sur 90 jours", () => {
    const week = overview(base(), "2026-01-14", 7).series;
    expect(week).toHaveLength(7);
    expect(week.map((d) => d.load)).toEqual([0, 0, 0, 0, 0, 240, 300]);
    expect(overview(base(), "2026-01-14", 90).series).toHaveLength(13);
  });

  it("liste les 3 dernières séances faites, libres comprises, sans celles à venir", () => {
    const o = overview(base(), "2026-01-13", 7);
    expect(o.recent.map((r) => r.date)).toEqual(["2026-01-13", "2026-01-06", "2026-01-05"]);
    expect(overview(base(), "2026-01-14", 7).recent[0].free).toBe(true);
  });
});
