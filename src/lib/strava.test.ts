import { describe, expect, it } from "vitest";
import { activityPace, hasActivityScope, sportOf, toActivity } from "./strava";

describe("Strava", () => {
  it("convertit une activité Strava", () => {
    expect(
      toActivity({
        id: 42,
        name: "Footing du soir",
        sport_type: "Run",
        start_date_local: "2026-11-10T19:05:00Z",
        distance: 5012.4,
        moving_time: 1680,
        average_heartrate: 148.6,
        total_elevation_gain: 12.2,
      }),
    ).toEqual({
      id: 42,
      date: "2026-11-10",
      sport: "course",
      name: "Footing du soir",
      distanceM: 5012,
      movingSec: 1680,
      avgHr: 149,
      elevationM: 12,
    });
  });

  it("classe les sports", () => {
    expect(sportOf("TrailRun")).toBe("course");
    expect(sportOf("GravelRide")).toBe("velo");
    expect(sportOf("WeightTraining")).toBe("renfo");
    expect(sportOf("Swim")).toBe("autre");
    expect(sportOf(undefined)).toBe("autre");
  });

  it("calcule l'allure et vérifie la portée", () => {
    expect(activityPace({ distanceM: 5000, movingSec: 1500 })).toBe(300);
    expect(activityPace({ distanceM: 0, movingSec: 1500 })).toBeNull();
    expect(hasActivityScope("read,activity:read_all")).toBe(true);
    expect(hasActivityScope("read")).toBe(false);
  });
});
