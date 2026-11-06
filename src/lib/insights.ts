import { paces, type PaceRange, type Session } from "@/engine";
import { journal } from "./analytics";
import { sessionDate, type ISODate } from "./dates";
import { cycles, feedbackKey, type Activity, type AppState, type StrengthSet } from "./state";
import { activityPace } from "./strava";

const EASY = new Set(["endurance", "sortie-longue", "course-marche"]);

/** Numéro de semaine du plan pour une date (peut être hors plan). */
export const weekOfDate = (state: AppState, date: ISODate) =>
  Math.floor(
    (Date.parse(`${date}T12:00:00Z`) - Date.parse(`${state.startDate}T12:00:00Z`)) /
      (7 * 86_400_000),
  ) + 1;

export type Verdict =
  "Dans la cible" | "Trop vite" | "Plus lent que prévu" | "Séance de qualité" | "Hors plan" | "";

export interface RunRow {
  activity: Activity;
  weekIndex: number;
  /** Séance prévue rapprochée (même jour, sinon la première libre de la semaine). */
  planned: Session | null;
  pace: number | null;
  target: PaceRange | null;
  verdict: Verdict;
}

/**
 * Chaque course Strava depuis le début du plan, rapprochée d'une séance de course prévue,
 * avec un verdict d'allure pour les séances faciles (zone d'endurance).
 */
export function runAnalysis(state: AppState): RunRow[] {
  const ref = state.plan.profile.reference5kSec;
  const easyRange = ref ? paces(ref, state.plan.profile.goal).endurance : null;
  const runs = (state.activities ?? [])
    .filter((a) => a.sport === "course" && a.date >= state.startDate && a.distanceM > 0)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  const used = new Set<string>();
  return runs.map((a) => {
    const w = weekOfDate(state, a.date);
    const week = state.plan.weeks[w - 1];
    const runsOfWeek = week?.sessions.filter((s) => s.impact) ?? [];
    const sameDay = runsOfWeek.find(
      (s) => sessionDate(state.startDate, w, s.day) === a.date && !used.has(`${w}-${s.day}`),
    );
    const planned = sameDay ?? runsOfWeek.find((s) => !used.has(`${w}-${s.day}`)) ?? null;
    if (planned) used.add(`${w}-${planned.day}`);
    const pace = activityPace(a);
    let verdict: Verdict = "";
    let target: PaceRange | null = null;
    if (!planned) verdict = week ? "Hors plan" : "";
    else if (!EASY.has(planned.kind)) verdict = "Séance de qualité";
    else if (easyRange && pace) {
      target = easyRange;
      verdict =
        pace < easyRange[0] - 5
          ? "Trop vite"
          : pace > easyRange[1] + 15
            ? "Plus lent que prévu"
            : "Dans la cible";
    }
    return { activity: a, weekIndex: w, planned, pace, target, verdict };
  });
}

export interface RunSummary {
  kmSinceStart: number;
  longestKm: number | null;
  /** Allure moyenne des sorties faciles, pondérée par la distance (s/km). */
  easyPace: number | null;
  easyInTarget: number;
  easyTotal: number;
}

export function runSummary(rows: RunRow[]): RunSummary {
  const km = rows.reduce((a, r) => a + r.activity.distanceM, 0) / 1000;
  const easy = rows.filter(
    (r) => r.planned && EASY.has(r.planned.kind) && r.activity.distanceM > 0,
  );
  const dist = easy.reduce((a, r) => a + r.activity.distanceM, 0);
  const time = easy.reduce((a, r) => a + r.activity.movingSec, 0);
  return {
    kmSinceStart: Math.round(km * 10) / 10,
    longestKm: rows.length
      ? Math.round(Math.max(...rows.map((r) => r.activity.distanceM)) / 100) / 10
      : null,
    easyPace: dist ? time / (dist / 1000) : null,
    easyInTarget: easy.filter((r) => r.verdict === "Dans la cible").length,
    easyTotal: easy.filter((r) => r.verdict).length,
  };
}

