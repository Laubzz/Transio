import { json, unauthorized, userFromRequest } from "@/lib/server/auth";
import { importActivities, stravaConfigured, StravaError } from "@/lib/server/strava";

/** Importe les activités Strava depuis une date (AAAA-MM-JJ). */
export async function POST(req: Request) {
  if (!stravaConfigured) return json({ error: "Strava n'est pas configuré." }, 503);
  const auth = await userFromRequest(req);
  if (!auth) return unauthorized();
  const body = (await req.json().catch(() => null)) as { since?: string } | null;
  const since = body?.since && /^\d{4}-\d{2}-\d{2}$/.test(body.since) ? body.since : null;
  if (!since) return json({ error: "Date de début manquante." }, 400);
  try {
    const after = Math.floor(new Date(`${since}T00:00:00Z`).getTime() / 1000) - 86_400;
    return json({ activities: await importActivities(auth.sb, auth.user.id, after) });
  } catch (e) {
    const err = e instanceof StravaError ? e : new StravaError("Erreur Strava.");
    return json({ error: err.message }, err.status);
  }
}
