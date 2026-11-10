import { describe, expect, it } from "vitest";
import { plannedLoad } from "@/engine";
import { VELO_TO_10K } from "@/engine/fixtures";
import { analyseFeedback, autoReview, submitFeedback } from "./adapt";
import { formByWeek } from "./form";
import { applyObjectives, nextObjective, removeObjective, saveObjective } from "./objectives";
import { addSession, freeDays, moveSession, removeSession } from "./planEdit";
import { createState, feedbackKey, isReviewed, recordFeedback, type AppState } from "./state";

const START = "2026-01-05"; // un lundi
const TODAY = "2026-01-05";
const fresh = (): AppState =>
  createState({ ...VELO_TO_10K, reference5kSec: 1500, strengthPerWeek: 1 }, START);
// Semaine type : course mardi (1), jeudi (3), dimanche (6), renfo lundi (0), vélo samedi (5).

describe("modifier le plan", () => {
  it("supprime une séance et recalcule la charge de la semaine", () => {
    const s = fresh();
    const before = plannedLoad(s.plan.weeks[2]);
    const r = removeSession(s, 3, 0);
    const w = r.state.plan.weeks[2];
    expect(w.sessions.some((x) => x.day === 0)).toBe(false);
    expect(w.edited).toBe(true);
    expect(w.baseLoad).toBe(before);
    expect(r.message).toContain(`${before} → ${plannedLoad(w)} UA`);
  });

  it("déplace une séance dans la semaine sans changer la charge", () => {
    const s = fresh();
    const r = moveSession(s, { week: 2, day: 3 }, { week: 2, day: 4 }, TODAY);
    const w = r.state.plan.weeks[1];
    expect(w.sessions.find((x) => x.day === 4)?.movedFrom).toBe(3);
    expect(plannedLoad(w)).toBe(plannedLoad(s.plan.weeks[1]));
    expect(r.message).toContain("inchangée");
    expect(r.adjusted).toBe(false);
  });

  it("refuse un jour déjà pris, un jour passé et une séance déjà notée", () => {
    const s = fresh();
    expect(() => moveSession(s, { week: 2, day: 3 }, { week: 2, day: 1 }, TODAY)).toThrow();
    expect(() => addSession(s, 1, 2, { kind: "endurance", durationMin: 30 }, "2026-01-09")).toThrow(
      /aujourd'hui/,
    );
    const rated = recordFeedback(s, 1, 0, { done: true, rpe: 5 });
    expect(() => removeSession(rated, 1, 0)).toThrow(/déjà notée/);
  });

  it("raccourcit une séance ajoutée qui fait dépasser la charge de plus de 10 %", () => {
    const s = fresh();
    const base = plannedLoad(s.plan.weeks[3]);
    const r = addSession(s, 4, 2, { kind: "tempo", durationMin: 60 }, TODAY);
    const w = r.state.plan.weeks[3];
    const added = w.sessions.find((x) => x.day === 2)!;
    expect(r.adjusted).toBe(true);
    expect(added.durationMin).toBeLessThan(60);
    expect(added.custom).toBe(true);
    expect(added.note).toContain("10 %");
    expect(plannedLoad(w)).toBeLessThanOrEqual(base * 1.1 + added.targetRpe * 15);
    expect(r.message).toContain("pour que la semaine ne dépasse pas");
  });

  it("laisse passer une séance ajoutée qui reste sous 10 % de hausse", () => {
    const s = removeSession(fresh(), 4, 0).state;
    const r = addSession(s, 4, 2, { kind: "renfo", durationMin: 40, focus: "haut" }, TODAY);
    expect(r.adjusted).toBe(false);
    expect(r.state.plan.weeks[3].sessions.find((x) => x.day === 2)?.focus).toBe("haut");
  });

  it("ajuste la séance déplacée vers une autre semaine trop chargée", () => {
    const s = fresh();
    const long = s.plan.weeks[4].sessions.find((x) => x.kind === "sortie-longue")!;
    const r = moveSession(s, { week: 5, day: long.day }, { week: 6, day: 2 }, TODAY);
    const dest = r.state.plan.weeks[5];
    expect(r.state.plan.weeks[4].sessions.some((x) => x.kind === "sortie-longue")).toBe(false);
    expect(dest.sessions.find((x) => x.day === 2)!.durationMin).toBeLessThan(long.durationMin);
    expect(r.adjusted).toBe(true);
    expect(r.message).toContain("semaine 6");
  });

  it("prévient quand deux séances dures se suivent", () => {
    const s = fresh();
    const w = s.plan.weeks.find((x) => x.sessions.some((y) => y.kind === "tempo"))!;
    const hard = w.sessions.find((x) => x.kind === "tempo")!;
    const free = freeDays(s, w.index, TODAY).find((d) => Math.abs(d - hard.day) === 1)!;
    const r = addSession(s, w.index, free, { kind: "tempo", durationMin: 20 }, TODAY);
    expect(r.message).toContain("deux séances dures se suivent");
  });

  it("recalcule les courbes de forme après une modification", () => {
    const s = fresh();
    const before = formByWeek(s, TODAY);
    const after = formByWeek(removeSession(s, 3, 6).state, TODAY);
    expect(after[2].load).toBeLessThan(before[2].load);
    expect(after[2].fatigue).toBeLessThan(before[2].fatigue);
    expect(after[1]).toEqual(before[1]);
    expect(after[2].projected).toBe(true);
  });
});

