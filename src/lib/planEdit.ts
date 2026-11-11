import {
  RULES,
  SESSION_DESCRIPTION,
  TARGET_RPE,
  plannedLoad,
  sessionDescription,
  type Session,
  type SessionKind,
  type StrengthFocus,
  type Week,
} from "@/engine";
import { sessionDate, type ISODate } from "./dates";
import { feedbackKey, isReviewed, type AppState } from "./state";

/** Types de séance que l'on peut programmer à la main. */
export const ADDABLE_KINDS = [
  "endurance",
  "sortie-longue",
  "tempo",
  "fractionne",
  "renfo",
  "sport-origine",
] as const satisfies readonly SessionKind[];
export type AddableKind = (typeof ADDABLE_KINDS)[number];

const RUN_KINDS = new Set<SessionKind>(["endurance", "sortie-longue", "tempo", "fractionne"]);
/** Séances qui ne changent pas de semaine : elles sont liées à une date. */
const FIXED = new Set<SessionKind>(["test", "objectif"]);
const MIN_DURATION = 15;
const DAY_NAME = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
const floor5 = (m: number) => Math.floor(m / 5) * 5;
const pct = (v: number, base: number) => Math.round((v / base - 1) * 100);
const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);

export interface EditResult {
  state: AppState;
  /** Ce qui a été fait, avec le nouveau calcul de charge. */
  message: string;
  /** La séance a été raccourcie pour rester sous la hausse de charge tolérée. */
  adjusted: boolean;
}

function editableWeek(state: AppState, weekIndex: number): Week {
  const week = state.plan.weeks[weekIndex - 1];
  if (!week) throw new RangeError(`Semaine ${weekIndex} introuvable.`);
  if (isReviewed(state, weekIndex)) {
    throw new Error(`Le bilan de la semaine ${weekIndex} est fait : elle ne se modifie plus.`);
  }
  return week;
}

function freeSlot(state: AppState, weekIndex: number, day: number, today: ISODate): Week {
  const week = editableWeek(state, weekIndex);
  if (!(day >= 0 && day <= 6)) throw new RangeError("Jour invalide.");
  if (sessionDate(state.startDate, weekIndex, day) < today) {
    throw new RangeError("Choisis un jour à partir d'aujourd'hui.");
  }
  if (week.sessions.some((s) => s.day === day)) {
    throw new RangeError("Il y a déjà une séance ce jour-là.");
  }
  return week;
}

function pendingSession(state: AppState, weekIndex: number, day: number): Session {
  const s = editableWeek(state, weekIndex).sessions.find((x) => x.day === day);
  if (!s) throw new RangeError("Séance introuvable.");
  if (state.feedback[feedbackKey(weekIndex, day)]) {
    throw new Error("Cette séance est déjà notée : elle ne se modifie plus.");
  }
  return s;
}

/** Marque la semaine comme modifiée et garde sa charge d'origine comme référence. */
function withSessions(week: Week, sessions: Session[]): Week {
  return {
    ...week,
    edited: true,
    baseLoad: week.baseLoad ?? plannedLoad(week),
    sessions: [...sessions].sort((a, b) => a.day - b.day),
  };
}

function putWeeks(state: AppState, weeks: Week[], clearKeys: string[] = []): AppState {
  const byIndex = new Map(weeks.map((w) => [w.index, w]));
  const feedback = { ...state.feedback };
  for (const k of clearKeys) delete feedback[k];
  return {
    ...state,
    feedback,
    plan: { ...state.plan, weeks: state.plan.weeks.map((w) => byIndex.get(w.index) ?? w) },
  };
}

/**
 * Garde-fou de charge : si la semaine dépasse de plus de 10 % sa charge d'origine, la séance
 * du jour `day` (celle qui vient d'arriver) est raccourcie jusqu'à revenir dans la limite.
 */
function capLoad(week: Week, day: number): { week: Week; from?: number; to?: number } {
  const base = week.baseLoad ?? plannedLoad(week);
  const limit = base * (1 + RULES.editLoadTolerance);
  const s = week.sessions.find((x) => x.day === day);
  if (!s || FIXED.has(s.kind) || plannedLoad(week) <= limit) return { week };
  const others = plannedLoad(week) - s.durationMin * s.targetRpe;
  const to = Math.max(MIN_DURATION, floor5((limit - others) / s.targetRpe));
  if (to >= s.durationMin) return { week };
  const note = `Raccourcie de ${s.durationMin} à ${to} min : la charge de la semaine ne dépasse pas de plus de 10 % celle prévue.`;
  return {
    week: {
      ...week,
      sessions: week.sessions.map((x) => (x.day === day ? { ...x, durationMin: to, note } : x)),
    },
    from: s.durationMin,
    to,
  };
}

