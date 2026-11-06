import { describe, expect, it } from "vitest";
import { VELO_TO_10K } from "@/engine/fixtures";
import { longestStreak, personalBests, records } from "./records";
import {
  activitiesNeedingDetails,
  createState,
  setBestEfforts,
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

describe("records personnels (meilleurs efforts Strava)", () => {
  it("garde les 3 meilleurs temps par distance, triés par distance", () => {
    const withEfforts = (
      id: number,
      date: string,
      efforts: [string, number, number][],
    ): Activity => ({
      ...run(id, date, 12000, 3600),
      prCount: 1,
      bestEfforts: efforts.map(([name, distanceM, elapsedSec]) => ({
        name,
        distanceM,
        elapsedSec,
      })),
    });
    const s = mergeActivities(base, [
      withEfforts(1, "2026-05-01", [
        ["5k", 5000, 1500],
        ["1k", 1000, 270],
      ]),
      withEfforts(2, "2026-06-01", [
        ["5k", 5000, 1440],
        ["10k", 10000, 3000],
      ]),
      withEfforts(3, "2026-07-01", [["5k", 5000, 1470]]),
      withEfforts(4, "2026-08-01", [["5k", 5000, 1600]]),
    ]);
    const pbs = personalBests(s);
    expect(pbs.map((p) => p.label)).toEqual(["1 km", "5 km", "10 km"]);
    const five = pbs[1];
    expect(five.top.map((t) => t.timeSec)).toEqual([1440, 1470, 1500]);
    expect(five.top[0]).toMatchObject({
      pace: "4:48 /km",
      date: "2026-06-01",
      activity: "Sortie 2",
    });
  });

  it("ne relit que les sorties avec record dont le détail manque", () => {
    const s = mergeActivities(base, [
      { ...run(1, "2026-05-01", 5000, 1500), prCount: 2 },
      { ...run(2, "2026-05-02", 5000, 1500), prCount: 0 },
      { ...run(3, "2026-05-03", 5000, 1500), prCount: 1, bestEfforts: [] },
    ]);
    expect(activitiesNeedingDetails(s)).toEqual([1]);
    const after = setBestEfforts(s, [
      { id: 1, bestEfforts: [{ name: "5k", distanceM: 5000, elapsedSec: 1490 }] },
    ]);
    expect(activitiesNeedingDetails(after)).toEqual([]);
    // un nouvel import du résumé garde les meilleurs efforts déjà lus
    const again = mergeActivities(after, [{ ...run(1, "2026-05-01", 5000, 1500), prCount: 2 }]);
    expect(again.activities?.find((a) => a.id === 1)?.bestEfforts).toHaveLength(1);
  });
});
