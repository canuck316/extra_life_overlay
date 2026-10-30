// Twitch Helix API — latest follower and latest subscriber

var Twitch = (function () {
  var BASE = 'https://api.twitch.tv/helix';

  var latestFollower   = '';
  var latestSubscriber = '';

  function headers() {
    return {
      'Authorization': 'Bearer ' + CONFIG.twitch.accessToken,
      'Client-Id':     CONFIG.twitch.clientId
    };
  }

  function fetchFollower() {
    return fetch(
      BASE + '/channels/followers?broadcaster_id=' + CONFIG.twitch.broadcasterId + '&first=1',
      { headers: headers() }
    )
    .then(function (res) { return res.json(); })
    .then(function (data) {
      if (data.data && data.data.length) {
        latestFollower = data.data[0].user_name;
      }
    })
    .catch(function (err) { console.warn('Twitch followers fetch failed:', err); });
  }

  function fetchSubscriber() {
    return fetch(
      BASE + '/subscriptions?broadcaster_id=' + CONFIG.twitch.broadcasterId + '&first=1',
      { headers: headers() }
    )
    .then(function (res) { return res.json(); })
    .then(function (data) {
      if (data.data && data.data.length) {
        latestSubscriber = data.data[0].user_name;
      }
    })
    .catch(function (err) { console.warn('Twitch subscribers fetch failed:', err); });
  }

  function fetchAll() {
    return Promise.all([fetchFollower(), fetchSubscriber()]);
  }

  function getLatestFollower()   { return latestFollower; }
  function getLatestSubscriber() { return latestSubscriber; }

  function init() {
    // Data is fetched on demand by Banner just before the bottom bar appears
  }

  return { init: init, fetchAll: fetchAll, getLatestFollower: getLatestFollower, getLatestSubscriber: getLatestSubscriber };
})();
