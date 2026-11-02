// Init and top-level orchestration
// Runs after all other scripts are loaded

(function () {
  function init() {
    Schedule.init();   // sets the debug clock offset, so must precede Widgets
    Donations.init();
    Dixper.init();
    Banner.init();     // must precede Widgets: the rotation shows the banner at once
    Widgets.init();    // starts the rotation immediately
    Twitch.init();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
