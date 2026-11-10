import { paces } from "./paces";
import type { Profile } from "./types";

/**
 * Progression des séances à l'allure objectif, en kilomètres : 3 × 1 km, 4 × 1 km, 2 × 2 km,
 * 2 + 1 + 2 km, 5 × 1 km, puis 3 × 2 km. C'est la partie « qualité » de la séance ;
 * l'échauffement, les récupérations et le retour au calme s'ajoutent autour.
 */
export const GOAL_PACE_STEPS: number[][] = [
  [1, 1, 1],
  [1, 1, 1, 1],
  [2, 2],
  [2, 1, 2],
  [1, 1, 1, 1, 1],
  [2, 2, 2],
];

export const GOAL_PACE_WARMUP_MIN = 10;
export const GOAL_PACE_COOLDOWN_MIN = 5;
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

/** Récupération en trottinant après une répétition, en secondes. */
export const goalPaceRecovery = (km: number) => (km >= 2 ? 180 : 120);

/**
 * Allure objectif en s/km. Sans temps de référence, un repère moyen sert à estimer les durées.
 * `null` quand l'objectif se court à l'effort et non à l'allure (trail).
 */
export function goalPaceSec(profile: Profile): number | null {
  if (profile.goal === "trail") return null;
  if (!profile.reference5kSec) return 360;
  const range = paces(profile.reference5kSec, profile.goal).objectif;
  return range ? (range[0] + range[1]) / 2 : null;
}

/** Durée du travail d'une séance (répétitions et récupérations), en secondes. */
const cost = (step: number[], pace: number) =>
  sum(step.map((km) => km * pace)) + sum(step.slice(0, -1).map(goalPaceRecovery));

/** Durée totale qu'il faut à la séance de rang `rank`, en minutes, arrondie aux 5 min. */
export function goalPaceNeed(profile: Profile, rank: number): number | null {
  const pace = goalPaceSec(profile);
  if (!pace) return null;
  const step = GOAL_PACE_STEPS[Math.min(rank, GOAL_PACE_STEPS.length - 1)];
  const total = cost(step, pace) / 60 + GOAL_PACE_WARMUP_MIN + GOAL_PACE_COOLDOWN_MIN;
  return Math.ceil((total - 2) / 5) * 5;
}

/**
 * Répétitions (en km) de la séance : la plus avancée de la progression, jusqu'au rang `rank`,
 * qui tient dans le temps de travail disponible ; à défaut, 2 × 1 km.
 */
export function goalPaceStep(profile: Profile, rank: number, workMin: number): number[] | null {
  const pace = goalPaceSec(profile);
  if (!pace) return null;
  const upTo = GOAL_PACE_STEPS.slice(0, Math.min(rank, GOAL_PACE_STEPS.length - 1) + 1);
  return [...upTo].reverse().find((x) => cost(x, pace) <= workMin * 60 + 120) ?? [1, 1];
}
