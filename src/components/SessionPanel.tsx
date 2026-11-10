"use client";

import { useState } from "react";
import { sessionDescription, type Session } from "@/engine";
import { formatLong, type ISODate } from "@/lib/dates";
import { MISS_ACTION_LABEL, MISS_CAUSE_LABEL, SENSATION_LABEL, recordMissed } from "@/lib/coaching";
import { autoReview, submitFeedback } from "@/lib/adapt";
import { KIND_LABEL, RPE_LABEL, sessionTitle } from "@/lib/labels";
import { feedbackKey, isReviewed, matchActivity, recordFeedback, type AppState } from "@/lib/state";
import { saveState } from "@/lib/store";
import { FeedbackForm } from "./FeedbackForm";
import { FitButton } from "./FitButton";
import { ActivitySummary, WorkoutDetail } from "./WorkoutDetail";
import { Button } from "./ui";

export type SessionStatus = "a-venir" | "a-noter" | "faite" | "pas-faite";

export function sessionStatus(
  state: AppState,
  weekIndex: number,
  s: Session,
  date: ISODate,
  today: ISODate,
): SessionStatus {
  const fb = state.feedback[feedbackKey(weekIndex, s.day)];
  if (fb) return fb.done ? "faite" : "pas-faite";
  return date > today ? "a-venir" : "a-noter";
}

export const STATUS_STYLE: Record<SessionStatus, { label: string; className: string }> = {
  "a-venir": { label: "À venir", className: "text-muted border-white/15" },
  "a-noter": { label: "À noter", className: "text-origin border-origin/50" },
  faite: { label: "Faite", className: "text-target border-target/50" },
  "pas-faite": { label: "Pas faite", className: "text-muted border-white/15 line-through" },
};

