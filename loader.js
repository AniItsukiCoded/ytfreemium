(function () {
  // Raw link to index.html in your repo. Everything else is found relative to it.
  var RAW_INDEX = 'https://raw.githubusercontent.com/AniItsukiCoded/ytfreemium/refs/heads/main/index.html';

  var base = RAW_INDEX.replace(/index\.html(\?.*)?$/, '');
  var stamp = Date.now(); // dodge raw.githubusercontent's cache

  function get(url) {
    return fetch(url + '?t=' + stamp).then(function (r) {
      if (!r.ok) throw new Error(url.replace(base, '') + ' returned HTTP ' + r.status);
      return r.text();
    });
  }

  // Raw files are served as text/plain, so <script src=raw> would never run. Fetch + inline instead.
  function assemble() {
    return get(base + 'index.html').then(function (html) {
      var jobs = [];
      html.replace(/<link\b[^>]*rel="stylesheet"[^>]*href="((?:css)\/[^"]+)"[^>]*>/g, function (tag, path) {
        jobs.push(get(base + path).then(function (css) { return [tag, '<style>\n' + css + '\n</sty' + 'le>']; }));
      });
      html.replace(/<script\b[^>]*src="((?:js)\/[^"]+)"[^>]*><\/script>/g, function (tag, path) {
        jobs.push(get(base + path).then(function (js) {
          return [tag, '<scr' + 'ipt>\n' + js.replace(/<\/script/gi, '<\\/script') + '\n</scr' + 'ipt>'];
        }));
      });
      return Promise.all(jobs).then(function (pairs) {
        pairs.forEach(function (p) { html = html.split(p[0]).join(p[1]); });
        return html;
      });
    });
  }

  // If the multi-file load fails for any reason, fall back to the one-file bundle.
  function load() {
    return assemble().catch(function (e) {
      console.warn('Multi-file load failed, trying premiumtube.html:', e);
      return get(base + 'premiumtube.html');
    });
  }

  window.launchPremiumTube = function (status) {
    var say = status || function () {};
    var w = window.open('about:blank', '_blank');
    if (!w) { say('Popup blocked. Allow popups for this page and try again.'); return; }
    w.document.title = 'PremiumTube';
    say('Loading files from GitHub…');
    load().then(function (html) {
      w.document.open();
      w.document.write(html);
      w.document.close();
      say('Opened.');
    }).catch(function (e) {
      w.close();
      say('Could not load: ' + e.message);
    });
  };
})();
