"use client";

import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { GOAL_LABEL, ORIGIN_LABEL } from "@/engine";
import { useAppState } from "@/lib/store";
import { useAccount } from "@/lib/sync";
import { ButtonLink, Logo } from "./ui";

export const NAV = [
  { href: "/aujourdhui", label: "Aujourd'hui" },
  { href: "/calendrier", label: "Calendrier" },
  { href: "/analyses", label: "Analyses" },
  { href: "/journal", label: "Journal et records" },
  { href: "/profil", label: "Profil" },
] as const;

/**
 * Cadre des écrans de l'app : logo et menu déroulant en haut, comme le tableau de bord Pacio.
 * Renvoie au questionnaire s'il n'y a pas encore de plan.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const state = useAppState();
  const account = useAccount();
  const active = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const current = NAV.find((n) => active(n.href))?.href ?? "";

  return (
    <div className="mx-auto flex min-h-full w-full max-w-6xl flex-1 flex-col px-4 pt-6 pb-12 md:px-8">
      {/* En-tête : le logo à gauche, le menu à droite, comme dans Pacio. */}
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Logo href="/aujourdhui" />
        <div className="flex items-center gap-3">
          {account.auth === "signed-in" && (
            <span className="hidden text-xs text-muted sm:inline" title={account.email}>
              <SyncDot status={account.sync} /> {account.email}
            </span>
          )}
          <label className="flex items-center gap-2 text-xs text-muted">
            Menu
            <select
              aria-label="Menu"
              value={current}
              onChange={(e) => router.push(e.target.value)}
              className="rounded-lg border border-white/10 bg-card px-2 py-1.5 text-sm text-ink"
            >
              {current === "" && <option value="">Choisir…</option>}
              {NAV.map(({ href, label }) => (
                <option key={href} value={href}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>
      {state && (
        <p className="-mt-3 mb-6 text-sm text-muted">
          {(state.plan.profile.cycle ?? 1) > 1
            ? `Cycle ${state.plan.profile.cycle} · après la transition`
            : `${ORIGIN_LABEL[state.plan.profile.originSport]} vers la course`}{" "}
          · objectif {GOAL_LABEL[state.plan.profile.goal]} · {state.plan.weeks.length} semaines
        </p>
      )}

      <main className="flex-1">
        {state === undefined ||
        account.auth === "loading" ||
        (account.auth === "signed-in" && account.sync === "loading") ? (
          <p className="text-muted">Chargement…</p>
        ) : account.auth === "signed-out" ? (
          <div className="py-16 text-center">
            <h1 className="font-serif text-[1.375rem]">Connecte-toi pour retrouver ton plan</h1>
            <p className="mt-2 text-muted">
              Ton compte garde ton plan et tes séances d&apos;un appareil à l&apos;autre.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <ButtonLink href="/connexion">Se connecter</ButtonLink>
              <ButtonLink href="/inscription" variant="ghost">
                Créer un compte
              </ButtonLink>
            </div>
          </div>
        ) : state === null ? (
          <div className="py-16 text-center">
            <h1 className="font-serif text-[1.375rem]">Pas encore de plan</h1>
            <p className="mt-2 text-muted">
              Réponds à quelques questions sur ton sport d&apos;origine pour générer ton plan.
            </p>
            <ButtonLink href="/questionnaire" className="mt-6">
              Créer mon plan
            </ButtonLink>
          </div>
        ) : (
          children
        )}
      </main>
    </div>
  );
}

const SYNC_LABEL = {
  idle: "Compte",
  loading: "Chargement du compte",
  saving: "Enregistrement…",
  saved: "Enregistré dans ton compte",
  error: "Erreur de synchronisation",
} as const;

function SyncDot({ status }: { status: keyof typeof SYNC_LABEL }) {
  const color =
    status === "error"
      ? "bg-warn"
      : status === "saving" || status === "loading"
        ? "bg-origin"
        : "bg-target";
  return (
    <span
      role="img"
      aria-label={SYNC_LABEL[status]}
      title={SYNC_LABEL[status]}
      className={`mr-1 inline-block h-2 w-2 rounded-full align-middle ${color}`}
    />
  );
}
