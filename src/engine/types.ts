/** Sport pratiqué avant la transition. */
export type OriginSport = "velo" | "sport-co" | "musculation" | "natation" | "reprise";

/** Objectif de course visé à la fin du plan. */
export type Goal = "5k" | "10k" | "semi" | "trail";

/** Phases successives d'un plan de transition. */
export type Phase = "base" | "rythme" | "specifique" | "test";

export type InjuryZone =
  "tendon-achille" | "mollet" | "genou" | "cheville" | "hanche" | "dos" | "autre";

export interface Injury {
  zone: InjuryZone;
  year: number;
}

/** Réponses au questionnaire de départ. */
export interface Profile {
  originSport: OriginSport;
  /** Années de pratique du sport d'origine. */
  yearsPracticed: number;
  /** Volume hebdomadaire habituel dans le sport d'origine, en heures. */
  weeklyHoursPast: number;
  injuries: Injury[];
  goal: Goal;
  /** Durée du plan en semaines (6 à 24). */
  weeks: number;
  runDaysPerWeek: 2 | 3 | 4;
  /** Garder une séance du sport d'origine chaque semaine (double sport). */
  keepOriginSport: boolean;
  /** Séances de renforcement par semaine (somme des blocs haut et bas quand ils sont précisés). */
  strengthPerWeek: number;
  /**
   * Blocs de renforcement voulus chaque semaine : par exemple 2 fois le haut du corps et
   * 1 fois le bas. Absent sur les anciens profils : renfo « coureur » classique.
   */
  strengthBlocks?: StrengthBlocks;
  /** Ajouter un bloc de mobilité à la fin de chaque séance de renforcement. */
  mobility?: boolean;
  /** Où se fait le renforcement (absent sur les anciens profils : « maison »). */
  strengthPlace?: StrengthPlace;
  /** Minutes de course par semaine en ce moment (0 ou absent : ne court pas encore). */
  currentRunMinutes?: number;
  /** Temps de référence sur 5 km, en secondes, pour calculer les allures. */
  reference5kSec?: number;
  /**
   * Numéro du cycle : 1 pour le plan de transition, 2 et plus pour la suite.
   * Après la transition, plus de course-marche et un départ au volume déjà atteint.
   */
  cycle?: number;
  /** Minutes de course de la première semaine, reprises du cycle précédent. */
  startRunMinutes?: number;
}

/** Renforcement à la maison (poids du corps), en salle de muscu, ou en alternant les deux. */
export type StrengthPlace = "maison" | "salle" | "les-deux";

/** Partie du corps travaillée par une séance de renforcement. */
export type StrengthFocus = "haut" | "bas";

/** Nombre de séances par semaine pour chaque bloc de renforcement. */
export interface StrengthBlocks {
  haut: number;
  bas: number;
}

/** Objectif principal (course visée) ou secondaire (course de préparation). */
export type ObjectivePriority = "principal" | "secondaire";

/** Course objectif placée dans le plan (semaine à partir de 1, jour 0 = lundi). */
export interface PlanObjective {
  week: number;
  day: number;
  priority: ObjectivePriority;
  label: string;
  distanceKm: number;
  /** Pour un objectif secondaire : l'objectif principal qu'il prépare. */
  prepFor?: string;
}

export type SessionKind =
  | "course-marche"
  | "endurance"
  | "sortie-longue"
  | "tempo"
  | "fractionne"
  | "test"
  | "objectif"
  | "sport-origine"
  | "renfo";

export interface Session {
  /** Jour de la semaine : 0 = lundi … 6 = dimanche. */
  day: number;
  kind: SessionKind;
  durationMin: number;
  /** Difficulté visée, sur l'échelle de ressenti 1 à 10. */
  targetRpe: number;
  /** Séance à impact (course à pied). */
  impact: boolean;
  description: string;
  /** Jour d'origine quand la séance a été reportée. */
  movedFrom?: number;
  /** Ajustement appliqué à la séance (report, allègement, temps ajouté). */
  note?: string;
  /** Bloc travaillé, pour une séance de renforcement. */
  focus?: StrengthFocus;
  /** Séance de renforcement terminée par un bloc de mobilité. */
  mobility?: boolean;
  /** Séance programmée à la main, hors du plan généré. */
  custom?: boolean;
  /** Course objectif courue ce jour-là. */
  objective?: Omit<PlanObjective, "week" | "day">;
}

export interface Week {
  /** Numéro de semaine, à partir de 1. */
  index: number;
  phase: Phase;
  /** Semaine allégée. */
  deload: boolean;
  /** Minutes de course à pied prévues dans la semaine. */
  runMinutes: number;
  sessions: Session[];
  /** Semaine modifiée à la main (séance ajoutée, supprimée ou déplacée). */
  edited?: boolean;
  /** Charge prévue (durée × difficulté visée) avant les modifications à la main. */
  baseLoad?: number;
  /** Semaine de course objectif : elle ne compte pas comme semaine de construction. */
  objective?: ObjectivePriority;
}

export interface Plan {
  profile: Profile;
  weeks: Week[];
  /** Courses objectifs placées dans le plan. */
  objectives?: PlanObjective[];
}

export type Pain = "aucune" | "gene" | "douleur";

/** Retour de l'athlète sur une séance prévue. */
export interface SessionFeedback {
  done: boolean;
  /** Difficulté ressentie, de 1 à 10. */
  rpe?: number;
  pain?: Pain;
}

export interface WeekFeedback {
  weekIndex: number;
  sessions: SessionFeedback[];
}

export type Decision = "progresser" | "maintenir" | "alleger";
