# AGENTS.md — CalSync

## Project Overview

CalSync is a calendar synchronization tool that mirrors events between CalDAV calendars and Google Calendars. It supports multiple source calendars (both CalDAV and Google Calendar) syncing to a Google Calendar target, with event filtering, summary redaction for privacy, and recurring event handling.

## Architecture

```
src/
├── app.ts                  # Main entry point — orchestrates sync workflow
├── sync.ts                 # Core sync algorithm (diff sources vs target → insert/update/delete)
├── events.ts               # Event type mapping between GCal and CalDAV formats
├── rules.ts                # Event filtering (free/busy) and summary redaction
├── log.ts                  # Logging utilities with version prefix
├── config-example.ts       # Example config (users create config.ts from this)
├── caldav/
│   ├── caldav.ts           # CalDAV module entry — listEvents wrapper
│   ├── caldav.service.ts   # CalDAV HTTP/XML service (REPORT, PUT, DELETE)
│   ├── calendar-client.ts  # CalDAV client facade
│   ├── calendar-event.ts   # CalDAV event interface
│   └── calendar-event-duration.ts
├── gcal/
│   └── gcal.ts             # Google Calendar API (OAuth2, CRUD, pagination)
└── testSupport/
    └── fixtures.ts         # Test data fixtures (CalDAV iCal strings, GCal JSON)
```

## Key Concepts

- **CalendarDescriptor**: Config type for source/target calendars (`CalDav` or `GCal` kind)
- **CalendarEventData**: Unified internal event format used by the sync algorithm
- **calsyncFingerprint**: String marker added to synced events' descriptions to identify them for safe deletion
- **FORCE_SHARING_SIGN** (`👀`): Emoji in event summary that prevents redaction and forces sharing of transparent events
- **Redacted summary**: Each source can define a replacement summary for privacy (e.g., "Personal" instead of actual title)

## Configuration

Users must create `src/config.ts` (gitignored) based on `src/config-example.ts`. This file defines:
- `sources`: Array of CalDAV/GCal calendar descriptors
- `target`: The GCal calendar to sync events into
- `dryMode`: When true, logs changes without executing them
- `daysToSync`: How far ahead to sync (default 365 days)

Google OAuth credentials go in `credentials.json` (gitignored). Tokens are stored in `tokens.json`.

## Development

```bash
bun install              # Install dependencies
bun run build            # TypeScript compilation → dist/
bun run dev              # Run directly with Bun (development)
bun test                 # Run tests (bun:test)
bun run lint             # Biome lint + format check
bun run lint:fix         # Biome auto-fix
bun run format           # Biome formatting
bun run typecheck        # TypeScript type checking (no emit)
```

## Testing

Tests use Bun's built-in test runner (`bun:test`). Test files are co-located with source (`*.test.ts`). Fixtures in `src/testSupport/fixtures.ts` provide CalDAV iCal strings parsed by `CalDAVService.parseToCalendarEvent()` and GCal JSON objects.

Run tests before committing:
```bash
bun test
```

## Code Style

- TypeScript with strict settings
- Biome for linting and formatting (replaces ESLint + Prettier)
- Prefer `node:` prefix for Node.js built-in imports
- Use `import type` for type-only imports where possible

## CI/CD

GitHub Actions runs on push/PR to `main`:
- Biome lint check
- Type check
- Tests (bun:test)

## Important Notes

- Never commit `src/config.ts`, `credentials.json`, or `tokens.json` — they contain secrets
- The CalDAV service uses `rejectUnauthorized` controlled by `NODE_TLS_REJECT_UNAUTHORIZED` env var (defaults to validating certificates)
- Google API calls are throttled to 200ms per call (10 req/sec limit)
- The sync algorithm only deletes target events that have the calsync fingerprint (safe deletion)
- Runtime: Bun (also compatible with Node.js >= 20 for production via `dist/`)