/** FC max connue : celle saisie dans les métriques, sinon la plus haute relevée par Strava. */
export function knownMaxHr(state: AppState): number | null {
  const fromMetrics = Object.values(state.metrics ?? {})
    .map((m) => m.maxHr)
    .filter((x): x is number => typeof x === "number");
  if (fromMetrics.length) return Math.max(...fromMetrics);
  const seen = (state.activities ?? [])
    .map((a) => a.maxHr)
    .filter((x): x is number => typeof x === "number");
  return seen.length ? Math.max(...seen) : null;
}

export interface WeekRunMetrics {
  weekIndex: number;
  /** Efficacité aérobie des sorties faciles : mètres par battement de cœur. */
  efficiency: number | null;
  cadence: number | null;
  /** Minutes des sorties à FC moyenne sous 80 % de la FC max, et au-dessus. */
  easyMin: number;
  hardMin: number;
  easyShare: number | null;
}

/** Métriques de course par semaine du plan, d'après les données Strava. */
export function weeklyRunMetrics(state: AppState): WeekRunMetrics[] {
  const rows = runAnalysis(state);
  const hrMax = knownMaxHr(state);
  return state.plan.weeks.map((w) => {
    const rs = rows.filter((r) => r.weekIndex === w.index);
    const effs = rs
      .filter(
        (r) => r.planned && EASY.has(r.planned.kind) && r.activity.avgHr && r.activity.movingSec,
      )
      .map((r) => r.activity.distanceM / (r.activity.movingSec / 60) / r.activity.avgHr!);
    const cads = rs
      .map((r) => r.activity.cadence)
      .filter((c): c is number => typeof c === "number");
    let easyMin = 0;
    let hardMin = 0;
    if (hrMax) {
      for (const r of rs) {
        if (!r.activity.avgHr) continue;
        const min = r.activity.movingSec / 60;
        if (r.activity.avgHr < 0.8 * hrMax) easyMin += min;
        else hardMin += min;
      }
    }
    const tot = easyMin + hardMin;
    return {
      weekIndex: w.index,
      efficiency: effs.length
        ? Math.round((effs.reduce((a, b) => a + b, 0) / effs.length) * 100) / 100
        : null,
      cadence: cads.length ? Math.round(cads.reduce((a, b) => a + b, 0) / cads.length) : null,
      easyMin: Math.round(easyMin),
      hardMin: Math.round(hardMin),
      easyShare: tot ? Math.round((easyMin / tot) * 100) : null,
    };
  });
}

export interface OneRmSeries {
  exercise: string;
  points: { date: ISODate; oneRm: number }[];
}

/** 1RM estimé (formule d'Epley : charge × (1 + reps / 30)) par exercice et par séance. */
export function oneRepMax(state: AppState): OneRmSeries[] {
  const by = new Map<string, { exercise: string; pts: Map<ISODate, number> }>();
  const add = (date: ISODate, sets: StrengthSet[] | undefined) => {
    for (const s of sets ?? []) {
      if (!(s.loadKg > 0) || !(s.reps > 0)) continue;
      const key = s.exercise.trim().toLowerCase();
      const v = Math.round(s.loadKg * (1 + s.reps / 30) * 10) / 10;
      const cur = by.get(key) ?? { exercise: s.exercise.trim(), pts: new Map() };
      cur.pts.set(date, Math.max(cur.pts.get(date) ?? 0, v));
      by.set(key, cur);
    }
  };
  for (const c of cycles(state))
    for (const e of journal({ ...state, ...c })) add(e.date, e.feedback.strength);
  for (const f of state.freeSessions ?? []) add(f.date, f.strength);
  return [...by.values()]
    .map((x) => ({
      exercise: x.exercise,
      points: [...x.pts.entries()]
        .sort((a, b) => (a[0] < b[0] ? -1 : 1))
        .map(([date, oneRm]) => ({ date, oneRm })),
    }))
    .sort(
      (a, b) => b.points.length - a.points.length || a.exercise.localeCompare(b.exercise, "fr"),
    );
}

