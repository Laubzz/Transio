"use client";

import type { Decision } from "@/engine";
import { reviewWeek, type AppState, type WeekReview } from "@/lib/state";
import { saveState } from "@/lib/store";
import { Button } from "./ui";

const DECISION: Record<Decision, { title: string; className: string }> = {
  progresser: { title: "On progresse", className: "border-target/40 bg-target/10" },
  maintenir: { title: "On garde le même volume", className: "border-origin/40 bg-origin/10" },
  alleger: { title: "On allège", className: "border-warn/40 bg-warn/10" },
};

/** Résultat d'un bilan de semaine. */
export function ReviewResult({ review }: { review: WeekReview }) {
  const d = DECISION[review.decision];
  return (
    <div className={`rounded-2xl border p-4 ${d.className}`}>
      <p className="font-bold">
        Bilan semaine {review.weekIndex} : {d.title}
      </p>
      <ul className="mt-2 space-y-1 text-sm">
        {review.reasons.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
    </div>
  );
}

/** Invitation à faire le bilan d'une semaine terminée. */
export function ReviewPrompt({ state, weekIndex }: { state: AppState; weekIndex: number }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-origin/40 bg-origin/10 p-4">
      <div>
        <p className="font-bold">La semaine {weekIndex} est terminée</p>
        <p className="text-sm text-muted">
          Le bilan ajuste la suite du plan d&apos;après tes retours. Les séances non notées comptent
          comme non faites.
        </p>
      </div>
      <Button onClick={() => saveState(reviewWeek(state, weekIndex))}>Faire le bilan</Button>
    </div>
  );
}
