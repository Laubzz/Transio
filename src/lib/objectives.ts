import {
  GOAL_LABEL,
  RULES,
  formatDuration,
  formatPace,
  lastBuildUpTo,
  rebuildFrom,
  startMinutes,
  type PlanObjective,
} from "@/engine";
import { daysBetween, formatLong, sessionDate, type ISODate } from "./dates";
import { isReviewed, type AppState, type Objective } from "./state";

const same = (a: PlanObjective, b: PlanObjective) =>
  a.week === b.week &&
  a.day === b.day &&
  a.priority === b.priority &&
  a.distanceKm === b.distanceKm &&
  a.label === b.label &&
  a.targetSec === b.targetSec &&
  !!a.hilly === !!b.hilly &&
  !!a.easy === !!b.easy;

/** Ce que le commentaire d'un objectif apprend sur la course. */
export interface ObjectiveHints {
  targetSec?: number;
  hilly?: boolean;
  easy?: boolean;
}

const HILLY = /d[ée]nivel|vallonn|c[ôo]tes?\b|mont[ée]es?|\bd\+|trail|montagne/i;
const EASY = /premi[èe]re|d[ée]couv|finir|terminer|sans chrono|pas de chrono|plaisir|tranquille/i;

/**
 * Lit le commentaire d'un objectif, avec des règles simples : un temps visé (« 45:00 »,
 * « 1h45 », « 44'30 », « 50 min »), un parcours vallonné, une course pour finir sans chrono.
 * Un temps n'est retenu que s'il donne une allure plausible (2:30 à 10:00 /km).
 */
export function readComment(comment: string | undefined, distanceKm: number): ObjectiveHints {
  const text = (comment ?? "").toLowerCase();
  if (!text.trim()) return {};
  const easy = EASY.test(text);
  const hints: ObjectiveHints = {
    ...(HILLY.test(text) ? { hilly: true } : {}),
    ...(easy ? { easy: true } : {}),
  };
  if (easy) return hints;
  const candidates: number[] = [];
  for (const m of text.matchAll(/(\d{1,2})\s*h\s*(\d{2})?(?!\d)/g)) {
    candidates.push(Number(m[1]) * 3600 + Number(m[2] ?? 0) * 60);
  }
  for (const m of text.matchAll(/(?:(\d{1,2}):)?(\d{1,3}):(\d{2})/g)) {
    candidates.push(Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]));
  }
  for (const m of text.matchAll(/(\d{1,3})\s*['’]\s*(\d{2})?/g)) {
    candidates.push(Number(m[1]) * 60 + Number(m[2] ?? 0));
  }
  for (const m of text.matchAll(/(\d{1,3})\s*min/g)) candidates.push(Number(m[1]) * 60);
  const target = candidates.find((sec) => {
    const pace = sec / distanceKm;
    return pace >= 150 && pace <= 600;
  });
  return target ? { ...hints, targetSec: target } : hints;
}

/** Ce que l'app a compris du commentaire, en clair. */
export function hintsText(h: ObjectiveHints, distanceKm: number): string[] {
  return [
    ...(h.targetSec
      ? [
          `temps visé ${formatDuration(h.targetSec)}, soit ${formatPace(h.targetSec / distanceKm)} /km : les séances à l'allure objectif et la fin des sorties longues se font à cette allure`,
        ]
      : []),
    ...(h.hilly
      ? ["parcours vallonné : sorties longues avec du dénivelé et côtes en fin de footing"]
      : []),
    ...(h.easy ? ["course pour finir : pas de chrono visé, on vise la régularité"] : []),
  ];
}

const byDate = (a: Objective, b: Objective) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);

/** Ce qu'un objectif secondaire prépare : le prochain objectif principal, sinon le test du plan. */
export function preparedBy(state: AppState, o: Objective): string {
  const next = [...(state.objectives ?? [])]
    .sort(byDate)
    .find((x) => x.priority === "principal" && x.date > o.date);
  return next ? next.label : `ton ${GOAL_LABEL[state.plan.profile.goal]} de fin de plan`;
}

/** Semaine et jour d'une date dans le plan en cours ; `null` hors du plan. */
export function planSlot(state: AppState, date: ISODate): { week: number; day: number } | null {
  const offset = daysBetween(state.startDate, date);
  if (offset < 0 || offset >= state.plan.weeks.length * 7) return null;
  return { week: Math.floor(offset / 7) + 1, day: offset % 7 };
}

/**
 * Objectifs à placer dans le plan : ceux dont la semaine n'a pas commencé (le plan peut encore
 * s'organiser autour), plus ceux déjà placés tant qu'ils n'ont pas changé.
 */
function planObjectives(state: AppState, today: ISODate): PlanObjective[] {
  const placed = state.plan.objectives ?? [];
  const out: PlanObjective[] = [];
  for (const o of [...(state.objectives ?? [])].sort(byDate)) {
    const slot = planSlot(state, o.date);
    if (!slot) continue;
    const po: PlanObjective = {
      ...slot,
      priority: o.priority,
      label: o.label,
      distanceKm: o.distanceKm,
      ...(o.priority === "secondaire" ? { prepFor: preparedBy(state, o) } : {}),
      ...readComment(o.comment, o.distanceKm),
    };
    const open =
      sessionDate(state.startDate, slot.week, 0) > today && !isReviewed(state, slot.week);
    if (open || placed.some((p) => same(p, po))) out.push(po);
  }
  return out;
}

