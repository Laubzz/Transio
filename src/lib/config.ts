/**
 * Configuration publique de Supabase. L'URL et la clé « publishable » sont faites pour être
 * visibles dans le navigateur : les règles RLS de la base protègent les données. Les variables
 * d'environnement permettent de pointer vers un autre projet (développement, recette).
 */
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://fvbbwlpbpcgpwyjmaxju.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "sb_publishable_EZTUGXfb23ppeLhZ6_FjAA_vzOCV0Ob";

/** `NEXT_PUBLIC_ACCOUNTS=off` désactive les comptes (tests, développement hors ligne). */
export const ACCOUNTS_ENABLED = process.env.NEXT_PUBLIC_ACCOUNTS !== "off";
