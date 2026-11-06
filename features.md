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

When a new donation is detected, a **centre-screen alert video** plays with the donation details sequencing over it. This replaced an earlier side-panel card.

**`CONFIG.donationAlertEnabled` turns the whole thing off.** Set it to `false` and no alert plays; the element is removed at init so the video is not held in memory for the event either. Nothing else changes — donations are still polled, still deduplicated, and the Raised and Team totals still update. Use it when a separate alert box (Streamlabs, StreamElements) is already firing on the same donations. An absent flag counts as enabled, so an older `config.js` behaves as it did.

**It is not part of the widget queue.** The alert owns the centre of the screen and the rotation owns the lower right, so the two never contend for space: a donation fires the moment it is seen rather than waiting for whatever widget is mid-display, and it is free to play over one. It keeps a small queue of its own, because a single poll can return several new donations and they should play one after another rather than overwriting each other.

**The video:** `assets/DonoAlert-10s.webm` — VP9, 1920×1080, 10.043s, **with an alpha channel** and **no audio track**. The absent audio track means muted autoplay can never be refused. The alert box is sized from `--alert-scale` (a fraction of the 1920×1080 artwork, currently `0.24`, giving a 461×259 alert) and centred on the canvas. Sizing the box rather than applying `transform: scale()` keeps the font sizes independent of the artwork scale, while the text layer's percentage offsets still track it.

**Text phases.** The artwork carries a diagonally striped blue band across roughly 39–58% of its height. Text appears over that band one phase at a time, each fading out before the next fades in:

1. Donor display name
2. Donation amount
3. The message — **only if there is one**

With a message that is 3 phases of ~2.8s; without, 2 phases of ~4.2s. The phases divide whatever remains after a lead-in and lead-out, which hold the text clear of the artwork's own animated entrance and exit.

**Optional sound.** `CONFIG.donationAlertSound` takes a path to an audio file — `.mp3`, `.ogg`, `.wav`, `.m4a`, anything Chromium decodes — played at the same moment the video starts, so the two stay in step. `null` means a silent alert and nothing is fetched. `CONFIG.donationAlertVolume` (0–1, default `0.8`) sets the level; the alert video has no audio track, so this is the only sound the overlay makes.

The file is loaded into a single `Audio` element at init, not per donation, so it is buffered well before the first one arrives. Reusing one element is safe because alerts are serialised with a gap between them and so can never overlap. A missing or undecodable file logs once and leaves the alert running silently.

**Autoplay is the one caveat.** The video is muted, so it can never be refused; an unmuted sound can be. OBS starts its browser source with autoplay permitted, so this works there without any ceremony. A normal browser tab blocks it until the page has received a click — if you are testing outside OBS and hear nothing, click the overlay and fire another donation. A blocked sound logs a warning and never prevents the alert itself from playing.

**Font sizes are absolute, not scaled.** `--alert-scale` sizes the box and the artwork; the three font sizes and the text shadow are plain px and have to be scaled by hand to match. They are currently set for `0.24` — 23px donor, 30px amount, 17px message. Moving the scale without moving these will push the text out of the blue band.

**Text is white, with a soft drop shadow.** It sits over the blue band, and the shadow keeps it legible as the band's stripes animate beneath it. The text block sits 3% below the band's own top edge on purpose: these strings are bold and mostly free of descenders — amounts especially — so geometric centring reads as too high, and the offset lines up cap-height centre with the band centre instead.

**The message marquee scrolls only when it overflows.** The text is measured after insertion; a message that fits sits centred, because a marquee that doesn't need to move reads as a glitch. At the current `--alert-scale` the text box is ~323px wide, so a message past roughly 38 characters overflows and scrolls, where on the earlier full-size alert the marquee rarely engaged at all.

**Configuration:**
- `CONFIG.donationAlertEnabled` — `true` (default) or `false`, as above
- `CONFIG.donationAlertSound` — path to an audio file, or `null` for silence
- `CONFIG.donationAlertVolume` — `0`–`1`, default `0.8`
- `CONFIG.timing.donationAlertMs` — how long the alert holds. **Must cover the video**, or it is cut off mid-playback
- `CONFIG.timing.donationAlertLeadInMs` / `donationAlertLeadOutMs` — text held back at each end
- The positioning of the text over the white panel is four percentage values on `#donation-alert-text` in `styles.css`

