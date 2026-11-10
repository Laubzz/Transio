import {
  INJURY_START_FACTOR,
  LOW_PAST_VOLUME_FACTOR,
  LOW_PAST_VOLUME_HOURS,
  LOWER_LIMB,
  ORIGIN_LABEL,
  GOAL_DISTANCE_KM,
  LONG_RUN_SHARE,
  LONG_RUN_TARGET,
  MIN_OTHER_RUN,
  RUNNER_MINUTES,
  PEAK_RUN_MINUTES,
  RULES,
  RUN_DAYS,
  RUN_WALK_START,
  RUN_WALK_WEEKS,
  START_RUN_MINUTES,
  TARGET_RPE,
} from "./rules";
import { goalPaceNeed } from "./goalPace";
import type {
  Phase,
  Plan,
  PlanObjective,
  Profile,
  Session,
  SessionKind,
  StrengthFocus,
  Week,
} from "./types";

/** Arrondi aux 5 minutes inférieures (jamais au-dessus d'un plafond). */
export const floor5 = (m: number) => Math.floor(m / 5) * 5;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const round5 = (m: number) => Math.round(m / 5) * 5;

/** Charge prévue d'une semaine : durée × difficulté visée de chaque séance. */
export const plannedLoad = (week: Pick<Week, "sessions">) =>
  week.sessions.reduce((a, s) => a + s.durationMin * s.targetRpe, 0);

/** Minutes de course réellement prévues dans une semaine (somme des séances à impact). */
export const runMinutesOf = (week: Pick<Week, "sessions">) =>
  week.sessions.filter((s) => s.impact).reduce((a, s) => a + s.durationMin, 0);

/** Hausse de volume autorisée à partir d'une semaine de construction. */
export function maxIncrease(prevMinutes: number): number {
  return clamp(prevMinutes * RULES.maxIncreaseRatio, RULES.minIncreaseMin, RULES.maxIncreaseMin);
}

export function validateProfile(p: Profile): void {
  if (!Number.isInteger(p.weeks) || p.weeks < RULES.minWeeks || p.weeks > RULES.maxWeeks) {
    throw new RangeError(
      `La durée du plan doit être entre ${RULES.minWeeks} et ${RULES.maxWeeks} semaines.`,
    );
  }
  const blocks = p.strengthBlocks;
  if (blocks) {
    const ok = (n: number) => Number.isInteger(n) && n >= 0 && n <= 3;
    if (!ok(blocks.haut) || !ok(blocks.bas)) {
      throw new RangeError("Chaque bloc de renforcement se travaille de 0 à 3 fois par semaine.");
    }
  }
  if (strengthBlocksOf(p).length > RULES.maxStrengthPerWeek) {
    throw new RangeError(
      `Pas plus de ${RULES.maxStrengthPerWeek} séances de renforcement par semaine.`,
    );
  }
  if (p.weeklyHoursPast < 0 || p.yearsPracticed < 0) {
    throw new RangeError("Le volume et les années de pratique ne peuvent pas être négatifs.");
  }
}

/**
 * Blocs de renforcement de la semaine, dans l'ordre où ils sont placés : le bas du corps
 * d'abord (loin de la sortie longue), en alternant avec le haut. Sans blocs précisés,
 * `strengthPerWeek` séances de renfo « coureur ».
 */
export function strengthBlocksOf(p: Profile): (StrengthFocus | undefined)[] {
  if (!p.strengthBlocks) return Array(p.strengthPerWeek).fill(undefined);
  let { haut, bas } = p.strengthBlocks;
  const out: StrengthFocus[] = [];
  while (haut > 0 || bas > 0) {
    if (bas > 0) {
      out.push("bas");
      bas--;
    }
    if (haut > 0) {
      out.push("haut");
      haut--;
    }
  }
  return out;
}

/** Durée estimée d'une course objectif, en minutes (loi de Riegel depuis le temps sur 5 km). */
export function raceMinutes(p: Profile, distanceKm: number): number {
  const min = p.reference5kSec
    ? (p.reference5kSec * (distanceKm / 5) ** 1.06) / 60
    : distanceKm * 6.5;
  return Math.max(10, round5(min));
}

