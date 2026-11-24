"use client";

import { useId, useState } from "react";
import { EXERCISE_CATALOGUE, formatDuration, formatPace, parseDuration } from "@/engine";
import { SENSATION_LABEL } from "@/lib/coaching";
import { formatShort, type ISODate } from "@/lib/dates";
import { exerciseNames, lastStrength } from "@/lib/insights";
import { RPE_LABEL } from "@/lib/labels";
import type { Activity, AppState, Sensation, StrengthSet } from "@/lib/state";
import { completeRun, type RunLog } from "@/lib/runLog";
import { activityPace } from "@/lib/strava";
import { Segmented } from "./ui";

export const INPUT =
  "w-full min-w-0 rounded-lg border border-white/10 bg-night px-2 py-2 text-sm focus:border-ink focus:outline-none";
export const EMPTY_ROW: StrengthSet = { exercise: "", sets: 0, reps: 0, loadKg: 0 };

export function RpeSlider({
  value,
  onChange,
  target,
}: {
  value: number;
  onChange: (v: number) => void;
  target?: number;
}) {
  const id = useId();
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <label htmlFor={id} className="text-sm font-semibold">
          Difficulté ressentie
        </label>
        <span className="text-sm">
          <strong className="tabular-nums">{value} / 10</strong>
          <span className="ml-2 text-muted">{RPE_LABEL[value]}</span>
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={1}
        max={10}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-target"
      />
      {target !== undefined && <p className="mt-1 text-xs text-muted">Prévu : {target} / 10</p>}
    </div>
  );
}

export function SensationPicker({
  value,
  onChange,
}: {
  value: Sensation | undefined;
  onChange: (v: Sensation) => void;
}) {
  return (
    <Segmented
      label="Sensations"
      value={value ?? ("" as Sensation)}
      onChange={onChange}
      options={(Object.keys(SENSATION_LABEL) as Sensation[]).map((s) => ({
        value: s,
        label: SENSATION_LABEL[s],
        tone: s === "bof" ? "origin" : s === "horrible" ? "warn" : undefined,
      }))}
    />
  );
}

/** Choix de l'activité Strava du jour à lier au retour. */
export function ActivityPicker({
  candidates,
  value,
  onChange,
}: {
  candidates: Activity[];
  value: number | undefined;
  onChange: (a: Activity | undefined) => void;
}) {
  const id = useId();
  if (!candidates.length) return null;
  const label = (a: Activity) => {
    const pace = activityPace(a);
    return [
      a.name,
      a.distanceM ? `${(a.distanceM / 1000).toFixed(1).replace(".", ",")} km` : "",
      formatDuration(a.movingSec),
      pace && a.sport === "course" ? `${formatPace(pace)} /km` : "",
    ]
      .filter(Boolean)
      .join(" · ");
  };
  return (
    <label htmlFor={id} className="block">
      <span className="mb-2 block text-sm font-semibold">Activité Strava liée</span>
      <select
        id={id}
        value={value ?? ""}
        onChange={(e) => onChange(candidates.find((a) => a.id === Number(e.target.value)))}
        className={INPUT}
      >
        <option value="">Aucune</option>
        {candidates.map((a) => (
          <option key={a.id} value={a.id}>
            {label(a)}
          </option>
        ))}
      </select>
    </label>
  );
}

const OTHER = "__autre__";

/** Groupes de la liste déroulante des exercices, sans doublon. */
function exerciseGroups(state: AppState, suggested: string[], kind: "salle" | "renfo") {
  const seen = new Set<string>();
  const take = (names: string[]) => names.filter((n) => n && !seen.has(n) && seen.add(n));
  const [first, second] =
    kind === "salle"
      ? [
          ["En salle", EXERCISE_CATALOGUE.salle] as const,
          ["Maison (guide)", EXERCISE_CATALOGUE.maison] as const,
        ]
      : [
          ["Maison (guide)", EXERCISE_CATALOGUE.maison] as const,
          ["En salle", EXERCISE_CATALOGUE.salle] as const,
        ];
  return [
    { label: "Prévu aujourd'hui", names: take(suggested) },
    { label: first[0], names: take([...first[1]]) },
    { label: second[0], names: take([...second[1]]) },
    { label: "Autres exercices", names: take(exerciseNames(state)) },
  ].filter((g) => g.names.length);
}

