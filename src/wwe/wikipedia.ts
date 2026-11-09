import { parse, type HTMLElement } from "node-html-parser";
import type { PleEvent } from "./types";

export const WIKI_PAGE = "List_of_WWE_pay-per-view_and_livestreaming_supercards";
export const WIKI_API =
  `https://en.wikipedia.org/w/api.php?action=parse&page=${WIKI_PAGE}` +
  `&prop=text&redirects=1&formatversion=2&format=json`;

/**
 * Shows on the list we deliberately leave out of the feed.
 * NXT events are detected by row colour (see NXT_BG) rather than by name — this
 * list is for the AAA//other one-offs whose names carry no brand marker.
 */
export const EXCLUDE = /\b(NXT|Worlds Collide|Ola de Calor|Speed|Evolve|Tribute to the Troops)\b/i;

/** Wikipedia tints NXT-branded rows with this background (see the legend table above each year). */
export const NXT_BG = /#ffff80/i;

const YEAR_RE = /^(19|20)\d{2}$/;
const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

export function slugify(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, mi: number, d: number) => `${y}-${pad(mi + 1)}-${pad(d)}`;

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Parse a date cell from the article. Cells carry no year ("September 6") —
 * the year comes from the enclosing section heading. An explicit year in the
 * cell ("October 10, 2026") wins if present.
 *
 * Handles: "September 6" | "April 18-19" | "January 30 - February 1" | "October 10, 2026"
 * Returns null for month-only ("April") and "TBA" cells, which is what we want:
 * those events have no announced date yet.
 */
export function parseWikiDate(raw: string, fallbackYear?: number): { date: string; endDate?: string } | null {
  const text = raw.replace(/\[[^\]]*\]/g, "").replace(/\s+/g, " ").trim();
  const dash = "[-–—]";
  const month = `(${MONTHS.join("|")})`;
  const year = "(?:,? ((?:19|20)\\d{2}))?";
  const y = (captured?: string) => (captured ? +captured : fallbackYear);

  // January 30 - February 1[, 2027]
  let m = new RegExp(`^${month} (\\d{1,2}) ?${dash} ?${month} (\\d{1,2})${year}`, "i").exec(text);
  if (m) {
    const yr = y(m[5]);
    if (yr === undefined) return null;
    const startMi = MONTHS.indexOf(m[1].toLowerCase());
    const endMi = MONTHS.indexOf(m[3].toLowerCase());
    // a range that wraps past December belongs to the next year
    return { date: iso(yr, startMi, +m[2]), endDate: iso(endMi < startMi ? yr + 1 : yr, endMi, +m[4]) };
  }
  // April 18-19[, 2026]
  m = new RegExp(`^${month} (\\d{1,2}) ?${dash} ?(\\d{1,2})${year}`, "i").exec(text);
  if (m) {
    const yr = y(m[4]);
    if (yr === undefined) return null;
    const mi = MONTHS.indexOf(m[1].toLowerCase());
    return { date: iso(yr, mi, +m[2]), endDate: iso(yr, mi, +m[3]) };
  }
  // September 6[, 2026]
  m = new RegExp(`^${month} (\\d{1,2})${year}`, "i").exec(text);
  if (m) {
    const yr = y(m[3]);
    if (yr === undefined) return null;
    return { date: iso(yr, MONTHS.indexOf(m[1].toLowerCase()), +m[2]) };
  }
  return null;
}

function cellText(cell: HTMLElement): string {
  cell.querySelectorAll("sup, style, .sortkey").forEach((n) => n.remove());
  return cell.textContent.replace(/\s+/g, " ").trim();
}

export interface GridRow {
  cells: string[];
  /** inline style of the <tr>, used to read Wikipedia's brand colour coding */
  style: string;
}

/** Expand a <table> into rectangular rows of cell text, honouring rowspan/colspan. */
export function tableToRows(table: HTMLElement): GridRow[] {
  const grid: string[][] = [];
  const styles: string[] = [];
  table.querySelectorAll("tr").forEach((tr, r) => {
    grid[r] ??= [];
    styles[r] = tr.getAttribute("style") ?? "";
    let c = 0;
    for (const cell of tr.querySelectorAll("th, td")) {
      while (grid[r][c] !== undefined) c++;
      const rs = Math.max(1, +(cell.getAttribute("rowspan") ?? 1));
      const cs = Math.max(1, +(cell.getAttribute("colspan") ?? 1));
      const text = cellText(cell);
      for (let dr = 0; dr < rs; dr++) {
        grid[r + dr] ??= [];
        for (let dc = 0; dc < cs; dc++) grid[r + dr][c + dc] = text;
      }
      c += cs;
    }
  });
  return grid.map((cells, i) => ({ cells: [...cells], style: styles[i] ?? "" }));
}

function findColumn(header: string[], patterns: RegExp[]): number {
  for (const p of patterns) {
    const i = header.findIndex((h) => p.test(h));
    if (i !== -1) return i;
  }
  return -1;
}

export interface ParseOptions {
  /** Keep events on/after this ISO date (default: 60 days ago) */
  since?: string;
  exclude?: RegExp;
  /** Collect per-table diagnostics for `sync --debug` */
  debug?: string[];
}

