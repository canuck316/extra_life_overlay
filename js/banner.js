// Top banner — ExtraLife-TopLine.png
//
// No timers of its own. CONFIG.topBanner picks one of three modes:
//   'animate' — the widget rotation in widgets.js drives it: the banner slides
//               in as the rotation's first widget appears and starts sliding
//               out the instant the last one does, so the branding is on
//               screen exactly while a widget is and nothing else.
//   'always'  — shown at init and pinned there; the rotation's calls are ignored.
//   'never'   — the element is removed at init; the rotation's calls are ignored.

var Banner = (function () {
  var elTop  = null;
  var pinned = false;   // 'always' mode: hide() must not take it down

  // Both are idempotent — the rotation calls hide() at the moment the last
  // panel starts leaving and again when it has finished, and a skipped step
  // may call it without a matching show().
  function show() {
    if (elTop) elTop.classList.add('visible');
  }

  function hide() {
    if (elTop && !pinned) elTop.classList.remove('visible');
  }

  // Absent means 'animate', so a config written before this option existed
  // keeps the behaviour it had.
  function readMode() {
    var mode = String(CONFIG.topBanner || 'animate').toLowerCase();
    if (mode !== 'animate' && mode !== 'always' && mode !== 'never') {
      console.warn('[overlay] CONFIG.topBanner should be "animate", "always" or "never"; got ' +
                   JSON.stringify(CONFIG.topBanner) + ' — using "animate"');
      mode = 'animate';
    }
    return mode;
  }

  function init() {
    elTop = document.getElementById('banner-top');
    if (!elTop) return;

    var mode = readMode();
    if (mode === 'never') {
      elTop.parentNode.removeChild(elTop);
      elTop = null;          // show() and hide() become no-ops
    } else if (mode === 'always') {
      show();
      pinned = true;
    }
  }

  return { init: init, show: show, hide: hide };
})();
