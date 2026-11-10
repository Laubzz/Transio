import { journal } from "./analytics";
import { addDays, weekday, type ISODate } from "./dates";
import { DAYS_SHORT } from "./labels";
import { cycles, type Activity, type AppState } from "./state";

/** Une séance faite et notée (prévue ou libre), tous cycles confondus. */
export interface DoneItem {
  date: ISODate;
  /** Type de séance prévue, ou sport d'une séance libre. */
  kind: string;
  free: boolean;
  durationMin: number;
  rpe: number;
  activity?: Activity;
}

export function doneItems(state: AppState): DoneItem[] {
  const act = (id?: number) => (state.activities ?? []).find((a) => a.id === id);
  const planned = cycles(state).flatMap((c) =>
    journal({ ...state, ...c })
      .filter((e) => e.feedback.done && e.feedback.rpe !== undefined)
      .map((e) => ({
        date: e.date,
        kind: e.kind as string,
        free: false,
        durationMin: e.feedback.durationMin ?? e.plannedMin,
        rpe: e.feedback.rpe!,
        activity: act(e.feedback.activityId),
      })),
  );
  const free = (state.freeSessions ?? []).map((f) => ({
    date: f.date,
    kind: f.sport as string,
    free: true,
    durationMin: f.durationMin,
    rpe: f.rpe,
    activity: act(f.activityId),
  }));
  return [...planned, ...free].sort((a, b) => (a.date < b.date ? 1 : -1));
}

const load = (items: DoneItem[]) => items.reduce((a, s) => a + s.durationMin * s.rpe, 0);
const minutes = (items: DoneItem[]) => items.reduce((a, s) => a + s.durationMin, 0);

export interface Overview {
  load: number;
  prevLoad: number;
  minutes: number;
  prevMinutes: number;
  count: number;
  /** Charge par jour (7 et 30 jours) ou par semaine (90 jours), de la plus ancienne à aujourd'hui. */
  series: { label: string; load: number }[];
  /** Minutes par intensité ressentie : faible jusqu'à 4/10, modérée 5 à 6, haute dès 7. */
  intensity: { low: number; mid: number; high: number };
  recent: DoneItem[];
}

/** Chiffres de la vue d'ensemble sur les `days` derniers jours, aujourd'hui compris. */
export function overview(state: AppState, today: ISODate, days: 7 | 30 | 90): Overview {
  const all = doneItems(state).filter((s) => s.date <= today);
  const from = addDays(today, -(days - 1));
  const cur = all.filter((s) => s.date >= from);
  const prev = all.filter((s) => s.date < from && s.date >= addDays(from, -days));
  const step = days === 90 ? 7 : 1;
  const series = Array.from({ length: Math.ceil(days / step) }, (_, i) => {
    const start = addDays(from, i * step);
    const end = addDays(start, step - 1);
    return {
      // Libellés courts : le jour sur 7 jours, « 4/11 » au-delà.
      label:
        days === 7
          ? DAYS_SHORT[weekday(start)]
          : `${Number(start.slice(8))}/${Number(start.slice(5, 7))}`,
      load: load(cur.filter((s) => s.date >= start && s.date <= end)),
    };
  });
  const zone = (lo: number, hi: number) => minutes(cur.filter((s) => s.rpe >= lo && s.rpe <= hi));
  return {
    load: load(cur),
    prevLoad: load(prev),
    minutes: minutes(cur),
    prevMinutes: minutes(prev),
    count: cur.length,
    series,
    intensity: { low: zone(1, 4), mid: zone(5, 6), high: zone(7, 10) },
    recent: all.slice(0, 3),
  };
}

/** Évolution en pourcentage par rapport à la période d'avant ; `null` sans point de comparaison. */
export const trend = (cur: number, prev: number) =>
  prev > 0 ? Math.round((cur / prev - 1) * 100) : null;
