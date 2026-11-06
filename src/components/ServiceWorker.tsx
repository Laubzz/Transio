"use client";

import { useEffect } from "react";

/** Enregistre le service worker en production (en dev, il gênerait le rechargement à chaud). */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // Pas bloquant : l'app fonctionne sans.
    });
  }, []);
  return null;
}
