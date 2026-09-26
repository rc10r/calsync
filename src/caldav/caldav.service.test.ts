import * as xml2js from 'xml2js';
import { MULTISTATUS_PARSE_OPTIONS, extractCalendarData } from './caldav.service';

/**
 * A CalDAV server's choice of XML namespace prefix is arbitrary and unrelated
 * to the prefixes we send in the query, so the multistatus parsing must not
 * depend on it. These fixtures are the same document written three ways.
 *
 * See docs/caldav-discovery.md.
 */

const ICAL = 'BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:abc\nEND:VEVENT\nEND:VCALENDAR';

// iCloud: default namespace, re-declared on every element, no prefix anywhere.
const icloudShape = `<?xml version="1.0" encoding="UTF-8"?>
<multistatus xmlns="DAV:">
  <response xmlns="DAV:">
    <href>/123/calendars/home/abc.ics</href>
    <propstat>
      <prop>
        <calendar-data xmlns="urn:ietf:params:xml:ns:caldav">${ICAL}</calendar-data>
      </prop>
      <status>HTTP/1.1 200 OK</status>
    </propstat>
  </response>
</multistatus>`;

// The shape the code expected before the iCloud fix: prefixes declared once
// at the root.
const prefixedShape = `<?xml version="1.0" encoding="UTF-8"?>
<d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:response>
    <d:href>/calendars/user/home/abc.ics</d:href>
    <d:propstat>
      <d:prop>
        <c:calendar-data>${ICAL}</c:calendar-data>
      </d:prop>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
  </d:response>
</d:multistatus>`;

// Same document, arbitrary prefixes, to make the point that nothing about the
// prefix itself is meaningful.
const oddlyPrefixedShape = `<?xml version="1.0" encoding="UTF-8"?>
<banana:multistatus xmlns:banana="DAV:" xmlns:kiwi="urn:ietf:params:xml:ns:caldav">
  <banana:response>
    <banana:href>/calendars/user/home/abc.ics</banana:href>
    <banana:propstat>
      <banana:prop>
        <kiwi:calendar-data>${ICAL}</kiwi:calendar-data>
      </banana:prop>
      <banana:status>HTTP/1.1 200 OK</banana:status>
    </banana:propstat>
  </banana:response>
</banana:multistatus>`;

function parse(xml: string): any {
  let parsed: any;
  xml2js.parseString(xml, MULTISTATUS_PARSE_OPTIONS, (err, result) => {
    if (err) {
      throw err;
    }
    parsed = result;
  });
  return parsed;
}

describe('multistatus parsing', () => {
  const shapes: [string, string][] = [
    ['iCloud (default namespace)', icloudShape],
    ['d:/c: prefixes', prefixedShape],
    ['arbitrary prefixes', oddlyPrefixedShape],
  ];

  test.each(shapes)('%s reaches the response via the same key', (_label, xml) => {
    const result = parse(xml);
    expect(result['multistatus']['response']).toHaveLength(1);
  });

  test.each(shapes)('%s yields the same iCalendar payload', (_label, xml) => {
    const response = parse(xml)['multistatus']['response'][0];
    expect(extractCalendarData(response)).toEqual(ICAL);
  });
});

describe('extractCalendarData', () => {
  test('skips unsuccessful propstat blocks', () => {
    // A 207 can mix successful and unsuccessful propstats for one resource,
    // so the block holding calendar-data is not necessarily the first.
    const xml = `<multistatus xmlns="DAV:">
      <response xmlns="DAV:">
        <href>/123/calendars/home/abc.ics</href>
        <propstat>
          <prop><getetag/></prop>
          <status>HTTP/1.1 404 Not Found</status>
        </propstat>
        <propstat>
          <prop>
            <calendar-data xmlns="urn:ietf:params:xml:ns:caldav">${ICAL}</calendar-data>
          </prop>
          <status>HTTP/1.1 200 OK</status>
        </propstat>
      </response>
    </multistatus>`;
    const response = parse(xml)['multistatus']['response'][0];
    expect(extractCalendarData(response)).toEqual(ICAL);
  });

  test('returns null when the response carries no calendar-data', () => {
    // Collections listed alongside events have no calendar-data; they must be
    // skipped rather than crash the parse.
    const xml = `<multistatus xmlns="DAV:">
      <response xmlns="DAV:">
        <href>/123/calendars/home/</href>
        <propstat>
          <prop><resourcetype><collection/></resourcetype></prop>
          <status>HTTP/1.1 200 OK</status>
        </propstat>
      </response>
    </multistatus>`;
    const response = parse(xml)['multistatus']['response'][0];
    expect(extractCalendarData(response)).toBeNull();
  });

  test('ignores a calendar-data in a foreign namespace', () => {
    const xml = `<multistatus xmlns="DAV:">
      <response xmlns="DAV:">
        <href>/123/calendars/home/abc.ics</href>
        <propstat>
          <prop>
            <calendar-data xmlns="http://example.com/ns">not the caldav one</calendar-data>
          </prop>
          <status>HTTP/1.1 200 OK</status>
        </propstat>
      </response>
    </multistatus>`;
    const response = parse(xml)['multistatus']['response'][0];
    expect(extractCalendarData(response)).toBeNull();
  });
});
