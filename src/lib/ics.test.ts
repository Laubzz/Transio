import { describe, expect, it } from "vitest";
import { VELO_TO_10K } from "@/engine/fixtures";
import { buildCalendar, fold } from "./ics";
import { createState } from "./state";

const state = createState({ ...VELO_TO_10K, reference5kSec: 1650 }, "2026-11-09");
const now = new Date("2026-11-06T10:00:00Z");
const unfold = (ics: string) => ics.replace(/\r\n /g, "");

describe("export agenda (.ics)", () => {
  it("crée un événement par séance, sur la journée par défaut", () => {
    const ics = buildCalendar(state, { time: null, now });
    const count = state.plan.weeks.reduce((a, w) => a + w.sessions.length, 0);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(count);
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("DTSTART;VALUE=DATE:20261109");
    expect(ics).toContain("DTEND;VALUE=DATE:20261110");
    expect(ics).toContain("UID:transio-1-1-0@transio.app");
  });

  it("place les séances à l'heure choisie, avec leur durée", () => {
    const ics = buildCalendar(state, { time: "18:30", now });
    const first = state.plan.weeks[0].sessions[0];
    const end = 18 * 60 + 30 + first.durationMin;
    const hhmm = `${String(Math.floor(end / 60)).padStart(2, "0")}${String(end % 60).padStart(2, "0")}00`;
    expect(ics).toContain("DTSTART:20261109T183000");
    expect(ics).toContain(`DTEND:20261109T${hhmm}`);
  });

  it("met le détail et les allures dans la description, échappé et plié à 75 octets", () => {
    const ics = buildCalendar(state, { time: null, now });
    for (const line of ics.split("\r\n")) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
    const flat = unfold(ics);
    expect(flat).toMatch(/SUMMARY:Transio · Course-marche · \d+ min/);
    expect(flat).toContain("Endurance : 6:30–7:00 /km");
    expect(flat).toContain("\\n");
  });

  it("plie les longues lignes sans couper les caractères", () => {
    const long = "DESCRIPTION:" + "é".repeat(100);
    const folded = fold(long);
    expect(unfold(folded)).toBe(long);
    for (const l of folded.split("\r\n"))
      expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75);
  });
});
