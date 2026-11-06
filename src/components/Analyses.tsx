"use client";

import { summary } from "@/lib/analytics";
import { useAppState, useToday } from "@/lib/store";
import { BarChart } from "./BarChart";
import { Card, Kicker } from "./ui";

const fr = (n: number, d = 2) => n.toFixed(d).replace(".", ",");

const ZONE: Record<string, { label: string; className: string; text: string }> = {
  inconnue: {
    label: "Pas assez de données",
    className: "text-muted",
    text: "Il se calcule à partir de deux semaines terminées.",
  },
  "sous-charge": {
    label: "Sous-charge",
    className: "text-muted",
    text: "La semaine dernière a été plus légère que ta moyenne récente.",
  },
  sure: {
    label: "Zone sûre",
    className: "text-target",
    text: "La semaine dernière suit ta moyenne des 4 dernières semaines.",
  },
  attention: {
    label: "Attention",
    className: "text-warn",
    text: "La semaine dernière a été bien plus chargée que ta moyenne récente.",
  },
};

/** Écran « Analyses » : indicateurs clés et évolution semaine par semaine. */
export function Analyses() {
  const state = useAppState();
  const today = useToday();
  if (!state || !today) return null;

  const s = summary(state, today);
  const zone = ZONE[s.zone];

  return (
    <div className="space-y-6">
      <header>
        <Kicker>Analyses</Kicker>
        <h1 className="mt-2 text-3xl font-extrabold">Ta progression</h1>
        <p className="mt-1 text-muted">
          Calculé à partir de tes retours de séance : durée × difficulté ressentie (charge sRPE).
        </p>
      </header>

      {s.weeks.length === 0 ? (
        <Card>
          <p className="font-semibold">Ton plan n&apos;a pas encore commencé</p>
          <p className="mt-1 text-sm text-muted">
            Les analyses apparaîtront dès tes premières séances notées.
          </p>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile
              label="Séances faites"
              value={`${s.sessionsDone}/${s.sessionsDue}`}
              hint="parmi celles déjà passées"
            />
            <Tile
              label="Course faite"
              value={`${s.runMinutesDone} min`}
              hint="depuis le début du plan"
            />
            <Tile
              label="Charge cette semaine"
              value={s.currentLoad !== null ? `${s.currentLoad} UA` : "–"}
              hint="durée × difficulté"
            />
            <Tile
              label="Ratio aigu / chronique"
              value={s.ratio !== null ? fr(s.ratio) : "–"}
              hint={zone.label}
              hintClass={zone.className}
            />
          </div>
          <p className="-mt-3 text-xs text-muted">{zone.text}</p>

          <BarChart
            title="Minutes de course par semaine"
            unit="min"
            valueLabel="Fait"
            referenceLabel="Prévu"
            data={state.plan.weeks.map((pw) => {
              const w = s.weeks[pw.index - 1];
              return {
                label: `S${pw.index}`,
                value: w?.doneRun ?? 0,
                reference: pw.runMinutes,
                tooltip: w
                  ? `Semaine ${pw.index} : ${w.doneRun} min faites sur ${pw.runMinutes} prévues`
                  : `Semaine ${pw.index} : ${pw.runMinutes} min prévues`,
              };
            })}
          />

          <BarChart
            title="Charge d'entraînement par semaine (UA)"
            unit="UA"
            valueLabel="Charge"
            data={s.weeks.map((w) => ({
              label: `S${w.weekIndex}`,
              value: w.load,
              tooltip: `Semaine ${w.weekIndex} : ${w.load} UA${
                w.monotony !== null ? ` · monotonie ${fr(w.monotony, 1)}` : ""
              }`,
            }))}
          />
        </>
      )}
    </div>
  );
}

function Tile({
  label,
  value,
  hint,
  hintClass = "text-muted",
}: {
  label: string;
  value: string;
  hint: string;
  hintClass?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-card p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-extrabold tabular-nums">{value}</p>
      <p className={`mt-0.5 text-xs ${hintClass}`}>{hint}</p>
    </div>
  );
}
