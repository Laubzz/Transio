"use client";

import { useState } from "react";
import { buildWorkout, type Pain, type Session } from "@/engine";
import { MISS_ACTION_LABEL, MISS_CAUSE_LABEL, freeDayFor, proposeMiss } from "@/lib/coaching";
import { formatLong, sessionDate, type ISODate } from "@/lib/dates";
import { DONE_TYPE_LABEL, type DoneType, type RunLog } from "@/lib/runLog";
import type {
  Activity,
  AppState,
  MissAction,
  MissCause,
  Sensation,
  StoredFeedback,
  StrengthSet,
} from "@/lib/state";
import {
  ActivityPicker,
  CommentField,
  EMPTY_ROW,
  INPUT,
  RpeSlider,
  RunFields,
  SensationPicker,
  StrengthEditor,
} from "./FormParts";
import { Button, Segmented } from "./ui";

export interface MissChoice {
  cause: MissCause;
  action: MissAction;
  movedTo?: number;
  comment?: string;
}

/** Type de séance prévu, pour pré-choisir ce qui a été fait. */
function plannedType(s: Session): DoneType | undefined {
  if (s.kind === "renfo") return s.place === "salle" ? "salle" : "renfo";
  return s.impact ? "course" : undefined;
}

/** Exercices prévus, sans le bloc du jour dédié, avec séries et reps lisibles. */
function plannedRows(state: AppState, weekIndex: number, s: Session): StrengthSet[] {
  if (s.kind !== "renfo") return [];
  const w = buildWorkout(state.plan.profile, state.plan.weeks[weekIndex - 1], s);
  return w.exercises.map((e) => ({
    exercise: e.name.split(" · ").pop()!,
    sets: e.sets,
    reps: parseInt(e.reps, 10) || 0,
    loadKg: 0,
  }));
}

/**
 * Retour de séance. Faite : durée, difficulté, sensations, gêne ou douleur, activité Strava,
 * journal muscu, commentaire. Pas faite : pourquoi, et que faire de la séance.
 */
