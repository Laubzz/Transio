"use client";

import { useState } from "react";
import type { Session, StrengthFocus } from "@/engine";
import { sessionDate, type ISODate } from "@/lib/dates";
import { DAYS_SHORT, sessionLabel } from "@/lib/labels";
import {
  ADDABLE_KINDS,
  addSession,
  freeDays,
  moveSession,
  removeSession,
  type AddableKind,
  type EditResult,
} from "@/lib/planEdit";
import { feedbackKey, isReviewed, type AppState } from "@/lib/state";
import { saveState } from "@/lib/store";
import { INPUT } from "./FormParts";
import { Button, Segmented } from "./ui";

const DEFAULT_MIN: Record<AddableKind, number> = {
  endurance: 30,
  "sortie-longue": 60,
  tempo: 35,
  fractionne: 35,
  renfo: 40,
  "sport-origine": 60,
};

export type EditNotice = { text: string; tone: "ok" | "warn" };

function run(
  action: () => EditResult,
  onDone: (n: EditNotice) => void,
  onError: (m: string) => void,
) {
  try {
    const r = action();
    saveState(r.state);
    onDone({
      text: r.message,
      tone: r.adjusted || r.message.includes("Attention") ? "warn" : "ok",
    });
  } catch (e) {
    onError((e as Error).message);
  }
}

/** Déplacer ou supprimer une séance prévue qui n'est pas encore notée. */
export function SessionActions({
  state,
  weekIndex,
  session,
  today,
  onDone,
}: {
  state: AppState;
  weekIndex: number;
  session: Session;
  today: ISODate;
  onDone: (n: EditNotice) => void;
}) {
  const [moving, setMoving] = useState(false);
  const [toWeek, setToWeek] = useState(weekIndex);
  const [toDay, setToDay] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (isReviewed(state, weekIndex) || state.feedback[feedbackKey(weekIndex, session.day)]) {
    return null;
  }
  const fixed = session.kind === "test" || session.kind === "objectif";
  const weeks = state.plan.weeks
    .filter((w) => (fixed ? w.index === weekIndex : true))
    .filter((w) => freeDays(state, w.index, today).length > 0);
  const days = freeDays(state, toWeek, today);

  return (
    <div className="rounded-lg border border-white/10 bg-card p-4">
      <h3 className="font-semibold">Modifier cette séance</h3>
      <p className="mt-1 text-sm text-muted">
        La charge de la semaine et les courbes de forme sont recalculées après chaque changement.
      </p>
      {moving ? (
        <form
          className="mt-4 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (toDay === null) return setError("Choisis un jour.");
            run(
              () =>
                moveSession(
                  state,
                  { week: weekIndex, day: session.day },
                  { week: toWeek, day: toDay },
                  today,
                ),
              onDone,
              setError,
            );
          }}
        >
          {!fixed && (
            <label className="block max-w-xs">
              <span className="mb-2 block text-sm font-semibold">Vers la semaine</span>
              <select
                value={toWeek}
                onChange={(e) => {
                  setToWeek(Number(e.target.value));
                  setToDay(null);
                }}
                className={INPUT}
              >
                {weeks.map((w) => (
                  <option key={w.index} value={w.index}>
                    Semaine {w.index}
                    {w.index === weekIndex ? " (la même)" : ""}
                  </option>
                ))}
              </select>
            </label>
          )}
          {days.length ? (
            <Segmented
              label="Jour libre"
              value={toDay ?? -1}
              onChange={setToDay}
              options={days.map((d) => ({ value: d, label: DAYS_SHORT[d] }))}
            />
          ) : (
            <p className="text-sm text-muted">Aucun jour libre dans cette semaine.</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" className="px-4 py-2" disabled={toDay === null}>
              Déplacer la séance
            </Button>
            <Button variant="ghost" className="px-4 py-2" onClick={() => setMoving(false)}>
              Annuler
            </Button>
          </div>
        </form>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="ghost" className="px-4 py-2" onClick={() => setMoving(true)}>
            Déplacer
          </Button>
          <Button
            variant="danger"
            className="px-4 py-2"
            onClick={() => {
              if (window.confirm("Supprimer cette séance du plan ?")) {
                run(() => removeSession(state, weekIndex, session.day), onDone, setError);
              }
            }}
          >
            Supprimer
          </Button>
        </div>
      )}
      {error && (
        <p className="mt-3 text-sm text-warn" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** Programmer une nouvelle séance un jour libre. */
export function AddPlannedForm({
  state,
  weekIndex,
  day,
  today,
  originLabel,
  onDone,
  onCancel,
}: {
  state: AppState;
  weekIndex: number;
  day: number;
  today: ISODate;
  originLabel: string;
  onDone: (n: EditNotice) => void;
  onCancel: () => void;
}) {
  const kinds = ADDABLE_KINDS.filter(
    (k) => k !== "sport-origine" || state.plan.profile.originSport !== "reprise",
  );
  const [kind, setKind] = useState<AddableKind>("endurance");
  const [minutes, setMinutes] = useState(DEFAULT_MIN.endurance);
  const [focus, setFocus] = useState<StrengthFocus | "complet">("complet");
  const [error, setError] = useState<string | null>(null);
  const date = sessionDate(state.startDate, weekIndex, day);

  return (
    <form
      className="space-y-4 rounded-lg border border-white/10 bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () =>
            addSession(
              state,
              weekIndex,
              day,
              { kind, durationMin: minutes, focus: focus === "complet" ? undefined : focus },
              today,
            ),
          onDone,
          setError,
        );
      }}
    >
      <h3 className="font-semibold">
        Programmer une séance · {DAYS_SHORT[day]} {Number(date.slice(8))}
      </h3>
      <Segmented
        label="Type de séance"
        value={kind}
        onChange={(k) => {
          setKind(k);
          setMinutes(DEFAULT_MIN[k]);
        }}
        options={kinds.map((k) => ({ value: k, label: sessionLabel(k, originLabel) }))}
      />
      {kind === "renfo" && (
        <Segmented
          label="Bloc travaillé"
          value={focus}
          onChange={setFocus}
          options={[
            { value: "complet", label: "Renfo coureur" },
            { value: "bas", label: "Bas du corps" },
            { value: "haut", label: "Haut du corps" },
          ]}
        />
      )}
      <label className="block max-w-40">
        <span className="mb-2 block text-sm font-semibold">Durée (min)</span>
        <input
          type="number"
          min={15}
          max={300}
          step={5}
          value={minutes}
          onChange={(e) => setMinutes(Number(e.target.value))}
          className={INPUT}
        />
      </label>
      <p className="text-sm text-muted">
        Si la séance fait dépasser de plus de 10 % la charge prévue de la semaine, elle est
        raccourcie automatiquement.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" className="px-4 py-2">
          Programmer
        </Button>
        <Button variant="ghost" className="px-4 py-2" onClick={onCancel}>
          Annuler
        </Button>
      </div>
      {error && (
        <p className="text-sm text-warn" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
