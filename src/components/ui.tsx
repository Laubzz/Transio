import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-bold transition " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-target disabled:opacity-40";
const VARIANT = {
  primary: "bg-gradient-to-r from-origin to-target text-night hover:brightness-110",
  ghost: "border border-white/15 text-ink hover:bg-white/5",
  danger: "border border-warn/40 text-warn hover:bg-warn/10",
};
type Variant = keyof typeof VARIANT;

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: Variant }) {
  return <button type="button" className={`${BASE} ${VARIANT[variant]} ${className}`} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={`${BASE} ${VARIANT[variant]} ${className}`} {...props} />;
}

/** Choix exclusif sous forme de boutons côte à côte. */
export function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; tone?: "warn" | "origin" }[];
  onChange: (v: T) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const active = o.value === value;
          const tone =
            o.tone === "warn"
              ? "border-warn bg-warn/15 text-warn"
              : o.tone === "origin"
                ? "border-origin bg-origin/15 text-origin"
                : "border-target bg-target/15 text-target";
          return (
            <button
              key={String(o.value)}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(o.value)}
              className={`min-w-14 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                active ? tone : "border-white/15 text-muted hover:text-ink"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Grande carte de choix (sport, objectif). */
export function OptionCard({
  selected,
  title,
  hint,
  badge,
  onClick,
}: {
  selected: boolean;
  title: string;
  hint: string;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`w-full rounded-2xl border p-4 text-left transition ${
        selected ? "border-target bg-target/10" : "border-white/10 bg-card hover:border-white/25"
      }`}
    >
      <span className="flex items-center gap-2 font-semibold">
        {title}
        {badge && (
          <span className="rounded-full bg-origin/15 px-2 py-0.5 text-xs text-origin">{badge}</span>
        )}
      </span>
      <span className="mt-1 block text-sm text-muted">{hint}</span>
    </button>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-card p-5 ${className}`}>{children}</div>
  );
}

export function Kicker({ children }: { children: ReactNode }) {
  return <p className="font-mono text-xs tracking-[0.25em] text-target uppercase">{children}</p>;
}
