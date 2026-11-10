import { join } from "node:path";
import type { CalEvent, CalendarMeta } from "./ics";

export interface Feed {
  slug: "wwe-ples" | "chess-tournaments";
  /** Published file name under calendars/. Never changes: subscribers hold this address. */
  file: string;
  meta: CalendarMeta;
  /** Repo-relative path of the feed's data file */
  dataPath: string;
  hasAlerts: boolean;
}

export const FEEDS: Feed[] = [
  {
    slug: "wwe-ples",
    file: "wwe-ples.ics",
    meta: {
      name: "WWE Premium Live Events",
      description: "WWE main-roster PLEs, Saturday/Sunday Night's Main Event, and AAA Triplemanía",
      categories: ["WWE", "Wrestling"],
      defaultDurationMinutes: 180,
      allDayNote: "Start time TBA — WWE PLEs in North America usually begin 7–8 PM ET.",
    },
    dataPath: "data/wwe/events.json",
    hasAlerts: false,
  },
  {
    slug: "chess-tournaments",
    file: "chess-tournaments.ics",
    meta: {
      name: "Chess Tournaments",
      description: "Major chess tournament game times and milestones",
      color: "#4F46E5",
      categories: ["Chess"],
      defaultDurationMinutes: 15,
    },
    dataPath: "data/chess/events.json",
    hasAlerts: true,
  },
];

/** The repo's own data/ folder, wherever the command is run from. */
export const DEFAULT_DATA_DIR = join(import.meta.dir, "..", "data");

/** Where a feed's data file is, given the data directory in use. */
export function dataFile(feed: Feed, dataDir: string = DEFAULT_DATA_DIR): string {
  return join(dataDir, feed.dataPath.replace(/^data\//, ""));
}

export async function loadEvents(feed: Feed, dataDir?: string): Promise<CalEvent[]> {
  const path = dataFile(feed, dataDir);
  const parsed = (await Bun.file(path).json()) as { events?: CalEvent[] };
  if (!Array.isArray(parsed.events)) throw new Error(`${path}: expected { "events": [...] }`);
  return parsed.events;
}
