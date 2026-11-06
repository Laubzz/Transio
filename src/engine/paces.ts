import type { Goal } from "./types";

/** Allures en secondes par kilomètre. Une plage va de la plus rapide à la plus lente. */
export type PaceRange = [fast: number, slow: number];

export type Intensity = "marche" | "endurance" | "seuil" | "vma" | "objectif";

/**
 * Écarts d'allure par rapport à l'allure 5 km, en s/km (repères classiques de l'entraînement
 * en course à pied : endurance bien plus lente, seuil un peu plus lent, VMA un peu plus rapide).
 */
const OFFSETS: Record<Exclude<Intensity, "marche" | "objectif">, [number, number]> = {
  endurance: [60, 90],
  seuil: [15, 25],
  vma: [-10, 0],
};

/** Allure objectif selon la distance, par rapport à l'allure 5 km. */
const GOAL_OFFSET: Record<Goal, [number, number] | null> = {
  "5k": [-3, 3],
  "10k": [10, 18],
  semi: [25, 35],
  trail: null, // en trail on court à l'effort, pas à l'allure
};

export interface Paces {
  endurance: PaceRange;
  seuil: PaceRange;
  vma: PaceRange;
  objectif: PaceRange | null;
}

/** Allures cibles à partir d'un temps sur 5 km (en secondes). */
export function paces(reference5kSec: number, goal: Goal): Paces {
  if (!(reference5kSec > 0)) throw new RangeError("Le temps de référence doit être positif.");
  const p5 = reference5kSec / 5;
  const range = ([a, b]: [number, number]): PaceRange => [Math.round(p5 + a), Math.round(p5 + b)];
  const g = GOAL_OFFSET[goal];
  return {
    endurance: range(OFFSETS.endurance),
    seuil: range(OFFSETS.seuil),
    vma: range(OFFSETS.vma),
    objectif: g ? range(g) : null,
  };
}

/** 330 → « 5:30 ». */
export function formatPace(secPerKm: number): string {
  const s = Math.round(secPerKm);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function formatPaceRange([fast, slow]: PaceRange): string {
  return fast === slow ? `${formatPace(fast)} /km` : `${formatPace(fast)}–${formatPace(slow)} /km`;
}

/** « 25:30 » ou « 1:02:15 » → secondes ; `null` si illisible. */
export function parseDuration(text: string): number | null {
  const m = /^\s*(?:(\d+):)?(\d{1,2}):(\d{2})\s*$/.exec(text);
  if (!m) return null;
  const [h, min, s] = [Number(m[1] ?? 0), Number(m[2]), Number(m[3])];
  if (s >= 60 || (m[1] !== undefined && min >= 60)) return null;
  const total = h * 3600 + min * 60 + s;
  return total > 0 ? total : null;
}

export function formatDuration(totalSec: number): string {
  const s = Math.round(totalSec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/** Temps 5 km équivalent à une course sur une autre distance (formule de Riegel). */
export function equivalent5k(distanceM: number, timeSec: number): number {
  return timeSec * (5000 / distanceM) ** 1.06;
}
