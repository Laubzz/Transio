import { describe, expect, it } from "vitest";
import { VELO_TO_10K } from "@/engine/fixtures";
import { longestStreak, records } from "./records";
import {
  createState,
  mergeActivities,
  planEnd,
  recordFeedback,
  resumeMinutes,
  startNextCycle,
  type Activity,
} from "./state";

const base = createState(VELO_TO_10K, "2026-11-09");
const run = (
  id: number,
  date: string,
  distanceM: number,
  movingSec: number,
  elevationM?: number,
): Activity => ({
  id,
  date,
  sport: "course",
  name: `Sortie ${id}`,
  distanceM,
  movingSec,
  elevationM,
});

describe("records", () => {
  it("classe les 3 meilleures sorties par catégorie", () => {
    const s = mergeActivities(base, [
      run(1, "2026-11-10", 5000, 1650, 20),
      run(2, "2026-11-12", 8000, 2900, 80),
      run(3, "2026-11-15", 12000, 4500, 10),
      run(4, "2026-11-17", 4000, 1180),
      { id: 5, date: "2026-11-14", sport: "velo", name: "Vélo", distanceM: 60000, movingSec: 7200 },
    ]);
    const r = Object.fromEntries(records(s).map((c) => [c.id, c]));
    expect(r.distance.top.map((e) => e.value)).toEqual(["12,0 km", "8,0 km", "5,0 km"]);
    expect(r.allure.top[0].value).toBe("4:55 /km");
    expect(r.allure.top).toHaveLength(3);
    expect(r["5k"].top[0].value).toBe("24:55");
    expect(r.denivele.top.map((e) => e.value)).toEqual(["80 m D+", "20 m D+", "10 m D+"]);
    expect(r.velo.top[0].value).toBe("60,0 km");
    expect(r.duree).toBeUndefined();
  });

  it("utilise les séances notées quand il n'y a pas d'activité Strava", () => {
    const sess = base.plan.weeks[0].sessions.find((x) => x.impact)!;
    const s = recordFeedback(base, 1, sess.day, { done: true, rpe: 4, durationMin: 33 });
    const r = records(s);
    expect(r.map((c) => c.id)).toEqual(["duree"]);
    expect(r[0].top[0].value).toBe("33 min");
  });

  it("compte la plus longue série de séances faites", () => {
    const [a, b, c] = base.plan.weeks[0].sessions;
    let s = recordFeedback(base, 1, a.day, { done: true, rpe: 4 });
    s = recordFeedback(s, 1, b.day, { done: true, rpe: 4 });
    s = recordFeedback(s, 1, c.day, { done: false });
    expect(longestStreak(s).count).toBe(2);
  });
});

describe("suite du plan", () => {
  it("archive le cycle et repart au volume atteint, sans course-marche", () => {
    const sess = base.plan.weeks[0].sessions[0];
    const done = mergeActivities(recordFeedback(base, 1, sess.day, { done: true, rpe: 5 }), [
      run(9, "2026-11-10", 5000, 1600),
    ]);
    const next = startNextCycle(done, {
      goal: "semi",
      weeks: 16,
      startDate: "2026-02-08",
      runDaysPerWeek: 4,
      strengthPerWeek: 1,
      keepOriginSport: true,
      reference5kSec: 1500,
    });
    expect(next.history).toHaveLength(1);
    expect(next.history?.[0].feedback).toEqual(done.feedback);
    expect(next.plan.profile.cycle).toBe(2);
    expect(next.plan.weeks).toHaveLength(16);
    expect(next.plan.weeks[0].runMinutes).toBe(Math.max(60, resumeMinutes(base.plan)));
    expect(next.plan.weeks.flatMap((w) => w.sessions.map((x) => x.kind))).not.toContain(
      "course-marche",
    );
    expect(next.activities).toHaveLength(1);
    expect(next.feedback).toEqual({});
    expect(next.plan.profile.reference5kSec).toBe(1500);
    expect(planEnd(base)).toBe("2027-01-31");
  });
});
