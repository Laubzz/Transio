import { describe, expect, it } from "vitest";
import { VELO_TO_10K } from "@/engine/fixtures";
import {
  createState,
  estimate5k,
  matchActivity,
  mergeActivities,
  setReference5k,
  feedbackKey,
  parseState,
  pendingReview,
  recordFeedback,
  reviewWeek,
  weekFeedback,
  type AppState,
} from "./state";

const fresh = () => createState(VELO_TO_10K, "2026-11-09");

/** Note toutes les séances d'une semaine comme faites, au ressenti prévu. */
function allDone(state: AppState, weekIndex: number): AppState {
  return state.plan.weeks[weekIndex - 1].sessions.reduce(
    (s, sess) => recordFeedback(s, weekIndex, sess.day, { done: true, rpe: sess.targetRpe }),
    state,
  );
}

describe("état de l'app", () => {
  it("génère le plan à la création", () => {
    const s = fresh();
    expect(s.plan.weeks).toHaveLength(12);
    expect(s.startDate).toBe("2026-11-09");
  });

  it("enregistre un retour et nettoie les champs inutiles", () => {
    const day = fresh().plan.weeks[0].sessions[0].day;
    let s = recordFeedback(fresh(), 1, day, { done: true, rpe: 5, comment: "  " });
    expect(s.feedback[feedbackKey(1, day)]).toEqual({ done: true, rpe: 5, pain: "aucune" });
    s = recordFeedback(s, 1, day, { done: false, rpe: 5, pain: "douleur" });
    expect(s.feedback[feedbackKey(1, day)]).toEqual({ done: false });
  });

  it("refuse un retour sur un jour sans séance", () => {
    const s = fresh();
    const free = [0, 1, 2, 3, 4, 5, 6].find(
      (d) => !s.plan.weeks[0].sessions.some((x) => x.day === d),
    );
    expect(free).toBeDefined();
    expect(() => recordFeedback(s, 1, free!, { done: true, rpe: 4 })).toThrow(RangeError);
  });

  it("compte une séance non notée comme non faite", () => {
    const fb = weekFeedback(fresh(), 1);
    expect(fb.sessions.every((x) => !x.done)).toBe(true);
  });

  it("fait les bilans dans l'ordre et les applique au plan", () => {
    let s = allDone(fresh(), 1);
    expect(pendingReview(s, 3)).toBe(1);
    expect(() => reviewWeek(s, 2)).toThrow();
    s = reviewWeek(s, 1);
    expect(s.reviews[0]).toMatchObject({ weekIndex: 1, decision: "progresser" });
    expect(pendingReview(s, 3)).toBe(2);
    expect(() => reviewWeek(s, 1)).toThrow();
  });

  it("garde le même volume après une semaine sans séance", () => {
    let s = allDone(fresh(), 1);
    s = reviewWeek(s, 1);
    const before = s.plan.weeks[1].runMinutes;
    s = reviewWeek(s, 2);
    expect(s.reviews[1].decision).toBe("maintenir");
    expect(s.plan.weeks[2].runMinutes).toBe(before);
  });

  it("bloque les retours d'une semaine déjà bilantée", () => {
    const s = reviewWeek(allDone(fresh(), 1), 1);
    expect(() => recordFeedback(s, 1, s.plan.weeks[0].sessions[0].day, { done: true })).toThrow();
  });

  it("fusionne les activités importées sans doublon et les rapproche des séances", () => {
    const run = {
      id: 1,
      date: "2026-11-10",
      sport: "course" as const,
      name: "Footing",
      distanceM: 4000,
      movingSec: 1500,
    };
    let s = mergeActivities(fresh(), [run]);
    s = mergeActivities(s, [
      { ...run, name: "Footing modifié" },
      { ...run, id: 2, date: "2026-11-12" },
    ]);
    expect(s.activities?.map((a) => a.id)).toEqual([2, 1]);
    expect(s.activities?.[1].name).toBe("Footing modifié");
    expect(matchActivity(s, "2026-11-10", "course-marche", true)?.id).toBe(1);
    expect(matchActivity(s, "2026-11-10", "renfo", false)).toBeNull();
  });

  it("estime prudemment le temps sur 5 km à partir des sorties récentes", () => {
    const acts = [
      {
        id: 1,
        date: "2026-11-01",
        sport: "course" as const,
        name: "a",
        distanceM: 5000,
        movingSec: 1800,
      },
      {
        id: 2,
        date: "2026-11-03",
        sport: "course" as const,
        name: "b",
        distanceM: 5000,
        movingSec: 1650,
      },
      {
        id: 3,
        date: "2026-08-01",
        sport: "course" as const,
        name: "vieille",
        distanceM: 5000,
        movingSec: 1200,
      },
      {
        id: 4,
        date: "2026-11-02",
        sport: "velo" as const,
        name: "vélo",
        distanceM: 5000,
        movingSec: 600,
      },
    ];
    expect(estimate5k(acts, "2026-11-06")).toBe(1650);
    expect(estimate5k([], "2026-11-06")).toBeNull();
    const s = setReference5k(fresh(), 1650);
    expect(s.plan.profile.reference5kSec).toBe(1650);
  });

  it("relit un état sauvegardé et ignore un état illisible", () => {
    const s = fresh();
    expect(parseState(JSON.stringify(s))).toEqual({
      ...s,
      activities: [],
      history: [],
      freeSessions: [],
      metrics: {},
      periods: [],
      objectives: [],
    });
    expect(parseState(null)).toBeNull();
    expect(parseState("pas du json")).toBeNull();
    expect(parseState(JSON.stringify({ version: 2 }))).toBeNull();
  });
});