/** Phrase sur la charge de la semaine après une modification. */
function loadText(before: Week, after: Week): string {
  const base = after.baseLoad ?? plannedLoad(before);
  const a = plannedLoad(before);
  const b = plannedLoad(after);
  if (a === b) return `Charge prévue de la semaine ${after.index} inchangée : ${b} UA.`;
  const gap = base > 0 ? pct(b, base) : 0;
  const vsBase =
    base <= 0 || b === base
      ? ""
      : gap === 0
        ? " (au niveau du plan d'origine)"
        : ` (${signed(gap)} % par rapport au plan d'origine)`;
  return `Charge prévue de la semaine ${after.index} : ${a} → ${b} UA${vsBase}.`;
}

/** Alerte si la séance arrive juste avant ou juste après une autre séance dure. */
function hardNeighbour(week: Week, day: number): string {
  const s = week.sessions.find((x) => x.day === day);
  if (!s || s.targetRpe < 7) return "";
  const near = week.sessions.find((x) => Math.abs(x.day - day) === 1 && x.targetRpe >= 7);
  return near
    ? ` Attention : deux séances dures se suivent (${DAY_NAME[Math.min(day, near.day)]} et ${DAY_NAME[Math.max(day, near.day)]}). Garde si possible un jour facile entre les deux.`
    : "";
}

function capText(week: Week, cap: { from?: number; to?: number }): string {
  if (cap.to === undefined) return "";
  const base = week.baseLoad ?? 0;
  const still = base > 0 ? pct(plannedLoad(week), base) : 0;
  return (
    ` La séance est passée de ${cap.from} à ${cap.to} min pour que la semaine ne dépasse pas de plus de 10 % la charge d'origine (${base} UA).` +
    (still > RULES.editLoadTolerance * 100
      ? ` Même raccourcie, la semaine reste à ${signed(still)} % : allège une autre séance si tu te sens fatigué.`
      : "")
  );
}

export interface NewSession {
  kind: AddableKind;
  durationMin: number;
  /** Bloc travaillé, pour une séance de renforcement. */
  focus?: StrengthFocus;
}

/** Programme une nouvelle séance un jour libre, puis recalcule la charge de la semaine. */
export function addSession(
  state: AppState,
  weekIndex: number,
  day: number,
  spec: NewSession,
  today: ISODate,
): EditResult {
  const week = freeSlot(state, weekIndex, day, today);
  if (!(spec.durationMin >= MIN_DURATION && spec.durationMin <= 300)) {
    throw new RangeError(`Durée entre ${MIN_DURATION} et 300 min.`);
  }
  const base: Session = {
    day,
    kind: spec.kind,
    durationMin: Math.round(spec.durationMin / 5) * 5,
    targetRpe: TARGET_RPE[spec.kind],
    impact: RUN_KINDS.has(spec.kind),
    description: SESSION_DESCRIPTION[spec.kind],
    custom: true,
    ...(spec.kind === "renfo" && spec.focus ? { focus: spec.focus } : {}),
    ...(spec.kind === "renfo" && state.plan.profile.mobility ? { mobility: true } : {}),
  };
  const session = { ...base, description: sessionDescription(base) };
  const cap = capLoad(withSessions(week, [...week.sessions, session]), day);
  return {
    state: putWeeks(state, [cap.week], [feedbackKey(weekIndex, day)]),
    message:
      `Séance programmée ${DAY_NAME[day]}, semaine ${weekIndex}. ` +
      loadText(week, cap.week) +
      capText(cap.week, cap) +
      hardNeighbour(cap.week, day),
    adjusted: cap.to !== undefined,
  };
}

/** Supprime une séance prévue (pas encore notée), puis recalcule la charge de la semaine. */
export function removeSession(state: AppState, weekIndex: number, day: number): EditResult {
  pendingSession(state, weekIndex, day);
  const week = state.plan.weeks[weekIndex - 1];
  const next = withSessions(
    week,
    week.sessions.filter((s) => s.day !== day),
  );
  return {
    state: putWeeks(state, [next]),
    message: `Séance du ${DAY_NAME[day]} supprimée. ${loadText(week, next)}`,
    adjusted: false,
  };
}