/** Journal muscu : exercice choisi dans une liste, séries, reps, charge, dernière perf. */
export function StrengthEditor({
  state,
  date,
  rows,
  onChange,
  suggested = [],
  kind = "renfo",
}: {
  state: AppState;
  date: ISODate;
  rows: StrengthSet[];
  onChange: (rows: StrengthSet[]) => void;
  /** Exercices prévus pour la séance, en tête de liste. */
  suggested?: string[];
  kind?: "salle" | "renfo";
}) {
  const groups = exerciseGroups(state, suggested, kind);
  const known = new Set(groups.flatMap((g) => g.names));
  // Lignes en saisie libre (« Autre… ») : l'exercice n'est pas dans la liste.
  const [custom, setCustom] = useState<Set<number>>(
    () => new Set(rows.flatMap((r, i) => (r.exercise && !known.has(r.exercise) ? [i] : []))),
  );
  const setRow = (i: number, patch: Partial<StrengthSet>) =>
    onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const remove = (i: number) => {
    onChange(rows.filter((_, j) => j !== i));
    setCustom(new Set([...custom].filter((j) => j !== i).map((j) => (j > i ? j - 1 : j))));
  };
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold">
        {kind === "salle" ? "Exercices en salle" : "Exercices de renfo"}
      </legend>
      <div className="space-y-3">
        {rows.map((r, i) => {
          const last = lastStrength(state, r.exercise, date);
          const isCustom = custom.has(i);
          return (
            <div key={i} className="rounded-lg border border-white/10 p-2">
              <div className="flex gap-2">
                <select
                  aria-label={`Exercice ${i + 1}`}
                  value={isCustom ? OTHER : r.exercise}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === OTHER) {
                      setCustom(new Set(custom).add(i));
                      setRow(i, { exercise: "" });
                    } else {
                      const next = new Set(custom);
                      next.delete(i);
                      setCustom(next);
                      setRow(i, { exercise: v });
                    }
                  }}
                  className={INPUT}
                >
                  <option value="">Choisis un exercice</option>
                  {groups.map((g) => (
                    <optgroup key={g.label} label={g.label}>
                      {g.names.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                  <option value={OTHER}>Autre…</option>
                </select>
                <button
                  type="button"
                  aria-label={`Retirer l'exercice ${i + 1}`}
                  onClick={() => remove(i)}
                  className="w-8 shrink-0 rounded-lg text-muted hover:text-warn"
                >
                  ×
                </button>
              </div>
              {isCustom && (
                <input
                  aria-label={`Nom de l'exercice ${i + 1}`}
                  value={r.exercise}
                  onChange={(e) => setRow(i, { exercise: e.target.value })}
                  placeholder="Nom de l'exercice"
                  className={`${INPUT} mt-2`}
                />
              )}
              <div className="mt-2 grid grid-cols-3 gap-2">
                <label className="text-xs text-muted">
                  Séries
                  <input
                    aria-label={`Séries, exercice ${i + 1}`}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={r.sets || ""}
                    onChange={(e) => setRow(i, { sets: Number(e.target.value) })}
                    className={`${INPUT} mt-1`}
                  />
                </label>
                <label className="text-xs text-muted">
                  Reps
                  <input
                    aria-label={`Répétitions, exercice ${i + 1}`}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={r.reps || ""}
                    onChange={(e) => setRow(i, { reps: Number(e.target.value) })}
                    className={`${INPUT} mt-1`}
                  />
                </label>
                <label className="text-xs text-muted">
                  Charge (kg)
                  <input
                    aria-label={`Charge en kg, exercice ${i + 1}`}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step={0.5}
                    value={r.loadKg || ""}
                    onChange={(e) => setRow(i, { loadKg: Number(e.target.value) })}
                    placeholder="0"
                    className={`${INPUT} mt-1`}
                  />
                </label>
              </div>
              {last && (
                <p className="mt-1 text-xs text-muted">
                  Dernière fois ({formatShort(last.date)}) : {last.sets} × {last.reps}
                  {last.loadKg > 0 && ` à ${String(last.loadKg).replace(".", ",")} kg`}
                </p>
              )}
            </div>
          );
        })}
        <p className="text-xs text-muted">
          {rows.length} exercice{rows.length > 1 ? "s" : ""}. Charge vide ou 0 : poids du corps.
        </p>
        <button
          type="button"
          onClick={() => onChange([...rows, EMPTY_ROW])}
          className="text-sm font-medium text-ink underline underline-offset-2 hover:no-underline"
        >
          + Ajouter un exercice
        </button>
      </div>
    </fieldset>
  );
}

