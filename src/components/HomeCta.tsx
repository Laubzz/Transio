"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAppState } from "@/lib/store";
import { ButtonLink } from "./ui";

/** Sur l'accueil : envoie directement vers l'app si un plan existe, sinon propose d'en créer un. */
export function HomeCta() {
  const state = useAppState();
  const router = useRouter();
  useEffect(() => {
    if (state) router.replace("/aujourdhui");
  }, [state, router]);

  return state ? (
    <ButtonLink href="/aujourdhui">Ouvrir mon plan</ButtonLink>
  ) : (
    <ButtonLink href="/questionnaire">Créer mon plan</ButtonLink>
  );
}
