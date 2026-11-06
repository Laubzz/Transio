"use client";

import { useState } from "react";

export interface LineSeries {
  key: string;
  label: string;
  color: string;
  dashed?: boolean;
}

/**
 * Courbe(s) en SVG : 2 px, points sur chaque valeur, grille discrète, réticule et
 * infobulle au survol, tableau des données. Les valeurs manquantes (`null`) coupent la ligne.
 */
export function LineChart({
  title,
  rows,
  series,
  unit,
  fit = false,
  note,
}: {
  title: string;
  rows: { label: string; values: Record<string, number | null> }[];
  series: LineSeries[];
  unit: string;
  /** Échelle resserrée autour des valeurs (au lieu de partir de 0). */
  fit?: boolean;
  note?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640;
  const H = 210;
  const pad = { top: 14, right: 12, bottom: 26, left: 44 };
  const all = rows
    .flatMap((r) => series.map((s) => r.values[s.key]))
    .filter((v): v is number => v != null);
  if (!all.length) {
    return (
      <figure className="rounded-2xl border border-white/10 bg-card p-4">
        <figcaption className="font-semibold">{title}</figcaption>
        <p className="mt-2 text-sm text-muted">{note ?? "Pas encore de données."}</p>
      </figure>
    );
  }
  const max = Math.max(...all);
  const min = Math.min(...all);
  const spread = Math.max(1, max - min);
  const lo = fit ? Math.max(0, min - spread * 0.4) : 0;
  const hi = fit ? max + spread * 0.4 : max * 1.15 || 1;
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const x = (i: number) =>
    pad.left + (rows.length === 1 ? innerW / 2 : (innerW * i) / (rows.length - 1));
  const y = (v: number) => pad.top + innerH - ((v - lo) / (hi - lo)) * innerH;
  const ticks = [lo, (lo + hi) / 2, hi];
  const fmt = (v: number) =>
    (Math.abs(hi) < 10 ? v.toFixed(2) : Math.round(v).toString()).replace(".", ",");
  const step = rows.length > 16 ? Math.ceil(rows.length / 12) : 1;

  return (
    <figure className="rounded-2xl border border-white/10 bg-card p-4">
      <figcaption className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-semibold">{title}</span>
        {series.length > 1 && (
          <span className="flex gap-4 text-xs text-muted">
            {series.map((s) => (
              <span key={s.key} className="flex items-center gap-1.5">
                <span
                  className="inline-block h-0.5 w-4"
                  style={{
                    background: s.dashed
                      ? `repeating-linear-gradient(90deg, ${s.color} 0 4px, transparent 4px 7px)`
                      : s.color,
                  }}
                  aria-hidden
                />
                {s.label}
              </span>
            ))}
          </span>
        )}
      </figcaption>
      {note && <p className="mb-1 text-xs text-muted">{note}</p>}
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={title}>
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={pad.left}
                x2={W - pad.right}
                y1={y(t)}
                y2={y(t)}
                stroke="rgba(255,255,255,0.08)"
              />
              <text
                x={pad.left - 8}
                y={y(t)}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={11}
                fill="#8c96b3"
              >
                {fmt(t)}
              </text>
            </g>
          ))}
          {rows.map((r, i) =>
            i % step === 0 ? (
              <text
                key={r.label}
                x={x(i)}
                y={H - 8}
                textAnchor="middle"
                fontSize={11}
                fill={hover === i ? "#f3f5fa" : "#8c96b3"}
              >
                {r.label}
              </text>
            ) : null,
          )}
          {hover !== null && (
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={pad.top}
              y2={pad.top + innerH}
              stroke="rgba(255,255,255,0.25)"
            />
          )}
          {series.map((s) => {
            const segs: string[] = [];
            let cur = "";
            rows.forEach((r, i) => {
              const v = r.values[s.key];
              if (v == null) {
                if (cur) segs.push(cur);
                cur = "";
              } else cur += `${cur ? "L" : "M"}${x(i)},${y(v)}`;
            });
            if (cur) segs.push(cur);
            return (
              <g key={s.key}>
                {segs.map((d, k) => (
                  <path
                    key={k}
                    d={d}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    strokeDasharray={s.dashed ? "5 4" : undefined}
                  />
                ))}
                {rows.map((r, i) => {
                  const v = r.values[s.key];
                  return v == null ? null : (
                    <circle
                      key={i}
                      cx={x(i)}
                      cy={y(v)}
                      r={s.dashed ? 2.5 : 4}
                      fill={s.dashed ? s.color : "#141b31"}
                      stroke={s.color}
                      strokeWidth={2}
                    />
                  );
                })}
              </g>
            );
          })}
          {rows.map((r, i) => (
            <rect
              key={i}
              x={x(i) - innerW / Math.max(1, rows.length - 1) / 2}
              y={pad.top}
              width={innerW / Math.max(1, rows.length - 1)}
              height={innerH + pad.bottom}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onClick={() => setHover(hover === i ? null : i)}
            />
          ))}
        </svg>
        {hover !== null && (
          <div
            role="status"
            className="pointer-events-none absolute top-0 rounded-lg border border-white/15 bg-night px-3 py-2 text-xs shadow-lg"
            style={{
              left: `${(x(hover) / W) * 100}%`,
              transform: `translateX(${hover > rows.length / 2 ? "-105%" : "5%"})`,
            }}
          >
            <span className="block text-muted">{rows[hover].label}</span>
            {series.map((s) => (
              <span key={s.key} className="block">
                {s.label} :{" "}
                {rows[hover].values[s.key] != null
                  ? `${fmt(rows[hover].values[s.key]!)} ${unit}`
                  : "–"}
              </span>
            ))}
          </div>
        )}
      </div>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-xs text-muted">Voir les données</summary>
        <table className="mt-2 w-full text-left text-xs">
          <thead className="text-muted">
            <tr>
              <th className="py-1 font-normal" />
              {series.map((s) => (
                <th key={s.key} className="py-1 font-normal">
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-t border-white/5">
                <td className="py-1">{r.label}</td>
                {series.map((s) => (
                  <td key={s.key} className="py-1 tabular-nums">
                    {r.values[s.key] != null ? `${fmt(r.values[s.key]!)} ${unit}` : "–"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
