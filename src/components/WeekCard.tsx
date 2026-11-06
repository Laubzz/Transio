import type { Phase, SessionKind, Week } from "@/engine";

const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

const PHASE_LABEL: Record<Phase, string> = {
  base: "Base",
  rythme: "Rythme",
  specifique: "Spécifique",
  test: "Test",
};

const KIND_LABEL: Record<SessionKind, string> = {
  "course-marche": "Course-marche",
  endurance: "Endurance",
  "sortie-longue": "Sortie longue",
  tempo: "Tempo",
  fractionne: "Fractionné",
  test: "Test",
  "sport-origine": "Sport d'origine",
  renfo: "Renfo",
};

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
            <span className="w-9 font-mono text-xs text-muted">{DAYS[s.day]}</span>
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${s.impact ? "bg-target" : "bg-origin"}`}
              aria-hidden
            />
            <span className="flex-1">
              {s.kind === "sport-origine" ? originLabel : KIND_LABEL[s.kind]}
            </span>
            <span className="tabular-nums text-muted">{s.durationMin} min</span>
          </li>
        ))}
      </ul>
    </article>
  );
}
