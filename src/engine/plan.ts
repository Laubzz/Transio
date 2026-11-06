import {
  INJURY_START_FACTOR,
  LOW_PAST_VOLUME_FACTOR,
  LOW_PAST_VOLUME_HOURS,
  LOWER_LIMB,
  ORIGIN_LABEL,
  LONG_RUN_SHARE,
  PEAK_RUN_MINUTES,
  RULES,
  RUN_DAYS,
  RUN_WALK_START,
  RUN_WALK_WEEKS,
  START_RUN_MINUTES,
  TARGET_RPE,
} from "./rules";
import type { Phase, Plan, Profile, Session, SessionKind, Week } from "./types";

/** Arrondi aux 5 minutes inférieures (jamais au-dessus d'un plafond). */
export const floor5 = (m: number) => Math.floor(m / 5) * 5;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

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
  if (p.weeklyHoursPast < 0 || p.yearsPracticed < 0) {
    throw new RangeError("Le volume et les années de pratique ne peuvent pas être négatifs.");
  }
}

/** Minutes de course de la première semaine. */
export function startMinutes(p: Profile): number {
  let m = START_RUN_MINUTES[p.originSport];
  if (p.injuries.some((i) => LOWER_LIMB.includes(i.zone))) m *= INJURY_START_FACTOR;
  if (p.weeklyHoursPast < LOW_PAST_VOLUME_HOURS) m *= LOW_PAST_VOLUME_FACTOR;
  return Math.max(15 * p.runDaysPerWeek, floor5(m));
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
 */
export function scheduleVolumes(
  profile: Profile,
  from: number,
  lastBuild: number,
  first?: WeekVolume,
  holdAfter = false,
): WeekVolume[] {
  const peak = PEAK_RUN_MINUTES[profile.goal];
  const out: WeekVolume[] = [];
  let hold = holdAfter;
  for (let w = from; w <= profile.weeks; w++) {
    if (w === from && first) {
      out.push(first);
      if (!first.deload) lastBuild = first.minutes;
    } else if (w === profile.weeks) {
      out.push({ minutes: floor5(lastBuild * RULES.taperFactor), deload: false });
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
 * Répartit les minutes de course : la sortie longue d'abord (arrondie aux 5 min),
 * puis le reste à parts égales, le surplus allant à la première séance.
 */
function splitRun(total: number, n: 2 | 3 | 4): number[] {
  const long = Math.round((total * LONG_RUN_SHARE[n]) / 5) * 5;
  const rest = total - long;
  const each = floor5(rest / (n - 1));
  const parts = Array(n - 1).fill(each);
  parts[0] += rest - each * (n - 1);
  return [...parts, long];
}

function runKinds(profile: Profile, week: number, phase: Phase, deload: boolean): SessionKind[] {
  const n = profile.runDaysPerWeek;
  const kinds: SessionKind[] = Array(n - 1).fill("endurance");
  kinds.push("sortie-longue");
  if (phase === "test") {
    kinds[n - 1] = "test";
    return kinds;
  }
  if (deload) return kinds;
  if (RUN_WALK_START[profile.originSport] && week <= RUN_WALK_WEEKS) {
    return kinds.map((k) => (k === "endurance" ? "course-marche" : k));
  }
  if (phase === "rythme") kinds[n - 2] = "tempo";
  if (phase === "specifique") {
    kinds[n - 2] = "fractionne";
    if (n >= 3) kinds[0] = "tempo";
  }
  return kinds;
}

const DESCRIPTION: Record<SessionKind, string> = {
  "course-marche": "Alterner 2 min de course et 1 min de marche, allure très facile",
  endurance: "Footing en endurance fondamentale, zone 2, tu dois pouvoir parler",
  "sortie-longue": "Sortie longue en zone 2, régulière du début à la fin",
  tempo: "Échauffement puis 2 × 8 min à allure soutenue mais contrôlée",
  fractionne: "Échauffement puis 6 × 2 min rapide, récupération 1 min 30 trottinée",
  test: "Test de fin de plan sur la distance objectif",
  "sport-origine": "Séance facile du sport d'origine, compte dans la charge",
  renfo: "Renforcement : mollets, pieds, gainage, chaîne postérieure",
};

/** Construit les séances d'une semaine à partir de son volume de course. */
export function buildWeek(profile: Profile, index: number, volume: WeekVolume): Week {
  const phase = phaseOf(index, profile.weeks);
  const n = profile.runDaysPerWeek;
  const kinds = runKinds(profile, index, phase, volume.deload);
  const durations = splitRun(volume.minutes, n);
  const runDays = RUN_DAYS[n];
  const sessions: Session[] = kinds.map((kind, i) => ({
    day: runDays[i],
    kind,
    durationMin: durations[i],
    targetRpe: TARGET_RPE[kind],
    impact: true,
    description: DESCRIPTION[kind],
  }));

  const free = [0, 1, 2, 3, 4, 5, 6].filter((d) => !runDays.includes(d));
  const lighten = volume.deload || phase === "test" ? RULES.deloadFactor : 1;
  if (profile.keepOriginSport && profile.originSport !== "reprise" && free.length) {
    const base = clamp(profile.weeklyHoursPast * 60 * 0.25, 45, 120);
    sessions.push({
      day: free.pop()!,
      kind: "sport-origine",
      durationMin: floor5(base * lighten),
      targetRpe: TARGET_RPE["sport-origine"],
      impact: false,
      description: `${ORIGIN_LABEL[profile.originSport]} : ${DESCRIPTION["sport-origine"]}`,
    });
  }
  for (let i = 0; i < profile.strengthPerWeek && free.length; i++) {
    sessions.push({
      day: free.shift()!,
      kind: "renfo",
      durationMin: floor5(40 * lighten),
      targetRpe: TARGET_RPE.renfo,
      impact: false,
      description: DESCRIPTION.renfo,
    });
  }
  sessions.sort((a, b) => a.day - b.day);
  return { index, phase, deload: volume.deload, runMinutes: volume.minutes, sessions };
}

/** Génère le plan complet à partir du questionnaire de départ. */
export function generatePlan(profile: Profile): Plan {
  validateProfile(profile);
  const start = startMinutes(profile);
  const volumes = scheduleVolumes(profile, 1, start, { minutes: start, deload: false });
  return { profile, weeks: volumes.map((v, i) => buildWeek(profile, i + 1, v)) };
}
