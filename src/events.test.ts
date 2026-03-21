import { describe, expect, test } from "bun:test";
import * as events from "./events";
import * as fixtures from "./testSupport/fixtures";

describe("isCalDAVEvent", () => {
  test("CalDAV event", () => {
    expect(events.isCalDAVEvent(fixtures.GetCalDAV("allDay"))).toEqual(true);
  });

  test("GCal event", () => {
    expect(events.isCalDAVEvent(fixtures.GetCalDAV("allDay"))).toEqual(true);
  });
});

describe("compareEventsData", () => {
  function fixture(scenario: "date" | "datetime"): events.CalendarEventData {
    const data: events.CalendarEventData = {
      summary: "summary",
      start: {},
      end: {},
      transparency: "transparent",
      description: "description",
    };
    if (scenario === "date") {
      data.start.date = "2020-01-01";
      data.end.date = "2020-01-02";
    }
    if (scenario === "datetime") {
      data.start.dateTime = "2020-01-01T12:00:00.00Z";
      data.end.dateTime = "2020-01-01T13:00:00.00Z";
    }
    return data;
  }

  test("same events", () => {
    expect(events.compareEventsData(fixture("date"), fixture("date"))).toEqual(true);
  });

  test("same UTC time represented in different TZ match", () => {
    const evt = fixture("datetime");
    evt.start.dateTime = "2020-01-01T13:00:00+01:00";
    evt.start.date = undefined;
    evt.end.dateTime = "2020-01-01T14:00:00+01:00";
    evt.end.date = undefined;
    expect(events.compareEventsData(fixture("datetime"), evt)).toStrictEqual(true);
  });

  test("different start kind (date/time)", () => {
    const evt = fixture("date");
    evt.start.date = undefined;
    evt.start.dateTime = "2020-01-01T12:00:00.000Z";
    expect(events.compareEventsData(fixture("date"), evt)).toEqual(false);
  });

  test("different start date", () => {
    const evt = fixture("date");
    evt.start.date = "2020-01-02";
    expect(events.compareEventsData(fixture("date"), evt)).toEqual(false);
  });

  test("different start time", () => {
    const evtA = fixture("date");
    evtA.start.date = undefined;
    evtA.start.dateTime = "2020-01-01T12:00:00.000Z";
    const evtB = fixture("date");
    evtB.start.date = undefined;
    evtB.start.dateTime = "2020-01-01T13:00:00.000Z";
    expect(events.compareEventsData(evtA, evtB)).toEqual(false);
  });

  test("different summaries", () => {
    const evt = fixture("date");
    evt.summary = "Not the same";
    expect(events.compareEventsData(fixture("date"), evt)).toEqual(false);
  });

  test("different transparency", () => {
    const evt = fixture("date");
    evt.transparency = undefined;
    expect(events.compareEventsData(fixture("date"), evt)).toEqual(false);
  });
});
