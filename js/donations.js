// DonorDrive API polling — donations and fundraising totals

var Donations = (function () {
  var BASE = 'https://extralife.donordrive.com/api';
  var API_VERSION = '?version=1.6';

  var seenDonationIds = new Set();
  var totalsEtag = null;

  var totals = {
    participantTotal: 0,
    participantGoal: 0,
    teamTotal: 0
  };

  var latestDonor = '';
  var topDonor    = '';

  function fetchTotals() {
    var headers = {};
    if (totalsEtag) headers['If-None-Match'] = totalsEtag;

    Promise.all([
      fetch(BASE + '/participants/' + CONFIG.participantId + API_VERSION, { headers: headers }),
      fetch(BASE + '/teams/' + CONFIG.teamId + API_VERSION)
    ]).then(function (responses) {
      var participantRes = responses[0];
      var teamRes = responses[1];

      if (participantRes.status === 304) return Promise.all([null, teamRes.json()]);

      totalsEtag = participantRes.headers.get('ETag');
      return Promise.all([participantRes.json(), teamRes.json()]);
    }).then(function (data) {
      if (data[0]) {
        totals.participantTotal = data[0].sumDonations;
        totals.participantGoal  = data[0].fundraisingGoal;
        renderTotals();
      }
      if (data[1]) {
        totals.teamTotal = data[1].sumDonations;
        renderTotals();
      }
    }).catch(function (err) {
      console.warn('Totals poll failed:', err);
    });
  }

  function fetchDonations() {
    fetch(BASE + '/participants/' + CONFIG.participantId + '/donations' + API_VERSION + '&limit=10')
      .then(function (res) { return res.json(); })
      .then(function (donations) {
        if (donations.length) {
          latestDonor = donations[0].displayName || 'Anonymous';
        }
        donations.forEach(function (d) {
          if (!seenDonationIds.has(d.donationID)) {
            seenDonationIds.add(d.donationID);
            Widgets.queueDonation(d);
          }
        });
      })
      .catch(function (err) {
        console.warn('Donations poll failed:', err);
      });
  }

  function fetchTopDonor() {
    return fetch(
      BASE + '/participants/' + CONFIG.participantId + '/donors' + API_VERSION +
      '&limit=1&orderBy=sumDonations%20DESC'
    )
    .then(function (res) { return res.json(); })
    .then(function (donors) {
      if (donors.length) {
        topDonor = donors[0].displayName || 'Anonymous';
      }
    })
    .catch(function (err) {
      console.warn('Top donor fetch failed:', err);
    });
  }

  function renderTotals() {
    var pEl    = document.getElementById("totals-participant");
    var tEl    = document.getElementById("totals-team");
    var goalEl = document.getElementById("totals-goal");
    var fillEl = document.getElementById("totals-bar-fill");
    if (!pEl) return;   // zone not in the DOM

    setValue(pEl, formatCurrency(totals.participantTotal));
    setValue(tEl, formatCurrency(totals.teamTotal));

    var goal = Number(totals.participantGoal) || 0;
    var pct  = goal > 0 ? Math.min(100, (totals.participantTotal / goal) * 100) : 0;

    fillEl.style.width = pct.toFixed(1) + "%";
    goalEl.textContent = goal > 0 ? Math.round(pct) + "% of " + formatCurrency(goal) : "";
  }

  // Writes a value, flashing it only when it actually changed.
  function setValue(el, text) {
    if (!el || el.textContent === text) return;
    el.textContent = text;
    el.classList.remove("flash");
    void el.offsetWidth;          // force reflow so the animation restarts
    el.classList.add("flash");
  }

  function formatCurrency(amount) {
    return '$' + Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function getTotals()      { return totals; }
  function getLatestDonor() { return latestDonor; }
  function getTopDonor()    { return topDonor; }

  function init() {
    fetchTotals();
    fetchDonations();
    fetchTopDonor();
    setInterval(fetchTotals,    CONFIG.timing.totalsPollMs);
    setInterval(fetchDonations, CONFIG.timing.donationPollMs);
  }

  return { init: init, getTotals: getTotals, formatCurrency: formatCurrency,
           getLatestDonor: getLatestDonor, getTopDonor: getTopDonor,
           fetchTopDonor: fetchTopDonor };
})();
