import {
  INTENSITY_LABEL,
  buildWorkout,
  formatDuration,
  formatPace,
  target,
  type Profile,
  type RunBlock,
  type Session,
  type Week,
} from "@/engine";
import type { Activity } from "@/lib/state";
import { activityPace } from "@/lib/strava";

const DOT: Record<RunBlock["intensity"], string> = {
  marche: "bg-muted",
  endurance: "bg-target",
  seuil: "bg-[#c9a77e]",
  vma: "bg-origin",
  objectif: "bg-warn",
};

const km = (m: number) => `${String(m / 1000).replace(".", ",")} km`;

function duration(sec: number) {
  if (sec % 60 === 0) return `${sec / 60} min`;
  return sec < 60 ? `${sec} s` : `${formatDuration(sec)}`;
}

/** Détail d'une séance : blocs avec allures cibles, ou liste d'exercices de renfo. */
export function WorkoutDetail({
  profile,
  week,
  session,
}: {
  profile: Profile;
  week: Week;
  session: Session;
}) {
  const w = buildWorkout(profile, week, session);
  return (
    <div className="space-y-3">
      {w.blocks.length > 0 && (
        <ol className="space-y-2">
          {w.blocks.map((b, i) => (
            <li key={i} className="flex gap-3 text-sm">
              <span
                className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${DOT[b.intensity]}`}
                aria-hidden
              />
              <div>
                <p className="font-semibold">
                  {b.label}
                  {b.repeat > 1 ? (
                    <span className="font-normal">
                      {" "}
                      : {b.repeat} × {b.distanceM ? km(b.distanceM) : duration(b.workSec)}
                      {b.recoverySec &&
                        ` (récup ${duration(b.recoverySec)} ${b.recoveryIntensity === "marche" ? "en marchant" : "en trottinant"})`}
                    </span>
                  ) : (
                    b.workSec > 0 && (
                      <span className="font-normal">
                        {" "}
                        : {b.distanceM ? km(b.distanceM) : duration(b.workSec)}
                        {b.recoverySec && ` (puis récup ${duration(b.recoverySec)} en trottinant)`}
                      </span>
                    )
                  )}
                </p>
                <p className="text-muted">
                  {INTENSITY_LABEL[b.intensity]} · {target(profile, b.intensity)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}

      {w.exercises.length > 0 && (
        <ul className="divide-y divide-white/5 text-sm">
          {w.exercises.map((e) => (
            <li key={e.name} className="py-2">
              <p className="flex justify-between gap-3 font-semibold">
                <span>{e.name}</span>
                <span className="whitespace-nowrap tabular-nums">
                  {e.sets} × {e.reps}
                </span>
              </p>
              <p className="text-muted">{e.cue}</p>
            </li>
          ))}
        </ul>
      )}

      {w.notes.map((n) => (
        <p key={n} className="text-xs text-muted">
          {n}
        </p>
      ))}
    </div>
  );
}

/** Résumé d'une activité Strava. */
export function ActivitySummary({ activity }: { activity: Activity }) {
  const pace = activityPace(activity);
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <span className="rounded-full bg-[#fc4c02]/15 px-2 py-0.5 text-xs font-semibold text-[#fc4c02]">
        Strava
      </span>
      <span className="font-semibold">{activity.name}</span>
      {activity.distanceM > 0 && (
        <span className="tabular-nums">
          {(activity.distanceM / 1000).toFixed(2).replace(".", ",")} km
        </span>
      )}
      <span className="tabular-nums">{formatDuration(activity.movingSec)}</span>
      {pace && activity.sport === "course" && (
        <span className="tabular-nums">{formatPace(pace)} /km</span>
      )}
      {activity.avgHr && <span className="tabular-nums">FC {activity.avgHr}</span>}
      {activity.elevationM ? (
        <span className="tabular-nums">{activity.elevationM} m D+</span>
      ) : null}
      <StravaLink id={activity.id} />
    </p>
  );
}

/** Lien vers l'activité sur Strava. */
export function StravaLink({ id, label = "Voir sur Strava" }: { id: number; label?: string }) {
  return (
    <a
      href={`https://www.strava.com/activities/${id}`}
      target="_blank"
      rel="noopener noreferrer"
      className="text-xs font-semibold text-[#fc4c02] hover:underline"
    >
      {label} ↗
    </a>
  );
}
