import { join } from "node:path";
import { DEFAULT_DATA_DIR } from "../feeds";
import { validateEvents } from "../ics";
import { fetchWikipediaHtml, parseWikipediaHtml, slugify } from "./wikipedia";
import type { EventsFile, PleEvent } from "./types";

/** If Wikipedia yields fewer than this, assume the page changed and keep the old data. */
export const MIN_EXPECTED = 3;

/** Shows that ended more than this many days ago drop out of the feed. */
const LOOK_BACK_DAYS = 60;

export interface ManualFile {
  /** Fields laid over the synced event with the same `date` and `name` (both required). */
  overrides: Partial<PleEvent>[];
  /** Whole events Wikipedia does not list. */
  additions: PleEvent[];
}

export interface SyncOptions {
  /** Parse this HTML instead of fetching (used by tests and `--html=`) */
  html?: string;
  dryRun?: boolean;
  debug?: string[];
  now?: Date;
  /** Folder holding wwe/manual.json; wwe/events.json and wwe/checked.json are written there. Default: the repo's data/. */
  dataDir?: string;
}

export interface SyncResult {
  events: PleEvent[];
  fromWikipedia: number;
  overrides: number;
  additions: number;
  /** Whether events.json was (or, in a dry run, would be) rewritten */
  changed: boolean;
}

const key = (e: { date: string; name: string }) => `${e.date}:${slugify(e.name.replace(/^(wwe|aaa)\s+/i, ""))}`;

const byDateThenName = (a: PleEvent, b: PleEvent) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name);

/**
 * Lay the hand-written file over the synced events. An override that matches no synced event is an
 * error, never a second event: the show it was written for has moved or been renamed.
 *
 * `since` is the start of the sync's look-back window. A show dated before it has left the list on
 * purpose, so its override is spent, not stale, and an addition that old ages out the same way.
 */
export function mergeManual(synced: PleEvent[], manual: ManualFile, since = ""): PleEvent[] {
  const merged = new Map<string, PleEvent>();
  for (const e of synced) merged.set(key(e), e);

  const problems: string[] = [];
  const unmatched: string[] = [];
  for (const o of manual.overrides ?? []) {
    if (!o.date || !o.name) {
      problems.push(`An override needs both date and name to find its event: ${JSON.stringify(o)}`);
      continue;
    }
    const k = key({ date: o.date, name: o.name });
    const target = merged.get(k);
    if (!target) {
      if (o.date >= since) unmatched.push(`${o.date} ${o.name}`);
    } else merged.set(k, { ...target, ...o, id: target.id, source: "manual" });
  }
  if (unmatched.length) {
    problems.push(
      `These overrides in data/wwe/manual.json match no event on Wikipedia's list; the event may have moved or been renamed. ` +
        `Fix or remove them:\n${unmatched.map((u) => `  ${u}`).join("\n")}`,
    );
  }

  const clashes: string[] = [];
  for (const a of manual.additions ?? []) {
    if ((a.endDate ?? a.date) < since) continue;
    const k = key(a);
    if (merged.has(k)) clashes.push(`${a.date} ${a.name}`);
    else merged.set(k, { ...a, source: "manual" });
  }
  if (clashes.length) {
    problems.push(
      `These additions in data/wwe/manual.json are already on the list; to change a listed event use overrides:\n` +
        clashes.map((c) => `  ${c}`).join("\n"),
    );
  }

  if (problems.length) throw new Error(problems.join("\n"));
  return [...merged.values()].sort(byDateThenName);
}

/**
 * Fetch, merge and write. Throws before writing anything when the fetch fails, the page parses to
 * fewer than MIN_EXPECTED events, or the manual file does not fit, so the last good data stays.
 */
export async function syncWwe(opts: SyncOptions = {}): Promise<SyncResult> {
  const now = opts.now ?? new Date();
  const dir = join(opts.dataDir ?? DEFAULT_DATA_DIR, "wwe");
  const eventsPath = join(dir, "events.json");

  const html = opts.html ?? (await fetchWikipediaHtml());
  const since = new Date(now.getTime() - LOOK_BACK_DAYS * 86400_000).toISOString().slice(0, 10);
  const synced = parseWikipediaHtml(html, { debug: opts.debug, since });

  if (synced.length < MIN_EXPECTED) {
    throw new Error(
      `Only parsed ${synced.length} events from Wikipedia (expected >= ${MIN_EXPECTED}). ` +
        `The page layout may have changed — run \`bun run sync --debug\` to see the tables it found. ` +
        `data/wwe/events.json was left untouched.`,
    );
  }

  const manual = (await Bun.file(join(dir, "manual.json")).json()) as ManualFile;
  const events = mergeManual(synced, manual, since);
  validateEvents(events);

  const file: EventsFile = { events };
  const text = JSON.stringify(file, null, 2) + "\n";
  const current = (await Bun.file(eventsPath).exists()) ? await Bun.file(eventsPath).text() : null;
  const changed = text !== current;

  if (!opts.dryRun) {
    if (changed) await Bun.write(eventsPath, text);
    await Bun.write(join(dir, "checked.json"), JSON.stringify({ checkedAt: now.toISOString() }, null, 2) + "\n");
  }

  return {
    events,
    fromWikipedia: synced.length,
    overrides: manual.overrides?.length ?? 0,
    additions: manual.additions?.length ?? 0,
    changed,
  };
}