interface Raw extends PleEvent {
  _year: number;
}

/** Extract events from the rendered HTML of the Wikipedia supercards list. */
export function parseWikipediaHtml(html: string, opts: ParseOptions = {}): PleEvent[] {
  const since = opts.since ?? new Date(Date.now() - 60 * 86400_000).toISOString().slice(0, 10);
  const exclude = opts.exclude ?? EXCLUDE;
  const debug = opts.debug;
  const root = parse(html);

  // Walk headings and tables in document order: the year lives in the section
  // heading ("2026"), never in the date cells.
  const nodes = root.querySelectorAll("h1, h2, h3, h4, table");
  let year: number | undefined;
  const raws: Raw[] = [];

  for (const node of nodes) {
    if (/^H[1-4]$/i.test(node.tagName)) {
      const t = node.textContent.replace(/\[[^\]]*\]/g, "").trim();
      if (YEAR_RE.test(t)) year = +t;
      continue;
    }
    if (!(node.getAttribute("class") ?? "").includes("wikitable")) continue;

    const rows = tableToRows(node);
    if (rows.length < 2) continue;
    const header = rows[0].cells.map((h) => h.toLowerCase());
    const nameCol = findColumn(header, [/^event$/, /event/, /^name/]);
    const dateCol = findColumn(header, [/^date$/, /date/]);
    if (nameCol === -1 || dateCol === -1) {
      debug?.push(`skip table (no Event/Date columns) header=[${header.join(" | ")}]`);
      continue;
    }
    const venueCol = findColumn(header, [/venue/, /arena/]);
    const cityCol = findColumn(header, [/^location$/, /^city$/, /location/, /city/]);
    debug?.push(`table year=${year ?? "?"} rows=${rows.length - 1} header=[${header.join(" | ")}]`);

    for (const row of rows.slice(1)) {
      const name = (row.cells[nameCol] ?? "").trim();
      const parsed = parseWikiDate(row.cells[dateCol] ?? "", year);
      if (!name || !parsed) continue;
      if (exclude.test(name)) continue;
      if (NXT_BG.test(row.style)) continue;

      raws.push({
        id: "",
        name,
        date: parsed.date,
        ...(parsed.endDate && parsed.endDate !== parsed.date ? { endDate: parsed.endDate } : {}),
        ...(venueCol !== -1 && row.cells[venueCol] && row.cells[venueCol] !== "TBA"
          ? { venue: row.cells[venueCol] }
          : {}),
        ...(cityCol !== -1 && row.cells[cityCol] && row.cells[cityCol] !== "TBA"
          ? { city: row.cells[cityCol] }
          : {}),
        source: "wikipedia",
        _year: year ?? 0,
      });
    }
  }

  return finalize(raws).filter((e) => (e.endDate ?? e.date) >= since);
}

/**
 * A two-night event is two table rows sharing one rowspanned Event cell.
 * Consecutive nights (WrestleMania, Sat 18 + Sun 19) collapse into one
 * multi-day entry; nights days apart in different cities (Triplemania, Las
 * Vegas then Mexico City) stay separate and get "(Night n)" appended.
 */
/** Triplemania is an AAA show; everything else on this list is WWE's own. */
function brandPrefix(name: string): string {
  if (/^(wwe|aaa)\b/i.test(name)) return "";
  return /triplema/i.test(name) ? "AAA " : "WWE ";
}

export function finalize(raws: Raw[]): PleEvent[] {
  const groups = new Map<string, Raw[]>();
  for (const r of raws) {
    const k = `${r._year}:${slugify(r.name)}`;
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }

  const out: PleEvent[] = [];
  for (const group of groups.values()) {
    const sorted = group.sort((a, b) => a.date.localeCompare(b.date));
    const runs: Raw[][] = [];
    for (const ev of sorted) {
      const run = runs.at(-1);
      const prev = run?.at(-1);
      if (prev && addDays(prev.endDate ?? prev.date, 1) === ev.date) run!.push(ev);
      else runs.push([ev]);
    }
    runs.forEach((run, i) => {
      const first = run[0];
      const last = run.at(-1)!;
      const end = last.endDate ?? last.date;
      const name = runs.length > 1 ? `${first.name} (Night ${i + 1})` : first.name;
      out.push({
        ...first,
        _year: undefined,
        name: brandPrefix(name) + name,
        id: `${first.date}-${slugify(name)}`,
        ...(end !== first.date ? { endDate: end } : {}),
      } as PleEvent);
    });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
}

export async function fetchWikipediaHtml(): Promise<string> {
  const res = await fetch(WIKI_API, {
    headers: { "User-Agent": "calendar-feeds/1.0 (+https://github.com/jasoncarr95/calendar-feeds)" },
  });
  if (!res.ok) throw new Error(`Wikipedia API ${res.status} ${res.statusText}`);
  const json = (await res.json()) as { parse?: { text?: string }; error?: { info?: string } };
  if (json.error) throw new Error(`Wikipedia API error: ${json.error.info}`);
  const html = json.parse?.text;
  if (!html) throw new Error("Wikipedia API response had no parse.text");
  return html;
}
