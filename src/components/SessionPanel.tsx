"use client";

import { useState } from "react";
import type { Session } from "@/engine";
import { formatLong, type ISODate } from "@/lib/dates";
import { KIND_LABEL, RPE_LABEL, sessionLabel } from "@/lib/labels";
import { feedbackKey, isReviewed, recordFeedback, type AppState } from "@/lib/state";
import { saveState } from "@/lib/store";
import { FeedbackForm } from "./FeedbackForm";
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
    <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${s.className}`}>
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

  const save = (next: Parameters<typeof recordFeedback>[3]) => {
    saveState(recordFeedback(state, weekIndex, session.day, next));
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
              {sessionLabel(session.kind, originLabel)}
            </h3>
          </div>
          {!hero && <StatusBadge status={status} />}
        </div>
        <p className={`mt-1 font-semibold ${hero ? "text-lg" : ""}`}>
          {session.durationMin} min · difficulté visée {session.targetRpe}/10
        </p>
        <p className={`mt-2 text-sm ${hero ? "text-night/80" : "text-muted"}`}>
          {session.description}
        </p>
      </div>

      <div
        className={
          hero ? "border border-t-0 border-white/10 bg-card p-5" : "border-t border-white/10 p-4"
        }
      >
        {status === "a-venir" ? (
          <p className="text-sm text-muted">Tu pourras la noter le jour venu.</p>
        ) : editing || (status === "a-noter" && hero && !locked) ? (
          <FeedbackForm
            session={session}
            initial={fb}
            onSave={save}
            onCancel={editing ? () => setEditing(false) : undefined}
          />
        ) : fb ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">
              {fb.done ? (
                <>
                  <strong>Faite</strong> · {fb.rpe}/10 {RPE_LABEL[fb.rpe ?? 0].toLowerCase()}
                  {fb.pain === "gene" && <span className="text-origin"> · gêne</span>}
                  {fb.pain === "douleur" && <span className="text-warn"> · douleur</span>}
                </>
              ) : (
                <strong>Pas faite</strong>
              )}
              {fb.comment && <span className="block text-muted">« {fb.comment} »</span>}
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