describe("objectifs", () => {
  const add = (s: AppState, date: string, priority: "principal" | "secondaire", label = "Course") =>
    saveObjective(s, { date, label, distanceKm: 10, priority }, TODAY);

  it("organise la semaine autour d'un objectif principal", () => {
    const r = add(fresh(), "2026-02-15", "principal", "10 km de la ville"); // dimanche, semaine 6
    const w = r.state.plan.weeks[5];
    expect(w.objective).toBe("principal");
    expect(w.sessions.find((x) => x.day === 6)?.objective?.label).toBe("10 km de la ville");
    expect(r.state.plan.weeks[6].deload).toBe(true);
    expect(r.message).toContain("affûtée");
    expect(nextObjective(r.state, TODAY)?.label).toBe("10 km de la ville");
  });

  it("traite un objectif secondaire comme préparation du prochain principal", () => {
    let s = add(fresh(), "2026-03-15", "principal", "Semi de printemps").state;
    const r = add(s, "2026-02-08", "secondaire", "Corrida");
    s = r.state;
    const race = s.plan.weeks[4].sessions.find((x) => x.kind === "objectif")!;
    expect(race.objective?.priority).toBe("secondaire");
    expect(race.objective?.prepFor).toBe("Semi de printemps");
    expect(r.message).toContain("en préparation de Semi de printemps");
    expect(s.plan.weeks[9].sessions.some((x) => x.objective?.label === "Semi de printemps")).toBe(
      true,
    );
  });

  it("prépare le test de fin de plan quand il n'y a pas d'objectif principal", () => {
    const r = add(fresh(), "2026-02-08", "secondaire");
    expect(r.message).toContain("fin de plan");
  });

  it("rend sa forme normale à la semaine quand l'objectif est supprimé", () => {
    const base = fresh();
    const s = add(base, "2026-02-15", "principal").state;
    const back = removeObjective(s, s.objectives![0].id, TODAY);
    expect(back.plan.weeks.map((w) => w.runMinutes)).toEqual(
      base.plan.weeks.map((w) => w.runMinutes),
    );
    expect(back.plan.weeks[5].sessions.some((x) => x.kind === "objectif")).toBe(false);
    expect(back.plan.weeks[5].objective).toBeUndefined();
  });

  it("ne touche pas aux séances d'une semaine déjà commencée", () => {
    const base = fresh();
    const r = add(base, "2026-01-11", "secondaire");
    expect(r.state.plan.weeks[0]).toEqual(base.plan.weeks[0]);
    expect(r.message).toContain("déjà commencée");
    expect(r.state.objectives).toHaveLength(1);
  });

  it("garde un objectif hors du plan pour le prochain cycle", () => {
    const r = add(fresh(), "2027-01-10", "principal");
    expect(r.message).toContain("hors du plan");
    expect(r.state.plan.objectives).toEqual([]);
  });

  it("garde la course en place une fois sa semaine commencée", () => {
    const s = add(fresh(), "2026-02-15", "principal").state;
    const later = applyObjectives(s, "2026-02-11");
    expect(later.plan.weeks[5].sessions.some((x) => x.kind === "objectif")).toBe(true);
    expect(later.plan.objectives).toHaveLength(1);
  });
});

