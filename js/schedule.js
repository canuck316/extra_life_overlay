// Schedule logic — derives current and next game from the system clock, and
// owns the persistent current / upcoming game zone (features.md #4).

var Schedule = (function () {
  // A slot with an empty `game` is scheduled but not yet chosen — NOT a break.
  // Something is being played in that hour; the lineup just isn't settled.
  var UNDECIDED_LABEL = 'Undecided';

  // Used only when the clock sits outside every slot, which is the one case
  // where nothing is scheduled at all.
  var OFF_SCHEDULE_LABEL = 'Taking a Break';

  var TICK_MS = 1000;
  var FADE_MS = 300;   // must match the CSS transition on #game-zone-inner

  var innerEl       = null;
  var lastHtml      = null;
  var clockOffsetMs = 0;      // CONFIG.debugClockStart shifts the clock by this

  // --- clock -----------------------------------------------------------------

  // The single source of "now" for everything schedule-derived. Offsetting here
  // rather than rewriting the schedule dates means the simulated clock still
  // ticks forward in real time, so previews and slot changes fire normally.
  function now() {
    return new Date(Date.now() + clockOffsetMs);
  }

  // --- lookups ---------------------------------------------------------------

  function getCurrentGame() {
    var t = now();
    return CONFIG.schedule.find(function (entry) {
      return t >= new Date(entry.startTime) && t < new Date(entry.endTime);
    }) || null;
  }

  function getNextGame() {
    var t = now();
    var upcoming = CONFIG.schedule
      .filter(function (entry) { return new Date(entry.startTime) > t; })
      .sort(function (a, b) { return new Date(a.startTime) - new Date(b.startTime); });
    return upcoming[0] || null;
  }

  function getRemainingGames() {
    var t = now();
    return CONFIG.schedule
      .filter(function (entry) { return new Date(entry.endTime) > t; })
      .sort(function (a, b) { return new Date(a.startTime) - new Date(b.startTime); });
  }

  // --- zone state ------------------------------------------------------------

  // Which state the zone belongs in right now: 'current' or 'upcoming'.
  // Side effect: arms a preview when a mark is crossed.
  function desiredState(t, current, next) {
    if (!current || !next) return 'current';

    var msLeft   = new Date(current.endTime) - t;
    var minsLeft = msLeft / 60000;

    // Final stretch wins outright — upcoming only, no more alternating.
    if (minsLeft <= CONFIG.timing.upcomingTakeoverMin) return 'upcoming';

    // Outside the run-in, the zone just shows what is playing.
    if (minsLeft > CONFIG.timing.upcomingAlternateFromMin) return 'current';

    // Inside the run-in, alternate on a grid anchored to the moment the run-in
    // began — not to when the page loaded, so the cadence survives a reload or
    // an OBS source refresh, and not to the slot's end, which would leave a
    // sub-second sliver of a period at the boundary and flash 'upcoming' for
    // one tick before settling. Measuring forwards from the boundary makes the
    // first period a full one, so the zone switches to 'upcoming' cleanly on
    // the 15-minute mark and holds it.
    var intoRunIn = (CONFIG.timing.upcomingAlternateFromMin * 60000) - msLeft;
    var periods   = Math.floor(intoRunIn / CONFIG.timing.upcomingAlternateEveryMs);
    return periods % 2 === 0 ? 'upcoming' : 'current';
  }

  function viewFor(state, current, next) {
    if (state === 'upcoming' && next) {
      return {
        label: 'Up Next',
        name:  next.game || UNDECIDED_LABEL,
        time:  'at ' + formatTime(next.startTime)
      };
    }

    if (current) {
      // An empty game name means the slot is still undecided. It keeps the
      // "Now Playing" label and the "until" phrasing, because the slot is
      // running either way — only the title is unknown.
      return {
        label: 'Now Playing',
        name:  current.game || UNDECIDED_LABEL,
        time:  'until ' + formatTime(current.endTime)
      };
    }

    // Clock sits outside every slot — before the event opens or after it ends.
    if (next) {
      return {
        label: '',
        name:  OFF_SCHEDULE_LABEL,
        time:  'Up next at ' + formatTime(next.startTime)
      };
    }
    return { label: '', name: OFF_SCHEDULE_LABEL, time: '' };
  }

  function paint(view) {
    var html =
      (view.label ? '<div class="game-label">' + esc(view.label) + '</div>' : '') +
      '<div class="game-name">' + esc(view.name) + '</div>' +
      (view.time ? '<div class="game-time">' + esc(view.time) + '</div>' : '');

    if (html === lastHtml) return;   // nothing changed — leave the fade alone

    // First paint lands immediately; every later change cross-fades.
    if (lastHtml === null) {
      innerEl.innerHTML = html;
      lastHtml = html;
      return;
    }

    lastHtml = html;
    innerEl.classList.add('fading');
    setTimeout(function () {
      innerEl.innerHTML = html;
      innerEl.classList.remove('fading');
    }, FADE_MS);
  }

  function tick() {
    var t       = now();
    var current = getCurrentGame();
    var next    = getNextGame();

    paint(viewFor(desiredState(t, current, next), current, next));
  }

  // --- helpers ---------------------------------------------------------------

  function formatTime(isoString) {
    return new Date(isoString).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function init() {
    // Set the offset first: main.js inits Schedule before Widgets, so the
    // widgets' first read of the schedule already sees the simulated clock.
    if (CONFIG.debugClockStart) {
      var target = new Date(CONFIG.debugClockStart);
      if (isNaN(target)) {
        console.error('[overlay] CONFIG.debugClockStart is not a valid date: ' +
          CONFIG.debugClockStart + ' — using the real clock');
      } else {
        clockOffsetMs = target.getTime() - Date.now();
        console.warn('[overlay] DEBUG CLOCK ACTIVE — simulating ' +
          target.toLocaleString() + '. Set CONFIG.debugClockStart to null ' +
          'before the event.');
      }
    }

    innerEl = document.getElementById('game-zone-inner');
    if (!innerEl) return;
    tick();
    setInterval(tick, TICK_MS);
  }

  return {
    init: init,
    getCurrentGame: getCurrentGame,
    getNextGame: getNextGame,
    getRemainingGames: getRemainingGames,
    now: now,                          // exposed so the console can check the clock
    UNDECIDED_LABEL: UNDECIDED_LABEL   // so the schedule widget matches the zone
  };
})();
