"use client";

import { ORIGIN_LABEL } from "@/engine";
import { journal, strengthRecords } from "@/lib/analytics";
import { formatLong } from "@/lib/dates";
import { RPE_LABEL, sessionLabel } from "@/lib/labels";
import { useAppState } from "@/lib/store";
import { ButtonLink, Card, Kicker } from "./ui";

/** Écran « Journal » : historique des séances notées et records muscu. */
export function Journal() {
  const state = useAppState();
  if (!state) return null;

  const origin = ORIGIN_LABEL[state.plan.profile.originSport];
  const entries = journal(state);
  const records = strengthRecords(state);

  return (
    <div className="space-y-6">
      <header>
        <Kicker>Journal</Kicker>
        <h1 className="mt-2 text-3xl font-extrabold">Tes séances</h1>
      </header>

      {records.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-muted">Records muscu</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {records.slice(0, 3).map((r, i) => (
              <Card key={r.exercise} className="p-4">
                <p className="text-xs text-muted">
                  {i === 0 ? "1er" : `${i + 1}e`} · {r.exercise}
                </p>
                <p className="mt-1 text-2xl font-extrabold tabular-nums">
                  {r.loadKg > 0 ? `${r.loadKg} kg` : "Poids du corps"}
                </p>
                <p className="text-xs text-muted">
                  {r.reps} reps · {formatLong(r.date)}
                </p>
              </Card>
            ))}
          </div>
        </section>
      )}

      {entries.length === 0 ? (
        <Card>
          <p className="font-semibold">Aucune séance notée pour l&apos;instant</p>
          <p className="mt-1 text-sm text-muted">
            Tes retours apparaîtront ici, du plus récent au plus ancien.
          </p>
          <ButtonLink href="/aujourdhui" className="mt-4">
            Voir la séance du jour
          </ButtonLink>
        </Card>
      ) : (
        <ol className="space-y-3">
          {entries.map((e) => {
            const fb = e.feedback;
            return (
              <li key={`${e.weekIndex}-${e.day}`}>
                <Card className="p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-semibold">{sessionLabel(e.kind, origin)}</p>
                    <p className="text-xs text-muted first-letter:uppercase">
                      {formatLong(e.date)} · semaine {e.weekIndex}
                    </p>
                  </div>
                  {fb.done ? (
                    <p className="mt-1 text-sm">
                      {fb.durationMin ?? e.plannedMin} min · {fb.rpe}/10{" "}
                      <span className="text-muted">{RPE_LABEL[fb.rpe ?? 0].toLowerCase()}</span>
                      {fb.pain === "gene" && <span className="text-origin"> · gêne</span>}
                      {fb.pain === "douleur" && <span className="text-warn"> · douleur</span>}
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-muted">Pas faite</p>
                  )}
                  {fb.strength && (
                    <ul className="mt-2 space-y-0.5 text-sm text-muted">
                      {fb.strength.map((r) => (
                        <li key={r.exercise}>
                          {r.exercise} · {r.sets} × {r.reps}
                          {r.loadKg > 0 && ` · ${r.loadKg} kg`}
                        </li>
                      ))}
                    </ul>
                  )}
                  {fb.comment && <p className="mt-2 text-sm text-muted">« {fb.comment} »</p>}
                </Card>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
