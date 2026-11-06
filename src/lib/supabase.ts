"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/** Les comptes sont actifs dès que l'URL et la clé publique Supabase sont configurées. */
export const accountsEnabled = Boolean(url && key);

let client: SupabaseClient | null = null;

/** Client Supabase du navigateur ; `null` sans configuration ou côté serveur. */
export function supabase(): SupabaseClient | null {
  if (!accountsEnabled || typeof window === "undefined") return null;
  client ??= createClient(url!, key!, {
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
