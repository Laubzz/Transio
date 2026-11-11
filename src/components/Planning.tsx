"use client";

import { useState } from "react";
import { ORIGIN_LABEL, plannedLoad, runMinutesOf } from "@/engine";
import { formatShort, position, sessionDate } from "@/lib/dates";
import { periodOn } from "@/lib/coaching";
import { DAYS_SHORT, KIND_COLOR, PHASE_LABEL, sessionLabel, sessionTitle } from "@/lib/labels";
import { objectivesOn } from "@/lib/objectives";
import { isReviewed, pendingReview } from "@/lib/state";
import { useAppState, useToday } from "@/lib/store";
import { CalendarSync } from "./CalendarSync";
import { FREE_SPORT_LABEL, FreeSessionCard, FreeSessionForm } from "./FreeSession";
import { ObjectivesCard } from "./Objectives";
import { AddPlannedForm, SessionActions, type EditNotice } from "./PlanEditor";
import { PlanFramework, QualitySessions } from "./PlanInfo";
import { MonthOverview, WeeksOverview } from "./PlanOverview";
import { SessionPanel, StatusBadge, sessionStatus } from "./SessionPanel";
import { ReviewPrompt, ReviewResult } from "./WeekReview";
import { Button, Kicker, Segmented } from "./ui";

const PHASE_COLOR = {
  base: "bg-ink/30",
  rythme: "bg-ink/55",
  specifique: "bg-ink/75",
  test: "bg-ink",
} as const;

type View = "detail" | "semaines" | "mois";

