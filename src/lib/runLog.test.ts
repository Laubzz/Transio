import { describe, expect, it } from "vitest";
import { VELO_TO_10K } from "@/engine/fixtures";
import { cleanRun, completeRun, runSummary } from "./runLog";
import { createState, feedbackKey, recordFeedback } from "./state";

describe("saisie d'une sortie de course", () => {
  it("calcule le temps depuis la distance et l'allure", () => {
    expect(completeRun({ distanceKm: 10, paceSec: 330 }, "pace").timeSec).toBe(3300);
    expect(completeRun({ distanceKm: 10, paceSec: 330 }, "distance").timeSec).toBe(3300);
  });

  it("calcule l'allure depuis la distance et le temps", () => {
    expect(completeRun({ distanceKm: 10.5, timeSec: 3465 }, "time").paceSec).toBe(330);
    expect(completeRun({ distanceKm: 10, timeSec: 3000 }, "distance").paceSec).toBe(300);
  });

  it("ne calcule rien sans distance", () => {
    expect(completeRun({ paceSec: 330 }, "pace")).toEqual({ paceSec: 330 });
  });

  it("résume la sortie", () => {
    expect(runSummary({ distanceKm: 10.5, elevationM: 150, paceSec: 330, timeSec: 3465 })).toBe(
      "10,5 km · D+ 150 m · 5:30 /km · 57:45",
    );
    expect(cleanRun({ distanceKm: 0, elevationM: undefined })).toBeUndefined();
  });

  it("enregistre le type fait, la sortie ou les exercices", () => {
    const s = createState(VELO_TO_10K, "2026-11-16");
    const day = s.plan.weeks[0].sessions.find((x) => x.impact)!.day;
    const run = recordFeedback(s, 1, day, {
      done: true,
      rpe: 4,
      doneType: "course",
      run: { distanceKm: 8, paceSec: 360, timeSec: 2880, elevationM: 40 },
      strength: [{ exercise: "Squat", sets: 3, reps: 8, loadKg: 60 }],
    }).feedback[feedbackKey(1, day)];
    expect(run.doneType).toBe("course");
    expect(run.run).toEqual({ distanceKm: 8, paceSec: 360, timeSec: 2880, elevationM: 40 });
    expect(run.strength).toBeUndefined();

    const gym = recordFeedback(s, 1, day, {
      done: true,
      rpe: 6,
      doneType: "salle",
      run: { distanceKm: 8 },
      strength: [{ exercise: "Squat", sets: 3, reps: 8, loadKg: 60 }],
    }).feedback[feedbackKey(1, day)];
    expect(gym.run).toBeUndefined();
    expect(gym.strength).toEqual([{ exercise: "Squat", sets: 3, reps: 8, loadKg: 60 }]);
  });
});

describe("modifier une séance déjà faite", () => {
  it("corrige le retour d'une semaine déjà bilantée sans toucher au plan", () => {
    const s = createState(VELO_TO_10K, "2026-11-16");
    const day = s.plan.weeks[0].sessions[0].day;
    const noted = recordFeedback(s, 1, day, { done: true, rpe: 4 });
    const reviewed = { ...noted, reviews: [{ weekIndex: 1 } as never] };
    expect(() => recordFeedback(reviewed, 1, day, { done: true, rpe: 7 })).toThrow();
    const fixed = recordFeedback(
      reviewed,
      1,
      day,
      { done: true, rpe: 7, doneType: "course", run: { distanceKm: 5 } },
      { afterReview: true },
    );
    expect(fixed.feedback[feedbackKey(1, day)].rpe).toBe(7);
    expect(fixed.feedback[feedbackKey(1, day)].run).toEqual({ distanceKm: 5 });
    expect(fixed.plan).toBe(reviewed.plan);
  });
});
