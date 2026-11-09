import type { CalEvent } from "../ics";

export type EventSource = "wikipedia" | "manual";

/** A WWE event: a calendar event plus where it came from. */
export type PleEvent = CalEvent & { source: EventSource };

export interface EventsFile {
  events: PleEvent[];
}
