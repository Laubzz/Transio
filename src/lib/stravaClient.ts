"use client";

import { addDays, toISO } from "./dates";
import { mergeActivities, type Activity, type AppState } from "./state";
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
  connected: boolean;
  athleteId?: number | null;
}

export const stravaStatus = () => call<StravaStatus>("/api/strava/status");

/** Ouvre la page d'autorisation Strava ; elle revient sur /strava avec un code. */
export function startStravaConnect() {
  if (!stravaClientId) return;
  const nonce = crypto.randomUUID();
  try {
    sessionStorage.setItem(STATE_KEY, nonce);
  } catch {
    // sans stockage de session, la vérification du retour échouera proprement
  }
  const params = new URLSearchParams({
    client_id: stravaClientId,
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

/**
 * Importe les activités depuis 6 semaines avant le début du plan (pour estimer l'allure),
 * ou depuis la dernière activité importée. Renvoie le nombre de nouvelles activités.
 */
export async function importFromStrava(): Promise<number> {
  const state = readState();
  if (!state) return 0;
  const last = state.activities?.[0]?.date;
  const since = last ? addDays(last, -2) : addDays(state.startDate, -42);
  const { activities } = await call<{ activities: Activity[] }>("/api/strava/import", {
    method: "POST",
    body: JSON.stringify({ since: since > toISO(new Date()) ? toISO(new Date()) : since }),
  });
  const known = new Set((state.activities ?? []).map((a) => a.id));
  const fresh = readState() as AppState;
  saveState(mergeActivities(fresh, activities));
  return activities.filter((a) => !known.has(a.id)).length;
}

export const disconnectStrava = () => call("/api/strava", { method: "DELETE" });
