import { describe, expect, test } from "bun:test";
import { buildCalendar, foldLine, validateEvents, zonedToUtc, type CalEvent, type CalendarMeta } from "./ics";

const META: CalendarMeta = { name: "T", description: "D", categories: ["X"], defaultDurationMinutes: 180 };
const STAMP = new Date("2026-11-09T00:00:00Z");
const game: CalEvent = {
  id: "g1",
  name: "Game 1",
  date: "2026-11-24",
  startTime: "15:00",
  timezone: "Europe/Zurich",
  durationMinutes: 15,
  alertMinutesBefore: 15,
};

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
        { id: "a", name: "All Day; Show", date: "2026-10-10", endDate: "2026-10-11" },
        { id: "b", name: "Timed", date: "2026-10-10", startTime: "20:00", timezone: "America/New_York" },
      ],
      META,
      new Date("2026-09-03T00:00:00Z"),
    );
    expect(ics).toContain("DTSTART;VALUE=DATE:20261010\r\nDTEND;VALUE=DATE:20261012");
    expect(ics).toContain("SUMMARY:All Day\\; Show");
    expect(ics).toContain("DTSTART:20261011T000000Z\r\nDTEND:20261011T030000Z");
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  test("a timed event uses its own duration", () => {
    const ics = buildCalendar([game], META, STAMP);
    expect(ics).toContain("DTSTART:20261124T140000Z");
    expect(ics).toContain("DTEND:20261124T141500Z");
  });

  test("default duration applies when none is given", () => {
    const ics = buildCalendar([{ ...game, durationMinutes: undefined }], META, STAMP);
    expect(ics).toContain("DTEND:20261124T170000Z");
  });

  test("an alert becomes a display alarm", () => {
    const ics = buildCalendar([game], META, STAMP);
    expect(ics).toContain(
      "BEGIN:VALARM\r\nACTION:DISPLAY\r\nTRIGGER:-PT15M\r\nDESCRIPTION:Game 1 starts in 15 minutes\r\nEND:VALARM",
    );
  });

  test("an all-day event has no alarm and can be tentative", () => {
    const ics = buildCalendar([{ id: "tb", name: "Tiebreaks", date: "2026-12-12", tentative: true }], META, STAMP);
    expect(ics).toContain("DTSTART;VALUE=DATE:20261212");
    expect(ics).toContain("STATUS:TENTATIVE");
    expect(ics).not.toContain("VALARM");
  });

  test("UID is id@domain and the stamp is the one passed in", () => {
    const ics = buildCalendar([game], META, STAMP);
    expect(ics).toContain("UID:g1@calendar-feeds.jasoncarr95.github.io");
    expect(ics).toContain("DTSTAMP:20261109T000000Z");
  });

  test("alarm text is escaped and folded", () => {
    const name = "World Chess Championship — Game 10 (if needed); round, two";
    const ics = buildCalendar([{ ...game, name }], META, STAMP);
    expect(ics).toContain("\\; round\\, two");
    const alarm = ics.replace(/\r\n /g, "").match(/BEGIN:VALARM[\s\S]*END:VALARM/)![0];
    expect(alarm).toContain("(if needed)\\; round\\, two starts in 15 minutes");
    for (const l of ics.split("\r\n")) expect(Buffer.byteLength(l)).toBeLessThanOrEqual(75);
  });

  test("validateEvents names every bad entry", () => {
    const bad: CalEvent[] = [
      { id: "a", name: "A", date: "2026-01-01", startTime: "15:00" },
      { id: "b", name: "B", date: "2026-01-02", alertMinutesBefore: 15 },
      { id: "a", name: "A2", date: "2026-01-03" },
    ];
    expect(() => validateEvents(bad)).toThrow(/a: .*timezone[\s\S]*b: .*alert[\s\S]*a: .*duplicate/i);
  });

  test("validateEvents rejects bad dates, times and an empty id", () => {
    const bad: CalEvent[] = [
      { id: "", name: "No id", date: "2026-01-01" },
      { id: "d", name: "D", date: "1 Jan 2026" },
      { id: "e", name: "E", date: "2026-01-05", endDate: "2026-01-04" },
      { id: "t", name: "T", date: "2026-01-06", startTime: "3pm", timezone: "Europe/Zurich" },
      { id: "z", name: "Z", date: "2026-01-07", timezone: "Europe/Zurich" },
      { id: "u", name: "U", date: "2026-01-08", durationMinutes: 15 },
    ];
    expect(() => validateEvents(bad)).toThrow(
      /No id.*empty id[\s\S]*d: .*date[\s\S]*e: .*endDate[\s\S]*t: .*HH:MM[\s\S]*z: .*startTime[\s\S]*u: .*duration/i,
    );
  });

  test("buildCalendar refuses invalid events", () => {
    expect(() => buildCalendar([{ id: "a", name: "A", date: "2026-01-01", startTime: "15:00" }], META, STAMP)).toThrow(
      /a: /,
    );
  });

  test("allDayNote is added only to events without a start time", () => {
    const ics = buildCalendar(
      [game, { id: "x", name: "X", date: "2026-12-01" }],
      { ...META, allDayNote: "Start time TBA" },
      STAMP,
    );
    expect(ics.match(/Start time TBA/g)?.length).toBe(1);
  });

  test("calendar name, colour and categories come from meta; url is its own property", () => {
    const ics = buildCalendar(
      [{ id: "x", name: "X", date: "2026-12-01", url: "https://example.org/x", notes: "Note" }],
      { ...META, color: "#4F46E5", categories: ["Chess", "FIDE"] },
      STAMP,
    );
    expect(ics).toContain("PRODID:-//calendar-feeds//EN");
    expect(ics).toContain("X-WR-CALNAME:T\r\nX-WR-CALDESC:D");
    expect(ics).toContain("X-APPLE-CALENDAR-COLOR:#4F46E5");
    expect(ics).toContain("DESCRIPTION:Note\r\nURL:https://example.org/x\r\nCATEGORIES:Chess,FIDE\r\nTRANSP:TRANSPARENT");
  });
});
