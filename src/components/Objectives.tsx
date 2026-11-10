"use client";

import { useState } from "react";
import type { ObjectivePriority } from "@/engine";
import { daysBetween, formatLong, type ISODate } from "@/lib/dates";
import { preparedBy, removeObjective, saveObjective } from "@/lib/objectives";
import type { AppState } from "@/lib/state";
import { saveState } from "@/lib/store";
import { INPUT } from "./FormParts";
import { Button, Segmented } from "./ui";

const DISTANCES = [
  { value: 5, label: "5 km" },
  { value: 10, label: "10 km" },
  { value: 21.1, label: "Semi" },
  { value: 42.2, label: "Marathon" },
  { value: 0, label: "Autre" },
];
const km = (n: number) => `${String(n).replace(".", ",")} km`;

/** Objectifs du programme : courses principales et secondaires, avec leur effet sur le plan. */
export function ObjectivesCard({ state, today }: { state: AppState; today: ISODate }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [date, setDate] = useState("");
  const [distance, setDistance] = useState(10);
  const [custom, setCustom] = useState(15);
  const [priority, setPriority] = useState<ObjectivePriority>("principal");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const list = state.objectives ?? [];

  return (
    <section className="rounded-2xl border border-white/10 bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Tes objectifs</h2>
          <p className="mt-1 text-sm text-muted">
            Un objectif principal est la course que tu vises : la semaine est affûtée. Un objectif
            secondaire sert de préparation au prochain objectif principal.
          </p>
        </div>
        {!open && (
          <Button className="px-4 py-2" onClick={() => setOpen(true)}>
            + Ajouter un objectif
          </Button>
        )}
      </div>

      {list.length > 0 && (
        <ul className="mt-4 divide-y divide-white/5">
          {list.map((o) => {
            const days = daysBetween(today, o.date);
            return (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="text-sm">
                  <p className="font-semibold">
                    <span
                      className={`mr-2 rounded-full border px-2 py-0.5 text-xs ${
                        o.priority === "principal"
                          ? "border-[#a16207]/60 text-[#a16207]"
                          : "border-white/20 text-muted"
                      }`}
                    >
                      {o.priority === "principal" ? "Principal" : "Secondaire"}
                    </span>
                    {o.label} · {km(o.distanceKm)}
                  </p>
                  <p className="mt-1 text-muted first-letter:uppercase">
                    {formatLong(o.date)}
                    {days > 0
                      ? ` · dans ${days} jour${days > 1 ? "s" : ""}`
                      : days === 0
                        ? " · aujourd'hui"
                        : " · passé"}
                    {o.priority === "secondaire" && ` · prépare ${preparedBy(state, o)}`}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  className="px-4 py-2"
                  onClick={() => {
                    if (window.confirm(`Supprimer l'objectif « ${o.label} » ?`)) {
                      saveState(removeObjective(state, o.id, today));
                      setMessage(
                        `${o.label} est supprimé : le plan reprend sa progression normale.`,
                      );
                    }
                  }}
                >
                  Supprimer
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {message && (
        <p
          className="mt-4 rounded-xl border border-target/40 bg-target/10 p-3 text-sm"
          role="status"
        >
          {message}
        </p>
      )}

      {open && (
        <form
          className="mt-5 space-y-4 border-t border-white/10 pt-5"
          onSubmit={(e) => {
            e.preventDefault();
            try {
              const r = saveObjective(
                state,
                { label, date, distanceKm: distance || custom, priority },
                today,
              );
              saveState(r.state);
              setMessage(r.message);
              setError(null);
              setOpen(false);
              setLabel("");
              setDate("");
            } catch (err) {
              setError((err as Error).message);
            }
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold">Nom de la course</span>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="ex. 10 km de Paris"
                className={INPUT}
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold">Date</span>
              <input
                type="date"
                min={today}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={`${INPUT} [color-scheme:light]`}
              />
            </label>
          </div>
          <Segmented label="Distance" value={distance} onChange={setDistance} options={DISTANCES} />
          {distance === 0 && (
            <label className="block max-w-40">
              <span className="mb-2 block text-sm font-semibold">Distance (km)</span>
              <input
                type="number"
                min={1}
                max={100}
                step={0.1}
                value={custom}
                onChange={(e) => setCustom(Number(e.target.value))}
                className={INPUT}
              />
            </label>
          )}
          <Segmented
            label="Type d'objectif"
            value={priority}
            onChange={setPriority}
            options={[
              { value: "principal", label: "Principal" },
              { value: "secondaire", label: "Secondaire (préparation)" },
            ]}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" className="px-4 py-2">
              Enregistrer l&apos;objectif
            </Button>
            <Button variant="ghost" className="px-4 py-2" onClick={() => setOpen(false)}>
              Annuler
            </Button>
          </div>
          {error && (
            <p className="text-sm text-warn" role="alert">
              {error}
            </p>
          )}
        </form>
      )}
    </section>
  );
}
