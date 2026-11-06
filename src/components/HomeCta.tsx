"use client";

import { useAppState } from "@/lib/store";
import { ButtonLink } from "./ui";

/** Bouton d'accueil : créer un plan, ou reprendre celui enregistré sur l'appareil. */
export function HomeCta() {
  const state = useAppState();
  return state ? (
    <ButtonLink href="/aujourdhui">Ouvrir mon plan</ButtonLink>
  ) : (
    <ButtonLink href="/questionnaire">Créer mon plan</ButtonLink>
  );
}
