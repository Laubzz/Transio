/** Indicateurs de charge à partir des séances réalisées (méthode sRPE). */

export interface DoneSession {
  /** Jour de la semaine : 0 = lundi … 6 = dimanche. */
  day: number;
  durationMin: number;
  /** Difficulté ressentie, de 1 à 10. */
  rpe: number;
}

/** Charge d'une séance, en unités arbitraires (UA) : durée × ressenti. */
export const sessionLoad = (s: DoneSession) => s.durationMin * s.rpe;

export const weeklyLoad = (sessions: DoneSession[]) =>
  sessions.reduce((a, s) => a + sessionLoad(s), 0);

/** Charge par jour, du lundi au dimanche. */
export function dailyLoads(sessions: DoneSession[]): number[] {
  const days = Array(7).fill(0);
  for (const s of sessions) days[s.day] += sessionLoad(s);
  return days;
}

/**
 * Ratio charge aiguë / chronique : dernière semaine divisée par la moyenne
 * des 4 dernières (elle comprise). `null` sans historique exploitable.
 */
export function acuteChronicRatio(weeklyLoads: number[]): number | null {
  if (!weeklyLoads.length) return null;
  const last4 = weeklyLoads.slice(-4);
  const chronic = last4.reduce((a, b) => a + b, 0) / last4.length;
  return chronic > 0 ? weeklyLoads[weeklyLoads.length - 1] / chronic : null;
}

/** Monotonie de la semaine : moyenne journalière / écart-type. `null` si l'écart-type est nul. */
export function monotony(daily: number[]): number | null {
  const mean = daily.reduce((a, b) => a + b, 0) / daily.length;
  const sd = Math.sqrt(daily.reduce((a, b) => a + (b - mean) ** 2, 0) / daily.length);
  return sd > 0 ? mean / sd : null;
}

/** Zone du ratio aigu/chronique, repère courant en préparation physique. */
export function ratioZone(ratio: number | null): "inconnue" | "sous-charge" | "sure" | "attention" {
  if (ratio === null) return "inconnue";
  if (ratio < 0.8) return "sous-charge";
  if (ratio <= 1.3) return "sure";
  return "attention";
}
