import { acuteChronicRatio, dailyLoads, monotony, ratioZone, type DoneSession } from "@/engine";
import { position, sessionDate, type ISODate } from "./dates";
import { feedbackKey, type AppState, type StrengthSet } from "./state";

export interface WeekStats {
  weekIndex: number;
  /** Minutes de course prévues sur toute la semaine. */
  plannedRun: number;
  /** Minutes de course faites (durée réelle si notée, sinon prévue). */
  doneRun: number;
  /** Charge sRPE de la semaine (toutes séances faites). */
  load: number;
  /** Séances prévues dont la date est passée ou aujourd'hui. */
  due: number;
  done: number;
  monotony: number | null;
}

/** Séances faites d'une semaine, au format du moteur. */
function doneSessions(state: AppState, weekIndex: number): (DoneSession & { impact: boolean })[] {
  const week = state.plan.weeks[weekIndex - 1];
  return week.sessions.flatMap((s) => {
    const fb = state.feedback[feedbackKey(weekIndex, s.day)];
    if (!fb?.done || fb.rpe === undefined) return [];
    return [
      { day: s.day, durationMin: fb.durationMin ?? s.durationMin, rpe: fb.rpe, impact: s.impact },
    ];
  });
}

/** Statistiques des semaines commencées, jusqu'à aujourd'hui. */
export function weeklyStats(state: AppState, today: ISODate): WeekStats[] {
  const total = state.plan.weeks.length;
  const pos = position(state.startDate, today, total);
  const last = pos.status === "avant" ? 0 : pos.status === "termine" ? total : pos.weekIndex;
  return state.plan.weeks.slice(0, last).map((w) => {
    const done = doneSessions(state, w.index);
    return {
      weekIndex: w.index,
      plannedRun: w.runMinutes,
      doneRun: done.filter((s) => s.impact).reduce((a, s) => a + s.durationMin, 0),
      load: done.reduce((a, s) => a + s.durationMin * s.rpe, 0),
      due: w.sessions.filter((s) => sessionDate(state.startDate, w.index, s.day) <= today).length,
      done: w.sessions.filter((s) => state.feedback[feedbackKey(w.index, s.day)]?.done).length,
      monotony: done.length ? monotony(dailyLoads(done)) : null,
    };
  });
}

/** Semaines terminées nécessaires avant de calculer le ratio aigu / chronique. */
export const MIN_WEEKS_FOR_RATIO = 2;

export interface Summary {
  weeks: WeekStats[];
  sessionsDone: number;
  sessionsDue: number;
  runMinutesDone: number;
  currentLoad: number | null;
  ratio: number | null;
  zone: ReturnType<typeof ratioZone>;
}

export function summary(state: AppState, today: ISODate): Summary {
  const weeks = weeklyStats(state, today);
  // Ratio sur les semaines terminées seulement : une semaine entamée fausserait la charge aiguë.
  const completed = weeks.filter((w) => sessionDate(state.startDate, w.weekIndex, 6) < today);
  const ratio =
    completed.length >= MIN_WEEKS_FOR_RATIO
      ? acuteChronicRatio(completed.map((w) => w.load))
      : null;
  return {
    weeks,
    sessionsDone: weeks.reduce((a, w) => a + w.done, 0),
    sessionsDue: weeks.reduce((a, w) => a + w.due, 0),
    runMinutesDone: weeks.reduce((a, w) => a + w.doneRun, 0),
    currentLoad: weeks.at(-1)?.load ?? null,
    ratio,
    zone: ratioZone(ratio),
  };
}

export interface JournalEntry {
  weekIndex: number;
  day: number;
  date: ISODate;
  kind: AppState["plan"]["weeks"][number]["sessions"][number]["kind"];
  plannedMin: number;
  feedback: AppState["feedback"][string];
}

/** Toutes les séances notées, de la plus récente à la plus ancienne. */
export function journal(state: AppState): JournalEntry[] {
  return state.plan.weeks
    .flatMap((w) =>
      w.sessions.flatMap((s) => {
        const fb = state.feedback[feedbackKey(w.index, s.day)];
        return fb
          ? [
              {
                weekIndex: w.index,
                day: s.day,
                date: sessionDate(state.startDate, w.index, s.day),
                kind: s.kind,
                plannedMin: s.durationMin,
                feedback: fb,
              },
            ]
          : [];
      }),
    )
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

export interface StrengthRecord {
  exercise: string;
  loadKg: number;
  reps: number;
  date: ISODate;
}

/** Meilleure charge par exercice (à égalité, le plus de répétitions), les 3 premiers d'abord. */
export function strengthRecords(state: AppState): StrengthRecord[] {
  const best = new Map<string, StrengthRecord>();
  for (const e of journal(state)) {
    for (const r of e.feedback.strength ?? ([] as StrengthSet[])) {
      const key = r.exercise.toLowerCase();
      const cur = best.get(key);
      if (!cur || r.loadKg > cur.loadKg || (r.loadKg === cur.loadKg && r.reps > cur.reps)) {
        best.set(key, { exercise: r.exercise, loadKg: r.loadKg, reps: r.reps, date: e.date });
      }
    }
  }
  return [...best.values()].sort((a, b) => b.loadKg - a.loadKg);
}
