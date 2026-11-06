import {
  adjustPlan,
  generatePlan,
  type Decision,
  type Plan,
  type Profile,
  type SessionFeedback,
  type WeekFeedback,
} from "@/engine";
import { addDays, type ISODate } from "./dates";

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
  /** Activités importées de Strava. */
  activities?: Activity[];
  /** Tout l'historique Strava a été importé au moins une fois. */
  stravaFullImport?: boolean;
  /** Cycles terminés (plan de transition, puis suites), du plus ancien au plus récent. */
  history?: ArchivedCycle[];
  /** Export agenda : heure des séances (« 18:30 »), ou `null` pour la journée entière. */
  calendar?: { time: string | null };
}

/** Un cycle terminé, gardé pour le journal et les records. */
export interface ArchivedCycle {
  plan: Plan;
  startDate: ISODate;
  feedback: Record<string, StoredFeedback>;
  reviews: WeekReview[];
}

/** Activité importée (Strava), réduite à ce dont l'app a besoin. */
export interface Activity {
  id: number;
  /** Jour local de l'activité. */
  date: ISODate;
  sport: "course" | "velo" | "renfo" | "autre";
  name: string;
  distanceM: number;
  movingSec: number;
  avgHr?: number;
  elevationM?: number;
  /** Temps écoulé, pauses comprises. */
  elapsedSec?: number;
  maxHr?: number;
  /** Nombre de records personnels battus pendant l'activité (selon Strava). */
  prCount?: number;
  /**
   * Meilleurs efforts de la sortie (400 m, 1 km, 5 km…), lus dans le détail de l'activité.
   * Absent tant que le détail n'a pas été importé.
   */
  bestEfforts?: BestEffort[];
}

