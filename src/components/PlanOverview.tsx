"use client";

import { useState } from "react";
import { ORIGIN_LABEL, plannedLoad, runMinutesOf } from "@/engine";
import {
  addDays,
  daysBetween,
  formatShort,
  isoWeek,
  mondayOf,
  sessionDate,
  type ISODate,
} from "@/lib/dates";
import { DAYS_SHORT, KIND_COLOR, PHASE_LABEL, sessionTitle } from "@/lib/labels";
import { objectivesOn } from "@/lib/objectives";
import { feedbackKey, type Activity, type AppState } from "@/lib/state";
import { FREE_SPORT_LABEL } from "./FreeSession";
import { Segmented } from "./ui";

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
              className={`grid w-full grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 rounded-lg border p-3 text-left transition hover:bg-card-2 sm:grid-cols-[9rem_1fr_auto] ${
                w.index === currentWeek ? "border-2 border-ink bg-ink/5" : "border-white/10 bg-card"
              }`}
            >
              <span>
                <span className="block font-semibold">
                  Semaine {w.index}
                  {w.index === currentWeek && <span className="text-ink"> · en cours</span>}
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

/** Séances affichées : prévues, réalisées, ou les deux. */
export type CalendarShow = "prevu" | "realise" | "both";

const hm = (min: number) =>
  min >= 60 ? `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")}` : `${min} min`;

/**
 * Vue mois : un calendrier avec, pour chaque jour, les séances prévues (en pointillés tant
 * qu'elles ne sont pas faites) et réalisées (pleines), les séances libres et les activités
 * Strava, plus le numéro de semaine et le total prévu / réalisé de chaque semaine.
 */
