// Widget rotation engine
//
// Two things are deliberately NOT in this queue:
//   - the current / upcoming game zone, a persistent zone owned by
//     schedule.js (features.md #4)
//   - the donation alert, which owns the centre of the screen and fires on
//     its own as soon as a donation is seen (features.md #3)
//
// What remains is a fixed rotation of the two lower-right panels, so the
// priority below only orders them if both are ever queued at once.

var Widgets = (function () {
  var PRIORITY = { dixperSkills: 1, fullSchedule: 2 };

  var MAX_SCHEDULE_PAGES = 3;   // features.md #5 — bounds how long the widget holds

  // Call to action under the Dixper skill list (features.md #6).
  var DIXPER_CTA = 'Donate with the widget below to trigger the effects!';

  var MAX_MESSAGE_CHARS = 64;   // donor messages past this are ellipsised

  var queue = [];
  var isShowing = false;
  var queuedTypes = new Set();

  // `render` is either a single function or an array of page render functions.
  // Each page is held for `holdMs`, defaulting to the standard widgetDisplayMs.
  //
  // `opts.done`   fires once this widget has finished sliding out. The rotation
  //               chains on it, so it must fire on every path — including the
  //               paths that decline to show anything.
  // `opts.hiding` fires the instant the panel starts sliding out, 400ms before
  //               `done`. The banner uses this so it leaves with the panel
  //               instead of trailing it.
  function enqueue(type, render, holdMs, opts) {
    opts = opts || {};
    if (queuedTypes.has(type)) {
      safely(type + ' onDone', opts.done);   // already pending — don't stall the chain
      return;
    }
    queuedTypes.add(type);
    queue.push({
      type: type,
      priority: PRIORITY[type],
      hold: holdMs || CONFIG.timing.widgetDisplayMs,
      pages: Array.isArray(render) ? render : [render],
      done: opts.done || null,
      hiding: opts.hiding || null
    });
    queue.sort(function (a, b) { return a.priority - b.priority; });
    if (!isShowing) processQueue();
  }

  // The rotation is a chain, so an exception anywhere in it would stop every
  // widget for the rest of the event rather than costing one appearance. Each
  // link runs inside this, which logs and carries on.
  function safely(label, fn) {
    if (!fn) return;
    try {
      fn();
    } catch (err) {
      console.error('[overlay] widget ' + label + ' failed:', err);
    }
  }

  function processQueue() {
    if (!queue.length) { isShowing = false; return; }
    isShowing = true;
    var item = queue.shift();
    queuedTypes.delete(item.type);

    var el = getWidgetEl(item.type);
    if (!el || !item.pages.length) {
      // Nothing will be shown, so release anything waiting on this panel —
      // otherwise a missing element leaves the banner stranded on screen.
      safely(item.type + ' onHiding', item.hiding);
      safely(item.type + ' onDone', item.done);
      processQueue();
      return;
    }

    var index = 0;
    safely(item.type + ' page 1', function () { item.pages[0](el); });
    el.classList.add('visible');

    function advance() {
      index++;
      if (index < item.pages.length) {
        var page = index;
        safely(item.type + ' page ' + (page + 1), function () { item.pages[page](el); });
        setTimeout(advance, item.hold);
        return;
      }
      safely(item.type + ' onHiding', item.hiding);
      el.classList.remove('visible');
      setTimeout(function () {   // wait for the CSS transition out
        safely(item.type + ' onDone', item.done);
        processQueue();
      }, 400);
    }

    setTimeout(advance, item.hold);
  }

  function getWidgetEl(type) {
    var map = {
      fullSchedule: 'widget-full-schedule',
      dixperSkills: 'widget-dixper-skills'
    };
    return document.getElementById(map[type]) || null;
  }

  // Shortens a donor message to MAX_MESSAGE_CHARS. Backs up to the last word
  // boundary when there is one reasonably near the limit, so the cut does not
  // land mid-word, then drops any trailing punctuation before the ellipsis.
  // Runs on the raw text — truncating after escaping could slice an HTML
  // entity like &amp; in half.
  function truncateMessage(text) {
    if (!text) return '';

    var msg = String(text).trim().replace(/\s+/g, ' ');
    if (msg.length <= MAX_MESSAGE_CHARS) return msg;

    var cut = msg.slice(0, MAX_MESSAGE_CHARS);
    var lastSpace = cut.lastIndexOf(' ');

    // Only honour the word boundary if it is not so early that it would throw
    // most of the allowance away — e.g. one very long unbroken word up front.
    if (lastSpace > MAX_MESSAGE_CHARS * 0.6) cut = cut.slice(0, lastSpace);

    return cut.replace(/[\s,.;:!?-]+$/, '') + '…';
  }

  // --- Donation alert -------------------------------------------------------
  // Deliberately OUTSIDE the widget queue. The alert owns the centre of the
  // screen while the rotation owns the lower right, so the two never contend
  // for space — a donation fires the moment it is seen instead of waiting for
  // whatever widget is mid-display, and it can play over one quite happily.
  //
  // It keeps its own small queue all the same: a single poll can return
  // several new donations, and those should play one after another rather than
  // overwriting each other.
  //
  // Text sequences over the artwork's blue band: donor name, then amount, then
  // the message if there is one, each fading out before the next fades in.

  var ALERT_FADE_MS = 350;   // must match the transition on #donation-alert-text
  var ALERT_GAP_MS  = 600;   // breath between back-to-back alerts
  var alertQueue    = [];
  var alertShowing  = false;
  var alertRun      = 0;     // bumped per alert, so stale timers can bail out

  var alertSound    = null;  // one reused Audio element, or null when unconfigured

  // Absent means on, so a config written before this flag existed keeps the
  // behaviour it had.
  function alertsEnabled() {
    return CONFIG.donationAlertEnabled !== false;
  }

  function alertVolume() {
    var n = typeof CONFIG.donationAlertVolume === 'number'
          ? CONFIG.donationAlertVolume
          : parseFloat(CONFIG.donationAlertVolume);
    if (isNaN(n)) return 1;
    return Math.max(0, Math.min(1, n));
  }

  // One Audio element for the whole event, built at init so the file is
  // buffered long before the first donation lands. Reusing it is safe because
  // alerts are serialised with ALERT_GAP_MS between them, so a sound is never
  // asked to overlap itself.
  function initAlertSound() {
    if (!alertsEnabled()) return;

    var src = CONFIG.donationAlertSound;
    if (!src) return;   // null or '' — a silent alert, and nothing is fetched

    alertSound = new Audio(src);
    alertSound.preload = 'auto';
    alertSound.volume = alertVolume();

    // Decoding happens off the main path, so a bad path or an unsupported
    // codec surfaces here rather than at play() time. Drop the element so the
    // alert runs silently instead of warning on every single donation.
    alertSound.addEventListener('error', function () {
      console.warn('[overlay] donation alert sound could not be loaded: ' + src +
                   ' — alerts will play silently');
      alertSound = null;
    });
  }

  function playAlertSound() {
    if (!alertSound) return;

    try { alertSound.currentTime = 0; } catch (err) { /* not seekable yet */ }

    var playing = alertSound.play();
    if (playing && playing.catch) {
      playing.catch(function (err) {
        // Unlike the muted video, this can legitimately be refused: Chromium
        // blocks unmuted autoplay without a user gesture. OBS permits it; a
        // plain browser tab does not until the page has been clicked. Either
        // way the alert itself carries on.
        console.warn('[overlay] donation alert sound was blocked: ' +
                     (err && err.name ? err.name : err));
      });
    }
  }

  function queueDonation(donation) {
    if (!alertsEnabled()) return;   // polling and the totals zones carry on regardless
    alertQueue.push(donation);
    if (!alertShowing) playNextAlert();
  }

  function playNextAlert() {
    if (!alertQueue.length) { alertShowing = false; return; }

    var el = document.getElementById('donation-alert');
    if (!el) {                       // no alert element — drop rather than spin
      alertQueue.length = 0;
      alertShowing = false;
      return;
    }

    alertShowing = true;
    var donation = alertQueue.shift();

    var phases = [
      { cls: 'is-donor',  text: donation.displayName || 'Anonymous' },
      { cls: 'is-amount', text: Donations.formatCurrency(donation.amount) }
    ];
    var message = truncateMessage(donation.message);
    if (message) phases.push({ cls: 'is-message', text: message, marquee: true });

    safely('donation alert', function () { runDonationAlert(el, phases); });
    el.classList.add('visible');

    setTimeout(function () {
      el.classList.remove('visible');
      setTimeout(playNextAlert, ALERT_GAP_MS);
    }, CONFIG.timing.donationAlertMs);
  }

  function runDonationAlert(el, phases) {
    var run    = ++alertRun;   // any timer from a previous alert is now stale
    var video  = el.querySelector('video');
    var textEl = el.querySelector('#donation-alert-text');
    if (!textEl) return;

    textEl.className = '';
    textEl.innerHTML = '';

    if (video) {
      try { video.currentTime = 0; } catch (err) { /* not seekable yet */ }
      var playing = video.play();
      if (playing && playing.catch) {
        playing.catch(function (err) {
          // The file has no audio track and the element is muted, so autoplay
          // should never be refused — but the text must still run if it is.
          console.warn('[overlay] donation alert video did not play:', err);
        });
      }
    }

    playAlertSound();   // started with the video, so the two stay in step

    // Lead-in and lead-out keep the text clear of the artwork's own animated
    // entrance and exit; whatever is left is split evenly between the phases.
    var leadIn  = CONFIG.timing.donationAlertLeadInMs;
    var leadOut = CONFIG.timing.donationAlertLeadOutMs;
    var window_ = Math.max(0, CONFIG.timing.donationAlertMs - leadIn - leadOut);
    var each    = window_ / phases.length;

    phases.forEach(function (phase, i) {
      var inAt  = leadIn + i * each;
      var outAt = inAt + each - ALERT_FADE_MS;

      setTimeout(function () {
        if (run !== alertRun) return;
        textEl.className = phase.cls;
        if (phase.marquee) {
          renderMarquee(textEl, phase.text, each - ALERT_FADE_MS);
        } else {
          textEl.textContent = phase.text;
        }
        // Next frame, so the browser has a start value to transition from.
        requestAnimationFrame(function () {
          if (run === alertRun) textEl.classList.add('show');
        });
      }, inAt);

      setTimeout(function () {
        if (run !== alertRun) return;
        textEl.classList.remove('show');
      }, Math.max(inAt, outAt));
    });
  }

  // Scrolls the message only if it genuinely overflows the panel. A short
  // message just sits centred — a marquee that doesn't need to move reads as
  // a glitch.
  function renderMarquee(el, text, durationMs) {
    el.innerHTML = '<span class="alert-marquee"></span>';
    var span = el.firstChild;
    span.textContent = text;

    var overflow = span.scrollWidth - el.clientWidth;
    if (overflow > 0) {
      span.style.setProperty('--marquee-shift', '-' + (overflow + 24) + 'px');
      span.style.animationDuration = (durationMs / 1000) + 's';
      span.classList.add('is-scrolling');
    }
  }

  // Builds the shell once, then swaps only the rows. The title is never
  // re-rendered, so it cannot shift between pages. Short pages are padded with
  // hidden rows: the widget is bottom-anchored, so a change in panel height
  // would push the title up or down.
  function renderSchedulePage(el, rows, padTo) {
    var body = el.querySelector('.widget-schedule-pages');
    if (!body) {
      el.innerHTML =
        '<div class="widget-label">Today\'s Schedule</div>' +
        '<div class="widget-schedule-pages"></div>';
      body = el.querySelector('.widget-schedule-pages');
    }

    var html = rows.map(function (g) {
      return '<div class="widget-schedule-row">' +
        '<span class="widget-time">' + formatTime(g.startTime) + '</span>' +
        '<span class="widget-game">' + escapeHtml(g.game || Schedule.UNDECIDED_LABEL) + '</span>' +
        '</div>';
    }).join('');

    for (var i = rows.length; i < padTo; i++) {
      html += '<div class="widget-schedule-row is-filler">' +
        '<span class="widget-time">&nbsp;</span>' +
        '<span class="widget-game">&nbsp;</span>' +
        '</div>';
    }

    body.innerHTML = html;
  }

  function renderDixperRow(item) {
    return '<div class="widget-dixper-row">' +
      '<span class="widget-skill">' + escapeHtml(item.name) + '</span>' +
      '<span class="widget-cost">$' + escapeHtml(String(item.value).trim()) + '</span>' +
      '</div>';
  }

  function queueFullSchedule(onDone) {
    var remaining = Schedule.getRemainingGames();
    if (!remaining.length) { if (onDone) onDone(); return; }   // event over

    var perPage = CONFIG.fullScheduleRowsPerPage;
    var pages = [];
    for (var i = 0; i < remaining.length && pages.length < MAX_SCHEDULE_PAGES; i += perPage) {
      pages.push(remaining.slice(i, i + perPage));
    }

    // Only pad when there is more than one page — a lone short page would
    // otherwise sit above a block of dead space.
    var padTo = pages.length > 1 ? perPage : 0;

    enqueue('fullSchedule', pages.map(function (rows) {
      return function (el) { renderSchedulePage(el, rows, padTo); };
    }), CONFIG.timing.fullSchedulePageMs, { done: onDone });
  }

  function queueDixperSkills(onDone, onHiding) {
    if (!Schedule.getCurrentGame()) {      // nothing on — skip straight through
      safely('dixperSkills onHiding', onHiding);
      if (onDone) onDone();
      return;
    }

    enqueue('dixperSkills', function (el) {
      // Read at render time, not queue time: a slot with no suggestions of
      // its own draws a fresh random set each time this animates in, and by
      // now the queue may have moved us into a different slot.
      var current = Schedule.getCurrentGame();
      var skills  = Dixper.getSuggestedSkillsForCurrentGame();
      if (!current || !skills.length) { el.innerHTML = ''; return; }

      el.innerHTML =
        '<div class="widget-label">' +
          (current.game ? 'Try These on ' + escapeHtml(current.game) : 'Try These') +
        '</div>' +
        skills.map(renderDixperRow).join('') +
        '<div class="widget-cta">' + escapeHtml(DIXPER_CTA) + '</div>';
    }, CONFIG.timing.widgetDisplayMs, { done: onDone, hiding: onHiding });
  }

  // One rotation: schedule, then Dixper skills, then a rest, then repeat.
  //
  // Strictly chained rather than two independent setIntervals. Independent
  // timers let the higher-priority Dixper widget re-queue itself while the
  // schedule was still on screen, so the schedule could be starved out of the
  // slot entirely. Here each step starts only once the previous one has left.
  //
  // A step that has nothing to show (event over, or clock outside every slot)
  // calls straight through to the next, so the rotation never stalls.
  //
  // The top banner brackets the whole rotation: up as the schedule arrives,
  // out the moment the Dixper panel starts leaving. Banner.hide() is called
  // both then and again on `done`; it is idempotent, which also covers the
  // case where the Dixper step is skipped and never shows a panel at all.
  function runRotation() {
    Banner.show();

    queueFullSchedule(function () {
      queueDixperSkills(function () {
        Banner.hide();
        setTimeout(runRotation, CONFIG.timing.rotationRestMs);
      }, Banner.hide);
    });
  }

  function formatTime(isoString) {
    return new Date(isoString).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Mirrors CONFIG.widgetSide onto the slot as a class. styles.css does the
  // rest — edge offset, which side carries the yellow border, and which way
  // the panels slide in from.
  function applyWidgetSide() {
    var slot = document.getElementById('widget-slot');
    if (!slot) return;

    var side = String(CONFIG.widgetSide || 'right').toLowerCase();
    if (side !== 'left' && side !== 'right') {
      console.warn('[overlay] CONFIG.widgetSide should be "left" or "right"; got ' +
                   JSON.stringify(CONFIG.widgetSide) + ' — using "right"');
      side = 'right';
    }

    slot.classList.remove('side-left');
    slot.classList.remove('side-right');
    slot.classList.add('side-' + side);
  }

  // Drops the alert element when the flag is off, rather than only ignoring
  // donations. The <video> carries preload="auto" and so starts buffering as
  // soon as the HTML is parsed; removing it releases that buffer instead of
  // holding a decoded 1920x1080 frame store for the whole event. The fetch
  // itself has already begun by the time any script runs, so this cannot
  // prevent the request — only abandon it.
  function applyDonationAlertSetting() {
    if (alertsEnabled()) return;

    var el = document.getElementById('donation-alert');
    if (el && el.parentNode) el.parentNode.removeChild(el);
    console.info('[overlay] donation alerts disabled by config — ' +
                 'donations still poll and still update the totals');
  }

  function init() {
    applyWidgetSide();            // before the first widget is drawn, so it parks on the correct edge
    applyDonationAlertSetting();  // before the first poll can land a donation
    initAlertSound();             // buffers the sound now rather than on the first donation
    runRotation();                // starts immediately — the schedule is the first thing shown
  }

  return { init: init, enqueue: enqueue, queueDonation: queueDonation };
})();
