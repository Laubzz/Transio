import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-40";
const VARIANT = {
  primary: "bg-ink text-night hover:bg-ink/85",
  ghost: "border border-white/10 bg-night text-ink hover:bg-card-2",
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
      <legend className="mb-2 text-xs text-muted">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const active = o.value === value;
          const tone =
            o.tone === "warn"
              ? "border-warn bg-warn/15 text-warn"
              : o.tone === "origin"
                ? "border-origin bg-origin/15 text-origin"
                : "border-ink bg-ink text-night";
          return (
            <button
              key={String(o.value)}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(o.value)}
              className={`min-w-9 rounded-lg border px-2.5 py-1.5 text-xs transition ${
                active ? tone : "border-white/10 bg-night text-ink hover:bg-card-2"
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
      className={`w-full rounded-lg border p-4 text-left transition ${
        selected
          ? "border-ink bg-card shadow-[inset_0_0_0_1px_var(--color-ink)]"
          : "border-white/10 bg-card hover:border-white/25"
      }`}
    >
      <span className="flex items-center gap-2 font-medium">
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
    <div className={`rounded-lg border border-white/10 bg-card p-5 ${className}`}>{children}</div>
  );
}

/** Petite ligne de contexte au-dessus d'un titre. */
export function Kicker({ children }: { children: ReactNode }) {
  return <p className="text-xs text-muted">{children}</p>;
}

/** Logo : carré noir au T blanc, puis le nom en serif. */
export function Logo({ className = "", href = "/" }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={`flex items-center gap-3 font-serif text-[1.375rem] ${className}`}>
      <span
        aria-hidden
        className="grid h-10 w-10 shrink-0 place-items-center rounded-[22%] bg-ink font-serif text-xl text-night"
      >
        T
      </span>
      Transio
    </Link>
  );
}
