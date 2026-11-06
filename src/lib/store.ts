"use client";

import { useSyncExternalStore } from "react";
import { toISO, type ISODate } from "./dates";
import { parseState, type AppState } from "./state";

/**
 * Sauvegarde locale (localStorage) de l'état de l'app, en attendant Supabase.
 * Si le navigateur refuse le stockage, l'état reste en mémoire pour la session.
 */
const KEY = "transio:v1";
const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cached: AppState | null = null;
let memoryOnly = false;

function read(): AppState | null {
  if (memoryOnly) return cached;
  let raw: string | null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return cached;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cached = parseState(raw);
  }
  return cached;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => e.key === KEY && cb();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function saveState(state: AppState | null) {
  const raw = state ? JSON.stringify(state) : null;
  try {
    if (raw) localStorage.setItem(KEY, raw);
    else localStorage.removeItem(KEY);
    memoryOnly = false;
  } catch {
    memoryOnly = true;
  }
  cachedRaw = raw;
  cached = state;
  listeners.forEach((l) => l());
}

/** `undefined` tant que le navigateur n'a pas été lu (rendu serveur, hydratation). */
export function useAppState(): AppState | null | undefined {
  return useSyncExternalStore(subscribe, read, () => undefined);
}

function subscribeClock(cb: () => void) {
  const id = window.setInterval(cb, 60_000);
  return () => window.clearInterval(id);
}

/** Date du jour (AAAA-MM-JJ), lue côté navigateur et mise à jour au changement de jour. */
export function useToday(): ISODate | undefined {
  return useSyncExternalStore(
    subscribeClock,
    () => toISO(new Date()),
    () => undefined,
  );
}
