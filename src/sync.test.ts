import { describe, expect, test } from "bun:test";
import { calsyncFingerprint } from "./config";
import {
  type CalendarEvent,
  type CalendarEventData,
  type GCalEvent,
  eventDataToGCalEvent,
  extractCalDAVEventData,
  extractGCalEventData,
  isCalDAVEvent,
  isGCalEvent,
} from "./events";
import * as sync from "./sync";
import * as fixtures from "./testSupport/fixtures";

function mapEventToDataWithDescription(evt: CalendarEvent): CalendarEventData {
  const result = (() => {
    if (isGCalEvent(evt)) return { eventData: extractGCalEventData(evt), srcId: evt.id };
    if (isCalDAVEvent(evt)) return { eventData: extractCalDAVEventData(evt), srcId: evt.uid };
    throw new Error("Unexpected event type");
  })();
  // Mimic sync.ts behavior: prepend existing description
  result.eventData.description = `${result.eventData.description || ""}\nOriginal ID: ${result.srcId}\n${calsyncFingerprint}`;
  return result.eventData;
}

function mapEventToTargetEvent(evt: CalendarEvent): GCalEvent {
  const result = (() => {
    if (isGCalEvent(evt)) return { eventData: extractGCalEventData(evt), srcId: evt.id };
    if (isCalDAVEvent(evt)) return { eventData: extractCalDAVEventData(evt), srcId: evt.uid };
    throw new Error("Unexpected evt type not recognized");
  })();

  const newEvt = eventDataToGCalEvent(result.eventData);
  newEvt.id = result.srcId;
  // Mimic sync.ts behavior: prepend existing description
  newEvt.description = `${result.eventData.description || ""}\nOriginal ID: ${result.srcId}\n${calsyncFingerprint}`;
  return newEvt;
}

