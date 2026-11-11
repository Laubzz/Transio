"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
 * Cadre des écrans de l'app : logo et boutons de menu en haut.
 * Renvoie au questionnaire s'il n'y a pas encore de plan.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const state = useAppState();
  const account = useAccount();
  const active = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="mx-auto flex min-h-full w-full max-w-6xl flex-1 flex-col px-4 pt-6 pb-12 md:px-8">
      {/* En-tête : le logo, puis les boutons du menu, comme dans Nolio. */}
      <header className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-white/10 pb-4">
        <Logo href="/aujourdhui" />
        <nav
          aria-label="Navigation principale"
          className="order-last flex w-full gap-1 overflow-x-auto md:order-none md:w-auto md:flex-1"
        >
          {NAV.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              aria-current={active(href) ? "page" : undefined}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap transition ${
                active(href) ? "bg-ink text-night" : "text-muted hover:bg-card-2 hover:text-ink"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
        {account.auth === "signed-in" && (
          <span className="ml-auto hidden text-xs text-muted sm:inline" title={account.email}>
            <SyncDot status={account.sync} /> {account.email}
          </span>
        )}
      </header>
      {state && (
        <p className="-mt-2 mb-6 text-sm text-muted">
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
