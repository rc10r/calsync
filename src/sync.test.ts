import {
  CalendarEvent,
  CalendarEventData,
  eventDataToGCalEvent,
  extractCalDAVEventData,
  extractGCalEventData,
  GCalEvent,
  isCalDAVEvent,
  isGCalEvent,
} from "./events";
import * as sync from "./sync";
import * as fixtures from "./testSupport/fixtures";
import { calsyncFingerprint } from "./config";

function mapEventToDataWithDescription(evt: CalendarEvent): CalendarEventData {
  const { eventData, srcId } = (() => {
    if (isGCalEvent(evt))
      return { eventData: extractGCalEventData(evt), srcId: evt.id };
    if (isCalDAVEvent(evt))
      return { eventData: extractCalDAVEventData(evt), srcId: evt.uid };
  })();
  eventData.description = `Original ID: ${srcId}\n${calsyncFingerprint}`;
  return eventData;
}

function mapEventToTargetEvent(evt: CalendarEvent): GCalEvent {
  const { eventData, srcId } = (() => {
    if (isGCalEvent(evt))
      return { eventData: extractGCalEventData(evt), srcId: evt.id };
    if (isCalDAVEvent(evt))
      return { eventData: extractCalDAVEventData(evt), srcId: evt.uid };
    throw new Error("Unexpected evt type not recognized");
  })();

  const newEvt = eventDataToGCalEvent(eventData);
  newEvt.id = srcId;
  newEvt.description = `Original ID: ${srcId}\n${calsyncFingerprint}`;
  return newEvt;
}