describe("ToGCal", () => {
  test("transparent event is not inserted", () => {
    const sourcesEvents = [
      { event: fixtures.GetCalDAV("transparent"), redactedSummary: undefined },
    ];
    const targetEvents: GCalEvent[] = [];
    expect(sync.toGCal(sourcesEvents, targetEvents)).toStrictEqual({
      insert: [],
      update: [],
      delete: [],
    });
  });

  test("summary is correctly redacted on insertion", () => {
    const sourcesEvents = [
      {
        event: fixtures.GetCalDAV("nonTransparent"),
        redactedSummary: "redacted",
      },
    ];
    const targetEvents: GCalEvent[] = [];
    const expectedInsertEventData = mapEventToDataWithDescription(
      fixtures.GetCalDAV("nonTransparent"),
    );
    expectedInsertEventData.summary = "redacted";

    expect(sync.toGCal(sourcesEvents, targetEvents)).toStrictEqual({
      insert: [expectedInsertEventData],
      update: [],
      delete: [],
    });
  });

  test("empty sources and target", () => {
    const sourcesEvents: { event: CalendarEvent; redactedSummary: string | undefined }[] = [];
    const targetEvents: GCalEvent[] = [];
    expect(sync.toGCal(sourcesEvents, targetEvents)).toStrictEqual({
      insert: [],
      update: [],
      delete: [],
    });
  });

  test("empty target", () => {
    const sourcesEvents = [
      { event: fixtures.GetGCal("common"), redactedSummary: undefined },
      { event: fixtures.GetCalDAV("allDay"), redactedSummary: undefined },
    ];
    const targetEvents: GCalEvent[] = [];
    expect(sync.toGCal(sourcesEvents, targetEvents)).toStrictEqual({
      insert: sourcesEvents.map((e) => mapEventToDataWithDescription(e.event)),
      update: [],
      delete: [],
    });
  });

  test("empty sources and non-empty target", () => {
    const sourcesEvents: { event: CalendarEvent; redactedSummary: string | undefined }[] = [];
    const targetEvents = [fixtures.GetGCal("common"), fixtures.GetCalDAV("nonTransparent")].map(
      (e) => mapEventToTargetEvent(e),
    );
    expect(sync.toGCal(sourcesEvents, targetEvents)).toStrictEqual({
      insert: [],
      update: [],
      delete: targetEvents.map((e) => e.id!),
    });
  });

  test("target events are in sync with sources events", () => {
    const sourcesEvents = [
      { event: fixtures.GetGCal("common"), redactedSummary: undefined },
      {
        event: fixtures.GetCalDAV("nonTransparent"),
        redactedSummary: undefined,
      },
    ];
    const targetEvents = sourcesEvents.map((e) => mapEventToTargetEvent(e.event));

    expect(sync.toGCal(sourcesEvents, targetEvents)).toStrictEqual({
      insert: [],
      update: [],
      delete: [],
    });
  });

  test("source events changed to transparent is deleted", () => {
    const sourcesEvents = [
      { event: fixtures.GetGCal("common"), redactedSummary: undefined },
      { event: fixtures.GetCalDAV("transparent"), redactedSummary: undefined },
    ];
    const targetEvents = sourcesEvents.map((e) => mapEventToTargetEvent(e.event));

    expect(sync.toGCal(sourcesEvents, targetEvents)).toStrictEqual({
      insert: [],
      update: [],
      delete: ["00000001-AAAA-BBBB-CCCC-DDDDDDDDDDDD"],
    });
  });

  test("event updated in sources", () => {
    const updatedGCalEvent = fixtures.GetGCal("common");
    updatedGCalEvent.start!.dateTime = "2020-12-28T13:00:00+01:00";
    updatedGCalEvent.end!.dateTime = "2020-12-28T14:00:00+01:00";
    updatedGCalEvent.summary = "Updated common event";
    const sourcesEvents = [
      { event: updatedGCalEvent, redactedSummary: undefined },
      {
        event: fixtures.GetCalDAV("nonTransparent"),
        redactedSummary: undefined,
      },
    ];

    const targetUpdatedEvent = fixtures.GetGCal("common");
    targetUpdatedEvent.id = "aaaa_20201228T100000Z";
    // Changing the matching target's event ID to ensure the update API call
    // is done using it's ID and not the one of the matching sources event.
    targetUpdatedEvent.description = `Original ID: ${updatedGCalEvent.id}\n${calsyncFingerprint}`;
    // Adjusting the description so it correctly mentions the original event's ID.
    const targetEvents = [
      targetUpdatedEvent,
      mapEventToTargetEvent(fixtures.GetCalDAV("nonTransparent")),
    ];

    const updateEvtData = mapEventToDataWithDescription(updatedGCalEvent);
    updateEvtData.start.dateTime = updatedGCalEvent.start?.dateTime!;
    updateEvtData.end.dateTime = updatedGCalEvent.end?.dateTime!;
    updateEvtData.summary = updatedGCalEvent.summary!;

    expect(sync.toGCal(sourcesEvents, targetEvents)).toStrictEqual({
      insert: [],
      update: [{ eventId: targetUpdatedEvent.id, eventData: updateEvtData }],
      delete: [],
    });
  });

  test("missing event in target", () => {
    const sourcesEvents = [
      { event: fixtures.GetGCal("common"), redactedSummary: undefined },
      {
        event: fixtures.GetCalDAV("nonTransparent"),
        redactedSummary: undefined,
      },
    ];
    const targetEvents = [fixtures.GetCalDAV("nonTransparent")].map((e) =>
      mapEventToTargetEvent(e),
    );

    expect(sync.toGCal(sourcesEvents, targetEvents)).toStrictEqual({
      insert: [mapEventToDataWithDescription(fixtures.GetGCal("common"))],
      update: [],
      delete: [],
    });
  });

  test("extraneous event in target", () => {
    const sourcesEvents = [
      { event: fixtures.GetGCal("common"), redactedSummary: undefined },
      {
        event: fixtures.GetCalDAV("nonTransparent"),
        redactedSummary: undefined,
      },
    ];
    const targetEvents = [
      fixtures.GetGCal("common"),
      fixtures.GetCalDAV("nonTransparent"),
      fixtures.GetCalDAV("transparent"),
    ].map((e) => mapEventToTargetEvent(e));

    expect(sync.toGCal(sourcesEvents, targetEvents)).toStrictEqual({
      insert: [],
      update: [],
      delete: [fixtures.GetCalDAV("transparent").uid],
    });
  });

  test("multiple changes", () => {
    const srcEventThatWasUpdated = fixtures.GetGCal("common");
    srcEventThatWasUpdated.start!.dateTime = "2020-12-28T13:00:00+01:00";
    srcEventThatWasUpdated.end!.dateTime = "2020-12-28T14:00:00+01:00";
    const sourcesEvents = [
      { event: srcEventThatWasUpdated, redactedSummary: undefined },
      {
        event: fixtures.GetCalDAV("nonTransparent"),
        redactedSummary: undefined,
      },
      { event: fixtures.GetCalDAV("nonAllDay"), redactedSummary: undefined },
    ];

    const targetEventToBeUpdated = fixtures.GetGCal("common");
    targetEventToBeUpdated.id = "aabbccdd"; // changing so we confirm the update is done using this id
    targetEventToBeUpdated.description = `Original ID: ${srcEventThatWasUpdated.id}`; // to match with srcEvent...
    const targetEvents = [targetEventToBeUpdated].concat(
      [fixtures.GetCalDAV("nonTransparent"), fixtures.GetCalDAV("allDay")].map(
        mapEventToTargetEvent,
      ),
    );

    const updateEventData = mapEventToDataWithDescription(fixtures.GetGCal("common"));
    updateEventData.start.dateTime = "2020-12-28T13:00:00+01:00";
    updateEventData.end.dateTime = "2020-12-28T14:00:00+01:00";

    expect(
      (() => {
        const results = sync.toGCal(sourcesEvents, targetEvents);
        return results;
      })(),
    ).toStrictEqual({
      insert: [mapEventToDataWithDescription(fixtures.GetCalDAV("nonAllDay"))],
      update: [{ eventId: targetEventToBeUpdated.id, eventData: updateEventData }],
      delete: [fixtures.GetCalDAV("allDay").uid],
    });
  });

  test("a target event absent from source without the fingerprint in the description is ignored", () => {
    const sourcesEvents: { event: CalendarEvent; redactedSummary: string | undefined }[] = [];
    const targetEvent = fixtures.GetGCal("common");
    const targetEvents = [targetEvent].map((e) => mapEventToTargetEvent(e));
    targetEvents[0].description = "This event should simply be ignored";

    expect(sync.toGCal(sourcesEvents, targetEvents)).toStrictEqual({
      insert: [],
      update: [],
      delete: [],
    });
  });
});
