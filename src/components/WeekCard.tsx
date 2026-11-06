import type { Week } from "@/engine";
import { DAYS_SHORT, PHASE_LABEL, sessionLabel } from "@/lib/labels";

export function WeekCard({ week, originLabel }: { week: Week; originLabel: string }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-card p-4">
      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="font-semibold whitespace-nowrap">
          Semaine {week.index}
          <span className="ml-2 text-sm font-normal text-muted">{PHASE_LABEL[week.phase]}</span>
          {week.deload && (
            <span className="ml-2 rounded-full bg-target/15 px-2 py-0.5 text-xs font-medium text-target">
              allégée
            </span>
          )}
        </h3>
        <span className="text-sm whitespace-nowrap text-muted">{week.runMinutes} min course</span>
      </header>
      <ul className="space-y-1.5 text-sm">
        {week.sessions.map((s) => (
          <li key={s.day} className="flex items-center gap-3">
            <span className="w-9 font-mono text-xs text-muted">{DAYS_SHORT[s.day]}</span>
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${s.impact ? "bg-target" : "bg-origin"}`}
              aria-hidden
            />
            <span className="flex-1">{sessionLabel(s.kind, originLabel)}</span>
            <span className="tabular-nums text-muted">{s.durationMin} min</span>
          </li>
        ))}
      </ul>
    </article>
  );
}
