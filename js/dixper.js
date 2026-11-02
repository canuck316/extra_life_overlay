// Dixper menu data and skill suggestion helpers

var Dixper = (function () {

  var MAX_SUGGESTIONS = 4;   // features.md #6 — hard cap, never show more

  // Skills to highlight for the slot that is on right now.
  //
  // A slot that names its own skills shows exactly those (capped at 4). A slot
  // that names none gets a random handful instead, so the widget still has
  // something to say. Call this at render time, not queue time — the random
  // pick is meant to be different every time the widget animates in.
  function getSuggestedSkillsForCurrentGame() {
    var current = Schedule.getCurrentGame();
    if (!current) return [];

    var named = current.suggestedDixperSkills || [];
    if (named.length) {
      return named
        .slice(0, MAX_SUGGESTIONS)
        .map(function (name) {
          return CONFIG.dixperMenu.find(function (item) { return item.name === name; });
        })
        .filter(Boolean);   // drops a name with no matching menu entry
    }

    return pickRandom(CONFIG.dixperMenu, MAX_SUGGESTIONS);
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
