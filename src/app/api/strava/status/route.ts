import { json, unauthorized, userFromRequest } from "@/lib/server/auth";
import { stravaConfigured, tokenRow } from "@/lib/server/strava";

/** La connexion Strava est-elle configurée sur le serveur, et active pour cet utilisateur ? */
export async function GET(req: Request) {
  // Lire la requête d'abord : la route reste dynamique, même quand Strava n'est pas configuré.
  const auth = await userFromRequest(req);
  if (!stravaConfigured) return json({ configured: false, connected: false });
  if (!auth) return unauthorized();
  const row = await tokenRow(auth.sb, auth.user.id);
  return json({ configured: true, connected: Boolean(row), athleteId: row?.athlete_id ?? null });
}
