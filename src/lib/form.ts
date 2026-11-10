import { formCurve } from "@/engine";
import { daysBetween, sessionDate, type ISODate } from "./dates";
import { feedbackKey, isReviewed, type AppState } from "./state";

export interface FormWeek {
  weekIndex: number;
  /** Charge de la semaine : réalisée pour les jours passés, prévue pour la suite. */
  load: number;
  /** Valeurs au dimanche de la semaine. */
  fitness: number;
  fatigue: number;
  form: number;
  /** Semaine pas encore terminée : les valeurs s'appuient sur les séances prévues. */
  projected: boolean;
}

/**
 * Charge de chaque jour du plan. Séance notée : durée faite × difficulté ressentie. Séance à
 * venir, ou passée mais pas encore notée : durée prévue × difficulté visée. Séance comptée
 * non faite : 0. Les séances libres s'ajoutent.
 */
export function dailyPlanLoads(state: AppState): number[] {
  const days = Array<number>(state.plan.weeks.length * 7).fill(0);
  for (const w of state.plan.weeks) {
    for (const s of w.sessions) {
      const fb = state.feedback[feedbackKey(w.index, s.day)];
      const i = (w.index - 1) * 7 + s.day;
      if (fb) {
        if (fb.done && fb.rpe !== undefined) days[i] += (fb.durationMin ?? s.durationMin) * fb.rpe;
      } else if (!isReviewed(state, w.index)) {
        days[i] += s.durationMin * s.targetRpe;
      }
    }
  }
  for (const f of state.freeSessions ?? []) {
    const i = daysBetween(state.startDate, f.date);
    if (i >= 0 && i < days.length) days[i] += f.durationMin * f.rpe;
  }
  return days;
}

/** Courbes de forme semaine par semaine : réalisé jusqu'à aujourd'hui, projeté ensuite. */
export function formByWeek(state: AppState, today: ISODate): FormWeek[] {
  const daily = dailyPlanLoads(state);
  const curve = formCurve(daily);
  return state.plan.weeks.map((w) => {
    const sunday = (w.index - 1) * 7 + 6;
    const p = curve[sunday];
    return {
      weekIndex: w.index,
      load: daily.slice(sunday - 6, sunday + 1).reduce((a, b) => a + b, 0),
      fitness: Math.round(p.fitness),
      fatigue: Math.round(p.fatigue),
      form: Math.round(p.form),
      projected: sessionDate(state.startDate, w.index, 6) >= today,
    };
  });
}