const num = (t: string) => {
  const n = Number(t.replace(",", ".").trim());
  return t.trim() && Number.isFinite(n) && n > 0 ? n : undefined;
};

/**
 * Sortie de course : distance, dénivelé, allure et temps. Le temps se calcule depuis
 * la distance et l'allure, l'allure depuis la distance et le temps.
 */
export function RunFields({ value, onChange }: { value: RunLog; onChange: (r: RunLog) => void }) {
  const [text, setText] = useState({
    distance: value.distanceKm ? String(value.distanceKm).replace(".", ",") : "",
    elevation: value.elevationM ? String(value.elevationM) : "",
    pace: value.paceSec ? formatPace(value.paceSec) : "",
    time: value.timeSec ? formatDuration(value.timeSec) : "",
  });
  const update = (field: keyof typeof text, t: string) => {
    const next = { ...text, [field]: t };
    let r: RunLog = {
      ...value,
      distanceKm: num(next.distance),
      elevationM: num(next.elevation),
      paceSec: parseDuration(next.pace) ?? undefined,
      timeSec: parseDuration(next.time) ?? undefined,
    };
    if (field === "distance" || field === "pace" || field === "time") {
      r = completeRun(r, field);
      // Le champ calculé se met à jour ; celui qu'on tape reste tel quel.
      if (field !== "time" && r.timeSec) next.time = formatDuration(r.timeSec);
      if (field !== "pace" && r.paceSec && (field === "time" || !text.pace.trim()))
        next.pace = formatPace(r.paceSec);
    }
    setText(next);
    onChange(r);
  };
  const field = (
    key: keyof typeof text,
    label: string,
    placeholder: string,
    mode: "decimal" | "numeric",
  ) => (
    <label className="block text-sm font-semibold">
      {label}
      <input
        value={text[key]}
        onChange={(e) => update(key, e.target.value)}
        inputMode={mode}
        placeholder={placeholder}
        className={`${INPUT} mt-1 font-normal`}
      />
    </label>
  );
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold">Ta sortie</legend>
      <div className="grid grid-cols-2 gap-3">
        {field("distance", "Distance (km)", "10,5", "decimal")}
        {field("elevation", "Dénivelé + (m)", "150", "numeric")}
        {field("pace", "Allure (min/km)", "5:30", "numeric")}
        {field("time", "Temps", "57:45", "numeric")}
      </div>
      <p className="mt-2 text-xs text-muted">
        Donne la distance et l&apos;allure, ou la distance et le temps : le reste se calcule. Sur
        téléphone, « 530 » ou « 5.30 » se lit 5:30.
      </p>
    </fieldset>
  );
}

export function CommentField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-semibold">
        Commentaire <span className="font-normal text-muted">(facultatif)</span>
      </label>
      <textarea
        id={id}
        rows={2}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-white/10 bg-night px-3 py-2 text-sm placeholder:text-muted/60 focus:border-ink focus:outline-none"
      />
    </div>
  );
}
