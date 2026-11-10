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
import { removePeriod, savePeriod } from "@/lib/coaching";
import { formatShort } from "@/lib/dates";
import { strengthSummary } from "./StrengthQuestions";
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
        ? `${
            p.strengthBlocks
              ? strengthSummary({ ...p.strengthBlocks, mobility: p.mobility ?? false })
              : `${p.strengthPerWeek} par semaine`
          }, ${PLACE_LABEL[p.strengthPlace ?? "maison"]}`
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
        <ButtonLink href="/suite" variant="ghost" className="mt-4">
          Préparer la suite
        </ButtonLink>
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
      <PeriodsCard state={state} />
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
  const [progress, setProgress] = useState<string | null>(null);
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

  const doImport = async (full: boolean) => {
    const r = await importFromStrava({
      full,
      onProgress: (p) =>
        setProgress(
          p.phase === "activites"
            ? `${p.done} activité${p.done > 1 ? "s" : ""} reçue${p.done > 1 ? "s" : ""}…`
            : `Lecture des records : ${p.done}/${p.total} sorties…`,
        ),
    });
    setProgress(null);
    const parts = [
      r.added
        ? `${r.added} nouvelle${r.added > 1 ? "s" : ""} activité${r.added > 1 ? "s" : ""}`
        : "Aucune nouvelle activité",
    ];
    if (r.analysed)
      parts.push(
        `${r.analysed} sortie${r.analysed > 1 ? "s" : ""} analysée${r.analysed > 1 ? "s" : ""} pour les records`,
      );
    if (r.remaining)
      parts.push(
        `${r.remaining} restent à analyser : Strava limite le nombre de requêtes, relance l'import dans 15 minutes`,
      );
    return parts.join(" · ") + ".";
  };

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
        <div className="mt-1 text-sm text-muted">
          <p>La connexion à Strava n&apos;est pas encore activée sur ce site.</p>
          {status.missing && status.missing.length > 0 && (
            <p className="mt-2">
              Variable{status.missing.length > 1 ? "s" : ""} absente
              {status.missing.length > 1 ? "s" : ""} côté serveur :{" "}
              {status.missing.map((m) => (
                <code key={m} className="mr-1 rounded bg-night px-1.5 py-0.5 text-xs text-origin">
                  {m}
                </code>
              ))}
              . Ajoute-la dans Vercel (environnement Production), puis redéploie.
            </p>
          )}
        </div>
      ) : status.connected ? (
        <>
          <p className="mt-1 text-sm text-muted">
            Connecté. {count} activité{count > 1 ? "s" : ""} importée{count > 1 ? "s" : ""}
            {state.stravaFullImport ? " (tout ton historique)" : ""} : elles remplissent tes retours
            de séance, tes records et l&apos;estimation de ton allure.
          </p>
          {progress && <p className="mt-2 text-sm text-target">{progress}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => run(() => doImport(false))}>
              {busy
                ? "Import…"
                : state.stravaFullImport
                  ? "Importer les nouvelles activités"
                  : "Importer tout mon historique"}
            </Button>
            {state.stravaFullImport && (
              <Button variant="ghost" disabled={busy} onClick={() => run(() => doImport(true))}>
                Tout réimporter
              </Button>
            )}
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
          <Button
            className="mt-4 bg-none bg-[#fc4c02] text-white"
            onClick={() => startStravaConnect(status.clientId)}
          >
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

/** Périodes perso (école, entreprise, vacances…) affichées sur le calendrier. */
function PeriodsCard({ state }: { state: AppState }) {
  const [label, setLabel] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const periods = state.periods ?? [];
  const input =
    "w-full rounded-xl border border-white/15 bg-night px-3 py-2 text-sm focus:border-target focus:outline-none [color-scheme:dark]";
  return (
    <Card>
      <h2 className="font-semibold">Tes périodes</h2>
      <p className="mt-1 text-sm text-muted">
        École, entreprise, vacances, déplacements… Elles s&apos;affichent sur le calendrier pour
        organiser tes séances. Une période chargée est signalée en orange.
      </p>
      {periods.length > 0 && (
        <ul className="mt-3 divide-y divide-white/5 text-sm">
          {periods.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 py-2">
              <span>
                <strong className={p.busy ? "text-origin" : ""}>{p.label}</strong>{" "}
                <span className="text-muted">
                  du {formatShort(p.start)} au {formatShort(p.end)}
                </span>
              </span>
              <button
                type="button"
                className="text-xs text-muted hover:text-warn"
                onClick={() => saveState(removePeriod(state, p.id))}
              >
                Retirer
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="mt-4 grid gap-3 sm:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault();
          try {
            saveState(savePeriod(state, { label, start, end, busy }));
            setLabel("");
            setStart("");
            setEnd("");
            setBusy(false);
            setError(null);
          } catch (err) {
            setError((err as Error).message);
          }
        }}
      >
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-xs text-muted">Nom</span>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Entreprise"
            className={input}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-muted">Du</span>
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            required
            className={input}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-muted">Au</span>
          <input
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            required
            className={input}
          />
        </label>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            checked={busy}
            onChange={(e) => setBusy(e.target.checked)}
            className="accent-origin"
          />
          Période chargée
        </label>
        <div className="sm:col-span-2 sm:text-right">
          <Button type="submit" variant="ghost" className="px-4 py-2">
            Ajouter la période
          </Button>
        </div>
      </form>
      {error && <p className="mt-2 text-sm text-warn">{error}</p>}
    </Card>
  );
}
