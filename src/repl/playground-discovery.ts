import * as caldav from "../caldav/caldav";
import { CalDAVService } from "../caldav/caldav.service";
import { CalDavDescriptor } from "../config";
import { configs } from "./configs";

async function main() {
  const caldavService = CalDAVService.getInstance();
  const { url: rootUrl, username, password } = configs.icloud;
  const principalUrl = rootUrl + "12140803/principal";
  const calendarHomeSetUrl = rootUrl + "12140803/calendars";
  const calendarUrl = rootUrl + "12140803/calendars/home";

  const xml = `
  <c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
    <d:prop>
      <d:getetag />
      <c:calendar-data />
    </d:prop>
    <c:filter>
      <c:comp-filter name="VCALENDAR">
        <c:comp-filter name="VEVENT" />
      </c:comp-filter>
    </c:filter>
  </c:calendar-query>`;

  const depth = "1";
  const method = "REPORT";
  const response = await caldavService.sendRequest(
    calendarUrl,
    username,
    password,
    xml,
    method,
    depth
  );
  console.log(response);
}

main();
