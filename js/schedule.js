// Schedule logic — derives current and next game from system clock vs CONFIG.schedule

var Schedule = (function () {

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

  function init() {
    // No polling needed — schedule is derived on demand from system clock
  }

  return { init: init, getCurrentGame: getCurrentGame, getNextGame: getNextGame, getRemainingGames: getRemainingGames };
})();
