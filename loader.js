(function () {
  // index.html pulls its own CSS/JS from raw GitHub, so the launcher only needs index.html itself.
  var RAW_INDEX = 'https://raw.githubusercontent.com/AniItsukiCoded/ytfreemium/refs/heads/main/index.html';

  function get(url) {
    return fetch(url + '?t=' + Date.now()).then(function (r) {
      if (!r.ok) throw new Error(url + ' returned HTTP ' + r.status);
      return r.text();
    });
  }

  window.launchPremiumTube = function (status) {
    var say = status || function () {};
    var w = window.open('about:blank', '_blank');
    if (!w) { say('Popup blocked. Allow popups for this page and try again.'); return; }
    w.document.title = 'PremiumTube';
    say('Loading files from GitHub…');
    get(RAW_INDEX).then(function (html) {
      w.document.open();
      w.document.write(html); // index.html then fetches css/ and js/ from raw GitHub itself
      w.document.close();
      say('Opened.');
    }).catch(function (e) {
      w.close();
      say('Could not load: ' + e.message);
    });
  };
})();
