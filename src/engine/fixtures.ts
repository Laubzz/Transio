import type { Profile } from "./types";

/**
 * Profil d'exemple : le parcours de la V1 (vélo vers course à pied, avec muscu),
 * sur 12 semaines comme le plan prototype de Pacio.
 */
export const VELO_TO_10K: Profile = {
  originSport: "velo",
  yearsPracticed: 6,
  weeklyHoursPast: 8,
  injuries: [],
  goal: "10k",
  weeks: 12,
  runDaysPerWeek: 3,
  keepOriginSport: true,
  strengthPerWeek: 1,
};
