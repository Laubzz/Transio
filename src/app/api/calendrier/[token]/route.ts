import { createClient } from "@supabase/supabase-js";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/config";
import { buildCalendar } from "@/lib/ics";
import { normalizeState } from "@/lib/state";

/**
 * Lien d'abonnement d'agenda (Google Agenda, Apple Calendrier, Outlook) : renvoie le plan au
 * format iCalendar. Le jeton secret de 32 caractères est le seul accès ; la fonction
 * `calendar_state` ne renvoie que le plan qui lui est associé.
 */
export async function GET(_req: Request, ctx: RouteContext<"/api/calendrier/[token]">) {
  const { token } = await ctx.params;
  const clean = token.replace(/\.ics$/, "");
  if (!/^[a-f0-9]{32}$/.test(clean)) return new Response("Lien invalide", { status: 404 });

  const sb = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await sb.rpc("calendar_state", { feed_token: clean });
  if (error) return new Response("Agenda indisponible", { status: 502 });
  const state = normalizeState(data);
  if (!state) return new Response("Lien inconnu ou désactivé", { status: 404 });

  return new Response(buildCalendar(state, { time: state.calendar?.time ?? null }), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="transio.ics"',
      "Cache-Control": "private, max-age=900",
    },
  });
}
