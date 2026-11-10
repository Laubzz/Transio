"use client";

import { useState } from "react";
import { ORIGIN_LABEL, formatPace, formatPaceRange, runMinutesOf } from "@/engine";
import { summary } from "@/lib/analytics";
import { formatShort, type ISODate } from "@/lib/dates";
import { formByWeek } from "@/lib/form";
import { knownMaxHr, oneRepMax, runAnalysis, runSummary, weeklyRunMetrics } from "@/lib/insights";
import { sessionLabel } from "@/lib/labels";
import type { AppState } from "@/lib/state";
import { useAppState, useToday } from "@/lib/store";
import { BarChart } from "./BarChart";
import { Forme } from "./Forme";
import { LineChart } from "./LineChart";
import { Card, Kicker, Segmented } from "./ui";

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
type Tab = "charge" | "courses" | "force" | "forme";

export function Analyses() {
  const state = useAppState();
  const today = useToday();
  const [tab, setTab] = useState<Tab>("charge");
  if (!state || !today) return null;

  const s = summary(state, today);

  return (
    <div className="space-y-6">
      <header>
        <Kicker>Analyses</Kicker>
        <h1 className="mt-2 text-3xl font-extrabold">Ta progression</h1>
        <p className="mt-1 text-muted">
          Calculé à partir de tes retours de séance (durée × difficulté ressentie) et de tes
          activités Strava.
        </p>
      </header>
      <Segmented
        label="Afficher"
        value={tab}
        onChange={setTab}
        options={[
          { value: "charge", label: "Charge" },
          { value: "courses", label: "Courses" },
          { value: "force", label: "Force" },
          { value: "forme", label: "Forme" },
        ]}
      />

      {tab === "forme" ? (
        <Forme state={state} today={today} />
      ) : tab === "force" ? (
        <Force state={state} />
      ) : s.weeks.length === 0 ? (
        <>
          <Card>
            <p className="font-semibold">Ton plan n&apos;a pas encore commencé</p>
            <p className="mt-1 text-sm text-muted">
              Les analyses apparaîtront dès tes premières séances notées.
            </p>
          </Card>
          {tab === "charge" && <FormChart state={state} today={today} currentWeek={null} />}
        </>
      ) : tab === "charge" ? (
        <Charge state={state} today={today} />
      ) : (
        <Courses state={state} />
      )}
    </div>
  );
}

