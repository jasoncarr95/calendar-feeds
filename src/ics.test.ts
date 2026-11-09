import { describe, expect, test } from "bun:test";
import { buildCalendar, foldLine, zonedToUtc } from "./ics";

describe("ics", () => {
  test("zonedToUtc handles DST correctly", () => {
    expect(zonedToUtc("2026-10-10", "20:00", "America/New_York").toISOString()).toBe("2026-10-11T00:00:00.000Z");
    expect(zonedToUtc("2026-11-28", "20:00", "America/New_York").toISOString()).toBe("2026-11-29T01:00:00.000Z");
  });

  test("foldLine keeps lines <= 75 octets and multibyte chars intact", () => {
    const long = "SUMMARY:" + "Triplemanía ".repeat(12);
    const folded = foldLine(long);
    for (const l of folded.split("\r\n")) expect(Buffer.byteLength(l)).toBeLessThanOrEqual(75);
    expect(folded.replace(/\r\n /g, "")).toBe(long);
  });

  test("buildCalendar emits all-day and timed events", () => {
    const ics = buildCalendar(
      [
        { id: "a", name: "All Day; Show", date: "2026-10-10", endDate: "2026-10-11", source: "manual" },
        { id: "b", name: "Timed", date: "2026-10-10", startTime: "20:00", timezone: "America/New_York", source: "manual" },
      ],
      new Date("2026-09-03T00:00:00Z"),
    );
    expect(ics).toContain("DTSTART;VALUE=DATE:20261010\r\nDTEND;VALUE=DATE:20261012");
    expect(ics).toContain("SUMMARY:All Day\\; Show");
    expect(ics).toContain("DTSTART:20261011T000000Z\r\nDTEND:20261011T030000Z");
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });
});
