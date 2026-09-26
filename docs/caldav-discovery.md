# CalDAV discovery

How a CalDAV client finds a user's calendars starting from nothing but a server
hostname and credentials — and why calsync doesn't do it yet.

> "WebCal discovery" is the name this was filed under, but the mechanism below is
> **CalDAV** discovery (RFC 4791 / RFC 6764). `webcal://` is a different, unrelated
> thing: a read-only subscription to a static `.ics` file, with no discovery,
> no auth and no writes.

## Where calsync stands today

calsync does **no** discovery. A `CalDavDescriptor` in `src/config.ts` carries a
`url` that you must find by hand:

```ts
{
  kind: 'CalDav',
  label: 'home',
  url: 'https://pNN-caldav.icloud.com/123456789/calendars/home/',
  username: '...',
  password: '...',
}
```

That URL points straight at a single **calendar collection**. `CalendarClient`
(`src/caldav/calendar-client.ts`) issues every request against it directly, so
the whole discovery chain below is skipped. This is why the README tells you to
go fish the URL out of Thunderbird.

Implementing discovery would let the config carry just a hostname (or an email
address) and let calsync enumerate the calendars behind it.

## The discovery chain

Four steps. Each one hands you the URL for the next.

```
  /.well-known/caldav
        │  {DAV:}current-user-principal
        ▼
  /123456789/principal/
        │  {urn:ietf:params:xml:ns:caldav}calendar-home-set
        ▼
  /123456789/calendars/            ← the home, a *container* of calendars
        │  PROPFIND Depth: 1
        ▼
  /123456789/calendars/home/       ← an actual calendar collection
  /123456789/calendars/<uuid>/
  …
```

The responses below are real, captured against iCloud, then anonymised and
abridged: the account number is `<ACCOUNT>`, calendar UUIDs are `<UUID>`,
display names are replaced, whitespace is squashed, and unrelated calendars and
properties are omitted. Element names, namespaces and nesting are verbatim —
those are the parts that matter here.

### 1. Context path — `/.well-known/caldav`

