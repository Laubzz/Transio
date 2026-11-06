import { json, unauthorized, userFromRequest } from "@/lib/server/auth";
import { connect, stravaConfigured, StravaError } from "@/lib/server/strava";
import { hasActivityScope } from "@/lib/strava";

/** Termine la connexion Strava : échange le code d'autorisation contre des jetons. */
export async function POST(req: Request) {
  if (!stravaConfigured) return json({ error: "Strava n'est pas configuré." }, 503);
  const auth = await userFromRequest(req);
  if (!auth) return unauthorized();
  const body = (await req.json().catch(() => null)) as { code?: string; scope?: string } | null;
  if (!body?.code) return json({ error: "Code d'autorisation manquant." }, 400);
  if (!hasActivityScope(body.scope)) {
    return json({ error: "Autorise l'accès à tes activités pour pouvoir les importer." }, 400);
  }
  try {
    return json(await connect(auth.sb, auth.user.id, body.code, body.scope ?? ""));
  } catch (e) {
    const err = e instanceof StravaError ? e : new StravaError("Erreur Strava.");
    return json({ error: err.message }, err.status);
  }
}
