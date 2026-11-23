"use client";

import type { Profile, StrengthPlace } from "@/engine";
import { Segmented } from "./ui";

export interface StrengthChoice {
  /** Séances haut du corps par semaine. */
  haut: number;
  /** Séances bas du corps par semaine. */
  bas: number;
  mobility: boolean;
  place: StrengthPlace;
  /** Mode « guide du coureur » : salle + maison + routines autour des sorties. */
  guide: boolean;
  salle: number;
  maison: number;
}

/** Choix de départ, repris d'un profil existant. */
export function strengthChoiceOf(p: Profile | undefined): StrengthChoice {
  return {
    haut: p?.strengthBlocks?.haut ?? 0,
    bas: p?.strengthBlocks?.bas ?? (p ? Math.min(3, p.strengthPerWeek) : 1),
    mobility: p?.mobility ?? false,
    place: p?.strengthPlace ?? "maison",
    guide: Boolean(p?.strengthSplit),
    salle: p?.strengthSplit?.salle ?? 2,
    maison: p?.strengthSplit?.maison ?? 1,
  };
}

/** Nombre de séances de renfo par semaine. */
export const strengthCount = (c: StrengthChoice) => (c.guide ? c.salle + c.maison : c.haut + c.bas);

/** Champs du profil qui viennent de ce choix. */
export function strengthFields(c: StrengthChoice) {
  return c.guide
    ? {
        strengthPerWeek: c.salle + c.maison,
        strengthSplit: { salle: c.salle, maison: c.maison },
        strengthBlocks: undefined,
        mobility: false,
        strengthPlace: "les-deux" as const,
      }
    : {
        strengthPerWeek: c.haut + c.bas,
        strengthSplit: undefined,
        strengthBlocks: { haut: c.haut, bas: c.bas },
        mobility: c.mobility,
        strengthPlace: c.place,
      };
}

/** Phrase qui résume le mode guide : « 2 fois en salle et 1 fois à la maison ». */
export function guideSummary(salle: number, maison: number): string {
  const parts = [
    salle ? `${times(salle)} en salle` : "",
    maison ? `${times(maison)} à la maison` : "",
  ].filter(Boolean);
  return `Guide du coureur : ${parts.join(" et ") || "pas de séance dédiée"} par semaine, plus des routines courtes autour des sorties`;
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
  const total = strengthCount(value);
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Musculation et renforcement</h2>
        <p className="mt-1 text-sm text-muted">
          Par blocs (haut ou bas du corps), ou selon le guide du coureur : séances en salle, un jour
          dédié à la maison et des routines courtes autour des sorties.
        </p>
      </div>
      <Segmented
        label="Type de renforcement"
        value={value.guide ? "guide" : "blocs"}
        onChange={(v) => onChange({ ...value, guide: v === "guide" })}
        options={[
          { value: "blocs", label: "Par blocs haut / bas" },
          { value: "guide", label: "Guide du coureur" },
        ]}
      />
      {value.guide ? (
        <>
          <Segmented
            label="En salle (force générale, corps entier), par semaine"
            value={value.salle}
            onChange={(salle) => onChange({ ...value, salle })}
            options={COUNTS.map((n) => ({ value: n, label: String(n) }))}
          />
          <Segmented
            label="À la maison (jour dédié : jambe par jambe, chevilles, tronc), par semaine"
            value={value.maison}
            onChange={(maison) => onChange({ ...value, maison })}
            options={COUNTS.map((n) => ({ value: n, label: String(n) }))}
          />
          <p className="text-sm text-muted">
            Les jours de course, une routine de 5 à 15 min s&apos;ajoute : activation avant les
            séances de qualité, prévention après les footings, tronc et pieds le soir des séances
            dures. Rien de lourd dans les 48 h avant une séance clé.
          </p>
        </>
      ) : (
        <BlockQuestions value={value} onChange={onChange} total={total} />
      )}
      {total > max ? (
        <p className="text-sm text-warn" role="alert">
          Avec tes autres séances, il reste {max} jour{max > 1 ? "s" : ""} libre
          {max > 1 ? "s" : ""} dans la semaine. Retire {total - max} séance
          {total - max > 1 ? "s" : ""} de renforcement ou une séance de course.
        </p>
      ) : (
        <p className="text-sm text-muted first-letter:uppercase">
          {value.guide ? guideSummary(value.salle, value.maison) : strengthSummary(value)}.
        </p>
      )}
    </div>
  );
}

function BlockQuestions({
  value,
  onChange,
  total,
}: {
  value: StrengthChoice;
  onChange: (v: StrengthChoice) => void;
  total: number;
}) {
  return (
    <>
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
    </>
  );
}

/** Jours libres pour le renforcement, une fois la course et le sport d'origine placés. */
export const maxStrength = (runDays: number, keepOrigin: boolean) =>
  Math.min(4, 7 - runDays - (keepOrigin ? 1 : 0));