/** Écran « Calendrier » : frise des semaines, semaine jour par jour, retours et bilan. */
export function Planning() {
  const state = useAppState();
  const today = useToday();
  const [picked, setPicked] = useState<number | null>(null);
  const [openDay, setOpenDay] = useState<number | null>(null);
  const [addDay, setAddDay] = useState<number | null>(null);
  const [planDay, setPlanDay] = useState<number | null>(null);
  const [view, setView] = useState<View>("detail");
  const [notice, setNotice] = useState<EditNotice | null>(null);
  if (!state || !today) return null;

  const { plan, startDate } = state;
  const total = plan.weeks.length;
  const origin = ORIGIN_LABEL[plan.profile.originSport];
  const pos = position(startDate, today, total);
  const currentWeek =
    pos.status === "en-cours" ? pos.weekIndex : pos.status === "avant" ? 1 : total;
  const weekIndex = picked ?? currentWeek;
  const week = plan.weeks[weekIndex - 1];
  const weekEnd = sessionDate(startDate, weekIndex, 6);
  const review = state.reviews.find((r) => r.weekIndex === weekIndex);
  const nextReview = pendingReview(state, pos.status === "termine" ? total + 1 : currentWeek);
  const done = week.sessions.filter(
    (s) =>
      sessionStatus(state, weekIndex, s, sessionDate(startDate, weekIndex, s.day), today) ===
      "faite",
  ).length;

  const go = (w: number) => {
    setPicked(Math.min(total, Math.max(1, w)));
    setOpenDay(null);
    setAddDay(null);
    setPlanDay(null);
    setView("detail");
  };
  const edited = (n: EditNotice) => {
    setNotice(n);
    setOpenDay(null);
    setPlanDay(null);
  };
  const locked = isReviewed(state, weekIndex);

  return (
    <div className="space-y-6">
      <header>
        <Kicker>Calendrier</Kicker>
        <h1 className="mt-2 font-serif text-[1.375rem] font-normal">Ton plan</h1>
      </header>

      <Segmented
        label="Vue du plan"
        value={view}
        onChange={setView}
        options={[
          { value: "detail", label: "Semaine en détail" },
          { value: "semaines", label: "Semaine par semaine" },
          { value: "mois", label: "Mois par mois" },
        ]}
      />

      {notice && (
        <p
          role="status"
          className={`rounded-lg border p-4 text-sm ${
            notice.tone === "warn"
              ? "border-origin/40 bg-origin/10"
              : "border-target/40 bg-target/10"
          }`}
        >
          {notice.text}
        </p>
      )}

      {view === "semaines" && (
        <WeeksOverview
          state={state}
          today={today}
          currentWeek={pos.status === "en-cours" ? pos.weekIndex : null}
          onPick={go}
        />
      )}
      {view === "mois" && <MonthOverview state={state} today={today} onPick={go} />}

      {view === "detail" && (
        <>
          {/* Frise des semaines */}
          <nav aria-label="Semaines du plan" className="flex gap-1">
            {plan.weeks.map((w) => (
              <button
                key={w.index}
                type="button"
                onClick={() => go(w.index)}
                aria-label={`Semaine ${w.index}`}
                aria-current={w.index === weekIndex ? "true" : undefined}
                className="group flex flex-1 flex-col items-center gap-1"
              >
                <span
                  className={`h-2 w-full rounded-full ${PHASE_COLOR[w.phase]} ${
                    w.deload ? "opacity-40" : ""
                  } ${w.index === weekIndex ? "ring-2 ring-ink ring-offset-2 ring-offset-night" : ""}`}
                />
                <span
                  className={`text-[10px] tabular-nums ${
                    w.index === currentWeek && pos.status === "en-cours"
                      ? "font-semibold text-ink"
                      : "text-muted"
                  }`}
                >
                  {w.index}
                </span>
              </button>
            ))}
          </nav>

          <p className="-mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            {(Object.keys(PHASE_COLOR) as (keyof typeof PHASE_COLOR)[]).map((ph) => (
              <span key={ph} className="flex items-center gap-1.5">
                <span className={`h-2 w-4 rounded-full ${PHASE_COLOR[ph]}`} aria-hidden />
                {PHASE_LABEL[ph]}
              </span>
            ))}
            <span>Plus pâle : semaine allégée</span>
          </p>

          <section className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-[0.9375rem] font-medium">
                Semaine {weekIndex}
                <span className="ml-2 text-base font-normal text-muted">
                  {PHASE_LABEL[week.phase]}
                </span>
                {week.deload && (
                  <span className="ml-2 rounded-full bg-ink/10 px-2 py-0.5 text-xs font-medium text-ink">
                    allégée
                  </span>
                )}
              </h2>
              <p className="text-sm text-muted">
                {formatShort(sessionDate(startDate, weekIndex, 0))} – {formatShort(weekEnd)} ·{" "}
                {runMinutesOf(week)} min de course · {plannedLoad(week)} UA prévues · {done}/
                {week.sessions.length} séances faites
                {week.edited && " · modifiée à la main"}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                className="px-4 py-2"
                disabled={weekIndex <= 1}
                onClick={() => go(weekIndex - 1)}
              >
                ← Préc.
              </Button>
              <Button
                variant="ghost"
                className="px-4 py-2"
                disabled={weekIndex >= total}
                onClick={() => go(weekIndex + 1)}
              >
                Suiv. →
              </Button>
            </div>
          </section>

          {review ? (
            <ReviewResult review={review} />
          ) : (
            nextReview === weekIndex && <ReviewPrompt state={state} weekIndex={weekIndex} />
          )}

          <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            {(Object.keys(KIND_COLOR) as (keyof typeof KIND_COLOR)[]).map((k) => (
              <span key={k} className="flex items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 rounded-sm"
                  style={{ background: KIND_COLOR[k] }}
                  aria-hidden
                />
                {sessionLabel(k, origin)}
              </span>
            ))}
            <span className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-sm border border-dashed border-muted"
                aria-hidden
              />
              Séance libre
            </span>
          </p>

          <ol className="grid gap-2 xl:grid-cols-7">
            {DAYS_SHORT.map((label, day) => {
              const s = week.sessions.find((x) => x.day === day);
              const date = sessionDate(startDate, weekIndex, day);
              const isToday = date === today;
              const period = periodOn(state, date);
              const frees = (state.freeSessions ?? []).filter((f) => f.date === date);
              return (
                <li
                  key={day}
                  className={`flex flex-col gap-2 rounded-lg border p-2 xl:min-h-44 ${
                    isToday ? "border-2 border-ink bg-ink/5" : "border-white/10"
                  }`}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-1 px-1 text-xs">
                    <span className={`${isToday ? "font-semibold text-ink" : "text-muted"}`}>
                      {label} {formatShort(date)}
                    </span>
                    {period && (
                      <span
                        className={`font-semibold ${period.busy ? "text-origin" : "text-muted"}`}
                      >
                        {period.label}
                      </span>
                    )}
                  </div>
                  {objectivesOn(state, date).map((o) => (
                    <p key={o.id} className="px-1 text-xs font-semibold text-[#b98a00]">
                      ★ {o.label} ·{" "}
                      {o.priority === "principal" ? "objectif principal" : "objectif secondaire"}
                    </p>
                  ))}
                  {s ? (
                    <button
                      type="button"
                      onClick={() => {
                        setOpenDay(openDay === day ? null : day);
                        setPlanDay(null);
                      }}
                      aria-expanded={openDay === day}
                      className={`flex w-full flex-col gap-1 rounded-lg border-l-4 bg-card p-2.5 text-left text-sm transition hover:bg-card-2 ${
                        openDay === day ? "ring-1 ring-ink/40" : ""
                      }`}
                      style={{ borderLeftColor: KIND_COLOR[s.kind] }}
                    >
                      <span className="font-semibold">{sessionTitle(s, origin)}</span>
                      <span className="text-xs text-muted tabular-nums">
                        {s.durationMin} min · visé {s.targetRpe}/10
                      </span>
                      {s.note && <span className="text-xs text-origin">{s.note}</span>}
                      <span className="mt-1">
                        <StatusBadge status={sessionStatus(state, weekIndex, s, date, today)} />
                      </span>
                    </button>
                  ) : (
                    <>
                      <p className="px-1 text-xs text-muted italic">Repos</p>
                      {!locked && date >= today && (
                        <button
                          type="button"
                          onClick={() => {
                            setPlanDay(planDay === day ? null : day);
                            setOpenDay(null);
                          }}
                          aria-expanded={planDay === day}
                          className="rounded-lg border border-dashed border-white/10 px-2 py-1 text-xs text-muted hover:text-ink"
                        >
                          + Programmer une séance
                        </button>
                      )}
                    </>
                  )}
                  {frees.map((f) => (
                    <p
                      key={f.id}
                      className="rounded-lg border border-dashed border-white/20 p-2 text-xs"
                    >
                      <strong>Libre · {FREE_SPORT_LABEL[f.sport]}</strong>
                      <br />
                      {f.durationMin} min · {f.rpe}/10
                    </p>
                  ))}
                  <button
                    type="button"
                    onClick={() => setAddDay(addDay === day ? null : day)}
                    className="mt-auto rounded-lg border border-dashed border-white/10 px-2 py-1 text-xs text-muted hover:text-ink"
                  >
                    + Séance libre
                  </button>
                </li>
              );
            })}
          </ol>

          {openDay !== null && week.sessions.some((x) => x.day === openDay) && (
            <SessionPanel
              key={`${weekIndex}-${openDay}`}
              state={state}
              weekIndex={weekIndex}
              session={week.sessions.find((x) => x.day === openDay)!}
              date={sessionDate(startDate, weekIndex, openDay)}
              today={today}
              originLabel={origin}
            />
          )}
          {openDay !== null && week.sessions.some((x) => x.day === openDay) && (
            <SessionActions
              key={`edit-${weekIndex}-${openDay}`}
              state={state}
              weekIndex={weekIndex}
              session={week.sessions.find((x) => x.day === openDay)!}
              today={today}
              onDone={edited}
            />
          )}
          {planDay !== null && !week.sessions.some((x) => x.day === planDay) && (
            <AddPlannedForm
              key={`plan-${weekIndex}-${planDay}`}
              state={state}
              weekIndex={weekIndex}
              day={planDay}
              today={today}
              originLabel={origin}
              onDone={edited}
              onCancel={() => setPlanDay(null)}
            />
          )}
          {addDay !== null && (
            <div className="rounded-lg border border-white/10 bg-card p-4">
              <h3 className="mb-4 font-semibold">Nouvelle séance libre</h3>
              <FreeSessionForm
                key={`${weekIndex}-${addDay}`}
                state={state}
                date={sessionDate(startDate, weekIndex, addDay)}
                onDone={() => setAddDay(null)}
              />
            </div>
          )}
          {(state.freeSessions ?? [])
            .filter((f) => f.date >= sessionDate(startDate, weekIndex, 0) && f.date <= weekEnd)
            .map((f) => (
              <FreeSessionCard key={f.id} state={state} fs={f} />
            ))}

          {!isReviewed(state, weekIndex) && weekEnd < today && nextReview !== weekIndex && (
            <p className="text-sm text-muted">
              Le bilan de cette semaine se fera après celui des semaines précédentes.
            </p>
          )}
        </>
      )}

      <ObjectivesCard state={state} today={today} />
      <PlanFramework state={state} />
      <QualitySessions state={state} today={today} />
      <CalendarSync state={state} />
    </div>
  );
}
