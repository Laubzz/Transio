"use client";

import { useState } from "react";
import { SENSATION_LABEL, removeFreeSession, saveFreeSession } from "@/lib/coaching";
import { formatLong, type ISODate } from "@/lib/dates";
import type { Activity, AppState, FreeSession, Sensation, StrengthSet } from "@/lib/state";
import { saveState } from "@/lib/store";
import {
  ActivityPicker,
  CommentField,
  EMPTY_ROW,
  INPUT,
  RpeSlider,
  SensationPicker,
  StrengthEditor,
} from "./FormParts";
import { ActivitySummary } from "./WorkoutDetail";
import { Button, Segmented } from "./ui";

export const FREE_SPORT_LABEL: Record<FreeSession["sport"], string> = {
  course: "Course à pied",
  renfo: "Renfo / muscu",
  velo: "Vélo",
  autre: "Autre",
};

/** Saisie d'une séance faite hors plan. */
export function FreeSessionForm({
  state,
  date: initialDate,
  initial,
  onDone,
}: {
  state: AppState;
  date: ISODate;
  initial?: FreeSession;
  onDone: () => void;
}) {
  const [date, setDate] = useState(initial?.date ?? initialDate);
  const [sport, setSport] = useState<FreeSession["sport"]>(initial?.sport ?? "course");
  const [duration, setDuration] = useState(initial?.durationMin ?? 30);
  const [rpe, setRpe] = useState(initial?.rpe ?? 4);
  const [sensation, setSensation] = useState<Sensation | undefined>(initial?.sensation);
  const [comment, setComment] = useState(initial?.comment ?? "");
  const [rows, setRows] = useState<StrengthSet[]>(initial?.strength ?? [EMPTY_ROW]);
  const [activityId, setActivityId] = useState<number | undefined>(initial?.activityId);
  const [error, setError] = useState<string | null>(null);
  const candidates = (state.activities ?? []).filter((a) => a.date === date && a.sport !== "autre");

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        try {
          saveState(
            saveFreeSession(state, {
              id: initial?.id,
              date,
              sport,
              durationMin: duration,
              rpe,
              sensation,
              comment,
              strength: sport === "renfo" ? rows : undefined,
              activityId,
            }),
          );
          onDone();
        } catch (err) {
          setError((err as Error).message);
        }
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-2 block text-sm font-semibold">Date</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={`${INPUT} [color-scheme:light]`}
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-semibold">Durée (min)</span>
          <input
            type="number"
            min={5}
            max={600}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className={INPUT}
          />
        </label>
      </div>
      <Segmented
        label="Type de séance"
        value={sport}
        onChange={setSport}
        options={(Object.keys(FREE_SPORT_LABEL) as FreeSession["sport"][]).map((s) => ({
          value: s,
          label: FREE_SPORT_LABEL[s],
        }))}
      />
      <ActivityPicker
        candidates={candidates}
        value={activityId}
        onChange={(a?: Activity) => {
          setActivityId(a?.id);
          if (a) setDuration(Math.round(a.movingSec / 60));
        }}
      />
      <RpeSlider value={rpe} onChange={setRpe} />
      <SensationPicker value={sensation} onChange={setSensation} />
      {sport === "renfo" && (
        <StrengthEditor state={state} date={date} rows={rows} onChange={setRows} />
      )}
      <CommentField
        value={comment}
        onChange={setComment}
        placeholder="Ce que tu as fait, sensations…"
      />
      {error && <p className="text-sm text-warn">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit">Enregistrer la séance libre</Button>
        <Button variant="ghost" onClick={onDone}>
          Annuler
        </Button>
        {initial && (
          <Button
            variant="danger"
            onClick={() => {
              saveState(removeFreeSession(state, initial.id));
              onDone();
            }}
          >
            Supprimer
          </Button>
        )}
      </div>
    </form>
  );
}

/** Carte d'une séance libre, modifiable. */
export function FreeSessionCard({ state, fs }: { state: AppState; fs: FreeSession }) {
  const [editing, setEditing] = useState(false);
  const activity = (state.activities ?? []).find((a) => a.id === fs.activityId);
  return (
    <article className="rounded-2xl border border-dashed border-white/20 bg-card p-4">
      {editing ? (
        <FreeSessionForm
          state={state}
          date={fs.date}
          initial={fs}
          onDone={() => setEditing(false)}
        />
      ) : (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="text-sm">
            <p className="font-mono text-xs tracking-[0.2em] text-muted uppercase">
              Séance libre · {formatLong(fs.date)}
            </p>
            <p className="mt-1 text-lg font-extrabold">{FREE_SPORT_LABEL[fs.sport]}</p>
            <p>
              {fs.durationMin} min · {fs.rpe}/10
              {fs.sensation && ` · ${SENSATION_LABEL[fs.sensation].toLowerCase()}`}
            </p>
            {fs.strength?.map((r) => (
              <p key={r.exercise} className="text-muted">
                {r.exercise} · {r.sets} × {r.reps}
                {r.loadKg > 0 && ` · ${r.loadKg} kg`}
              </p>
            ))}
            {fs.comment && <p className="text-muted">« {fs.comment} »</p>}
            {activity && (
              <div className="mt-2">
                <ActivitySummary activity={activity} />
              </div>
            )}
          </div>
          <Button variant="ghost" className="px-4 py-2" onClick={() => setEditing(true)}>
            Modifier
          </Button>
        </div>
      )}
    </article>
  );
}

/** Bouton « + Séance libre » qui ouvre le formulaire sur place. */
export function AddFreeSession({
  state,
  date,
  label = "+ Séance libre",
}: {
  state: AppState;
  date: ISODate;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return open ? (
    <div className="rounded-2xl border border-white/10 bg-card p-4">
      <h3 className="mb-4 font-semibold">Nouvelle séance libre</h3>
      <FreeSessionForm state={state} date={date} onDone={() => setOpen(false)} />
    </div>
  ) : (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="w-full rounded-2xl border border-dashed border-white/20 px-4 py-3 text-sm font-semibold text-muted hover:border-white/40 hover:text-ink"
    >
      {label}
    </button>
  );
}