export function FeedbackForm({
  state,
  weekIndex,
  session,
  today,
  candidates,
  initial,
  onSave,
  onMiss,
  onCancel,
}: {
  state: AppState;
  weekIndex: number;
  session: Session;
  today: ISODate;
  /** Activités Strava du même jour. */
  candidates: Activity[];
  initial?: StoredFeedback;
  onSave: (fb: StoredFeedback) => void;
  onMiss: (miss: MissChoice) => void;
  onCancel?: () => void;
}) {
  const date = sessionDate(state.startDate, weekIndex, session.day);
  const defaultActivity =
    candidates.find((a) => a.id === initial?.activityId) ??
    (initial ? undefined : candidates.length === 1 ? candidates[0] : undefined);
  const [done, setDone] = useState(initial ? initial.done : true);
  const [rpe, setRpe] = useState(initial?.rpe ?? session.targetRpe);
  const [pain, setPain] = useState<Pain>(initial?.pain ?? "aucune");
  const [sensation, setSensation] = useState<Sensation | undefined>(initial?.sensation);
  const [comment, setComment] = useState(initial?.comment ?? "");
  const [activity, setActivity] = useState<Activity | undefined>(defaultActivity);
  const [duration, setDuration] = useState(
    initial?.durationMin ??
      (defaultActivity ? Math.round(defaultActivity.movingSec / 60) : session.durationMin),
  );
  const planned = plannedRows(state, weekIndex, session);
  const [doneType, setDoneType] = useState<DoneType | undefined>(
    initial?.doneType ?? plannedType(session),
  );
  const [run, setRun] = useState<RunLog>(
    initial?.run ??
      (defaultActivity && defaultActivity.sport === "course"
        ? {
            distanceKm: Math.round(defaultActivity.distanceM / 10) / 100,
            elevationM: defaultActivity.elevationM
              ? Math.round(defaultActivity.elevationM)
              : undefined,
            timeSec: defaultActivity.movingSec,
            paceSec: defaultActivity.distanceM
              ? Math.round(defaultActivity.movingSec / (defaultActivity.distanceM / 1000))
              : undefined,
          }
        : {}),
  );
  const [rows, setRows] = useState<StrengthSet[]>(
    initial?.strength ?? (planned.length ? planned : [EMPTY_ROW]),
  );
  const [cause, setCause] = useState<MissCause | undefined>(initial?.missed?.cause);
  const [action, setAction] = useState<MissAction | undefined>(initial?.missed?.action);
  const [movedTo, setMovedTo] = useState<number | undefined>(undefined);

  const free = freeDayFor(state, weekIndex, session.day, today);
  const freeDays = [0, 1, 2, 3, 4, 5, 6].filter(
    (d) =>
      d > session.day &&
      !state.plan.weeks[weekIndex - 1].sessions.some((s) => s.day === d) &&
      sessionDate(state.startDate, weekIndex, d) >= today,
  );
  const missOk = cause && action && (action !== "reporter" || movedTo !== undefined);

  const pickCause = (c: MissCause) => {
    setCause(c);
    const p = proposeMiss(state, weekIndex, session.day, c, today);
    setAction(p.action);
    setMovedTo(p.movedTo);
  };

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!done) {
          if (missOk) onMiss({ cause: cause!, action: action!, movedTo, comment });
          return;
        }
        const isRun = doneType === "course";
        onSave({
          done: true,
          rpe,
          pain,
          sensation,
          comment,
          doneType,
          // Pour une course, la durée vient du temps saisi.
          durationMin: isRun && run.timeSec ? Math.round(run.timeSec / 60) : duration,
          run: isRun ? run : undefined,
          strength: doneType === "renfo" || doneType === "salle" ? rows : undefined,
          activityId: activity?.id,
        });
      }}
    >
      <Segmented
        label="As-tu fait cette séance ?"
        value={done ? "faite" : "pas-faite"}
        onChange={(v) => setDone(v === "faite")}
        options={[
          { value: "faite", label: "Oui, faite" },
          { value: "pas-faite", label: "Non, pas faite", tone: "origin" },
        ]}
      />

      {done ? (
        <>
          <ActivityPicker
            candidates={candidates}
            value={activity?.id}
            onChange={(a) => {
              setActivity(a);
              if (a) setDuration(Math.round(a.movingSec / 60));
              if (a && a.sport === "course" && a.distanceM) {
                setRun({
                  distanceKm: Math.round(a.distanceM / 10) / 100,
                  elevationM: a.elevationM ? Math.round(a.elevationM) : undefined,
                  timeSec: a.movingSec,
                  paceSec: Math.round(a.movingSec / (a.distanceM / 1000)),
                });
              }
            }}
          />
          <Segmented
            label="Type de séance faite"
            value={doneType ?? ("" as DoneType)}
            onChange={setDoneType}
            options={(Object.keys(DONE_TYPE_LABEL) as DoneType[]).map((t) => ({
              value: t,
              label: DONE_TYPE_LABEL[t],
            }))}
          />
          {doneType === "course" ? (
            <RunFields key={activity?.id ?? "manuel"} value={run} onChange={setRun} />
          ) : (
            <label className="block">
              <span className="mb-2 block text-sm font-semibold">
                Durée faite{" "}
                <span className="font-normal text-muted">
                  (prévue : {session.durationMin} min{activity ? ", remplie depuis Strava" : ""})
                </span>
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
          )}
          <RpeSlider value={rpe} onChange={setRpe} target={session.targetRpe} />
          <SensationPicker value={sensation} onChange={setSensation} />
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
          {(doneType === "renfo" || doneType === "salle") && (
            <StrengthEditor
              state={state}
              date={date}
              rows={rows}
              onChange={setRows}
              suggested={planned.map((r) => r.exercise)}
              kind={doneType}
            />
          )}
        </>
      ) : (
        <div className="space-y-4 rounded-lg border border-dashed border-origin/50 p-4">
          <Segmented
            label="Pourquoi ?"
            value={cause ?? ("" as MissCause)}
            onChange={pickCause}
            options={(Object.keys(MISS_CAUSE_LABEL) as MissCause[]).map((c) => ({
              value: c,
              label: MISS_CAUSE_LABEL[c],
              tone: "origin",
            }))}
          />
          {cause && (
            <>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold">Que faire de la séance ?</span>
                <select
                  value={action}
                  onChange={(e) => {
                    const a = e.target.value as MissAction;
                    setAction(a);
                    if (a === "reporter" && movedTo === undefined) setMovedTo(free ?? undefined);
                  }}
                  className={INPUT}
                >
                  {(Object.keys(MISS_ACTION_LABEL) as MissAction[])
                    .filter((a) => a !== "reporter" || freeDays.length)
                    .map((a) => (
                      <option key={a} value={a}>
                        {MISS_ACTION_LABEL[a]}
                      </option>
                    ))}
                </select>
              </label>
              {action === "reporter" && (
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold">Nouveau jour</span>
                  <select
                    value={movedTo ?? ""}
                    onChange={(e) => setMovedTo(Number(e.target.value))}
                    className={INPUT}
                  >
                    {freeDays.map((d) => (
                      <option key={d} value={d}>
                        {formatLong(sessionDate(state.startDate, weekIndex, d))}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <p className="text-sm">
                {action === "reporter"
                  ? "La séance passe à ce jour, à l'identique : la charge de la semaine reste la même. Garde un jour facile avant une séance dure."
                  : action === "alleger"
                    ? "Pas de rattrapage : les 2 prochaines séances sont raccourcies pour laisser le corps récupérer."
                    : action === "ajouter"
                      ? "Quelques minutes sont ajoutées à la prochaine séance facile pour garder à peu près la même charge."
                      : "La séance est abandonnée, sans rattrapage. Ne double pas la prochaine séance."}
              </p>
            </>
          )}
        </div>
      )}

      <CommentField
        value={comment}
        onChange={setComment}
        placeholder={
          done ? "Jambes, souffle, sommeil, météo, ce qui a été dur…" : "Ce qui s'est passé"
        }
      />

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={!done && !missOk}>
          {done ? "Enregistrer" : "Enregistrer la séance non faite"}
        </Button>
        {onCancel && (
          <Button variant="ghost" onClick={onCancel}>
            Annuler
          </Button>
        )}
      </div>
    </form>
  );
}
