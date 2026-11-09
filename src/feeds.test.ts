import { expect, test } from "bun:test";
import { FEEDS, loadEvents } from "./feeds";
import { buildCalendar, validateEvents } from "./ics";

const chess = FEEDS.find((f) => f.slug === "chess-tournaments")!;
const events = await loadEvents(chess);
const ics = buildCalendar(events, chess.meta, new Date("2026-11-09T00:00:00Z"));

test("chess carries all 16 starter entries, 14 with an alert", () => {
  expect(events.length).toBe(16);
  expect(ics.match(/BEGIN:VALARM/g)?.length).toBe(14);
  expect(ics.match(/TRIGGER:-PT15M/g)?.length).toBe(14);
});

test("Game 1 is a 15-minute marker at 15:00 Geneva time", () => {
  const g1 = events.find((e) => e.id === "fide-world-championship-2026-game-01")!;
  expect(g1.date).toBe("2026-11-24");
  expect(ics).toContain("DTSTART:20261124T140000Z\r\nDTEND:20261124T141500Z");
});

test("chess ids are frozen", () => {
  expect(events.map((e) => e.id)).toMatchSnapshot();
});

test("both real data files pass validation", async () => {
  for (const f of FEEDS) {
    const loaded = await loadEvents(f);
    expect(loaded.length).toBeGreaterThan(0);
    expect(() => validateEvents(loaded)).not.toThrow();
  }
});

test("the two feeds publish under their fixed file names", () => {
  expect(FEEDS.map((f) => [f.slug, f.file, f.hasAlerts])).toEqual([
    ["wwe-ples", "wwe-ples.ics", false],
    ["chess-tournaments", "chess-tournaments.ics", true],
  ]);
});

test("loadEvents reads from another data directory when given one", async () => {
  await expect(loadEvents(chess, "/nonexistent-data-dir")).rejects.toThrow();
});
