import { json, unauthorized, userFromRequest } from "@/lib/server/auth";
import { disconnect } from "@/lib/server/strava";

/** Déconnecte Strava pour cet utilisateur. */
export async function DELETE(req: Request) {
  const auth = await userFromRequest(req);
  if (!auth) return unauthorized();
  await disconnect(auth.sb, auth.user.id);
  return json({ ok: true });
}
