import { formatPaceRange, paces, type Intensity } from "./paces";
import {
  GOAL_PACE_COOLDOWN_MIN,
  GOAL_PACE_WARMUP_MIN,
  goalPaceRecovery,
  goalPaceSec,
  goalPaceStep,
} from "./goalPace";
import { qualityRank } from "./plan";
import { ORIGIN_LABEL } from "./rules";
import type { Goal, Profile, Session, StrengthPlace, Week } from "./types";

/** Un bloc d'une séance de course : continu, ou répété (travail + récupération). */
export interface RunBlock {
  type: "run";
  label: string;
  /** Nombre de répétitions (1 pour un bloc continu). */
  repeat: number;
  workSec: number;
  intensity: Intensity;
  recoverySec?: number;
  recoveryIntensity?: Intensity;
  /** Distance d'une répétition, quand le bloc se court au kilomètre. */
  distanceM?: number;
}

export interface Exercise {
  name: string;
  sets: number;
  /** « 12 », « 10 par jambe », « 40 s »… */
  reps: string;
  cue: string;
}

export interface Workout {
  /** Blocs de course (vide pour le renfo). */
  blocks: RunBlock[];
  /** Exercices (renfo uniquement). */
  exercises: Exercise[];
  /** Où se fait le renfo, quand il y en a. */
  place?: Exclude<StrengthPlace, "les-deux">;
  notes: string[];
}

export const INTENSITY_LABEL: Record<Intensity, string> = {
  marche: "Marche",
  endurance: "Endurance",
  seuil: "Allure seuil",
  vma: "Allure VMA",
  objectif: "Allure objectif",
};

/** Repère au ressenti, quand il n'y a pas d'allure de référence. */
export const INTENSITY_FEEL: Record<Intensity, string> = {
  marche: "marche active",
  endurance: "tu peux tenir une conversation",
  seuil: "phrases courtes, effort soutenu mais contrôlé",
  vma: "quelques mots seulement, effort intense",
  objectif: "l'effort que tu penses tenir le jour J",
};

const TEST_DISTANCE: Record<Goal, string> = {
  "5k": "5 km",
  "10k": "10 km",
  semi: "21,1 km (ou un test de 15 km en préparation)",
  trail: "8 à 10 km de trail",
};

const min = (m: number) => Math.round(m * 60);

/** Allure cible d'une intensité, ou repère au ressenti sans référence. */
export function target(profile: Profile, intensity: Intensity): string {
  if (intensity === "marche") return INTENSITY_FEEL.marche;
  if (profile.reference5kSec) {
    const p = paces(profile.reference5kSec, profile.goal);
    const range = intensity === "objectif" ? p.objectif : p[intensity];
    if (range) return formatPaceRange(range);
  }
  return INTENSITY_FEEL[intensity];
}

/** Blocs au kilomètre à l'allure objectif qui tiennent dans le temps de travail disponible. */
function goalPaceBlocks(profile: Profile, week: Week, workMin: number): RunBlock[] | null {
  const pace = goalPaceSec(profile);
  const step = goalPaceStep(profile, qualityRank(profile, week.index), workMin);
  if (!pace || !step) return null;
  const block = (km: number, repeat: number, last: boolean): RunBlock => ({
    type: "run",
    label: "Allure objectif",
    repeat,
    workSec: Math.round(km * pace),
    intensity: "objectif",
    distanceM: km * 1000,
    ...(repeat > 1 || !last
      ? { recoverySec: goalPaceRecovery(km), recoveryIntensity: "endurance" }
      : {}),
  });
  return step.every((km) => km === step[0])
    ? [block(step[0], step.length, true)]
    : step.map((km, i) => block(km, 1, i === step.length - 1));
}

/** Temps de récupération d'un bloc : entre les répétitions, ou après un bloc suivi d'un autre. */
const recoveries = (b: RunBlock) => (b.recoverySec ?? 0) * (b.repeat > 1 ? b.repeat - 1 : 1);

