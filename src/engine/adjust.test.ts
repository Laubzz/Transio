import { describe, expect, it } from "vitest";
import { adjustPlan, decide } from "./adjust";
import { VELO_TO_10K } from "./fixtures";
import { generatePlan } from "./plan";
import type { SessionFeedback, Week } from "./types";

const plan = generatePlan(VELO_TO_10K);

/** Retour « tout s'est bien passé » : séances faites au ressenti prévu. */
const ok = (w: Week): SessionFeedback[] =>
  w.sessions.map((s) => ({ done: true, rpe: s.targetRpe, pain: "aucune" }));

describe("decide", () => {
  it("progresse quand la semaine s'est bien passée", () => {
    const w = plan.weeks[1];
    expect(decide(w, { weekIndex: 2, sessions: ok(w) }).decision).toBe("progresser");
  });

  it("allège dès qu'une douleur est signalée", () => {
    const w = plan.weeks[1];
    const fb = ok(w);
    fb[0] = { done: true, rpe: 5, pain: "douleur" };
    expect(decide(w, { weekIndex: 2, sessions: fb }).decision).toBe("alleger");
  });

  it("maintient si trop de séances manquées", () => {
    const w = plan.weeks[1];
    const fb = w.sessions.map((_, i) => ({ done: i === 0, rpe: 4 }));
    expect(decide(w, { weekIndex: 2, sessions: fb }).decision).toBe("maintenir");
  });

  it("maintient si les séances sont ressenties bien plus dures que prévu", () => {
    const w = plan.weeks[1];
    const fb = w.sessions.map((s) => ({ done: true, rpe: Math.min(10, s.targetRpe + 3) }));
    expect(decide(w, { weekIndex: 2, sessions: fb }).decision).toBe("maintenir");
  });

  it("exige un retour par séance", () => {
    expect(() => decide(plan.weeks[0], { weekIndex: 1, sessions: [] })).toThrow(RangeError);
  });
});

describe("adjustPlan", () => {
  it("ne change rien quand on progresse", () => {
    const w = plan.weeks[1];
    expect(adjustPlan(plan, { weekIndex: 2, sessions: ok(w) }).plan).toBe(plan);
  });

  it("garde le même volume la semaine suivante quand on maintient", () => {
    const w = plan.weeks[1];
    const fb = w.sessions.map((s) => ({ done: true, rpe: Math.min(10, s.targetRpe + 3) }));
    const { plan: next } = adjustPlan(plan, { weekIndex: 2, sessions: fb });
    expect(next.weeks[2].runMinutes).toBe(w.runMinutes);
    expect(next.weeks.slice(0, 2)).toEqual(plan.weeks.slice(0, 2));
    expect(next.weeks).toHaveLength(plan.weeks.length);
  });

  it("allège puis reprend sans hausse après une douleur", () => {
    const w = plan.weeks[1];
    const fb = ok(w);
    fb[1] = { done: true, rpe: 6, pain: "douleur" };
    const { plan: next } = adjustPlan(plan, { weekIndex: 2, sessions: fb });
    expect(next.weeks[2].deload).toBe(true);
    expect(next.weeks[2].runMinutes).toBeLessThan(w.runMinutes);
    const resume = next.weeks.slice(3).find((x) => !x.deload)!;
    expect(resume.runMinutes).toBe(w.runMinutes);
  });

  it("garde le test en dernière semaine après un ajustement", () => {
    const w = plan.weeks[10];
    const fb = ok(w);
    fb[0] = { done: true, rpe: 6, pain: "douleur" };
    const { plan: next } = adjustPlan(plan, { weekIndex: 11, sessions: fb });
    expect(next.weeks.at(-1)!.phase).toBe("test");
    expect(next.weeks.at(-1)!.sessions.some((s) => s.kind === "test")).toBe(true);
  });
});

describe("décision minimale imposée", () => {
  it("maintient le volume malgré une bonne semaine quand la récupération se dégrade", () => {
    const w = plan.weeks[1];
    const r = adjustPlan(
      plan,
      { weekIndex: 2, sessions: ok(w) },
      {
        decision: "maintenir",
        reasons: ["VFC en baisse"],
      },
    );
    expect(r.decision).toBe("maintenir");
    expect(r.reasons[0]).toBe("VFC en baisse");
    expect(r.plan.weeks[2].runMinutes).toBe(w.runMinutes);
  });

  it("ne remplace pas une décision plus prudente", () => {
    const w = plan.weeks[1];
    const fb = ok(w);
    fb[0] = { done: true, rpe: 5, pain: "douleur" };
    const r = adjustPlan(
      plan,
      { weekIndex: 2, sessions: fb },
      { decision: "maintenir", reasons: ["x"] },
    );
    expect(r.decision).toBe("alleger");
  });
});
