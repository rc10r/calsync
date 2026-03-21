import { CalDAVService } from "../caldav/caldav.service";
import { CalDAVEvent, GCalEvent } from "../events";

const calDAVService = CalDAVService.getInstance();

const events = {
  calDAV: {
    transparent: "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Apple Inc.//Mac OS X 10.15.6//EN\nCALSCALE:GREGORIAN\nBEGIN:VEVENT\nCREATED:20200925T150317Z\nUID:00000001-AAAA-BBBB-CCCC-DDDDDDDDDDDD\nDTEND;VALUE=DATE:20260102\nTRANSP:TRANSPARENT\nX-APPLE-TRAVEL-ADVISORY-BEHAVIOR:AUTOMATIC\nSUMMARY:Event CalDav Transparent\nLAST-MODIFIED:20200925T150330Z\nDTSTAMP:20200925T150331Z\nDTSTART;VALUE=DATE:20260101\nSEQUENCE:1\nEND:VEVENT\nEND:VCALENDAR\n",
    nonTransparent: "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Apple Inc.//Mac OS X 10.15.6//EN\nCALSCALE:GREGORIAN\nBEGIN:VEVENT\nCREATED:20200925T150317Z\nUID:00000002-AAAA-BBBB-CCCC-DDDDDDDDDDDD\nDTEND;VALUE=DATE:20260102\nX-APPLE-TRAVEL-ADVISORY-BEHAVIOR:AUTOMATIC\nSUMMARY:Event CalDav NonTransparent\nLAST-MODIFIED:20200925T150330Z\nDTSTAMP:20200925T150331Z\nDTSTART;VALUE=DATE:20260101\nSEQUENCE:1\nEND:VEVENT\nEND:VCALENDAR\n",
    nonAllDay: "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Apple Inc.//Mac OS X 10.15.7//EN\nCALSCALE:GREGORIAN\nBEGIN:VEVENT\nCREATED:20200904T080202Z\nUID:00000003-AAAA-BBBB-CCCC-DDDDDDDDDDDD\nDTEND;TZID=Europe/Madrid:20201204T184500\nX-APPLE-TRAVEL-ADVISORY-BEHAVIOR:AUTOMATIC\nSUMMARY:Event CalDav NonAllDay\nLAST-MODIFIED:20201204T151202Z\nDTSTAMP:20200915T114436Z\nDTSTART;TZID=Europe/Madrid:20201204T174500\nSEQUENCE:1\nEND:VEVENT\nEND:VCALENDAR\n",
    allDay: "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Apple Inc.//Mac OS X 10.15.6//EN\nCALSCALE:GREGORIAN\nBEGIN:VEVENT\nCREATED:20200925T150317Z\nUID:00000004-AAAA-BBBB-CCCC-DDDDDDDDDDDD\nDTEND;VALUE=DATE:20260102\nX-APPLE-TRAVEL-ADVISORY-BEHAVIOR:AUTOMATIC\nSUMMARY:Event CalDav AllDay\nLAST-MODIFIED:20200925T150330Z\nDTSTAMP:20200925T150331Z\nDTSTART;VALUE=DATE:20260101\nSEQUENCE:1\nBEGIN:VALARM\nX-WR-ALARMUID:4DAC8762-EDD1-4A98-83BC-CD7F7D621A33\nUID:00000004-AAAA-BBBB-CCCC-DDDDDDDDDDDD\nTRIGGER:-PT15H\nX-APPLE-DEFAULT-ALARM:TRUE\nATTACH;VALUE=URI:Chord\nACTION:AUDIO\nEND:VALARM\nEND:VEVENT\nEND:VCALENDAR\n"
  },
  gCal: {
    common: {
      "kind": "calendar#event",
      "etag": "\"1234567890012345\"",
      "id": "1234567890987654321234567_20201228T100000Z",
      "status": "confirmed",
      "htmlLink": "https://www.google.com/calendar/event?eid=ABCDEFH",
      "created": "2020-10-25T13:24:57.000Z",
      "updated": "2020-12-23T10:49:51.482Z",
      "summary": "Common GCal event",
      "description": "Some important event",
      "creator": { "email": "person1@gmail.com" }, "organizer": { "email": "person1@gmail.com" },
      "start": { "dateTime": "2020-12-28T11:00:00+01:00", "timeZone": "Europe/Paris" },
      "end": { "dateTime": "2020-12-28T12:00:00+01:00", "timeZone": "Europe/Paris" },
      "recurringEventId": "1234567890987654321234567",
      "originalStartTime": { "dateTime": "2020-12-28T11:00:00+01:00", "timeZone": "Europe/Paris" },
      "iCalUID": "1234567890987654321234567@google.com",
      "sequence": 1,
      "attendees": [{ "email": "person1@gmail.com", "organizer": true, "responseStatus": "accepted" }, { "email": "person2@gmail.com", "responseStatus": "declined" }],
      "hangoutLink": "https://meet.google.com/tnt-mnho-kvn", "conferenceData": {
        "createRequest": {
          "requestId": "5729bq52cr13t82uhtbenones8", "conferenceSolutionKey": { "type": "hangoutsMeet" },
          "status": { "statusCode": "pending" }
        },
        "entryPoints": [{ "entryPointType": "video", "uri": "https://meet.google.com/aaa-bbbb-ccc", "label": "meet.google.com/aaa-bbbb-ccc" }], "conferenceSolution": { "key": { "type": "hangoutsMeet" }, "name": "Google Meet", "iconUri": "https://fonts.gstatic.com/s/i/productlogos/meet_2020q4/v6/web-512dp/logo_meet_2020q4_color_2x_web_512dp.png" }, "conferenceId": "aaa-bbb-cccc", "signature": "abcdefg"
      },
      "guestsCanModify": true,
      "reminders": { "useDefault": false }
    }
  }
};

export function GetGCal(_fixture: 'common'): GCalEvent {
  return JSON.parse(JSON.stringify(events.gCal.common));
};

export function GetCalDAV(fixture: 'transparent' | 'nonTransparent' | 'allDay' | 'nonAllDay'): CalDAVEvent {
  return calDAVService.parseToCalendarEvent(events.calDAV[fixture]);
}
