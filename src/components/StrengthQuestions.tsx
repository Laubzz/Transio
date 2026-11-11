"use client";

import type { StrengthPlace } from "@/engine";
import { Segmented } from "./ui";

export interface StrengthChoice {
  /** Séances haut du corps par semaine. */
  haut: number;
  /** Séances bas du corps par semaine. */
  bas: number;
  mobility: boolean;
  place: StrengthPlace;
}

const COUNTS = [0, 1, 2, 3];
const times = (n: number) => (n === 1 ? "1 fois" : `${n} fois`);

/** Phrase qui résume les blocs choisis : « 2 fois le haut du corps et 1 fois le bas ». */
export function strengthSummary(c: Pick<StrengthChoice, "haut" | "bas" | "mobility">): string {
  const parts = [
    c.haut ? `${times(c.haut)} le haut du corps` : "",
    c.bas ? `${times(c.bas)} le bas du corps` : "",
  ].filter(Boolean);
  if (!parts.length) return "Pas de renforcement";
  return `${parts.join(" et ")} par semaine${c.mobility ? ", avec 10 min de mobilité à la fin" : ""}`;
}

/**
 * Questions sur le renforcement : combien de fois par semaine travailler le haut et le bas du
 * corps, ajouter ou non de la mobilité, et où s'entraîner. `max` est le nombre de jours libres.
 */
export function StrengthQuestions({
  value,
  onChange,
  max,
}: {
  value: StrengthChoice;
  onChange: (v: StrengthChoice) => void;
  max: number;
}) {
  const total = value.haut + value.bas;
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Musculation et renforcement</h2>
        <p className="mt-1 text-sm text-muted">
          Choisis combien de fois par semaine tu veux travailler chaque bloc. Par exemple : 2 fois
          le haut du corps et 1 fois le bas.
        </p>
      </div>
      <Segmented
        label="Bas du corps (mollets, cuisses, fessiers), par semaine"
        value={value.bas}
        onChange={(bas) => onChange({ ...value, bas })}
        options={COUNTS.map((n) => ({ value: n, label: String(n) }))}
      />
      <Segmented
        label="Haut du corps (dos, épaules, pectoraux, bras), par semaine"
        value={value.haut}
        onChange={(haut) => onChange({ ...value, haut })}
        options={COUNTS.map((n) => ({ value: n, label: String(n) }))}
      />
      {total > 0 && (
        <>
          <Segmented
            label="Ajouter de la mobilité en complément ?"
            value={value.mobility ? "oui" : "non"}
            onChange={(v) => onChange({ ...value, mobility: v === "oui" })}
            options={[
              { value: "oui", label: "Oui, 10 min en fin de séance" },
              { value: "non", label: "Non" },
            ]}
          />
          <Segmented
            label="Où préfères-tu faire ton renforcement ?"
            value={value.place}
            onChange={(place) => onChange({ ...value, place })}
            options={[
              { value: "maison", label: "À la maison" },
              { value: "salle", label: "En salle de muscu" },
              { value: "les-deux", label: "Les deux" },
            ]}
          />
        </>
      )}
      {total > max ? (
        <p className="text-sm text-warn" role="alert">
          Avec tes autres séances, il reste {max} jour{max > 1 ? "s" : ""} libre
          {max > 1 ? "s" : ""} dans la semaine. Retire {total - max} séance
          {total - max > 1 ? "s" : ""} de renforcement ou une séance de course.
        </p>
      ) : (
        <p className="text-sm text-muted first-letter:uppercase">{strengthSummary(value)}.</p>
      )}
    </div>
  );
}

/** Jours libres pour le renforcement, une fois la course et le sport d'origine placés. */
export const maxStrength = (runDays: number, keepOrigin: boolean) =>
  Math.min(4, 7 - runDays - (keepOrigin ? 1 : 0));
