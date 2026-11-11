"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ORIGIN_LABEL, sessionDescription } from "@/engine";
import { daysBetween, formatLong, sessionDate, type ISODate } from "@/lib/dates";
import { KIND_COLOR, sessionTitle } from "@/lib/labels";
import { preparedBy } from "@/lib/objectives";
import { feedbackKey, type AppState } from "@/lib/state";
import { MonthOverview } from "./PlanOverview";
import { Card } from "./ui";

const inDays = (n: number) => (n === 0 ? "aujourd'hui" : n === 1 ? "demain" : `dans ${n} jours`);

/** Première séance du plan à venir (aujourd'hui compris) qui n'est pas encore notée. */
function nextSession(state: AppState, today: ISODate) {
  return state.plan.weeks
    .flatMap((w) =>
      w.sessions.map((s) => ({ s, w, date: sessionDate(state.startDate, w.index, s.day) })),
    )
    .filter((x) => x.date >= today && !state.feedback[feedbackKey(x.w.index, x.s.day)])
    .sort((a, b) => (a.date < b.date ? -1 : 1))[0];
}

/**
 * Accueil : les prochains objectifs et le prochain entraînement, puis le calendrier du mois
 * (prévu, réalisé, ou les deux), comme la page d'accueil de Nolio.
 */
export function HomeAgenda({ state, today }: { state: AppState; today: ISODate }) {
  const router = useRouter();
  const origin = ORIGIN_LABEL[state.plan.profile.originSport];
  const goals = [...(state.objectives ?? [])]
    .filter((o) => o.date >= today)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(0, 3);
  const next = nextSession(state, today);

  return (
    <section className="space-y-4" aria-label="Accueil">
      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-medium">Prochains objectifs</h2>
            <Link
              href="/calendrier"
              aria-label="Ajouter un objectif"
              className="text-lg leading-none text-muted hover:text-ink"
            >
              +
            </Link>
          </div>
          {goals.length ? (
            <ul className="mt-3 space-y-2 text-sm">
              {goals.map((o) => (
                <li key={o.id} className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span>
                    <span className="font-medium">★ {o.label}</span>{" "}
                    <span className="text-muted">
                      · {String(o.distanceKm).replace(".", ",")} km ·{" "}
                      {o.priority === "principal"
                        ? "principal"
                        : `secondaire, prépare ${preparedBy(state, o)}`}
                    </span>
                  </span>
                  <span className="text-xs text-muted first-letter:uppercase">
                    {formatLong(o.date)} · {inDays(daysBetween(today, o.date))}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted">
              Pas d&apos;objectif défini.{" "}
              <Link href="/calendrier" className="text-ink underline underline-offset-2">
                En ajouter un
              </Link>
            </p>
          )}
        </Card>

        <div
          className="rounded-lg border border-l-4 border-white/10 bg-card p-5"
          style={next ? { borderLeftColor: KIND_COLOR[next.s.kind] } : undefined}
        >
          <h2 className="font-medium">Prochain entraînement</h2>
          {next ? (
            <div className="mt-3 text-sm">
              <p className="text-xs text-muted first-letter:uppercase">
                {formatLong(next.date)} · {inDays(daysBetween(today, next.date))}
              </p>
              <p className="mt-1 font-serif text-lg">
                {sessionTitle(next.s, origin)} · {next.s.durationMin} min
              </p>
              <p className="mt-1 text-muted">{sessionDescription(next.s)}</p>
              <Link
                href="/calendrier"
                className="mt-2 inline-block text-ink underline underline-offset-2"
              >
                Voir le détail
              </Link>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted">Plus de séance prévue dans ce plan.</p>
          )}
        </div>
      </div>

      <Card>
        <MonthOverview state={state} today={today} onPick={() => router.push("/calendrier")} />
      </Card>
    </section>
  );
}