/**
 * Réorganise le plan autour des objectifs : semaine affûtée et course le jour J pour un
 * objectif principal (puis une semaine de récupération), léger affûtage et course de
 * préparation pour un objectif secondaire. Seules les semaines pas encore commencées changent.
 */
export function applyObjectives(state: AppState, today: ISODate): AppState {
  const prev = state.plan.objectives ?? [];
  const next = planObjectives(state, today);
  const changed = [
    ...prev.filter((p) => !next.some((n) => same(n, p))),
    ...next.filter((n) => !prev.some((p) => same(n, p))),
  ];
  const isOpen = (w: number) => sessionDate(state.startDate, w, 0) > today && !isReviewed(state, w);
  const firstOpen = state.plan.weeks.find((w) => isOpen(w.index))?.index;
  if (!changed.length || firstOpen === undefined) {
    return { ...state, plan: { ...state.plan, objectives: next } };
  }
  // Les semaines de course, et celles qui les préparent, sont reconstruites.
  const span = (o: PlanObjective) =>
    o.priority === "principal" ? RULES.prepWeeksPrincipal : RULES.prepWeeksSecondaire;
  const from = Math.max(firstOpen, Math.min(...changed.map((o) => o.week - span(o))));
  const raceWeeks = changed.map((o) => o.week).filter(isOpen);
  if (from > Math.max(...changed.map((o) => o.week))) {
    return { ...state, plan: { ...state.plan, objectives: next } };
  }

  // Les semaines de course repartent du plan généré : la course remplace les retouches.
  const weeks = state.plan.weeks.map((w) =>
    raceWeeks.includes(w.index) ? { ...w, edited: false, objective: undefined } : w,
  );
  const plan = { ...state.plan, weeks, objectives: next };
  const first =
    from === 1 && !next.some((o) => o.week === 1)
      ? { minutes: startMinutes(plan.profile), deload: false }
      : undefined;
  return { ...state, plan: rebuildFrom(plan, from, lastBuildUpTo(plan, from - 1), first) };
}

export interface ObjectiveResult {
  state: AppState;
  message: string;
}

/** Ajoute ou modifie un objectif, puis adapte le plan. */
export function saveObjective(
  state: AppState,
  o: Omit<Objective, "id"> & { id?: string },
  today: ISODate,
): ObjectiveResult {
  const label = o.label.trim();
  if (!label) throw new RangeError("Donne un nom à ton objectif.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(o.date)) throw new RangeError("Choisis une date.");
  if (o.date < today) throw new RangeError("Choisis une date à venir.");
  if (!(o.distanceKm >= 1 && o.distanceKm <= 100)) {
    throw new RangeError("Distance entre 1 et 100 km.");
  }
  const id = o.id ?? `obj-${o.date}-${Math.random().toString(36).slice(2, 8)}`;
  const comment = o.comment?.trim().slice(0, 500) || undefined;
  const clean: Objective = {
    ...o,
    id,
    label,
    distanceKm: Math.round(o.distanceKm * 10) / 10,
    comment,
  };
  const objectives = [...(state.objectives ?? []).filter((x) => x.id !== id), clean].sort(byDate);
  const next = applyObjectives({ ...state, objectives }, today);

  const slot = planSlot(next, clean.date);
  const placed =
    slot && (next.plan.objectives ?? []).some((p) => p.week === slot.week && p.label === label);
  const role =
    clean.priority === "principal"
      ? "objectif principal"
      : `objectif secondaire, en préparation de ${preparedBy(next, clean)}`;
  const message = placed
    ? clean.priority === "principal"
      ? `${label} est ton ${role}. La semaine ${slot.week} est affûtée, la course est placée ${formatLong(clean.date)} et la semaine suivante sert de récupération.`
      : `${label} est un ${role}. La semaine ${slot.week} est légèrement allégée et la course est placée ${formatLong(clean.date)}.`
    : slot
      ? `${label} est enregistré comme ${role}. La semaine est déjà commencée : il s'affiche au calendrier, sans changer les séances.`
      : `${label} est enregistré comme ${role}. Il est hors du plan en cours : tu pourras le viser avec ton prochain cycle.`;
  const understood = hintsText(readComment(comment, clean.distanceKm), clean.distanceKm);
  const prep =
    clean.priority === "principal" ? RULES.prepWeeksPrincipal : RULES.prepWeeksSecondaire;
  const analysis = !comment
    ? ""
    : understood.length
      ? ` D'après ton commentaire : ${understood.join(" ; ")}.${placed ? ` Ça s'applique aux ${prep} semaines avant la course.` : ""}`
      : " Ton commentaire est gardé, mais je n'y ai trouvé ni temps visé, ni parcours vallonné, ni course pour finir.";
  return { state: next, message: message + analysis };
}

export function removeObjective(state: AppState, id: string, today: ISODate): AppState {
  const objectives = (state.objectives ?? []).filter((x) => x.id !== id);
  return applyObjectives({ ...state, objectives }, today);
}

/** Objectifs d'un jour donné. */
export const objectivesOn = (state: AppState, date: ISODate): Objective[] =>
  (state.objectives ?? []).filter((o) => o.date === date);

/** Prochain objectif à venir (aujourd'hui compris). */
export const nextObjective = (state: AppState, today: ISODate): Objective | null =>
  [...(state.objectives ?? [])].sort(byDate).find((o) => o.date >= today) ?? null;
