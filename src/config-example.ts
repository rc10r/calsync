// A source's events are made private on the target calendar using one of two,
// mutually exclusive strategies:
//   - `redactedSummary`: the summary is replaced by this string and the
//     description is dropped (kept only for calsync's own bookkeeping).
//   - `visibility: 'private'`: the summary and description are copied
//     unmodified, but the copied event's visibility is set to 'private' so
//     only the target calendar's owner can see its details.
// If both are set, `visibility` takes precedence and `redactedSummary` is ignored.
//
// `showAs` forces the copied events' free/busy status on the target
// calendar, regardless of what it was on the source. Leave unset to keep
// the source's original free/busy status.
//
// `colorId` sets the copied events' color on the target calendar. Google
// Calendar's fixed palette: 1 Lavender, 2 Sage, 3 Grape, 4 Flamingo,
// 5 Banana, 6 Tangerine, 7 Peacock, 8 Graphite, 9 Blueberry, 10 Basil,
// 11 Tomato.

export type CalDavDescriptor = {
  kind: 'CalDav',
  label: string,
  url: string,
  username: string,
  password: string,
  redactedSummary?: string,
  visibility?: 'private',
  showAs?: 'free' | 'busy',
  colorId?: string
};

export type GCalDescriptor = {
  kind: 'GCal',
  label: string,
  id: string,
  redactedSummary?: string,
  visibility?: 'private',
  showAs?: 'free' | 'busy',
  colorId?: string
};

export const isGCalDescriptor = (d: any): d is GCalDescriptor => d.kind === 'GCal';

export type CalendarDescriptor = CalDavDescriptor | GCalDescriptor;

// A string that will be searched in event summaries to prevent
// the redacting of the summary when copying the event.
export const FORCE_SHARING_SIGN = "👀";
export const LOG_DETAIL = true;

export const sources: CalendarDescriptor[] = [
  {
    kind: 'GCal',
    label: 'public',
    id: 'your-name@gmail.com',
    redactedSummary: 'Public',
  },
  {
    kind: 'GCal',
    label: 'personal',
    id: 'your-other-name@gmail.com',
    redactedSummary: 'Personal',
    showAs: 'free',
    colorId: '8' // Graphite
  },
  {
    kind: 'CalDav',
    label: 'home',
    url: 'https://dav.domain.com/calendars/123456/home/',
    username: 'your-username@domain.com',
    password: 'your-password',
    visibility: 'private'
  },
];

export const target: CalendarDescriptor = {
  kind: 'GCal',
  label: 'mirror-target',
  id: 'your-calendar-id@group.calendar.google.com'
};

export const dryMode: boolean = true; 
export const targetMode: string = 'sync'; // 'sync' or 'mirror'
export const calsyncFingerprint: string = '[Synced with https://github.com/rchampourlier/calsync]';
// How many days in the future to sync events. Kept short by default since
// calsync deletes/re-creates target events within this window on every run:
// a small window limits the blast radius of a bad sync and is enough
// visibility if calsync runs frequently.
export const daysToSync: number = 14;
