"use client";

import { useState } from "react";
import { ORIGIN_LABEL, formatDuration } from "@/engine";
import { journal } from "@/lib/analytics";
import { formatLong } from "@/lib/dates";
import { RPE_LABEL, sessionLabel } from "@/lib/labels";
import { longestStreak, personalBests, records } from "@/lib/records";
import { cycles, type AppState } from "@/lib/state";
import { useAppState } from "@/lib/store";
import { ButtonLink, Card, Kicker, Segmented } from "./ui";

/** Écran « Journal » : les séances notées, et les records. */
export function Journal() {
  const state = useAppState();
  const [tab, setTab] = useState<"seances" | "records">("seances");
  if (!state) return null;

  return (
    <div className="space-y-6">
      <header>
        <Kicker>Journal</Kicker>
        <h1 className="mt-2 text-3xl font-extrabold">
          {tab === "seances" ? "Tes séances" : "Tes records"}
        </h1>
      </header>
      <Segmented
        label="Afficher"
        value={tab}
        onChange={setTab}
        options={[
          { value: "seances", label: "Séances" },
          { value: "records", label: "Records" },
        ]}
      />
      {tab === "seances" ? <Sessions state={state} /> : <Records state={state} />}
    </div>
  );
}

const RANK = ["1er", "2e", "3e"];

function Records({ state }: { state: AppState }) {
  const cats = records(state);
  const streak = longestStreak(state);
  const hasStrava = (state.activities?.length ?? 0) > 0;
  const pbs = personalBests(state);

  return (
    <div className="space-y-4">
      {pbs.length > 0 && (
        <Card className="p-4">
          <h2 className="text-sm font-semibold">Records personnels en course à pied</h2>
          <p className="mt-0.5 text-xs text-muted">
            Tes meilleurs temps sur chaque distance, d&apos;après tes sorties Strava.
          </p>
          <ul className="mt-3 divide-y divide-white/5">
            {pbs.map((pb) => (
              <li key={pb.name} className="py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="w-24 shrink-0 font-semibold whitespace-nowrap">{pb.label}</span>
                  <span className="text-xl font-extrabold tabular-nums">
                    {formatDuration(pb.top[0].timeSec)}
                  </span>
                  <span className="ml-auto text-right text-xs text-muted tabular-nums">
                    {pb.top[0].pace}
                    <br />
                    {formatLong(pb.top[0].date)}
                  </span>
                </div>
                {pb.top.length > 1 && (
                  <p className="mt-1 text-xs text-muted tabular-nums">
                    {pb.top
                      .slice(1)
                      .map(
                        (t, i) =>
                          `${RANK[i + 1]} ${formatDuration(t.timeSec)} (${formatLong(t.date)})`,
                      )
                      .join(" · ")}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {streak.count > 0 && (
        <Card className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="text-xs text-muted">Plus longue série de séances faites d&apos;affilée</p>
            <p className="mt-1 text-3xl font-extrabold tabular-nums">{streak.count}</p>
          </div>
          {streak.until && (
            <p className="text-xs text-muted">jusqu&apos;au {formatLong(streak.until)}</p>
          )}
        </Card>
      )}

      {cats.length === 0 ? (
        <Card>
          <p className="font-semibold">Pas encore de record</p>
          <p className="mt-1 text-sm text-muted">
            Note tes séances ou importe tes sorties Strava : tes meilleures performances
            apparaîtront ici.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {cats.map((c) => (
            <Card key={c.id} className="p-4">
              <h2 className="text-sm font-semibold">{c.title}</h2>
              <ol className="mt-3 space-y-3">
                {c.top.map((e, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span
                      className={`mt-0.5 w-8 shrink-0 rounded-full py-0.5 text-center text-xs font-bold ${
                        i === 0 ? "bg-target text-night" : "bg-white/10 text-muted"
                      }`}
                    >
                      {RANK[i]}
                    </span>
                    <div className="min-w-0">
                      <p className={`font-extrabold tabular-nums ${i === 0 ? "text-xl" : ""}`}>
                        {e.value}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {e.detail} · {formatLong(e.date)}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </Card>
          ))}
        </div>
      )}

      {!hasStrava && (
        <p className="text-xs text-muted">
          Connecte Strava dans ton profil pour des records de distance, d&apos;allure et de
          dénivelé.
        </p>
      )}
    </div>
  );
}

function Sessions({ state }: { state: AppState }) {
  const origin = ORIGIN_LABEL[state.plan.profile.originSport];
  const all = cycles(state).flatMap((c, i, list) =>
    journal({ ...state, ...c }).map((e) => ({ ...e, cycle: list.length - i })),
  );
  const several = (state.history?.length ?? 0) > 0;

  if (all.length === 0) {
    return (
      <Card>
        <p className="font-semibold">Aucune séance notée pour l&apos;instant</p>
        <p className="mt-1 text-sm text-muted">
          Tes retours apparaîtront ici, du plus récent au plus ancien.
        </p>
        <ButtonLink href="/aujourdhui" className="mt-4">
          Voir la séance du jour
        </ButtonLink>
      </Card>
    );
  }

  return (
    <ol className="space-y-3">
      {all.map((e) => {
        const fb = e.feedback;
        return (
          <li key={`${e.cycle}-${e.weekIndex}-${e.day}`}>
            <Card className="p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold">{sessionLabel(e.kind, origin)}</p>
                <p className="text-xs text-muted first-letter:uppercase">
                  {formatLong(e.date)} · {several && `cycle ${e.cycle}, `}semaine {e.weekIndex}
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
  );
}
