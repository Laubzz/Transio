import { equivalent5k, formatDuration, formatPace } from "@/engine";
import { journal, strengthRecords } from "./analytics";
import type { ISODate } from "./dates";
import { cycles, type Activity, type AppState } from "./state";
import { EFFORT_LABEL, activityPace } from "./strava";

export interface RecordEntry {
  /** Valeur mise en avant (« 12,4 km », « 5:12 /km »…). */
  value: string;
  /** Contexte : nom de la sortie, temps, allure. */
  detail: string;
  date: ISODate;
}

export interface RecordCategory {
  id: string;
  title: string;
  /** Les 3 meilleurs, du premier au troisième. */
  top: RecordEntry[];
}

const km = (m: number) => `${(m / 1000).toFixed(1).replace(".", ",")} km`;
const top3 = <T>(list: T[], better: (a: T, b: T) => number) => [...list].sort(better).slice(0, 3);

function runDetail(a: Activity) {
  const pace = activityPace(a);
  return [a.name, formatDuration(a.movingSec), pace ? `${formatPace(pace)} /km` : null]
    .filter(Boolean)
    .join(" · ");
}

/** Séances faites d'affilée (sans séance manquée entre deux), sur tous les cycles. */
export function longestStreak(state: AppState): { count: number; until: ISODate | null } {
  const entries = cycles(state)
    .flatMap((c) => journal({ ...state, ...c }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  let best = { count: 0, until: null as ISODate | null };
  let run = 0;
  for (const e of entries) {
    run = e.feedback.done ? run + 1 : 0;
    if (run > best.count) best = { count: run, until: e.date };
  }
  return best;
}

/**
 * Records : les 3 meilleurs par catégorie, à partir des activités Strava et des retours de
 * séance (tous cycles confondus). Une catégorie sans donnée n'apparaît pas.
 */
export function records(state: AppState): RecordCategory[] {
  const acts = state.activities ?? [];
  const runs = acts.filter((a) => a.sport === "course" && a.distanceM > 0 && a.movingSec > 0);
  const rides = acts.filter((a) => a.sport === "velo" && a.distanceM > 0);
  const mid = runs.filter((a) => a.distanceM >= 3000 && a.distanceM <= 15000);
  const out: RecordCategory[] = [];

  out.push({
    id: "distance",
    title: "Plus longues sorties de course",
    top: top3(runs, (a, b) => b.distanceM - a.distanceM).map((a) => ({
      value: km(a.distanceM),
      detail: runDetail(a),
      date: a.date,
    })),
  });

  out.push({
    id: "allure",
    title: "Meilleures allures (3 km et plus)",
    top: top3(
      runs.filter((a) => a.distanceM >= 3000),
      (a, b) => activityPace(a)! - activityPace(b)!,
    ).map((a) => ({
      value: `${formatPace(activityPace(a)!)} /km`,
      detail: `${a.name} · ${km(a.distanceM)}`,
      date: a.date,
    })),
  });

  // Estimation utile seulement sans vrai record sur 5 km (meilleurs efforts Strava).
  const has5kEffort = runs.some((r) => r.bestEfforts?.some((e) => e.name === "5k"));
  if (!has5kEffort)
    out.push({
      id: "5k",
      title: "Meilleur équivalent 5 km",
      top: top3(
        mid,
        (a, b) => equivalent5k(a.distanceM, a.movingSec) - equivalent5k(b.distanceM, b.movingSec),
      ).map((a) => ({
        value: formatDuration(equivalent5k(a.distanceM, a.movingSec)),
        detail: `d'après ${a.name} · ${km(a.distanceM)} en ${formatDuration(a.movingSec)}`,
        date: a.date,
      })),
    });

  out.push({
    id: "denivele",
    title: "Plus gros dénivelés en course",
    top: top3(
      runs.filter((a) => (a.elevationM ?? 0) > 0),
      (a, b) => (b.elevationM ?? 0) - (a.elevationM ?? 0),
    ).map((a) => ({
      value: `${a.elevationM} m D+`,
      detail: `${a.name} · ${km(a.distanceM)}`,
      date: a.date,
    })),
  });

  out.push({
    id: "velo",
    title: "Plus longues sorties vélo",
    top: top3(rides, (a, b) => b.distanceM - a.distanceM).map((a) => ({
      value: km(a.distanceM),
      detail: `${a.name} · ${formatDuration(a.movingSec)}`,
      date: a.date,
    })),
  });

  // Sans Strava : les plus longues séances de course notées.
  if (!runs.length) {
    const noted = cycles(state)
      .flatMap((c) => journal({ ...state, ...c }))
      .filter(
        (e) =>
          e.feedback.done &&
          ["endurance", "sortie-longue", "tempo", "fractionne", "test", "course-marche"].includes(
            e.kind,
          ),
      );
    out.push({
      id: "duree",
      title: "Plus longues séances de course",
      top: top3(
        noted,
        (a, b) =>
          (b.feedback.durationMin ?? b.plannedMin) - (a.feedback.durationMin ?? a.plannedMin),
      ).map((e) => ({
        value: `${e.feedback.durationMin ?? e.plannedMin} min`,
        detail: `Semaine ${e.weekIndex}`,
        date: e.date,
      })),
    });
  }

  out.push({
    id: "muscu",
    title: "Muscu : charges maximales",
    top: strengthRecords(state)
      .filter((r) => r.loadKg > 0)
      .slice(0, 3)
      .map((r) => ({
        value: `${r.loadKg} kg`,
        detail: `${r.exercise} · ${r.reps} reps`,
        date: r.date,
      })),
  });

  return out.filter((c) => c.top.length > 0);
}

export interface PersonalBest {
  /** Nom Strava de la distance (« 5k »…). */
  name: string;
  label: string;
  distanceM: number;
  /** Les 3 meilleurs temps, une seule fois par sortie. */
  top: { timeSec: number; pace: string; date: ISODate; activity: string }[];
}

/** Records personnels de course par distance (meilleurs efforts Strava), du plus court au plus long. */
export function personalBests(state: AppState): PersonalBest[] {
  const byName = new Map<string, PersonalBest>();
  for (const a of state.activities ?? []) {
    if (a.sport !== "course") continue;
    for (const e of a.bestEfforts ?? []) {
      const pb =
        byName.get(e.name) ??
        byName
          .set(e.name, {
            name: e.name,
            label: EFFORT_LABEL[e.name] ?? e.name,
            distanceM: e.distanceM,
            top: [],
          })
          .get(e.name)!;
      pb.top.push({
        timeSec: e.elapsedSec,
        pace: `${formatPace(e.elapsedSec / (e.distanceM / 1000))} /km`,
        date: a.date,
        activity: a.name,
      });
    }
  }
  return [...byName.values()]
    .map((pb) => ({ ...pb, top: pb.top.sort((x, y) => x.timeSec - y.timeSec).slice(0, 3) }))
    .sort((x, y) => x.distanceM - y.distanceM);
}
