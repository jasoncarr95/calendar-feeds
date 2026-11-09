import type { PleEvent } from "./wwe/types";

const PRODID = "-//wwe-ple-calendar//EN";
const UID_DOMAIN = "wwe-ple-calendar";

/** Escape per RFC 5545 §3.3.11 */
export function escapeText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Fold lines longer than 75 octets (RFC 5545 §3.1) */
export function foldLine(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let start = 0;
  let first = true;
  while (start < bytes.length) {
    const max = first ? 75 : 74;
    let end = Math.min(start + max, bytes.length);
    // don't split a UTF-8 sequence: back up to a char boundary
    while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--;
    out.push((first ? "" : " ") + bytes.subarray(start, end).toString("utf8"));
    start = end;
    first = false;
  }
  return out.join("\r\n");
}

function ymd(date: string): string {
  return date.replace(/-/g, "");
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function utcStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

/** Convert a local wall-clock time in an IANA zone to a UTC Date. */
export function zonedToUtc(date: string, time: string, timeZone: string): Date {
  const [h, m] = time.split(":").map(Number);
  const guess = new Date(`${date}T${time}:00Z`);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts = Object.fromEntries(fmt.formatToParts(guess).map((p) => [p.type, p.value]));
  const asIfUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  const offsetMs = asIfUtc - guess.getTime();
  return new Date(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10), h, m) - offsetMs);
}

export function eventToVevent(ev: PleEvent, now: Date, defaultDurationHours = 3): string[] {
  const lines: string[] = ["BEGIN:VEVENT"];
  lines.push(`UID:${ev.id}@${UID_DOMAIN}`);
  lines.push(`DTSTAMP:${utcStamp(now)}`);

  if (ev.startTime && ev.timezone) {
    const start = zonedToUtc(ev.date, ev.startTime, ev.timezone);
    const end = new Date(start.getTime() + defaultDurationHours * 3600_000);
    lines.push(`DTSTART:${utcStamp(start)}`);
    lines.push(`DTEND:${utcStamp(end)}`);
  } else {
    const endExclusive = addDays(ev.endDate ?? ev.date, 1);
    lines.push(`DTSTART;VALUE=DATE:${ymd(ev.date)}`);
    lines.push(`DTEND;VALUE=DATE:${ymd(endExclusive)}`);
  }

  lines.push(`SUMMARY:${escapeText(ev.name)}`);

  const location = [ev.venue, ev.city].filter(Boolean).join(", ");
  if (location) lines.push(`LOCATION:${escapeText(location)}`);

  const desc: string[] = [];
  if (!ev.startTime) desc.push("Start time TBA — WWE PLEs in North America usually begin 7–8 PM ET.");
  if (ev.notes) desc.push(ev.notes);
  if (ev.url) desc.push(ev.url);
  if (desc.length) lines.push(`DESCRIPTION:${escapeText(desc.join("\n"))}`);
  if (ev.url) lines.push(`URL:${ev.url}`);

  lines.push("CATEGORIES:WWE,Wrestling");
  lines.push("TRANSP:TRANSPARENT");
  lines.push("END:VEVENT");
  return lines;
}

export function buildCalendar(events: PleEvent[], now = new Date()): string {
  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODID}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:WWE Premium Live Events",
    "X-WR-CALDESC:WWE main-roster PLEs, Saturday/Sunday Night's Main Event, and AAA Triplemanía",
    "X-PUBLISHED-TTL:PT12H",
    "REFRESH-INTERVAL;VALUE=DURATION:PT12H",
  ];
  for (const ev of sorted) lines.push(...eventToVevent(ev, now));
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
