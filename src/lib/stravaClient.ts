"use client";

import { addDays, toISO } from "./dates";
import {
  activitiesNeedingDetails,
  mergeActivities,
  setBestEfforts,
  type Activity,
  type AppState,
  type BestEffort,
} from "./state";
import { STRAVA_SCOPE } from "./strava";
import { readState, saveState } from "./store";
import { accessToken } from "./supabase";

const STATE_KEY = "transio:strava-state";
export const stravaClientId = process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID;

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await accessToken();
  if (!token) throw new Error("Connecte-toi pour utiliser Strava.");
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "Erreur Strava.");
  return body as T;
}

export interface StravaStatus {
  configured: boolean;
  /** Variables manquantes côté serveur quand Strava n'est pas configuré. */
  missing?: string[];
  /** Client ID de l'application Strava, fourni par le serveur. */
  clientId?: string;
  connected: boolean;
  athleteId?: number | null;
}

export const stravaStatus = () => call<StravaStatus>("/api/strava/status");

/** Ouvre la page d'autorisation Strava ; elle revient sur /strava avec un code. */
export function startStravaConnect(serverClientId?: string) {
  const id = serverClientId ?? stravaClientId;
  if (!id) return;
  const nonce = crypto.randomUUID();
  try {
    sessionStorage.setItem(STATE_KEY, nonce);
  } catch {
    // sans stockage de session, la vérification du retour échouera proprement
  }
  const params = new URLSearchParams({
    client_id: id,
    redirect_uri: `${window.location.origin}/strava`,
    response_type: "code",
    approval_prompt: "auto",
    scope: STRAVA_SCOPE,
    state: nonce,
  });
  window.location.assign(`https://www.strava.com/oauth/authorize?${params}`);
}

/** Termine la connexion au retour de Strava (vérifie l'état anti-falsification). */
export async function finishStravaConnect(query: URLSearchParams) {
  if (query.get("error")) throw new Error("Connexion à Strava annulée.");
  let expected: string | null = null;
  try {
    expected = sessionStorage.getItem(STATE_KEY);
    sessionStorage.removeItem(STATE_KEY);
  } catch {
    expected = null;
  }
  if (!expected || query.get("state") !== expected) {
    throw new Error("Lien de retour Strava invalide. Relance la connexion depuis ton profil.");
  }
  await call("/api/strava/exchange", {
    method: "POST",
    body: JSON.stringify({ code: query.get("code"), scope: query.get("scope") }),
  });
}

export interface ImportProgress {
  phase: "activites" | "records";
  /** Activités reçues, ou sorties analysées pour les records. */
  done: number;
  /** Total de sorties à analyser (phase records). */
  total?: number;
}

export interface ImportResult {
  added: number;
  analysed: number;
  /** Il reste des sorties à analyser : la limite Strava est atteinte, reprendre plus tard. */
  remaining: number;
}

/**
 * Importe les activités Strava : tout l'historique la première fois (ou si `full`),
 * puis seulement les nouvelles. Lit ensuite les records des sorties concernées.
 */
export async function importFromStrava(
  opts: { full?: boolean; onProgress?: (p: ImportProgress) => void } = {},
): Promise<ImportResult> {
  const start = readState();
  if (!start) return { added: 0, analysed: 0, remaining: 0 };
  const known = new Set((start.activities ?? []).map((a) => a.id));
  const full = opts.full || !start.stravaFullImport;
  const last = start.activities?.[0]?.date;
  const today = toISO(new Date());
  const since = full || !last ? undefined : addDays(last, -2) > today ? today : addDays(last, -2);

  let received = 0;
  for (let page = 1; page <= 100; page++) {
    const { activities, more } = await call<{ activities: Activity[]; more: boolean }>(
      "/api/strava/import",
      { method: "POST", body: JSON.stringify({ since, page }) },
    );
    received += activities.length;
    saveState(mergeActivities(readState() as AppState, activities));
    opts.onProgress?.({ phase: "activites", done: received });
    if (!more) break;
  }
  if (full) saveState({ ...(readState() as AppState), stravaFullImport: true });
  const added = (readState()?.activities ?? []).filter((a) => !known.has(a.id)).length;

  const { analysed, remaining } = await importBestEfforts(opts.onProgress);
  return { added, analysed, remaining };
}

/** Lit les meilleurs efforts des sorties avec record, par lots de 10, jusqu'à la limite Strava. */
export async function importBestEfforts(onProgress?: (p: ImportProgress) => void) {
  const todo = activitiesNeedingDetails(readState() as AppState);
  let analysed = 0;
  for (let i = 0; i < todo.length; i += 10) {
    const { details, rateLimited } = await call<{
      details: { id: number; bestEfforts: BestEffort[] }[];
      rateLimited: boolean;
    }>("/api/strava/details", {
      method: "POST",
      body: JSON.stringify({ ids: todo.slice(i, i + 10) }),
    });
    saveState(setBestEfforts(readState() as AppState, details));
    analysed += details.length;
    onProgress?.({ phase: "records", done: analysed, total: todo.length });
    if (rateLimited) break;
  }
  return { analysed, remaining: todo.length - analysed };
}

export const disconnectStrava = () => call("/api/strava", { method: "DELETE" });
