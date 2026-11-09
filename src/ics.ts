/** The shared calendar writer: every feed's events go through `buildCalendar`. */

export interface CalEvent {
  /** UID stem, e.g. "2026-10-10-money-in-the-bank". Never changes once published. */
  id: string;
  name: string;
  /** YYYY-MM-DD, local to `timezone` */
  date: string;
  /** Inclusive last day, all-day events only */
  endDate?: string;
  /** "HH:MM" in `timezone`. Absent = all-day. */
  startTime?: string;
  /** IANA timezone the startTime is in, e.g. "America/New_York" */
  timezone?: string;
  durationMinutes?: number;
  alertMinutesBefore?: number;
  /** STATUS:TENTATIVE */
  tentative?: boolean;
  venue?: string;
  city?: string;
  url?: string;
  notes?: string;
}

export interface CalendarMeta {
  name: string;
  description: string;
  /** X-APPLE-CALENDAR-COLOR */
  color?: string;
  categories: string[];
  defaultDurationMinutes: number;
  /** Prepended to DESCRIPTION when an event has no startTime */
  allDayNote?: string;
}

const PRODID = "-//calendar-feeds//EN";
export const UID_DOMAIN = "calendar-feeds.jasoncarr95.github.io";

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

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Throws one Error listing every problem, each prefixed with the event's id. */
export function validateEvents(events: CalEvent[]): void {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const ev of events) {
    const label = ev.id ? ev.id : `(no id) "${ev.name}"`;
    const bad = (msg: string) => problems.push(`${label}: ${msg}`);

    if (!ev.id) bad("empty id");
    else if (seen.has(ev.id)) bad("duplicate id");
    else seen.add(ev.id);

    const dateOk = DATE_RE.test(ev.date ?? "");
    if (!dateOk) bad(`date "${ev.date}" is not YYYY-MM-DD`);
    if (ev.endDate !== undefined) {
      if (!DATE_RE.test(ev.endDate)) bad(`endDate "${ev.endDate}" is not YYYY-MM-DD`);
      else if (dateOk && ev.endDate < ev.date) bad(`endDate ${ev.endDate} is before date ${ev.date}`);
    }

    if (ev.startTime !== undefined && !ev.timezone) bad("startTime needs a timezone");
    if (ev.timezone !== undefined && ev.startTime === undefined) bad("timezone is set but startTime is missing");
    if (ev.startTime !== undefined && !TIME_RE.test(ev.startTime)) bad(`startTime "${ev.startTime}" is not HH:MM`);

    if (ev.startTime === undefined) {
      if (ev.alertMinutesBefore !== undefined) bad("alertMinutesBefore needs a startTime (all-day events get no alert)");
      if (ev.durationMinutes !== undefined) bad("durationMinutes needs a startTime");
    }
  }
  if (problems.length) throw new Error(`Invalid calendar events:\n${problems.join("\n")}`);
}

function eventToVevent(ev: CalEvent, meta: CalendarMeta, stamp: Date): string[] {
  const lines: string[] = ["BEGIN:VEVENT"];
  lines.push(`UID:${ev.id}@${UID_DOMAIN}`);
  lines.push(`DTSTAMP:${utcStamp(stamp)}`);

  if (ev.startTime && ev.timezone) {
    const start = zonedToUtc(ev.date, ev.startTime, ev.timezone);
    const minutes = ev.durationMinutes ?? meta.defaultDurationMinutes;
    lines.push(`DTSTART:${utcStamp(start)}`);
    lines.push(`DTEND:${utcStamp(new Date(start.getTime() + minutes * 60_000))}`);
  } else {
    const endExclusive = addDays(ev.endDate ?? ev.date, 1);
    lines.push(`DTSTART;VALUE=DATE:${ymd(ev.date)}`);
    lines.push(`DTEND;VALUE=DATE:${ymd(endExclusive)}`);
  }

  lines.push(`SUMMARY:${escapeText(ev.name)}`);

  const location = [ev.venue, ev.city].filter(Boolean).join(", ");
  if (location) lines.push(`LOCATION:${escapeText(location)}`);

  const desc: string[] = [];
  if (!ev.startTime && meta.allDayNote) desc.push(meta.allDayNote);
  if (ev.notes) desc.push(ev.notes);
  if (desc.length) lines.push(`DESCRIPTION:${escapeText(desc.join("\n"))}`);
  if (ev.url) lines.push(`URL:${ev.url}`);

  if (meta.categories.length) lines.push(`CATEGORIES:${meta.categories.map(escapeText).join(",")}`);
  lines.push("TRANSP:TRANSPARENT");
  if (ev.tentative) lines.push("STATUS:TENTATIVE");

  if (ev.alertMinutesBefore !== undefined) {
    const n = ev.alertMinutesBefore;
    lines.push(
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `TRIGGER:-PT${n}M`,
      `DESCRIPTION:${escapeText(`${ev.name} starts in ${n} minutes`)}`,
      "END:VALARM",
    );
  }

  lines.push("END:VEVENT");
  return lines;
}

/** `stamp` becomes every DTSTAMP, so the same events and stamp give a byte-identical file. */
export function buildCalendar(events: CalEvent[], meta: CalendarMeta, stamp: Date): string {
  validateEvents(events);
  const sorted = [...events].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.startTime ?? "").localeCompare(b.startTime ?? "") ||
      a.name.localeCompare(b.name),
  );
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODID}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(meta.name)}`,
    `X-WR-CALDESC:${escapeText(meta.description)}`,
  ];
  if (meta.color) lines.push(`X-APPLE-CALENDAR-COLOR:${meta.color}`);
  lines.push("X-PUBLISHED-TTL:PT12H", "REFRESH-INTERVAL;VALUE=DURATION:PT12H");
  for (const ev of sorted) lines.push(...eventToVevent(ev, meta, stamp));
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
