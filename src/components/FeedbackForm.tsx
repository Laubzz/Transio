"use client";

import { useId, useState } from "react";
import type { Pain, Session } from "@/engine";
import { RPE_LABEL } from "@/lib/labels";
import type { Activity, StoredFeedback, StrengthSet } from "@/lib/state";
import { Button, Segmented } from "./ui";

const EMPTY_ROW: StrengthSet = { exercise: "", sets: 0, reps: 0, loadKg: 0 };
const INPUT =
  "w-full min-w-0 rounded-lg border border-white/15 bg-night px-2 py-2 text-sm focus:border-target focus:outline-none";

/** Retour de séance : faite ou non, difficulté 1 à 10, gêne ou douleur, commentaire. */
export function FeedbackForm({
  session,
  activity,
  initial,
  onSave,
  onCancel,
}: {
  session: Session;
  /** Activité Strava du jour : elle préremplit la durée. */
  activity?: Activity | null;
  initial?: StoredFeedback;
  onSave: (fb: StoredFeedback) => void;
  onCancel?: () => void;
}) {
  const [done, setDone] = useState(initial?.done ?? true);
  const [rpe, setRpe] = useState(initial?.rpe ?? session.targetRpe);
  const [pain, setPain] = useState<Pain>(initial?.pain ?? "aucune");
  const [comment, setComment] = useState(initial?.comment ?? "");
  const [duration, setDuration] = useState(
    initial?.durationMin ?? (activity ? Math.round(activity.movingSec / 60) : session.durationMin),
  );
  const [rows, setRows] = useState<StrengthSet[]>(
    initial?.strength ?? (session.kind === "renfo" ? [EMPTY_ROW] : []),
  );
  const id = useId();
  const setRow = (i: number, patch: Partial<StrengthSet>) =>
    setRows((cur) => cur.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(
          done
            ? { done, rpe, pain, comment, durationMin: duration, strength: rows }
            : { done, comment },
        );
      }}
    >
      <Segmented
        label="Séance"
        value={done ? "faite" : "pas-faite"}
        onChange={(v) => setDone(v === "faite")}
        options={[
          { value: "faite", label: "Faite" },
          { value: "pas-faite", label: "Pas faite", tone: "origin" },
        ]}
      />

      {done && (
        <>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold">
              Durée faite{" "}
              <span className="font-normal text-muted">(prévue : {session.durationMin} min)</span>
            </span>
            <span className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={600}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className={`${INPUT} w-24`}
              />
              <span className="text-sm text-muted">min</span>
            </span>
          </label>

          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <label htmlFor={`${id}-rpe`} className="text-sm font-semibold">
                Difficulté ressentie
              </label>
              <span className="text-sm">
                <strong className="tabular-nums">{rpe} / 10</strong>
                <span className="ml-2 text-muted">{RPE_LABEL[rpe]}</span>
              </span>
            </div>
            <input
              id={`${id}-rpe`}
              type="range"
              min={1}
              max={10}
              step={1}
              value={rpe}
              onChange={(e) => setRpe(Number(e.target.value))}
              className="w-full accent-target"
            />
            <p className="mt-1 text-xs text-muted">Prévu : {session.targetRpe} / 10</p>
          </div>

          <div>
            <Segmented
              label="Douleur ou gêne ?"
              value={pain}
              onChange={setPain}
              options={[
                { value: "aucune", label: "Aucune" },
                { value: "gene", label: "Gêne", tone: "origin" },
                { value: "douleur", label: "Douleur", tone: "warn" },
              ]}
            />
            {pain === "douleur" && (
              <p className="mt-2 text-sm text-warn">
                La semaine suivante sera allégée. Si la douleur persiste, parles-en à un
                professionnel de santé.
              </p>
            )}
          </div>

          {session.kind === "renfo" && (
            <fieldset>
              <legend className="mb-2 text-sm font-semibold">Journal muscu</legend>
              <div className="space-y-2">
                <div className="grid grid-cols-[1fr_3.5rem_3.5rem_4.5rem_2rem] gap-2 text-xs text-muted">
                  <span>Exercice</span>
                  <span>Séries</span>
                  <span>Reps</span>
                  <span>Charge (kg)</span>
                  <span />
                </div>
                {rows.map((r, i) => (
                  <div key={i} className="grid grid-cols-[1fr_3.5rem_3.5rem_4.5rem_2rem] gap-2">
                    <input
                      aria-label={`Exercice ${i + 1}`}
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
                      onClick={() => setRows((cur) => cur.filter((_, j) => j !== i))}
                      className="rounded-lg text-muted hover:text-warn"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setRows((cur) => [...cur, EMPTY_ROW])}
                  className="text-sm font-semibold text-target hover:underline"
                >
                  + Ajouter un exercice
                </button>
              </div>
            </fieldset>
          )}
        </>
      )}

      <div>
        <label htmlFor={`${id}-comment`} className="mb-2 block text-sm font-semibold">
          Commentaire <span className="font-normal text-muted">(facultatif)</span>
        </label>
        <textarea
          id={`${id}-comment`}
          rows={2}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={done ? "Sensations, allure, météo…" : "Pourquoi pas cette fois ?"}
          className="w-full rounded-xl border border-white/15 bg-night px-3 py-2 text-sm placeholder:text-muted/60 focus:border-target focus:outline-none"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="submit">Enregistrer</Button>
        {onCancel && (
          <Button variant="ghost" onClick={onCancel}>
            Annuler
          </Button>
        )}
      </div>
    </form>
  );
}
