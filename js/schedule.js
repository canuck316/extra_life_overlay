// Schedule logic — derives current and next game from the system clock, and
// owns the persistent current / upcoming game zone (features.md #4).

var Schedule = (function () {
  var FALLBACK_LABEL = 'Taking a Break';
  var TICK_MS = 1000;
  var FADE_MS = 300;   // must match the CSS transition on #game-zone-inner

  var innerEl       = null;
  var firedMarks    = {};     // preview marks already used in the active slot
  var activeSlotKey = null;
  var previewUntil  = 0;      // epoch ms — a preview holds the zone until then
  var lastHtml      = null;

  // --- lookups ---------------------------------------------------------------

  function getCurrentGame() {
    var now = new Date();
    return CONFIG.schedule.find(function (entry) {
      return now >= new Date(entry.startTime) && now < new Date(entry.endTime);
    }) || null;
  }

  function getNextGame() {
    var now = new Date();
    var upcoming = CONFIG.schedule
      .filter(function (entry) { return new Date(entry.startTime) > now; })
      .sort(function (a, b) { return new Date(a.startTime) - new Date(b.startTime); });
    return upcoming[0] || null;
  }

  function getRemainingGames() {
    var now = new Date();
    return CONFIG.schedule
      .filter(function (entry) { return new Date(entry.endTime) > now; })
      .sort(function (a, b) { return new Date(a.startTime) - new Date(b.startTime); });
  }

  // --- zone state ------------------------------------------------------------

  // Which state the zone belongs in right now: 'current' or 'upcoming'.
  // Side effect: arms a preview when a mark is crossed.
  function desiredState(now, current, next) {
    if (!current || !next) return 'current';

    var minsLeft = (new Date(current.endTime) - now) / 60000;
    var takeover = CONFIG.timing.upcomingTakeoverMin;

    // Final stretch wins outright, including over a preview still in flight.
    if (minsLeft <= takeover) return 'upcoming';

    // Arm a preview as its mark is crossed. The `> mark - 1` bound stops a
    // mark firing retroactively when the page loads mid-slot; the firedMarks
    // guard stops it repeating on every tick for the whole minute after.
    var marks = CONFIG.timing.upcomingPreviewMarksMin || [];
    for (var i = 0; i < marks.length; i++) {
      var mark = marks[i];
      if (mark <= takeover) continue;          // the takeover would swallow it
      if (firedMarks[mark]) continue;
      if (minsLeft <= mark && minsLeft > mark - 1) {
        firedMarks[mark] = true;
        previewUntil = now.getTime() + CONFIG.timing.upcomingPreviewMs;
        break;
      }
    }

    return now.getTime() < previewUntil ? 'upcoming' : 'current';
  }

  function viewFor(state, current, next) {
    if (state === 'upcoming' && next) {
      return {
        label: 'Up Next',
        name:  next.game || FALLBACK_LABEL,
        time:  'at ' + formatTime(next.startTime)
      };
    }

    if (current) {
      // An entry with an empty game name is a scheduled break.
      if (current.game) {
        return {
          label: 'Now Playing',
          name:  current.game,
          time:  'until ' + formatTime(current.endTime)
        };
      }
      return {
        label: '',
        name:  FALLBACK_LABEL,
        time:  'back at ' + formatTime(current.endTime)
      };
    }

    // Clock sits outside every slot — before the event opens or after it ends.
    if (next) {
      return {
        label: '',
        name:  FALLBACK_LABEL,
        time:  'Up next at ' + formatTime(next.startTime)
      };
    }
    return { label: '', name: FALLBACK_LABEL, time: '' };
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
    var now     = new Date();
    var current = getCurrentGame();
    var next    = getNextGame();

    // Reset per-slot preview bookkeeping whenever the active slot changes.
    var key = current ? current.startTime : 'none';
    if (key !== activeSlotKey) {
      activeSlotKey = key;
      firedMarks    = {};
      previewUntil  = 0;
    }

    paint(viewFor(desiredState(now, current, next), current, next));
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
    innerEl = document.getElementById('game-zone-inner');
    if (!innerEl) return;
    tick();
    setInterval(tick, TICK_MS);
  }

  return {
    init: init,
    getCurrentGame: getCurrentGame,
    getNextGame: getNextGame,
    getRemainingGames: getRemainingGames
  };
})();
