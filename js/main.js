// Init and top-level orchestration
// Runs after all other scripts are loaded

(function () {
  function init() {
    Schedule.init();
    Donations.init();
    Dixper.init();
    Widgets.init();
    Twitch.init();
    Banner.init();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
