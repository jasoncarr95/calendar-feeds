export type EventSource = "wikipedia" | "manual";

export interface PleEvent {
  /** Stable id used for the iCal UID, e.g. "2026-10-10-money-in-the-bank" */
  id: string;
  name: string;
  /** ISO date (YYYY-MM-DD) in the venue's local timezone */
  date: string;
  /** Optional ISO date for multi-day events (inclusive) */
  endDate?: string;
  /** Optional local start time "HH:MM" in `timezone`. Omit for an all-day event. */
  startTime?: string;
  /** IANA timezone the startTime is in, e.g. "America/New_York" */
  timezone?: string;
  venue?: string;
  city?: string;
  url?: string;
  notes?: string;
  source: EventSource;
}

export interface EventsFile {
  updatedAt: string;
  events: PleEvent[];
}