export function MonthOverview({
  state,
  today,
  onPick,
}: {
  state: AppState;
  today: ISODate;
  onPick: (weekIndex: number) => void;
}) {
  const [show, setShow] = useState<CalendarShow>("both");
  const origin = ORIGIN_LABEL[state.plan.profile.originSport];
  const total = state.plan.weeks.length;
  const end = addDays(state.startDate, total * 7 - 1);
  const inPlan = today >= state.startDate && today <= end;
  const [month, setMonth] = useState(firstOfMonth(inPlan ? today : state.startDate));
  // Activités importées par jour : le calendrier remonte jusqu'à la plus ancienne.
  const byDate = new Map<ISODate, Activity[]>();
  for (const a of state.activities ?? []) byDate.set(a.date, [...(byDate.get(a.date) ?? []), a]);
  const oldest = [...byDate.keys()].reduce((m, d) => (d < m ? d : m), state.startDate);
  const firstMonth = firstOfMonth(oldest);
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

  const monthActs = [...byDate.entries()]
    .filter(([d]) => d >= month && d <= monthEnd)
    .flatMap(([, a]) => a);
  // Une activité Strava liée à une séance notée n'est pas comptée deux fois.
  const linked = new Set<number>([
    ...Object.values(state.feedback).flatMap((f) => (f.activityId ? [f.activityId] : [])),
    ...(state.freeSessions ?? []).flatMap((f) => (f.activityId ? [f.activityId] : [])),
  ]);
  const doneOf = (weekIndex: number, day: number) => state.feedback[feedbackKey(weekIndex, day)];
  const freeOn = (date: ISODate) => (state.freeSessions ?? []).filter((f) => f.date === date);
  const actsOn = (date: ISODate) => (byDate.get(date) ?? []).filter((a) => !linked.has(a.id));
  /** Minutes prévues et réalisées d'une semaine du calendrier. */
  const totals = (days: ISODate[]) => {
    let planned = 0;
    let done = 0;
    for (const date of days) {
      const slot = sessionsOn(date);
      for (const x of slot?.sessions ?? []) {
        planned += x.durationMin;
        const fb = doneOf(slot!.week.index, x.day);
        if (fb?.done) done += fb.durationMin ?? x.durationMin;
      }
      done += freeOn(date).reduce((t, f) => t + f.durationMin, 0);
      done += actsOn(date).reduce((t, a) => t + Math.round(a.movingSec / 60), 0);
    }
    return { planned, done };
  };
  const actText = (a: Activity) =>
    a.distanceM
      ? `${(a.distanceM / 1000).toFixed(1).replace(".", ",")} km`
      : `${Math.round(a.movingSec / 60)} min`;

  return (
    <section className="space-y-3">
      <Segmented
        label="Afficher"
        value={show}
        onChange={setShow}
        options={[
          { value: "prevu", label: "Prévu" },
          { value: "realise", label: "Réalisé" },
          { value: "both", label: "Prévu et réalisé" },
        ]}
      />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <button
          type="button"
          aria-label="Mois précédent"
          disabled={month <= firstMonth}
          onClick={() => setMonth(nextMonth(month, -1))}
          className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-night text-lg disabled:opacity-35"
        >
          ‹
        </button>
        <h2 className="min-w-32 text-center font-serif text-lg first-letter:uppercase">
          {monthLabel(month)}
        </h2>
        <button
          type="button"
          aria-label="Mois suivant"
          disabled={month >= lastMonth}
          onClick={() => setMonth(nextMonth(month, 1))}
          className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-night text-lg disabled:opacity-35"
        >
          ›
        </button>
        <p className="w-full text-sm text-muted tabular-nums sm:ml-2 sm:w-auto">
          {[
            monthSessions.length &&
              `${monthSessions.length} séances · ${runMinutesOf({ sessions: monthSessions })} min de course · ${plannedLoad({ sessions: monthSessions })} UA prévues`,
            monthActs.length &&
              `${monthActs.length} activité${monthActs.length > 1 ? "s" : ""} importée${monthActs.length > 1 ? "s" : ""}, ${Math.round(monthActs.reduce((t, a) => t + a.distanceM, 0) / 1000)} km`,
          ]
            .filter(Boolean)
            .join(" · ") || "Rien ce mois-ci"}
        </p>
      </div>

      <div
        className="grid grid-cols-7 gap-1 sm:grid-cols-[2rem_repeat(7,minmax(0,1fr))_6.5rem] text-center text-xs text-muted"
        aria-hidden
      >
        <span className="hidden sm:block">Sem.</span>
        {DAYS_SHORT.map((d) => (
          <span key={d}>{d}</span>
        ))}
        <span className="hidden sm:block">Total</span>
      </div>
      <div className="space-y-1">
        {weeks.map((days) => (
          <div
            key={days[0]}
            className="grid grid-cols-7 gap-1 sm:grid-cols-[2rem_repeat(7,minmax(0,1fr))_6.5rem]"
          >
            <span className="hidden pt-1 text-center text-xs text-muted tabular-nums sm:block">
              {isoWeek(days[0])}
            </span>
            {days.map((date) => {
              const slot = sessionsOn(date);
              const outside = date < month || date > monthEnd;
              const goals = objectivesOn(state, date);
              const acts = show === "prevu" ? [] : actsOn(date);
              const frees = show === "prevu" ? [] : freeOn(date);
              const planned = (slot?.sessions ?? []).filter(
                (x) => show !== "realise" || doneOf(slot!.week.index, x.day)?.done,
              );
              const actCls =
                "block truncate rounded border border-[#fc4c02]/50 px-1 py-0.5 text-[10px] leading-tight text-[#c43c02] sm:text-xs";
              const body = (
                <>
                  <span
                    className={`text-xs tabular-nums ${date === today ? "font-semibold text-ink" : "text-muted"}`}
                  >
                    {Number(date.slice(8))}
                  </span>
                  {planned.map((s) => {
                    const done = doneOf(slot!.week.index, s.day)?.done;
                    return (
                      <span
                        key={s.kind + s.day}
                        className={`block truncate rounded border px-1 py-0.5 text-[10px] leading-tight font-semibold sm:text-xs ${
                          done ? "text-[#fff]" : "border-dashed text-ink"
                        }`}
                        style={{
                          borderColor: KIND_COLOR[s.kind],
                          background: done ? KIND_COLOR[s.kind] : "transparent",
                        }}
                      >
                        <span className="hidden sm:inline">{sessionTitle(s, origin)} · </span>
                        {s.durationMin}
                        <span className="hidden sm:inline"> min</span>
                      </span>
                    );
                  })}
                  {frees.map((f) => (
                    <span
                      key={f.id}
                      className="block truncate rounded border border-ink/40 px-1 py-0.5 text-[10px] leading-tight sm:text-xs"
                    >
                      <span className="hidden sm:inline">
                        Libre · {FREE_SPORT_LABEL[f.sport]} ·{" "}
                      </span>
                      {f.durationMin}
                      <span className="hidden sm:inline"> min</span>
                    </span>
                  ))}
                  {acts.map((a) => {
                    const text = (
                      <>
                        <span className="hidden sm:inline">{FREE_SPORT_LABEL[a.sport]} · </span>
                        {actText(a)}
                      </>
                    );
                    // Dans le plan, le jour est un bouton : pas de lien à l'intérieur.
                    return slot ? (
                      <span key={a.id} className={actCls}>
                        {text}
                      </span>
                    ) : (
                      <a
                        key={a.id}
                        href={`https://www.strava.com/activities/${a.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={a.name}
                        aria-label={`${a.name}, ${FREE_SPORT_LABEL[a.sport]}, ${actText(a)}, voir sur Strava`}
                        className={`${actCls} hover:bg-[#fc4c02]/10`}
                      >
                        {text}
                      </a>
                    );
                  })}
                  {goals
                    .filter((g) => !slot?.sessions.some((s) => s.objective?.label === g.label))
                    .map((g) => (
                      <span
                        key={g.id}
                        className="block truncate text-[10px] text-[#b98a00] sm:text-xs"
                      >
                        ★ {g.label}
                      </span>
                    ))}
                </>
              );
              const cls = `flex min-h-16 flex-col gap-0.5 rounded-lg border p-1 text-left ${
                date === today ? "border-2 border-ink" : "border-white/10"
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
                  }${acts.length ? `, fait : ${acts.map((a) => `${FREE_SPORT_LABEL[a.sport]} ${actText(a)}`).join(", ")}` : ""}`}
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
            {(() => {
              const t = totals(days);
              return (
                <div className="hidden flex-col justify-center gap-0.5 rounded-lg bg-card-2 p-1.5 text-xs tabular-nums sm:flex">
                  {show !== "realise" && <span className="text-muted">Prévu {hm(t.planned)}</span>}
                  {show !== "prevu" && <span className="font-medium">Fait {hm(t.done)}</span>}
                </div>
              );
            })()}
          </div>
        ))}
      </div>
      <p className="text-xs text-muted">
        Pointillés : séance prévue pas encore faite. Plein : séance faite. Cadre orange : activité
        Strava. Touche un jour du plan pour ouvrir sa semaine en détail.
      </p>
    </section>
  );
}
