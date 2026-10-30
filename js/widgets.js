// Timed widget rotation engine
// Priority queue: donations (1) > next game (2) > dixper skills (3) > dixper menu (4) > full schedule (5)

var Widgets = (function () {
  var PRIORITY = { donation: 1, nextGame: 2, dixperSkills: 3, dixperMenu: 4, fullSchedule: 5 };

  var queue = [];
  var isShowing = false;
  var queuedTypes = new Set();

  function enqueue(type, renderFn) {
    if (queuedTypes.has(type) && type !== 'donation') return;
    queuedTypes.add(type);
    queue.push({ type: type, priority: PRIORITY[type], render: renderFn });
    queue.sort(function (a, b) { return a.priority - b.priority; });
    if (!isShowing) processQueue();
  }

  function processQueue() {
    if (!queue.length) { isShowing = false; return; }
    isShowing = true;
    var item = queue.shift();
    queuedTypes.delete(item.type);

    var el = getWidgetEl(item.type);
    if (!el) { processQueue(); return; }

    item.render(el);
    el.classList.add('visible');

    setTimeout(function () {
      el.classList.remove('visible');
      setTimeout(processQueue, 400); // wait for CSS transition out
    }, CONFIG.timing.widgetDisplayMs);
  }

  function getWidgetEl(type) {
    var map = {
      donation:     'widget-donation',
      nextGame:     'widget-next-game',
      fullSchedule: 'widget-full-schedule',
      dixperMenu:   'widget-dixper-menu',
      dixperSkills: 'widget-dixper-skills'
    };
    return document.getElementById(map[type]) || null;
  }

  function queueDonation(donation) {
    enqueue('donation', function (el) {
      el.innerHTML =
        '<div class="widget-donor">' + (donation.displayName || 'Anonymous') + '</div>' +
        '<div class="widget-amount">' + Donations.formatCurrency(donation.amount) + '</div>' +
        (donation.message ? '<div class="widget-message">' + escapeHtml(donation.message) + '</div>' : '');
    });
  }

  function scheduleTimedWidgets() {
    setInterval(function () {
      var next = Schedule.getNextGame();
      if (!next) return;
      enqueue('nextGame', function (el) {
        el.innerHTML =
          '<div class="widget-label">Up Next</div>' +
          '<div class="widget-game">' + escapeHtml(next.game) + '</div>' +
          '<div class="widget-time">' + formatTime(next.startTime) + '</div>';
      });
    }, CONFIG.timing.nextGameWidgetMs);

    setInterval(function () {
      var remaining = Schedule.getRemainingGames();
      if (!remaining.length) return;
      enqueue('fullSchedule', function (el) {
        el.innerHTML = '<div class="widget-label">Today\'s Schedule</div>' +
          remaining.map(function (g) {
            return '<div class="widget-schedule-row">' +
              '<span class="widget-time">' + formatTime(g.startTime) + '</span>' +
              '<span class="widget-game">' + escapeHtml(g.game) + '</span>' +
              '</div>';
          }).join('');
      });
    }, CONFIG.timing.fullScheduleWidgetMs);

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
