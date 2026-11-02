# Technical Reference

## Architecture

Static file overlay with no backend and no build step. The browser (OBS Browser Source) loads `overlay.html` directly from a local HTTP server. All state is in-memory; nothing is persisted between page loads.

```
OBS Browser Source
  └─ http://localhost:8080/overlay.html
       ├─ styles.css
       ├─ config.js          (loaded first — global CONFIG object)
       └─ js/
            main.js → schedule.js, donations.js, widgets.js, dixper.js
```

**Serving**: `npx serve .` or `python -m http.server 8080`. A server is required (not `file://`) because `fetch()` to the DonorDrive API requires an HTTP origin for CORS.

## Canvas

1920×1080px. All overlay elements use `position: absolute` or `position: fixed` within the root container. Nothing uses document flow layout — every zone is explicitly placed.

## config.js

The single file the user edits each year. Exports a global `CONFIG` object (no ES modules — plain `var CONFIG = { ... }` so it works without a bundler).

```js
var CONFIG = {
  participantId: 12345,
  teamId: 67890,

  schedule: [
    {
      game: "Game Name",
      startTime: "2025-11-01T08:00:00",  // ISO 8601, local time
      endTime:   "2025-11-01T10:00:00",
      suggestedDixperSkills: ["Skill A", "Skill B"]
    }
  ],

  dixperMenu: [
    { skill: "Screen Blur", dollarAmount: 5,  description: "Blurs the game screen for 30s" },
    { skill: "Invert Colors", dollarAmount: 3, description: "Inverts display colors for 15s" }
  ],

  timing: {
    donationPollMs:       60000,   // Extra Life donation poll interval
    totalsPollMs:        120000,   // Extra Life totals poll interval
    upcomingPreviewMarksMin: [20, 15, 10, 5], // minutes-left marks for an "up next" preview
    upcomingPreviewMs:    30000,   // how long each preview holds
    upcomingTakeoverMin:      2,   // final minutes showing "up next" only
    fullScheduleWidgetMs:1800000,  // show full schedule every 30 min
    dixperMenuWidgetMs:  900000,   // show Dixper menu every 15 min
    dixperSkillsWidgetMs:420000,   // show skill suggestions every 7 min
    widgetDisplayMs:      20000    // how long each widget stays visible
  }
};
```

## DonorDrive API

Base URL: `https://extralife.donordrive.com/api`

No authentication required. Responses are JSON. Use native `fetch()`.

### Versioning

API version is passed as a query parameter: `?version=1.6`. Default (no parameter) is v1.0. Current latest is **1.6**. Note: v1.4 is scheduled for deprecation in Q1 2026 — use 1.6.

### Key Endpoints

| Endpoint | Purpose | Poll with |
|---|---|---|
| `GET /participants/{participantID}` | `displayName`, `fundraisingGoal`, `sumDonations`, `numDonations`, `avatarImageURL` | `totalsPollMs` |
| `GET /teams/{teamID}` | `name`, `fundraisingGoal`, `sumDonations`, `numDonations`, `numParticipants`, `captainDisplayName` | `totalsPollMs` |
| `GET /participants/{participantID}/donations` | Recent donations, ordered `createdDateUTC DESC` by default | `donationPollMs` |
| `GET /teams/{teamID}/donations` | Team-wide donations | `donationPollMs` |

Both numeric IDs and URL aliases work interchangeably in all paths.

### Query Parameters

| Parameter | Description |
|---|---|
| `limit` | Max results per page (default and maximum: 100) |
| `offset` | Zero-based pagination offset |
| `orderBy` | Sort field, e.g. `createdDateUTC DESC` |
| `where` | SQL-style filter on filterable fields |

### Response Codes

| Code | Meaning |
|---|---|
| 200 | OK |
| 204 | Pagination offset exceeds available records |
| 304 | Not modified (ETag/conditional GET hit) |
| 429 | Rate limited — back off and retry |
| 412 | Unsupported API version |

### Conditional GETs

Responses include `ETag` and `Last-Modified` headers. Pass `If-None-Match` / `If-Modified-Since` on subsequent requests to get 304s instead of full payloads when data hasn't changed. Useful for the totals poll.

### Deduplication

Donations endpoint returns newest-first by default. Track seen `donationID` values in a `Set`; on each poll take only IDs not already in the set.

**CORS**: OBS Browser Source runs Chromium with `--disable-web-security`, so CORS is not enforced there. When testing in a regular browser, a local CORS proxy may be needed (e.g. `npx local-cors-proxy`).

## Widget Rotation Engine (`widgets.js`)

Widgets are overlay panels that slide in, display for `widgetDisplayMs`, then slide out. They share a single display slot — only one widget is visible at a time.

- Each widget type registers itself with an interval (from `CONFIG.timing`)
- When a widget's interval fires, it enters a **queue**
- The engine dequeues and displays one widget at a time
- A widget supplies either a single render function or an array of page render functions, plus an optional per-item hold duration (defaults to `widgetDisplayMs`); the engine draws each page, waits that long, then advances, hiding after the last
- New donations are highest priority — they jump the queue
- CSS transitions handle enter/exit animation (translate + opacity); no JS animation

```
setInterval fires → push to queue
queue processor → pop next → add .visible class
                → draw page, wait widgetDisplayMs, repeat for each page
                → remove .visible
```

## schedule.js

Determines the current and next game by comparing `new Date()` against each schedule entry's `startTime`/`endTime`. No external dependency, no API calls.

Also owns the **current / upcoming game zone** (`#zone-current-game`) — feature 4 in `features.md`. The lookup helpers are still called on demand, but the zone runs its own 1-second tick so it can catch the 20/15/10/5-minute preview marks and the final 2-minute takeover as they pass.

The tick keeps a per-slot record of which marks have already fired and clears it when the active slot changes — without that, a mark re-triggers on every tick for a full minute. The zone re-paints only when its rendered content actually changes, so the fade transition does not restart each second.

## donations.js

Maintains a `Set` of seen `donationID` values. On each poll, filters the response (newest-first by default) to only new entries, then dispatches them to the widget queue. Stores the last-known totals for the persistent display zones. Passes `If-None-Match` / `If-Modified-Since` headers on totals polls to take advantage of 304 responses.

## CSS Conventions

- Variables in `:root` for brand colors, font sizes, z-index layers
- Widget panels: `position: absolute`, off-screen by default (`transform: translateX(110%)`), animated to `translateX(0)` when `.visible` is added
- Persistent zones (current game, donation total): always visible, no animation
- Extra Life `.webm` assets: `<video autoplay loop muted playsinline>`

## Dependency Rule

**Hard rule**: no build tools, no bundlers, no npm packages. Nothing that requires a compilation or build step.

**Allowed**: libraries loaded via `<script>` tag (CDN or local file) that the user has explicitly approved. jQuery is pre-approved. Any other library must be proposed and approved before use.

Default to vanilla `fetch()`, `setInterval`/`setTimeout`, `document.querySelector`/`classList`, and CSS `@keyframes`/`transition`. Only propose a library when there's a meaningful complexity or compatibility reason to do so.
