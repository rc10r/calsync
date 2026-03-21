import fs from "node:fs";
import readline from "node:readline";
import { calendar_v3, google, Auth } from "googleapis";
import { GCalDescriptor, LOG_DETAIL } from "../config";
import { CalendarEventData } from "../events";
import { log, logWithGCalEvent } from "../log";

// If modifying these scopes, delete token.json.
const SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKENS_FILE_PATH = "tokens.json";

const THROTTLING_DELAY = 200; // ms, Google API limit is 10 requests per second
function throttlingDelay() {
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      resolve();
    }, THROTTLING_DELAY);
  });
}

export async function listEvents(
  gcal: GCalDescriptor,
  start: Date,
  end: Date,
): Promise<calendar_v3.Schema$Event[]> {
  const auth = await getAuthenticatedClient(gcal.id);
  return await _listEvents(auth, gcal.id, start, end);
}

export async function deleteEvents(gcal: GCalDescriptor, start: Date, end: Date) {
  const auth = await getAuthenticatedClient(gcal.id);
  await _deleteEvents(auth, gcal.id, start, end);
}

export async function deleteEventsByIds(gcal: GCalDescriptor, eventIds: string[]) {
  const auth = await getAuthenticatedClient(gcal.id);
  await _deleteEventsByIds(auth, gcal.id, eventIds);
}

export async function insertEvents(
  gcal: GCalDescriptor,
  events: Array<calendar_v3.Schema$Event>,
) {
  const auth = await getAuthenticatedClient(gcal.id);
  await _insertEvents(auth, gcal.id, events);
}

export async function updateEvents(
  gcal: GCalDescriptor,
  updates: { eventId: string; eventData: CalendarEventData }[],
) {
  const auth = await getAuthenticatedClient(gcal.id);
  await _updateEvents(auth, gcal.id, updates);
}

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 */
async function getAuthenticatedClient(
  gcalAccountId: GCalDescriptor["id"],
): Promise<Auth.OAuth2Client> {
  const credentials = getCredentialsData();
  const { client_secret, client_id, redirect_uris } = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

  const tokens = loadTokens();
  const matchingToken = tokens[gcalAccountId];
  if (!matchingToken) {
    return await getAccessToken(gcalAccountId, oAuth2Client);
  } else {
    oAuth2Client.setCredentials(matchingToken);
    return oAuth2Client;
  }
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 */
async function getAccessToken(
  gcalAccountId: GCalDescriptor["id"],
  oAuth2Client: Auth.OAuth2Client,
): Promise<Auth.OAuth2Client> {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
  });
  log(
    `Authorize this app to access ${gcalAccountId} Google Calendar by visiting this url: ${authUrl}`,
  );
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const authCode: string = await new Promise((resolve) => {
    rl.question("Enter the code from that page here: ", (code) => {
      rl.close();
      resolve(code);
    });
  });
  return new Promise((resolve, reject) => {
    oAuth2Client.getToken(authCode, (err, token) => {
      if (err) {
        reject(`Error retrieving access token: ${err}`);
        return;
      }
      if (!token) {
        reject("No token received");
        return;
      }
      oAuth2Client.setCredentials(token);
      storeToken(gcalAccountId, token);
      resolve(oAuth2Client);
    });
  });
}

/**
 * Inserts the passed events in the specified calendar.
 */
async function _insertEvents(
  auth: Auth.OAuth2Client,
  calendarId: string,
  events: Array<calendar_v3.Schema$Event>,
) {
  const calendar = google.calendar({ version: "v3", auth });

  for (const evt of events) {
    await throttlingDelay(); // throttling is done before the call, otherwise calls failing in sequence would break the rate limit
    await calendar.events.insert({
      calendarId,
      requestBody: evt,
    });
    if (LOG_DETAIL) {
      logWithGCalEvent(`Inserted`, evt);
    }
  }
}

async function _updateEvents(
  auth: Auth.OAuth2Client,
  calendarId: string,
  updates: { eventId: string; eventData: CalendarEventData }[],
) {
  const calendar = google.calendar({ version: "v3", auth });

  for (const update of updates) {
    try {
      await throttlingDelay();
      await calendar.events.update({
        calendarId: calendarId,
        eventId: update.eventId,
        requestBody: update.eventData,
      });
      if (LOG_DETAIL) logWithGCalEvent(`Updated #${update.eventId}`, update.eventData);
    } catch {
      logWithGCalEvent(`Error updating event #${update.eventId}`, update.eventData);
    }
  }
}

/**
 * Deletes all upcoming events on the specified calendar.
 */
async function _deleteEvents(
  auth: Auth.OAuth2Client,
  calendarId: string,
  start: Date,
  end: Date,
) {
  const calendar = google.calendar({ version: "v3", auth });
  const events = await _listEvents(auth, calendarId, start, end);

  if (events.length === 0) return;

  for (const evt of events) {
    try {
      await calendar.events.delete({
        calendarId: calendarId,
        eventId: evt.id ?? undefined,
      });
      if (LOG_DETAIL) logWithGCalEvent("Deleted", evt);
      await throttlingDelay();
    } catch (err) {
      throw new Error(
        `Error deleting event "${evt.summary}" (${evt.start?.date ?? evt.start?.dateTime})": ${err}`,
      );
    }
  }
}

async function _deleteEventsByIds(
  auth: Auth.OAuth2Client,
  calendarId: string,
  eventIds: string[],
) {
  const calendar = google.calendar({ version: "v3", auth });

  for (const evtId of eventIds) {
    try {
      await calendar.events.delete({
        calendarId: calendarId,
        eventId: evtId,
      });
      if (LOG_DETAIL) log(`Deleted event #${evtId}`);
      await throttlingDelay();
    } catch {
      throw new Error(`Error deleting event #${evtId}`);
    }
  }
}

/**
 * List upcoming events in the specified calendar.
 */
async function _listEvents(
  auth: Auth.OAuth2Client,
  calendarId: string,
  start: Date,
  end: Date,
  allEvents?: calendar_v3.Schema$Event[],
  nextPageToken?: string,
): Promise<calendar_v3.Schema$Event[]> {
  const calendar = google.calendar({ version: "v3", auth });
  if (!allEvents) allEvents = [];

  const res = await calendar.events.list({
    calendarId: calendarId,
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
    pageToken: nextPageToken,
  });
  if (res.data.items) {
    res.data.items.forEach((i) => allEvents!.push(i));
  }
  if (res.data.nextPageToken) {
    return _listEvents(auth, calendarId, start, end, allEvents, res.data.nextPageToken);
  }
  return allEvents;
}

/**
 * Returns the data from the credentials.json file.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getCredentialsData(): any {
  const credentialsData = JSON.parse(fs.readFileSync("credentials.json").toString());
  return credentialsData;
}

function loadTokens(): Record<string, Auth.Credentials> {
  try {
    return JSON.parse(fs.readFileSync(TOKENS_FILE_PATH).toString());
  } catch {
    return {};
  }
}

function storeToken(gcalAccountId: GCalDescriptor["id"], token: Auth.Credentials) {
  const tokens = loadTokens();
  tokens[gcalAccountId] = token;
  fs.writeFileSync(TOKENS_FILE_PATH, JSON.stringify(tokens));
  log(`Token stored to ${TOKENS_FILE_PATH}`);
}