describe("analyse des retours", () => {
  it("allège et adoucit les 2 prochaines courses après une douleur", () => {
    const s = fresh();
    const next = submitFeedback(s, 1, 1, { done: true, rpe: 4, pain: "douleur" }, "2026-01-06");
    const fb = next.feedback[feedbackKey(1, 1)];
    expect(fb.adapt?.changes).toHaveLength(2);
    expect(fb.adapt?.text).toContain("Douleur signalée");
    const thu = next.plan.weeks[0].sessions.find((x) => x.day === 3)!;
    expect(thu.durationMin).toBeLessThan(
      s.plan.weeks[0].sessions.find((x) => x.day === 3)!.durationMin,
    );
    expect(thu.note).toContain("douleur");
  });

  it("allège la prochaine séance quand c'est bien plus dur que prévu", () => {
    const s = fresh();
    const next = submitFeedback(s, 1, 1, { done: true, rpe: 7 }, "2026-01-06");
    const adapt = next.feedback[feedbackKey(1, 1)].adapt!;
    expect(adapt.changes).toHaveLength(1);
    expect(adapt.changes[0]).toMatchObject({ week: 1, day: 3 });
    expect(adapt.text).toContain("Plus dur que prévu");
  });

  it("ne change rien quand le ressenti colle au plan", () => {
    const s = fresh();
    const next = submitFeedback(s, 1, 1, { done: true, rpe: 3 }, "2026-01-06");
    expect(next.feedback[feedbackKey(1, 1)].adapt).toBeUndefined();
    expect(next.plan).toEqual(s.plan);
  });

  it("annule l'adaptation quand le retour est corrigé", () => {
    const s = fresh();
    const hard = submitFeedback(s, 1, 1, { done: true, rpe: 8 }, "2026-01-06");
    const fixed = submitFeedback(hard, 1, 1, { done: true, rpe: 3 }, "2026-01-06");
    expect(fixed.plan).toEqual(s.plan);
    expect(fixed.feedback[feedbackKey(1, 1)].adapt).toBeUndefined();
  });

  it("ajoute 5 min à la sortie longue après deux courses très faciles", () => {
    let s = fresh();
    // Semaine 3 : endurance mardi et jeudi (difficulté visée 4), sortie longue dimanche.
    s = {
      ...s,
      plan: {
        ...s.plan,
        weeks: s.plan.weeks.map((w) => ({
          ...w,
          sessions: w.sessions.map((x) =>
            x.kind === "course-marche" || x.kind === "tempo"
              ? { ...x, kind: "endurance" as const, targetRpe: 4 }
              : x,
          ),
        })),
      },
    };
    const long = s.plan.weeks[2].sessions.find((x) => x.day === 6)!.durationMin;
    s = submitFeedback(s, 3, 1, { done: true, rpe: 2, sensation: "bien" }, "2026-01-20");
    expect(s.feedback[feedbackKey(3, 1)].adapt).toBeUndefined();
    s = submitFeedback(s, 3, 3, { done: true, rpe: 2, sensation: "tres-bien" }, "2026-01-22");
    expect(s.feedback[feedbackKey(3, 3)].adapt?.text).toContain("5 min ajoutées");
    expect(s.plan.weeks[2].sessions.find((x) => x.day === 6)!.durationMin).toBe(long + 5);
  });

  it("ne touche pas à une course objectif", () => {
    let s = saveObjective(
      fresh(),
      { date: "2026-01-18", label: "Corrida", distanceKm: 5, priority: "secondaire" },
      TODAY,
    ).state;
    const race = s.plan.weeks[1].sessions.find((x) => x.kind === "objectif")!;
    const sat = s.plan.weeks[1].sessions.filter((x) => x.day < 6 && x.impact).at(-1)!;
    s = analyseFeedback(recordFeedback(s, 2, sat.day, { done: true, rpe: 9 }), 2, sat.day);
    expect(s.plan.weeks[1].sessions.find((x) => x.kind === "objectif")).toEqual(race);
  });

  it("fait le bilan tout seul quand la semaine est finie et entièrement notée", () => {
    let s = fresh();
    const days = s.plan.weeks[0].sessions.map((x) => x.day);
    for (const d of days.slice(0, -1))
      s = submitFeedback(s, 1, d, { done: true, rpe: 4 }, "2026-01-12");
    expect(isReviewed(s, 1)).toBe(false);
    s = submitFeedback(s, 1, days.at(-1)!, { done: true, rpe: 4 }, "2026-01-12");
    expect(isReviewed(s, 1)).toBe(true);
    expect(s.reviews[0].decision).toBe("progresser");
  });

  it("attend la fin de la semaine pour faire le bilan", () => {
    let s = fresh();
    for (const x of s.plan.weeks[0].sessions) {
      s = submitFeedback(s, 1, x.day, { done: true, rpe: 4 }, "2026-01-11");
    }
    expect(isReviewed(s, 1)).toBe(false);
    expect(isReviewed(autoReview(s, "2026-01-12"), 1)).toBe(true);
  });
});
