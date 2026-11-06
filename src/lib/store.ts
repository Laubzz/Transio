"use client";

import { useSyncExternalStore } from "react";
import { toISO, type ISODate } from "./dates";
import { parseState, type AppState } from "./state";

/**
 * État de l'app gardé sur l'appareil (localStorage). Avec un compte, `sync.ts` le recopie
 * dans la base et le recharge sur les autres appareils ; cette copie locale sert de cache.
 * Si le navigateur refuse le stockage, l'état reste en mémoire pour la session.
 */
const KEY = "transio:v1";
const listeners = new Set<() => void>();
const changeHandlers = new Set<(state: AppState | null) => void>();
let cachedRaw: string | null | undefined;
let cached: AppState | null = null;
let memoryOnly = false;

export function readState(): AppState | null {
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

/**
 * Enregistre l'état. Par défaut le changement est aussi envoyé vers le compte ;
 * `fromRemote` sert quand l'état vient du compte (ou à la déconnexion) pour ne pas le renvoyer.
 */
export function saveState(state: AppState | null, opts: { fromRemote?: boolean } = {}) {
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
  if (!opts.fromRemote) changeHandlers.forEach((h) => h(state));
}

/** Prévient à chaque changement fait dans l'app (utilisé par la synchronisation). */
export function onLocalChange(handler: (state: AppState | null) => void) {
  changeHandlers.add(handler);
  return () => changeHandlers.delete(handler);
}

/** `undefined` tant que le navigateur n'a pas été lu (rendu serveur, hydratation). */
export function useAppState(): AppState | null | undefined {
  return useSyncExternalStore(subscribe, readState, () => undefined);
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
