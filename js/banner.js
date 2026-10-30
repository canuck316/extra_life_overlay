// Banner swap — ExtraLife-TopLine.png ↔ ExtraLife-BottomTxtFields.png

var Banner = (function () {
  var elTop        = null;
  var elBottom     = null;
  var elFollower   = null;
  var elSubscriber = null;
  var elDonor      = null;
  var elTopDonor   = null;

  function populateFields() {
    elFollower.textContent   = Twitch.getLatestFollower()   || '—';
    elSubscriber.textContent = Twitch.getLatestSubscriber() || '—';
    elDonor.textContent      = Donations.getLatestDonor()   || '—';
    elTopDonor.textContent   = Donations.getTopDonor()      || '—';
  }

  function showBoth() {
    Twitch.fetchAll();
    Donations.fetchTopDonor();

    populateFields();
    elTop.classList.add('visible');
    elBottom.classList.add('visible');
    setTimeout(hideBoth, CONFIG.timing.bannerDisplayMs);
  }

  function hideBoth() {
    elTop.classList.remove('visible');
    elBottom.classList.remove('visible');
    setTimeout(showBoth, CONFIG.timing.bannerSwapMs);
  }

  function init() {
    elTop        = document.getElementById('banner-top');
    elBottom     = document.getElementById('banner-bottom');
    elFollower   = document.getElementById('banner-field-follower');
    elSubscriber = document.getElementById('banner-field-subscriber');
    elDonor      = document.getElementById('banner-field-donor');
    elTopDonor   = document.getElementById('banner-field-top-donor');

    setTimeout(showBoth, CONFIG.timing.bannerSwapMs);
  }

  return { init: init };
})();
