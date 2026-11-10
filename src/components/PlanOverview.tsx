"use client";

import { useState } from "react";
import { ORIGIN_LABEL, plannedLoad, runMinutesOf } from "@/engine";
import {
  addDays,
  daysBetween,
  formatShort,
  mondayOf,
  sessionDate,
  type ISODate,
} from "@/lib/dates";
import { DAYS_SHORT, KIND_COLOR, PHASE_LABEL, sessionTitle } from "@/lib/labels";
import { objectivesOn } from "@/lib/objectives";
import { feedbackKey, type AppState } from "@/lib/state";
import { Button } from "./ui";

const MONTH = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });
const monthLabel = (first: ISODate) => MONTH.format(new Date(`${first}T12:00:00`));
const firstOfMonth = (d: ISODate) => `${d.slice(0, 7)}-01`;
const nextMonth = (first: ISODate, n: number): ISODate => {
  const [y, m] = first.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
};

/** Vue simplifiée, semaine par semaine : une ligne par semaine du plan. */
export function WeeksOverview({
  state,
  today,
  currentWeek,
  onPick,
}: {
  state: AppState;
  today: ISODate;
  currentWeek: number | null;
  onPick: (weekIndex: number) => void;
}) {
  const origin = ORIGIN_LABEL[state.plan.profile.originSport];
  return (
    <ol className="space-y-2" aria-label="Toutes les semaines du plan">
      {state.plan.weeks.map((w) => {
        const monday = sessionDate(state.startDate, w.index, 0);
        const done = w.sessions.filter((s) => state.feedback[feedbackKey(w.index, s.day)]?.done);
        const race = w.sessions.find((s) => s.objective);
        return (
          <li key={w.index}>
            <button
              type="button"
              onClick={() => onPick(w.index)}
              aria-current={w.index === currentWeek ? "true" : undefined}
              className={`grid w-full grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 rounded-2xl border p-3 text-left transition hover:bg-card-2 sm:grid-cols-[9rem_1fr_auto] ${
                w.index === currentWeek ? "border-target/60 bg-target/5" : "border-white/10 bg-card"
              }`}
            >
              <span>
                <span className="block font-bold">
                  Semaine {w.index}
                  {w.index === currentWeek && <span className="text-target"> · en cours</span>}
                </span>
                <span className="block text-xs text-muted">
                  {formatShort(monday)} – {formatShort(addDays(monday, 6))}
                </span>
              </span>
              <span className="flex items-center gap-1" aria-hidden>
                {DAYS_SHORT.map((label, day) => {
                  const s = w.sessions.find((x) => x.day === day);
                  return (
                    <span
                      key={label}
                      title={
                        s
                          ? `${label} : ${sessionTitle(s, origin)}, ${s.durationMin} min`
                          : `${label} : repos`
                      }
                      className={`h-6 flex-1 rounded-md ${s ? "" : "border border-dashed border-white/10"}`}
                      style={s ? { background: KIND_COLOR[s.kind] } : undefined}
                    />
                  );
                })}
              </span>
              <span className="col-span-2 text-xs text-muted sm:col-span-1 sm:text-right">
                <span className="font-semibold text-ink">
                  {PHASE_LABEL[w.phase]}
                  {w.deload && " · allégée"}
                  {w.edited && " · modifiée"}
                </span>
                <span className="block tabular-nums">
                  {runMinutesOf(w)} min de course · {plannedLoad(w)} UA
                </span>
                <span className="block">
                  {race
                    ? `★ ${race.objective!.label}`
                    : sessionDate(state.startDate, w.index, 0) <= today
                      ? `${done.length}/${w.sessions.length} séances faites`
                      : `${w.sessions.length} séances`}
                </span>
              </span>
              <span className="sr-only">
                {w.sessions
                  .map((s) => `${DAYS_SHORT[s.day]} ${sessionTitle(s, origin)}`)
                  .join(", ")}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/** Vue simplifiée, mois par mois : un calendrier avec les séances de chaque jour. */
export function MonthOverview({
  state,
  today,
  onPick,
}: {
  state: AppState;
  today: ISODate;
  onPick: (weekIndex: number) => void;
}) {
  const origin = ORIGIN_LABEL[state.plan.profile.originSport];
  const total = state.plan.weeks.length;
  const end = addDays(state.startDate, total * 7 - 1);
  const inPlan = today >= state.startDate && today <= end;
  const [month, setMonth] = useState(firstOfMonth(inPlan ? today : state.startDate));
  const firstMonth = firstOfMonth(state.startDate);
  const lastMonth = firstOfMonth(end);

  const gridStart = mondayOf(month);
  const monthEnd = addDays(nextMonth(month, 1), -1);
  const rows = Math.ceil((daysBetween(gridStart, monthEnd) + 1) / 7);
  const weeks = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: 7 }, (_, d) => addDays(gridStart, r * 7 + d)),
  );
  const sessionsOn = (date: ISODate) => {
    const offset = daysBetween(state.startDate, date);
    if (offset < 0 || offset >= total * 7) return null;
    const week = state.plan.weeks[Math.floor(offset / 7)];
    return { week, sessions: week.sessions.filter((s) => s.day === offset % 7) };
  };
  const monthSessions = state.plan.weeks.flatMap((w) =>
    w.sessions.filter((s) => {
      const d = sessionDate(state.startDate, w.index, s.day);
      return d >= month && d <= monthEnd;
    }),
  );

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold first-letter:uppercase">{monthLabel(month)}</h2>
          <p className="text-sm text-muted tabular-nums">
            {monthSessions.length} séances · {runMinutesOf({ sessions: monthSessions })} min de
            course · {plannedLoad({ sessions: monthSessions })} UA prévues
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            className="px-4 py-2"
            disabled={month <= firstMonth}
            onClick={() => setMonth(nextMonth(month, -1))}
          >
            ← Mois préc.
          </Button>
          <Button
            variant="ghost"
            className="px-4 py-2"
            disabled={month >= lastMonth}
            onClick={() => setMonth(nextMonth(month, 1))}
          >
            Mois suiv. →
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted" aria-hidden>
        {DAYS_SHORT.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="space-y-1">
        {weeks.map((days) => (
          <div key={days[0]} className="grid grid-cols-7 gap-1">
            {days.map((date) => {
              const slot = sessionsOn(date);
              const outside = date < month || date > monthEnd;
              const goals = objectivesOn(state, date);
              const body = (
                <>
                  <span
                    className={`text-xs tabular-nums ${date === today ? "font-bold text-target" : "text-muted"}`}
                  >
                    {Number(date.slice(8))}
                  </span>
                  {slot?.sessions.map((s) => (
                    <span
                      key={s.kind + s.day}
                      className="block truncate rounded px-1 py-0.5 text-[10px] leading-tight font-semibold text-night sm:text-xs"
                      style={{ background: KIND_COLOR[s.kind] }}
                    >
                      <span className="hidden sm:inline">{sessionTitle(s, origin)} · </span>
                      {s.durationMin}
                      <span className="hidden sm:inline"> min</span>
                    </span>
                  ))}
                  {goals
                    .filter((g) => !slot?.sessions.some((s) => s.objective?.label === g.label))
                    .map((g) => (
                      <span
                        key={g.id}
                        className="block truncate text-[10px] text-[#ffd166] sm:text-xs"
                      >
                        ★ {g.label}
                      </span>
                    ))}
                </>
              );
              const cls = `flex min-h-16 flex-col gap-0.5 rounded-lg border p-1 text-left ${
                date === today ? "border-target/60" : "border-white/10"
              } ${outside ? "opacity-35" : ""}`;
              return slot ? (
                <button
                  key={date}
                  type="button"
                  onClick={() => onPick(slot.week.index)}
                  aria-label={`${formatShort(date)}, semaine ${slot.week.index} : ${
                    slot.sessions
                      .map((s) => `${sessionTitle(s, origin)} ${s.durationMin} min`)
                      .join(", ") || "repos"
                  }`}
                  className={`${cls} bg-card transition hover:bg-card-2`}
                >
                  {body}
                </button>
              ) : (
                <div key={date} className={cls}>
                  {body}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <p className="text-xs text-muted">Touche un jour pour ouvrir sa semaine en détail.</p>
    </section>
  );
}
