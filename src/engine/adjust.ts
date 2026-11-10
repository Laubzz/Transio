import { floor5, lastBuildUpTo, rebuildFrom, type WeekVolume } from "./plan";
import { RULES } from "./rules";
import type { Decision, Plan, Week, WeekFeedback } from "./types";

export interface Adjustment {
  decision: Decision;
  reasons: string[];
  plan: Plan;
}

/** Décide de la suite à partir du retour sur une semaine (règles codées, sans IA). */
export function decide(
  week: Week,
  feedback: WeekFeedback,
): { decision: Decision; reasons: string[] } {
  const fb = feedback.sessions;
  if (fb.length !== week.sessions.length) {
    throw new RangeError("Il faut un retour par séance prévue.");
  }
  if (fb.some((s) => s.pain === "douleur")) {
    return {
      decision: "alleger",
      reasons: [
        "Douleur signalée : la semaine suivante est allégée et la progression reprend sans hausse.",
        "Si la douleur persiste, parles-en à un professionnel de santé.",
      ],
    };
  }

  const reasons: string[] = [];
  const done = fb.filter((s) => s.done).length / fb.length;
  if (done < RULES.minCompletion) {
    reasons.push(
      `Seulement ${Math.round(done * 100)} % des séances faites : on garde le même volume.`,
    );
  }
  const rated = week.sessions
    .map((s, i) => ({ target: s.targetRpe, rpe: fb[i].rpe, done: fb[i].done }))
    .filter((s): s is { target: number; rpe: number; done: true } => s.done && s.rpe !== undefined);
  if (rated.length) {
    const gap = rated.reduce((a, s) => a + (s.rpe - s.target), 0) / rated.length;
    if (gap >= RULES.rpeOverTarget) {
      reasons.push("Séances ressenties nettement plus dures que prévu : on garde le même volume.");
    }
  }
  if (fb.some((s) => s.pain === "gene")) {
    reasons.push("Gêne signalée : on ne monte pas le volume cette semaine.");
  }
  if (reasons.length) return { decision: "maintenir", reasons };
  return {
    decision: "progresser",
    reasons: ["Semaine bien passée : la progression prévue continue."],
  };
}

const SEVERITY: Record<Decision, number> = { progresser: 0, maintenir: 1, alleger: 2 };

/**
 * Applique le retour d'une semaine au reste du plan. `floor` impose une décision minimale
 * (par exemple « maintenir » quand les métriques de récupération se dégradent).
 */
export function adjustPlan(
  plan: Plan,
  feedback: WeekFeedback,
  floor?: { decision: Decision; reasons: string[] },
): Adjustment {
  const week = plan.weeks.find((w) => w.index === feedback.weekIndex);
  if (!week) throw new RangeError(`Semaine ${feedback.weekIndex} introuvable.`);
  const decided = decide(week, feedback);
  const forced = floor && SEVERITY[floor.decision] > SEVERITY[decided.decision];
  const decision = forced ? floor.decision : decided.decision;
  const reasons = forced
    ? [...floor.reasons, ...decided.reasons.filter((r) => !r.startsWith("Semaine bien passée"))]
    : [...decided.reasons, ...(floor?.reasons ?? [])];
  const next = week.index + 1;
  if (decision === "progresser" || next > plan.profile.weeks) return { decision, reasons, plan };

  const lastBuild = lastBuildUpTo(plan, week.index);
  let first: WeekVolume | undefined;
  let hold = false;
  const nextIsTest = next === plan.profile.weeks;
  if (decision === "alleger") {
    first = { minutes: floor5(week.runMinutes * RULES.painDeloadFactor), deload: !nextIsTest };
    hold = true;
  } else if (!plan.weeks[next - 1].deload && !nextIsTest && !plan.weeks[next - 1].objective) {
    first = { minutes: lastBuild, deload: false };
  }

  return { decision, reasons, plan: rebuildFrom(plan, next, lastBuild, first, hold) };
}
