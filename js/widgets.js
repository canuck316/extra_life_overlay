// Timed widget rotation engine
// Priority queue: donations (1) > dixper skills (2) > full schedule (3)
// The current / upcoming game zone is NOT in this queue — it is a persistent
// zone owned by schedule.js (features.md #4).

var Widgets = (function () {
  var PRIORITY = { donation: 1, dixperSkills: 2, fullSchedule: 3 };

  var MAX_SCHEDULE_PAGES = 3;   // features.md #5 — bounds how long the widget holds

  // Call to action under the Dixper skill list (features.md #6).
  var DIXPER_CTA = 'Donate with the widget below to trigger the effects!';

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
    if (queuedTypes.has(type) && type !== 'donation') {
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
      donation:     'widget-donation',
      fullSchedule: 'widget-full-schedule',
      dixperSkills: 'widget-dixper-skills'
    };
    return document.getElementById(map[type]) || null;
  }

  function queueDonation(donation) {
    enqueue('donation', function (el) {
      el.innerHTML =
        '<div class="widget-label">New Donation</div>' +
        '<div class="widget-donor">' + escapeHtml(donation.displayName || 'Anonymous') + '</div>' +
        '<div class="widget-amount">' + Donations.formatCurrency(donation.amount) + '</div>' +
        (donation.message ? '<div class="widget-message">' + escapeHtml(donation.message) + '</div>' : '');
    });
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

  function init() {
    runRotation();   // starts immediately — the schedule is the first thing shown
  }

  return { init: init, enqueue: enqueue, queueDonation: queueDonation };
})();