describe("ToGCal", () => {
  test("transparent event is not inserted", () => {
    const sourcesEvents = [
      { event: fixtures.GetCalDAV("transparent"), redactedSummary: undefined },
    ];
    const targetEvents = [];
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
    const targetEvents = [];
    let expectedInsertEventData = mapEventToDataWithDescription(
      fixtures.GetCalDAV("nonTransparent")
    );
    expectedInsertEventData.summary = "redacted";

    expect(sync.toGCal(sourcesEvents, targetEvents)).toStrictEqual({
      insert: [expectedInsertEventData],
      update: [],
      delete: [],
    });
  });

  test("description is dropped and replaced by the fingerprint when redacting", () => {
    const commonEvent = fixtures.GetGCal("common");
    const sourcesEvents = [
      { event: commonEvent, redactedSummary: "redacted" },
    ];
    const targetEvents = [];
    const expectedInsertEventData = mapEventToDataWithDescription(commonEvent);
    expectedInsertEventData.summary = "redacted";

    expect(sync.toGCal(sourcesEvents, targetEvents)).toStrictEqual({
      insert: [expectedInsertEventData],
      update: [],
      delete: [],
    });
  });

  test("private mode keeps the summary and description untouched and marks the event private", () => {
    const commonEvent = fixtures.GetGCal("common");
    const sourcesEvents = [
      {
        event: commonEvent,
        redactedSummary: "should be ignored",
        visibility: "private" as const,
      },
    ];
    const targetEvents = [];
    const expectedInsertEventData = extractGCalEventData(commonEvent);
    expectedInsertEventData.description = `${commonEvent.description}\nOriginal ID: ${commonEvent.id}\n${calsyncFingerprint}`;
    expectedInsertEventData.visibility = "private";

    expect(sync.toGCal(sourcesEvents, targetEvents)).toStrictEqual({
      insert: [expectedInsertEventData],
      update: [],
      delete: [],
    });
  });

  test("showAs 'free' forces transparency regardless of the source's own transparency", () => {
    const sourcesEvents = [
      {
        event: fixtures.GetCalDAV("nonTransparent"),
        redactedSummary: undefined,
        showAs: "free" as const,
      },
    ];
    const targetEvents = [];
    const expectedInsertEventData = mapEventToDataWithDescription(
      fixtures.GetCalDAV("nonTransparent")
    );
    expectedInsertEventData.transparency = "transparent";

    expect(sync.toGCal(sourcesEvents, targetEvents)).toStrictEqual({
      insert: [expectedInsertEventData],
      update: [],
      delete: [],
    });
  });

  test("colorId sets the copied event's color", () => {
    const sourcesEvents = [
      {
        event: fixtures.GetCalDAV("nonTransparent"),
        redactedSummary: undefined,
        colorId: "8",
      },
    ];
    const targetEvents = [];
    const expectedInsertEventData = mapEventToDataWithDescription(
      fixtures.GetCalDAV("nonTransparent")
    );
    expectedInsertEventData.colorId = "8";

    expect(sync.toGCal(sourcesEvents, targetEvents)).toStrictEqual({
      insert: [expectedInsertEventData],
      update: [],
      delete: [],
    });
  });

  test("empty sources and target", () => {
    const sourcesEvents = [];
    const targetEvents = [];
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
    const targetEvents = [];
    expect(sync.toGCal(sourcesEvents, targetEvents)).toStrictEqual({
      insert: sourcesEvents.map((e) => mapEventToDataWithDescription(e.event)),
      update: [],
      delete: [],
    });
  });

  test("empty sources and non-empty target", () => {
    const sourcesEvents = [];
    const targetEvents = [
      fixtures.GetGCal("common"),
      fixtures.GetCalDAV("nonTransparent"),
    ].map((e) => mapEventToTargetEvent(e));
    expect(sync.toGCal(sourcesEvents, targetEvents)).toStrictEqual({
      insert: [],
      update: [],
      delete: targetEvents.map((e) => e.id),
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
    const targetEvents = sourcesEvents.map((e) =>
      mapEventToTargetEvent(e.event)
    );

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
    const targetEvents = sourcesEvents.map((e) =>
      mapEventToTargetEvent(e.event)
    );

    expect(sync.toGCal(sourcesEvents, targetEvents)).toStrictEqual({
      insert: [],
      update: [],
      delete: ["00000001-AAAA-BBBB-CCCC-DDDDDDDDDDDD"],
    });
  });

  test("event updated in sources", () => {
    const updatedGCalEvent = fixtures.GetGCal("common");
    updatedGCalEvent.start.dateTime = "2020-12-28T13:00:00+01:00";
    updatedGCalEvent.end.dateTime = "2020-12-28T14:00:00+01:00";
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

    const updateEvtData = mapEventToDataWithDescription(targetUpdatedEvent);
    updateEvtData.start.dateTime = updatedGCalEvent.start.dateTime;
    updateEvtData.end.dateTime = updatedGCalEvent.end.dateTime;
    updateEvtData.summary = updatedGCalEvent.summary;
    updateEvtData.description = targetUpdatedEvent.description; // keeping the updated event's ID in the description

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
      mapEventToTargetEvent(e)
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
    srcEventThatWasUpdated.start.dateTime = "2020-12-28T13:00:00+01:00";
    srcEventThatWasUpdated.end.dateTime = "2020-12-28T14:00:00+01:00";
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
        mapEventToTargetEvent
      )
    );

    const updateEventData = mapEventToDataWithDescription(
      fixtures.GetGCal("common")
    );
    updateEventData.start.dateTime = "2020-12-28T13:00:00+01:00";
    updateEventData.end.dateTime = "2020-12-28T14:00:00+01:00";

    expect(
      (() => {
        const results = sync.toGCal(sourcesEvents, targetEvents);
        return results;
      })()
    ).toStrictEqual({
      insert: [mapEventToDataWithDescription(fixtures.GetCalDAV("nonAllDay"))],
      update: [
        { eventId: targetEventToBeUpdated.id, eventData: updateEventData },
      ],
      delete: [fixtures.GetCalDAV("allDay").uid],
    });
  });

  test("a target event absent from source without the fingerprint in the description is ignored", () => {
    const sourcesEvents = [];
    let targetEvent = fixtures.GetGCal("common");
    const targetEvents = [targetEvent].map((e) => mapEventToTargetEvent(e));
    targetEvents[0]["description"] = "This event should simply be ignored";

    expect(sync.toGCal(sourcesEvents, targetEvents)).toStrictEqual({
      insert: [],
      update: [],
      delete: [],
    });
  });
});
