"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { finishStravaConnect, importFromStrava } from "@/lib/stravaClient";
import { useAccount } from "@/lib/sync";
import { Kicker } from "./ui";

/** Page de retour après l'autorisation Strava : finit la connexion puis importe les activités. */
export function StravaCallback() {
  const router = useRouter();
  const account = useAccount();
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current || account.auth !== "signed-in" || account.sync === "loading") return;
    started.current = true;
    const query = new URLSearchParams(window.location.search);
    finishStravaConnect(query)
      .then(() =>
        importFromStrava({
          onProgress: (p) =>
            setProgress(
              p.phase === "activites"
                ? `${p.done} activités reçues…`
                : `Lecture de tes records : ${p.done}/${p.total} sorties…`,
            ),
        }),
      )
      .then(() => router.replace("/profil#strava"))
      .catch((e: Error) => setError(e.message));
  }, [account.auth, account.sync, router]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-16">
      <Kicker>Strava</Kicker>
      {error ? (
        <>
          <h1 className="mt-2 text-2xl font-bold">La connexion n&apos;a pas abouti</h1>
          <p className="mt-2 text-warn">{error}</p>
          <Link href="/profil" className="mt-6 font-semibold text-target hover:underline">
            Retour au profil
          </Link>
        </>
      ) : account.auth === "signed-out" ? (
        <>
          <h1 className="mt-2 text-2xl font-bold">Connecte-toi d&apos;abord</h1>
          <Link href="/connexion" className="mt-6 font-semibold text-target hover:underline">
            Se connecter
          </Link>
        </>
      ) : (
        <>
          <h1 className="mt-2 text-2xl font-bold">Import de tout ton historique Strava…</h1>
          <p className="mt-2 text-muted">
            {progress ?? "Connexion à Strava…"} Garde cette page ouverte, ça peut prendre une
            minute.
          </p>
        </>
      )}
    </main>
  );
}
