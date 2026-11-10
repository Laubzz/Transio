import type { Session } from "@/engine";
import { addDays, sessionDate, type ISODate } from "./dates";
import {
  feedbackKey,
  isReviewed,
  recordFeedback,
  type AppState,
  type FreeSession,
  type MissAction,
  type MissCause,
  type Period,
  type Sensation,
  type StoredFeedback,
  type WeekMetrics,
} from "./state";

export const SENSATION_LABEL: Record<Sensation, string> = {
  "tres-bien": "Très bien",
  bien: "Bien",
  moyen: "Moyen",
  bof: "Bof",
  horrible: "Horrible",
};
const SENSATION_SCORE: Record<Sensation, number> = {
  "tres-bien": 2,
  bien: 1,
  moyen: 0,
  bof: -1,
  horrible: -2,
};

export const MISS_CAUSE_LABEL: Record<MissCause, string> = {
  fatigue: "Fatigue",
  temps: "Pas le temps",
  travail: "Travail / école",
  maladie: "Maladie",
  douleur: "Douleur / gêne",
  meteo: "Météo",
  autre: "Autre",
};

export const MISS_ACTION_LABEL: Record<MissAction, string> = {
  reporter: "La reporter à un autre jour",
  alleger: "Alléger les 2 prochaines séances",
  ajouter: "Ajouter du temps à la prochaine séance facile",
  abandonner: "L'abandonner, sans rattrapage",
};

/** Part de durée retirée aux 2 séances suivantes, selon la cause. */
const LIGHTEN: Partial<Record<MissCause, number>> = { fatigue: 0.2, maladie: 0.3, douleur: 0.3 };
const round5 = (m: number) => Math.max(5, Math.round(m / 5) * 5);
const EASY = new Set(["endurance", "sortie-longue", "course-marche"]);

export interface Slot {
  weekIndex: number;
  session: Session;
  date: ISODate;
}

