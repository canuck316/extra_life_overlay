# Feature Specifications

## 1. Extra Life Branding Assets

Extra Life organizers provide official static assets each year — logo images and animated `.webm` video files (e.g. the "Extra Life" badge animation). These must be present in the overlay to clearly identify the stream as an official Extra Life event.

**Behavior:**
- Logo/badge image displays persistently in a fixed corner of the overlay
- Animated `.webm` video loops continuously with no controls visible
- Assets are placed in `/assets/` and referenced directly in `overlay.html`
- No logic required — purely static display

**Placement:** Top-right corner (or wherever the layout designates as the "brand zone"). This zone is never obscured by other widgets.

---

## 2. Donation Totals Display

Shows the fundraising progress for both the individual participant and the team. Always visible — not a widget, a persistent overlay zone.

**Displayed data:**
- Participant's total amount raised
- Participant's fundraising goal and progress percentage
- Team's total amount raised

**Behavior:**
- Polls Extra Life API every `CONFIG.timing.totalsPollMs` (default 2 min)
- Updates in-place with a brief CSS flash/fade to signal a change
- Formats currency as `$X,XXX.XX`

---

## 3. Recent Donation Notification

When a new donation is detected, it interrupts the widget queue at high priority and displays a notification card.

**Displayed data:**
- Donor display name (or "Anonymous")
- Donation amount
- Message (if provided)

**Behavior:**
- Polls `GET /participants/{id}/donations` every `CONFIG.timing.donationPollMs` (default 60s)
- Tracks seen donation IDs so each donation fires exactly once
- Notification slides in, holds for `widgetDisplayMs`, then slides out
- If multiple new donations arrive simultaneously, they queue and display sequentially
- Donation notification takes priority over all timed widgets

---

## 4. Current Game Display

Always-visible zone showing what game is being played right now.

**Displayed data:**
- Game name
- Scheduled end time ("until 10:00 PM")

**Behavior:**
- Derived from system clock vs. `CONFIG.schedule` start/end times
- If current time falls between a game's `startTime` and `endTime`, that game is "current"
- If no game matches (gap between slots), shows a fallback label (e.g. "Taking a Break")
- Updates automatically — checked whenever the schedule module is queried
- No API call required; purely local logic

---

## 5. Next Game Widget

An intermittent widget that slides in to remind viewers what game is coming up next.

**Displayed data:**
- Next game name
- Scheduled start time

**Behavior:**
- Fires every `CONFIG.timing.nextGameWidgetMs` (default 10 min)
- Enters the widget queue (does not interrupt donation notifications)
- Visible for `CONFIG.timing.widgetDisplayMs` (default 20s)
- If no next game exists (last game of the event), widget is suppressed

---

## 6. Full Schedule Widget

A less frequent widget that displays all remaining games for the event so viewers can plan their viewing.

**Displayed data:**
- List of all games not yet completed (start time in the past is excluded)
- Game name and time slot for each

**Behavior:**
- Fires every `CONFIG.timing.fullScheduleWidgetMs` (default 30 min)
- Enters the widget queue
- Visible for `CONFIG.timing.widgetDisplayMs`
- Games that have already passed are filtered out dynamically
- If all games are done (end of event), widget is suppressed

---

## 7. Dixper Menu Widget

Shows viewers the full Dixper effects menu so they know what they can purchase to interact with the stream.

**Displayed data:**
- Complete list from `CONFIG.dixperMenu`
- For each entry: skill name, dollar amount, short description

**Behavior:**
- Fires every `CONFIG.timing.dixperMenuWidgetMs` (default 15 min)
- Enters the widget queue
- Visible for `CONFIG.timing.widgetDisplayMs`
- Data is static — read directly from `CONFIG.dixperMenu` at display time
- Note: Dixper runs its own OBS browser source that handles actual effect execution. This overlay is display-only — a viewer reference card.

---

## 8. Dixper Skill Suggestions Widget

More frequent widget highlighting which Dixper skills are especially good for the currently active game. Designed to prompt viewers to donate for effects that are particularly funny or challenging for the current game context.

**Displayed data:**
- Current game name
- 2-4 highlighted Dixper skills relevant to that game
- Each skill shows: name, dollar amount

**Behavior:**
- Fires every `CONFIG.timing.dixperSkillsWidgetMs` (default 7 min)
- Enters the widget queue
- Visible for `CONFIG.timing.widgetDisplayMs`
- Reads `suggestedDixperSkills` from the current schedule entry in `CONFIG.schedule`
- Cross-references skill names against `CONFIG.dixperMenu` to get dollar amounts
- If no current game is scheduled (gap), widget is suppressed
- If the current game has no suggested skills defined, widget is suppressed

---

## Widget Priority and Queue

All widgets share a single display slot. The queue follows these rules:

| Priority | Event |
|---|---|
| 1 (highest) | New donation notification |
| 2 | Next game widget |
| 3 | Dixper skill suggestions |
| 4 | Dixper menu widget |
| 5 (lowest) | Full schedule widget |

- Only one widget is visible at a time
- A widget cannot be queued again if an identical widget type is already in the queue
- Timed intervals continue ticking regardless of queue state — if the queue is backed up, the next interval tick for a widget type that's already queued is ignored (no duplicates)

---

## Configuration-Driven Design

All event-specific data is isolated in `config.js`. To set up a new event year:

1. Update `participantId` and `teamId` with that year's Extra Life IDs
2. Replace `schedule[]` with the new game lineup and time slots
3. Update `dixperMenu[]` with the current Dixper effect prices
4. Add `suggestedDixperSkills` per game entry
5. Replace assets in `/assets/` with that year's official Extra Life files

No code changes required — only `config.js` and `/assets/`.
