# Feature Specifications

## 1. Extra Life Branding Banner

Extra Life organizers provide official art each year. The overlay shows one banner — `assets/ExtraLife-TopLine.png` — to identify the stream as an official Extra Life event.

**Behavior:**
- A full-canvas PNG parked off the top of the screen (`translateY(-110%)`), sliding down to `translateY(0)` when shown
- **Tied to the widget rotation, not to a timer of its own.** It slides in as the rotation's first widget arrives and starts sliding out the instant the last one does, so the branding is on screen exactly while a widget is — and the overlay is otherwise clean
- `banner.js` holds no scheduling logic at all: just `show()` and `hide()`, both idempotent, called by `runRotation()` in `widgets.js`
- The art occupies roughly y 0-110. The persistent zones start at y 136, so the banner never covers live data
- `pointer-events: none` so it can never intercept clicks in OBS

**Placement:** Full canvas width along the top edge.

**A bottom banner was removed.** `assets/ExtraLife-BottomTxtFields.png` previously slid up from the bottom on its own timer, carrying four text fields: latest follower, latest subscriber, latest donor, and top donor. Those four fields were the only consumers of the Twitch integration, so removing it leaves `twitch.js` and `CONFIG.twitch` with nothing to render into. See the note under feature 2.

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

**Currently unrendered data.** With the bottom banner removed (feature 1), nothing displays latest follower, latest subscriber, latest donor, or top donor. The code that fetches them is still present and inert — `Twitch.fetchAll()` / `getLatestFollower()` / `getLatestSubscriber()`, and `Donations.fetchTopDonor()` / `getLatestDonor()` / `getTopDonor()` — but nothing calls the Twitch functions any more, so no Twitch request is made and `CONFIG.twitch` no longer needs credentials. Either delete `twitch.js` and its `<script>` tag, or give these values a new home in the overlay.

---

## 3. Recent Donation Notification

When a new donation is detected, it interrupts the widget queue at high priority and displays a notification card.

**Displayed data:**
- Donor display name (or "Anonymous" — the API returns `null` for anonymous donors)
- Donation amount
- Message, if provided. The API returns `null` when there is none, in which case no message element is rendered at all

**Message length:** messages are capped at `MAX_MESSAGE_CHARS` (64) in `js/widgets.js` and ellipsised past that. The cut backs up to the last word boundary when one falls reasonably near the limit, so it does not land mid-word, and any trailing punctuation is dropped before the ellipsis. Truncation runs on the raw text *before* HTML escaping — doing it after could slice an entity such as `&amp;` in half.

**Behavior:**
- Polls `GET /participants/{id}/donations` every `CONFIG.timing.donationPollMs` (default 60s)
- **The first successful poll takes a baseline:** it records the donation IDs that already exist without announcing them. Without this, every page load replays the last 10 donations as if they were new — and OBS reloads a browser source on scene switches and on restart, so it would recur through the event, each time costing minutes of stale alerts. The baseline is tied to the first *successful* response, so a failed first poll does not cause the next one to announce a backlog
- The API returns newest-first; iteration is reversed so that several donations arriving between two polls are announced oldest-first
- Tracks seen donation IDs so each donation fires exactly once
- `Donations.simulate()` is a console-only test helper that pushes a donation through this same path, so the alert can be exercised without waiting on a real one. It is never called by the overlay
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
- **Undecided slots**: a schedule entry with an empty `game` string is **not a break** — it is a real slot whose game has not been picked yet. The zone keeps the normal "Now Playing" label and "until <end time>" phrasing, and shows "Undecided" where the title would go. The slot is running; only its name is unknown. Upcoming-game previews run normally, and an undecided slot appearing as the *next* game shows "Up Next / Undecided / at <start time>".
- **Clock outside every slot** (before the event opens or after it closes): this is the only state where nothing is scheduled at all. The zone shows a separate off-schedule label ("Taking a Break") and uses the upcoming game's name and start time if one exists.

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
- Game name and time slot for each. A slot with an empty `game` shows "Undecided" — the same label the game zone uses, shared from `Schedule.UNDECIDED_LABEL` so the two can't drift apart

**Behavior:**
- First step of the widget rotation (see **Widget Rotation and Queue** below) — so it is the first thing shown when the overlay starts
- Enters the widget queue
- Remaining games are split into pages of `CONFIG.fullScheduleRowsPerPage` rows (default 5), up to a maximum of **3 pages**
- Each page is visible for `CONFIG.timing.fullSchedulePageMs` (default 10s, half the standard widget hold), so the widget runs for up to 3x that before sliding out
- The title is rendered once and is not re-rendered between pages, so it never shifts
- Short pages are padded with hidden rows to hold the panel height constant — the widget is bottom-anchored, so a height change would move the title
- Games beyond the third page are not shown
- Games that have already passed are filtered out dynamically
- If all games are done (end of event), widget is suppressed

