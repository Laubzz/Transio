"use client";

import { useRouter } from "next/navigation";
import { GOAL_LABEL, ORIGIN_LABEL } from "@/engine";
import { addDays, formatLong } from "@/lib/dates";
import { INJURY_LABEL } from "@/lib/labels";
import { saveState, useAppState } from "@/lib/store";
import { Button, ButtonLink, Card, Kicker } from "./ui";

/** Écran « Profil » : réponses au questionnaire, résumé du plan, données. */
export function Profile() {
  const router = useRouter();
  const state = useAppState();
  if (!state) return null;

  const p = state.plan.profile;
  const end = addDays(state.startDate, state.plan.weeks.length * 7 - 1);
  const rows: [string, string][] = [
    [
      "Sport d'origine",
      `${ORIGIN_LABEL[p.originSport]} · ${p.yearsPracticed} an${p.yearsPracticed > 1 ? "s" : ""}`,
    ],
    ["Volume habituel", `${p.weeklyHoursPast} h par semaine`],
    [
      "Blessures passées",
      p.injuries.length
        ? p.injuries.map((i) => `${INJURY_LABEL[i.zone]} (${i.year})`).join(", ")
        : "Aucune",
    ],
    ["Objectif", GOAL_LABEL[p.goal]],
    ["Course", `${p.runDaysPerWeek} séances par semaine`],
    ["Renforcement", p.strengthPerWeek ? `${p.strengthPerWeek} par semaine` : "Aucun"],
    [
      "Double sport",
      p.keepOriginSport
        ? `Une séance de ${ORIGIN_LABEL[p.originSport].toLowerCase()} par semaine`
        : "Non",
    ],
  ];

  return (
    <div className="space-y-6">
      <header>
        <Kicker>Profil</Kicker>
        <h1 className="mt-2 text-3xl font-extrabold">Ton profil</h1>
      </header>

      <Card>
        <h2 className="font-semibold">Ton plan</h2>
        <p className="mt-1 text-sm text-muted first-letter:uppercase">
          {state.plan.weeks.length} semaines, du {formatLong(state.startDate)} au {formatLong(end)}.{" "}
          {state.reviews.length} bilan{state.reviews.length > 1 ? "s" : ""} fait
          {state.reviews.length > 1 ? "s" : ""}.
        </p>
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold">Tes réponses au questionnaire</h2>
        <dl className="divide-y divide-white/5 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 py-2">
              <dt className="text-muted">{k}</dt>
              <dd className="font-medium">{v}</dd>
            </div>
          ))}
        </dl>
        <ButtonLink href="/questionnaire" variant="ghost" className="mt-4">
          Refaire le questionnaire
        </ButtonLink>
      </Card>

      <Card>
        <h2 className="font-semibold">Tes données</h2>
        <p className="mt-1 text-sm text-muted">
          Pour l&apos;instant, ton plan et tes retours sont enregistrés uniquement sur cet appareil,
          dans ce navigateur.
        </p>
        <Button
          variant="danger"
          className="mt-4"
          onClick={() => {
            if (window.confirm("Effacer ton plan et tous tes retours ? C'est définitif.")) {
              saveState(null);
              router.push("/");
            }
          }}
        >
          Effacer mes données
        </Button>
      </Card>

      <p className="text-xs text-muted">
        Transio t&apos;accompagne dans l&apos;entraînement et la progressivité. Il ne remplace pas
        un avis médical.
      </p>
    </div>
  );
}
