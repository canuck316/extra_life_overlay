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

## 4. Current / Upcoming Game Display

A **single** always-visible zone that shows both the current game and the upcoming game, swapping between them on a cadence derived from the schedule. This is one zone sharing one piece of screen real estate — not two separate displays. The current game is the default state; the upcoming game borrows the same space when it's worth drawing attention to.

This zone is **not part of the widget queue**. It never slides off-screen — only its contents change.

**Current-game state (default):**
- Game name
- Scheduled end time ("until 10:00 PM")

**Upcoming-game state:**
- Next game name
- Scheduled start time ("up next at 10:00 PM")

### Swap behavior

Driven entirely by the time remaining in the current slot (`endTime` minus now):

| Time left in slot | Displayed |
|---|---|
| More than 20 min | Current game |
| At 20, 15, 10, and 5 min | Upcoming game for 30s, then fades back to current game |
| Final 2 min | Upcoming game only, until the slot ends |

- Transitions are a **fade** — the outgoing text fades out, the incoming text fades in. No slide animation.
- Each preview mark fires **exactly once per slot**. The zone tracks which marks have already fired and resets that state on slot change; without this, a per-second clock tick re-triggers the same mark repeatedly for a full minute.
- The final-2-minute takeover **outranks** a preview. If the 5-minute preview is still on screen when the 2-minute mark arrives, the zone stays on the upcoming game rather than fading back.
- Marks that exceed the slot's own length are skipped. A 2-hour slot uses all four marks; a 10-minute slot only ever reaches the 5-minute mark.

### Edge cases

- **No next game** (final slot of the event): previews and the takeover are both suppressed — the zone stays on the current game for the entire slot.
- **Break slots**: a schedule entry with an empty `game` string is a break. The current-game state shows the fallback label (e.g. "Taking a Break") instead of a name, and the upcoming-game previews continue to run normally — a break is exactly when viewers most want to know what's next.
- **Clock outside every slot** (before the event opens or after it closes): the zone shows the fallback label, and uses the upcoming game's name and start time if one exists.

**Configuration:**
- `CONFIG.timing.upcomingPreviewMarksMin` — minutes-remaining marks that trigger a preview (default `[20, 15, 10, 5]`)
- `CONFIG.timing.upcomingPreviewMs` — how long each preview holds (default `30000`)
- `CONFIG.timing.upcomingTakeoverMin` — minutes of final upcoming-only display (default `2`)

`CONFIG.timing.nextGameWidgetMs` is **obsolete** — the upcoming game is no longer an interval-driven queued widget.

---

## 5. Full Schedule Widget

A less frequent widget that displays all remaining games for the event so viewers can plan their viewing. The list is paged so it never fills the screen vertically.

**Displayed data:**
- List of all games not yet completed (start time in the past is excluded)
- Game name and time slot for each

**Behavior:**
- Shown once immediately on load, then every `CONFIG.timing.fullScheduleWidgetMs` (default 30 min) thereafter
- Enters the widget queue
- Remaining games are split into pages of `CONFIG.fullScheduleRowsPerPage` rows (default 5), up to a maximum of **3 pages**
- Each page is visible for `CONFIG.timing.fullSchedulePageMs` (default 10s, half the standard widget hold), so the widget runs for up to 3x that before sliding out
- The title is rendered once and is not re-rendered between pages, so it never shifts
- Short pages are padded with hidden rows to hold the panel height constant — the widget is bottom-anchored, so a height change would move the title
- Games beyond the third page are not shown
- Games that have already passed are filtered out dynamically
- If all games are done (end of event), widget is suppressed

---

## 6. Dixper Menu Widget

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

## 7. Dixper Skill Suggestions Widget

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
| 2 | Dixper skill suggestions |
| 3 | Dixper menu widget |
| 4 (lowest) | Full schedule widget |

- Only one widget is visible at a time
- A widget cannot be queued again if an identical widget type is already in the queue
- Timed intervals continue ticking regardless of queue state — if the queue is backed up, the next interval tick for a widget type that's already queued is ignored (no duplicates)
- The current / upcoming game zone (feature 4) is **not** in this queue — it is a persistent zone that swaps its own contents on a schedule-derived cadence, independently of everything above

---

## Configuration-Driven Design

All event-specific data is isolated in `config.js`. To set up a new event year:

1. Update `participantId` and `teamId` with that year's Extra Life IDs
2. Replace `schedule[]` with the new game lineup and time slots
3. Update `dixperMenu[]` with the current Dixper effect prices
4. Add `suggestedDixperSkills` per game entry
5. Replace assets in `/assets/` with that year's official Extra Life files

No code changes required — only `config.js` and `/assets/`.
