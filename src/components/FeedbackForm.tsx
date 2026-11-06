"use client";

import { useId, useState } from "react";
import type { Pain, Session } from "@/engine";
import { RPE_LABEL } from "@/lib/labels";
import type { StoredFeedback } from "@/lib/state";
import { Button, Segmented } from "./ui";

/** Retour de séance : faite ou non, difficulté 1 à 10, gêne ou douleur, commentaire. */
export function FeedbackForm({
  session,
  initial,
  onSave,
  onCancel,
}: {
  session: Session;
  initial?: StoredFeedback;
  onSave: (fb: StoredFeedback) => void;
  onCancel?: () => void;
}) {
  const [done, setDone] = useState(initial?.done ?? true);
  const [rpe, setRpe] = useState(initial?.rpe ?? session.targetRpe);
  const [pain, setPain] = useState<Pain>(initial?.pain ?? "aucune");
  const [comment, setComment] = useState(initial?.comment ?? "");
  const id = useId();

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(done ? { done, rpe, pain, comment } : { done, comment });
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