/**
 * Change la durée d'une séance prévue (pas encore notée), puis recalcule la charge de la
 * semaine. Une hausse qui fait dépasser la semaine de plus de 10 % est ramenée à la limite.
 */
export function resizeSession(
  state: AppState,
  weekIndex: number,
  day: number,
  durationMin: number,
): EditResult {
  const s = pendingSession(state, weekIndex, day);
  if (FIXED.has(s.kind)) {
    throw new Error("La durée d'un test ou d'une course objectif dépend de sa distance.");
  }
  if (!(durationMin >= MIN_DURATION && durationMin <= 300)) {
    throw new RangeError(`Durée entre ${MIN_DURATION} et 300 min.`);
  }
  const to = Math.round(durationMin / 5) * 5;
  if (to === s.durationMin) throw new RangeError("C'est déjà la durée prévue.");
  const week = state.plan.weeks[weekIndex - 1];
  const note = `Durée changée de ${s.durationMin} à ${to} min.`;
  const cap = capLoad(
    withSessions(
      week,
      week.sessions.map((x) => (x.day === day ? { ...x, durationMin: to, note } : x)),
    ),
    day,
  );
  return {
    state: putWeeks(state, [cap.week]),
    message:
      `Séance du ${DAY_NAME[day]} : ${s.durationMin} → ${to} min. ` +
      loadText(week, cap.week) +
      capText(cap.week, cap),
    adjusted: cap.to !== undefined,
  };
}

/**
 * Déplace une séance prévue vers un jour libre, de la même semaine ou d'une autre. Quand elle
 * change de semaine, la charge des deux semaines est recalculée et la séance est raccourcie
 * si elle fait dépasser la semaine d'arrivée de plus de 10 %.
 */
export function moveSession(
  state: AppState,
  from: { week: number; day: number },
  to: { week: number; day: number },
  today: ISODate,
): EditResult {
  const s = pendingSession(state, from.week, from.day);
  if (from.week === to.week && from.day === to.day) {
    throw new RangeError("Choisis un autre jour.");
  }
  if (from.week !== to.week && FIXED.has(s.kind)) {
    throw new Error("Cette séance est liée à sa date : elle ne change pas de semaine.");
  }
  const dest = freeSlot(state, to.week, to.day, today);
  const src = state.plan.weeks[from.week - 1];
  const moved: Session = {
    ...s,
    day: to.day,
    movedFrom: from.week === to.week ? (s.movedFrom ?? from.day) : undefined,
    note:
      from.week === to.week
        ? `Déplacée du ${DAY_NAME[from.day]}.`
        : `Déplacée de la semaine ${from.week} (${DAY_NAME[from.day]}).`,
  };
  const clear = [feedbackKey(to.week, to.day)];

  if (from.week === to.week) {
    const next = withSessions(src, [...src.sessions.filter((x) => x.day !== from.day), moved]);
    return {
      state: putWeeks(state, [next], clear),
      message:
        `Séance déplacée du ${DAY_NAME[from.day]} au ${DAY_NAME[to.day]}. ` +
        loadText(src, next) +
        hardNeighbour(next, to.day),
      adjusted: false,
    };
  }

  const left = withSessions(
    src,
    src.sessions.filter((x) => x.day !== from.day),
  );
  const cap = capLoad(withSessions(dest, [...dest.sessions, moved]), to.day);
  return {
    state: putWeeks(state, [left, cap.week], clear),
    message:
      `Séance déplacée au ${DAY_NAME[to.day]} de la semaine ${to.week}. ` +
      `${loadText(src, left)} ${loadText(dest, cap.week)}` +
      capText(cap.week, cap) +
      hardNeighbour(cap.week, to.day),
    adjusted: cap.to !== undefined,
  };
}

/** Jours libres d'une semaine où l'on peut encore placer une séance. */
export function freeDays(state: AppState, weekIndex: number, today: ISODate): number[] {
  const week = state.plan.weeks[weekIndex - 1];
  if (!week || isReviewed(state, weekIndex)) return [];
  const taken = new Set(week.sessions.map((s) => s.day));
  return [0, 1, 2, 3, 4, 5, 6].filter(
    (d) => !taken.has(d) && sessionDate(state.startDate, weekIndex, d) >= today,
  );
}
