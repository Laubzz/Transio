"use client";

import Link from "next/link";
import { ORIGIN_LABEL, formatDuration, formatPace } from "@/engine";
import { summary } from "@/lib/analytics";
import { SENSATION_LABEL, advice } from "@/lib/coaching";
import { daysBetween, formatLong, sessionDate, type ISODate } from "@/lib/dates";
import { lastSession, runAnalysis, runSummary } from "@/lib/insights";
import { sessionLabel } from "@/lib/labels";
import type { AppState, Sensation } from "@/lib/state";
import { activityPace } from "@/lib/strava";
import { StravaLink } from "./WorkoutDetail";
import { Card } from "./ui";

const ADVICE_STYLE = {
  none: "border-white/10",
  ok: "border-target/40 bg-target/5",
  warn: "border-origin/40 bg-origin/5",
  bad: "border-warn/40 bg-warn/5",
} as const;

/** Conseil pour les prochaines séances, d'après les 3 derniers retours. */
export function AdviceCard({ state }: { state: AppState }) {
  const a = advice(state);
  return (
    <section className={`rounded-2xl border p-4 ${ADVICE_STYLE[a.level]}`}>
      <p className="text-xs text-muted">Conseil pour les prochaines séances</p>
      <p
        className={`mt-1 font-bold ${a.level === "bad" ? "text-warn" : a.level === "warn" ? "text-origin" : a.level === "ok" ? "text-target" : ""}`}
      >
        {a.title}
      </p>
      <p className="mt-1 text-sm text-muted">{a.text}</p>
    </section>
  );
}

/** Dernière séance faite, avec ses données Strava et le retour noté. */
export function LastSessionCard({ state, today }: { state: AppState; today: ISODate }) {
  const origin = ORIGIN_LABEL[state.plan.profile.originSport];
  const l = lastSession(state, today, (s) => sessionLabel(s.kind, origin));
  if (!l) return null;
  const ago = daysBetween(l.date, today);
  const a = l.activity;
  const pace = a ? activityPace(a) : null;
  const stats: [string, string][] = [];
  if (a?.distanceM)
    stats.push([`${(a.distanceM / 1000).toFixed(2).replace(".", ",")} km`, "distance"]);
  if (a) stats.push([formatDuration(a.movingSec), "durée"]);
  if (a?.sport === "course" && pace) stats.push([`${formatPace(pace)} /km`, "allure"]);
  if (a?.avgHr) stats.push([`${a.avgHr}`, "FC moy."]);
  if (a?.elevationM) stats.push([`${a.elevationM} m`, "D+"]);
  return (
    <Card className="p-4">
      <p className="text-xs text-muted">
        Dernière séance · {formatLong(l.date)} (
        {ago === 0 ? "aujourd'hui" : ago === 1 ? "hier" : `il y a ${ago} jours`})
      </p>
      <p className="mt-1 text-lg font-extrabold">{l.title}</p>
      {stats.length > 0 && (
        <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
          {stats.map(([v, k]) => (
            <div key={k}>
              <dt className="text-xs text-muted">{k}</dt>
              <dd className="font-bold tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
      )}
      {l.rpe !== undefined && (
        <p className="mt-2 text-sm">
          Difficulté {l.rpe}/10{l.target !== undefined && ` (visé ${l.target})`}
          {l.sensation && ` · ${SENSATION_LABEL[l.sensation as Sensation]}`}
        </p>
      )}
      {l.comment && <p className="mt-1 text-sm text-muted">« {l.comment} »</p>}
      <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
        {!l.noted && (
          <Link href="/calendrier" className="font-semibold text-origin hover:underline">
            Noter cette séance →
          </Link>
        )}
        {a && <StravaLink id={a.id} />}
      </div>
    </Card>
  );
}

/** Chiffres clés : prochaine séance, séances faites, kilomètres courus. */
export function KeyTiles({ state, today }: { state: AppState; today: ISODate }) {
  const origin = ORIGIN_LABEL[state.plan.profile.originSport];
  const s = summary(state, today);
  const runs = runSummary(runAnalysis(state));
  const next = state.plan.weeks
    .flatMap((w) =>
      w.sessions.map((x) => ({
        w: w.index,
        x,
        date: sessionDate(state.startDate, w.index, x.day),
      })),
    )
    .filter((n) => n.date > today)
    .sort((a, b) => (a.date < b.date ? -1 : 1))[0];
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Card className="p-4">
        <p className="text-xs text-muted">Prochaine séance</p>
        {next ? (
          <>
            <p className="mt-1 font-bold">{sessionLabel(next.x.kind, origin)}</p>
            <p className="text-xs text-muted first-letter:uppercase">
              {formatLong(next.date)} · {next.x.durationMin} min
            </p>
          </>
        ) : (
          <p className="mt-1 font-bold">Plan terminé</p>
        )}
      </Card>
      <Card className="p-4">
        <p className="text-xs text-muted">Séances faites depuis le début</p>
        <p className="mt-1 text-2xl font-extrabold tabular-nums">
          {s.sessionsDone}
          <span className="text-base font-semibold text-muted"> / {s.sessionsDue}</span>
        </p>
        <p className="text-xs text-muted">parmi celles déjà passées</p>
      </Card>
      <Card className="p-4">
        <p className="text-xs text-muted">Km courus depuis le début</p>
        <p className="mt-1 text-2xl font-extrabold tabular-nums">
          {runs.kmSinceStart.toString().replace(".", ",")}
        </p>
        <p className="text-xs text-muted">d&apos;après Strava</p>
      </Card>
    </div>
  );
}
