/**
 * This module maps events from gCal's format to iCal's 
 * and vice-versa.
 */

import { calendar_v3 } from "googleapis";
import { CalendarEvent as CalDAVCalendarEvent } from "./caldav/calendar-event";

export type CalDAVEvent = CalDAVCalendarEvent;
export type GCalEvent = calendar_v3.Schema$Event;
export type CalendarEvent = GCalEvent | CalDAVEvent;
export type CalendarEventData = {
  summary: string,
  description?: string,
  start: { date?: string, dateTime?: string },
  end: { date?: string, dateTime?: string },
  transparency?: string,
  visibility?: string,
  colorId?: string,
}

export const isCalDAVEvent = (e: any): e is CalDAVEvent => !!e.uid;
export const isGCalEvent = (e: any): e is GCalEvent => !!e.id;

function formatDate(date: Date): string {
  function pad(n: number): string {
    return (n <= 9 ? `0${n}` : `${n}`);
  }
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const str = `${year}-${pad(month)}-${pad(day)}`;
  return str;
}

export function extractGCalEventData(evt: GCalEvent): CalendarEventData {
  let data: CalendarEventData = {
    summary: evt.summary,
    start: {},
    end: {},
    transparency: evt.transparency,
    description: evt.description,
    visibility: evt.visibility,
    colorId: evt.colorId,
  };
  if (evt.start && evt.start.date) data.start.date = evt.start.date;
  if (evt.start && evt.start.dateTime) data.start.dateTime = evt.start.dateTime;
  if (evt.end && evt.end.date) data.end.date = evt.end.date;
  if (evt.end && evt.end.dateTime) data.end.dateTime = evt.end.dateTime;
  return data;
}

export function extractCalDAVEventData(evt: CalDAVEvent): CalendarEventData {
  return {
    summary: evt.summary,
    start: (evt.allDayEvent ?
      { date: formatDate(evt.startDate) } : // yyyy-mm-dd format
      { dateTime: evt.startDate.toISOString() }),
    end: (evt.allDayEvent ?
      { date: formatDate(evt.endDate) } : // yyyy-mm-dd format
      { dateTime: evt.endDate.toISOString() }),
    transparency: evt.iCalendarData.includes('TRANSP:TRANSPARENT') ? 'transparent' : undefined,
    description: evt.description
  };
}

export function extractEventData(evt: CalendarEvent): CalendarEventData {
  if (isGCalEvent(evt)) return extractGCalEventData(evt);
  if (isCalDAVEvent(evt)) return extractCalDAVEventData(evt);
}

export function eventDataToGCalEvent(d: CalendarEventData): GCalEvent {
  const newEvt: GCalEvent = {
    summary: d.summary,
    start: d.start,
    end: d.end,
    transparency: d.transparency,
    visibility: d.visibility,
    colorId: d.colorId
  };
  return newEvt;
}

export function compareEventsData(evtA: CalendarEventData, evtB: CalendarEventData): boolean {
  if (evtA.summary !== evtB.summary) return false;
  if (evtA.start.date && !evtB.start.date) return false;
  if (evtA.start.date !== evtB.start.date) return false;
  if (evtA.start.dateTime && !evtB.start.dateTime) return false;
  if (evtA.end.dateTime && !evtB.end.dateTime) return false;
  if (evtA.start.dateTime && Date.parse(evtA.start.dateTime) !== Date.parse(evtB.start.dateTime)) return false;
  if (evtA.end.dateTime && Date.parse(evtA.end.dateTime) !== Date.parse(evtB.end.dateTime)) return false;
  if (evtA.transparency !== evtB.transparency) return false;
  if (evtA.description !== evtB.description) return false;
  if (evtA.visibility !== evtB.visibility) return false;
  if (evtA.colorId !== evtB.colorId) return false;

  return true;
}
