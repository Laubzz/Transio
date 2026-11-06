"use client";

import { useState } from "react";
import { saveMetrics } from "@/lib/coaching";
import { addDays, formatShort, mondayOf, type ISODate } from "@/lib/dates";
import { recoveryAlert, type AppState, type WeekMetrics } from "@/lib/state";
import { saveState } from "@/lib/store";
import { LineChart } from "./LineChart";
import { Button, Card } from "./ui";

type NumKey = "vo2max" | "hrv" | "restingHr" | "sleepH" | "maxHr";

const FIELDS: {
  key: NumKey;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  better: "up" | "down" | null;
  color: string;
}[] = [
  {
    key: "vo2max",
    label: "VO2 max",
    unit: "ml/kg/min",
    min: 20,
    max: 90,
    step: 1,
    better: "up",
    color: "#2ee6c5",
  },
  {
    key: "hrv",
    label: "VFC (moyenne des nuits)",
    unit: "ms",
    min: 10,
    max: 250,
    step: 1,
    better: "up",
    color: "#4fb6f0",
  },
  {
    key: "restingHr",
    label: "FC au repos",
    unit: "bpm",
    min: 30,
    max: 100,
    step: 1,
    better: "down",
    color: "#ff7a45",
  },
  {
    key: "sleepH",
    label: "Sommeil moyen",
    unit: "h",
    min: 3,
    max: 12,
    step: 0.1,
    better: "up",
    color: "#a493ff",
  },
  {
    key: "maxHr",
    label: "FC max",
    unit: "bpm",
    min: 140,
    max: 230,
    step: 1,
    better: null,
    color: "#ff8fae",
  },
];

const STATUSES = [
  "Productif",
  "Maintien",
  "Pic de forme",
  "Récupération",
  "Non productif",
  "Surcharge",
  "Désentraînement",
];

/**
 * Métriques de la montre que Strava ne récupère pas, saisies une fois par semaine.
 * Le bilan s'en sert : VFC en baisse ou FC au repos en hausse = pas de hausse de volume.
 */
export function Forme({ state, today }: { state: AppState; today: ISODate }) {
  const metrics = state.metrics ?? {};
  const [monday, setMonday] = useState(mondayOf(today));
  const [form, setForm] = useState<Record<string, string>>(() => toForm(metrics[mondayOf(today)]));
  const [message, setMessage] = useState<string | null>(null);

  const weeks = Array.from({ length: 16 }, (_, i) => addDays(mondayOf(today), -7 * (15 - i)));
  const pick = (m: ISODate) => {
    setMonday(m);
    setForm(toForm(metrics[m]));
    setMessage(null);
  };
  const alert = recoveryAlert(metrics, monday);

  return (
    <>
      <Card>
        <h2 className="font-semibold">Saisie de la semaine</h2>
        <p className="mt-1 text-sm text-muted">
          Valeurs affichées par ta montre (Garmin Connect, Coros, Polar…). Note-les le dimanche
          avant le bilan : une VFC en baisse ou une FC au repos en hausse empêche le plan de monter
          en volume.
        </p>
        <form
          className="mt-4 grid gap-4 sm:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            const m: WeekMetrics = {};
            for (const f of FIELDS) {
              const raw = (form[f.key] ?? "").trim().replace(",", ".");
              if (!raw) continue;
              const n = Number(raw);
              if (!Number.isFinite(n) || n < f.min || n > f.max) {
                setMessage(`${f.label} : valeur entre ${f.min} et ${f.max}.`);
                return;
              }
              m[f.key] = n;
            }
            if (form.status) m.status = form.status;
            saveState(saveMetrics(state, monday, m));
            setMessage("Semaine enregistrée.");
          }}
        >
          <label className="block">
            <span className="mb-1 block text-xs text-muted">Semaine du</span>
            <select value={monday} onChange={(e) => pick(e.target.value)} className={INPUT}>
              {[...weeks].reverse().map((w) => (
                <option key={w} value={w}>
                  {metrics[w] ? "✓ " : ""}
                  {formatShort(w)}
                </option>
              ))}
            </select>
          </label>
          {FIELDS.map((f) => (
            <label key={f.key} className="block">
              <span className="mb-1 block text-xs text-muted">
                {f.label} ({f.unit})
              </span>
              <input
                inputMode="decimal"
                value={form[f.key] ?? ""}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                placeholder={f.unit}
                className={INPUT}
              />
            </label>
          ))}
          <label className="block">
            <span className="mb-1 block text-xs text-muted">État d&apos;entraînement</span>
            <select
              value={form.status ?? ""}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className={INPUT}
            >
              <option value="">–</option>
              {STATUSES.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <div className="flex items-end gap-3 sm:col-span-3">
            <Button type="submit">Enregistrer la semaine</Button>
            {message && <span className="text-sm text-muted">{message}</span>}
          </div>
        </form>
        {alert && (
          <ul className="mt-4 space-y-1 rounded-xl border border-warn/40 bg-warn/10 p-3 text-sm text-warn">
            {alert.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {FIELDS.filter((f) => f.key !== "maxHr").map((f) => {
          const pts = weeks.map((w) => ({
            label: formatShort(w),
            values: { v: metrics[w]?.[f.key] ?? null },
          }));
          return (
            <LineChart
              key={f.key}
              title={f.label}
              unit={f.unit}
              fit
              note={trend(weeks, metrics, f.key, f.unit, f.better)}
              rows={pts}
              series={[{ key: "v", label: f.label, color: f.color }]}
            />
          );
        })}
      </div>
    </>
  );
}

const INPUT =
  "w-full rounded-xl border border-white/15 bg-night px-3 py-2 text-sm focus:border-target focus:outline-none";

function toForm(m: WeekMetrics | undefined): Record<string, string> {
  if (!m) return {};
  return Object.fromEntries(Object.entries(m).map(([k, v]) => [k, String(v).replace(".", ",")]));
}

/** Dernière valeur comparée à la moyenne des semaines précédentes. */
function trend(
  weeks: ISODate[],
  metrics: Record<ISODate, WeekMetrics>,
  key: NumKey,
  unit: string,
  better: "up" | "down" | null,
) {
  const vals = weeks
    .map((w) => metrics[w]?.[key])
    .filter((x): x is number => typeof x === "number");
  if (!vals.length) return "Pas encore de valeur.";
  const last = vals.at(-1)!;
  const prev = vals.slice(-5, -1);
  if (!prev.length) return `Dernière valeur : ${String(last).replace(".", ",")} ${unit}.`;
  const avg = prev.reduce((a, b) => a + b, 0) / prev.length;
  const diff = Math.round((last - avg) * 10) / 10;
  const good = better === null ? null : better === "up" ? diff >= 0 : diff <= 0;
  return `Dernière valeur : ${String(last).replace(".", ",")} ${unit} · ${diff >= 0 ? "+" : ""}${String(diff).replace(".", ",")} par rapport à la moyenne des semaines précédentes${good === null ? "" : good ? " (bon signe)" : " (à surveiller)"}.`;
}
