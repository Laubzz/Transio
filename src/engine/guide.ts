import { RULES, TARGET_RPE } from "./rules";
import type { Profile, Session, SessionKind, Week } from "./types";

/**
 * Renforcement selon le guide « Renforcement au poids du corps pour la course à pied » :
 * séances en salle (force générale), jour dédié à la maison (jambe par jambe, chevilles,
 * hanches, tronc, pliométrie) et routines courtes autour des séances de course.
 * Règle d'or du guide : pas de jambes lourdes, d'excentrique ni de pliométrie dans les 48 h
 * avant une séance clé ou une course.
 */

export interface GuideExercise {
  /** Code du guide (E1 à E24, M1 à M5) ; absent pour les exercices de salle. */
  code?: string;
  name: string;
  sets: number;
  reps: string;
  cue: string;
}

export interface Routine {
  title: string;
  /** Libellé court pour le calendrier. */
  short: string;
  /** Quand la faire et combien de temps. */
  when: string;
  exercises: GuideExercise[];
  note?: string;
}

/** Séances de course qui comptent comme séance clé : pas de lourd dans les 48 h avant. */
export const KEY_KINDS = new Set<SessionKind>([
  "tempo",
  "fractionne",
  "sortie-longue",
  "test",
  "objectif",
]);

const ex = (code: string, name: string, sets: number, reps: string, cue: string) => ({
  code,
  name,
  sets,
  reps,
  cue,
});

// Exercices du guide, aux dosages des routines (niveaux 1 à 2).
const M4 = (r = "10 par côté") =>
  ex("M4", "Cheville au mur", 1, r, "Genou vers le mur sans décoller le talon.");
const M5 = (r: string) =>
  ex("M5", "Fente et rotation", 1, r, "Main au sol, ouvre l'autre bras vers le ciel.");
const E1 = ex(
  "E1",
  "Montées sur pointes",
  2,
  "15 (2 pieds) ou 12 (1 pied)",
  "Monte en 1 s, redescends en 3 s.",
);
const E2 = (sets: number, reps: string) =>
  ex("E2", "Mollets assis avec disque", sets, reps, "Disque sur les genoux, descente en 3 s.");
const E3 = (sets: number, reps: string) =>
  ex("E3", "Releveurs du pied avec élastique", sets, reps, "Jambe tendue, retour lent en 3 s.");
const E4 = (sets: number, reps: string) =>
  ex("E4", "Pied court et serviette", sets, reps, "Creuse la voûte sans crisper les orteils.");
const E5 = ex(
  "E5",
  "Descentes excentriques sur marche",
  3,
  "10 par jambe",
  "Descends le talon en 3 à 4 s sur un pied.",
);
const E6 = (sets: number, reps: string) =>
  ex("E6", "Pont fessier", sets, reps, "Pousse dans les talons, sans cambrer.");
const E7 = (sets: number, reps = "10 pas par côté") =>
  ex("E7", "Marche latérale avec élastique", sets, reps, "Demi-squat, élastique toujours tendu.");
const E8 = ex(
  "E8",
  "Abduction couché sur le côté",
  2,
  "15 par côté",
  "Talon légèrement en arrière, descente en 3 s.",
);
const E9 = (sets: number, reps: string) =>
  ex("E9", "Gainage latéral avec élévation de jambe", sets, reps, "Bassin haut et aligné.");
const E10 = ex(
  "E10",
  "Copenhague (adducteurs)",
  3,
  "15 s par côté",
  "Genou sur le banc au début, bassin haut.",
);
const E13 = ex(
  "E13",
  "Fente bulgare",
  3,
  "8 à 10 par jambe",
  "Descends verticalement, genou dans l'axe.",
);
const E15 = ex(
  "E15",
  "Descente contrôlée sur une jambe",
  3,
  "8 par jambe",
  "Fléchis en 3 s jusqu'à effleurer le sol du talon libre.",
);
const E16 = ex(
  "E16",
  "Soulevé de terre sur une jambe",
  3,
  "8 par jambe",
  "Dos plat, disque dans la main opposée.",
);
const E18 = ex(
  "E18",
  "Nordic (ischios)",
  3,
  "5",
  "Bascule le plus lentement possible, rattrape-toi avec les mains.",
);
const E19 = (sets: number, reps: string) =>
  ex("E19", "Planche", sets, reps, "Corps aligné, ventre rentré, fesses serrées.");
const E20 = (sets: number, reps: string) =>
  ex("E20", "Bird dog", sets, reps, "Bras et jambe opposés, sans bouger le bassin.");
const E21 = (sets: number, reps: string) =>
  ex("E21", "Dead bug", sets, reps, "Bas du dos plaqué au sol.");
const E22 = (sets: number, reps: string) =>
  ex("E22", "Pallof press avec élastique", sets, reps, "Pousse sans laisser le buste tourner.");
const E23 = (sets: number, reps: string) =>
  ex(
    "E23",
    "Sautillements chevilles (pogo)",
    sets,
    reps,
    "Contact au sol court, les chevilles font le travail.",
  );