/** Courbes de forme : réalisé jusqu'à aujourd'hui, projeté ensuite d'après les séances prévues. */
function FormChart({
  state,
  today,
  currentWeek,
}: {
  state: AppState;
  today: ISODate;
  currentWeek: number | null;
}) {
  return (
    <LineChart
      title="Courbes de forme (réalisé, puis projeté d'après le plan)"
      unit="UA"
      note={`Condition : charge moyenne sur 6 semaines. Fatigue : charge moyenne sur 1 semaine. Fraîcheur : condition moins fatigue. ${
        currentWeek
          ? `Jusqu'à la semaine ${currentWeek}, les courbes suivent tes séances notées ; ensuite, elles`
          : "Les courbes"
      } suivent les séances prévues et se recalculent dès que tu modifies le plan.`}
      rows={formByWeek(state, today).map((w) => ({
        label: `S${w.weekIndex}`,
        values: { fitness: w.fitness, fatigue: w.fatigue, form: w.form },
      }))}
      series={[
        { key: "fitness", label: "Condition", color: "#2ee6c5" },
        { key: "fatigue", label: "Fatigue", color: "#ff7a45" },
        { key: "form", label: "Fraîcheur", color: "#4fb6f0", dashed: true },
      ]}
    />
  );
}

function Charge({ state, today }: { state: AppState; today: ISODate }) {
  const s = summary(state, today);
  const zone = ZONE[s.zone];
  const cur = s.weeks.at(-1);
  return (
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
          hint={cur ? `prévu ${cur.plannedLoad} UA` : "durée × difficulté"}
        />
        <Tile
          label="Ratio aigu / chronique"
          value={s.ratio !== null ? fr(s.ratio) : "–"}
          hint={zone.label}
          hintClass={zone.className}
        />
      </div>
      <p className="-mt-3 text-xs text-muted">
        {zone.text} Entre 0,8 et 1,3 tu es dans la zone sûre ; au-dessus de 1,5, le risque de
        blessure grimpe.
      </p>

      <BarChart
        title="Charge réalisée et charge prévue (UA)"
        unit="UA"
        valueLabel="Réalisée"
        referenceLabel="Prévue"
        data={state.plan.weeks.map((pw) => {
          const w = s.weeks[pw.index - 1];
          const planned = pw.sessions.reduce((a, x) => a + x.durationMin * x.targetRpe, 0);
          return {
            label: `S${pw.index}`,
            value: w?.load ?? 0,
            reference: planned,
            tooltip: `Semaine ${pw.index} : ${w ? `${w.load} UA réalisées sur ` : ""}${planned} UA prévues`,
          };
        })}
      />

      <FormChart state={state} today={today} currentWeek={cur?.weekIndex ?? null} />

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
            reference: runMinutesOf(pw),
            tooltip: w
              ? `Semaine ${pw.index} : ${w.doneRun} min faites sur ${runMinutesOf(pw)} prévues`
              : `Semaine ${pw.index} : ${runMinutesOf(pw)} min prévues`,
          };
        })}
      />

      <BarChart
        title="Séances par semaine"
        unit="séances"
        valueLabel="Faites"
        referenceLabel="Prévues"
        data={s.weeks.map((w) => ({
          label: `S${w.weekIndex}`,
          value: w.done + w.free,
          reference: w.planned,
          tooltip: `Semaine ${w.weekIndex} : ${w.done} faites sur ${w.planned} prévues${w.free ? ` + ${w.free} libre${w.free > 1 ? "s" : ""}` : ""}`,
        }))}
      />

      <LineChart
        title="Monotonie de la semaine"
        unit=""
        fit
        note="Charge moyenne par jour ÷ écart-type sur les 7 jours. Au-dessus de 2, les séances se ressemblent trop en intensité : la fatigue s'accumule. La contrainte (charge × monotonie) est dans le tableau."
        rows={s.weeks.map((w) => ({
          label: `S${w.weekIndex}`,
          values: {
            mono: w.monotony !== null ? Math.round(w.monotony * 100) / 100 : null,
            strain: w.strain,
          },
        }))}
        series={[{ key: "mono", label: "Monotonie", color: "#4fb6f0" }]}
      />
    </>
  );
}

function Courses({ state }: { state: AppState }) {
  const rows = runAnalysis(state);
  const r = runSummary(rows);
  const m = weeklyRunMetrics(state);
  const hrMax = knownMaxHr(state);
  const verdictClass = (v: string) =>
    v === "Dans la cible"
      ? "text-target"
      : v === "Trop vite"
        ? "text-warn"
        : v === "Plus lent que prévu"
          ? "text-origin"
          : "text-muted";
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile
          label="Km courus"
          value={r.kmSinceStart.toString().replace(".", ",")}
          hint="depuis le début du plan"
        />
        <Tile
          label="Sortie la plus longue"
          value={r.longestKm !== null ? `${String(r.longestKm).replace(".", ",")} km` : "–"}
          hint="depuis le début du plan"
        />
        <Tile
          label="Allure moyenne en footing"
          value={r.easyPace ? `${formatPace(r.easyPace)}` : "–"}
          hint="/km, sorties faciles"
        />
        <Tile
          label="Footings dans la zone facile"
          value={`${r.easyInTarget}/${r.easyTotal}`}
          hint="d'après ton allure d'endurance"
        />
      </div>

      <section className="rounded-2xl border border-white/10 bg-card p-4">
        <h2 className="font-semibold">Course par course</h2>
        <p className="mt-1 text-xs text-muted">
          Tes courses Strava rapprochées du plan. Le verdict compare l&apos;allure des sorties
          faciles à ta zone d&apos;endurance
          {state.plan.profile.reference5kSec
            ? ""
            : " (ajoute ton temps sur 5 km dans le profil pour l'activer)"}
          .
        </p>
        {rows.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Aucune course Strava depuis le début du plan.</p>
        ) : (
          <div className="mt-3 max-h-[28rem] overflow-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-card text-muted">
                <tr>
                  <th className="py-2 pr-2 font-normal">Date</th>
                  <th className="py-2 pr-2 font-normal">Séance prévue</th>
                  <th className="py-2 pr-2 font-normal">Km</th>
                  <th className="py-2 pr-2 font-normal">Allure</th>
                  <th className="hidden py-2 pr-2 font-normal sm:table-cell">Cible</th>
                  <th className="hidden py-2 pr-2 font-normal sm:table-cell">FC</th>
                  <th className="py-2 font-normal">Verdict</th>
                </tr>
              </thead>
              <tbody>
                {[...rows].reverse().map((x) => (
                  <tr key={x.activity.id} className="border-t border-white/5">
                    <td className="py-2 pr-2 whitespace-nowrap">{formatShort(x.activity.date)}</td>
                    <td className="py-2 pr-2">
                      {x.planned
                        ? sessionLabel(x.planned.kind, ORIGIN_LABEL[state.plan.profile.originSport])
                        : "Hors plan"}
                    </td>
                    <td className="py-2 pr-2 tabular-nums">
                      {(x.activity.distanceM / 1000).toFixed(1).replace(".", ",")}
                    </td>
                    <td className="py-2 pr-2 tabular-nums">{x.pace ? formatPace(x.pace) : "–"}</td>
                    <td className="hidden py-2 pr-2 tabular-nums sm:table-cell">
                      {x.target ? formatPaceRange(x.target) : "–"}
                    </td>
                    <td className="hidden py-2 pr-2 tabular-nums sm:table-cell">
                      {x.activity.avgHr ?? "–"}
                    </td>
                    <td className={`py-2 font-semibold ${verdictClass(x.verdict)}`}>{x.verdict}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <LineChart
        title="Efficacité aérobie (mètres par battement)"
        unit="m/batt."
        fit
        note="Vitesse ÷ FC moyenne sur tes sorties faciles. Si ça monte, tu cours plus vite pour le même effort : ta base progresse."
        rows={m.map((w) => ({ label: `S${w.weekIndex}`, values: { ef: w.efficiency } }))}
        series={[{ key: "ef", label: "Efficacité", color: "#2ee6c5" }]}
      />
      <LineChart
        title="Cadence (pas par minute)"
        unit="pas/min"
        fit
        note="Sous 165, la foulée est souvent trop longue et charge tibias et genoux ; vise 170 à 180 en footing, sans forcer."
        rows={m.map((w) => ({ label: `S${w.weekIndex}`, values: { cad: w.cadence } }))}
        series={[{ key: "cad", label: "Cadence", color: "#4fb6f0" }]}
      />
      <BarChart
        title="Répartition facile / intense (minutes)"
        unit="min"
        valueLabel="Facile"
        referenceLabel="Total"
        data={m
          .filter((w) => w.easyMin + w.hardMin > 0)
          .map((w) => ({
            label: `S${w.weekIndex}`,
            value: w.easyMin,
            reference: w.easyMin + w.hardMin,
            tooltip: `Semaine ${w.weekIndex} : ${w.easyMin} min faciles, ${w.hardMin} min intenses (${w.easyShare} % de facile)`,
          }))}
      />
      <p className="-mt-3 text-xs text-muted">
        Une sortie compte comme facile quand sa FC moyenne reste sous 80 % de ta FC max
        {hrMax ? ` (${hrMax} bpm)` : ""}. La cible est autour de 80 % de facile. Approximation à la
        sortie : le détail seconde par seconde n&apos;est pas importé.
      </p>
    </>
  );
}

function Force({ state }: { state: AppState }) {
  const series = oneRepMax(state);
  const [picked, setPicked] = useState<string | null>(null);
  if (!series.length) {
    return (
      <Card>
        <p className="font-semibold">Pas encore de charge notée</p>
        <p className="mt-1 text-sm text-muted">
          Le 1RM estimé apparaîtra dès ta première séance de renfo notée avec des charges.
        </p>
      </Card>
    );
  }
  const cur = series.find((x) => x.exercise === picked) ?? series[0];
  const first = cur.points[0].oneRm;
  const last = cur.points.at(-1)!.oneRm;
  return (
    <>
      <label className="block max-w-sm">
        <span className="mb-2 block text-sm font-semibold">Exercice</span>
        <select
          value={cur.exercise}
          onChange={(e) => setPicked(e.target.value)}
          className="w-full rounded-xl border border-white/15 bg-night px-3 py-2 text-sm focus:border-target focus:outline-none"
        >
          {series.map((x) => (
            <option key={x.exercise} value={x.exercise}>
              {x.exercise} ({x.points.length} séance{x.points.length > 1 ? "s" : ""})
            </option>
          ))}
        </select>
      </label>
      <p className="text-sm">
        {cur.points.length > 1
          ? `Dernier 1RM estimé : ${fr(last, 1)} kg · ${last >= first ? "+" : ""}${fr(last - first, 1)} kg depuis le ${formatShort(cur.points[0].date)}`
          : `1RM estimé : ${fr(last, 1)} kg`}
      </p>
      <LineChart
        title={`1RM estimé · ${cur.exercise}`}
        unit="kg"
        fit
        note="Charge maximale théorique sur une répétition, estimée à partir de tes séries (formule d'Epley : charge × (1 + reps ÷ 30))."
        rows={cur.points.map((p) => ({ label: formatShort(p.date), values: { rm: p.oneRm } }))}
        series={[{ key: "rm", label: "1RM estimé", color: "#a493ff" }]}
      />
    </>
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
