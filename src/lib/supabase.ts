"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { ACCOUNTS_ENABLED, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./config";

/** Comptes actifs, sauf désactivation explicite (`NEXT_PUBLIC_ACCOUNTS=off`). */
export const accountsEnabled = ACCOUNTS_ENABLED;

let client: SupabaseClient | null = null;

/** Client Supabase du navigateur ; `null` sans configuration ou côté serveur. */
export function supabase(): SupabaseClient | null {
  if (!accountsEnabled || typeof window === "undefined") return null;
  client ??= createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return client;
}

/** Jeton de la session en cours, pour appeler les routes serveur de l'app. */
export async function accessToken(): Promise<string | null> {
  const sb = supabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session?.access_token ?? null;
}