/** Course objectif d'une semaine (le principal d'abord s'il y en a plusieurs). */
function raceOf(objectives: PlanObjective[] | undefined, week: number): PlanObjective | undefined {
  const inWeek = (objectives ?? []).filter((o) => o.week === week);
  return inWeek.find((o) => o.priority === "principal") ?? inWeek[0];
}

/** Minutes de course de la première semaine. */
export function startMinutes(p: Profile): number {
  if (p.startRunMinutes) return Math.max(15 * p.runDaysPerWeek, floor5(p.startRunMinutes));
  let m = START_RUN_MINUTES[p.originSport];
  if (p.injuries.some((i) => LOWER_LIMB.includes(i.zone))) m *= INJURY_START_FACTOR;
  if (p.weeklyHoursPast < LOW_PAST_VOLUME_HOURS) m *= LOW_PAST_VOLUME_FACTOR;
  // Quelqu'un qui court déjà repart de 90 % de son volume actuel, sans dépasser le pic visé.
  const current = Math.min(PEAK_RUN_MINUTES[p.goal], (p.currentRunMinutes ?? 0) * 0.9);
  return Math.max(15 * p.runDaysPerWeek, floor5(Math.max(m, current)));
}

/** Phase d'une semaine : base ≈ 40 %, rythme ≈ 30 %, spécifique le reste, test la dernière. */
export function phaseOf(week: number, total: number): Phase {
  if (week === total) return "test";
  const build = total - 1;
  const base = Math.round(build * 0.4);
  const rythme = Math.round(build * 0.3);
  if (week <= base) return "base";
  if (week <= base + rythme) return "rythme";
  return "specifique";
}

export interface WeekVolume {
  minutes: number;
  deload: boolean;
}

/**
 * Volumes de course des semaines `from` à `profile.weeks`.
 * `lastBuild` est le volume de la dernière semaine de construction (ni allégée, ni test).
 * `first` impose le volume de la semaine `from` ; avec `holdAfter`, la semaine de
 * construction suivante reprend au niveau de `lastBuild` sans le dépasser.
 * Une semaine de course objectif est affûtée (plus nettement pour un objectif principal, suivi
 * d'une semaine de récupération) et ne compte pas dans la progression.
 */
export function scheduleVolumes(
  profile: Profile,
  from: number,
  lastBuild: number,
  first?: WeekVolume,
  holdAfter = false,
  objectives?: PlanObjective[],
): WeekVolume[] {
  const peak = PEAK_RUN_MINUTES[profile.goal];
  const out: WeekVolume[] = [];
  let hold = holdAfter;
  for (let w = from; w <= profile.weeks; w++) {
    const race = raceOf(objectives, w);
    if (w === from && first) {
      out.push(first);
      if (!first.deload && !race) lastBuild = first.minutes;
    } else if (w === profile.weeks) {
      out.push({ minutes: floor5(lastBuild * RULES.taperFactor), deload: false });
    } else if (race) {
      const k = race.priority === "principal" ? RULES.taperFactor : RULES.secondaryRaceFactor;
      out.push({ minutes: floor5(lastBuild * k), deload: false });
    } else if (raceOf(objectives, w - 1)?.priority === "principal") {
      out.push({ minutes: floor5(lastBuild * RULES.deloadFactor), deload: true });
    } else if (w % RULES.deloadEvery === 0) {
      out.push({ minutes: floor5(lastBuild * RULES.deloadFactor), deload: true });
    } else if (hold) {
      out.push({ minutes: lastBuild, deload: false });
      hold = false;
    } else {
      const m = Math.min(Math.max(peak, lastBuild), floor5(lastBuild + maxIncrease(lastBuild)));
      out.push({ minutes: m, deload: false });
      lastBuild = m;
    }
  }
  return out;
}

/**
 * Répartit les minutes de course. La sortie longue d'abord : sa part habituelle du volume, ou
 * davantage dès que les autres séances gardent leur durée minimale, jusqu'à la durée visée pour
 * l'objectif (une sortie d'au moins le temps de course avant le test). Le reste est partagé à
 * parts égales, le surplus allant à la première séance.
 */
