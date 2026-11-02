// Top banner — ExtraLife-TopLine.png
//
// No timers of its own. The widget rotation in widgets.js drives it: the
// banner slides in as the rotation's first widget appears and starts sliding
// out the instant the last one does, so the branding is on screen exactly
// while a widget is and nothing else.

var Banner = (function () {
  var elTop = null;

  // Both are idempotent — the rotation calls hide() at the moment the last
  // panel starts leaving and again when it has finished, and a skipped step
  // may call it without a matching show().
  function show() {
    if (elTop) elTop.classList.add('visible');
  }

  function hide() {
    if (elTop) elTop.classList.remove('visible');
  }

  function init() {
    elTop = document.getElementById('banner-top');
  }

  return { init: init, show: show, hide: hide };
})();
