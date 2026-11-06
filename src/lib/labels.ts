import type { Goal, InjuryZone, OriginSport, Phase, SessionKind } from "@/engine";

export const DAYS_SHORT = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

export const PHASE_LABEL: Record<Phase, string> = {
  base: "Base",
  rythme: "Rythme",
  specifique: "Spécifique",
  test: "Test",
};

export const KIND_LABEL: Record<SessionKind, string> = {
  "course-marche": "Course-marche",
  endurance: "Endurance",
  "sortie-longue": "Sortie longue",
  tempo: "Tempo",
  fractionne: "Fractionné",
  test: "Test",
  "sport-origine": "Sport d'origine",
  renfo: "Renfo",
};

export const ORIGIN_HINT: Record<OriginSport, string> = {
  velo: "Gros moteur cardio, tendons à préparer",
  "sport-co": "Foot, rugby, hand : explosif, endurance à construire",
  musculation: "Force et gainage, cardio à développer",
  natation: "Endurance sans impact, jambes à habituer",
  reprise: "Après une blessure ou une longue pause",
};

export const GOAL_HINT: Record<Goal, string> = {
  "5k": "Courir 5 km sans s'arrêter",
  "10k": "Courir 10 km à son rythme",
  trail: "Un premier trail court",
};

export const INJURY_LABEL: Record<InjuryZone, string> = {
  "tendon-achille": "Tendon d'Achille",
  mollet: "Mollet",
  genou: "Genou",
  cheville: "Cheville",
  hanche: "Hanche",
  dos: "Dos",
  autre: "Autre",
};

export const RPE_LABEL = [
  "",
  "Très facile",
  "Facile",
  "Confortable",
  "Modéré",
  "Un peu dur",
  "Dur",
  "Très dur",
  "Très très dur",
  "Presque maximal",
  "Maximal",
];

/** Libellé d'une séance, avec le vrai nom du sport d'origine. */
export function sessionLabel(kind: SessionKind, originLabel: string): string {
  return kind === "sport-origine" ? originLabel : KIND_LABEL[kind];
}
