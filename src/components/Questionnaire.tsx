"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  GOAL_LABEL,
  ORIGIN_LABEL,
  type Goal,
  type InjuryZone,
  type OriginSport,
  type Profile,
  formatDuration,
  parseDuration,
} from "@/engine";
import { daysBetween, mondayOf, nextMonday } from "@/lib/dates";
import { GOAL_HINT, INJURY_LABEL, ORIGIN_HINT } from "@/lib/labels";
import { createState } from "@/lib/state";
import { saveState, useAppState, useToday } from "@/lib/store";
import { useAccount } from "@/lib/sync";
import { StrengthQuestions, maxStrength, type StrengthChoice } from "./StrengthQuestions";
import { Button, ButtonLink, Kicker, OptionCard, Segmented } from "./ui";

const STEPS = ["Ton sport", "Ton corps", "Ton objectif", "Ta semaine"] as const;
const SPORTS = Object.keys(ORIGIN_LABEL) as OriginSport[];
const GOALS = Object.keys(GOAL_LABEL) as Goal[];
const ZONES = Object.keys(INJURY_LABEL) as InjuryZone[];
const WEEKS = [8, 10, 12, 16, 20];

const inputClass =
  "w-full rounded-xl border border-white/15 bg-night px-3 py-2.5 focus:border-target focus:outline-none";

