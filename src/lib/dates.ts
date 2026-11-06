/** Dates locales au format AAAA-MM-JJ, sans heure ni fuseau. */
export type ISODate = string;

const pad = (n: number) => String(n).padStart(2, "0");

export function toISO(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parts(s: ISODate): [number, number, number] {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) throw new RangeError(`Date invalide : ${s}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** Jours entre deux dates (b − a), insensible aux changements d'heure. */
export function daysBetween(a: ISODate, b: ISODate): number {
  const [ya, ma, da] = parts(a);
  const [yb, mb, db] = parts(b);
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86_400_000);
}

export function addDays(s: ISODate, n: number): ISODate {
  const [y, m, d] = parts(s);
  return toISO(new Date(y, m - 1, d + n));
}

/** Jour de la semaine : 0 = lundi … 6 = dimanche. */
export function weekday(s: ISODate): number {
  const [y, m, d] = parts(s);
  return (new Date(y, m - 1, d).getDay() + 6) % 7;
}

/** La date elle-même si c'est un lundi, sinon le lundi suivant. */
export function nextMonday(s: ISODate): ISODate {
  const wd = weekday(s);
  return wd === 0 ? s : addDays(s, 7 - wd);
}

/** Lundi de la semaine de la date. */
export function mondayOf(s: ISODate): ISODate {
  return addDays(s, -weekday(s));
}

export type PlanPosition =
  | { status: "avant"; daysUntilStart: number }
  | { status: "en-cours"; weekIndex: number; day: number }
  | { status: "termine" };

/** Où en est-on dans un plan qui commence le lundi `start` ? */
export function position(start: ISODate, today: ISODate, totalWeeks: number): PlanPosition {
  const offset = daysBetween(start, today);
  if (offset < 0) return { status: "avant", daysUntilStart: -offset };
  const weekIndex = Math.floor(offset / 7) + 1;
  if (weekIndex > totalWeeks) return { status: "termine" };
  return { status: "en-cours", weekIndex, day: offset % 7 };
}

/** Date d'une séance (semaine numérotée à partir de 1, jour 0 = lundi). */
export function sessionDate(start: ISODate, weekIndex: number, day: number): ISODate {
  return addDays(start, (weekIndex - 1) * 7 + day);
}

const LONG = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const SHORT = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });

export function formatLong(s: ISODate): string {
  const [y, m, d] = parts(s);
  return LONG.format(new Date(y, m - 1, d));
}

export function formatShort(s: ISODate): string {
  const [y, m, d] = parts(s);
  return SHORT.format(new Date(y, m - 1, d));
}
