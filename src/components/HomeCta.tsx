"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAppState } from "@/lib/store";
import { useAccount } from "@/lib/sync";
import { ButtonLink } from "./ui";

/**
 * Sur l'accueil : envoie vers l'app si un plan existe ; sinon propose de créer un compte
 * (ou directement un plan quand les comptes ne sont pas configurés).
 */
export function HomeCta() {
  const state = useAppState();
  const account = useAccount();
  const router = useRouter();
  const ready = account.auth !== "loading" && account.sync !== "loading";
  const signedOut = account.auth === "signed-out";

  useEffect(() => {
    if (ready && !signedOut && state) router.replace("/aujourdhui");
  }, [ready, signedOut, state, router]);

  if (signedOut) {
    return (
      <div className="flex flex-wrap gap-2">
        <ButtonLink href="/inscription">Créer un compte</ButtonLink>
        <ButtonLink href="/connexion" variant="ghost">
          Se connecter
        </ButtonLink>
      </div>
    );
  }
  return state ? (
    <ButtonLink href="/aujourdhui">Ouvrir mon plan</ButtonLink>
  ) : (
    <ButtonLink href="/questionnaire">Créer mon plan</ButtonLink>
  );
}
