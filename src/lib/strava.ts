import type { Activity } from "./state";

/** Champs utiles d'une activité renvoyée par l'API Strava (`/athlete/activities`). */
export interface StravaSummaryActivity {
  id: number;
  name: string;
  sport_type?: string;
  type?: string;
  start_date_local: string;
  distance: number;
  moving_time: number;
  average_heartrate?: number;
  total_elevation_gain?: number;
}

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
  return {
    id: a.id,
    // Strava donne l'heure locale suffixée de « Z » : la date locale est le début de la chaîne.
    date: a.start_date_local.slice(0, 10),
    sport: sportOf(a.sport_type ?? a.type),
    name: a.name,
    distanceM: Math.round(a.distance),
    movingSec: a.moving_time,
    avgHr: a.average_heartrate ? Math.round(a.average_heartrate) : undefined,
    elevationM: a.total_elevation_gain ? Math.round(a.total_elevation_gain) : undefined,
  };
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
