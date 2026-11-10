"use client";

import Link from "next/link";
import { useState } from "react";
import { ORIGIN_LABEL, plannedLoad, type SessionKind } from "@/engine";
import { summary } from "@/lib/analytics";
import { formatLong, mondayOf, position, type ISODate } from "@/lib/dates";
import { sessionLabel } from "@/lib/labels";
import { overview, trend, type DoneItem } from "@/lib/overview";
import { recoveryAlert, type AppState, type FreeSession } from "@/lib/state";
import { FREE_SPORT_LABEL } from "./FreeSession";
import { LineChart } from "./LineChart";
import { Card, Segmented } from "./ui";

const ZONE_LABEL = {
  inconnue: "À venir",
  "sous-charge": "Sous-charge",
  sure: "Optimal",
  attention: "Attention",
} as const;

const hm = (min: number) => `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")}`;
const fr = (n: number, d = 2) => n.toFixed(d).replace(".", ",");

function Badge({ children, tone = "ok" }: { children: React.ReactNode; tone?: "ok" | "warn" }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
        tone === "warn" ? "bg-origin/10 text-origin" : "bg-target/10 text-target"
      }`}
    >
      {children}
    </span>
  );
}

/** Évolution par rapport à la période d'avant : « ↑ 12 % ». */
function Trend({ cur, prev }: { cur: number; prev: number }) {
  const t = trend(cur, prev);
  if (t === null) return null;
  return (
    <Badge>
      <span aria-hidden>{t >= 0 ? "↑" : "↓"}</span> {Math.abs(t)} %
      <span className="sr-only"> par rapport à la période précédente</span>
    </Badge>
  );
}

function Tile({
  label,
  value,
  unit,
  hint,
  badge,
}: {
  label: string;
  value: string;
  unit?: string;
  hint: string;
  badge?: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col gap-1">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-muted">{label}</p>
        {badge}
      </div>
      <p className="text-3xl font-extrabold tabular-nums">
        {value}
        {unit && <span className="text-sm font-semibold text-muted"> {unit}</span>}
      </p>
      <p className="text-xs text-muted">{hint}</p>
    </Card>
  );
}

const RING = [
  { key: "low", label: "Faible intensité", color: "#c6f24e" },
  { key: "mid", label: "Modérée", color: "#f08a5d" },
  { key: "high", label: "Haute intensité", color: "#7b7fb5" },
] as const;

/** Anneau de répartition du temps par intensité ressentie. */
function IntensityRing({ data }: { data: Record<"low" | "mid" | "high", number> }) {
  const total = data.low + data.mid + data.high;
  const R = 52;
  const C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <Card>
      <h2 className="font-semibold">Équilibre d&apos;intensité</h2>
      <p className="text-xs text-muted">Temps par difficulté ressentie sur la période</p>
      <svg
        viewBox="0 0 140 140"
        className="mx-auto my-4 h-36 w-36"
        role="img"
        aria-label={
          total
            ? RING.map((r) => `${r.label} : ${hm(data[r.key])}`).join(", ")
            : "Pas encore de séance notée"
        }
      >
        <circle cx="70" cy="70" r={R} fill="none" stroke="#e8e9e1" strokeWidth="14" />
        {total > 0 &&
          RING.map((r) => {
            const len = (data[r.key] / total) * C;
            const el = (
              <circle
                key={r.key}
                cx="70"
                cy="70"
                r={R}
                fill="none"
                stroke={r.color}
                strokeWidth="14"
                strokeDasharray={`${len} ${C - len}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 70 70)"
              />
            );
            offset += len;
            return el;
          })}
        <text x="70" y="70" textAnchor="middle" className="fill-ink text-lg font-extrabold">
          {hm(total)}
        </text>
        <text x="70" y="86" textAnchor="middle" className="fill-muted text-[9px]">
          Total
        </text>
      </svg>
      <ul className="space-y-2 text-sm">
        {RING.map((r) => (
          <li key={r.key} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-muted">
              <span className="h-2 w-2 rounded-full" style={{ background: r.color }} aria-hidden />
              {r.label}
            </span>
            <span className="font-semibold tabular-nums">
              {hm(data[r.key])}
              <span className="ml-2 text-xs font-normal text-muted">
                {total ? Math.round((data[r.key] / total) * 100) : 0} %
              </span>
            </span>
          </li>
        ))}
      </ul>
      {total > 0 && (
        <p className="mt-4 rounded-xl bg-target/10 p-3 text-xs">
          {data.low / total >= 0.5
            ? "Bonne répartition : une majorité de temps facile favorise une progression durable."
            : "Peu de temps facile : garde tes footings vraiment lents pour mieux récupérer."}
        </p>
      )}
    </Card>
  );
}