export function splitRun(total: number, n: 2 | 3 | 4, goal: Profile["goal"]): number[] {
  const share = round5(total * LONG_RUN_SHARE[n]);
  const stretched = Math.min(LONG_RUN_TARGET[goal], floor5(total - MIN_OTHER_RUN[n] * (n - 1)));
  // Au-delà de 120 % de la durée visée, les minutes en plus vont aux autres séances.
  const long = Math.min(Math.max(share, stretched), round5(LONG_RUN_TARGET[goal] * 1.2));
  const rest = total - long;
  const each = floor5(rest / (n - 1));
  const parts = Array(n - 1).fill(each);
  parts[0] += rest - each * (n - 1);
  return [...parts, long];
}

/**
 * Donne à la séance à l'allure objectif la durée dont elle a besoin (échauffement, kilomètres,
 * récupérations, retour au calme), en la prenant sur les footings, qui gardent au moins 20 min
 * (30 min pour le fractionné). La sortie longue ne change pas.
 */
function fitQuality(
  profile: Profile,
  week: number,
  kinds: SessionKind[],
  durations: number[],
): number[] {
  const t = kinds.indexOf("tempo");
  const need = t < 0 ? null : goalPaceNeed(profile, qualityRank(profile, week));
  if (need === null || need <= durations[t]) return durations;
  const others = kinds.map((_, i) => i).filter((i) => i !== t && i !== kinds.length - 1);
  const floor = (i: number) => (kinds[i] === "fractionne" ? 30 : 20);
  const rest = durations.slice(0, -1).reduce((a, b) => a + b, 0);
  const tempo = Math.min(need, rest - others.reduce((a, i) => a + floor(i), 0));
  if (tempo <= durations[t]) return durations;
  const out = [...durations];
  out[t] = tempo;
  const each = others.length ? floor5((rest - tempo) / others.length) : 0;
  others.forEach((i) => (out[i] = each));
  if (others.length) out[others[0]] += rest - tempo - each * others.length;
  return out;
}

/** La personne court déjà régulièrement : pas besoin de course-marche. */
const alreadyRuns = (p: Profile) =>
  (p.cycle ?? 1) > 1 || (p.currentRunMinutes ?? 0) >= RUNNER_MINUTES;

/** Volume à partir duquel 3 courses par semaine supportent deux séances de qualité. */
const TWO_QUALITY_MINUTES = 150;

/**
 * Rang de la semaine parmi les semaines de qualité (rythme et spécifique, hors semaines
 * allégées) : 0 pour la première. Il fixe l'étape de la progression à l'allure objectif.
 */
export function qualityRank(profile: Profile, week: number): number {
  let rank = 0;
  for (let w = 1; w < week; w++) {
    const ph = phaseOf(w, profile.weeks);
    if ((ph === "rythme" || ph === "specifique") && w % RULES.deloadEvery !== 0) rank++;
  }
  return rank;
}

function runKinds(
  profile: Profile,
  week: number,
  phase: Phase,
  deload: boolean,
  minutes: number,
): SessionKind[] {
  const n = profile.runDaysPerWeek;
  const kinds: SessionKind[] = Array(n - 1).fill("endurance");
  kinds.push("sortie-longue");
  if (phase === "test") {
    kinds[n - 1] = "test";
    return kinds;
  }
  if (deload) return kinds;
  if (RUN_WALK_START[profile.originSport] && !alreadyRuns(profile) && week <= RUN_WALK_WEEKS) {
    return kinds.map((k) => (k === "endurance" ? "course-marche" : k));
  }
  if (phase === "rythme") kinds[n - 2] = "tempo";
  if (phase === "specifique") {
    // Une séance à l'allure objectif chaque semaine ; le fractionné s'ajoute quand le volume
    // le permet (4 courses, ou 3 courses avec assez de minutes).
    if (n >= 4 || (n === 3 && minutes >= TWO_QUALITY_MINUTES)) {
      kinds[n - 2] = "fractionne";
      kinds[0] = "tempo";
    } else {
      kinds[n - 2] = "tempo";
    }
  }
  return kinds;
}

