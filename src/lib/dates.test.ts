import { describe, expect, it } from "vitest";
import {
  addDays,
  daysBetween,
  isoWeek,
  mondayOf,
  nextMonday,
  position,
  sessionDate,
  weekday,
} from "./dates";

describe("dates", () => {
  it("numérote les jours à partir du lundi", () => {
    expect(weekday("2026-11-09")).toBe(0); // lundi
    expect(weekday("2026-11-15")).toBe(6); // dimanche
  });

  it("trouve le lundi de départ", () => {
    expect(nextMonday("2026-11-09")).toBe("2026-11-09");
    expect(nextMonday("2026-11-06")).toBe("2026-11-09");
    expect(nextMonday("2026-11-15")).toBe("2026-11-16");
    expect(mondayOf("2026-11-15")).toBe("2026-11-09");
    expect(mondayOf("2026-11-09")).toBe("2026-11-09");
  });

  it("compte les jours sans se tromper au changement d'heure", () => {
    expect(daysBetween("2026-10-24", "2026-10-26")).toBe(2);
    expect(addDays("2026-10-24", 2)).toBe("2026-10-26");
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
  });

  it("situe une date dans le plan", () => {
    expect(position("2026-11-09", "2026-11-06", 12)).toEqual({
      status: "avant",
      daysUntilStart: 3,
    });
    expect(position("2026-11-09", "2026-11-09", 12)).toEqual({
      status: "en-cours",
      weekIndex: 1,
      day: 0,
    });
    expect(position("2026-11-09", "2026-11-18", 12)).toEqual({
      status: "en-cours",
      weekIndex: 2,
      day: 2,
    });
    expect(position("2026-11-09", "2027-02-01", 12)).toEqual({ status: "termine" });
  });

  it("donne la date d'une séance", () => {
    expect(sessionDate("2026-11-09", 2, 6)).toBe("2026-11-22");
  });

  it("refuse une date mal formée", () => {
    expect(() => weekday("09/11/2026")).toThrow(RangeError);
  });
});

describe("numéro de semaine", () => {
  it("suit la norme ISO, comme les agendas", () => {
    expect(isoWeek("2026-11-09")).toBe(46);
    expect(isoWeek("2026-11-16")).toBe(47);
    expect(isoWeek("2026-12-28")).toBe(53);
    expect(isoWeek("2027-01-04")).toBe(1);
  });
});