const E24 = ex(
  "E24",
  "Sauts unipodaux (cloche-pied)",
  3,
  "6 par jambe",
  "Réception douce, genou dans l'axe, stabilise 2 s.",
);

/** Avant une séance de qualité : 5 à 8 min, loin de la fatigue. */
export function activation(withPogo: boolean): Routine {
  return {
    title: "Activation avant la séance",
    short: "Avant : activation 5 à 8 min",
    when: "Avant l'échauffement, 5 à 8 min",
    exercises: [
      M4(),
      M5("4 par côté"),
      E6(1, "12"),
      E7(1),
      E20(1, "6 par côté"),
      ...(withPogo ? [E23(2, "15 s")] : []),
    ],
    note: "Ce n'est pas du renforcement : arrête-toi loin de la fatigue.",
  };
}

/** Juste après un footing facile : le meilleur moment pour la prévention. */
export const AFTER_EASY: Routine = {
  title: "Prévention après le footing",
  short: "Après : renfo prévention 12 à 15 min",
  when: "Juste après, avant la douche, 12 à 15 min (2 tours)",
  exercises: [
    E1,
    E2(2, "12 à 15"),
    E3(2, "15"),
    E8,
    E9(2, "30 s par côté"),
    E21(2, "10 par côté"),
    E7(2),
  ],
};

/** Le soir d'une séance dure : tronc et pieds seulement. */
export const EVENING_HARD: Routine = {
  title: "Le soir : tronc et pieds",
  short: "Le soir : renfo tronc et pieds 8 à 10 min",
  when: "Au moins 4 à 6 h après la séance, 8 à 10 min",
  exercises: [E19(3, "40 s"), E21(2, "10 par côté"), E22(2, "10 par côté"), E4(2, "8 × 5 s")],
  note: "Pas de pliométrie, de Nordic ni de descente excentrique : la séance a déjà sollicité les jambes.",
};

/** Routines du guide autour d'une séance de course. */
export function routinesFor(week: Week, s: Session): Routine[] {
  const raceWeek = Boolean(week.objective) || week.phase === "test";
  const keyTomorrow = week.sessions.some((x) => x.day === s.day + 1 && KEY_KINDS.has(x.kind));
  switch (s.kind) {
    case "endurance":
    case "course-marche":
      // La veille d'une séance clé ou d'une course, rien (guide, chapitre 2).
      return raceWeek || keyTomorrow ? [] : [AFTER_EASY];
    case "tempo":
    case "fractionne":
    case "test":
      return [activation(s.kind !== "tempo"), EVENING_HARD];
    case "objectif":
      return [activation(true)];
    default:
      return [];
  }
}

const GYM_FULL: GuideExercise[] = [
  {
    name: "Squat ou presse à cuisses",
    sets: 4,
    reps: "6 à 8",
    cue: "Charge lourde, 2 à 3 répétitions en réserve.",
  },
  {
    name: "Soulevé de terre roumain",
    sets: 3,
    reps: "8",
    cue: "Dos plat, la barre glisse le long des cuisses.",
  },
  { name: "Hip thrust", sets: 3, reps: "10", cue: "Serre les fessiers en haut, 1 s." },
  { name: "Développé couché", sets: 3, reps: "8", cue: "Omoplates serrées, descente contrôlée." },
  {
    name: "Tirage vertical ou tractions",
    sets: 3,
    reps: "8",
    cue: "Tire les coudes vers les hanches.",
  },
  { name: "Rowing à la poulie", sets: 3, reps: "10", cue: "Dos droit, serre les omoplates." },
];
const GYM_LEGS = new Set(["Squat ou presse à cuisses", "Soulevé de terre roumain", "Hip thrust"]);

/** Jour dédié du guide, bloc par bloc : 3 tours, 60 à 90 s de récupération entre les tours. */
const DEDICATED: { block: string; ex: GuideExercise; heavy?: boolean }[] = [
  { block: "Échauffement", ex: M5("5 par côté") },
  { block: "Échauffement", ex: M4() },
  { block: "Échauffement", ex: E7(1) },
  { block: "Force", ex: E13 },
  { block: "Force", ex: E16 },
  { block: "Force", ex: E15, heavy: true },
  { block: "Force", ex: E18, heavy: true },
  { block: "Chevilles", ex: E2(3, "12 par jambe") },
  { block: "Chevilles", ex: E5, heavy: true },
  { block: "Chevilles", ex: E3(2, "20") },
  { block: "Hanche", ex: E10 },
  { block: "Hanche", ex: E9(3, "10 par côté") },
  { block: "Tronc", ex: E22(3, "10 par côté") },
  { block: "Tronc", ex: E19(3, "45 s") },
  { block: "Pliométrie (optionnel)", ex: E23(3, "20 s"), heavy: true },
  { block: "Pliométrie (optionnel)", ex: E24, heavy: true },
];

export interface GuideStrength {
  exercises: GuideExercise[];
  notes: string[];
}