/** Questionnaire de départ en 4 étapes ; génère et enregistre le plan à la fin. */
export function Questionnaire() {
  const router = useRouter();
  const today = useToday();
  const existing = useAppState();
  const [step, setStep] = useState(0);
  const [origin, setOrigin] = useState<OriginSport>("velo");
  const [years, setYears] = useState(3);
  const [hours, setHours] = useState(6);
  const [injuries, setInjuries] = useState<Partial<Record<InjuryZone, number>>>({});
  const [goal, setGoal] = useState<Goal>("10k");
  const [weeks, setWeeks] = useState(12);
  const [start, setStart] = useState<string | null>(null);
  const [runDays, setRunDays] = useState<2 | 3 | 4>(3);
  const [keepOrigin, setKeepOrigin] = useState(true);
  const [strength, setStrength] = useState<StrengthChoice>({
    haut: 0,
    bas: 1,
    mobility: false,
    place: "maison",
  });
  const [ref5k, setRef5k] = useState("");
  const account = useAccount();

  if (!today || account.auth === "loading") return null;
  if (account.auth === "signed-out") {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Crée d&apos;abord ton compte</h1>
        <p className="mt-2 text-muted">
          Ton plan sera enregistré dans ton compte et disponible sur tous tes appareils.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <ButtonLink href="/inscription">Créer un compte</ButtonLink>
          <ButtonLink href="/connexion" variant="ghost">
            Se connecter
          </ButtonLink>
        </div>
      </div>
    );
  }
  const ref5kSec = ref5k.trim() ? parseDuration(ref5k) : undefined;
  const ref5kOk =
    ref5kSec !== null && (ref5kSec === undefined || (ref5kSec >= 12 * 60 && ref5kSec <= 60 * 60));
  const year = Number(today.slice(0, 4));
  const startDate = start ?? nextMonday(today);
  const startOk = /^\d{4}-\d{2}-\d{2}$/.test(startDate) && daysBetween(today, startDate) >= -6;

  const keepsOrigin = origin !== "reprise" && keepOrigin;
  const strengthMax = maxStrength(runDays, keepsOrigin);
  const strengthOk = strength.haut + strength.bas <= strengthMax;

  const toggleInjury = (z: InjuryZone) =>
    setInjuries((cur) => {
      const next = { ...cur };
      if (z in next) delete next[z];
      else next[z] = year - 1;
      return next;
    });

  const finish = () => {
    const profile: Profile = {
      originSport: origin,
      yearsPracticed: years,
      weeklyHoursPast: hours,
      injuries: Object.entries(injuries).map(([zone, y]) => ({
        zone: zone as InjuryZone,
        year: y!,
      })),
      goal,
      weeks,
      runDaysPerWeek: runDays,
      keepOriginSport: keepsOrigin,
      strengthPerWeek: strength.haut + strength.bas,
      strengthBlocks: { haut: strength.haut, bas: strength.bas },
      mobility: strength.mobility,
      strengthPlace: strength.place,
      reference5kSec: ref5kSec ?? undefined,
    };
    saveState(createState(profile, mondayOf(startDate)));
    router.push("/aujourdhui");
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      {existing && step === 0 && (
        <p className="mb-6 rounded-2xl border border-origin/40 bg-origin/10 p-4 text-sm">
          Tu as déjà un plan. En générant un nouveau plan, l&apos;actuel et tes retours seront
          remplacés.
        </p>
      )}
      <Kicker>
        Étape {step + 1} sur {STEPS.length} · {STEPS[step]}
      </Kicker>
      <div className="mt-3 mb-8 flex gap-1" aria-hidden>
        {STEPS.map((s, i) => (
          <span
            key={s}
            className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-gradient-to-r from-origin to-target" : "bg-white/10"}`}
          />
        ))}
      </div>

      {step === 0 && (
        <section className="space-y-6">
          <h1 className="text-3xl font-extrabold">D&apos;où viens-tu ?</h1>
          <div className="grid gap-3 sm:grid-cols-2">
            {SPORTS.map((s) => (
              <OptionCard
                key={s}
                selected={origin === s}
                title={ORIGIN_LABEL[s]}
                hint={ORIGIN_HINT[s]}
                badge={s === "velo" ? "parcours V1" : undefined}
                onClick={() => setOrigin(s)}
              />
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold">
                {origin === "reprise" ? "Années de pratique avant l'arrêt" : "Années de pratique"}
              </span>
              <input
                type="number"
                min={0}
                max={60}
                value={years}
                onChange={(e) => setYears(Math.max(0, Number(e.target.value) || 0))}
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold">
                Heures par semaine : <span className="text-target">{hours} h</span>
              </span>
              <input
                type="range"
                min={0}
                max={20}
                value={hours}
                onChange={(e) => setHours(Number(e.target.value))}
                className="mt-3 w-full accent-target"
              />
            </label>
          </div>
        </section>
      )}

      {step === 1 && (
        <section className="space-y-6">
          <h1 className="text-3xl font-extrabold">Des blessures passées ?</h1>
          <p className="text-muted">
            Coche les zones déjà blessées. Le plan démarre plus doucement après une blessure aux
            jambes.
          </p>
          <div className="flex flex-wrap gap-2">
            {ZONES.map((z) => (
              <button
                key={z}
                type="button"
                aria-pressed={z in injuries}
                onClick={() => toggleInjury(z)}
                className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  z in injuries
                    ? "border-origin bg-origin/15 text-origin"
                    : "border-white/15 text-muted hover:text-ink"
                }`}
              >
                {INJURY_LABEL[z]}
              </button>
            ))}
          </div>
          {ZONES.filter((z) => z in injuries).map((z) => (
            <label key={z} className="flex items-center justify-between gap-4">
              <span className="text-sm">{INJURY_LABEL[z]} : année de la blessure</span>
              <input
                type="number"
                min={1970}
                max={year}
                value={injuries[z]}
                onChange={(e) =>
                  setInjuries((cur) => ({ ...cur, [z]: Number(e.target.value) || year }))
                }
                className={`${inputClass} max-w-28`}
              />
            </label>
          ))}
          {!Object.keys(injuries).length && (
            <p className="text-sm text-muted">Aucune pour l&apos;instant.</p>
          )}
        </section>
      )}

      {step === 2 && (
        <section className="space-y-6">
          <h1 className="text-3xl font-extrabold">Ton objectif</h1>
          <div className="grid gap-3 sm:grid-cols-3">
            {GOALS.map((g) => (
              <OptionCard
                key={g}
                selected={goal === g}
                title={GOAL_LABEL[g]}
                hint={GOAL_HINT[g]}
                onClick={() => setGoal(g)}
              />
            ))}
          </div>
          <Segmented
            label="Durée du plan"
            value={weeks}
            onChange={setWeeks}
            options={WEEKS.map((w) => ({ value: w, label: `${w} sem.` }))}
          />
          <label className="block">
            <span className="mb-2 block text-sm font-semibold">Début du plan (un lundi)</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStart(e.target.value)}
              className={`${inputClass} max-w-52 [color-scheme:dark]`}
            />
            {!startOk && (
              <span className="mt-1 block text-sm text-warn">
                Choisis une date à partir de cette semaine.
              </span>
            )}
            {startOk && mondayOf(startDate) !== startDate && (
              <span className="mt-1 block text-sm text-muted">
                Le plan démarrera le lundi de cette semaine.
              </span>
            )}
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold">
              Ton temps sur 5 km <span className="font-normal text-muted">(facultatif)</span>
            </span>
            <input
              inputMode="numeric"
              placeholder="ex. 27:30"
              value={ref5k}
              onChange={(e) => setRef5k(e.target.value)}
              className={`${inputClass} max-w-40`}
            />
            <span className="mt-1 block text-sm text-muted">
              {ref5kOk && ref5kSec
                ? `Soit ${formatDuration(ref5kSec / 5)} /km : tes allures seront calculées à partir de ce temps.`
                : ref5kOk
                  ? "Sans temps, les séances se font au ressenti. Tu pourras l'ajouter plus tard ou l'estimer avec Strava."
                  : ""}
            </span>
            {!ref5kOk && (
              <span className="mt-1 block text-sm text-warn">
                Écris le temps sous la forme 27:30.
              </span>
            )}
          </label>
        </section>
      )}

      {step === 3 && (
        <section className="space-y-6">
          <h1 className="text-3xl font-extrabold">Ta semaine type</h1>
          <Segmented
            label="Séances de course par semaine"
            value={runDays}
            onChange={setRunDays}
            options={[2, 3, 4].map((n) => ({ value: n as 2 | 3 | 4, label: String(n) }))}
          />
          {origin !== "reprise" && (
            <Segmented
              label={`Garder une séance de ${ORIGIN_LABEL[origin].toLowerCase()} chaque semaine ?`}
              value={keepOrigin ? "oui" : "non"}
              onChange={(v) => setKeepOrigin(v === "oui")}
              options={[
                { value: "oui", label: "Oui" },
                { value: "non", label: "Non" },
              ]}
            />
          )}
          <StrengthQuestions value={strength} onChange={setStrength} max={strengthMax} />
          <p className="rounded-2xl border border-white/10 bg-card p-4 text-sm text-muted">
            Transio t&apos;accompagne dans l&apos;entraînement et la progressivité. Il ne remplace
            pas un avis médical.
          </p>
        </section>
      )}

      <div className="mt-10 flex justify-between gap-3">
        <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={step === 0}>
          Retour
        </Button>
        {step < STEPS.length - 1 ? (
          <Button
            onClick={() => setStep((s) => s + 1)}
            disabled={step === 2 && (!startOk || !ref5kOk)}
          >
            Continuer
          </Button>
        ) : (
          <Button onClick={finish} disabled={!startOk || !ref5kOk || !strengthOk}>
            Générer mon plan
          </Button>
        )}
      </div>
    </div>
  );
}
