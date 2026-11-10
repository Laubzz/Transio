import type { Goal, InjuryZone, OriginSport, SessionKind } from "./types";

/**
 * Règles du moteur de plan. Toutes les valeurs sont ici pour pouvoir
 * les faire valider (coach, préparateur physique) et les ajuster sans
 * toucher à la logique.
 */
export const RULES = {
  /** Hausse maximale du volume de course d'une semaine à l'autre. */
  maxIncreaseRatio: 0.1,
  /** Bornes de cette hausse, en minutes (à bas volume, 10 % est trop peu pour progresser). */
  minIncreaseMin: 5,
  maxIncreaseMin: 15,
  /** Une semaine allégée toutes les N semaines. */
  deloadEvery: 4,
  deloadFactor: 0.75,
  /** Semaine de test : affûtage. */
  taperFactor: 0.7,
  /** Allègement imposé après une douleur signalée. */
  painDeloadFactor: 0.7,
  /** Seuil d'écart entre ressenti et difficulté prévue pour ne pas progresser. */
  rpeOverTarget: 1.5,
  /** Part minimale de séances faites pour progresser. */
  minCompletion: 0.67,
  /** Semaine d'un objectif secondaire : léger affûtage, sans casser la progression. */
  secondaryRaceFactor: 0.85,
  /** Hausse de charge tolérée quand une semaine est modifiée à la main. */
  editLoadTolerance: 0.1,
  /** Séances de renforcement par semaine, au plus. */
  maxStrengthPerWeek: 4,
  minWeeks: 6,
  maxWeeks: 24,
} as const;

/** Minutes de course de la première semaine, selon le sport d'origine. */
export const START_RUN_MINUTES: Record<OriginSport, number> = {
  velo: 60,
  "sport-co": 75,
  musculation: 50,
  natation: 45,
  reprise: 40,
};

/** Volume de course maximal visé, selon l'objectif. */
export const PEAK_RUN_MINUTES: Record<Goal, number> = {
  "5k": 150,
  "10k": 210,
  semi: 300,
  trail: 240,
};

/** Sports d'origine sans habitude des impacts : on commence en course-marche. */
export const RUN_WALK_START: Record<OriginSport, boolean> = {
  velo: true,
  "sport-co": false,
  musculation: true,
  natation: true,
  reprise: true,
};
export const RUN_WALK_WEEKS = 2;

/** Zones dont une blessure passée réduit le volume de départ. */
export const LOWER_LIMB: InjuryZone[] = ["tendon-achille", "mollet", "genou", "cheville", "hanche"];
export const INJURY_START_FACTOR = 0.85;
export const LOW_PAST_VOLUME_HOURS = 3;
export const LOW_PAST_VOLUME_FACTOR = 0.85;

/** Difficulté visée par type de séance (échelle 1 à 10). */
export const TARGET_RPE: Record<SessionKind, number> = {
  "course-marche": 3,
  endurance: 4,
  "sortie-longue": 5,
  tempo: 7,
  fractionne: 8,
  test: 9,
  objectif: 9,
  "sport-origine": 5,
  renfo: 6,
};

/** Jours de course (0 = lundi), la sortie longue est le dernier. */
export const RUN_DAYS: Record<2 | 3 | 4, number[]> = {
  2: [1, 5],
  3: [1, 3, 6],
  4: [0, 2, 4, 6],
};

/** Part de la sortie longue dans les minutes de course, le reste est partagé à parts égales. */
export const LONG_RUN_SHARE: Record<2 | 3 | 4, number> = {
  2: 0.55,
  3: 0.4,
  4: 0.35,
};

export const ORIGIN_LABEL: Record<OriginSport, string> = {
  velo: "Vélo",
  "sport-co": "Sport collectif",
  musculation: "Musculation",
  natation: "Natation",
  reprise: "Reprise",
};

export const GOAL_LABEL: Record<Goal, string> = {
  "5k": "5 km",
  "10k": "10 km",
  semi: "Semi-marathon",
  trail: "Trail court",
};