/** Séance de renfo du guide : salle (corps entier) ou jour dédié à la maison. */
export function guideStrength(week: Week, s: Session): GuideStrength {
  const raceWeek = Boolean(week.objective) || week.phase === "test";
  const lighter = week.deload || raceWeek;
  if (s.place === "salle") {
    return {
      exercises: GYM_FULL.map((e) => ({
        ...e,
        sets: Math.max(2, e.sets - (lighter ? 1 : 0) - (s.light && GYM_LEGS.has(e.name) ? 1 : 0)),
      })),
      notes: [
        "En salle : force générale, corps entier.",
        ...(s.light
          ? ["Séance clé dans moins de 48 h : jambes modérées, une série de moins sur les jambes."]
          : []),
        ...(lighter ? ["Semaine allégée : une série de moins par exercice."] : []),
      ],
    };
  }
  // Semaine de course : ni Nordic, ni excentrique, ni pliométrie.
  const items = DEDICATED.filter((d) => !((s.light || raceWeek) && d.heavy));
  return {
    exercises: items.map(({ block, ex: e }) => ({
      ...e,
      name: `${block} · ${e.name}`,
      sets: e.sets,
    })),
    notes: [
      "À la maison : jour dédié du guide. Bloc par bloc, 3 tours, 60 à 90 s de récupération entre les tours.",
      ...(raceWeek
        ? [
            "Semaine de course : sans Nordic, descentes excentriques ni pliométrie. Garde de la marge, rien jusqu'à l'échec.",
          ]
        : s.light
          ? ["Séance clé dans moins de 48 h : sans Nordic, descentes excentriques ni pliométrie."]
          : []),
      "Douleur jusqu'à 3 sur 10 acceptable si elle est revenue à la normale le lendemain matin.",
    ],
  };
}

/**
 * Place les séances de renfo du guide sur les jours libres : le jour dédié d'abord, puis la
 * salle, sur les jours les plus loin d'une séance clé (le lendemain compte double). Une séance
 * qui tombe moins de 48 h avant une séance clé passe en version légère.
 */
export function placeGuideStrength(
  profile: Profile,
  runs: Session[],
  free: number[],
  lighten: number,
  raceWeek: boolean,
): Session[] {
  const split = profile.strengthSplit!;
  const key = new Set(runs.filter((r) => KEY_KINDS.has(r.kind)).map((r) => r.day));
  const score = (d: number) => (key.has(d + 1) ? 2 : 0) + (key.has(d + 2) ? 1 : 0);
  const left = [...free];
  const taken: number[] = [];
  const pick = () => {
    // Le moins de séances clés juste après, puis le plus loin des séances de renfo déjà placées.
    const spread = (d: number) =>
      taken.length ? Math.min(...taken.map((t) => Math.abs(t - d))) : 0;
    left.sort((a, b) => score(a) - score(b) || spread(b) - spread(a) || a - b);
    const day = left.shift()!;
    taken.push(day);
    return day;
  };
  const out: Session[] = [];
  const add = (place: "salle" | "maison", minutes: number) => {
    if (!left.length) return;
    const day = pick();
    out.push({
      day,
      kind: "renfo",
      guide: true,
      place,
      // Une séance à la maison dure au moins 40 min.
      durationMin: Math.max(
        place === "maison" ? MIN_HOME_MIN : 15,
        Math.floor((minutes * lighten) / 5) * 5,
      ),
      targetRpe: TARGET_RPE.renfo,
      impact: false,
      description: "",
      ...(score(day) > 0 ? { light: true } : {}),
    });
  };
  // Le jour dédié (excentrique, Nordic, pliométrie) prend le meilleur jour, la salle ensuite.
  // Semaine de course : une seule séance à la maison.
  for (let i = 0; i < (raceWeek ? Math.min(1, split.maison) : split.maison); i++) {
    add("maison", 45);
  }
  for (let i = 0; i < split.salle; i++) add("salle", 50);
  return out;
}

export const guideTotal = (p: Profile) =>
  p.strengthSplit ? p.strengthSplit.salle + p.strengthSplit.maison : 0;

/** Durée minimale d'une séance de renfo à la maison, en minutes. */
export const MIN_HOME_MIN = 40;

export const MAX_GUIDE = RULES.maxStrengthPerWeek;

/** Nom d'un exercice sans le bloc du jour dédié (« Force · Fente bulgare » → « Fente bulgare »). */
const bare = (name: string) => name.split(" · ").pop()!;

/** Exercices du guide (maison et routines) et de la séance en salle, pour les listes de choix. */
export const EXERCISE_CATALOGUE: { salle: string[]; maison: string[] } = {
  salle: GYM_FULL.map((e) => e.name),
  maison: [
    ...new Set(
      [
        ...DEDICATED.map((d) => d.ex),
        ...AFTER_EASY.exercises,
        ...activation(true).exercises,
        ...EVENING_HARD.exercises,
      ].map((e) => bare(e.name)),
    ),
  ],
};
