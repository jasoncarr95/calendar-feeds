import { beforeEach, expect, test } from "bun:test";
import { mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WIKI_FIXTURE } from "./fixture";
import { mergeManual, syncWwe } from "./sync";
import { parseWikipediaHtml } from "./wikipedia";

// The fixture's shows are dated 2026–27, so every test pins the clock instead of using today's date.
const NOW = new Date("2026-11-09T09:17:00Z");
const synced = parseWikipediaHtml(WIKI_FIXTURE, { since: "2026-09-10" });

let dataDir: string;
const writeManual = (manual: unknown) => Bun.write(join(dataDir, "wwe", "manual.json"), JSON.stringify(manual));

beforeEach(async () => {
  dataDir = await mkdtemp(join(tmpdir(), "calendar-feeds-sync-"));
  await mkdir(join(dataDir, "wwe"));
  await writeManual({ overrides: [], additions: [] });
});

test("first sync writes events and a checked stamp", async () => {
  const r = await syncWwe({ html: WIKI_FIXTURE, dataDir, now: NOW });
  expect(r.changed).toBe(true);
  expect((await Bun.file(`${dataDir}/wwe/checked.json`).json()).checkedAt).toBe("2026-11-09T09:17:00.000Z");
  expect((await Bun.file(`${dataDir}/wwe/events.json`).json()).events.length).toBe(r.events.length);
});

test("a second sync of the same page changes only the stamp", async () => {
  await syncWwe({ html: WIKI_FIXTURE, dataDir, now: NOW });
  const before = await Bun.file(`${dataDir}/wwe/events.json`).text();
  const r = await syncWwe({ html: WIKI_FIXTURE, dataDir, now: new Date("2026-11-10T09:17:00Z") });
  expect(r.changed).toBe(false);
  expect(await Bun.file(`${dataDir}/wwe/events.json`).text()).toBe(before);
  expect((await Bun.file(`${dataDir}/wwe/checked.json`).json()).checkedAt).toBe("2026-11-10T09:17:00.000Z");
});

test("the events file has no timestamp of its own", async () => {
  await syncWwe({ html: WIKI_FIXTURE, dataDir, now: NOW });
  expect(Object.keys(await Bun.file(`${dataDir}/wwe/events.json`).json())).toEqual(["events"]);
});

test("the look-back window follows `now`, not the machine's clock", async () => {
  const r = await syncWwe({ html: WIKI_FIXTURE, dataDir, now: NOW, dryRun: true });
  expect(r.events.map((e) => e.date)).toEqual(synced.map((e) => e.date));
  expect(r.events[0].date).toBe("2026-09-11");
});

test("a short parse writes nothing", async () => {
  await expect(syncWwe({ html: "<html></html>", dataDir })).rejects.toThrow(/expected >= 3/);
  expect(await Bun.file(`${dataDir}/wwe/events.json`).exists()).toBe(false);
  expect(await Bun.file(`${dataDir}/wwe/checked.json`).exists()).toBe(false);
});

test("a dry run writes nothing", async () => {
  const r = await syncWwe({ html: WIKI_FIXTURE, dataDir, now: NOW, dryRun: true });
  expect(r.events.length).toBeGreaterThanOrEqual(3);
  expect(await Bun.file(`${dataDir}/wwe/events.json`).exists()).toBe(false);
  expect(await Bun.file(`${dataDir}/wwe/checked.json`).exists()).toBe(false);
});

test("a stale override fails the sync and leaves the last good data alone", async () => {
  await syncWwe({ html: WIKI_FIXTURE, dataDir, now: NOW });
  const before = await Bun.file(`${dataDir}/wwe/events.json`).text();
  await writeManual({
    overrides: [{ date: "2026-10-17", name: "WWE Money in the Bank", startTime: "20:00", timezone: "America/New_York" }],
    additions: [],
  });
  await expect(syncWwe({ html: WIKI_FIXTURE, dataDir, now: new Date("2026-11-10T09:17:00Z") })).rejects.toThrow(
    /2026-10-17 WWE Money in the Bank/,
  );
  expect(await Bun.file(`${dataDir}/wwe/events.json`).text()).toBe(before);
  expect((await Bun.file(`${dataDir}/wwe/checked.json`).json()).checkedAt).toBe("2026-11-09T09:17:00.000Z");
});

test("an override that would publish a broken event fails before anything is written", async () => {
  await writeManual({ overrides: [{ date: "2026-10-10", name: "WWE Money in the Bank", startTime: "20:00" }], additions: [] });
  await expect(syncWwe({ html: WIKI_FIXTURE, dataDir, now: NOW })).rejects.toThrow(/money-in-the-bank: .*timezone/);
  expect(await Bun.file(`${dataDir}/wwe/events.json`).exists()).toBe(false);
});

test("an override pins a bell time on the matching event", () => {
  const out = mergeManual(synced, {
    overrides: [{ date: "2026-10-10", name: "WWE Money in the Bank", startTime: "20:00", timezone: "America/New_York" }],
    additions: [],
  });
  const e = out.find((x) => x.id === "2026-10-10-money-in-the-bank")!;
  expect(e.startTime).toBe("20:00");
  expect(e.venue).toBe("Smoothie King Center");
  expect(e.source).toBe("manual");
  expect(out.length).toBe(synced.length);
});

test("an override that matches nothing fails and names it", () => {
  expect(() =>
    mergeManual(synced, {
      overrides: [{ date: "2026-10-17", name: "WWE Money in the Bank", startTime: "20:00", timezone: "America/New_York" }],
      additions: [],
    }),
  ).toThrow(/2026-10-17 WWE Money in the Bank/);
});

test("an override without a date or name is refused", () => {
  expect(() => mergeManual(synced, { overrides: [{ startTime: "20:00" }], additions: [] })).toThrow(/date and name/);
});

test("an addition is added outright", () => {
  const out = mergeManual(synced, {
    overrides: [],
    additions: [{ id: "2027-01-02-house-show", name: "House Show", date: "2027-01-02", source: "manual" }],
  });
  expect(out.length).toBe(synced.length + 1);
  expect(out.map((e) => e.date)).toEqual([...out.map((e) => e.date)].sort());
});

test("an addition that duplicates a synced event is refused", () => {
  expect(() =>
    mergeManual(synced, {
      overrides: [],
      additions: [{ id: "x", name: "Money in the Bank", date: "2026-10-10", source: "manual" }],
    }),
  ).toThrow(/use overrides[\s\S]*2026-10-10 Money in the Bank/);
});

test("FORCE_SYNC_FAILURE makes the command fail before it does anything", async () => {
  const proc = Bun.spawn(["bun", join(import.meta.dir, "cli.ts"), "--dry-run", `--html=${join(import.meta.dir, "nope.html")}`], {
    env: { ...process.env, FORCE_SYNC_FAILURE: "true" },
    stdout: "pipe",
    stderr: "pipe",
  });
  expect(await proc.exited).toBe(1);
  expect(await new Response(proc.stderr).text()).toContain("Forced failure (FORCE_SYNC_FAILURE)");
});
