import https from "https";
import * as xml2js from "xml2js";
const parseString = xml2js.parseString;
import moment from "moment";
import ICAL from "ical.js";
import { CalendarEvent } from "./calendar-event";
import { CalendarEventDuration } from "./calendar-event-duration";

export class CalDAVService {
  private static readonly singelton = new CalDAVService();

  private constructor() {}

  public static getInstance() {
    return this.singelton;
  }

  addEvent(
    calendarUrl: string,
    username: string,
    password: string,
    event: CalendarEvent
  ) {
    return this.updateEvent(calendarUrl, username, password, event, "PUT");
  }

  removeEvent(
    calendarUrl: string,
    username: string,
    password: string,
    event: CalendarEvent
  ) {
    return this.updateEvent(calendarUrl, username, password, event, "DELETE");
  }

  /**
   * Get the events from a CalDAV calendar for a specific range of dates
   * @param {string} url - CalDAV Calendar URL
   * @param {string} username - CalDAV Username
   * @param {string} password - CalDAV password
   * @param {string} startDate - Date from which to start, Any timeformat handled by moment.js
   * @param {string} endDate -  Date from which to stop, Any timeformat handled by moment.js optional (can be null).
   */
  async getEvents(
    calendarUrl: string,
    username: string,
    password: string,
    startDate: Date,
    endDate?: Date
  ) {
    const startDateString = moment(startDate)
      .utc()
      .format("YYYYMMDD[T]HHmmss[Z]");
    const endDateString = endDate
      ? moment(endDate).utc().format("YYYYMMDD[T]HHmmss[Z]")
      : null;
    const endTimeRange = endDateString ? ` end="${endDateString}"` : "";

    const xml =
      `${
        '<?xml version="1.0" encoding="utf-8" ?>\n' +
        '<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">\n' +
        "  <D:prop>\n" +
        "    <C:calendar-data/>\n" +
        "  </D:prop>\n" +
        "  <C:filter>\n" +
        '    <C:comp-filter name="VCALENDAR">\n' +
        '      <C:comp-filter name="VEVENT">\n' +
        '        <C:time-range start="'
      }${startDateString}"${endTimeRange}/>\n` +
      "      </C:comp-filter>\n" +
      "    </C:comp-filter>\n" +
      "  </C:filter>\n" +
      "</C:calendar-query>";
    const depth = "1";
    const method = "REPORT";
    console.log("request:", xml);
    const result = await this.sendRequest(
      calendarUrl,
      username,
      password,
      xml,
      method,
      depth,
      true
    );
    console.log("response: ", result);
    return result;
  }

  findOutIfAnythingChanged(
    calendarUrl: string,
    username: string,
    password: string
  ) {
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
    return this.sendRequest(
      calendarUrl,
      username,
      password,
      xml,
      method,
      depth
    );
  }

  getCalendarInformation(
    calendarUrl: string,
    username: string,
    password: string
  ) {
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
    return this.sendRequest(
      calendarUrl,
      username,
      password,
      xml,
      method,
      depth
    );
  }

