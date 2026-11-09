import { fetchWikipediaHtml, parseWikipediaHtml, slugify } from "./wikipedia";
import type { EventsFile, PleEvent } from "./types";

export const MANUAL_PATH = new URL("../../data/wwe/manual.json", import.meta.url);
export const EVENTS_PATH = new URL("../../data/wwe/events.json", import.meta.url);

/** If Wikipedia yields fewer than this, assume the page changed and keep the old data. */
export const MIN_EXPECTED = 3;

export interface UpdateOptions {
  /** Parse this HTML instead of fetching (used by tests and `--html=`) */
  html?: string;
  dryRun?: boolean;
  debug?: string[];
}

export interface UpdateResult {
  events: PleEvent[];
  fromWikipedia: number;
  fromManual: number;
}

const key = (e: PleEvent) => `${e.date}:${slugify(e.name.replace(/^(wwe|aaa)\s+/i, ""))}`;

export async function update(opts: UpdateOptions = {}): Promise<UpdateResult> {
  const html = opts.html ?? (await fetchWikipediaHtml());
  const synced = parseWikipediaHtml(html, { debug: opts.debug });

  if (synced.length < MIN_EXPECTED) {
    throw new Error(
      `Only parsed ${synced.length} events from Wikipedia (expected >= ${MIN_EXPECTED}). ` +
        `The page layout may have changed — run \`bun run sync --debug\` to see the tables it found. ` +
        `data/wwe/events.json was left untouched.`,
    );
  }

  const manual = ((await Bun.file(MANUAL_PATH).json()) as { events: PleEvent[] }).events ?? [];
  const merged = new Map<string, PleEvent>();
  for (const e of synced) merged.set(key(e), e);
  for (const e of manual) {
    const k = key(e);
    // a manual entry with the same date + name overrides the synced one, field by field
    merged.set(k, { ...(merged.get(k) ?? {}), ...e, source: "manual" } as PleEvent);
  }

  const events = [...merged.values()].sort(
    (a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name),
  );

  if (!opts.dryRun) {
    const file: EventsFile = { events };
    await Bun.write(EVENTS_PATH, JSON.stringify(file, null, 2) + "\n");
  }

  return { events, fromWikipedia: synced.length, fromManual: manual.length };
}
