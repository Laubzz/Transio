import { INTENSITY_LABEL, buildWorkout, formatDuration, target, type Phase } from "@/engine";
import { formatShort, position, sessionDate, type ISODate } from "@/lib/dates";
import { KIND_LABEL, PHASE_LABEL } from "@/lib/labels";
import type { AppState } from "@/lib/state";

const PHASE_TEXT: Record<Phase, string> = {
  base: "Footings faciles et course-marche : les tendons et les mollets s'habituent aux impacts.",
  rythme:
    "Une séance à l'allure objectif par semaine (3 × 1 km, puis 4 × 1 km, 2 × 2 km), sortie longue qui s'allonge, semaines allégées régulières.",
  specifique: "Fractionné court et kilomètres à l'allure objectif : on prépare la course.",
  test: "Semaine allégée, puis le test sur la distance objectif.",
};

const RULES = [
  "En footing, tu dois pouvoir parler. Si ce n'est pas le cas, ralentis.",
  "Pas plus de 10 % de course en plus d'une semaine à l'autre (10 min quand le volume est encore bas).",
  "La sortie longue monte jusqu'à une durée au moins égale à celle de ta course objectif.",
  "Douleur au tendon d'Achille, au tibia ou au genou : tu coupes la séance et tu remplaces par du vélo.",
  "Les jours peuvent bouger, mais jamais deux séances dures d'affilée.",
  "Note chaque séance : le bilan de la semaine s'en sert pour ajuster la suite.",
];

/** Les phases du plan (avec leurs semaines) et les règles du cadre. */
export function PlanFramework({ state }: { state: AppState }) {
  const ranges = (["base", "rythme", "specifique", "test"] as Phase[])
    .map((ph) => {
      const w = state.plan.weeks.filter((x) => x.phase === ph).map((x) => x.index);
      return { ph, from: Math.min(...w), to: Math.max(...w), n: w.length };
    })
    .filter((r) => r.n > 0);
  return (
    <details className="rounded-2xl border border-white/10 bg-card">
      <summary className="cursor-pointer px-5 py-4 font-semibold">
        Les phases et les règles du cadre
      </summary>
      <div className="grid gap-6 border-t border-white/10 p-5 md:grid-cols-2">
        <div className="space-y-3">
          {ranges.map((r) => (
            <div key={r.ph} className="border-l-4 border-white/20 pl-3 text-sm">
              <p className="font-semibold">
                {PHASE_LABEL[r.ph]} · {r.from === r.to ? `S${r.from}` : `S${r.from} à S${r.to}`}
              </p>
              <p className="text-muted">{PHASE_TEXT[r.ph]}</p>
            </div>
          ))}
        </div>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {RULES.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </div>
    </details>
  );
}

/** Tableau des séances de qualité (seuil, fractionné, test) avec leur contenu. */
export function QualitySessions({ state, today }: { state: AppState; today: ISODate }) {
  const p = state.plan.profile;
  const pos = position(state.startDate, today, state.plan.weeks.length);
  const current = pos.status === "en-cours" ? pos.weekIndex : null;
  const rows = state.plan.weeks.flatMap((w) =>
    w.sessions
      .filter((s) => s.kind === "tempo" || s.kind === "fractionne" || s.kind === "test")
      .map((s) => ({ w, s, date: sessionDate(state.startDate, w.index, s.day) })),
  );
  if (!rows.length) return null;
  const dur = (sec: number) => (sec % 60 === 0 ? `${sec / 60} min` : formatDuration(sec));
  return (
    <details className="rounded-2xl border border-white/10 bg-card">
      <summary className="cursor-pointer px-5 py-4 font-semibold">
        Détail des séances de qualité
      </summary>
      <div className="max-h-[32rem] overflow-auto border-t border-white/10">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-card text-muted">
            <tr>
              <th className="px-3 py-2 font-normal">Date</th>
              <th className="px-3 py-2 font-normal">Séance</th>
              <th className="px-3 py-2 font-normal">Contenu</th>
              <th className="px-3 py-2 font-normal">Visé</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ w, s, date }) => (
              <tr
                key={date}
                className={`border-t border-white/5 align-top ${w.index === current ? "bg-target/10" : ""}`}
              >
                <td className="px-3 py-2 whitespace-nowrap">
                  S{w.index} · {formatShort(date)}
                </td>
                <td className="px-3 py-2 font-semibold">{KIND_LABEL[s.kind]}</td>
                <td className="px-3 py-2">
                  {buildWorkout(p, w, s).blocks.map((b, i) => (
                    <div key={i}>
                      {b.label}
                      {b.repeat > 1
                        ? ` : ${b.repeat} × ${b.distanceM ? `${b.distanceM / 1000} km` : dur(b.workSec)}${b.recoverySec ? ` (récup ${dur(b.recoverySec)})` : ""}`
                        : b.workSec
                          ? ` : ${b.distanceM ? `${b.distanceM / 1000} km` : dur(b.workSec)}`
                          : ""}
                      <span className="text-muted">
                        {" "}
                        — {INTENSITY_LABEL[b.intensity]} {target(p, b.intensity)}
                      </span>
                    </div>
                  ))}
                </td>
                <td className="px-3 py-2 tabular-nums">{s.targetRpe}/10</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