/** Résumé d'une séance ; le détail (blocs, allures, exercices) vient de `buildWorkout`. */
export const SESSION_DESCRIPTION: Record<SessionKind, string> = {
  "course-marche": "Alterner 2 min de course et 1 min de marche, allure très facile",
  endurance: "Footing en endurance fondamentale, zone 2, tu dois pouvoir parler",
  "sortie-longue": "Sortie longue en zone 2, régulière du début à la fin",
  tempo:
    "Blocs à allure soutenue (seuil, puis allure objectif) entre un échauffement et un retour au calme",
  fractionne: "Répétitions courtes et rapides, récupération en trottinant",
  test: "Test de fin de plan sur la distance objectif",
  objectif: "Course objectif",
  "sport-origine": "Séance facile du sport d'origine, compte dans la charge",
  renfo: "Renforcement : mollets, pieds, gainage, chaîne postérieure",
};

const STRENGTH_DESCRIPTION: Record<StrengthFocus, string> = {
  haut: "Renforcement du haut du corps : dos, épaules, pectoraux, bras, gainage",
  bas: "Renforcement du bas du corps : mollets, cuisses, fessiers, chaîne postérieure",
};

/** Résumé d'une séance, précisé pour le renfo par bloc et pour une course objectif. */
export function sessionDescription(s: Session): string {
  if (s.objective) {
    return s.objective.priority === "principal"
      ? `Objectif principal : ${s.objective.label} (${s.objective.distanceKm} km)`
      : `Objectif secondaire : ${s.objective.label} (${s.objective.distanceKm} km), en préparation de ${s.objective.prepFor ?? "ton objectif principal"}`;
  }
  if (s.kind !== "renfo") return s.description || SESSION_DESCRIPTION[s.kind];
  const base = s.focus ? STRENGTH_DESCRIPTION[s.focus] : SESSION_DESCRIPTION.renfo;
  return s.mobility ? `${base}, puis 10 min de mobilité` : base;
}

/** Séances de course d'une semaine de course objectif : la course, entourée de footings courts. */
function raceWeekRuns(profile: Profile, volume: WeekVolume, race: PlanObjective): Session[] {
  const n = profile.runDaysPerWeek;
  const principal = race.priority === "principal";
  const raceMin = raceMinutes(profile, race.distanceKm);
  const others = RUN_DAYS[n].slice(0, n - 1).filter((d) => d !== race.day);
  const each = clamp(floor5((volume.minutes - raceMin) / Math.max(1, others.length)), 20, 40);
  const easy = (day: number): Session => {
    const eve = day === race.day - 1;
    const after = day > race.day;
    return {
      day,
      kind: "endurance",
      durationMin: eve ? 20 : after ? Math.min(each, 30) : each,
      targetRpe: TARGET_RPE.endurance,
      impact: true,
      description: SESSION_DESCRIPTION.endurance,
      ...(eve
        ? { note: `Déblocage court la veille de ${race.label} : 20 min faciles.` }
        : after
          ? { note: `Récupération après ${race.label} : très facile.` }
          : {}),
    };
  };
  const { week: _week, day, ...objective } = race;
  void _week;
  return [
    ...others.map(easy),
    {
      day,
      kind: "objectif",
      durationMin: raceMin,
      targetRpe: principal ? TARGET_RPE.objectif : TARGET_RPE.objectif - 1,
      impact: true,
      description: SESSION_DESCRIPTION.objectif,
      objective,
    },
  ];
}

