"use client";

import { useSyncExternalStore } from "react";
import { normalizeState, type AppState } from "./state";
import { onLocalChange, readState, saveState } from "./store";
import { accountsEnabled, supabase } from "./supabase";

/**
 * Compte utilisateur et synchronisation de l'état avec la table `user_state`.
 *
 * - À la connexion, l'état du compte remplace la copie locale. Si le compte est vide,
 *   le plan déjà présent sur l'appareil y est envoyé (première connexion).
 * - Chaque changement local est envoyé au compte (regroupé sur une courte durée).
 * - À la déconnexion, la copie locale est effacée : les données appartiennent au compte.
 */
export type AuthStatus = "disabled" | "loading" | "signed-out" | "signed-in";
export type SyncStatus = "idle" | "loading" | "saving" | "saved" | "error";

export interface Account {
  auth: AuthStatus;
  email?: string;
  sync: SyncStatus;
  /** Lien de réinitialisation du mot de passe ouvert : on attend le nouveau mot de passe. */
  recovery: boolean;
}

let snapshot: Account = {
  auth: accountsEnabled ? "loading" : "disabled",
  sync: "idle",
  recovery: false,
};
const SERVER: Account = snapshot;
const listeners = new Set<() => void>();
let started = false;
let userId: string | null = null;
let pulledFor: string | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;

function set(patch: Partial<Account>) {
  snapshot = { ...snapshot, ...patch };
  listeners.forEach((l) => l());
}

async function pull(id: string) {
  const sb = supabase();
  if (!sb) return;
  set({ sync: "loading" });
  const { data, error } = await sb
    .from("user_state")
    .select("state")
    .eq("user_id", id)
    .maybeSingle();
  if (error) {
    set({ sync: "error" });
    return;
  }
  pulledFor = id;
  const remote = data ? normalizeState(data.state) : null;
  if (remote) {
    saveState(remote, { fromRemote: true });
    set({ sync: "saved" });
  } else {
    const local = readState();
    if (local) await push(local);
    else set({ sync: "idle" });
  }
}

async function push(state: AppState | null) {
  const sb = supabase();
  if (!sb || !userId || pulledFor !== userId) return;
  set({ sync: "saving" });
  const { error } = state
    ? await sb
        .from("user_state")
        .upsert({ user_id: userId, state, updated_at: new Date().toISOString() })
    : await sb.from("user_state").delete().eq("user_id", userId);
  set({ sync: error ? "error" : "saved" });
}

function start() {
  if (started) return;
  started = true;
  const sb = supabase();
  if (!sb) return;
  sb.auth.onAuthStateChange((event, session) => {
    const id = session?.user.id ?? null;
    const changedUser = id !== userId;
    userId = id;
    set({
      auth: session ? "signed-in" : "signed-out",
      email: session?.user.email ?? undefined,
      recovery: event === "PASSWORD_RECOVERY" ? true : snapshot.recovery,
    });
    if (event === "SIGNED_OUT") {
      pulledFor = null;
      saveState(null, { fromRemote: true });
      set({ sync: "idle", recovery: false });
    }
    // Pas d'appel Supabase directement dans ce rappel (recommandation de supabase-js).
    if (id && changedUser) setTimeout(() => void pull(id), 0);
  });
  onLocalChange((state) => {
    if (!userId) return;
    clearTimeout(timer);
    timer = setTimeout(() => void push(state), 600);
  });
}

function subscribe(cb: () => void) {
  start();
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useAccount(): Account {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => SERVER,
  );
}

export function endRecovery() {
  set({ recovery: false });
}

/** Messages d'erreur Supabase Auth traduits pour l'utilisateur. */
export function authErrorMessage(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login")) return "E-mail ou mot de passe incorrect.";
  if (m.includes("already registered") || m.includes("already been registered"))
    return "Un compte existe déjà avec cet e-mail. Connecte-toi.";
  if (m.includes("email not confirmed")) return "Confirme d'abord ton e-mail avec le lien reçu.";
  if (m.includes("password should be")) return "Le mot de passe doit faire au moins 8 caractères.";
  if (m.includes("rate limit")) return "Trop de tentatives. Réessaie dans quelques minutes.";
  if (m.includes("invalid email") || m.includes("unable to validate email"))
    return "Cet e-mail n'est pas valide.";
  return "Une erreur est survenue. Réessaie.";
}