/** Meilleur temps sur une distance standard pendant une sortie (« best effort » Strava). */
export interface BestEffort {
  /** Nom Strava de la distance : « 1k », « 5k », « Half-Marathon »… */
  name: string;
  distanceM: number;
  elapsedSec: number;
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

/** Valide un état venu du stockage local ou de la base ; `null` s'il est inutilisable. */
export function normalizeState(value: unknown): AppState | null {
  const s = value as AppState | null;
  if (s?.version !== 1 || !Array.isArray(s.plan?.weeks) || typeof s.startDate !== "string") {
    return null;
  }
  return {
    ...s,
    feedback: s.feedback ?? {},
    reviews: s.reviews ?? [],
    activities: s.activities ?? [],
  };
}

/** Relit l'état sauvegardé ; `null` s'il est absent ou illisible. */
export function parseState(raw: string | null): AppState | null {
  if (!raw) return null;
  try {
    return normalizeState(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** Ajoute des activités importées (sans doublon), de la plus récente à la plus ancienne. */
export function mergeActivities(state: AppState, incoming: Activity[]): AppState {
  const byId = new Map((state.activities ?? []).map((a) => [a.id, a]));
  // Un nouvel import du résumé garde les meilleurs efforts déjà lus.
  for (const a of incoming) byId.set(a.id, { ...byId.get(a.id), ...a });
  const activities = [...byId.values()].sort((a, b) =>
    a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id,
  );
  return { ...state, activities };
}

/** Enregistre les meilleurs efforts lus dans le détail des activités. */
export function setBestEfforts(
  state: AppState,
  details: { id: number; bestEfforts: BestEffort[] }[],
): AppState {
  const byId = new Map(details.map((d) => [d.id, d.bestEfforts]));
  return {
    ...state,
    activities: (state.activities ?? []).map((a) =>
      byId.has(a.id) ? { ...a, bestEfforts: byId.get(a.id) } : a,
    ),
  };
}

/** Sorties dont le détail reste à lire : celles où Strava signale un record personnel. */
export function activitiesNeedingDetails(state: AppState): number[] {
  return (state.activities ?? [])
    .filter((a) => a.sport === "course" && (a.prCount ?? 0) > 0 && a.bestEfforts === undefined)
    .map((a) => a.id);
}

const SPORT_FOR_KIND = (kind: string, impact: boolean): Activity["sport"] =>
  impact ? "course" : kind === "renfo" ? "renfo" : "velo";

/** Activité du même jour et du même sport qu'une séance prévue (la plus longue s'il y en a plusieurs). */
export function matchActivity(
  state: AppState,
  date: ISODate,
  kind: string,
  impact: boolean,
): Activity | null {
  const sport = SPORT_FOR_KIND(kind, impact);
  const same = (state.activities ?? []).filter((a) => a.date === date && a.sport === sport);
  return same.sort((a, b) => b.movingSec - a.movingSec)[0] ?? null;
}

/**
 * Estimation prudente du temps sur 5 km à partir des sorties de course des 6 dernières semaines :
 * l'équivalent 5 km de la sortie la plus rapide entre 3 et 15 km. Les sorties faciles donnent
 * une estimation plus lente que la réalité, donc des allures plutôt sûres.
 */
export function estimate5k(activities: Activity[], today: ISODate): number | null {
  const since = new Date(`${today}T12:00:00`);
  since.setDate(since.getDate() - 42);
  const limit = since.toISOString().slice(0, 10);
  const runs = activities.filter(
    (a) =>
      a.sport === "course" &&
      a.date >= limit &&
      a.distanceM >= 3000 &&
      a.distanceM <= 15000 &&
      a.movingSec > 0,
  );
  // Meilleurs efforts Strava entre 3 et 15 km, plus fiables qu'une moyenne de sortie.
  const efforts = runs.flatMap((a) =>
    (a.bestEfforts ?? []).filter((e) => e.distanceM >= 3000 && e.distanceM <= 15000),
  );
  const candidates = [
    ...runs.map((a) => a.movingSec * (5000 / a.distanceM) ** 1.06),
    ...efforts.map((e) => e.elapsedSec * (5000 / e.distanceM) ** 1.06),
  ];
  if (!candidates.length) return null;
  return Math.round(Math.min(...candidates));
}

/** Change le temps de référence 5 km sans régénérer le plan. */
export function setReference5k(state: AppState, sec: number | undefined): AppState {
  return {
    ...state,
    plan: { ...state.plan, profile: { ...state.plan.profile, reference5kSec: sec } },
  };
}

/** Le cycle en cours suivi des cycles archivés, du plus récent au plus ancien. */
export function cycles(state: AppState): ArchivedCycle[] {
  const current = {
    plan: state.plan,
    startDate: state.startDate,
    feedback: state.feedback,
    reviews: state.reviews,
  };
  return [current, ...[...(state.history ?? [])].reverse()];
}

/** Dernier jour (dimanche) du plan en cours. */
export const planEnd = (state: AppState) =>
  addDays(state.startDate, state.plan.weeks.length * 7 - 1);

/** Choix pour la suite du plan, après la transition. */
export interface NextCycleChoice {
  goal: Profile["goal"];
  weeks: number;
  /** Lundi de la première semaine. */
  startDate: ISODate;
  runDaysPerWeek: Profile["runDaysPerWeek"];
  strengthPerWeek: Profile["strengthPerWeek"];
  strengthPlace?: Profile["strengthPlace"];
  keepOriginSport: boolean;
  reference5kSec?: number;
}

/** Volume de course de reprise : 90 % de la dernière semaine de construction du cycle. */
export function resumeMinutes(plan: Plan): number {
  const builds = plan.weeks.filter((w) => !w.deload && w.phase !== "test");
  const last = builds.at(-1)?.runMinutes ?? plan.weeks[0].runMinutes;
  return Math.floor((last * 0.9) / 5) * 5;
}

/**
 * Archive le cycle en cours et génère la suite : même profil, nouvel objectif, départ au
 * volume déjà atteint et sans course-marche. Les activités importées sont conservées.
 */
export function startNextCycle(state: AppState, choice: NextCycleChoice): AppState {
  const prev = state.plan.profile;
  const profile: Profile = {
    ...prev,
    goal: choice.goal,
    weeks: choice.weeks,
    runDaysPerWeek: choice.runDaysPerWeek,
    strengthPerWeek: choice.strengthPerWeek,
    strengthPlace: choice.strengthPlace ?? prev.strengthPlace,
    keepOriginSport: choice.keepOriginSport,
    reference5kSec: choice.reference5kSec ?? prev.reference5kSec,
    cycle: (prev.cycle ?? 1) + 1,
    startRunMinutes: resumeMinutes(state.plan),
  };
  const archived: ArchivedCycle = {
    plan: state.plan,
    startDate: state.startDate,
    feedback: state.feedback,
    reviews: state.reviews,
  };
  return {
    ...createState(profile, choice.startDate),
    activities: state.activities ?? [],
    calendar: state.calendar,
    history: [...(state.history ?? []), archived],
  };
}
