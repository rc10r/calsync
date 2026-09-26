import {
  CalendarEvent,
  CalendarEventData,
  compareEventsData,
  extractEventData,
  extractGCalEventData,
  GCalEvent,
  isCalDAVEvent,
  isGCalEvent,
} from "./events";
import { NewSummary, ShouldCopy } from "./rules";
import { calsyncFingerprint } from "./config";

export type SyncToGCalInstructions = {
  insert: CalendarEventData[];
  update: { eventId: string; eventData: CalendarEventData }[];
  delete: string[];
};

/**
 * Returns instructions to perform a synchronisation between
 * sources' events and target's ones.
 *
 * Algorithm:
 *   - Makes a map of both sourcesEvents and targetEvents on UID key
 *   - Returns a `SyncInstructions` object where the events in
 *     insert/update/delete array properties are objects in `sourcesEvents`.
 *
 * @param sourcesEvents
 * @param targetEvents
 */
export function toGCal(
  sourcesEvents: {
    event: CalendarEvent;
    redactedSummary?: string;
    visibility?: "private";
    showAs?: "free" | "busy";
    colorId?: string;
  }[],
  targetEvents: GCalEvent[]
): SyncToGCalInstructions {
  const eventsInsert: CalendarEventData[] = [];
  const eventsUpdate: { eventId: string; eventData: CalendarEventData }[] = [];
  const eventsDelete: string[] = [];

  const markedTargetEventIds: string[] = []; // ids of target events matched with sources events (missing are deleted)

  for (const srcEvt of sourcesEvents) {
    const srcEvtData = extractEventData(srcEvt.event);
    const matchingId = (() => {
      if (isGCalEvent(srcEvt.event)) return srcEvt.event.id;
      if (isCalDAVEvent(srcEvt.event)) return srcEvt.event.uid;
    })();

    // Search matching event in targetEvents
    const matchingTargetEvt = (() => {
      for (const targetEvt of targetEvents) {
        if (targetEvt.description && targetEvt.description.includes(matchingId))
          return targetEvt;
      }
      return undefined;
    })();

    const isPrivate = srcEvt.visibility === "private";

    // In private mode, the original description is kept (with calsync's
    // bookkeeping appended). Otherwise, the description is dropped entirely
    // so it doesn't leak alongside the redacted summary.
    srcEvtData.description = isPrivate
      ? (srcEvtData.description || '') + `\nOriginal ID: ${matchingId}\n${calsyncFingerprint}`
      : `Original ID: ${matchingId}\n${calsyncFingerprint}`;

    // Ignoring events not to be copied
    if (
      !ShouldCopy(
        srcEvtData.summary,
        !!srcEvtData.transparency && srcEvtData.transparency === "transparent"
      )
    )
      continue;

    if (isPrivate) {
      srcEvtData.visibility = "private";
    } else {
      srcEvtData.summary = NewSummary(srcEvtData.summary, srcEvt.redactedSummary);
    }

    // Overrides the copied event's free/busy status, regardless of what it
    // was on the source event.
    if (srcEvt.showAs) {
      srcEvtData.transparency = srcEvt.showAs === "free" ? "transparent" : "opaque";
    }

    if (srcEvt.colorId) {
      srcEvtData.colorId = srcEvt.colorId;
    }

    if (!matchingTargetEvt) {
      // No match on ID -> insert
      eventsInsert.push(srcEvtData);
    } else {
      // Match on ID -> update or do nothing
      markedTargetEventIds.push(matchingTargetEvt.id);

      if (
        !compareEventsData(extractGCalEventData(matchingTargetEvt), srcEvtData)
      ) {
        // Not matching on content -> update
        eventsUpdate.push({
          eventId: matchingTargetEvt.id,
          eventData: srcEvtData,
        });
      }
    }
  }

  for (const targetEvt of targetEvents) {
    if (
      targetEvt.description &&
      targetEvt.description.includes(calsyncFingerprint) &&
      !markedTargetEventIds.includes(targetEvt.id)
    ) {
      // Deleting events which have the calsync fingerprint and have
      // not been marked (not matched with a source event).
      eventsDelete.push(targetEvt.id);
    }
  }

  return {
    insert: eventsInsert,
    update: eventsUpdate,
    delete: eventsDelete,
  };
}