/** Séances prévues après une date (dans l'ordre), éventuellement filtrées. */
export function upcoming(state: AppState, after: ISODate, pred?: (s: Session) => boolean): Slot[] {
  return state.plan.weeks
    .flatMap((w) =>
      w.sessions.map((s) => ({
        weekIndex: w.index,
        session: s,
        date: sessionDate(state.startDate, w.index, s.day),
      })),
    )
    .filter(
      (x) =>
        x.date > after &&
        !isReviewed(state, x.weekIndex) &&
        // Une séance déjà notée ne change plus.
        !state.feedback[feedbackKey(x.weekIndex, x.session.day)] &&
        (!pred || pred(x.session)),
    )
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** Premier jour libre de la même semaine, après la séance et pas avant aujourd'hui. */
export function freeDayFor(
  state: AppState,
  weekIndex: number,
  day: number,
  today: ISODate,
): number | null {
  const week = state.plan.weeks[weekIndex - 1];
  const taken = new Set(week.sessions.map((s) => s.day));
  for (let d = day + 1; d <= 6; d++) {
    if (!taken.has(d) && sessionDate(state.startDate, weekIndex, d) >= today) return d;
  }
  return null;
}

/** Ce que l'app propose de faire d'une séance non réalisée, selon la cause. */
export function proposeMiss(
  state: AppState,
  weekIndex: number,
  day: number,
  cause: MissCause,
  today: ISODate,
): { action: MissAction; movedTo?: number } {
  if (LIGHTEN[cause]) return { action: "alleger" };
  const free = freeDayFor(state, weekIndex, day, today);
  if (free !== null) return { action: "reporter", movedTo: free };
  const s = state.plan.weeks[weekIndex - 1].sessions.find((x) => x.day === day);
  const date = sessionDate(state.startDate, weekIndex, day);
  if (
    s?.impact &&
    s.kind !== "test" &&
    upcoming(state, date, (x) => EASY.has(x.kind)).some((x) => x.date <= addDays(date, 7))
  ) {
    return { action: "ajouter" };
  }
  return { action: "abandonner" };
}

function patchSession(
  state: AppState,
  weekIndex: number,
  day: number,
  patch: (s: Session) => Session,
): AppState {
  return {
    ...state,
    plan: {
      ...state.plan,
      weeks: state.plan.weeks.map((w) =>
        w.index !== weekIndex
          ? w
          : {
              ...w,
              sessions: w.sessions
                .map((s) => (s.day === day ? patch(s) : s))
                .sort((a, b) => a.day - b.day),
            },
      ),
    },
  };
}

const DAY_NAME = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

/**
 * Enregistre une séance non réalisée et applique la décision au plan :
 * report à un jour libre, allègement des 2 séances suivantes, temps ajouté à la prochaine
 * séance facile, ou abandon sans rattrapage.
 */
export function recordMissed(
  state: AppState,
  weekIndex: number,
  day: number,
  miss: { cause: MissCause; action: MissAction; movedTo?: number; comment?: string },
): AppState {
  const week = state.plan.weeks[weekIndex - 1];
  const s = week?.sessions.find((x) => x.day === day);
  if (!s) throw new RangeError("Séance introuvable.");
  const date = sessionDate(state.startDate, weekIndex, day);
  const why = MISS_CAUSE_LABEL[miss.cause].toLowerCase();

  if (miss.action === "reporter") {
    const to = miss.movedTo;
    if (to === undefined || to <= day || to > 6 || week.sessions.some((x) => x.day === to)) {
      throw new RangeError("Choisis un jour libre plus tard dans la semaine.");
    }
    // La séance change de jour : pas de retour « non faite », elle reste à faire.
    const next = patchSession(state, weekIndex, day, (x) => ({
      ...x,
      day: to,
      movedFrom: x.movedFrom ?? day,
      note: `Reportée du ${DAY_NAME[day]} (${why}).`,
    }));
    const fb = { ...next.feedback };
    delete fb[feedbackKey(weekIndex, day)];
    return { ...next, feedback: fb };
  }

  let next = recordFeedback(state, weekIndex, day, {
    done: false,
    comment: miss.comment,
    missed: { cause: miss.cause, action: miss.action },
  });

  if (miss.action === "alleger") {
    const k = LIGHTEN[miss.cause] ?? 0.2;
    const extra =
      miss.cause === "douleur"
        ? " Si la gêne est encore là, remplace la course par du vélo facile et consulte si elle persiste."
        : miss.cause === "maladie"
          ? " Reprends seulement sans fièvre."
          : "";
    for (const t of upcoming(next, date).slice(0, 2)) {
      const cut = round5(t.session.durationMin * k);
      next = patchSession(next, t.weekIndex, t.session.day, (x) => ({
        ...x,
        durationMin: Math.max(10, x.durationMin - cut),
        note: `Allégée de ${cut} min (${why} le ${DAY_NAME[day]}).${extra}`,
      }));
    }
  } else if (miss.action === "ajouter") {
    const t = upcoming(next, date, (x) => EASY.has(x.kind) && x.impact)[0];
    if (t) {
      const add = Math.min(10, round5(s.durationMin * 0.3));
      next = patchSession(next, t.weekIndex, t.session.day, (x) => ({
        ...x,
        durationMin: x.durationMin + add,
        note: `${add} min ajoutées pour compenser la séance du ${DAY_NAME[day]}.`,
      }));
    }
  }
  return next;
}

/** Ajoute ou remplace une séance libre (hors plan). */
export function saveFreeSession(
  state: AppState,
  fs: Omit<FreeSession, "id"> & { id?: string },
): AppState {
  if (!(fs.durationMin >= 5 && fs.durationMin <= 600))
    throw new RangeError("Durée entre 5 et 600 min.");
  if (!(fs.rpe >= 1 && fs.rpe <= 10)) throw new RangeError("Difficulté entre 1 et 10.");
  const id = fs.id ?? `libre-${fs.date}-${Math.random().toString(36).slice(2, 8)}`;
  const clean: FreeSession = {
    ...fs,
    id,
    durationMin: Math.round(fs.durationMin),
    comment: fs.comment?.trim() || undefined,
    strength: fs.strength?.filter((r) => r.exercise.trim() && r.sets > 0 && r.reps > 0),
  };
  const list = (state.freeSessions ?? []).filter((x) => x.id !== id);
  return { ...state, freeSessions: [...list, clean].sort((a, b) => (a.date < b.date ? -1 : 1)) };
}

export function removeFreeSession(state: AppState, id: string): AppState {
  return { ...state, freeSessions: (state.freeSessions ?? []).filter((x) => x.id !== id) };
}

export type AdviceLevel = "none" | "ok" | "warn" | "bad";

/** Conseil pour les prochaines séances, d'après les 3 derniers retours notés. */
export function advice(state: AppState): { level: AdviceLevel; title: string; text: string } {
  const notes: (StoredFeedback & { target: number; date: ISODate })[] = [];
  for (const w of state.plan.weeks) {
    for (const s of w.sessions) {
      const fb = state.feedback[feedbackKey(w.index, s.day)];
      if (fb?.done && fb.rpe !== undefined)
        notes.push({
          ...fb,
          target: s.targetRpe,
          date: sessionDate(state.startDate, w.index, s.day),
        });
    }
  }
  const last = notes.sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 3);
  if (!last.length) {
    return {
      level: "none",
      title: "Pas encore de retour",
      text: "Note ta première séance : le conseil apparaîtra ici.",
    };
  }
  const gap = last.reduce((a, r) => a + (r.rpe! - r.target), 0) / last.length;
  const scores = last.map((r) => (r.sensation ? SENSATION_SCORE[r.sensation] : 0));
  const bad = scores.filter((v) => v < 0).length;
  const alarm = last.some((r) => r.sensation === "horrible" || r.pain === "douleur");
  const n = last.length;
  if (alarm || gap >= 2 || bad >= 2) {
    return {
      level: "bad",
      title: "Lève le pied",
      text: `Sur tes ${n} derniers retours, c'est plus dur que prévu. Sur les prochaines séances, raccourcis d'environ 10 %, ralentis tes footings de 10 à 15 s/km et retire une répétition au fractionné. Si une douleur revient, remplace la course par du vélo.`,
    };
  }
  if (gap >= 1 || bad === 1 || last.some((r) => r.pain === "gene")) {
    return {
      level: "warn",
      title: "Reste prudent",
      text: "Un peu plus dur que prévu. Garde le plan sans accélérer : footings vraiment lents, et coupe la séance si les sensations ne reviennent pas après 10 min.",
    };
  }
  if (gap <= -2 && n >= 2) {
    return {
      level: "ok",
      title: "Tu as de la marge",
      text: "Les séances te paraissent faciles. Garde les mêmes allures, c'est voulu ; tu peux ajouter 5 min à ta prochaine sortie longue. Le bilan de la semaine fera progresser le plan.",
    };
  }
  return {
    level: "ok",
    title: "Dans la cible",
    text: "Tes ressentis collent au plan. Continue comme prévu.",
  };
}

