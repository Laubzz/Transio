import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  toActivity,
  toBestEfforts,
  type StravaBestEffort,
  type StravaSummaryActivity,
} from "../strava";
import type { Activity, BestEffort } from "../state";

const API = "https://www.strava.com/api/v3";
const OAUTH = "https://www.strava.com/oauth";

// Le Client ID est accepté sous les deux noms, la confusion étant fréquente.
export const clientId =
  (process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID ?? process.env.STRAVA_CLIENT_ID)?.trim() || undefined;
const clientSecret = process.env.STRAVA_CLIENT_SECRET?.trim() || undefined;

export const stravaConfigured = Boolean(clientId && clientSecret);

/** Variables absentes côté serveur, pour l'aide au diagnostic dans le profil. */
export const stravaMissing = [
  ...(clientId ? [] : ["NEXT_PUBLIC_STRAVA_CLIENT_ID"]),
  ...(clientSecret ? [] : ["STRAVA_CLIENT_SECRET"]),
];

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  athlete?: { id: number };
}

interface TokenRow {
  athlete_id: number;
  access_token: string;
  refresh_token: string;
  expires_at: string;
}

export class StravaError extends Error {
  constructor(
    message: string,
    readonly status = 502,
  ) {
    super(message);
  }
}

async function token(params: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(`${OAUTH}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId!, client_secret: clientSecret!, ...params }),
    cache: "no-store",
  });
  if (!res.ok) throw new StravaError("Strava a refusé l'autorisation. Réessaie la connexion.", 400);
  return res.json();
}

/** Échange le code reçu après l'autorisation et enregistre les jetons de l'utilisateur. */
export async function connect(sb: SupabaseClient, userId: string, code: string, scope: string) {
  const t = await token({ code, grant_type: "authorization_code" });
  if (!t.athlete) throw new StravaError("Réponse Strava inattendue.");
  const { error } = await sb.from("strava_tokens").upsert({
    user_id: userId,
    athlete_id: t.athlete.id,
    access_token: t.access_token,
    refresh_token: t.refresh_token,
    expires_at: new Date(t.expires_at * 1000).toISOString(),
    scope,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new StravaError("Impossible d'enregistrer la connexion Strava.", 500);
  return { athleteId: t.athlete.id };
}

export async function tokenRow(sb: SupabaseClient, userId: string): Promise<TokenRow | null> {
  const { data } = await sb
    .from("strava_tokens")
    .select("athlete_id, access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .maybeSingle();
  return data;
}

/** Jeton d'accès valide, rafraîchi s'il expire dans moins d'une minute. */
async function validAccessToken(sb: SupabaseClient, userId: string): Promise<string> {
  const row = await tokenRow(sb, userId);
  if (!row) throw new StravaError("Strava n'est pas connecté.", 404);
  if (new Date(row.expires_at).getTime() - Date.now() > 60_000) return row.access_token;
  const t = await token({ grant_type: "refresh_token", refresh_token: row.refresh_token });
  await sb
    .from("strava_tokens")
    .update({
      access_token: t.access_token,
      refresh_token: t.refresh_token,
      expires_at: new Date(t.expires_at * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
  return t.access_token;
}

const PER_PAGE = 200;

async function get<T>(path: string, access: string): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${access}` },
    cache: "no-store",
  });
  if (res.status === 429) {
    throw new StravaError(
      "Limite de requêtes Strava atteinte. L'import reprendra dans 15 minutes.",
      429,
    );
  }
  if (!res.ok) throw new StravaError("Strava n'a pas pu fournir tes activités.");
  return res.json() as Promise<T>;
}

/** Une page d'activités (200 au plus) depuis une date (epoch en secondes, 0 pour tout). */
export async function importPage(
  sb: SupabaseClient,
  userId: string,
  afterEpoch: number,
  page: number,
): Promise<{ activities: Activity[]; more: boolean }> {
  const access = await validAccessToken(sb, userId);
  const batch = await get<StravaSummaryActivity[]>(
    `/athlete/activities?after=${afterEpoch}&per_page=${PER_PAGE}&page=${page}`,
    access,
  );
  return { activities: batch.map(toActivity), more: batch.length === PER_PAGE };
}

/**
 * Meilleurs efforts de quelques activités (une requête Strava par activité).
 * S'arrête proprement à la limite de requêtes : `rateLimited` indique de reprendre plus tard.
 */
export async function activityDetails(
  sb: SupabaseClient,
  userId: string,
  ids: number[],
): Promise<{ details: { id: number; bestEfforts: BestEffort[] }[]; rateLimited: boolean }> {
  const access = await validAccessToken(sb, userId);
  const details: { id: number; bestEfforts: BestEffort[] }[] = [];
  for (const id of ids) {
    try {
      const a = await get<{ best_efforts?: StravaBestEffort[] }>(
        `/activities/${id}?include_all_efforts=false`,
        access,
      );
      details.push({ id, bestEfforts: toBestEfforts(a.best_efforts) });
    } catch (e) {
      if (e instanceof StravaError && e.status === 429) return { details, rateLimited: true };
      details.push({ id, bestEfforts: [] }); // activité supprimée ou privée : on ne réessaie pas
    }
  }
  return { details, rateLimited: false };
}

/** Retire l'accès côté Strava et supprime les jetons enregistrés. */
export async function disconnect(sb: SupabaseClient, userId: string) {
  const row = await tokenRow(sb, userId);
  if (row) {
    await fetch(`${OAUTH}/deauthorize`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ access_token: row.access_token }),
      cache: "no-store",
    }).catch(() => undefined);
  }
  await sb.from("strava_tokens").delete().eq("user_id", userId);
}
