import { describe, expect, it } from "vitest";
import {
  acuteChronicRatio,
  dailyLoads,
  monotony,
  ratioZone,
  sessionLoad,
  weeklyLoad,
} from "./load";

describe("charge", () => {
  const week = [
    { day: 1, durationMin: 30, rpe: 4 },
    { day: 3, durationMin: 40, rpe: 7 },
    { day: 6, durationMin: 50, rpe: 5 },
  ];

  it("calcule la charge d'une séance et de la semaine (durée × ressenti)", () => {
    expect(sessionLoad(week[0])).toBe(120);
    expect(weeklyLoad(week)).toBe(120 + 280 + 250);
  });

  it("répartit la charge par jour", () => {
    expect(dailyLoads(week)).toEqual([0, 120, 0, 280, 0, 0, 250]);
  });

  it("calcule le ratio aigu / chronique sur 4 semaines", () => {
    expect(acuteChronicRatio([400, 400, 400, 400])).toBe(1);
    expect(acuteChronicRatio([300, 300, 300, 300, 600])).toBeCloseTo(600 / 375);
    expect(acuteChronicRatio([])).toBeNull();
    expect(acuteChronicRatio([0])).toBeNull();
  });

  it("classe le ratio", () => {
    expect(ratioZone(0.7)).toBe("sous-charge");
    expect(ratioZone(1.08)).toBe("sure");
    expect(ratioZone(1.5)).toBe("attention");
    expect(ratioZone(null)).toBe("inconnue");
  });

  it("calcule la monotonie, nulle quand tous les jours sont identiques", () => {
    expect(monotony([100, 100, 100, 100, 100, 100, 100])).toBeNull();
    expect(monotony(dailyLoads(week))).toBeGreaterThan(0);
  });
});
