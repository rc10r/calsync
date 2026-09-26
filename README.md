# calsync

Synchronizes CalDAV calendars to Google Calendars and vice-versa.

## Why?

- You need to have your events in a Google Calendar for sharing or integration purposes, in particular to share availability (busy/free) more than the details of events.
- Your main calendar is in some CalDAV service (maybe for environmental footprint or data-privacy concerns).

## What does it do?

- Mirroring your calendars from/to CalDAV/Google Calendar.
- Filtering the events to be mirrored and obfuscating the details.

## How it works

It's doing a simple mirroring, not a synchronization. The mirroring is quite basic:

1. Delete all events on the target calendar.
2. Copy all event from the source(s) to the target.

This means you **MUST NOT** use your mirroring target for anything else than providing visibility on your events. Adding or modifying events in this calendar will only result in data loss.

### In more details

1. It fetches all upcoming events (all events with a start date greater than now) from the mirrored calendars.
1. It **deletes** all upcoming events (start date > now) in the Google Calendar.
1. It copies all upcoming events from the mirrored calendars to the target one.
1. It doesn't copy events that are marked "free". You may adjust the code if you want to copy them too.
1. It redacts the event summary using a string provided in the config, so personal information is not copied to the target calendars.
1. You may use a special character in your event's summary to prevent the redacting of the summary (cf. `FORCE_SHARING_SIGN` in the config).
1. Only the minimum information of the events is copied (summary, start and end date). Participants, description, location... are not copied, but you may adjust the code to do it if you want.

### Recurring events

- When fetching events, Google Calendar API returns an item for each occurrence of the recurring event. When copying it to CalDAV, we add an index at the end of the UID so the event is not overriden and we got a copy for each occurrence.

## How to use

**This repository is not intended to be usable as-is. It's intended to be cloned and modified to fit your needs.**

1. Modify the `config.ts` file to add your own data (calendar information) and credentials
1. Change the `app.ts` file and other parts of the code to fit your needs.

### Configuration

**CalDAV calendars**

- You will have to find the Calendar URL. You may look at [these instructions](https://help.runbox.com/using-a-calendar-client-with-caldav/) from Runbox on how to connect Thunderbird Lightning to a CalDAV server, you'll have to do the same to find the calendar's URL (in short, navigate in your browser to [](caldav.<replace-with-your-hosting-domain.com>)).
- You will have to add in the `config.ts` file your CalDAV account credentials. This will probably be your username and password.

NB: you have to find the URL by hand because calsync implements no CalDAV discovery — it talks to the single calendar collection you configure. [`docs/caldav-discovery.md`](docs/caldav-discovery.md) documents the protocol sequence (`.well-known` → `current-user-principal` → `calendar-home-set` → `PROPFIND Depth: 1`) that would let calsync enumerate calendars from just a hostname, with real iCloud requests and responses.

NB: the code has been adjusted to work with iCloud (commit `7c18c75481e85d8eb034babee28862b9a9d06514`). This may have broken compatibility with other CalDAV servers, so you may want to check the commit's change to restore it if you need to. The [namespaces section](docs/caldav-discovery.md#namespaces-prefixes-and-why-the-parsing-broke) of the discovery doc explains why that commit is server-specific — calsync's XML parsing is namespace-unaware and keys on the server's chosen prefix — and gives the fix that works with both iCloud and prefixed servers.

**Google Calendar calendars**

The authentication is more complex and you'll need to setup a Google Cloud Platform (GCP) project, download the API credentials and get an OAuth token for accessing your calendar. This is made easy by the code provided by Google and used in this repository but you'll still have to do some setup before. You should follow the steps from [this tutorial](https://developers.google.com/calendar/quickstart/nodejs).

- Once you downloaded the credentials JSON file, move it into this directory to `credentials.json`.
- If there was any, remove the `token.json` file.
- Run the script and follow the inline instructions. This will create a `token.json` file.

**Mirroring mode**

It will **delete all events** before making the copy. The mirror targets should thus not contain any other events than the ones copied from other calendars. So you should create dedicated calendars to serve as mirroring targets. Be sure to use their ID/URL in the config.

In `src/config.ts`:

```ts
export const targetMode: string = "mirror";
```

**Sync mode**

Sync mode performs a one-way synchronization, copying events from source calendars to the target one and keeps them up-to-date. Events from the target calendars that are not coming from the sync are left untouched.

In `src/config.ts`:

```ts
export const targetMode: string = "sync";
```

## How to build it

```sh
yarn build
```

The dist files are in `./dist` and the main JS is `./dist/app.js`.

## How to run it

```
scripts/run.sh
```

or in development:

```
yarn app
```

## How to automate running recurrently

You may copy `com.champourlier.calsync.plist` to your `$HOME/Library/LaunchAgents` and run `launchctl load $HOME/Library/LaunchAgents/com.champourlier.calsync.plist` to load it. Change to `unload` to unload it. Adjust the file as needed to run it how often you want.

More information on using `launchctl` in [this article](https://alvinalexander.com/mac-os-x/mac-osx-startup-crontab-launchd-jobs/).

## How to run with Docker

A `Dockerfile` is present in the repository.

Build the container:

```sh
docker build -t calsync .
```

Run the container:
It is important to set the TZ environment variable to the timezone your caldav calendar is in. Otherwise you will see target events shifted by your timezone difference to utc.
The below command will set TZ to the timezone of your docker host. 

```sh
docker run -e TZ="$(cat /etc/timezone)" calsync
```

## How to make changes

- You may want to do TDD, there are already some tests you may complete or change to fit your needs. Run them with `yarn test`.
- If you want to change the **sync** algorithm, it happens in `src/sync.ts`.

## Contribution

Feel free to add issues if you have suggestions, remarks or want to contribute.

## Credits

- [Ulrich Tiofack](https://github.com/TheJLifeX) for the [simple-caldav-client](https://github.com/TheJLifeX/simple-caldav-client) source code.

## Release Notes

### `1.4.0`

- Add support for multiple Google Calendar accounts.
- Updated for iCloud (replaces the previous CalDAV standard implementation that may not work anymore).
- Fixed bugs, with the help of `ppwwyyxx`.
- Updated to Node 20 and fixed Docker.

### `1.3.0`

- Add `Dockerfile` to enable running in Docker.
- Fix timezone issue (timezone mismatch while syncing from within a Docker container).
