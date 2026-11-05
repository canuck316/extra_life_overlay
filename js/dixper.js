// Dixper menu data and skill suggestion helpers

var Dixper = (function () {

  var MAX_SUGGESTIONS = 4;   // features.md #6 — hard cap, never show more

  // Normalised access to the menu. An empty menu is a legitimate setup — it
  // means the Dixper widget is switched off — and widgets.js now decides
  // whether to show the panel by asking this module what it has. That makes a
  // throw from here far more costly than it used to be: the call sits on the
  // rotation chain, so an exception would stall every widget for the rest of
  // the event rather than costing one appearance. Hence no assumption that
  // CONFIG.dixperMenu is an array at all.
  function menu() {
    return Array.isArray(CONFIG.dixperMenu) ? CONFIG.dixperMenu : [];
  }

  // Skills to highlight for the slot that is on right now.
  //
  // A slot that names its own skills shows exactly those (capped at 4). A slot
  // that names none gets a random handful instead, so the widget still has
  // something to say. Call this at render time, not queue time — the random
  // pick is meant to be different every time the widget animates in.
  //
  // Returns [] when there is nothing to show, which widgets.js treats as "skip
  // the panel". An empty CONFIG.dixperMenu always lands here, whatever a slot
  // lists in suggestedDixperSkills: those are names looked up in the menu, so
  // with no menu there is nothing for them to resolve to.
  function getSuggestedSkillsForCurrentGame() {
    var current = Schedule.getCurrentGame();
    if (!current) return [];

    var named = current.suggestedDixperSkills || [];
    if (named.length) {
      return named
        .slice(0, MAX_SUGGESTIONS)
        .map(function (name) {
          return menu().find(function (item) { return item.name === name; });
        })
        .filter(Boolean);   // drops a name with no matching menu entry
    }

    return pickRandom(menu(), MAX_SUGGESTIONS);
  }

  // Partial Fisher-Yates: shuffles only as far as it needs to.
  function pickRandom(list, count) {
    var pool = list.slice();
    var n = Math.min(count, pool.length);
    for (var i = 0; i < n; i++) {
      var j = i + Math.floor(Math.random() * (pool.length - i));
      var swap = pool[i];
      pool[i] = pool[j];
      pool[j] = swap;
    }
    return pool.slice(0, n);
  }

  function init() {
    // Static data — no polling needed
  }

  return { init: init, getSuggestedSkillsForCurrentGame: getSuggestedSkillsForCurrentGame };
})();
