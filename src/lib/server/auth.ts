import "server-only";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/**
 * Utilisateur à l'origine d'une requête, d'après le jeton `Authorization: Bearer …`.
 * Le client renvoyé agit en son nom : les règles RLS de la base s'appliquent.
 */
export async function userFromRequest(
  req: Request,
): Promise<{ sb: SupabaseClient; user: User } | null> {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token || !url || !key) return null;
  const sb = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) return null;
  return { sb, user: data.user };
}

export const json = (body: unknown, status = 200) => Response.json(body, { status });
export const unauthorized = () => json({ error: "Connecte-toi pour continuer." }, 401);
