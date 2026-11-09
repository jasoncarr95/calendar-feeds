import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FEEDS, loadEvents } from "./feeds";
import { buildCalendar, validateEvents, type CalEvent } from "./ics";

const chess = FEEDS.find((f) => f.slug === "chess-tournaments")!;
const events = await loadEvents(chess);
const ics = buildCalendar(events, chess.meta, new Date("2026-11-09T00:00:00Z"));

// Only the published World Championship entries are pinned here, so adding another event never fails the check.
const isWcc = (e: CalEvent) => e.id.startsWith("fide-world-championship-2026-");
const wcc = events.filter(isWcc);

test("the World Championship carries its 16 entries, 14 with an alert", () => {
  expect(wcc.length).toBe(16);
  expect(wcc.filter((e) => e.alertMinutesBefore === 15).length).toBe(14);
  const wccIcs = buildCalendar(wcc, chess.meta, new Date("2026-11-09T00:00:00Z"));
  expect(wccIcs.match(/TRIGGER:-PT15M/g)?.length).toBe(14);
});

test("another chess entry can be added without touching the tests", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "calendar-feeds-chess-"));
  const extra: CalEvent = { id: "test-alert-2026-11", name: "TEST alert", date: "2026-11-20" };
  await Bun.write(join(dataDir, "chess", "events.json"), JSON.stringify({ events: [...events, extra] }));
  const loaded = await loadEvents(chess, dataDir);
  expect(loaded.length).toBe(events.length + 1);
  expect(loaded.filter(isWcc).map((e) => e.id)).toEqual(wcc.map((e) => e.id));
});

test("Game 1 is a 15-minute marker at 15:00 Geneva time", () => {
  const g1 = events.find((e) => e.id === "fide-world-championship-2026-game-01")!;
  expect(g1.date).toBe("2026-11-24");
  expect(ics).toContain("DTSTART:20261124T140000Z\r\nDTEND:20261124T141500Z");
});

test("chess ids are frozen", () => {
  expect(wcc.map((e) => e.id)).toMatchSnapshot(); // published ids are never renamed or dropped
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
