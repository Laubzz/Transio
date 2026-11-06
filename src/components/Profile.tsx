"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  GOAL_LABEL,
  INTENSITY_LABEL,
  ORIGIN_LABEL,
  formatDuration,
  formatPaceRange,
  paces,
  parseDuration,
} from "@/engine";
import { addDays, formatLong } from "@/lib/dates";
import { INJURY_LABEL } from "@/lib/labels";
import { estimate5k, setReference5k, type AppState } from "@/lib/state";
import { saveState, useAppState, useToday } from "@/lib/store";
import {
  disconnectStrava,
  importFromStrava,
  startStravaConnect,
  stravaStatus,
  type StravaStatus,
} from "@/lib/stravaClient";
import { supabase } from "@/lib/supabase";
import { useAccount } from "@/lib/sync";
import { Button, ButtonLink, Card, Kicker } from "./ui";

const PLACE_LABEL = {
  maison: "à la maison",
  salle: "en salle de muscu",
  "les-deux": "maison et salle en alternance",
};

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
    [
      "Renforcement",
      p.strengthPerWeek
        ? `${p.strengthPerWeek} par semaine, ${PLACE_LABEL[p.strengthPlace ?? "maison"]}`
        : "Aucun",
    ],
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

      <PaceCard state={state} />
      <StravaCard state={state} />
      <AccountCard />

      <Card>
        <h2 className="font-semibold">Tes données</h2>
        <DataNote />
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

/** Temps de référence sur 5 km et allures qui en découlent. */
function PaceCard({ state }: { state: AppState }) {
  const today = useToday();
  const p = state.plan.profile;
  const [text, setText] = useState(p.reference5kSec ? formatDuration(p.reference5kSec) : "");
  const [error, setError] = useState<string | null>(null);
  const estimate = today ? estimate5k(state.activities ?? [], today) : null;
  const ref = p.reference5kSec;
  const pc = ref ? paces(ref, p.goal) : null;

  const apply = (sec: number | undefined) => {
    saveState(setReference5k(state, sec));
    setText(sec ? formatDuration(sec) : "");
    setError(null);
  };

  return (
    <Card>
      <h2 className="font-semibold">Tes allures</h2>
      <p className="mt-1 text-sm text-muted">
        Calculées à partir de ton temps sur 5 km. Mets-le à jour après un test ou une course.
      </p>
      <form
        className="mt-4 flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const sec = parseDuration(text);
          if (!sec || sec < 12 * 60 || sec > 60 * 60)
            setError("Écris un temps entre 12:00 et 60:00.");
          else apply(sec);
        }}
      >
        <label className="block">
          <span className="mb-1 block text-xs text-muted">Temps sur 5 km</span>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="27:30"
            inputMode="numeric"
            className="w-28 rounded-xl border border-white/15 bg-night px-3 py-2 focus:border-target focus:outline-none"
          />
        </label>
        <Button type="submit" variant="ghost" className="px-4 py-2">
          Enregistrer
        </Button>
        {ref && (
          <Button variant="ghost" className="px-4 py-2" onClick={() => apply(undefined)}>
            Retirer
          </Button>
        )}
      </form>
      {error && <p className="mt-2 text-sm text-warn">{error}</p>}
      {estimate && estimate !== ref && (
        <p className="mt-3 text-sm">
          Estimation d&apos;après tes sorties Strava : <strong>{formatDuration(estimate)}</strong>.{" "}
          <button
            type="button"
            onClick={() => apply(estimate)}
            className="font-semibold text-target hover:underline"
          >
            Utiliser cette estimation
          </button>
        </p>
      )}
      {pc ? (
        <dl className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          {(["endurance", "seuil", "vma", "objectif"] as const).map((k) => {
            const r = k === "objectif" ? pc.objectif : pc[k];
            return (
              <div key={k} className="rounded-xl bg-night/60 p-3">
                <dt className="text-xs text-muted">{INTENSITY_LABEL[k]}</dt>
                <dd className="font-semibold tabular-nums">
                  {r ? formatPaceRange(r) : "à l'effort"}
                </dd>
              </div>
            );
          })}
        </dl>
      ) : (
        <p className="mt-3 text-sm text-muted">
          Sans temps de référence, tes séances se font au ressenti.
        </p>
      )}
    </Card>
  );
}

