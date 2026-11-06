import { json, unauthorized, userFromRequest } from "@/lib/server/auth";
import { activityDetails, stravaConfigured, StravaError } from "@/lib/server/strava";

/** Meilleurs efforts (records) d'au plus 10 activités. */
export async function POST(req: Request) {
  if (!stravaConfigured) return json({ error: "Strava n'est pas configuré." }, 503);
  const auth = await userFromRequest(req);
  if (!auth) return unauthorized();
  const body = (await req.json().catch(() => null)) as { ids?: unknown } | null;
  const ids = Array.isArray(body?.ids)
    ? body.ids.filter((x): x is number => Number.isSafeInteger(x) && x > 0).slice(0, 10)
    : [];
  if (!ids.length) return json({ error: "Aucune activité demandée." }, 400);
  try {
    return json(await activityDetails(auth.sb, auth.user.id, ids));
  } catch (e) {
    const err = e instanceof StravaError ? e : new StravaError("Erreur Strava.");
    return json({ error: err.message }, err.status);
  }
}
