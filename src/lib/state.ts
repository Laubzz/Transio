import {
  adjustPlan,
  generatePlan,
  type Decision,
  type Plan,
  type Profile,
  type SessionFeedback,
  type WeekFeedback,
} from "@/engine";
import type { ISODate } from "./dates";

/** Une ligne du journal muscu. */
export interface StrengthSet {
  exercise: string;
  sets: number;
  reps: number;
  /** Charge en kg (0 pour le poids du corps). */
  loadKg: number;
}

/** Retour enregistré sur une séance. */
export interface StoredFeedback extends SessionFeedback {
  /** Durée réellement faite, en minutes (sinon la durée prévue). */
  durationMin?: number;
  comment?: string;
  /** Exercices faits, pour une séance de renforcement. */
  strength?: StrengthSet[];
}

const positive = (n: unknown) =>
  typeof n === "number" && Number.isFinite(n) && n > 0 ? n : undefined;

function cleanStrength(sets: StrengthSet[] | undefined): StrengthSet[] | undefined {
  const rows = (sets ?? [])
    .map((r) => ({
      exercise: r.exercise.trim(),
      sets: Math.round(positive(r.sets) ?? 0),
      reps: Math.round(positive(r.reps) ?? 0),
      loadKg: Math.max(0, Number(r.loadKg) || 0),
    }))
    .filter((r) => r.exercise && r.sets > 0 && r.reps > 0);
  return rows.length ? rows : undefined;
}

/** Bilan d'une semaine terminée, tel qu'appliqué au plan. */
export interface WeekReview {
  weekIndex: number;
  decision: Decision;
  reasons: string[];
}

/** Tout ce que l'app garde sur l'appareil (en attendant la base de données). */
export interface AppState {
  version: 1;
  plan: Plan;
  /** Lundi de la semaine 1. */
  startDate: ISODate;
  /** Retours par séance, clé `semaine-jour`. */
  feedback: Record<string, StoredFeedback>;
  reviews: WeekReview[];
}

export const feedbackKey = (weekIndex: number, day: number) => `${weekIndex}-${day}`;

export function createState(profile: Profile, startDate: ISODate): AppState {
  return { version: 1, plan: generatePlan(profile), startDate, feedback: {}, reviews: [] };
}

export function recordFeedback(
  state: AppState,
  weekIndex: number,
  day: number,
  fb: StoredFeedback,
): AppState {
  const week = state.plan.weeks[weekIndex - 1];
  if (!week?.sessions.some((s) => s.day === day)) {
    throw new RangeError(`Aucune séance prévue semaine ${weekIndex}, jour ${day}.`);
  }
  if (isReviewed(state, weekIndex)) {
    throw new Error(`Le bilan de la semaine ${weekIndex} est déjà fait.`);
  }
  const clean: StoredFeedback = fb.done
    ? {
        done: true,
        rpe: fb.rpe,
        pain: fb.pain ?? "aucune",
        durationMin: positive(fb.durationMin) && Math.round(fb.durationMin!),
        comment: fb.comment?.trim() || undefined,
        strength: cleanStrength(fb.strength),
      }
    : { done: false, comment: fb.comment?.trim() || undefined };
  return { ...state, feedback: { ...state.feedback, [feedbackKey(weekIndex, day)]: clean } };
}

export const isReviewed = (state: AppState, weekIndex: number) =>
  state.reviews.some((r) => r.weekIndex === weekIndex);

/** Retour de la semaine pour le moteur ; une séance non notée compte comme non faite. */
export function weekFeedback(state: AppState, weekIndex: number): WeekFeedback {
  const week = state.plan.weeks[weekIndex - 1];
  return {
    weekIndex,
    sessions: week.sessions.map((s) => {
      const fb = state.feedback[feedbackKey(weekIndex, s.day)];
      return fb ? { done: fb.done, rpe: fb.rpe, pain: fb.pain } : { done: false };
    }),
  };
}

/** Première semaine terminée dont le bilan reste à faire, avant `currentWeek`. */
export function pendingReview(state: AppState, currentWeek: number): number | null {
  for (let w = 1; w < currentWeek && w <= state.plan.weeks.length; w++) {
    if (!isReviewed(state, w)) return w;
  }
  return null;
}

/** Fait le bilan d'une semaine et applique la décision au reste du plan. */
export function reviewWeek(state: AppState, weekIndex: number): AppState {
  if (isReviewed(state, weekIndex)) throw new Error(`Bilan de la semaine ${weekIndex} déjà fait.`);
  const earlier = pendingReview(state, weekIndex);
  if (earlier !== null) throw new Error(`Fais d'abord le bilan de la semaine ${earlier}.`);
  const { decision, reasons, plan } = adjustPlan(state.plan, weekFeedback(state, weekIndex));
  return { ...state, plan, reviews: [...state.reviews, { weekIndex, decision, reasons }] };
}

/** Relit l'état sauvegardé ; `null` s'il est absent ou illisible. */
export function parseState(raw: string | null): AppState | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as AppState;
    if (s?.version !== 1 || !Array.isArray(s.plan?.weeks) || typeof s.startDate !== "string") {
      return null;
    }
    return { ...s, feedback: s.feedback ?? {}, reviews: s.reviews ?? [] };
  } catch {
    return null;
  }
}
