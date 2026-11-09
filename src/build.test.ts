import { beforeEach, expect, test } from "bun:test";
import { cp, mkdtemp, rm, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildSite } from "./build";
import { DEFAULT_DATA_DIR } from "./feeds";
import { lastChanged } from "./git";
import { renderIndex, type FeedStatus } from "./site";
import { WIKI_FIXTURE } from "./wwe/fixture";
import { syncWwe } from "./wwe/sync";

const now = new Date("2026-11-10T09:17:00Z");
const changedAt = async () => new Date("2026-11-09T00:00:00Z");

let outDir: string;
beforeEach(async () => {
  outDir = await mkdtemp(join(tmpdir(), "calendar-feeds-dist-"));
});

test("writes both calendars, the page and status.json", async () => {
  const feeds = await buildSite({ outDir, now, changedAt });
  expect(await Bun.file(`${outDir}/calendars/wwe-ples.ics`).text()).toStartWith("BEGIN:VCALENDAR");
  expect(await Bun.file(`${outDir}/calendars/chess-tournaments.ics`).text()).toContain("X-WR-CALNAME:Chess Tournaments");
  const status = await Bun.file(`${outDir}/status.json`).json();
  expect(status.feeds.map((f: FeedStatus) => f.slug)).toEqual(["wwe-ples", "chess-tournaments"]);
  expect(status.builtAt).toBe("2026-11-10T09:17:00.000Z");
  expect(feeds[1].checkedAt).toBe("2026-11-10T09:17:00.000Z");
  expect(await Bun.file(`${outDir}/.nojekyll`).exists()).toBe(true);
});

test("rebuilding unchanged data is byte-identical", async () => {
  await buildSite({ outDir, now, changedAt });
  const a = await Bun.file(`${outDir}/calendars/wwe-ples.ics`).text();
  const c = await Bun.file(`${outDir}/calendars/chess-tournaments.ics`).text();
  const first = await Bun.file(`${outDir}/status.json`).json();
  await buildSite({ outDir, now: new Date("2026-11-11T09:17:00Z"), changedAt });
  expect(await Bun.file(`${outDir}/calendars/wwe-ples.ics`).text()).toBe(a);
  expect(await Bun.file(`${outDir}/calendars/chess-tournaments.ics`).text()).toBe(c);
  const second = await Bun.file(`${outDir}/status.json`).json();
  expect(second.feeds.map((f: FeedStatus) => f.changedAt)).toEqual(first.feeds.map((f: FeedStatus) => f.changedAt));
});

test("the page links each feed by webcal and shows both dates", async () => {
  await buildSite({ outDir, now, changedAt });
  const html = await Bun.file(`${outDir}/index.html`).text();
  expect(html).toContain("<title>Calendar Feeds</title>");
  expect(html).toContain('href="webcal://jasoncarr95.github.io/calendar-feeds/calendars/wwe-ples.ics"');
  expect(html).toContain('href="webcal://jasoncarr95.github.io/calendar-feeds/calendars/chess-tournaments.ics"');
  expect(html).toContain('href="https://jasoncarr95.github.io/calendar-feeds/calendars/wwe-ples.ics"');
  expect(html).toContain('datetime="2026-11-09T00:00:00.000Z"');
  expect(html).toContain("9 Nov 2026, 00:00 UTC");
  expect(html).toContain('datetime="2026-11-10T09:17:00.000Z"');
  expect(html).toContain("Remove Alerts");
  expect(html.match(/Remove Alerts/g)?.length).toBe(1);
  expect(html).not.toContain("Last check failed");
});

test("a failed sync is shown on the WWE feed only", async () => {
  const feeds = await buildSite({ outDir, now, changedAt, syncFailed: true });
  expect(feeds.map((f) => f.checkFailed)).toEqual([true, false]);
  const html = await Bun.file(`${outDir}/index.html`).text();
  expect(html.match(/Last check failed/g)?.length).toBe(1);
});

test("a real sync's output is what the build reads", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "calendar-feeds-data-"));
  await cp(DEFAULT_DATA_DIR, dataDir, { recursive: true });
  await rm(join(dataDir, "wwe", "events.json"));
  await rm(join(dataDir, "wwe", "checked.json"));
  await syncWwe({ html: WIKI_FIXTURE, dataDir, now: new Date("2026-11-09T09:17:00Z") });
  const feeds = await buildSite({ outDir, dataDir, now, changedAt });
  expect(feeds[0].checkedAt).toBe("2026-11-09T09:17:00.000Z");
  expect(feeds[0].eventCount).toBeGreaterThanOrEqual(3);
  expect(await Bun.file(`${outDir}/calendars/wwe-ples.ics`).text()).toContain("SUMMARY:WWE Money in the Bank");
});

test("a build leaves files it did not write alone", async () => {
  await Bun.write(`${outDir}/keep.txt`, "mine");
  await buildSite({ outDir, now, changedAt });
  expect(await Bun.file(`${outDir}/keep.txt`).text()).toBe("mine");
});

test("the page escapes feed text", () => {
  const html = renderIndex(
    [
      {
        slug: "x",
        title: "A <b> & C",
        description: "d",
        file: "x.ics",
        eventCount: 1,
        changedAt: "2026-11-09T00:00:00.000Z",
        checkedAt: "2026-11-09T00:00:00.000Z",
        checkFailed: false,
        hasAlerts: false,
      },
    ],
    now,
  );
  expect(html).toContain("A &lt;b&gt; &amp; C");
  expect(html).not.toContain("Remove Alerts");
});

test("lastChanged is the commit date of a committed file and the file time of an edited one", async () => {
  const repo = await mkdtemp(join(tmpdir(), "calendar-feeds-git-"));
  const git = async (...args: string[]) => {
    const p = Bun.spawn(["git", ...args], {
      cwd: repo,
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: "t",
        GIT_AUTHOR_EMAIL: "t@example.org",
        GIT_COMMITTER_NAME: "t",
        GIT_COMMITTER_EMAIL: "t@example.org",
        GIT_COMMITTER_DATE: "2026-10-01T12:00:00Z",
      },
      stdout: "ignore",
      stderr: "ignore",
    });
    expect(await p.exited).toBe(0);
  };
  const file = join(repo, "events.json");
  await git("init", "-q");
  await Bun.write(file, "one\n");
  await utimes(file, new Date("2026-10-05T00:00:00Z"), new Date("2026-10-05T00:00:00Z"));
  expect((await lastChanged(file)).toISOString()).toBe("2026-10-05T00:00:00.000Z"); // never committed
  await git("add", "events.json");
  await git("commit", "-q", "-m", "add");
  expect((await lastChanged(file)).toISOString()).toBe("2026-10-01T12:00:00.000Z");
  await Bun.write(file, "two\n");
  await utimes(file, new Date("2026-10-20T08:00:00Z"), new Date("2026-10-20T08:00:00Z"));
  expect((await lastChanged(file)).toISOString()).toBe("2026-10-20T08:00:00.000Z"); // edited since
});
