// Timed widget rotation engine
// Priority queue: donations (1) > dixper skills (2) > dixper menu (3) > full schedule (4)
// The current / upcoming game zone is NOT in this queue — it is a persistent
// zone owned by schedule.js (features.md #4).

var Widgets = (function () {
  var PRIORITY = { donation: 1, dixperSkills: 2, dixperMenu: 3, fullSchedule: 4 };

  var MAX_SCHEDULE_PAGES = 3;   // features.md #5 — bounds how long the widget holds

  var queue = [];
  var isShowing = false;
  var queuedTypes = new Set();

  // `render` is either a single function or an array of page render functions.
  // Each page is held for `holdMs`, defaulting to the standard widgetDisplayMs.
  function enqueue(type, render, holdMs) {
    if (queuedTypes.has(type) && type !== 'donation') return;
    queuedTypes.add(type);
    queue.push({
      type: type,
      priority: PRIORITY[type],
      hold: holdMs || CONFIG.timing.widgetDisplayMs,
      pages: Array.isArray(render) ? render : [render]
    });
    queue.sort(function (a, b) { return a.priority - b.priority; });
    if (!isShowing) processQueue();
  }

  function processQueue() {
    if (!queue.length) { isShowing = false; return; }
    isShowing = true;
    var item = queue.shift();
    queuedTypes.delete(item.type);

    var el = getWidgetEl(item.type);
    if (!el || !item.pages.length) { processQueue(); return; }

    var index = 0;
    item.pages[0](el);
    el.classList.add('visible');

    function advance() {
      index++;
      if (index < item.pages.length) {
        item.pages[index](el);
        setTimeout(advance, item.hold);
        return;
      }
      el.classList.remove('visible');
      setTimeout(processQueue, 400); // wait for CSS transition out
    }

    setTimeout(advance, item.hold);
  }

  function getWidgetEl(type) {
    var map = {
      donation:     'widget-donation',
      fullSchedule: 'widget-full-schedule',
      dixperMenu:   'widget-dixper-menu',
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
        '<span class="widget-game">' + escapeHtml(g.game || 'Break') + '</span>' +
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

  function scheduleTimedWidgets() {
    function queueFullSchedule() {
      var remaining = Schedule.getRemainingGames();
      if (!remaining.length) return;

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
      }), CONFIG.timing.fullSchedulePageMs);
    }

    // Show the lineup once at load, then on the normal interval.
    queueFullSchedule();
    setInterval(queueFullSchedule, CONFIG.timing.fullScheduleWidgetMs);

    setInterval(function () {
      var items = Dixper.getMenuItems();
      if (!items.length) return;
      enqueue('dixperMenu', function (el) {
        el.innerHTML = '<div class="widget-label">Dixper Effects Menu</div>' +
          items.map(function (item) {
            return '<div class="widget-dixper-row">' +
              '<span class="widget-skill">' + escapeHtml(item.skill) + '</span>' +
              '<span class="widget-cost">$' + item.dollarAmount + '</span>' +
              '<span class="widget-desc">' + escapeHtml(item.description) + '</span>' +
              '</div>';
          }).join('');
      });
    }, CONFIG.timing.dixperMenuWidgetMs);

    setInterval(function () {
      var skills = Dixper.getSuggestedSkillsForCurrentGame();
      if (!skills.length) return;
      var current = Schedule.getCurrentGame();
      enqueue('dixperSkills', function (el) {
        el.innerHTML = '<div class="widget-label">Try These on ' + escapeHtml(current.game) + '</div>' +
          skills.map(function (item) {
            return '<div class="widget-dixper-row">' +
              '<span class="widget-skill">' + escapeHtml(item.skill) + '</span>' +
              '<span class="widget-cost">$' + item.dollarAmount + '</span>' +
              '</div>';
          }).join('');
      });
    }, CONFIG.timing.dixperSkillsWidgetMs);
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
    scheduleTimedWidgets();
  }

  return { init: init, enqueue: enqueue, queueDonation: queueDonation };
})();
