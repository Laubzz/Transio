"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  GOAL_LABEL,
  ORIGIN_LABEL,
  formatDuration,
  parseDuration,
  type Goal,
  type StrengthPlace,
} from "@/engine";
import { addDays, daysBetween, formatLong, mondayOf, nextMonday } from "@/lib/dates";
import { GOAL_HINT } from "@/lib/labels";
import { planEnd, resumeMinutes, startNextCycle } from "@/lib/state";
import { saveState, useAppState, useToday } from "@/lib/store";
import { Button, ButtonLink, Card, Kicker, OptionCard, Segmented } from "./ui";

const GOALS = Object.keys(GOAL_LABEL) as Goal[];
const NEXT_HINT: Record<Goal, string> = {
  "5k": "Courir plus vite sur 5 km",
  "10k": "Passer au 10 km, ou l'améliorer",
  semi: "Monter en distance jusqu'au semi",
  trail: "Découvrir les sentiers et le dénivelé",
};

/** « Et ensuite ? » : choix du prochain objectif et génération de la suite du plan. */
export function NextCycle() {
  const router = useRouter();
  const state = useAppState();
  const today = useToday();
  const prev = state?.plan.profile;
  const [goal, setGoal] = useState<Goal | null>(null);
  const [weeks, setWeeks] = useState(12);
  const [runDays, setRunDays] = useState<2 | 3 | 4 | null>(null);
  const [strength, setStrength] = useState<0 | 1 | 2 | null>(null);
  const [place, setPlace] = useState<StrengthPlace | null>(null);
  const [keepOrigin, setKeepOrigin] = useState<boolean | null>(null);
  const [ref5k, setRef5k] = useState<string | null>(null);
  if (!state || !today || !prev) return null;

  const end = planEnd(state);
  const start = nextMonday(addDays(end > today ? end : today, 1));
  const daysLeft = daysBetween(today, end);
  const g = goal ?? (prev.goal === "5k" ? "10k" : prev.goal === "10k" ? "semi" : prev.goal);
  const refText = ref5k ?? (prev.reference5kSec ? formatDuration(prev.reference5kSec) : "");
  const refSec = refText.trim() ? parseDuration(refText) : undefined;
  const refOk = refSec !== null && (refSec === undefined || (refSec >= 12 * 60 && refSec <= 3600));
  const days = runDays ?? (g === "semi" ? Math.max(3, prev.runDaysPerWeek) : prev.runDaysPerWeek);
  const str = strength ?? prev.strengthPerWeek;
  const resume = Math.max(15 * days, resumeMinutes(state.plan));

  const launch = () => {
    saveState(
      startNextCycle(state, {
        goal: g,
        weeks,
        startDate: mondayOf(start),
        runDaysPerWeek: days as 2 | 3 | 4,
        strengthPerWeek: str,
        strengthPlace: place ?? prev.strengthPlace,
        keepOriginSport: keepOrigin ?? prev.keepOriginSport,
        reference5kSec: refSec ?? undefined,
      }),
    );
    router.push("/aujourdhui");
  };

  return (
    <div className="space-y-6">
      <header>
        <Kicker>Et ensuite ?</Kicker>
        <h1 className="mt-2 text-3xl font-extrabold">Ton prochain objectif</h1>
        <p className="mt-2 text-muted">
          {daysLeft >= 0
            ? `Ton plan actuel se termine ${formatLong(end)}.`
            : "Ton plan de transition est terminé."}{" "}
          La suite repart du volume que tu as construit, environ {resume} min de course par semaine,
          sans course-marche.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        {GOALS.map((x) => (
          <OptionCard
            key={x}
            selected={g === x}
            title={GOAL_LABEL[x]}
            hint={NEXT_HINT[x] ?? GOAL_HINT[x]}
            onClick={() => setGoal(x)}
          />
        ))}
      </div>

      <Segmented
        label="Durée"
        value={weeks}
        onChange={setWeeks}
        options={[8, 10, 12, 16, 20].map((w) => ({ value: w, label: `${w} sem.` }))}
      />
      <Segmented
        label="Séances de course par semaine"
        value={days}
        onChange={(v) => setRunDays(v as 2 | 3 | 4)}
        options={[2, 3, 4].map((n) => ({ value: n, label: String(n) }))}
      />
      <Segmented
        label="Séances de renforcement"
        value={str}
        onChange={(v) => setStrength(v as 0 | 1 | 2)}
        options={[0, 1, 2].map((n) => ({ value: n, label: String(n) }))}
      />
      {str > 0 && (
        <Segmented
          label="Où ?"
          value={place ?? prev.strengthPlace ?? "maison"}
          onChange={setPlace}
          options={[
            { value: "maison", label: "À la maison" },
            { value: "salle", label: "En salle de muscu" },
            { value: "les-deux", label: "Les deux" },
          ]}
        />
      )}
      {prev.originSport !== "reprise" && (
        <Segmented
          label={`Garder une séance de ${ORIGIN_LABEL[prev.originSport].toLowerCase()} ?`}
          value={(keepOrigin ?? prev.keepOriginSport) ? "oui" : "non"}
          onChange={(v) => setKeepOrigin(v === "oui")}
          options={[
            { value: "oui", label: "Oui" },
            { value: "non", label: "Non" },
          ]}
        />
      )}

      <label className="block">
        <span className="mb-2 block text-sm font-semibold">
          Ton temps sur 5 km aujourd&apos;hui{" "}
          <span className="font-normal text-muted">(après ton test, si tu l&apos;as fait)</span>
        </span>
        <input
          value={refText}
          onChange={(e) => setRef5k(e.target.value)}
          placeholder="27:30"
          inputMode="numeric"
          className="w-32 rounded-xl border border-white/15 bg-night px-3 py-2.5 focus:border-target focus:outline-none"
        />
        {!refOk && (
          <span className="mt-1 block text-sm text-warn">Écris le temps sous la forme 27:30.</span>
        )}
      </label>

      <Card>
        <p className="text-sm">
          <strong>{GOAL_LABEL[g]}</strong> · {weeks} semaines à partir du {formatLong(start)}.
        </p>
        <p className="mt-1 text-xs text-muted">
          Ton plan actuel et tes retours restent dans ton journal et tes records.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={launch} disabled={!refOk}>
            Lancer la suite
          </Button>
          <ButtonLink href="/aujourdhui" variant="ghost">
            Plus tard
          </ButtonLink>
        </div>
      </Card>
    </div>
  );
}

/** Encart d'invitation vers « Et ensuite ? », à partir de la dernière semaine du plan. */
export function NextCyclePrompt({ finished }: { finished: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-target/40 bg-target/10 p-4">
      <div>
        <p className="font-bold">{finished ? "Et maintenant ?" : "Dernière semaine du plan"}</p>
        <p className="text-sm text-muted">
          Choisis ton prochain objectif : la suite démarre du niveau que tu as atteint.
        </p>
      </div>
      <ButtonLink href="/suite">Préparer la suite</ButtonLink>
    </div>
  );
}
