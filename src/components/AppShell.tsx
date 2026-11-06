"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { GOAL_LABEL, ORIGIN_LABEL } from "@/engine";
import { useAppState } from "@/lib/store";
import { CalendarIcon, ChartIcon, JournalIcon, ProfileIcon, TodayIcon } from "./icons";
import { ButtonLink } from "./ui";

export const NAV = [
  { href: "/aujourdhui", label: "Aujourd'hui", Icon: TodayIcon },
  { href: "/calendrier", label: "Calendrier", Icon: CalendarIcon },
  { href: "/analyses", label: "Analyses", Icon: ChartIcon },
  { href: "/journal", label: "Journal", Icon: JournalIcon },
  { href: "/profil", label: "Profil", Icon: ProfileIcon },
] as const;

function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`font-extrabold tracking-tight ${className}`}>
      Trans
      <span className="bg-gradient-to-r from-origin to-target bg-clip-text text-transparent">
        io
      </span>
    </Link>
  );
}

/**
 * Cadre des écrans de l'app : barre latérale sur ordinateur, onglets en bas sur mobile.
 * Renvoie au questionnaire s'il n'y a pas encore de plan.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const state = useAppState();
  const active = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="flex min-h-full flex-1">
      {/* Barre latérale (ordinateur) */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-white/10 bg-card/40 px-3 py-6 md:flex">
        <Logo className="mb-8 px-3 text-2xl" />
        <nav aria-label="Navigation principale" className="flex flex-col gap-1">
          {NAV.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={active(href) ? "page" : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                active(href) ? "bg-white/10 text-ink" : "text-muted hover:bg-white/5 hover:text-ink"
              }`}
            >
              <Icon className={active(href) ? "text-target" : ""} />
              {label}
            </Link>
          ))}
        </nav>
        {state && (
          <div className="mt-auto rounded-xl border border-white/10 p-3 text-xs text-muted">
            <p className="font-semibold text-ink">
              {ORIGIN_LABEL[state.plan.profile.originSport]} → course
            </p>
            <p>
              {GOAL_LABEL[state.plan.profile.goal]} · {state.plan.weeks.length} semaines
            </p>
          </div>
        )}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* En-tête (mobile) */}
        <header className="sticky top-0 z-10 border-b border-white/10 bg-night/85 px-4 py-3 backdrop-blur md:hidden">
          <Logo className="text-lg" />
        </header>

        <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-6 pb-28 md:px-8 md:pt-10 md:pb-12">
          {state === undefined ? (
            <p className="text-muted">Chargement…</p>
          ) : state === null ? (
            <div className="py-16 text-center">
              <h1 className="text-2xl font-bold">Pas encore de plan</h1>
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

        {/* Onglets (mobile) */}
        <nav
          aria-label="Navigation principale"
          className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-5 border-t border-white/10 bg-night/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
        >
          {NAV.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={active(href) ? "page" : undefined}
              className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold ${
                active(href) ? "text-target" : "text-muted"
              }`}
            >
              <Icon />
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