/** Enregistre les métriques d'une semaine (clé : lundi). Les champs vides sont retirés. */
export function saveMetrics(state: AppState, monday: ISODate, m: WeekMetrics): AppState {
  const clean = Object.fromEntries(
    Object.entries(m).filter(
      ([, v]) => v !== undefined && v !== null && v !== "" && !Number.isNaN(v),
    ),
  ) as WeekMetrics;
  const metrics = { ...(state.metrics ?? {}) };
  if (Object.keys(clean).length) metrics[monday] = clean;
  else delete metrics[monday];
  return { ...state, metrics };
}

export function savePeriod(state: AppState, p: Omit<Period, "id"> & { id?: string }): AppState {
  if (!(p.start <= p.end)) throw new RangeError("La fin doit être après le début.");
  if (!p.label.trim()) throw new RangeError("Donne un nom à la période.");
  const id = p.id ?? `p-${p.start}-${Math.random().toString(36).slice(2, 6)}`;
  const periods = [
    ...(state.periods ?? []).filter((x) => x.id !== id),
    { ...p, id, label: p.label.trim() },
  ];
  return { ...state, periods: periods.sort((a, b) => (a.start < b.start ? -1 : 1)) };
}

export function removePeriod(state: AppState, id: string): AppState {
  return { ...state, periods: (state.periods ?? []).filter((x) => x.id !== id) };
}

export const periodOn = (state: AppState, date: ISODate): Period | null =>
  (state.periods ?? []).find((p) => p.start <= date && date <= p.end) ?? null;
