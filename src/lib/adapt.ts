import { SESSION_DESCRIPTION, TARGET_RPE, type Session, type SessionKind } from "@/engine";
import { upcoming, type Slot } from "./coaching";
import { addDays, position, sessionDate, type ISODate } from "./dates";
import {
  feedbackKey,
  isReviewed,
  pendingReview,
  recordFeedback,
  reviewWeek,
  type AdaptChange,
  type Adaptation,
  type AppState,
  type StoredFeedback,
} from "./state";

const QUALITY = new Set<SessionKind>(["tempo", "fractionne"]);
/** Séances liées à une date : l'adaptation n'y touche pas. */
const FIXED = new Set<SessionKind>(["test", "objectif"]);
const DAY_NAME = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
const round5 = (m: number) => Math.max(5, Math.round(m / 5) * 5);

function patch(state: AppState, week: number, day: number, fn: (s: Session) => Session): AppState {
  return {
    ...state,
    plan: {
      ...state.plan,
      weeks: state.plan.weeks.map((w) =>
        w.index !== week
          ? w
          : { ...w, sessions: w.sessions.map((s) => (s.day === day ? fn(s) : s)) },
      ),
    },
  };
}

/** Annule une adaptation, sur les séances qui n'ont pas changé depuis. */
function revert(state: AppState, adapt: Adaptation): AppState {
  let next = state;
  for (const c of adapt.changes) {
    const s = next.plan.weeks[c.week - 1]?.sessions.find((x) => x.day === c.day);
    if (!s || s.note !== c.note || isReviewed(next, c.week)) continue;
    next = patch(next, c.week, c.day, (x) => {
      const kind = c.fromKind ?? x.kind;
      return {
        ...x,
        kind,
        targetRpe: c.fromKind ? TARGET_RPE[kind] : x.targetRpe,
        description: c.fromKind ? SESSION_DESCRIPTION[kind] : x.description,
        durationMin: x.durationMin - c.deltaMin,
        note: undefined,
      };
    });
  }
  return next;
}

/** Raccourcit une séance à venir ; une séance intense devient un footing si `easy`. */
function lighten(
  state: AppState,
  t: Slot,
  share: number,
  easy: boolean,
  why: string,
): { state: AppState; change: AdaptChange } {
  const s = t.session;
  const cut = Math.min(round5(s.durationMin * share), Math.max(0, s.durationMin - 10));
  const soften = easy && QUALITY.has(s.kind);
  const note = `Allégée de ${cut} min${soften ? " et sans intensité" : ""} : ${why}.`;
  return {
    state: patch(state, t.weekIndex, s.day, (x) => ({
      ...x,
      ...(soften
        ? {
            kind: "endurance" as const,
            targetRpe: TARGET_RPE.endurance,
            description: SESSION_DESCRIPTION.endurance,
          }
        : {}),
      durationMin: x.durationMin - cut,
      note,
    })),
    change: {
      week: t.weekIndex,
      day: s.day,
      deltaMin: -cut,
      note,
      ...(soften ? { fromKind: s.kind } : {}),
    },
  };
}

/** Retour noté d'une séance de course juste avant une date, pour repérer deux séances faciles. */
function previousRunGap(state: AppState, before: ISODate): number | null {
  let best: { date: ISODate; gap: number } | null = null;
  for (const w of state.plan.weeks) {
    for (const s of w.sessions) {
      const fb = state.feedback[feedbackKey(w.index, s.day)];
      const date = sessionDate(state.startDate, w.index, s.day);
      if (!s.impact || !fb?.done || fb.rpe === undefined || date >= before) continue;
      if (fb.pain && fb.pain !== "aucune") continue;
      if (!best || date > best.date) best = { date, gap: fb.rpe - s.targetRpe };
    }
  }
  return best ? best.gap : null;
}

/**
 * Analyse le retour d'une séance et adapte tout de suite les séances des 7 jours suivants :
 * douleur, séance bien plus dure que prévu ou gêne, on allège ; deux courses nettement plus
 * faciles que prévu, on ajoute 5 min à la prochaine sortie longue. Le bilan de fin de semaine
 * règle ensuite le volume des semaines suivantes.
 */