function itemTitle(item: DoneItem, origin: string) {
  return item.free
    ? `Séance libre · ${FREE_SPORT_LABEL[item.kind as FreeSession["sport"]]}`
    : sessionLabel(item.kind as SessionKind, origin);
}

/** Vue d'ensemble : chiffres clés, courbe de charge, intensité et dernières séances. */
export function Overview({ state, today }: { state: AppState; today: ISODate }) {
  const [days, setDays] = useState<7 | 30 | 90>(7);
  const o = overview(state, today, days);
  const s = summary(state, today);
  const origin = ORIGIN_LABEL[state.plan.profile.originSport];
  const pos = position(state.startDate, today, state.plan.weeks.length);
  const week = pos.status === "en-cours" ? state.plan.weeks[pos.weekIndex - 1] : null;
  const monday = mondayOf(today);
  const hrv = state.metrics?.[monday]?.hrv;
  const alert = recoveryAlert(state.metrics ?? {}, monday);
  const span = days === 7 ? "7 jours" : days === 30 ? "30 jours" : "3 mois";

  return (
    <section className="space-y-4" aria-label="Vue d'ensemble">
      <div className="flex justify-end">
        <Segmented
          label="Période"
          value={days}
          onChange={setDays}
          options={[
            { value: 7, label: "7 jours" },
            { value: 30, label: "30 jours" },
            { value: 90, label: "3 mois" },
          ]}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Tile
          label="État de forme"
          value={s.ratio !== null ? fr(s.ratio) : "–"}
          hint={
            s.ratio !== null
              ? "Charge de la semaine dernière ÷ moyenne des 4 dernières"
              : "Calculé après deux semaines terminées"
          }
          badge={<Badge tone={s.zone === "attention" ? "warn" : "ok"}>{ZONE_LABEL[s.zone]}</Badge>}
        />
        <Tile
          label={`Charge sur ${span}`}
          value={String(o.load)}
          unit="UA"
          hint={
            days === 7 && week
              ? `Prévu cette semaine : ${plannedLoad(week)} UA`
              : "Durée × difficulté ressentie"
          }
          badge={<Trend cur={o.load} prev={o.prevLoad} />}
        />
        <Tile
          label="Temps d'entraînement"
          value={hm(o.minutes)}
          hint={`${o.count} séance${o.count > 1 ? "s" : ""} sur ${span}`}
          badge={<Trend cur={o.minutes} prev={o.prevMinutes} />}
        />
        <Tile
          label="Récupération"
          value={hrv ? String(hrv) : "–"}
          unit={hrv ? "ms de VFC" : undefined}
          hint={
            hrv
              ? (alert?.[0] ?? "Stable par rapport à tes 4 dernières semaines")
              : "Saisis ta VFC dans Analyses, onglet Forme"
          }
          badge={
            hrv ? (
              <Badge tone={alert ? "warn" : "ok"}>{alert ? "À surveiller" : "Bonne"}</Badge>
            ) : null
          }
        />
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <LineChart
            title={`Charge d'entraînement sur ${span}`}
            unit="UA"
            note={
              days === 90
                ? "Charge de chaque semaine (durée × difficulté ressentie)."
                : "Charge de chaque jour (durée × difficulté ressentie)."
            }
            rows={o.series.map((d) => ({ label: d.label, values: { load: d.load } }))}
            series={[{ key: "load", label: "Charge réelle", color: "#7cb518" }]}
          />
        </div>
        <IntensityRing data={o.intensity} />
      </div>

      <Card>
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <h2 className="font-semibold">Activités récentes</h2>
            <p className="text-xs text-muted">Tes dernières séances notées</p>
          </div>
          <Link href="/journal" className="text-sm font-semibold hover:underline">
            Voir tout →
          </Link>
        </div>
        {o.recent.length ? (
          <ul className="mt-3 divide-y divide-white/10">
            {o.recent.map((r) => (
              <li
                key={`${r.date}-${r.kind}`}
                className="grid grid-cols-3 gap-x-4 gap-y-1 py-3 text-sm sm:grid-cols-[1fr_6rem_6rem_6rem]"
              >
                <div className="col-span-3 sm:col-span-1">
                  <p className="font-semibold">{itemTitle(r, origin)}</p>
                  <p className="text-xs text-muted first-letter:uppercase">{formatLong(r.date)}</p>
                </div>
                <Stat label="Durée" value={`${r.durationMin} min`} />
                <Stat
                  label="Distance"
                  value={r.activity?.distanceM ? `${fr(r.activity.distanceM / 1000, 1)} km` : "–"}
                />
                <Stat label="Charge" value={`${r.durationMin * r.rpe} UA`} accent />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted">Note ta première séance : elle apparaîtra ici.</p>
        )}
      </Card>
    </section>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <p>
      <span className="block text-xs text-muted">{label}</span>
      <span className={`font-semibold tabular-nums ${accent ? "text-target" : ""}`}>{value}</span>
    </p>
  );
}
