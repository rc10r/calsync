import { calsyncFingerprint } from "./config";
import {
  type CalendarEvent,
  type CalendarEventData,
  type GCalEvent,
  compareEventsData,
  extractEventData,
  extractGCalEventData,
  isCalDAVEvent,
  isGCalEvent,
} from "./events";
import { NewSummary, ShouldCopy } from "./rules";

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
 */
export function toGCal(
  sourcesEvents: { event: CalendarEvent; redactedSummary: string | undefined }[],
  targetEvents: GCalEvent[],
): SyncToGCalInstructions {
  const eventsInsert: CalendarEventData[] = [];
  const eventsUpdate: { eventId: string; eventData: CalendarEventData }[] = [];
  const eventsDelete: string[] = [];

  const markedTargetEventIds: string[] = []; // ids of target events matched with sources events (missing are deleted)

  for (const srcEvt of sourcesEvents) {
    const srcEvtData = extractEventData(srcEvt.event);
    const matchingId = (() => {
      if (isGCalEvent(srcEvt.event)) return srcEvt.event.id ?? "";
      if (isCalDAVEvent(srcEvt.event)) return srcEvt.event.uid;
      return "";
    })();

    // Search matching event in targetEvents
    const matchingTargetEvt = (() => {
      for (const targetEvt of targetEvents) {
        if (targetEvt.description?.includes(matchingId)) return targetEvt;
      }
      return undefined;
    })();

    srcEvtData.description = `${srcEvtData.description || ""}\nOriginal ID: ${matchingId}\n${calsyncFingerprint}`;

    // Ignoring events not to be copied
    if (
      !ShouldCopy(
        srcEvtData.summary,
        !!srcEvtData.transparency && srcEvtData.transparency === "transparent",
      )
    )
      continue;
    srcEvtData.summary = NewSummary(srcEvtData.summary, srcEvt.redactedSummary);

    if (!matchingTargetEvt) {
      // No match on ID -> insert
      eventsInsert.push(srcEvtData);
    } else {
      // Match on ID -> update or do nothing
      const targetId = matchingTargetEvt.id ?? "";
      markedTargetEventIds.push(targetId);

      if (!compareEventsData(extractGCalEventData(matchingTargetEvt), srcEvtData)) {
        // Not matching on content -> update
        eventsUpdate.push({
          eventId: targetId,
          eventData: srcEvtData,
        });
      }
    }
  }

  for (const targetEvt of targetEvents) {
    const targetId = targetEvt.id ?? "";
    if (
      targetEvt.description?.includes(calsyncFingerprint) &&
      !markedTargetEventIds.includes(targetId)
    ) {
      // Deleting events which have the calsync fingerprint and have
      // not been marked (not matched with a source event).
      eventsDelete.push(targetId);
    }
  }

  return {
    insert: eventsInsert,
    update: eventsUpdate,
    delete: eventsDelete,
  };
}
