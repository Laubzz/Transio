import {
  INTENSITY_LABEL,
  ORIGIN_LABEL,
  buildWorkout,
  formatDuration,
  sessionDescription,
  target,
  type Profile,
  type Session,
  type Week,
} from "@/engine";
import { addDays, sessionDate } from "./dates";
import { sessionTitle } from "./labels";
import type { AppState } from "./state";

/** Texte du détail d'une séance, pour la description de l'événement. */
export function workoutText(profile: Profile, week: Week, s: Session): string[] {
  const w = buildWorkout(profile, week, s);
  const dur = (sec: number) => (sec % 60 === 0 ? `${sec / 60} min` : formatDuration(sec));
  const lines = [sessionDescription(s), ""];
  for (const b of w.blocks) {
    const head =
      b.repeat > 1
        ? `${b.label} : ${b.repeat} × ${dur(b.workSec)}${b.recoverySec ? ` (récup ${dur(b.recoverySec)})` : ""}`
        : b.workSec > 0
          ? `${b.label} : ${dur(b.workSec)}`
          : b.label;
    lines.push(`• ${head} — ${INTENSITY_LABEL[b.intensity]} : ${target(profile, b.intensity)}`);
  }
  for (const e of w.exercises) lines.push(`• ${e.name} : ${e.sets} × ${e.reps}`);
  if (w.notes.length) lines.push("", ...w.notes);
  return lines;
}

const escape = (t: string) =>
  t.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Coupe une ligne à 75 octets, comme le demande le format iCalendar. */
export function fold(line: string): string {
  const bytes = new TextEncoder();
  const out: string[] = [];
  let cur = "";
  for (const ch of line) {
    if (bytes.encode(cur + ch).length > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = ch;
    } else cur += ch;
  }
  out.push(cur);
  return out.join("\r\n ");
}

const compact = (iso: string) => iso.replace(/-/g, "");
const stamp = (d: Date) =>
  d
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");

export interface CalendarOptions {
  /** Heure des séances (« 18:30 ») ; `null` pour des événements sur la journée. */
  time: string | null;
  /** Date du calcul, pour DTSTAMP (déterministe dans les tests). */
  now?: Date;
}

/** Calendrier iCalendar (.ics) du plan en cours : un événement par séance. */
export function buildCalendar(state: AppState, opts: CalendarOptions): string {
  const { plan, startDate } = state;
  const p = plan.profile;
  const origin = ORIGIN_LABEL[p.originSport];
  const cycle = p.cycle ?? 1;
  const dtstamp = stamp(opts.now ?? new Date());
  const time = opts.time && /^\d{2}:\d{2}$/.test(opts.time) ? opts.time : null;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Transio//Plan d'entrainement//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Transio",
    "X-WR-CALDESC:Ton plan d'entraînement Transio",
    "REFRESH-INTERVAL;VALUE=DURATION:PT6H",
    "X-PUBLISHED-TTL:PT6H",
  ];

  for (const week of plan.weeks) {
    for (const s of week.sessions) {
      const date = sessionDate(startDate, week.index, s.day);
      const title = `Transio · ${sessionTitle(s, origin)} · ${s.durationMin} min`;
      const desc = [
        `Semaine ${week.index}${week.deload ? " (allégée)" : ""} · difficulté visée ${s.targetRpe}/10`,
        ...workoutText(p, week, s),
      ].join("\n");
      lines.push(
        "BEGIN:VEVENT",
        `UID:transio-${cycle}-${week.index}-${s.day}@transio.app`,
        `DTSTAMP:${dtstamp}`,
      );
      if (time) {
        const [h, m] = time.split(":").map(Number);
        const end = h * 60 + m + s.durationMin;
        const endDate = end >= 24 * 60 ? addDays(date, 1) : date;
        const endT = `${String(Math.floor((end % (24 * 60)) / 60)).padStart(2, "0")}${String(end % 60).padStart(2, "0")}00`;
        // Heure « flottante » : l'heure locale de l'agenda de l'utilisateur.
        lines.push(
          `DTSTART:${compact(date)}T${time.replace(":", "")}00`,
          `DTEND:${compact(endDate)}T${endT}`,
        );
      } else {
        lines.push(
          `DTSTART;VALUE=DATE:${compact(date)}`,
          `DTEND;VALUE=DATE:${compact(addDays(date, 1))}`,
        );
      }
      lines.push(
        `SUMMARY:${escape(title)}`,
        `DESCRIPTION:${escape(desc)}`,
        "TRANSP:TRANSPARENT",
        "END:VEVENT",
      );
    }
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
