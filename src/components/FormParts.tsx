"use client";

import { useId } from "react";
import { formatDuration, formatPace } from "@/engine";
import { SENSATION_LABEL } from "@/lib/coaching";
import { formatShort, type ISODate } from "@/lib/dates";
import { exerciseNames, lastStrength } from "@/lib/insights";
import { RPE_LABEL } from "@/lib/labels";
import type { Activity, AppState, Sensation, StrengthSet } from "@/lib/state";
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

/** Journal muscu : exercices avec suggestions et rappel de la dernière perf. */
export function StrengthEditor({
  state,
  date,
  rows,
  onChange,
}: {
  state: AppState;
  date: ISODate;
  rows: StrengthSet[];
  onChange: (rows: StrengthSet[]) => void;
}) {
  const listId = useId();
  const setRow = (i: number, patch: Partial<StrengthSet>) =>
    onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold">Journal muscu</legend>
      <datalist id={listId}>
        {exerciseNames(state).map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
      <div className="space-y-2">
        <div className="grid grid-cols-[1fr_3.5rem_3.5rem_4.5rem_2rem] gap-2 text-xs text-muted">
          <span>Exercice</span>
          <span>Séries</span>
          <span>Reps</span>
          <span>Charge (kg)</span>
          <span />
        </div>
        {rows.map((r, i) => {
          const last = lastStrength(state, r.exercise, date);
          return (
            <div key={i}>
              <div className="grid grid-cols-[1fr_3.5rem_3.5rem_4.5rem_2rem] gap-2">
                <input
                  aria-label={`Exercice ${i + 1}`}
                  list={listId}
                  value={r.exercise}
                  onChange={(e) => setRow(i, { exercise: e.target.value })}
                  placeholder="Presse, mollets…"
                  className={INPUT}
                />
                <input
                  aria-label={`Séries, exercice ${i + 1}`}
                  type="number"
                  min={1}
                  value={r.sets || ""}
                  onChange={(e) => setRow(i, { sets: Number(e.target.value) })}
                  className={INPUT}
                />
                <input
                  aria-label={`Répétitions, exercice ${i + 1}`}
                  type="number"
                  min={1}
                  value={r.reps || ""}
                  onChange={(e) => setRow(i, { reps: Number(e.target.value) })}
                  className={INPUT}
                />
                <input
                  aria-label={`Charge en kg, exercice ${i + 1}`}
                  type="number"
                  min={0}
                  step={0.5}
                  value={r.loadKg || ""}
                  onChange={(e) => setRow(i, { loadKg: Number(e.target.value) })}
                  className={INPUT}
                />
                <button
                  type="button"
                  aria-label={`Retirer l'exercice ${i + 1}`}
                  onClick={() => onChange(rows.filter((_, j) => j !== i))}
                  className="rounded-lg text-muted hover:text-warn"
                >
                  ×
                </button>
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
