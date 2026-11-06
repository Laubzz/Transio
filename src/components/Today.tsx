"use client";

import Link from "next/link";
import { ORIGIN_LABEL } from "@/engine";
import { formatLong, position, sessionDate } from "@/lib/dates";
import { PHASE_LABEL, sessionLabel } from "@/lib/labels";
import { feedbackKey, pendingReview } from "@/lib/state";
import { useAppState, useToday } from "@/lib/store";
import { NextCyclePrompt } from "./NextCycle";
import { SessionPanel } from "./SessionPanel";
import { ReviewPrompt, ReviewResult } from "./WeekReview";
import { ButtonLink, Card, Kicker } from "./ui";

/** Écran « Aujourd'hui » : la séance du jour, son retour, et le bilan à faire. */
export function Today() {
  const state = useAppState();
  const today = useToday();
  if (!state || !today) return null;

  const { plan, startDate } = state;
  const origin = ORIGIN_LABEL[plan.profile.originSport];
  const pos = position(startDate, today, plan.weeks.length);

  if (pos.status === "avant") {
    const first = plan.weeks[0].sessions[0];
    return (
      <div className="space-y-6">
        <header>
          <Kicker>Bientôt</Kicker>
          <h1 className="mt-2 text-3xl font-extrabold">
            Ton plan commence {formatLong(startDate)}
          </h1>
          <p className="mt-2 text-muted">
            {pos.daysUntilStart === 1 ? "Demain" : `Dans ${pos.daysUntilStart} jours`}. Voici ta
            première séance.
          </p>
        </header>
        <SessionPanel
          state={state}
          weekIndex={1}
          session={first}
          date={sessionDate(startDate, 1, first.day)}
          today={today}
          originLabel={origin}
        />
        <ButtonLink href="/calendrier" variant="ghost">
          Voir tout le plan
        </ButtonLink>
      </div>
    );
  }

  const currentWeek = pos.status === "en-cours" ? pos.weekIndex : plan.weeks.length + 1;
  const pending = pendingReview(state, currentWeek);
  const lastReview = state.reviews.at(-1);

  if (pos.status === "termine") {
    const cycle = plan.profile.cycle ?? 1;
    return (
      <div className="space-y-6">
        <header>
          <Kicker>Plan terminé</Kicker>
          <h1 className="mt-2 text-3xl font-extrabold">
            {cycle === 1 ? "Bravo, la transition est faite" : "Bravo, objectif bouclé"}
          </h1>
          <p className="mt-2 text-muted">
            Tes séances et tes records restent dans ton journal. Choisis la suite pour continuer à
            progresser.
          </p>
        </header>
        {pending !== null && <ReviewPrompt state={state} weekIndex={pending} />}
        <NextCyclePrompt finished />
        <ButtonLink href="/calendrier" variant="ghost">
          Revoir le plan
        </ButtonLink>
      </div>
    );
  }

  const week = plan.weeks[pos.weekIndex - 1];
  const todays = week.sessions.filter((s) => s.day === pos.day);
  const toRate = week.sessions.filter(
    (s) => s.day < pos.day && !state.feedback[feedbackKey(week.index, s.day)],
  ).length;
  const next = week.sessions.find((s) => s.day > pos.day) ?? plan.weeks[pos.weekIndex]?.sessions[0];
  const nextWeekIndex = next && week.sessions.includes(next) ? week.index : week.index + 1;

  return (
    <div className="space-y-6">
      <header>
        <Kicker>
          Semaine {week.index} · {PHASE_LABEL[week.phase]}
          {week.deload && " · allégée"}
        </Kicker>
        <h1 className="mt-2 text-3xl font-extrabold">Aujourd&apos;hui</h1>
        <p className="mt-1 text-muted first-letter:uppercase">{formatLong(today)}</p>
      </header>

      {pending !== null && <ReviewPrompt state={state} weekIndex={pending} />}
      {week.phase === "test" && <NextCyclePrompt finished={false} />}
      {pending === null && lastReview && lastReview.weekIndex === week.index - 1 && (
        <ReviewResult review={lastReview} />
      )}

      {todays.length ? (
        todays.map((s) => (
          <SessionPanel
            key={s.day}
            hero
            state={state}
            weekIndex={week.index}
            session={s}
            date={today}
            today={today}
            originLabel={origin}
          />
        ))
      ) : (
        <Card>
          <h2 className="text-xl font-bold">Jour de repos</h2>
          <p className="mt-1 text-muted">
            La progression se fait aussi pendant la récupération : marche, mobilité, sommeil.
          </p>
        </Card>
      )}

      {toRate > 0 && (
        <Link
          href="/calendrier"
          className="block rounded-2xl border border-origin/40 p-4 text-sm hover:bg-origin/5"
        >
          <strong className="text-origin">
            {toRate} séance{toRate > 1 ? "s" : ""} à noter
          </strong>{" "}
          plus tôt cette semaine →
        </Link>
      )}

      {next && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-muted">Prochaine séance</h2>
          <Card className="flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold">{sessionLabel(next.kind, origin)}</p>
              <p className="text-sm text-muted first-letter:uppercase">
                {formatLong(sessionDate(startDate, nextWeekIndex, next.day))}
              </p>
            </div>
            <p className="text-sm font-semibold whitespace-nowrap">{next.durationMin} min</p>
          </Card>
        </section>
      )}
    </div>
  );
}
