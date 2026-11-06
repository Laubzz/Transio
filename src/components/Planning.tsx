"use client";

import { useState } from "react";
import { ORIGIN_LABEL } from "@/engine";
import { formatShort, position, sessionDate } from "@/lib/dates";
import { DAYS_SHORT, PHASE_LABEL, sessionLabel } from "@/lib/labels";
import { isReviewed, pendingReview } from "@/lib/state";
import { useAppState, useToday } from "@/lib/store";
import { SessionPanel, StatusBadge, sessionStatus } from "./SessionPanel";
import { ReviewPrompt, ReviewResult } from "./WeekReview";
import { Button, Kicker } from "./ui";

const PHASE_COLOR = {
  base: "bg-origin",
  rythme: "bg-[#c9a77e]",
  specifique: "bg-[#7fd3b5]",
  test: "bg-target",
} as const;

/** Écran « Calendrier » : frise des semaines, semaine jour par jour, retours et bilan. */
export function Planning() {
  const state = useAppState();
  const today = useToday();
  const [picked, setPicked] = useState<number | null>(null);
  const [openDay, setOpenDay] = useState<number | null>(null);
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
  };

  return (
    <div className="space-y-6">
      <header>
        <Kicker>Calendrier</Kicker>
        <h1 className="mt-2 text-3xl font-extrabold">Ton plan</h1>
      </header>

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
                  ? "font-bold text-ink"
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
          <h2 className="text-xl font-bold">
            Semaine {weekIndex}
            <span className="ml-2 text-base font-normal text-muted">{PHASE_LABEL[week.phase]}</span>
            {week.deload && (
              <span className="ml-2 rounded-full bg-target/15 px-2 py-0.5 text-xs font-medium text-target">
                allégée
              </span>
            )}
          </h2>
          <p className="text-sm text-muted">
            {formatShort(sessionDate(startDate, weekIndex, 0))} – {formatShort(weekEnd)} ·{" "}
            {week.runMinutes} min de course · {done}/{week.sessions.length} séances faites
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

      <ol className="space-y-2">
        {DAYS_SHORT.map((label, day) => {
          const s = week.sessions.find((x) => x.day === day);
          const date = sessionDate(startDate, weekIndex, day);
          const isToday = date === today;
          if (!s) {
            return (
              <li key={day} className="flex items-center gap-3 px-4 py-2 text-sm text-muted">
                <span className={`w-10 font-mono text-xs ${isToday ? "font-bold text-ink" : ""}`}>
                  {label}
                </span>
                Repos
              </li>
            );
          }
          if (openDay === day) {
            return (
              <li key={day}>
                <SessionPanel
                  state={state}
                  weekIndex={weekIndex}
                  session={s}
                  date={date}
                  today={today}
                  originLabel={origin}
                />
                <button
                  type="button"
                  onClick={() => setOpenDay(null)}
                  className="mt-1 px-4 text-xs text-muted hover:text-ink"
                >
                  Replier
                </button>
              </li>
            );
          }
          return (
            <li key={day}>
              <button
                type="button"
                onClick={() => setOpenDay(day)}
                className={`flex w-full items-center gap-3 rounded-2xl border bg-card px-4 py-3 text-left transition hover:border-white/25 ${
                  isToday ? "border-target/60" : "border-white/10"
                }`}
              >
                <span
                  className={`w-10 font-mono text-xs ${isToday ? "font-bold text-target" : "text-muted"}`}
                >
                  {label}
                </span>
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${s.impact ? "bg-target" : "bg-origin"}`}
                  aria-hidden
                />
                <span className="flex-1 font-semibold">{sessionLabel(s.kind, origin)}</span>
                <span className="text-sm text-muted tabular-nums">{s.durationMin} min</span>
                <StatusBadge status={sessionStatus(state, weekIndex, s, date, today)} />
              </button>
            </li>
          );
        })}
      </ol>

      {!isReviewed(state, weekIndex) && weekEnd < today && nextReview !== weekIndex && (
        <p className="text-sm text-muted">
          Le bilan de cette semaine se fera après celui des semaines précédentes.
        </p>
      )}
    </div>
  );
}