function runBlocks(profile: Profile, week: Week, s: Session): RunBlock[] {
  const d = s.durationMin;
  const cont = (label: string, minutes: number, intensity: Intensity): RunBlock => ({
    type: "run",
    label,
    repeat: 1,
    workSec: min(minutes),
    intensity,
  });

  switch (s.kind) {
    case "course-marche": {
      const runMin = week.index <= 1 ? 2 : 3;
      const cycle = runMin + 1;
      const reps = Math.max(3, Math.floor((d - 5) / cycle));
      return [
        cont("Échauffement", 5, "marche"),
        {
          type: "run",
          label: "Course-marche",
          repeat: reps,
          workSec: min(runMin),
          intensity: "endurance",
          recoverySec: min(1),
          recoveryIntensity: "marche",
        },
      ];
    }
    case "endurance":
      return [cont("Footing", d, "endurance")];
    case "sortie-longue": {
      if (week.phase === "specifique" && !week.deload && d >= 40) {
        return [cont("Sortie longue", d - 10, "endurance"), cont("Fin de sortie", 10, "objectif")];
      }
      return [cont("Sortie longue", d, "endurance")];
    }
    case "tempo": {
      const warm = d >= 40 ? 15 : 10;
      const work = d - warm - 5;
      // Dès la phase rythme, la séance se court à l'allure de la course visée, au kilomètre.
      const goal = week.deload
        ? null
        : goalPaceBlocks(profile, week, d - GOAL_PACE_WARMUP_MIN - GOAL_PACE_COOLDOWN_MIN);
      if (goal) {
        // Le temps qui reste allonge l'échauffement (jusqu'à 20 min), puis le retour au calme.
        const used = goal.reduce((t, x) => t + x.repeat * x.workSec + recoveries(x), 0) / 60;
        const spare = Math.max(0, d - GOAL_PACE_WARMUP_MIN - GOAL_PACE_COOLDOWN_MIN - used);
        const extraWarm = Math.min(10, Math.round(spare));
        return [
          cont("Échauffement", GOAL_PACE_WARMUP_MIN + extraWarm, "endurance"),
          ...goal,
          cont(
            "Retour au calme",
            GOAL_PACE_COOLDOWN_MIN + Math.round(spare - extraWarm),
            "endurance",
          ),
        ];
      }
      const reps = Math.max(1, Math.floor((work + 2) / 10));
      return [
        cont("Échauffement", warm, "endurance"),
        reps > 1
          ? {
              type: "run",
              label: "Blocs au seuil",
              repeat: reps,
              workSec: min(8),
              intensity: "seuil",
              recoverySec: min(2),
              recoveryIntensity: "endurance",
            }
          : cont("Bloc au seuil", Math.max(6, work), "seuil"),
        cont("Retour au calme", 5, "endurance"),
      ];
    }
    case "fractionne": {
      const available = d - 20;
      const reps = Math.max(4, Math.floor(available / 3.5));
      return [
        cont("Échauffement", 15, "endurance"),
        {
          type: "run",
          label: "Fractionné",
          repeat: reps,
          workSec: min(2),
          intensity: "vma",
          recoverySec: 90,
          recoveryIntensity: "endurance",
        },
        cont("Retour au calme", 5, "endurance"),
      ];
    }
    case "objectif": {
      const o = s.objective;
      const short = (o?.distanceKm ?? 10) <= 5;
      return [
        cont("Échauffement", short ? 15 : 10, "endurance"),
        { ...cont(`Course : ${o?.label ?? "objectif"}`, 0, "objectif"), workSec: 0 },
        cont("Retour au calme", 5, "marche"),
      ];
    }
    case "test":
      return [
        cont("Échauffement", 15, "endurance"),
        { ...cont(`Test : ${TEST_DISTANCE[profile.goal]}`, 0, "objectif"), workSec: 0 },
        cont("Retour au calme", 10, "endurance"),
      ];
    default:
      return [];
  }
}

