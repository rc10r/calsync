import https from "https";
import * as xml2js from "xml2js";
const parseString = xml2js.parseString;
import ICAL from "ical.js";
import { CalendarEvent } from "./calendar-event";
import { CalendarEventDuration } from "./calendar-event-duration";

function formatUtcDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  const h = String(date.getUTCHours()).padStart(2, "0");
  const min = String(date.getUTCMinutes()).padStart(2, "0");
  const s = String(date.getUTCSeconds()).padStart(2, "0");
  return `${y}${m}${d}T${h}${min}${s}Z`;
}

function formatDateForIcal(date: Date, format: "allDay" | "dateTime"): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  if (format === "allDay") return `${y}${m}${d}`;
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  return `${y}${m}${d}T${h}${min}${s}`;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export class CalDAVService {
  private static readonly singelton = new CalDAVService();

  private constructor() {}

  public static getInstance() {
    return this.singelton;
  }

  addEvent(calendarUrl: string, username: string, password: string, event: CalendarEvent) {
    return this.updateEvent(calendarUrl, username, password, event, "PUT");
  }

  removeEvent(calendarUrl: string, username: string, password: string, event: CalendarEvent) {
    return this.updateEvent(calendarUrl, username, password, event, "DELETE");
  }

  /**
   * Get the events from a CalDAV calendar for a specific range of dates
   */
  getEvents(
    calendarUrl: string,
    username: string,
    password: string,
    startDate: Date,
    endDate?: Date,
  ) {
    const startDateString = formatUtcDate(startDate);
    const endDateString = endDate ? formatUtcDate(endDate) : null;
    const endTimeRange = endDateString ? ` end="${endDateString}"` : "";

    const xml =
      '<?xml version="1.0" encoding="utf-8" ?>\n' +
      '<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">\n' +
      "  <D:prop>\n" +
      "    <C:calendar-data/>\n" +
      "  </D:prop>\n" +
      "  <C:filter>\n" +
      '    <C:comp-filter name="VCALENDAR">\n' +
      '      <C:comp-filter name="VEVENT">\n' +
      `        <C:time-range start="${startDateString}"${endTimeRange}/>\n` +
      "      </C:comp-filter>\n" +
      "    </C:comp-filter>\n" +
      "  </C:filter>\n" +
      "</C:calendar-query>";
    const depth = "1";
    const method = "REPORT";
    return this.sendRequest(calendarUrl, username, password, xml, method, depth, true);
  }

  findOutIfAnythingChanged(calendarUrl: string, username: string, password: string) {
    const xml = `
        <c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
            <d:prop>
                <d:getetag />
            </d:prop>
            <c:filter>
                <c:comp-filter name="VCALENDAR">
                    <c:comp-filter name="VEVENT" />
                </c:comp-filter>
            </c:filter>
        </c:calendar-query>`;
    const depth = "1";
    const method = "REPORT";
    return this.sendRequest(calendarUrl, username, password, xml, method, depth);
  }

  getCalendarInformation(calendarUrl: string, username: string, password: string) {
    const xml = `
        <d:propfind xmlns:d="DAV:" xmlns:cs="http://calendarserver.org/ns/">
            <d:prop>
                <d:displayname />
                <cs:getctag />
                <d:sync-token />
            </d:prop>
        </d:propfind>`;
    const depth = "0";
    const method = "PROPFIND";
    return this.sendRequest(calendarUrl, username, password, xml, method, depth);
  }

  calendarMultiget(
    calendarUrl: string,
    username: string,
    password: string,
    eventPaths: string[],
  ) {
    let hrefString = "";
    eventPaths.forEach((value) => {
      hrefString += `<d:href>${value}</d:href> `;
    });
    const xml = `
        <c:calendar-multiget xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
            <d:prop>
                <d:getetag />
                <c:calendar-data />
            </d:prop>
            ${hrefString}
        </c:calendar-multiget>`;
    const depth = "1";
    const method = "PROPFIND";
    return this.sendRequest(calendarUrl, username, password, xml, method, depth);
  }

  receivingChanges(calendarUrl: string, username: string, password: string, syncUrl: string) {
    const xml = `<?xml version="1.0" encoding="utf-8" ?>
                    <d:sync-collection xmlns:d="DAV:">
                        <d:sync-token>${syncUrl}</d:sync-token>
                        <d:sync-level>1</d:sync-level>
                        <d:prop>
                            <d:getetag/>
                        </d:prop>
                    </d:sync-collection>`;
    const method = "REPORT";
    return this.sendRequest(calendarUrl, username, password, xml, method, null, false);
  }

  private updateEvent(
    calendarUrl: string,
    username: string,
    password: string,
    event: CalendarEvent,
    method: string,
  ) {
    let body: string;
    if (typeof event.iCalendarData !== "undefined") {
      body = event.iCalendarData;
    } else {
      body =
        "BEGIN:VCALENDAR\n" +
        "BEGIN:VEVENT\n" +
        `UID:${event.uid}\n` +
        `LOCATION:${event.location ? event.location : ""}\n` +
        `DESCRIPTION:${event.description ? event.description : ""}\n` +
        `SUMMARY:${event.summary}\n`;

      let _startDateBody: string;
      let _endDateBody: string;

      if (event.allDayEvent) {
        _startDateBody = `DTSTART;VALUE=DATE:${formatDateForIcal(event.startDate, "allDay")}\n`;
      } else {
        _startDateBody = `DTSTART;TZID=${event.tzid}:${formatDateForIcal(event.startDate, "dateTime")}\n`;
      }

      if (event.allDayEvent) {
        _endDateBody = `DTEND;VALUE=DATE:${formatDateForIcal(addDays(event.endDate, 1), "allDay")}\n`;
      } else {
        _endDateBody = `DTEND;TZID=${event.tzid}:${formatDateForIcal(event.endDate, "dateTime")}\n`;
      }

      body += `${_startDateBody + _endDateBody}END:VEVENT\n` + "END:VCALENDAR\n\n";
    }

    const depth = "1";
    return this.sendRequest(calendarUrl, username, password, body, method, depth, false, event.uid);
  }

  private sendRequest(
    calendarUrl: string,
    username: string,
    password: string,
    xml: string,
    method: string,
    depth: string | null,
    isQuery: boolean = false,
    eventUid: string = "",
  ): Promise<CalendarEvent[] | string> {
    return new Promise((resolve, reject) => {
      const urlparts = /(https?):\/\/(.*?):?(\d*)?(\/.*\/?)/gi.exec(calendarUrl);
      if (!urlparts) {
        reject(new Error(`Invalid calendar URL: ${calendarUrl}`));
        return;
      }
      const protocol = urlparts[1];
      const host = urlparts[2];
      const port = urlparts[3] || (protocol === "https" ? 443 : 80);
      const path = urlparts[4] + eventUid;

      const rejectUnauthorized = process.env.NODE_TLS_REJECT_UNAUTHORIZED !== "0";

      const options: https.RequestOptions = {
        rejectUnauthorized,
        hostname: host,
        port,
        path,
        method,
        headers: {
          "Content-type": "text/xml",
          "Content-Length": Buffer.byteLength(xml),
          "User-Agent": "calDavClient",
          Connection: "close",
          Depth: depth ?? undefined,
          Authorization: "",
        },
      };

      if (username && password) {
        const userpass = Buffer.from(`${username}:${password}`).toString("base64");
        if (options.headers) {
          (options.headers as Record<string, string>).Authorization = `Basic ${userpass}`;
        }
      } else {
        throw new Error("No password or username declared");
      }

      let response = "";
      let error: Error | undefined;
      const request = https.request(options, (res) => {
        const statusCode = res.statusCode ?? 0;
        if (statusCode < 200 || statusCode >= 300) {
          error = new Error(`response error: ${statusCode}`);
        }

        res.on("data", (chunk: Buffer) => {
          response += chunk;
        });
      });

      request.on("error", (e) => {
        error = e;
      });

      request.on("close", () => {
        if (error) {
          return reject(`${error} (${response})`);
        }

        try {
          if (isQuery) {
            parseString(response, (err: Error | null, result: Record<string, unknown>) => {
              if (err) {
                throw err;
              }
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const multistatus = result["multistatus"] as any;
              const data = multistatus?.["response"];
              // For non-iCloud WebCalDAV servers, the response is different
              // and the data may be accessed using
              // `result['d:multistatus']['d:response']` instead.
              const resultEvents: CalendarEvent[] = [];
              if (data) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                data.forEach((eventData: any) => {
                  const iCalendarData =
                    eventData["propstat"][0]["prop"][0]["calendar-data"][0];
                  const calendarEvent = this.parseToCalendarEvent(iCalendarData._);
                  // When accessing the data with `result['multistatus']['response']`
                  // for iCloud, `iCalendarData._` must be passed instead of
                  // just `iCalendarData` to avoid a parser error.
                  resultEvents.push(calendarEvent);
                });
              }
              resolve(resultEvents);
            });
          } else {
            resolve(response);
          }
        } catch (error) {
          reject(error);
        }
      });
      request.end(xml);
    });
  }

  public parseToCalendarEvent(iCalendarData: string): CalendarEvent {
    const jcalData = ICAL.parse(iCalendarData);
    const vcalendar = new ICAL.Component(jcalData);
    const vevent = vcalendar.getFirstSubcomponent("vevent");
    if (!vevent) throw new Error("No VEVENT found in calendar data");
    const event = new ICAL.Event(vevent);
    const vtimezone = vcalendar.getFirstSubcomponent("vtimezone");
    const tzid: string = vtimezone
      ? String(vtimezone.getFirstPropertyValue("tzid") ?? "Europe/Berlin")
      : "Europe/Berlin";
    const duration: CalendarEventDuration = {
      weeks: event.duration.weeks,
      days: event.duration.days,
      hours: event.duration.hours,
      minutes: event.duration.minutes,
      seconds: event.duration.seconds,
      isNegative: event.duration.isNegative,
    };
    const attendees: string[][] = [];
    event.attendees.forEach((value) => {
      attendees.push(value.getValues());
    });

    // if you try to add a event with `METHOD:REQUEST` in another calendar you will get `The HTTP 415 Unsupported Media Type` error.
    const iCalData = iCalendarData.replace("METHOD:REQUEST", "");

    const calendarEvent: CalendarEvent = {
      uid: event.uid,
      summary: event.summary,
      description: event.description,
      location: event.location,
      startDate: event.startDate.toJSDate(),
      endDate: event.endDate.toJSDate(),
      duration,
      organizer: event.organizer,
      attendees,
      isRecurring: event.isRecurring(),
      recurrenceId: event.recurrenceId,
      recurrenceIterator: new RecurrenceIterator(event),
      allDayEvent: this.isAllDayEvent(duration),
      tzid,
      iCalendarData: iCalData,
    };
    return calendarEvent;
  }

  private isAllDayEvent(duration: CalendarEventDuration) {
    return (
      duration.days === 1 &&
      duration.hours === 0 &&
      duration.minutes === 0 &&
      duration.seconds === 0 &&
      duration.weeks === 0
    );
  }
}

class RecurrenceIterator {
  /**
   * An iterator of recurrent events. It uses getOccurrenceDetails to correctly handle exceptions.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _event: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _iter: any = null;

  public constructor(event: ICAL.Event) {
    this._event = event;
    this._iter = event.iterator();
  }

  public next() {
    return this._event.getOccurrenceDetails(this._iter.next());
  }
}