/** Construit les séances d'une semaine à partir de son volume de course. */
export function buildWeek(
  profile: Profile,
  index: number,
  volume: WeekVolume,
  objectives?: PlanObjective[],
): Week {
  const phase = phaseOf(index, profile.weeks);
  const n = profile.runDaysPerWeek;
  const race = raceOf(objectives, index);
  const kinds = runKinds(profile, index, phase, volume.deload, volume.minutes);
  const durations = fitQuality(profile, index, kinds, splitRun(volume.minutes, n, profile.goal));
  if (phase === "test" && !race) {
    // Le test : 15 min d'échauffement, la distance objectif, 10 min de retour au calme.
    const test = 25 + raceMinutes(profile, GOAL_DISTANCE_KM[profile.goal]);
    if (test > durations[n - 1]) {
      durations[n - 1] = test;
      // Le test prend plus de place : les footings d'avant restent très courts.
      for (let i = 0; i < n - 1; i++) durations[i] = Math.min(durations[i], 20);
    }
  }
  const runDays = race ? [...RUN_DAYS[n].slice(0, n - 1), race.day] : RUN_DAYS[n];
  const sessions: Session[] = race
    ? raceWeekRuns(profile, volume, race)
    : kinds.map((kind, i) => ({
        day: runDays[i],
        kind,
        durationMin: durations[i],
        targetRpe: TARGET_RPE[kind],
        impact: true,
        description: SESSION_DESCRIPTION[kind],
      }));

  // La veille d'une course objectif reste libre de renfo et de sport d'origine.
  const free = [0, 1, 2, 3, 4, 5, 6].filter(
    (d) => !runDays.includes(d) && !(race && d === race.day - 1),
  );
  const lighten = volume.deload || phase === "test" ? RULES.deloadFactor : 1;
  if (profile.keepOriginSport && profile.originSport !== "reprise" && free.length) {
    const base = clamp(profile.weeklyHoursPast * 60 * 0.25, 45, 120);
    sessions.push({
      day: free.pop()!,
      kind: "sport-origine",
      durationMin: floor5(base * lighten),
      targetRpe: TARGET_RPE["sport-origine"],
      impact: false,
      description: `${ORIGIN_LABEL[profile.originSport]} : ${SESSION_DESCRIPTION["sport-origine"]}`,
    });
  }
  for (const focus of strengthBlocksOf(profile)) {
    if (!free.length) break;
    const s: Session = {
      day: free.shift()!,
      kind: "renfo",
      durationMin: floor5((40 + (profile.mobility ? 10 : 0)) * lighten),
      targetRpe: TARGET_RPE.renfo,
      impact: false,
      description: SESSION_DESCRIPTION.renfo,
      ...(focus ? { focus } : {}),
      ...(profile.mobility ? { mobility: true } : {}),
    };
    sessions.push({ ...s, description: sessionDescription(s) });
  }
  sessions.sort((a, b) => a.day - b.day);
  return {
    index,
    phase,
    deload: volume.deload,
    // La semaine de test compte ses minutes réelles, test compris.
    runMinutes: phase === "test" && !race ? runMinutesOf({ sessions }) : volume.minutes,
    sessions,
    ...(race ? { objective: race.priority } : {}),
  };
}

/** Volume de la dernière semaine de construction jusqu'à `upTo` inclus. */
export function lastBuildUpTo(plan: Plan, upTo: number): number {
  const builds = plan.weeks.filter(
    (w) => w.index <= upTo && !w.deload && w.phase !== "test" && !w.objective,
  );
  return builds.length ? builds[builds.length - 1].runMinutes : plan.weeks[0].runMinutes;
}

/**
 * Reconstruit une semaine avec un nouveau volume. Une semaine modifiée à la main garde ses
 * séances : seules les durées de course suivent le nouveau volume.
 */
function rebuildWeek(plan: Plan, old: Week | undefined, index: number, v: WeekVolume): Week {
  if (!old?.edited || raceOf(plan.objectives, index) || old.objective) {
    return buildWeek(plan.profile, index, v, plan.objectives);
  }
  const ratio = old.runMinutes > 0 ? v.minutes / old.runMinutes : 1;
  return {
    ...old,
    deload: v.deload,
    runMinutes: v.minutes,
    sessions: old.sessions.map((s) =>
      s.impact ? { ...s, durationMin: Math.max(10, round5(s.durationMin * ratio)) } : s,
    ),
  };
}

/** Recalcule les volumes à partir de la semaine `from` et reconstruit les semaines concernées. */
export function rebuildFrom(
  plan: Plan,
  from: number,
  lastBuild: number,
  first?: WeekVolume,
  holdAfter = false,
): Plan {
  const volumes = scheduleVolumes(plan.profile, from, lastBuild, first, holdAfter, plan.objectives);
  return {
    ...plan,
    weeks: [
      ...plan.weeks.slice(0, from - 1),
      ...volumes.map((v, i) => rebuildWeek(plan, plan.weeks[from - 1 + i], from + i, v)),
    ],
  };
}

/** Génère le plan complet à partir du questionnaire de départ. */
export function generatePlan(profile: Profile): Plan {
  validateProfile(profile);
  const start = startMinutes(profile);
  const volumes = scheduleVolumes(profile, 1, start, { minutes: start, deload: false });
  return { profile, weeks: volumes.map((v, i) => buildWeek(profile, i + 1, v)) };
}