const HOME: Exercise[] = [
  {
    name: "Mollets excentriques sur une marche",
    sets: 3,
    reps: "12",
    cue: "Monte sur 2 pieds, redescends sur 1 en 3 secondes.",
  },
  {
    name: "Squat au poids du corps",
    sets: 3,
    reps: "15",
    cue: "Dos droit, genoux dans l'axe des pieds.",
  },
  { name: "Fentes arrière", sets: 3, reps: "10 par jambe", cue: "Genou arrière qui frôle le sol." },
  {
    name: "Pont fessier sur une jambe",
    sets: 3,
    reps: "10 par jambe",
    cue: "Bassin bien aligné en haut.",
  },
  {
    name: "Équilibre sur une jambe",
    sets: 3,
    reps: "30 s par jambe",
    cue: "Pied nu, genou légèrement fléchi.",
  },
  { name: "Gainage planche", sets: 3, reps: "40 s", cue: "Corps aligné, sans creuser le dos." },
  { name: "Gainage latéral", sets: 2, reps: "30 s par côté", cue: "Hanches hautes." },
];

const GYM: Exercise[] = [
  {
    name: "Mollets à la machine ou à la presse",
    sets: 4,
    reps: "12",
    cue: "Descente lente en 3 secondes.",
  },
  {
    name: "Presse à cuisses",
    sets: 4,
    reps: "10",
    cue: "Charge que tu pourrais soulever 2 à 3 fois de plus.",
  },
  {
    name: "Soulevé de terre roumain",
    sets: 3,
    reps: "8",
    cue: "Dos plat, la barre glisse le long des cuisses.",
  },
  { name: "Hip thrust", sets: 3, reps: "10", cue: "Serre les fessiers en haut, 1 seconde." },
  { name: "Leg curl", sets: 3, reps: "12", cue: "Contrôle la descente." },
  { name: "Gainage planche", sets: 3, reps: "45 s", cue: "Corps aligné, sans creuser le dos." },
];

const UPPER_HOME: Exercise[] = [
  { name: "Pompes", sets: 3, reps: "10", cue: "Sur les genoux si besoin, corps bien aligné." },
  {
    name: "Tirage avec élastique ou rowing sous une table",
    sets: 3,
    reps: "12",
    cue: "Serre les omoplates en fin de mouvement.",
  },
  {
    name: "Pompes piquées",
    sets: 3,
    reps: "8",
    cue: "Hanches hautes, la tête descend entre les mains.",
  },
  {
    name: "Dips sur une chaise",
    sets: 3,
    reps: "10",
    cue: "Coudes vers l'arrière, épaules basses.",
  },
  {
    name: "Superman",
    sets: 3,
    reps: "12",
    cue: "Décolle bras et jambes 2 secondes, regard vers le sol.",
  },
  { name: "Gainage planche", sets: 3, reps: "40 s", cue: "Corps aligné, sans creuser le dos." },
];

const UPPER_GYM: Exercise[] = [
  {
    name: "Développé couché",
    sets: 4,
    reps: "8",
    cue: "Charge que tu pourrais soulever 2 à 3 fois de plus.",
  },
  {
    name: "Tirage vertical ou tractions",
    sets: 4,
    reps: "8",
    cue: "Tire les coudes vers les hanches.",
  },
  { name: "Rowing à la poulie", sets: 3, reps: "10", cue: "Dos droit, serre les omoplates." },
  { name: "Développé militaire", sets: 3, reps: "8", cue: "Gaine le ventre, sans cambrer." },
  { name: "Face pull", sets: 3, reps: "12", cue: "Coudes hauts, tire vers le front." },
  { name: "Gainage planche", sets: 3, reps: "45 s", cue: "Corps aligné, sans creuser le dos." },
];

