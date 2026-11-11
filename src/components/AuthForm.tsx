"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { readState } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { authErrorMessage, endRecovery, useAccount } from "@/lib/sync";
import { Button, Kicker, Logo } from "./ui";

const INPUT =
  "w-full rounded-lg border border-white/10 bg-night px-3 py-2.5 focus:border-ink focus:outline-none";

function Shell({
  kicker,
  title,
  children,
}: {
  kicker: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12">
      <Logo className="mb-10" />
      <Kicker>{kicker}</Kicker>
      <h1 className="mt-2 mb-6 font-serif text-[1.375rem] font-normal">{title}</h1>
      {children}
    </main>
  );
}

/** Connexion ou création de compte, par e-mail et mot de passe. */
export function AuthForm({ mode }: { mode: "connexion" | "inscription" }) {
  const router = useRouter();
  const account = useAccount();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const signup = mode === "inscription";

  // Une fois connecté (et l'état du compte chargé), on entre dans l'app.
  useEffect(() => {
    if (account.auth === "signed-in" && account.sync !== "loading") {
      // Sans plan dans le compte (et sans erreur de chargement), on crée le premier.
      router.replace(readState() || account.sync === "error" ? "/aujourdhui" : "/questionnaire");
    }
  }, [account.auth, account.sync, router]);

  if (account.auth === "disabled") {
    return (
      <Shell kicker="Compte" title="Comptes pas encore activés">
        <p className="text-muted">
          Cette version fonctionne sans compte : tes données restent sur cet appareil.
        </p>
      </Shell>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const sb = supabase();
    if (!sb) return;
    setBusy(true);
    setError(null);
    const { data, error: err } = signup
      ? await sb.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: `${window.location.origin}/connexion` },
        })
      : await sb.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (err) setError(authErrorMessage(err.message));
    else if (signup && !data.session) setSent(true);
  };

  if (sent) {
    return (
      <Shell kicker="Inscription" title="Vérifie tes e-mails">
        <p className="text-muted">
          Un lien de confirmation a été envoyé à <strong className="text-ink">{email}</strong>.
          Clique dessus pour activer ton compte, puis connecte-toi.
        </p>
        <Link
          href="/connexion"
          className="mt-6 font-medium text-ink underline underline-offset-2 hover:no-underline"
        >
          Aller à la connexion
        </Link>
      </Shell>
    );
  }

  return (
    <Shell
      kicker={signup ? "Inscription" : "Connexion"}
      title={signup ? "Crée ton compte" : "Content de te revoir"}
    >
      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className="mb-2 block text-sm font-semibold">E-mail</span>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={INPUT}
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-semibold">Mot de passe</span>
          <input
            type="password"
            autoComplete={signup ? "new-password" : "current-password"}
            required
            minLength={signup ? 8 : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={INPUT}
          />
          {signup && <span className="mt-1 block text-xs text-muted">Au moins 8 caractères.</span>}
        </label>
        {error && (
          <p role="alert" className="text-sm text-warn">
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? "Un instant…" : signup ? "Créer mon compte" : "Se connecter"}
        </Button>
      </form>
      <div className="mt-6 space-y-2 text-sm text-muted">
        {signup ? (
          <p>
            Déjà un compte ?{" "}
            <Link
              href="/connexion"
              className="font-medium text-ink underline underline-offset-2 hover:no-underline"
            >
              Se connecter
            </Link>
          </p>
        ) : (
          <>
            <p>
              Pas encore de compte ?{" "}
              <Link
                href="/inscription"
                className="font-medium text-ink underline underline-offset-2 hover:no-underline"
              >
                Créer un compte
              </Link>
            </p>
            <p>
              <Link href="/mot-de-passe" className="hover:text-ink hover:underline">
                Mot de passe oublié ?
              </Link>
            </p>
          </>
        )}
      </div>
    </Shell>
  );
}

/** Mot de passe oublié : demande du lien, puis choix du nouveau mot de passe. */
export function PasswordReset() {
  const router = useRouter();
  const account = useAccount();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const sb = supabase();

  if (account.recovery) {
    return (
      <Shell kicker="Mot de passe" title="Choisis un nouveau mot de passe">
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!sb) return;
            setBusy(true);
            const { error: err } = await sb.auth.updateUser({ password });
            setBusy(false);
            if (err) setError(authErrorMessage(err.message));
            else {
              endRecovery();
              router.replace("/aujourdhui");
            }
          }}
        >
          <input
            type="password"
            autoComplete="new-password"
            aria-label="Nouveau mot de passe"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={INPUT}
          />
          {error && <p className="text-sm text-warn">{error}</p>}
          <Button type="submit" disabled={busy} className="w-full">
            Enregistrer
          </Button>
        </form>
      </Shell>
    );
  }

  return (
    <Shell kicker="Mot de passe" title="Mot de passe oublié">
      {sent ? (
        <p className="text-muted">
          Si un compte existe pour <strong className="text-ink">{email}</strong>, tu vas recevoir un
          lien pour choisir un nouveau mot de passe.
        </p>
      ) : (
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!sb) return;
            setBusy(true);
            const { error: err } = await sb.auth.resetPasswordForEmail(email.trim(), {
              redirectTo: `${window.location.origin}/mot-de-passe`,
            });
            setBusy(false);
            if (err) setError(authErrorMessage(err.message));
            else setSent(true);
          }}
        >
          <label className="block">
            <span className="mb-2 block text-sm font-semibold">E-mail du compte</span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={INPUT}
            />
          </label>
          {error && <p className="text-sm text-warn">{error}</p>}
          <Button type="submit" disabled={busy || !sb} className="w-full">
            Recevoir le lien
          </Button>
        </form>
      )}
      <Link
        href="/connexion"
        className="mt-6 text-sm font-medium text-ink underline underline-offset-2 hover:no-underline"
      >
        Retour à la connexion
      </Link>
    </Shell>
  );
}
