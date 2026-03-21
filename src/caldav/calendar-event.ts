import type { CalendarEventDuration } from "./calendar-event-duration";

export interface CalendarEvent {
  /**
   * unique ID of the event, needs to be unique and can be used to edit the event in the future
   * EXAMPLE: "eventid01"
   */
  uid: string;

  /**
   * The title of the event
   */
  summary: string;

  /**
   * Description of the event, optional.
   */
  description?: string;

  /**
   * Location of the event, optional.
   */
  location?: string;

  /**
   * Any timeformat handled by moment.js
   * EXAMPLE: new Date('Juni 20, 2019 11:24:00')
   */
  startDate: Date;

  /**
   * Any timeformat handled by moment.js
   * EXAMPLE: new Date('Juni 20, 2019 14:24:00')
   */
  endDate: Date;

  /**
   * time zone in the format
   * EXAMPLE: "Europe/Berlin"
   */
  tzid: string;

  /**
   * specify allDayEvent (no time just date) / note no timezone for allDayEvents
   */
  allDayEvent: boolean;

  /**
   * The source iCalendar data for this event.
   */
  iCalendarData: string;

  duration?: CalendarEventDuration;

  organizer?: string;

  attendees?: string[] | string[][];

  isRecurring?: boolean;
  recurrenceId?: any;
  recurrenceIterator?: any;
}
