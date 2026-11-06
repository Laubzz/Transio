"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useAppState } from "@/lib/store";
import { ButtonLink } from "./ui";

const LINKS = [
  { href: "/aujourdhui", label: "Aujourd'hui" },
  { href: "/planning", label: "Planning" },
] as const;

/** Cadre des écrans du plan : navigation, et renvoi au questionnaire s'il n'y a pas de plan. */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const state = useAppState();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-night/85 backdrop-blur">
        <nav className="mx-auto flex max-w-3xl items-center gap-1 px-4 py-3">
          <Link href="/" className="mr-auto text-lg font-extrabold tracking-tight">
            Trans
            <span className="bg-gradient-to-r from-origin to-target bg-clip-text text-transparent">
              io
            </span>
          </Link>
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={pathname === l.href ? "page" : undefined}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                pathname === l.href ? "bg-white/10 text-ink" : "text-muted hover:text-ink"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
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
    </div>
  );
}