export function StatusBadge({ status }: { status: SessionStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${s.className}`}
    >
      {s.label}
    </span>
  );
}

/** Une séance avec son détail et son retour (à noter, ou déjà noté et modifiable). */
export function SessionPanel({
  state,
  weekIndex,
  session,
  date,
  today,
  originLabel,
  hero = false,
}: {
  state: AppState;
  weekIndex: number;
  session: Session;
  date: ISODate;
  today: ISODate;
  originLabel: string;
  hero?: boolean;
}) {
  const fb = state.feedback[feedbackKey(weekIndex, session.day)];
  const status = sessionStatus(state, weekIndex, session, date, today);
  const locked = isReviewed(state, weekIndex);
  const [editing, setEditing] = useState(false);
  const week = state.plan.weeks[weekIndex - 1];
  const activity = date <= today ? matchActivity(state, date, session.kind, session.impact) : null;

  const candidates = (state.activities ?? []).filter((a) => a.date === date && a.sport !== "autre");
  const linked = candidates.find((a) => a.id === fb?.activityId) ?? activity;
  const [error, setError] = useState<string | null>(null);

  const save = (next: Parameters<typeof recordFeedback>[3]) => {
    // Le retour est analysé tout de suite : la suite du plan s'adapte.
    saveState(submitFeedback(state, weekIndex, session.day, next, today));
    setEditing(false);
  };

  return (
    <article
      className={`overflow-hidden rounded-2xl border ${hero ? "border-transparent" : "border-white/10 bg-card"}`}
    >
      <div className={hero ? "bg-gradient-to-br from-origin to-target p-5 text-night" : "p-4"}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p
              className={`font-mono text-xs tracking-[0.2em] uppercase ${hero ? "text-night/70" : "text-muted"}`}
            >
              {session.kind === "sport-origine"
                ? KIND_LABEL[session.kind]
                : session.impact
                  ? "Course"
                  : "Renfo"}
              {!hero && ` · ${formatLong(date)}`}
            </p>
            <h3 className={`mt-1 font-extrabold ${hero ? "text-2xl" : "text-lg"}`}>
              {sessionTitle(session, originLabel)}
            </h3>
          </div>
          {!hero && <StatusBadge status={status} />}
        </div>
        <p className={`mt-1 font-semibold ${hero ? "text-lg" : ""}`}>
          {session.durationMin} min · difficulté visée {session.targetRpe}/10
        </p>
        <p className={`mt-2 text-sm ${hero ? "text-night/80" : "text-muted"}`}>
          {sessionDescription(session)}
        </p>
        {session.note && (
          <p
            className={`mt-2 rounded-lg px-2 py-1 text-xs font-semibold ${hero ? "bg-night/15 text-night" : "bg-origin/10 text-origin"}`}
          >
            {session.note}
          </p>
        )}
      </div>

      <details
        open={hero}
        className={`group ${hero ? "border-x border-white/10 bg-card px-5 py-4" : "border-t border-white/10 px-4 py-3"}`}
      >
        <summary className="cursor-pointer text-sm font-semibold text-muted hover:text-ink">
          Détail de la séance
        </summary>
        <div className="mt-3">
          <WorkoutDetail profile={state.plan.profile} week={week} session={session} />
          {session.impact && (
            <FitButton profile={state.plan.profile} week={week} session={session} date={date} />
          )}
        </div>
      </details>

      {linked && (
        <div
          className={
            hero
              ? "border-x border-t border-white/10 bg-card px-5 py-3"
              : "border-t border-white/10 px-4 py-3"
          }
        >
          <ActivitySummary activity={linked} />
        </div>
      )}

      <div className={hero ? "border border-white/10 bg-card p-5" : "border-t border-white/10 p-4"}>
        {status === "a-venir" ? (
          <p className="text-sm text-muted">Tu pourras la noter le jour venu.</p>
        ) : editing || (status === "a-noter" && hero && !locked) ? (
          <>
            <FeedbackForm
              state={state}
              weekIndex={weekIndex}
              session={session}
              today={today}
              candidates={candidates}
              initial={fb}
              onSave={save}
              onMiss={(m) => {
                try {
                  saveState(autoReview(recordMissed(state, weekIndex, session.day, m), today));
                  setEditing(false);
                  setError(null);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
              onCancel={editing ? () => setEditing(false) : undefined}
            />
            {error && <p className="mt-2 text-sm text-warn">{error}</p>}
          </>
        ) : fb ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">
              {fb.done ? (
                <>
                  <strong>Faite</strong> · {fb.durationMin ?? session.durationMin} min · {fb.rpe}/10{" "}
                  {RPE_LABEL[fb.rpe ?? 0].toLowerCase()}
                  {fb.pain === "gene" && <span className="text-origin"> · gêne</span>}
                  {fb.pain === "douleur" && <span className="text-warn"> · douleur</span>}
                  {fb.sensation && (
                    <span className="text-muted">
                      {" "}
                      · {SENSATION_LABEL[fb.sensation].toLowerCase()}
                    </span>
                  )}
                </>
              ) : (
                <>
                  <strong>Pas faite</strong>
                  {fb.missed && (
                    <span className="text-muted">
                      {" "}
                      · {MISS_CAUSE_LABEL[fb.missed.cause]} ·{" "}
                      {MISS_ACTION_LABEL[fb.missed.action].toLowerCase()}
                    </span>
                  )}
                </>
              )}
              {fb.strength?.map((r) => (
                <span key={r.exercise} className="block text-muted">
                  {r.exercise} · {r.sets} × {r.reps}
                  {r.loadKg > 0 && ` · ${r.loadKg} kg`}
                </span>
              ))}
              {fb.comment && <span className="block text-muted">« {fb.comment} »</span>}
              {fb.adapt && (
                <span className="mt-2 block rounded-lg bg-origin/10 px-2 py-1 text-origin">
                  Plan adapté : {fb.adapt.text}
                </span>
              )}
            </p>
            {!locked && (
              <Button variant="ghost" className="px-4 py-2" onClick={() => setEditing(true)}>
                Modifier
              </Button>
            )}
          </div>
        ) : locked ? (
          <p className="text-sm text-muted">Pas notée, comptée comme non faite au bilan.</p>
        ) : (
          <Button className="px-4 py-2" onClick={() => setEditing(true)}>
            Noter ma séance
          </Button>
        )}
      </div>
    </article>
  );
}
