import type { Activity, BestEffort } from "./state";

/** Champs utiles d'une activité renvoyée par l'API Strava (`/athlete/activities`). */
export interface StravaSummaryActivity {
  id: number;
  name: string;
  sport_type?: string;
  type?: string;
  start_date_local: string;
  distance: number;
  moving_time: number;
  elapsed_time?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  total_elevation_gain?: number;
  pr_count?: number;
}

/** Meilleur effort d'une activité détaillée (`/activities/{id}`). */
export interface StravaBestEffort {
  name: string;
  distance: number;
  elapsed_time: number;
}

export const toBestEfforts = (list: StravaBestEffort[] | undefined): BestEffort[] =>
  (list ?? [])
    .filter((e) => e.distance > 0 && e.elapsed_time > 0)
    .map((e) => ({ name: e.name, distanceM: Math.round(e.distance), elapsedSec: e.elapsed_time }));

/** Libellés français des distances des meilleurs efforts Strava. */
export const EFFORT_LABEL: Record<string, string> = {
  "400m": "400 m",
  "1/2 mile": "1/2 mile",
  "1k": "1 km",
  "1 mile": "1 mile",
  "2 mile": "2 miles",
  "5k": "5 km",
  "10k": "10 km",
  "15k": "15 km",
  "10 mile": "10 miles",
  "20k": "20 km",
  "Half-Marathon": "Semi",
  "30k": "30 km",
  Marathon: "Marathon",
};

const RUN = new Set(["Run", "TrailRun", "VirtualRun"]);
const RIDE = new Set([
  "Ride",
  "VirtualRide",
  "GravelRide",
  "MountainBikeRide",
  "EBikeRide",
  "EMountainBikeRide",
]);
const STRENGTH = new Set([
  "WeightTraining",
  "Workout",
  "Crossfit",
  "HighIntensityIntervalTraining",
]);

export function sportOf(type: string | undefined): Activity["sport"] {
  if (!type) return "autre";
  if (RUN.has(type)) return "course";
  if (RIDE.has(type)) return "velo";
  if (STRENGTH.has(type)) return "renfo";
  return "autre";
}

/** Activité Strava → activité de l'app (date locale, sport, distance, temps, FC). */
export function toActivity(a: StravaSummaryActivity): Activity {
  const out: Activity = {
    id: a.id,
    // Strava donne l'heure locale suffixée de « Z » : la date locale est le début de la chaîne.
    date: a.start_date_local.slice(0, 10),
    sport: sportOf(a.sport_type ?? a.type),
    name: a.name,
    distanceM: Math.round(a.distance),
    movingSec: a.moving_time,
  };
  if (a.elapsed_time) out.elapsedSec = a.elapsed_time;
  if (a.average_heartrate) out.avgHr = Math.round(a.average_heartrate);
  if (a.max_heartrate) out.maxHr = Math.round(a.max_heartrate);
  if (a.total_elevation_gain) out.elevationM = Math.round(a.total_elevation_gain);
  if (a.pr_count) out.prCount = a.pr_count;
  return out;
}

/** Allure moyenne en s/km, ou `null` sans distance. */
export function activityPace(a: Pick<Activity, "distanceM" | "movingSec">): number | null {
  return a.distanceM > 0 ? a.movingSec / (a.distanceM / 1000) : null;
}

/** Portée minimale pour lire les activités. */
export const STRAVA_SCOPE = "read,activity:read_all";

export function hasActivityScope(scope: string | null | undefined): boolean {
  return (scope ?? "").split(",").some((s) => s === "activity:read" || s === "activity:read_all");
}
