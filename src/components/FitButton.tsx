"use client";

import { useState } from "react";
import type { Profile, Session, Week } from "@/engine";
import type { ISODate } from "@/lib/dates";
import { KIND_LABEL } from "@/lib/labels";

/** Télécharge la séance au format FIT, à copier sur une montre Garmin ou importer dans Garmin Connect. */
export function FitButton({
  profile,
  week,
  session,
  date,
}: {
  profile: Profile;
  week: Week;
  session: Session;
  date: ISODate;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      className="mt-3 text-sm font-medium text-ink underline underline-offset-2 hover:no-underline disabled:opacity-50"
      onClick={async () => {
        setBusy(true);
        // Chargé à la demande : le SDK FIT est volumineux.
        const { workoutFit } = await import("@/lib/fit");
        const name = `Transio S${week.index} ${KIND_LABEL[session.kind]}`;
        const bytes = workoutFit(profile, week, session, name);
        setBusy(false);
        if (!bytes) return;
        const blob = new Blob([bytes.slice()], { type: "application/vnd.ant.fit" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${date}_S${week.index}_${session.kind}.fit`;
        a.click();
        URL.revokeObjectURL(a.href);
      }}
    >
      {busy ? "Préparation…" : "Envoyer à ma montre (.FIT)"}
    </button>
  );
}
