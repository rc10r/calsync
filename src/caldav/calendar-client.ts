import { CalDAVService } from "./caldav.service";
import { CalendarEvent } from "./calendar-event";

export class CalendarClient {
  private calDAVService: CalDAVService = CalDAVService.getInstance();
  /**
   *
   * @param calendarUrl - CalDAV Calendar URL
   * @param username - CalDAV Username
   * @param  password - CalDAV password
   */
  constructor(
    private calendarUrl: string,
    private username: string,
    private password
  ) {}

  /**
   * Get
   * 1. `calendar displayname`.
   * 2. `ctag` - This ctag works like a change id. Every time the ctag has changed, you know something in the calendar has changed too.
   */
  public getCalendarInformation() {
    return this.calDAVService.getCalendarInformation(
      this.calendarUrl,
      this.username,
      this.password
    );
  }

  /**
   * Get events from `startDate` up to optional `endDate`.
   * if you don't enter a endDate, if will return all events from `startDate`.
   */
  public getEvents(startDate: Date, endDate?: Date): Promise<CalendarEvent[]> {
    return this.calDAVService.getEvents(
      this.calendarUrl,
      this.username,
      this.password,
      startDate,
      endDate
    );
  }

  /**
   * if the event already exits - it means same `event.uid` - the event will be updated
   * else it will be added.
   * @param event - the event you want to add or update.
   */
  public addOrUpdateEvent(event: CalendarEvent) {
    return this.calDAVService.addEvent(
      this.calendarUrl,
      this.username,
      this.password,
      event
    );
  }

  /**
   * Remove the event in caldav server with the same uid like `event`.
   * @param event - the event you want to remove.
   */
  public removeEvent(event: CalendarEvent) {
    return this.calDAVService.removeEvent(
      this.calendarUrl,
      this.username,
      this.password,
      event
    );
  }
}
