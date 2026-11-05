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

  // Which side of the canvas the rotating widgets sit on: 'right' or 'left'.
  // The accent border and the slide-in direction follow it.
  widgetSide: 'right',

  schedule: [
    {
      // An empty string means the slot is scheduled but the game is not yet
      // chosen; it renders as "Undecided". It does NOT mean a break — every
      // slot in the schedule is streaming time.
      game: "Game Name",
      startTime: "2025-11-01T08:00:00",  // ISO 8601, local time
      endTime:   "2025-11-01T10:00:00",
      suggestedDixperSkills: ["Skill A", "Skill B"]
    }
  ],

  // Name/value pairs only. `value` is a whole-dollar amount, as a string.
  // Skills are matched to schedule entries by `name`.
  dixperMenu: [
    { name: "Screen Blur",   value: "5" },
    { name: "Invert Colors", value: "3" }
  ],

  timing: {
    donationPollMs:       60000,   // Extra Life donation poll interval
    totalsPollMs:        120000,   // Extra Life totals poll interval
    upcomingAlternateFromMin: 15,  // minutes left when the run-in alternation starts
    upcomingAlternateEveryMs: 15000, // how long each side holds
    upcomingTakeoverMin:      2,   // final minutes showing "up next" only
    rotationRestMs:      300000,   // rest between widget rotations
    widgetDisplayMs:      20000,   // how long each widget stays visible
    fullSchedulePageMs:   10000    // per page of the paged schedule widget
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

- The scheduled widgets are driven by a **chained rotation**, not by per-widget intervals: `runRotation()` queues the schedule, and only when that has left the screen does it queue the Dixper widget, and only when *that* has left does it arm a `rotationRestMs` timer to start the next cycle
- Chaining is deliberate. With a `setInterval` per widget type, the higher-priority Dixper widget re-queued itself while the schedule was mid-display and then won the slot immediately after, starving the lower-priority schedule indefinitely. A fixed sequence removes the contention rather than tuning intervals to avoid it
- `enqueue(type, render, holdMs, opts)` — `opts.done` is what makes chaining possible. It must fire on **every** path, including when a widget declines to show (no remaining games, no active slot) and when an enqueue is rejected as a duplicate; otherwise the chain stalls and the overlay goes quiet for the rest of the event
- `opts.hiding` fires the instant a panel starts its exit transition, 400ms before `done`. It exists so the top banner can leave together with the last widget instead of trailing it by the length of the transition
- `render` is either a single function or an array of page render functions; the engine draws each page, waits `holdMs` (default `widgetDisplayMs`), then advances, hiding after the last
- Donation alerts do **not** enter this queue at all; see the donation alert section below
- CSS transitions handle enter/exit animation (translate + opacity); no JS animation
- `applyWidgetSide()` runs before the first widget is drawn and mirrors `CONFIG.widgetSide` onto `#widget-slot` as `.side-left` / `.side-right`; see the side-placement note under CSS Conventions

```
init → runRotation
         ↓
       Banner.show()
         ↓
       queue schedule ──→ display pages ──→ onDone
                                              ↓
       queue dixper skills ──→ display ──→ onHiding → Banner.hide()
                                        └─→ onDone
                                              ↓
                                    wait rotationRestMs
                                              ↓
                                         runRotation
```

## Donation alert (`widgets.js`)

The alert lives in `widgets.js` but runs **outside the widget queue**, with its own `alertQueue` / `alertShowing` pair. It occupies the centre of the screen while the rotation occupies the lower right, so there is nothing to arbitrate: a donation plays immediately rather than waiting on a widget, and the two can be visible together. It still queues internally, because one poll can return several donations.

`#donation-alert` is a centred box sized from `--alert-scale` holding a 1920×1080 VP9 `.webm` with an alpha channel. Sizing the box rather than applying `transform: scale()` keeps the font sizes independent of the artwork scale, while the text layer's percentage offsets continue to track the artwork.

`runDonationAlert()` sequences the text itself rather than using the engine's page mechanism, because that mechanism swaps content instantly and these phases need to cross-fade. It rewinds the video to 0, plays it, then schedules a fade-in and fade-out per phase.

Every one of those timers is guarded by an `alertRun` counter that increments per alert. Several donations can play back to back; without the guard, a previous alert's pending timers would write over the current one's text partway through.

`renderMarquee()` measures `scrollWidth` against `clientWidth` after inserting the text and only applies the scroll animation when it actually overflows, feeding the shift distance and duration into CSS custom properties.

`ALERT_FADE_MS` in `widgets.js` must match the `transition` on `#donation-alert-text` in `styles.css`, the same way `FADE_MS` in `schedule.js` matches `#game-zone-inner`.

## banner.js

`assets/ExtraLife-TopLine.png` as a full-canvas layer, parked at `translateY(-110%)` and slid to `0` by a `.visible` class. No timers: `show()` / `hide()` are called by `runRotation()`, so the banner is up exactly while a rotation widget is. Both are idempotent, which matters because `hide()` is called twice per cycle (on `onHiding`, then again on `onDone`) and may be called without a matching `show()` when a rotation step is skipped.

`main.js` must call `Banner.init()` **before** `Widgets.init()`, since the rotation starts synchronously inside `Widgets.init()` and shows the banner on its first line.

## schedule.js

Determines the current and next game by comparing `new Date()` against each schedule entry's `startTime`/`endTime`. No external dependency, no API calls.

Also owns the **current / upcoming game zone** (`#zone-current-game`) — feature 4 in `features.md`. The lookup helpers are still called on demand, but the zone runs its own 1-second tick so it can follow the run-in alternation and the final 2-minute takeover.

`desiredState()` is a **pure function of the clock**: given a time it returns `current` or `upcoming` with no stored state. It holds `current` until `upcomingAlternateFromMin`, alternates every `upcomingAlternateEveryMs` through the run-in, then returns `upcoming` for the last `upcomingTakeoverMin`. An earlier design used discrete preview marks at 20/15/10/5 minutes and needed per-slot "already fired" bookkeeping, reset on every slot change, because a 1-second tick would otherwise re-trigger the same mark for a full minute. Deriving the state removed that bookkeeping entirely.

The alternation grid is anchored to the **start of the run-in** (`fromMin * 60000 - msLeft`), not to page load and not to the slot's end. Page load would re-phase the cadence on every OBS source refresh; the slot's end leaves a partial period at the boundary, which shows as a single-tick flash of "up next" at exactly 15:00 before it settles.

The zone re-paints only when its rendered content actually changes, so the fade transition does not restart on each tick.

Two distinct fallback labels, deliberately not merged: `UNDECIDED_LABEL` ("Undecided") for a slot whose `game` is empty, and `OFF_SCHEDULE_LABEL` ("Taking a Break") for the clock sitting outside every slot. An empty `game` is streaming time with an unchosen title, so it keeps the "Now Playing" label and "until <end>" phrasing; only the off-schedule case means nothing is on. `UNDECIDED_LABEL` is exported on the module so `widgets.js` renders schedule rows with the same string.

## dixper.js

Pure lookup over static `CONFIG` data — no polling, no state. Resolves a schedule entry's `suggestedDixperSkills` name strings against `CONFIG.dixperMenu` by `name`, capped at 4.

`MAX_SUGGESTIONS = 4` is a hard ceiling on both paths, not a page size. The full menu is never displayed, so `CONFIG.dixperMenu` serves only as the price lookup table and the random-draw pool.

A slot with no suggestions of its own falls back to 4 menu items picked at random (partial Fisher-Yates over a copy of the menu). `widgets.js` calls the resolver **inside** the render function rather than before enqueueing, for two reasons: the random set is supposed to differ on every appearance, and a queued widget may not reach the screen until the schedule has moved into a different slot.

## donations.js

Maintains a `Set` of seen `donationID` values. On each poll, filters the response (newest-first by default) to only new entries, then hands them to `Widgets.queueDonation()` — which drives the centre-screen alert, not the widget queue. Stores the last-known totals for the persistent display zones. Passes `If-None-Match` / `If-Modified-Since` headers on totals polls to take advantage of 304 responses.

## CSS Conventions

- Variables in `:root` for brand colors, font sizes, z-index layers
- Widget panels: `position: absolute`, off-screen by default (`transform: translateX(var(--widget-park))`), animated to `translateX(0)` when `.visible` is added
- **Side placement**: the four values that differ between a left-hand and a right-hand widget slot — edge offset, the two accent-border widths, and the park direction — are custom properties set on `#widget-slot.side-left` / `.side-right`, so `.widget` itself is written once rather than duplicated under a mirrored selector. The border is declared on both sides with one width zeroed, which is what lets a single shorthand cover either orientation. Every `var()` in `.widget` carries the right-hand value as its fallback, so the panels are placed correctly in the window before `widgets.js` applies the class
- Persistent zones (current game, donation total): always visible, no animation
- Extra Life `.webm` assets: `<video autoplay loop muted playsinline>`

## Dependency Rule

**Hard rule**: no build tools, no bundlers, no npm packages. Nothing that requires a compilation or build step.

**Allowed**: libraries loaded via `<script>` tag (CDN or local file) that the user has explicitly approved. jQuery is pre-approved. Any other library must be proposed and approved before use.

Default to vanilla `fetch()`, `setInterval`/`setTimeout`, `document.querySelector`/`classList`, and CSS `@keyframes`/`transition`. Only propose a library when there's a meaningful complexity or compatibility reason to do so.