/** Dernière performance d'un exercice avant une date (« la dernière fois : 4 × 10 à 80 kg »). */
export function lastStrength(
  state: AppState,
  exercise: string,
  before: ISODate,
): (StrengthSet & { date: ISODate }) | null {
  const key = exercise.trim().toLowerCase();
  if (!key) return null;
  const entries: { date: ISODate; sets?: StrengthSet[] }[] = [
    ...cycles(state).flatMap((c) =>
      journal({ ...state, ...c }).map((e) => ({ date: e.date, sets: e.feedback.strength })),
    ),
    ...(state.freeSessions ?? []).map((f) => ({ date: f.date, sets: f.strength })),
  ]
    .filter((e) => e.date < before)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  for (const e of entries) {
    const s = e.sets?.find((x) => x.exercise.trim().toLowerCase() === key);
    if (s) return { ...s, date: e.date };
  }
  return null;
}

/** Noms d'exercices déjà utilisés, plus une liste de départ, pour l'aide à la saisie. */
export function exerciseNames(state: AppState): string[] {
  const names = new Set([
    "Mollets excentriques",
    "Mollets debout",
    "Presse à cuisses",
    "Squat",
    "Fentes",
    "Soulevé de terre roumain",
    "Hip thrust",
    "Leg curl",
    "Leg extension",
    "Développé couché",
    "Tirage vertical",
    "Rowing",
    "Pompes",
    "Tractions",
    "Gainage",
    "Gainage latéral",
  ]);
  for (const c of cycles(state)) {
    for (const e of journal({ ...state, ...c }))
      for (const s of e.feedback.strength ?? []) names.add(s.exercise);
  }
  for (const f of state.freeSessions ?? []) for (const s of f.strength ?? []) names.add(s.exercise);
  return [...names].sort((a, b) => a.localeCompare(b, "fr"));
}

export interface LastSession {
  date: ISODate;
  title: string;
  activity: Activity | null;
  rpe?: number;
  target?: number;
  sensation?: string;
  comment?: string;
  /** Séance prévue à noter (semaine, jour), ou séance libre. */
  plannedKey?: { weekIndex: number; day: number };
  free?: boolean;
  noted: boolean;
}

/** Dernière séance faite (activité Strava ou retour), jusqu'à aujourd'hui. */
export function lastSession(
  state: AppState,
  today: ISODate,
  label: (s: Session) => string,
): LastSession | null {
  const acts = (state.activities ?? []).filter((a) => a.date <= today && a.sport !== "autre");
  const notes = journal(state).filter((e) => e.date <= today && e.feedback.done);
  const frees = (state.freeSessions ?? []).filter((f) => f.date <= today);
  const dates = [
    ...acts.map((a) => a.date),
    ...notes.map((n) => n.date),
    ...frees.map((f) => f.date),
  ].sort();
  const d = dates.at(-1);
  if (!d) return null;
  const note = notes.find((n) => n.date === d);
  const free = frees.find((f) => f.date === d);
  const w = weekOfDate(state, d);
  const plannedSessions =
    state.plan.weeks[w - 1]?.sessions.filter((s) => sessionDate(state.startDate, w, s.day) === d) ??
    [];
  const planned = plannedSessions[0];
  const sport = planned
    ? planned.impact
      ? "course"
      : planned.kind === "renfo"
        ? "renfo"
        : "velo"
    : free?.sport;
  const dayActs = acts.filter((a) => a.date === d);
  const activity =
    (note?.feedback.activityId && dayActs.find((a) => a.id === note.feedback.activityId)) ||
    dayActs.find((a) => a.sport === sport) ||
    dayActs[0] ||
    null;
  const fb = planned ? state.feedback[feedbackKey(w, planned.day)] : undefined;
  return {
    date: d,
    title: planned
      ? label(planned)
      : free
        ? `Séance libre · ${free.sport}`
        : (activity?.name ?? "Séance"),
    activity,
    rpe: fb?.rpe ?? free?.rpe,
    target: planned?.targetRpe,
    sensation: fb?.sensation ?? free?.sensation,
    comment: fb?.comment ?? free?.comment,
    plannedKey: planned ? { weekIndex: w, day: planned.day } : undefined,
    free: !planned,
    noted: Boolean(fb?.done || free),
  };
}