/** Bloc de mobilité ajouté en fin de séance (environ 10 minutes). */
const MOBILITY: Exercise[] = [
  {
    name: "Mobilité de cheville, genou au mur",
    sets: 2,
    reps: "10 par jambe",
    cue: "Talon au sol, le genou avance vers le mur.",
  },
  {
    name: "Ouverture de hanche en fente basse",
    sets: 2,
    reps: "45 s par côté",
    cue: "Bassin vers l'avant, buste haut.",
  },
  {
    name: "Rotation du buste en fente",
    sets: 2,
    reps: "8 par côté",
    cue: "Le bras monte vers le plafond, suis-le du regard.",
  },
  { name: "Chat-vache", sets: 2, reps: "10", cue: "Enroule puis creuse le dos, lentement." },
];

/** Exercices de pied et de pliométrie légère, à partir de la phase rythme. */
const PLYO: Exercise = {
  name: "Sauts à la corde ou petits bonds",
  sets: 3,
  reps: "30 s",
  cue: "Pieds légers, contact au sol court.",
};

/** Lieu du renfo pour une séance donnée ; « les deux » alterne d'une séance à l'autre. */
export function strengthPlaceFor(
  profile: Profile,
  week: Week,
  s: Session,
): Exclude<StrengthPlace, "les-deux"> {
  const place = profile.strengthPlace ?? "maison";
  if (place !== "les-deux") return place;
  const order = week.sessions.filter((x) => x.kind === "renfo").indexOf(s);
  return (week.index + Math.max(0, order)) % 2 === 0 ? "salle" : "maison";
}

function strength(profile: Profile, week: Week, s: Session): Workout {
  const place = strengthPlaceFor(profile, week, s);
  const upper = s.focus === "haut";
  let list = upper ? (place === "salle" ? UPPER_GYM : UPPER_HOME) : place === "salle" ? GYM : HOME;
  // La pliométrie ne concerne que les jambes.
  if (!upper && week.phase !== "base" && !week.deload) {
    list = [...list.slice(0, -1), PLYO, list.at(-1)!];
  }
  const light = week.deload || week.phase === "test";
  return {
    blocks: [],
    place,
    exercises: [
      ...list.map((e) => ({ ...e, sets: light ? Math.max(2, e.sets - 1) : e.sets })),
      ...(s.mobility ? MOBILITY : []),
    ],
    notes: [
      place === "salle"
        ? "En salle de musculation."
        : upper
          ? "À la maison, au poids du corps ou avec un élastique."
          : "À la maison, au poids du corps.",
      ...(s.focus
        ? [
            upper
              ? "Bloc haut du corps."
              : "Bloc bas du corps, utile contre les blessures de course.",
          ]
        : []),
      ...(s.mobility ? ["Les 4 derniers exercices forment le bloc de mobilité."] : []),
      ...(light ? ["Semaine allégée : une série de moins par exercice."] : []),
    ],
  };
}

/** Détail d'une séance : blocs de course avec allures, ou exercices de renfo. */
export function buildWorkout(profile: Profile, week: Week, s: Session): Workout {
  if (s.kind === "renfo") return strength(profile, week, s);
  if (s.kind === "sport-origine") {
    return {
      blocks: [],
      exercises: [],
      notes: [
        `${ORIGIN_LABEL[profile.originSport]} en endurance pendant ${s.durationMin} min.`,
        "Effort facile : cette séance entretient ton moteur sans fatiguer les jambes pour la course.",
      ],
    };
  }
  const notes: string[] = [];
  if (!profile.reference5kSec) {
    notes.push(
      "Ajoute ton temps sur 5 km (profil) ou importe tes sorties Strava pour avoir des allures précises.",
    );
  }
  if (s.kind === "test") notes.push("Note ton temps : il servira à recalculer tes allures.");
  if (s.objective) {
    notes.push(
      s.objective.priority === "principal"
        ? "C'est le jour J : pars à ton allure objectif, pas plus vite, et accélère sur la fin si tu peux."
        : `Course de préparation pour ${s.objective.prepFor ?? "ton objectif principal"} : cours à l'allure objectif, teste ta tenue et ton ravitaillement, et garde une petite réserve à l'arrivée.`,
    );
  }
  return { blocks: runBlocks(profile, week, s), exercises: [], notes };
}