Defined by [RFC 6764 §6](https://www.rfc-editor.org/rfc/rfc6764#section-6).
Bootstraps the whole process: you only need to know the host.

```http
PROPFIND /.well-known/caldav HTTP/1.1
Depth: 0
Content-Type: application/xml; charset=utf-8
Authorization: Basic ************

<?xml version="1.0" encoding="utf-8"?>
<A:propfind xmlns:A="DAV:">
  <A:prop>
    <A:current-user-principal/>
    <A:resourcetype/>
  </A:prop>
</A:propfind>
```

The spec-canonical answer is a `301` with a `Location:` header pointing at the
CalDAV context path. **iCloud does not redirect** — it answers the PROPFIND in
place with a `207`, which is more convenient:

```http
HTTP/1.1 207 Multi-Status

<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<multistatus xmlns="DAV:">
  <response xmlns="DAV:">
    <href>/<ACCOUNT>/principal/</href>
    <propstat>
      <prop>
        <current-user-principal xmlns="DAV:">
          <href xmlns="DAV:">/<ACCOUNT>/principal/</href>
        </current-user-principal>
      </prop>
      <status>HTTP/1.1 200 OK</status>
    </propstat>
  </response>
</multistatus>
```

A client must therefore handle **both** shapes: follow a `3xx` `Location`, or
read `current-user-principal` straight out of a `207`.

> **Gotcha.** Asking for `current-user-principal` on a *calendar collection* URL
> (the kind of URL calsync has in its config) does not work on iCloud. It comes
> back inside a `404` propstat:
>
> ```xml
> <propstat>
>   <prop><current-user-principal xmlns="DAV:"/></prop>
>   <status>HTTP/1.1 404 Not Found</status>
> </propstat>
> ```
>
> Start at `/.well-known/caldav` or the server root, not at a calendar.
>
> This is also why you must check the per-`propstat` `<status>` and discard the
> unsuccessful ones — a `207` can carry `404`s and `200`s side by side in the
> same `<response>`.

### 2. Current user principal → calendar home

Ask the principal URL for `calendar-home-set`
([RFC 4791 §6.2.1](https://www.rfc-editor.org/rfc/rfc4791#section-6.2.1)):

```http
PROPFIND /<ACCOUNT>/principal/ HTTP/1.1
Depth: 0

<?xml version="1.0" encoding="utf-8"?>
<A:propfind xmlns:A="DAV:">
  <A:prop>
    <B:calendar-home-set xmlns:B="urn:ietf:params:xml:ns:caldav"/>
    <A:displayname/>
  </A:prop>
</A:propfind>
```

```xml
<multistatus xmlns="DAV:">
  <response xmlns="DAV:">
    <href>/<ACCOUNT>/principal/</href>
    <propstat>
      <prop>
        <calendar-home-set xmlns="urn:ietf:params:xml:ns:caldav">
          <href xmlns="DAV:">https://pNN-caldav.icloud.com:443/<ACCOUNT>/calendars/</href>
        </calendar-home-set>
        <displayname xmlns="DAV:">Some User</displayname>
      </prop>
      <status>HTTP/1.1 200 OK</status>
    </propstat>
  </response>
</multistatus>
```

Two things to note:

- The home-set `href` is an **absolute URL with an explicit `:443`**, not a path.
  Other servers return a bare path (`/DAV/calendars/`). Resolve it against the
  request URL rather than assuming either form.
- The home-set is a **container of calendars, not a calendar**. You are not done.

### 3. List the calendars — `PROPFIND Depth: 1`

```http
PROPFIND /<ACCOUNT>/calendars/ HTTP/1.1
Depth: 1

<?xml version="1.0" encoding="utf-8"?>
<A:propfind xmlns:A="DAV:">
  <A:prop>
    <A:displayname/>
    <A:resourcetype/>
    <B:supported-calendar-component-set xmlns:B="urn:ietf:params:xml:ns:caldav"/>
  </A:prop>
</A:propfind>
```

You get one `<response>` per child, including the home itself:

```xml
<multistatus xmlns="DAV:">

  <!-- the home itself: a plain collection, NOT a calendar -->
  <response xmlns="DAV:">
    <href>/<ACCOUNT>/calendars/</href>
    <propstat><prop>
      <displayname xmlns="DAV:">Some User</displayname>
      <resourcetype xmlns="DAV:"><collection/></resourcetype>
      <supported-calendar-component-set xmlns="urn:ietf:params:xml:ns:caldav">
        <comp name='VEVENT'/><comp name='VTODO'/><comp name='VFREEBUSY'/>
      </supported-calendar-component-set>
    </prop><status>HTTP/1.1 200 OK</status></propstat>
  </response>

  <!-- a reminders list: a calendar, but VTODO-only -->
  <response xmlns="DAV:">
    <href>/<ACCOUNT>/calendars/<UUID>/</href>
    <propstat><prop>
      <displayname xmlns="DAV:">Rappels</displayname>
      <resourcetype xmlns="DAV:">
        <collection/><calendar xmlns="urn:ietf:params:xml:ns:caldav"/>
      </resourcetype>
      <supported-calendar-component-set xmlns="urn:ietf:params:xml:ns:caldav">
        <comp name='VTODO'/>
      </supported-calendar-component-set>
    </prop><status>HTTP/1.1 200 OK</status></propstat>
  </response>

  <!-- an actual event calendar -->
  <response xmlns="DAV:">
    <href>/<ACCOUNT>/calendars/home/</href>
    <propstat><prop>
      <displayname xmlns="DAV:">Home</displayname>
      <resourcetype xmlns="DAV:">
        <collection/><calendar xmlns="urn:ietf:params:xml:ns:caldav"/>
        <shared-owner xmlns="http://calendarserver.org/ns/"/>
      </resourcetype>
      <supported-calendar-component-set xmlns="urn:ietf:params:xml:ns:caldav">
        <comp name='VEVENT'/><comp name='VTODO'/><comp name='VFREEBUSY'/>
      </supported-calendar-component-set>
    </prop><status>HTTP/1.1 200 OK</status></propstat>
  </response>

</multistatus>
```

So filtering a home-set listing down to calendars calsync can actually sync means
**two** tests, not one:

1. `resourcetype` contains `{urn:ietf:params:xml:ns:caldav}calendar` — drops the
   home collection itself. Note this test cannot be skipped: the home advertises
   `VEVENT` in its `supported-calendar-component-set` despite being a plain
   `<collection/>`, so the component test alone would let it through.
2. `supported-calendar-component-set` advertises `VEVENT` — drops reminder/todo
   lists, which *are* calendars by `resourcetype` but hold no events.

An iCloud account typically also exposes `inbox`/`outbox` (scheduling) and
`notification` collections here; both tests above already exclude them.

## Namespaces, prefixes, and why the parsing broke

This is the part `src/caldav/caldav.service.ts` used to work around one server at
a time. It is now fixed — see [Fixes](#fixes) — but the reasoning is worth
keeping, because the symptom is easy to misdiagnose as a server bug.

### The rule

In XML, **a namespace prefix is arbitrary and purely local to the document that
declares it.** These three documents are *identical* to a namespace-aware parser:

```xml
<d:multistatus xmlns:d="DAV:">          <d:response/></d:multistatus>
<banana:multistatus xmlns:banana="DAV:"><banana:response/></banana:multistatus>
<multistatus xmlns="DAV:">              <response/></multistatus>
```

The last form — what iCloud emits — binds `DAV:` as the *default* namespace, so
descendants need no prefix at all.

Crucially: **the prefixes you choose in your request have no bearing on the
prefixes the server uses in its response.** calsync sends `xmlns:C=` / `xmlns:D=`;
iCloud replies with default namespaces; another server replies with `d:`. All
three are correct and interoperable.

**So iCloud is not violating the standard.** It declares `xmlns="DAV:"` on
`<multistatus>` and re-declares it on nested elements. The namespace is present
and correct — it simply isn't carried by a prefix. The bug was on our side.

### What calsync actually does

`sendRequest` parses with `xml2js.parseString` using default options. **xml2js is
namespace-unaware**: it keys the object by the raw, literal tag name and treats
`xmlns` as an ordinary attribute. That produces two different failure modes from
the same root cause.

**Failure 1 — the key changes with the server's prefix.**

```js
result['d:multistatus']['d:response']   // works on a prefixed server, fails on iCloud
result['multistatus']['response']       // works on iCloud, fails on a prefixed server
```

The code used to hardcode one or the other, which is why the README warned that
the iCloud fix (commit `7c18c75`) may have broken other CalDAV servers. It did:
that commit swapped the first spelling for the second rather than removing the
dependency on the prefix.

**Failure 2 — the node type changes with where `xmlns` is declared.**

Because iCloud re-declares `xmlns` on each element, xml2js sees an attribute and
wraps the node in an object; a server that declares namespaces once at the root
yields a bare string:

```js
// iCloud: <calendar-data xmlns="urn:ietf:params:xml:ns:caldav">DATA</calendar-data>
{ _: 'DATA', $: { xmlns: 'urn:ietf:params:xml:ns:caldav' } }

// root-declared: <c:calendar-data>DATA</c:calendar-data>
'DATA'
```

That is exactly why the code has to pass `iCalendarData._` rather than
`iCalendarData`, and why doing so breaks the other server shape.

### Fixes

**What calsync does now.** `sendRequest` parses with
`MULTISTATUS_PARSE_OPTIONS` (`tagNameProcessors: [stripPrefix]` plus
`xmlns: true`) and pulls the payload out via `extractCalendarData`, which finds
the `propstat` actually holding `calendar-data`, checks its namespace, and
returns null for responses that carry none. `caldav.service.test.ts` asserts the
three prefix spellings below all parse identically. The rest of this section
explains why those two options, and not one of them, are the answer.

**Minimal — normalise the tag names.** xml2js ships a `stripPrefix` tag-name
processor. It drops the prefix so both server shapes land on the same key:

```ts
import * as xml2js from 'xml2js';

xml2js.parseString(response, {
  tagNameProcessors: [xml2js.processors.stripPrefix],
}, (err, result) => {
  const data = result['multistatus']['response'];   // now works on both
  // …
  const node = eventData['propstat'][0]['prop'][0]['calendar-data'][0];
  const iCalendarData = typeof node === 'object' ? node._ : node;   // still needed
});
```

`stripPrefix` fixes **failure 1 only**. It rewrites tag names, and the `{_, $}`
wrapping of failure 2 is driven by the `xmlns` *attribute*, so it survives
untouched — the two shapes still differ in node type:

```js
// with stripPrefix alone:
iCloud   -> { _: 'DATA', $: { xmlns: 'urn:ietf:params:xml:ns:caldav' } }
prefixed -> 'DATA'
```

Hence the `typeof node === 'object' ? node._ : node` above is not optional.

Two further caveats: `stripPrefix` discards namespaces entirely, so two
properties with the same local name in different namespaces would collide (it
doesn't arise for the small fixed set calsync reads), and it is applied to the
whole document, so every access path must drop its prefix consistently.

**Better, still one option away — add `xmlns: true`.** It makes xml2js record
each node's resolved namespace as `$ns: { uri, local }`, and uniformly wraps
every node as `{ _, $ns }` regardless of where `xmlns` was declared. Combined
with `stripPrefix` the two server shapes become byte-for-byte identical to
consume, and the collision caveat goes away because you can assert the URI:

```ts
xml2js.parseString(response, {
  tagNameProcessors: [xml2js.processors.stripPrefix],
  xmlns: true,
}, (err, result) => {
  const node = /* … */['calendar-data'][0];
  // node.$ns === { uri: 'urn:ietf:params:xml:ns:caldav', local: 'calendar-data' }
  // node._  === 'BEGIN:VCALENDAR…'      ← on iCloud *and* on prefixed servers
});
```

Verified against both shapes with the `xml2js@0.6.0` already in this repo.

Note that `xmlns: true` on its own is *not* enough: it adds `$ns` but leaves the
object keys as the literal prefixed tag names (`result['d:multistatus']`,
`prop[0]['c:calendar-data']`). You would have to iterate children and match on
`$ns.uri` instead of indexing by key. `stripPrefix` is what makes indexing work.

**Correct — parse namespace-aware.** Key each property by its
`{namespace}localName` ("Clark notation") so the server's prefix choice becomes
irrelevant by construction. This is what
[`nextcloud/cdav-library`](https://github.com/nextcloud/cdav-library) does — see
`_parseMultiStatusResponse` in `src/request.js`, which walks the DOM with XPath
and a namespace resolver:

```js
parsedProperties[`{${propNode.namespaceURI}}${propNode.localName}`]
  = this.parser.parse(document, propNode, NS.resolve)
```

with namespaces declared centrally in `src/utility/namespaceUtility.js`:

```js
export const DAV = 'DAV:'
export const IETF_CALDAV = 'urn:ietf:params:xml:ns:caldav'
export const CALENDARSERVER = 'http://calendarserver.org/ns/'
export const APPLE = 'http://apple.com/ns/ical/'
```

Properties are then read as `body['{DAV:}current-user-principal']` — stable
across every server. The `stripPrefix` + `xmlns: true` combination above gets
calsync equivalent guarantees without adding a DOM/XPath dependency; going all
the way to Clark-notation keys would mean walking the parsed tree and re-keying
on `$ns.uri`.

Note that `cdav-library` is a browser library (it uses `DOMParser`,
`document.evaluate` and `axios`), so it can't be dropped into calsync as-is.
It's a reference for the *protocol*, not a dependency.

## References

- [RFC 4791 — CalDAV](https://www.rfc-editor.org/rfc/rfc4791), §6.2.1
  `calendar-home-set`, §4.2 calendar collection properties
- [RFC 6764 — Locating CalDAV services](https://www.rfc-editor.org/rfc/rfc6764),
  §6 `.well-known`, §3 SRV/TXT DNS bootstrapping (not covered above; not
  implemented by `cdav-library` either)
- [RFC 5397 — `current-user-principal`](https://www.rfc-editor.org/rfc/rfc5397)
- [Calendars and Address Books Discovery Mechanisms](https://www.webdavsystem.com/server/creating_caldav_carddav/discovery/)
  — the same four steps written from the server's side
- [Getting user's list of calendars from CalDAV](https://stackoverflow.com/questions/11622447/getting-users-list-of-calendars-from-caldav)
  — accepted answer gives the same sequence, and warns specifically against
  using `principal-match` instead of `current-user-principal`
- [`nextcloud/cdav-library`](https://github.com/nextcloud/cdav-library) —
  `src/index.js` (`connect`, `_discoverPrincipalUri`), `src/models/calendarHome.js`
  (`findAllCalendars`), `src/request.js` (`_parseMultiStatusResponse`)

## Reproducing this

Every response above was captured with a plain `https.request` PROPFIND using the
credentials already in `src/config.ts`. All four steps are read-only, so probing
a server is safe. Start at `/.well-known/caldav` on the host and follow the
`href`s.