**Displayed data:**
- Donor display name (or "Anonymous" — the API returns `null` for anonymous donors)
- Donation amount
- Message, if provided. The API returns `null` when there is none, in which case the message phase is dropped entirely and the other two share the time

**Message length:** messages are capped at `MAX_MESSAGE_CHARS` (64) in `js/widgets.js` and ellipsised past that. The cut backs up to the last word boundary when one falls reasonably near the limit, so it does not land mid-word, and any trailing punctuation is dropped before the ellipsis. Truncation runs on the raw text *before* HTML escaping — doing it after could slice an entity such as `&amp;` in half.

**Behavior:**
- Polls `GET /participants/{id}/donations` every `CONFIG.timing.donationPollMs` (default 60s)
- **The first successful poll takes a baseline:** it records the donation IDs that already exist without announcing them. Without this, every page load replays the last 10 donations as if they were new — and OBS reloads a browser source on scene switches and on restart, so it would recur through the event, each time costing minutes of stale alerts. The baseline is tied to the first *successful* response, so a failed first poll does not cause the next one to announce a backlog
- The API returns newest-first; iteration is reversed so that several donations arriving between two polls are announced oldest-first
- Tracks seen donation IDs so each donation fires exactly once
- `Donations.simulate()` is a console-only test helper that pushes a donation through this same path, so the alert can be exercised without waiting on a real one. It is never called by the overlay
- The alert fades in, plays for `donationAlertMs`, then fades out
- If multiple new donations arrive simultaneously, they play sequentially with a short gap between them

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
| More than 15 min | Current game |
| Final 15 min down to 2 min | **Alternates** between current and upcoming every 15s, starting on upcoming |
| Final 2 min | Upcoming game only, until the slot ends |

- Transitions are a **fade** — the outgoing text fades out, the incoming text fades in. No slide animation.
- The alternation is a **pure function of the clock**. There is no per-slot bookkeeping to reset and nothing to arm or expire: given a time, the state is computable directly. This replaced an earlier scheme of discrete preview marks at 20/15/10/5 minutes, which needed fired-once tracking per slot precisely because it was event-driven rather than derived.
- The grid is anchored to the **moment the run-in begins**, not to page load and not to the slot's end. Anchoring to page load would shift the cadence on every OBS source refresh; anchoring to the slot's end leaves a partial period at the 15-minute boundary, which flashes "up next" for a single tick before settling.
- The final-2-minute takeover **outranks** the alternation, so the last switch is into the upcoming game and it stays there.
- A slot shorter than the run-in simply starts alternating from its first second — there is nothing to skip.

**Configuration:**
- `CONFIG.timing.upcomingAlternateFromMin` — minutes left when alternating begins (default `15`)
- `CONFIG.timing.upcomingAlternateEveryMs` — how long each side holds (default `15000`)
- `CONFIG.timing.upcomingTakeoverMin` — final minutes showing upcoming only (default `2`)

### Edge cases

- **No next game** (final slot of the event): the alternation and the takeover are both suppressed — the zone stays on the current game for the entire slot.
- **Undecided slots**: a schedule entry with an empty `game` string is **not a break** — it is a real slot whose game has not been picked yet. The zone keeps the normal "Now Playing" label and "until <end time>" phrasing, and shows "Undecided" where the title would go. The slot is running; only its name is unknown. The run-in alternation works normally, and an undecided slot appearing as the *next* game shows "Up Next / Undecided / at <start time>".
- **Clock outside every slot** (before the event opens or after it closes): this is the only state where nothing is scheduled at all. The zone shows a separate off-schedule label ("Taking a Break") and uses the upcoming game's name and start time if one exists.

`CONFIG.timing.nextGameWidgetMs`, `upcomingPreviewMarksMin` and `upcomingPreviewMs` are all **obsolete** — the upcoming game is not an interval-driven queued widget, and the discrete preview marks are gone in favour of the alternation above.

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
- Cross-references skill names against `CONFIG.dixperMenu` by `name` to get dollar amounts. A name with no matching menu entry is dropped silently — so a typo costs you that row with no warning, and if *every* name is a typo the whole widget is skipped
- **Slot has suggestions:** exactly that set is shown, capped at the first 4
- **Slot has no suggestions:** 4 skills are drawn at random from the full menu, **re-drawn every time the widget animates in** — a different set each appearance. The draw happens at render time, not when the widget is queued, so a widget sitting behind a donation alert still shows a fresh set and a title matching the slot that is actually live when it appears
- **The widget is skipped entirely, not shown blank, whenever there is nothing to put in it.** The rotation becomes schedule → rest → repeat. Three things land here:
  - **`CONFIG.dixperMenu` is empty** — a deliberate "no Dixper this year". This holds *even when games list `suggestedDixperSkills`*, because those are names looked up in the menu: with no menu there is nothing for them to resolve to
  - the clock is outside every slot
  - every name a slot lists fails to resolve against the menu (all misspelled, say) — previously this drew a blank panel
