/**
 * Build the site into dist/: both calendars, the landing page and status.json.
 *
 *   bun run build                  build from data/
 *   bun run build --sync-failed    same, and mark the WWE feed "Last check failed"
 */
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { DEFAULT_DATA_DIR, FEEDS, dataFile, loadEvents } from "./feeds";
import { lastChanged } from "./git";
import { buildCalendar } from "./ics";
import { renderIndex, type FeedStatus } from "./site";

export interface BuildOptions {
  /** Default: dist/ in the repo */
  outDir?: string;
  /** Default: data/ in the repo */
  dataDir?: string;
  now?: Date;
  /** The WWE sync before this build failed: the page says so beside that feed */
  syncFailed?: boolean;
  /** When a data file last changed. Default: from git (`lastChanged`). */
  changedAt?: (path: string) => Promise<Date>;
}

export async function buildSite(opts: BuildOptions = {}): Promise<FeedStatus[]> {
  const outDir = opts.outDir ?? join(import.meta.dir, "..", "dist");
  const dataDir = opts.dataDir ?? DEFAULT_DATA_DIR;
  const now = opts.now ?? new Date();
  const changedAt = opts.changedAt ?? lastChanged;

  await mkdir(join(outDir, "calendars"), { recursive: true });

  const statuses: FeedStatus[] = [];
  for (const feed of FEEDS) {
    const events = await loadEvents(feed, dataDir);
    // The stamp is when the events last changed, so unchanged data rebuilds to the same bytes.
    const changed = await changedAt(dataFile(feed, dataDir));
    await Bun.write(join(outDir, "calendars", feed.file), buildCalendar(events, feed.meta, changed));

    const isWwe = feed.slug === "wwe-ples";
    let checkedAt = now.toISOString(); // a hand-edited feed is "checked" whenever it is built
    if (isWwe) {
      const stamp = Bun.file(join(dataDir, "wwe", "checked.json"));
      checkedAt = (await stamp.exists())
        ? ((await stamp.json()) as { checkedAt: string }).checkedAt
        : changed.toISOString();
    }

    statuses.push({
      slug: feed.slug,
      title: feed.meta.name,
      description: feed.meta.description,
      file: feed.file,
      eventCount: events.length,
      changedAt: changed.toISOString(),
      checkedAt,
      checkFailed: isWwe && !!opts.syncFailed,
      hasAlerts: feed.hasAlerts,
    });
  }

  await Bun.write(join(outDir, "index.html"), renderIndex(statuses, now));
  await Bun.write(join(outDir, "status.json"), JSON.stringify({ builtAt: now.toISOString(), feeds: statuses }, null, 2) + "\n");
  await Bun.write(join(outDir, ".nojekyll"), "");
  return statuses;
}

if (import.meta.main) {
  const statuses = await buildSite({ syncFailed: Bun.argv.includes("--sync-failed") });
  for (const s of statuses) {
    console.log(
      `${s.file}: ${s.eventCount} events, changed ${s.changedAt}, checked ${s.checkedAt}${s.checkFailed ? " (last check failed)" : ""}`,
    );
  }
}
