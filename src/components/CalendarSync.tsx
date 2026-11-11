"use client";

import { useEffect, useState } from "react";
import { buildCalendar } from "@/lib/ics";
import type { AppState } from "@/lib/state";
import { saveState } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { useAccount } from "@/lib/sync";
import { Button, Card } from "./ui";

const TIMES = Array.from({ length: 33 }, (_, i) => {
  const m = 5 * 60 + i * 30; // de 5:00 à 21:00
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
});

async function feedToken(create: boolean): Promise<string | null> {
  const sb = supabase();
  if (!sb) return null;
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return null;
  const { data } = await sb
    .from("calendar_feeds")
    .select("token")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (data || !create) return data?.token ?? null;
  const { data: made, error } = await sb
    .from("calendar_feeds")
    .insert({ user_id: auth.user.id })
    .select("token")
    .single();
  if (error) throw new Error("Impossible de créer le lien d'agenda.");
  return made.token;
}

/**
 * Export du plan vers un agenda : abonnement Google Agenda (mis à jour automatiquement)
 * avec un compte, et fichier .ics à importer dans n'importe quel agenda.
 */
export function CalendarSync({ state }: { state: AppState }) {
  const account = useAccount();
  const signedIn = account.auth === "signed-in";
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const time = state.calendar?.time ?? null;

  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    feedToken(false)
      .then((t) => live && setToken(t))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [signedIn]);

  const url = token ? `${window.location.origin}/api/calendrier/${token}` : null;
  const webcal = url?.replace(/^https?:/, "webcal:");
  const google = webcal
    ? `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}`
    : null;

  const download = () => {
    const blob = new Blob([buildCalendar(state, { time })], {
      type: "text/calendar;charset=utf-8",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "transio.ics";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <Card>
      <h2 id="agenda" className="scroll-mt-24 font-semibold">
        Ajouter à ton agenda
      </h2>
      <p className="mt-1 text-sm text-muted">
        Chaque séance devient un événement, avec son détail et tes allures.
      </p>

      <label className="mt-4 block">
        <span className="mb-1 block text-xs text-muted">Heure de tes séances</span>
        <select
          value={time ?? ""}
          onChange={(e) => saveState({ ...state, calendar: { time: e.target.value || null } })}
          className="rounded-lg border border-white/10 bg-night px-3 py-2 text-sm focus:border-ink focus:outline-none"
        >
          <option value="">Toute la journée</option>
          {TIMES.map((t) => (
            <option key={t} value={t}>
              {t.replace(":", " h ")}
            </option>
          ))}
        </select>
      </label>

      {signedIn ? (
        <div className="mt-5 space-y-3">
          {google && url ? (
            <>
              <div className="flex flex-wrap gap-2">
                <a
                  href={google}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-full bg-ink px-5 py-3 text-sm font-semibold text-night hover:brightness-110"
                >
                  Ouvrir dans Google Agenda
                </a>
                <Button
                  variant="ghost"
                  onClick={async () => {
                    await navigator.clipboard?.writeText(url).catch(() => undefined);
                    setMessage("Lien copié. Dans un autre agenda : « Ajouter un agenda par URL ».");
                  }}
                >
                  Copier le lien
                </Button>
              </div>
              <p className="text-xs text-muted">
                Google Agenda s&apos;abonne à ton plan et le relit tout seul, en général en quelques
                heures (jusqu&apos;à 24 h) : bilans et changements suivent sans rien refaire. Ce
                lien est privé, ne le partage pas.
              </p>
              <button
                type="button"
                className="text-xs text-muted hover:text-warn"
                onClick={async () => {
                  await supabase()?.from("calendar_feeds").delete().neq("token", "");
                  setToken(null);
                  setMessage("Lien désactivé. Retire aussi l'agenda « Transio » de Google Agenda.");
                }}
              >
                Désactiver le lien
              </button>
            </>
          ) : (
            <Button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setMessage(null);
                try {
                  setToken(await feedToken(true));
                } catch (e) {
                  setMessage((e as Error).message);
                }
                setBusy(false);
              }}
            >
              {busy ? "Un instant…" : "Synchroniser avec Google Agenda"}
            </Button>
          )}
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted">
          Crée un compte pour synchroniser ton plan avec Google Agenda automatiquement.
        </p>
      )}

      <button
        type="button"
        onClick={download}
        className="mt-4 block text-sm font-medium text-ink underline underline-offset-2 hover:no-underline"
      >
        Télécharger le fichier .ics
      </button>
      {message && <p className="mt-3 text-sm">{message}</p>}
    </Card>
  );
}
