/** Sport pratiqué avant la transition. */
export type OriginSport = "velo" | "sport-co" | "musculation" | "natation" | "reprise";

/** Objectif de course visé à la fin du plan. */
export type Goal = "5k" | "10k" | "trail";

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
  strengthPerWeek: 0 | 1 | 2;
  /** Où se fait le renforcement (absent sur les anciens profils : « maison »). */
  strengthPlace?: StrengthPlace;
  /** Temps de référence sur 5 km, en secondes, pour calculer les allures. */
  reference5kSec?: number;
}

/** Renforcement à la maison (poids du corps), en salle de muscu, ou en alternant les deux. */
export type StrengthPlace = "maison" | "salle" | "les-deux";

export type SessionKind =
  | "course-marche"
  | "endurance"
  | "sortie-longue"
  | "tempo"
  | "fractionne"
  | "test"
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
}

export interface Plan {
  profile: Profile;
  weeks: Week[];
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
