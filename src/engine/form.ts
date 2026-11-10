/** Courbes de forme à partir de la charge quotidienne (modèle condition / fatigue). */

export interface FormPoint {
  /** Condition : charge moyenne lissée sur 6 semaines. */
  fitness: number;
  /** Fatigue : charge moyenne lissée sur 1 semaine. */
  fatigue: number;
  /** Fraîcheur : condition moins fatigue. Positive, tu es reposé ; très négative, tu accumules. */
  form: number;
}

const FITNESS_DAYS = 42;
const FATIGUE_DAYS = 7;

/**
 * Une valeur par jour : chaque moyenne se rapproche de la charge du jour, lentement pour la
 * condition (42 jours), vite pour la fatigue (7 jours).
 */
export function formCurve(
  daily: number[],
  start: { fitness: number; fatigue: number } = { fitness: 0, fatigue: 0 },
): FormPoint[] {
  let { fitness, fatigue } = start;
  return daily.map((load) => {
    fitness += (load - fitness) / FITNESS_DAYS;
    fatigue += (load - fatigue) / FATIGUE_DAYS;
    return { fitness, fatigue, form: fitness - fatigue };
  });
}