---

## 6. Dixper Skills Widget

Shows viewers a short, purchasable set of Dixper effects for whatever is on screen right now — prompting them to donate for effects that are especially funny or punishing in the current game.

This is the **only** Dixper widget. There is no separate "full menu" display: the complete 19-entry menu does not fit the panel and is too much to read on stream, so viewers always see a focused handful instead. Over the course of the event the random fallback surfaces the breadth of the menu anyway.

**Displayed data:**
- Current game name in the title
- **At most 4 skills — never more.** This is a hard cap
- Each skill shows: name and dollar amount. Menu entries are **name/value pairs only** — there is no description field
- A call to action below the list, separated by a divider matching the row dividers: *"Donate with the widget below to trigger the effects!"* It sits inside the same panel rather than following as its own step, so viewers read the skills and the instruction together. The string is the `DIXPER_CTA` constant in `js/widgets.js`

**Behavior:**
- Second step of the widget rotation (see **Widget Rotation and Queue** below) — always shown directly after the schedule
- Enters the widget queue, visible for `CONFIG.timing.widgetDisplayMs` (default 20s)
- Reads `suggestedDixperSkills` from the current schedule entry in `CONFIG.schedule`
- Cross-references skill names against `CONFIG.dixperMenu` by `name` to get dollar amounts. A name with no matching menu entry is dropped silently
- **Slot has suggestions:** exactly that set is shown, capped at the first 4
- **Slot has no suggestions:** 4 skills are drawn at random from the full menu, **re-drawn every time the widget animates in** — a different set each appearance. The draw happens at render time, not when the widget is queued, so a widget sitting behind a donation alert still shows a fresh set and a title matching the slot that is actually live when it appears
- If no current game is scheduled at all (clock outside every slot), the widget is suppressed
- Undecided slots (`game: ""`) still show skills — a game is being played, it just isn't named yet — but the title falls back to "Try These" with no game name appended. Since an undecided slot also has no suggestions of its own, it always draws the random 4
- Note: Dixper runs its own OBS browser source that handles actual effect execution. This overlay is display-only — a viewer reference card

`CONFIG.timing.dixperMenuWidgetMs` and `CONFIG.timing.dixperSkillsWidgetMs` are both **obsolete** — there is no second menu-wide Dixper widget, and this one is driven by the rotation rather than its own interval.

---

## Widget Rotation and Queue

All widgets share a single display slot — only one is ever visible.

### The rotation

The two scheduled widgets run as **one fixed sequence**, not on independent timers:

```
overlay starts
  -> top banner slides in
  -> full schedule widget   (3 pages x fullSchedulePageMs = 30s)
  -> dixper skills widget   (widgetDisplayMs = 20s)
  -> top banner slides out  (together with the Dixper panel)
  -> rest                   (rotationRestMs = 5 min, nothing on screen)
  -> repeat
```

- Each step begins only once the previous one has finished sliding out, so the two can never compete for the slot
- The top banner brackets the whole rotation (feature 1). The engine exposes an `onHiding` hook that fires the instant a panel starts its exit transition — 400ms before `onDone` — so the banner leaves *with* the last widget rather than trailing it
- The rest is measured from the moment the Dixper widget leaves, making the full cycle roughly 5m 50s rather than exactly 5 minutes
- A step with nothing to show calls straight through to the next rather than stalling the rotation: the schedule is skipped once every game has ended, and the Dixper widget is skipped when the clock is outside every slot
- **Why a sequence:** with independent intervals, the higher-priority Dixper widget could re-queue itself while the schedule was still on screen and win the slot again the moment the schedule finished, starving the schedule out entirely. Chaining removes the contention instead of tuning around it

### Priority

Priority now only decides what a **donation** interrupts, since the rotation never queues two of its own widgets at once:

| Priority | Event |
|---|---|
| 1 (highest) | New donation notification |
| 2 | Dixper skills widget |
| 3 (lowest) | Full schedule widget |

- A donation queued while a rotation widget is on screen displays as soon as that widget finishes — it jumps ahead of the rotation's next step but does not cut off what is already visible
- A widget cannot be queued again if an identical widget type is already in the queue; donations are exempt, so several can queue and display in sequence
- The rotation's rest timer starts when the Dixper widget leaves, so a donation displaying during the rest does not delay the next cycle
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
