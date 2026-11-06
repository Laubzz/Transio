import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

/** Faux client Supabase : un jeton Strava encore valide pour l'utilisateur. */
const sb = {
  from: () => ({
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({
          data: {
            athlete_id: 1,
            access_token: "acces",
            refresh_token: "rafraichissement",
            expires_at: new Date(Date.now() + 3_600_000).toISOString(),
          },
        }),
      }),
    }),
  }),
} as unknown as SupabaseClient;

const summary = (id: number) => ({
  id,
  name: `Sortie ${id}`,
  sport_type: "Run",
  start_date_local: "2026-05-01T08:00:00Z",
  distance: 5000,
  moving_time: 1500,
  pr_count: 1,
});

let mod: typeof import("./strava");
beforeAll(async () => {
  vi.stubEnv("NEXT_PUBLIC_STRAVA_CLIENT_ID", "123");
  vi.stubEnv("STRAVA_CLIENT_SECRET", "secret");
  mod = await import("./strava");
});
afterEach(() => vi.unstubAllGlobals());

describe("import Strava (serveur)", () => {
  it("lit une page de 200 activités et signale qu'il en reste", async () => {
    const fetch = vi.fn(async (url: string) =>
      Response.json(
        url.includes("page=1") ? Array.from({ length: 200 }, (_, i) => summary(i + 1)) : [],
      ),
    );
    vi.stubGlobal("fetch", fetch);
    const first = await mod.importPage(sb, "u", 0, 1);
    expect(first.activities).toHaveLength(200);
    expect(first.more).toBe(true);
    expect(first.activities[0]).toMatchObject({ id: 1, sport: "course", prCount: 1 });
    expect(fetch.mock.calls[0][0]).toContain("after=0&per_page=200&page=1");
    const second = await mod.importPage(sb, "u", 0, 2);
    expect(second).toEqual({ activities: [], more: false });
  });

  it("lit les meilleurs efforts et s'arrête à la limite de requêtes", async () => {
    let n = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        n++;
        if (n === 1) {
          return Response.json({
            best_efforts: [
              { name: "1k", distance: 1000, elapsed_time: 280 },
              { name: "5k", distance: 5000, elapsed_time: 1490 },
            ],
          });
        }
        if (n === 2) return new Response("introuvable", { status: 404 });
        return new Response("trop", { status: 429 });
      }),
    );
    const r = await mod.activityDetails(sb, "u", [10, 11, 12, 13]);
    expect(r.rateLimited).toBe(true);
    expect(r.details).toEqual([
      {
        id: 10,
        bestEfforts: [
          { name: "1k", distanceM: 1000, elapsedSec: 280 },
          { name: "5k", distanceM: 5000, elapsedSec: 1490 },
        ],
      },
      { id: 11, bestEfforts: [] },
    ]);
  });

  it("indique les variables manquantes", () => {
    expect(mod.stravaConfigured).toBe(true);
    expect(mod.stravaMissing).toEqual([]);
  });
});