- Undecided slots (`game: ""`) still show skills — a game is being played, it just isn't named yet — but the title falls back to "Try These" with no game name appended. Since an undecided slot also has no suggestions of its own, it always draws the random 4
- Note: Dixper runs its own OBS browser source that handles actual effect execution. This overlay is display-only — a viewer reference card

`CONFIG.timing.dixperMenuWidgetMs` and `CONFIG.timing.dixperSkillsWidgetMs` are both **obsolete** — there is no second menu-wide Dixper widget, and this one is driven by the rotation rather than its own interval.

---

## Widget Rotation and Queue

All widgets share a single display slot — only one is ever visible.

### Which side of the screen

`CONFIG.widgetSide` places the slot on the `'right'` (default) or the `'left'`. Three things move together with it: the panel's edge offset, the yellow accent border, and the direction it slides in from. The border always sits on the canvas edge, so it reads as the panel's outer trim on either side, matching the persistent zones — the game zone carries its border on the left, the totals on the right.

The flip is a single class on the slot; the panel's own rules are written once and read the per-side values as custom properties. An unrecognised value warns to the console and falls back to `'right'`.

### The rotation

The two scheduled widgets run as **one fixed sequence**, not on independent timers:

```
overlay starts
  -> top banner slides in
  -> full schedule widget   (3 pages x fullSchedulePageMs = 30s)
  -> dixper skills widget   (widgetDisplayMs = 20s)
  -> top banner slides out  (together with the Dixper panel)
  -> rest                   (rotationRestMs = 10 min, nothing on screen)
  -> repeat
```

- Each step begins only once the previous one has finished sliding out, so the two can never compete for the slot
- The top banner brackets the whole rotation (feature 1). The engine exposes an `onHiding` hook that fires the instant a panel starts its exit transition — 400ms before `onDone` — so the banner leaves *with* the last widget rather than trailing it
- The rest is measured from the moment the Dixper widget leaves, so the full cycle is roughly 10m 50s rather than exactly 10 minutes. It also shortens over the event as finished games drop out of the schedule widget and it needs fewer pages: 3 pages while 11 or more games remain, then 2, then 1, taking the cycle down to about 10m 30s
- A step with nothing to show calls straight through to the next rather than stalling the rotation: the schedule is skipped once every game has ended, and the Dixper widget is skipped when the clock is outside every slot
- **Why a sequence:** with independent intervals, the higher-priority Dixper widget could re-queue itself while the schedule was still on screen and win the slot again the moment the schedule finished, starving the schedule out entirely. Chaining removes the contention instead of tuning around it

### What is not in the queue

Two things sit outside it, each owning their own screen space:

- The **donation alert** (feature 3) — centre screen, fires on its own the moment a donation is seen, with its own small queue. It can play over a rotation widget; they do not overlap on screen
- The **current / upcoming game zone** (feature 4) — a persistent zone, upper left, swapping its own contents on a schedule-derived cadence

That leaves the queue holding only the two rotation panels, which the rotation feeds strictly one at a time. Priority (`dixperSkills` 1, `fullSchedule` 2) therefore only matters if both are ever queued at once, which the chained rotation avoids by construction. A widget cannot be queued again while one of the same type is already pending.

---

## Configuration-Driven Design

All event-specific data is isolated in `config.js`. To set up a new event year:

1. Update `participantId` and `teamId` with that year's Extra Life IDs
2. Replace `schedule[]` with the new game lineup and time slots
3. Update `dixperMenu[]` with the current Dixper effect prices
4. Add `suggestedDixperSkills` per game entry
5. Set `widgetSide` to whichever side of the stream layout is free that year, and `donationAlertEnabled` according to whether another alert box is running
6. Replace assets in `/assets/` with that year's official Extra Life files

No code changes required — only `config.js` and `/assets/`.
