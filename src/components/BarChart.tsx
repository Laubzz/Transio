"use client";

import { useState } from "react";

export interface BarDatum {
  label: string;
  value: number;
  /** Valeur de référence (prévu), dessinée en contour derrière la barre. */
  reference?: number;
  tooltip: string;
}

/**
 * Histogramme simple en SVG : barres fines arrondies en haut, grille discrète,
 * infobulle au survol ou au toucher, et tableau des données pour l'accessibilité.
 */
export function BarChart({
  data,
  unit,
  title,
  referenceLabel,
  valueLabel,
}: {
  data: BarDatum[];
  unit: string;
  title: string;
  referenceLabel?: string;
  valueLabel: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640;
  const H = 220;
  const pad = { top: 16, right: 8, bottom: 28, left: 40 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const max = Math.max(1, ...data.map((d) => Math.max(d.value, d.reference ?? 0)));
  const nice = niceMax(max);
  const ticks = [0, nice / 2, nice];
  const band = innerW / Math.max(1, data.length);
  const barW = Math.min(24, band * 0.6);
  const y = (v: number) => pad.top + innerH - (v / nice) * innerH;
  const hasRef = data.some((d) => d.reference !== undefined);

  return (
    <figure className="rounded-2xl border border-white/10 bg-card p-4">
      <figcaption className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-semibold">{title}</span>
        {hasRef && (
          <span className="flex gap-4 text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-target" aria-hidden />
              {valueLabel}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm border border-muted" aria-hidden />
              {referenceLabel}
            </span>
          </span>
        )}
      </figcaption>

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
                strokeWidth={1}
              />
              <text
                x={pad.left - 8}
                y={y(t)}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={11}
                fill="#8c96b3"
              >
                {Math.round(t)}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const cx = pad.left + band * i + band / 2;
            const x = cx - barW / 2;
            return (
              <g key={d.label}>
                {d.reference !== undefined && d.reference > 0 && (
                  <path
                    d={barPath(x, y(d.reference), barW, y(0))}
                    fill="none"
                    stroke="#8c96b3"
                    strokeOpacity={0.6}
                    strokeWidth={1}
                  />
                )}
                {d.value > 0 && (
                  <path
                    d={barPath(x + 2, y(d.value), barW - 4, y(0))}
                    fill="#7cb518"
                    opacity={hover === null || hover === i ? 1 : 0.45}
                  />
                )}
                <text
                  x={cx}
                  y={H - 10}
                  textAnchor="middle"
                  fontSize={11}
                  fill={hover === i ? "#1a1c18" : "#8c96b3"}
                >
                  {d.label}
                </text>
                {/* Zone de survol plus large que la barre */}
                <rect
                  x={pad.left + band * i}
                  y={pad.top}
                  width={band}
                  height={innerH + pad.bottom}
                  fill="transparent"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => setHover(hover === i ? null : i)}
                />
              </g>
            );
          })}
        </svg>
        {hover !== null && (
          <div
            role="status"
            className="pointer-events-none absolute top-0 rounded-lg border border-white/15 bg-night px-3 py-2 text-xs shadow-lg"
            style={{
              left: `${((pad.left + band * hover + band / 2) / W) * 100}%`,
              transform: `translateX(${hover > data.length / 2 ? "-100%" : "0"})`,
            }}
          >
            {data[hover].tooltip}
          </div>
        )}
      </div>

      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-xs text-muted">Voir les données</summary>
        <table className="mt-2 w-full text-left text-xs">
          <thead className="text-muted">
            <tr>
              <th className="py-1 font-normal">Semaine</th>
              <th className="py-1 font-normal">{valueLabel}</th>
              {hasRef && <th className="py-1 font-normal">{referenceLabel}</th>}
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.label} className="border-t border-white/5">
                <td className="py-1">{d.label}</td>
                <td className="py-1 tabular-nums">
                  {d.value} {unit}
                </td>
                {hasRef && (
                  <td className="py-1 tabular-nums">
                    {d.reference ?? "–"} {unit}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

/** Barre arrondie (4 px) en haut, carrée sur la ligne de base. */
function barPath(x: number, top: number, w: number, base: number) {
  const r = Math.min(4, w / 2, Math.max(0, base - top));
  return `M${x},${base} V${top + r} Q${x},${top} ${x + r},${top} H${x + w - r} Q${x + w},${top} ${x + w},${top + r} V${base} Z`;
}

function niceMax(v: number) {
  const p = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((m) => m >= v) ?? v;
}
