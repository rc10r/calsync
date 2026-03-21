import { calendar_v3 } from "googleapis";
import { CalendarEvent } from "./caldav/calendar-event";
import { CalendarEventData } from "./events";

const Version = "1.5.0";

function prefix(): string {
  return `v${Version} -- ${new Date().toISOString()} -- `;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function log(msg: string, ...args: any[]) {
  if (args.length > 0) console.log(`${prefix()}${msg}`, ...args);
  else console.log(`${prefix()}${msg}`);
}

export function logWithEventData(msg: string, eventData: CalendarEventData) {
  const eventStr = `"${eventData.summary}" (${eventData.start.date ? eventData.start.date : eventData.start.dateTime})`;
  console.log(`${prefix()}${msg} -- ${eventStr}`);
}

export function logWithCalDAVEvent(msg: string, event: CalendarEvent) {
  const eventStr = `"${event.summary}" (${event.startDate.toISOString()})`;
  console.log(`${prefix()}${msg} -- ${eventStr}`);
}

export function logWithGCalEvent(msg: string, event: calendar_v3.Schema$Event) {
  const eventStr = `"${event.summary}" (${event.start?.date ?? event.start?.dateTime ?? "unknown"})`;
  console.log(`${prefix()}${msg} -- ${eventStr}`);
}