export function analyseFeedback(state: AppState, weekIndex: number, day: number): AppState {
  const key = feedbackKey(weekIndex, day);
  const fb = state.feedback[key];
  const s = state.plan.weeks[weekIndex - 1]?.sessions.find((x) => x.day === day);
  if (!fb?.done || fb.rpe === undefined || !s) return state;

  const date = sessionDate(state.startDate, weekIndex, day);
  const soon = upcoming(state, date, (x) => !FIXED.has(x.kind)).filter(
    (x) => x.date <= addDays(date, 7),
  );
  const gap = fb.rpe - s.targetRpe;
  const on = `le ${DAY_NAME[day]}`;
  let next = state;
  const changes: AdaptChange[] = [];
  let text = "";
  const apply = (t: Slot, share: number, easy: boolean, why: string) => {
    const r = lighten(next, t, share, easy, why);
    next = r.state;
    changes.push(r.change);
  };

  if (fb.pain === "douleur") {
    const targets = soon.filter((x) => x.session.impact).slice(0, 2);
    for (const t of targets) apply(t, 0.3, true, `douleur signalée ${on}`);
    text = targets.length
      ? `Douleur signalée : ${targets.length > 1 ? "tes 2 prochaines courses sont raccourcies" : "ta prochaine course est raccourcie"} de 30 % et sans intensité. Si la douleur revient, remplace la course par du vélo et consulte si elle persiste.`
      : "";
  } else if (fb.pain === "gene" || gap >= 2 || fb.sensation === "horrible") {
    const t = soon.find((x) => x.session.impact === s.impact) ?? soon[0];
    const hard = gap >= 2 || fb.sensation === "horrible";
    if (t) {
      apply(t, 0.2, hard, fb.pain === "gene" ? `gêne signalée ${on}` : `séance très dure ${on}`);
      const cut = -changes[0].deltaMin;
      text =
        fb.pain === "gene"
          ? `Gêne signalée : ta prochaine séance est allégée de ${cut} min.`
          : `Plus dur que prévu (${fb.rpe}/10 pour ${s.targetRpe}/10 visé) : ta prochaine séance est allégée de ${cut} min${changes[0].fromKind ? " et devient un footing" : ""}.`;
    }
  } else if (
    s.impact &&
    gap <= -2 &&
    fb.sensation !== "bof" &&
    (previousRunGap(state, date) ?? 0) <= -2
  ) {
    const ok = (x: Slot) => x.session.impact && !state.plan.weeks[x.weekIndex - 1].deload;
    const t =
      soon.find((x) => ok(x) && x.session.kind === "sortie-longue") ??
      soon.find((x) => ok(x) && x.session.kind === "endurance");
    if (t) {
      const note =
        "5 min ajoutées : tes 2 dernières courses étaient nettement plus faciles que prévu.";
      next = patch(next, t.weekIndex, t.session.day, (x) => ({
        ...x,
        durationMin: x.durationMin + 5,
        note,
      }));
      changes.push({ week: t.weekIndex, day: t.session.day, deltaMin: 5, note });
      text = `Deux courses nettement plus faciles que prévu : 5 min ajoutées à ta prochaine ${t.session.kind === "sortie-longue" ? "sortie longue" : "séance d'endurance"}.`;
    }
  }

  if (!changes.length) return state;
  return { ...next, feedback: { ...next.feedback, [key]: { ...fb, adapt: { text, changes } } } };
}

/** Fait le bilan des semaines terminées dont toutes les séances ont un retour. */
export function autoReview(state: AppState, today: ISODate): AppState {
  const total = state.plan.weeks.length;
  const pos = position(state.startDate, today, total);
  if (pos.status === "avant") return state;
  const current = pos.status === "en-cours" ? pos.weekIndex : total + 1;
  let next = state;
  for (;;) {
    const w = pendingReview(next, current);
    if (w === null) return next;
    const rated = next.plan.weeks[w - 1].sessions.every(
      (s) => next.feedback[feedbackKey(w, s.day)],
    );
    if (!rated) return next;
    next = reviewWeek(next, w);
  }
}

/**
 * Enregistre un retour de séance, puis adapte la suite du plan : les prochaines séances tout
 * de suite, et le volume des semaines suivantes dès que la semaine est finie et notée.
 */
export function submitFeedback(
  state: AppState,
  weekIndex: number,
  day: number,
  fb: StoredFeedback,
  today: ISODate,
): AppState {
  const old = state.feedback[feedbackKey(weekIndex, day)];
  const base = old?.adapt ? revert(state, old.adapt) : state;
  const next = analyseFeedback(recordFeedback(base, weekIndex, day, fb), weekIndex, day);
  return autoReview(next, today);
}
