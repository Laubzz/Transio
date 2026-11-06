import { json, unauthorized, userFromRequest } from "@/lib/server/auth";
import { importPage, stravaConfigured, StravaError } from "@/lib/server/strava";

/**
 * Importe une page d'activités Strava (200 au plus).
 * `since` (AAAA-MM-JJ) limite aux activités récentes ; sans `since`, tout l'historique.
 */
export async function POST(req: Request) {
  if (!stravaConfigured) return json({ error: "Strava n'est pas configuré." }, 503);
  const auth = await userFromRequest(req);
  if (!auth) return unauthorized();
  const body = (await req.json().catch(() => null)) as { since?: string; page?: number } | null;
  const since = body?.since && /^\d{4}-\d{2}-\d{2}$/.test(body.since) ? body.since : null;
  const page = Math.min(100, Math.max(1, Math.floor(Number(body?.page) || 1)));
  try {
    const after = since ? Math.floor(new Date(`${since}T00:00:00Z`).getTime() / 1000) - 86_400 : 0;
    return json(await importPage(auth.sb, auth.user.id, after, page));
  } catch (e) {
    const err = e instanceof StravaError ? e : new StravaError("Erreur Strava.");
    return json({ error: err.message }, err.status);
  }
}