  calendarMultiget(
    calendarUrl: string,
    username: string,
    password: string,
    eventPaths: string[]
  ) {
    let hrefString = "";
    eventPaths.forEach((value) => {
      hrefString += `<d:href>${value}</d:href> `; // something like that: <d:href>/calendars/johndoe/home/132456762153245.ics</d:href>
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
    return this.sendRequest(
      calendarUrl,
      username,
      password,
      xml,
      method,
      depth
    );
  }

  receivingChanges(
    calendarUrl: string,
    username: string,
    password: string,
    syncUrl: string
  ) {
    const xml = `<?xml version="1.0" encoding="utf-8" ?>
                    <d:sync-collection xmlns:d="DAV:">
                        <d:sync-token>${syncUrl}</d:sync-token>
                        <d:sync-level>1</d:sync-level>
                        <d:prop>
                            <d:getetag/>
                        </d:prop>
                    </d:sync-collection>`;
    const depth = null;
    const method = "REPORT";
    return this.sendRequest(
      calendarUrl,
      username,
      password,
      xml,
      method,
      depth
    );
  }

  private updateEvent(
    calendarUrl: string,
    username: string,
    password: string,
    event: CalendarEvent,
    method: string
  ) {
    let body;
    if (typeof event.iCalendarData !== "undefined") {
      body = event.iCalendarData;
    } else {
      body =
        `${"BEGIN:VCALENDAR\n" + "BEGIN:VEVENT\n" + "UID:"}${event.uid}\n` +
        `LOCATION:${event.location ? event.location : ""}\n` +
        `DESCRIPTION:${event.description ? event.description : ""}\n` +
        `SUMMARY:${event.summary}\n`;

      let _startDateBody;
      let _endDateBody;

      const formatAllDay = "YYYYMMDDTHHmmss";
      const formatSingleEvent = "YYYYMMDD";

      if (event.allDayEvent) {
        _startDateBody = `DTSTART;VALUE=DATE:${moment(event.startDate).format(
          formatSingleEvent
        )}\n`;
      } else {
        _startDateBody = `DTSTART;TZID=${event.tzid}:${moment(
          event.startDate
        ).format(formatAllDay)}\n`;
      }

      if (event.allDayEvent) {
        _endDateBody = `DTEND;VALUE=DATE:${moment(event.endDate)
          .add(1, "days")
          .format(formatSingleEvent)}\n`;
      } else {
        _endDateBody = `DTEND;TZID=${event.tzid}:${moment(event.endDate).format(
          formatAllDay
        )}\n`;
      }

      body +=
        `${_startDateBody + _endDateBody}END:VEVENT\n` + "END:VCALENDAR\n\n";
    }

    const depth = "1";
    return this.sendRequest(
      calendarUrl,
      username,
      password,
      body,
      method,
      depth,
      false,
      event.uid
    );
  }

  private sendRequest(
    calendarUrl: string,
    username: string,
    password: string,
    xml: string,
    method: string,
    depth: string,
    isQuery: boolean = false,
    eventUid: string = ""
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const urlparts = /(https?)\:\/\/(.*?):?(\d*)?(\/.*\/?)/gi.exec(
        calendarUrl
      );
      const protocol = urlparts[1];
      const host = urlparts[2];
      const port = urlparts[3] || (protocol === "https" ? 443 : 80);
      const path = urlparts[4] + eventUid;
      // const path = urlparts[4] + event.key;

      const options = {
        rejectUnauthorized: false,
        hostname: host,
        port,
        path,
        method,
        headers: {
          "Content-type": "text/xml",
          "Content-Length": xml.length,
          "User-Agent": "calDavClient",
          Connection: "close",
          Depth: depth,
          Authorization: "",
        },
      };

      if (username && password) {
        const userpass = Buffer.from(`${username}:${password}`).toString(
          "base64"
        );
        options.headers.Authorization = `Basic ${userpass}`;
      } else {
        throw new Error("No password or username declared");
      }

      let response = "";
      let error;
      const request = https.request(options, (res) => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          error = new Error(`response error: ${res.statusCode}`);
        }

        res.on("data", (chunk) => {
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
            parseString(response, (err, result) => {
              if (err) {
                throw err;
              }
              const data = result["d:multistatus"]["d:response"];
              const resultEvents: CalendarEvent[] = [];
              if (data) {
                data.forEach((eventXML) => {
                  const iCalendarData =
                    eventXML["d:propstat"][0]["d:prop"][0][
                      "cal:calendar-data"
                    ][0];
                  const calendarEvent =
                    this.parseToCalendarEvent(iCalendarData);
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

  /**
   *
   * @param iCalendarData - like:
   * BEGIN:VCALENDAR
   * PRODID:-//ownCloud calendar v1.6.2
   * VERSION:2.0
   * CALSCALE:GREGORIAN
   * BEGIN:VEVENT
   * CREATED:20190626T130227Z
   * DTSTAMP:20190626T130251Z
   * LAST-MODIFIED:20190626T130251Z
   * UID:P4QYCUD27C2Z2WYIZXN67
   * SUMMARY:Event User
   * SEQUENCE:1
   * DTSTART;VALUE=DATE:20190628
   * DTEND;VALUE=DATE:20190629
   * END:VEVENT
   * END:VCALENDAR
   */
  public parseToCalendarEvent(iCalendarData: string): CalendarEvent {
    const jcalData = ICAL.parse(iCalendarData);
    const vcalendar = new ICAL.Component(jcalData);
    const vevent = vcalendar.getFirstSubcomponent("vevent");
    const event = new ICAL.Event(vevent);
    const tzid = vcalendar.getFirstSubcomponent("vtimezone")
      ? vcalendar
          .getFirstSubcomponent("vtimezone")
          .getFirstPropertyValue("tzid")
      : "Europe/Berlin";
    const duration = {
      weeks: event.duration.weeks,
      days: event.duration.days,
      hours: event.duration.hours,
      minutes: event.duration.minutes,
      seconds: event.duration.seconds,
      isNegative: event.duration.isNegative,
    };
    const attendees = [];
    event.attendees.forEach((value) => {
      attendees.push(value.getValues());
    });

    // if you try to add a event with `METHOD:REQUEST` in another calendar you will get `The HTTP 415 Unsupported Media Type` error.
    const iCalData = iCalendarData.replace("METHOD:REQUEST", "");

    const calendarEvent = {
      uid: event.uid,
      summary: event.summary,
      description: event.description,
      location: event.location,
      sequence: event.sequence,
      startDate: event.startDate.toJSDate(),
      endDate: event.endDate.toJSDate(),
      duration,
      organizer: event.organizer,
      attendees,
      isRecurring: event.isRecurring(),
      recurrenceId: event.recurrenceId,
      recurrenceIterator: event.iterator(),
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
    _event = null;
    _iter = null;

    public constructor(event: ICAL.event) {
        this._event = event;
        this._iter = event.iterator();
    }

    public next() {
        return this._event.getOccurrenceDetails(this._iter.next());
    }
}