/** Connexion à Strava et import des activités. */
function StravaCard({ state }: { state: AppState }) {
  const account = useAccount();
  const [status, setStatus] = useState<StravaStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const signedIn = account.auth === "signed-in";

  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    stravaStatus()
      .then((s) => live && setStatus(s))
      .catch(() => live && setStatus({ configured: false, connected: false }));
    return () => {
      live = false;
    };
  }, [signedIn]);

  const run = async (fn: () => Promise<string>) => {
    setBusy(true);
    setMessage(null);
    try {
      setMessage(await fn());
    } catch (e) {
      setMessage((e as Error).message);
    }
    setBusy(false);
  };

  const count = state.activities?.length ?? 0;

  return (
    <Card>
      <h2 id="strava" className="scroll-mt-24 font-semibold">
        Strava
      </h2>
      {!signedIn ? (
        <p className="mt-1 text-sm text-muted">Crée un compte pour connecter Strava.</p>
      ) : !status ? (
        <p className="mt-1 text-sm text-muted">Vérification…</p>
      ) : !status.configured ? (
        <p className="mt-1 text-sm text-muted">
          La connexion à Strava n&apos;est pas encore activée sur ce site.
        </p>
      ) : status.connected ? (
        <>
          <p className="mt-1 text-sm text-muted">
            Connecté. {count} activité{count > 1 ? "s" : ""} importée{count > 1 ? "s" : ""} : elles
            remplissent tes retours de séance et estiment ton allure.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const n = await importFromStrava();
                  return n
                    ? `${n} nouvelle${n > 1 ? "s" : ""} activité${n > 1 ? "s" : ""} importée${n > 1 ? "s" : ""}.`
                    : "Rien de nouveau.";
                })
              }
            >
              {busy ? "Import…" : "Importer mes activités"}
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await disconnectStrava();
                  setStatus({ configured: true, connected: false });
                  return "Strava déconnecté.";
                })
              }
            >
              Déconnecter
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted">
            Connecte ton compte Strava pour importer tes sorties : durée, distance, allure et
            fréquence cardiaque.
          </p>
          <Button className="mt-4 bg-none bg-[#fc4c02] text-white" onClick={startStravaConnect}>
            Connecter Strava
          </Button>
        </>
      )}
      {message && <p className="mt-3 text-sm">{message}</p>}
    </Card>
  );
}

/** Compte : e-mail et déconnexion. */
function AccountCard() {
  const account = useAccount();
  const router = useRouter();
  if (account.auth !== "signed-in") return null;
  return (
    <Card>
      <h2 className="font-semibold">Ton compte</h2>
      <p className="mt-1 text-sm text-muted">
        Connecté avec <strong className="text-ink">{account.email}</strong>. Ton plan et tes séances
        sont enregistrés dans ton compte et disponibles sur tous tes appareils.
      </p>
      <Button
        variant="ghost"
        className="mt-4"
        onClick={async () => {
          await supabase()?.auth.signOut();
          router.push("/");
        }}
      >
        Se déconnecter
      </Button>
    </Card>
  );
}

function DataNote() {
  const account = useAccount();
  return (
    <p className="mt-1 text-sm text-muted">
      {account.auth === "signed-in"
        ? "Effacer supprime ton plan, tes retours et tes activités importées, dans ton compte et sur cet appareil."
        : "Ton plan et tes retours sont enregistrés uniquement sur cet appareil, dans ce navigateur."}
    </p>
  );
}
