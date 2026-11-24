/** Sortie de course saisie à la main : distance, dénivelé, allure et temps. */
export interface RunLog {
  distanceKm?: number;
  /** Dénivelé positif, en mètres. */
  elevationM?: number;
  /** Allure moyenne, en secondes par km. */
  paceSec?: number;
  /** Temps de course, en secondes. */
  timeSec?: number;
}

const fmt = (sec: number) => {
  const s = Math.round(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${r}` : `${m}:${r}`;
};

/** « 10,5 km · D+ 150 m · 5:30 /km · 57:45 » */
export function runSummary(r: RunLog): string {
  return [
    r.distanceKm && `${String(r.distanceKm).replace(".", ",")} km`,
    r.elevationM && `D+ ${r.elevationM} m`,
    r.paceSec && `${fmt(r.paceSec)} /km`,
    r.timeSec && fmt(r.timeSec),
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Type de séance réellement faite. */
export type DoneType = "course" | "renfo" | "salle";

export const DONE_TYPE_LABEL: Record<DoneType, string> = {
  course: "Course à pied",
  renfo: "Renfo maison",
  salle: "Salle de sport",
};

/**
 * Complète la saisie après un changement : le temps se calcule depuis la distance et
 * l'allure, l'allure depuis la distance et le temps.
 */
export function completeRun(r: RunLog, changed: "distance" | "pace" | "time"): RunLog {
  const d = r.distanceKm && r.distanceKm > 0 ? r.distanceKm : undefined;
  if (!d) return r;
  const timeFromPace = () => (r.paceSec ? { ...r, timeSec: Math.round(r.paceSec * d) } : r);
  const paceFromTime = () => (r.timeSec ? { ...r, paceSec: Math.round(r.timeSec / d) } : r);
  if (changed === "time") return paceFromTime();
  if (changed === "pace") return timeFromPace();
  return r.paceSec ? timeFromPace() : paceFromTime();
}

const pos = (n: number | undefined) =>
  n !== undefined && Number.isFinite(n) && n > 0 ? n : undefined;

/** Garde les valeurs lisibles ; `undefined` si rien n'est saisi. */
export function cleanRun(r: RunLog | undefined): RunLog | undefined {
  if (!r) return undefined;
  const out: RunLog = {
    distanceKm: pos(r.distanceKm) && Math.round(r.distanceKm! * 100) / 100,
    elevationM: pos(r.elevationM) && Math.round(r.elevationM!),
    paceSec: pos(r.paceSec) && Math.round(r.paceSec!),
    timeSec: pos(r.timeSec) && Math.round(r.timeSec!),
  };
  for (const k of Object.keys(out) as (keyof RunLog)[]) if (out[k] === undefined) delete out[k];
  return Object.keys(out).length ? out : undefined;
}
