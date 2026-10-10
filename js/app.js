(function () {
const api = window.PT_API;
const store = window.PT_STORE;
const { card, skeletons, message, esc, compact, ago } = window.PT_UI;

const view = document.getElementById('view');
const toastEl = document.getElementById('toast');
let renderId = 0; // guards against late responses painting over a newer page

const CHIPS = ['All', 'Music', 'Gaming', 'Live', 'Sports', 'News', 'Podcasts', 'Comedy', 'Cooking', 'Tech', 'Movies', 'Science'];

function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => toastEl.classList.remove('show'), 2000);
}

// Current route lives in memory; location.hash is only mirrored (it can be unreliable in about:blank).
let current = '#/';
try { current = location.hash || '#/'; } catch (e) {}

function go(h) {
  current = h;
  try { location.hash = h; } catch (e) {}
  route();
}

function parseHash() {
  const raw = current.slice(1) || '/';
  const [path, query = ''] = raw.split('?');
  return { path, params: new URLSearchParams(query) };
}

function errorHtml(e) {
  if (e.reason === 'quotaExceeded') return message('error', 'Daily quota reached', 'Your YouTube API quota is used up for today. It resets at midnight Pacific time.');
  if (e.reason === 'noKey') return message('error', 'API key missing', 'Add your key to <code>js/config.js</code>.');
  if (e.reason === 'keyInvalid' || /API key not valid/i.test(e.message)) return message('error', 'API key not valid', 'Check the key in <code>js/config.js</code> and that YouTube Data API v3 is enabled for it.');
  if (/referer|referrer/i.test(e.message) || e.reason === 'forbidden') return message('error', 'Key blocked for this address', 'Your key is restricted by website. Add this site\'s address to the key\'s allowed referrers in Google Cloud Console.');
  return message('error', 'Something went wrong', esc(e.message));
}

function setActive(path, q) {
  document.querySelectorAll('.nav').forEach((n) => {
    const on = n.dataset.route ? '/' + n.dataset.route === path || (n.dataset.route === 'home' && path === '/') : n.dataset.q && n.dataset.q === q;
    n.classList.toggle('active', !!on);
  });
}

// ---------- paginated grid helper ----------
function mountGrid(container, first, loader, variant = '') {
  let next = first.next;
  let count = 0;
  const grid = document.createElement('div');
  grid.className = variant === 'wide' ? 'list' : 'grid';
  container.appendChild(grid);
  const add = (items) => {
    grid.insertAdjacentHTML('beforeend', items.map((v) => card(v, count++, variant)).join(''));
  };
  add(first.items);
  const btn = document.createElement('button');
  btn.className = 'more';
  btn.textContent = 'Show more';
  btn.hidden = !next;
  container.appendChild(btn);
  btn.onclick = async () => {
    btn.disabled = true; btn.textContent = 'Loading…';
    try {
      const r = await loader(next);
      next = r.next; add(r.items);
      btn.hidden = !next;
    } catch (e) { toast(e.message); }
    btn.disabled = false; btn.textContent = 'Show more';
  };
}


// Player. YouTube only embeds on pages with a real https address (otherwise: Error 153), and an
// about:blank page also inherits the CSP of whatever opened it, which can block youtube frames
// outright (ERR_BLOCKED_BY_CSP). So the player tries a chain and moves on by itself when one fails:
//   nocookie embed -> youtube.com embed -> relay page on GitHub Pages (a real https address)
const RELAY = (window.PT_CONFIG && window.PT_CONFIG.relay) || '';
const MODES = ['nocookie', 'youtube'].concat(RELAY ? ['relay'] : []);
const hasRealAddress = /^https?:$/.test(location.protocol) && !!location.host;
// From about:blank the direct embed is the likeliest to fail, so lead with the relay there.
let playerMode = hasRealAddress || !RELAY ? 0 : MODES.indexOf('relay');
const embedUrl = (vid, mode) => {
  const m = MODES[mode];
  if (m === 'relay') return RELAY + '?v=' + encodeURIComponent(vid);
  return `https://${m === 'youtube' ? 'www.youtube.com' : 'www.youtube-nocookie.com'}/embed/${encodeURIComponent(vid)}?autoplay=1&rel=0&modestbranding=1&playsinline=1&enablejsapi=1`;
};
const watchUrl = (vid) => 'https://www.youtube.com/watch?v=' + encodeURIComponent(vid);

const fallbackHtml = (vid, why, detail) => `<div class="player__fallback">
  <h2>Can't play here</h2>
  <p>${why}</p>
  <div class="player__btns">
    <a class="btn btn--primary" href="${watchUrl(vid)}" target="_blank" rel="noopener">Watch on YouTube</a>
    <button class="btn" id="popPlayer">Open player in a window</button>
  </div>
  ${detail ? `<pre class="player__diag">${esc(detail)}</pre>` : ''}
</div>`;

// A new top-level window is a real page: it does not inherit the opener's CSP and has a real address.
// Same window name every time, so the next video reuses the same pop-out.
function popPlayer(vid) {
  const url = `https://www.youtube.com/embed/${encodeURIComponent(vid)}?autoplay=1&rel=0`;
  const w = window.open(url, 'ptplayer', 'popup,width=1100,height=650');
  if (!w) toast('Popup blocked. Allow popups for this page and try again.');
  else { try { w.focus(); } catch (e) {} }
}

// Some hosts (Canva's code sandbox: frame-src 'none') forbid every iframe. We detect that once at startup.
let framesBlocked = false;
(function probeFrames() {
  try {
    const h = (e) => { if (/frame|child/.test(e.violatedDirective || '')) framesBlocked = true; };
    document.addEventListener('securitypolicyviolation', h);
    const f = document.createElement('iframe');
    f.style.cssText = 'position:absolute;width:0;height:0;border:0;visibility:hidden';
    f.src = 'https://www.youtube-nocookie.com/robots.txt';
    document.body.appendChild(f);
    setTimeout(() => { document.removeEventListener('securitypolicyviolation', h); f.remove(); }, 4000);
  } catch (e) {}
})();

const popoutHtml = (vid) => `<div class="player__fallback">
  <h2>Opens in a pop-out player</h2>
  <p>This page blocks embedded players, so videos play in a small separate window. Clicking any video opens it there automatically.</p>
  <div class="player__btns">
    <button class="btn btn--primary" id="popPlayer">Open player window</button>
    <button class="btn" id="streamBtn">Try in-page stream (beta)</button>
  </div>
</div>`;

function playerHtml(vid, title) {
  if (framesBlocked) return popoutHtml(vid);
  if (location.protocol === 'file:' && !RELAY) return fallbackHtml(vid, 'YouTube blocks embedded players on pages opened from a file.');
  return `<iframe src="${embedUrl(vid, playerMode)}" referrerpolicy="strict-origin-when-cross-origin"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen title="${esc(title)}"></iframe>`;
}

function showFallback(box, vid, why, detail) {
  box.innerHTML = fallbackHtml(vid, why, detail);
  const pb = box.querySelector('#popPlayer');
  if (pb) pb.onclick = () => popPlayer(vid);
}

// Stream mode. Some hosts (e.g. Canva's code sandbox: frame-src 'none') forbid ALL iframes, so no YouTube
// embed can ever load. Plain <video> is a different permission (media-src), so we ask public Invidious
// servers for a direct, proxied MP4 and play it ourselves. Best effort: instances come and go.
const fetchT = (url, ms) => {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  return fetch(url, { signal: c.signal }).finally(() => clearTimeout(t));
};
// Built-in guesses (public servers die often; the live lists below are tried too, and js/config.js can add more).
const IV_DEFAULT = ['https://yewtu.be', 'https://inv.nadeko.net', 'https://invidious.nerdvpn.de', 'https://invidious.privacyredirect.com', 'https://iv.melmac.space', 'https://invidious.jing.rocks', 'https://inv.tux.pizza', 'https://yt.artemislena.eu'];
const PIPED_DEFAULT = ['https://pipedapi.kavin.rocks', 'https://pipedapi.adminforge.de', 'https://api.piped.private.coffee', 'https://pipedapi.leptons.xyz', 'https://pipedapi.nosebs.ru', 'https://piped-api.privacy.com.de'];
let srcCache = null, srcLog = [];
const trimU = (u) => String(u || '').replace(/\/+$/, '');
async function sources() {
  if (srcCache) return srcCache;
  const cfg = window.PT_CONFIG || {};
  let iv = [], pp = [];
  await Promise.all([
    fetchT('https://api.invidious.io/instances.json?sort_by=health', 6000).then((r) => r.json()).then((j) => {
      iv = j.filter((x) => x[1] && x[1].api === true && x[1].type === 'https' && x[1].cors !== false).map((x) => x[1].uri);
    }).catch((e) => srcLog.push('invidious list: ' + (e.message || e))),
    fetchT('https://piped-instances.kavin.rocks/', 6000).then((r) => r.json()).then((j) => {
      pp = j.filter((x) => x.api_url).map((x) => x.api_url);
    }).catch((e) => srcLog.push('piped list: ' + (e.message || e))),
  ]);
  const uniq = (l) => [...new Set(l.map(trimU))];
  srcCache = {
    iv: uniq((cfg.invidious || []).concat(iv, IV_DEFAULT)).slice(0, 8),
    pp: uniq((cfg.piped || []).concat(pp, PIPED_DEFAULT)).slice(0, 8),
  };
  return srcCache;
}
const badStreams = new Set();
let curBase = '';
async function streamUrl(vid) {
  const { iv, pp } = await sources();
  const note = (base, why) => srcLog.push(base.replace(/^https?:\/\//, '') + ': ' + why);
  const fromIv = async (base) => {
    const r = await fetchT(`${base}/api/v1/videos/${encodeURIComponent(vid)}?local=true&fields=formatStreams`, 9000);
    if (!r.ok) throw new Error('http ' + r.status);
    const j = await r.json();
    const f = (j.formatStreams || []).filter((x) => x.url && /mp4/.test(x.type || ''))
      .sort((a, b) => parseInt(b.resolution || 0) - parseInt(a.resolution || 0))[0];
    if (!f) throw new Error('no playable format');
    return { base, kind: 'mp4', url: f.url.startsWith('/') ? base + f.url : f.url, q: f.resolution || '' };
  };
  const fromPiped = async (base) => {
    const r = await fetchT(`${base}/streams/${encodeURIComponent(vid)}`, 9000);
    if (!r.ok) throw new Error('http ' + r.status);
    const j = await r.json();
    const f = (j.videoStreams || []).filter((x) => !x.videoOnly && x.url)
      .sort((a, b) => (b.height || 0) - (a.height || 0))[0];
    if (f) return { base, kind: 'mp4', url: f.url, q: f.quality || '' };
    if (j.hls) return { base, kind: 'hls', url: j.hls, q: 'HLS' };
    throw new Error('no playable format');
  };
  const tasks = [];
  iv.filter((b) => !badStreams.has(b)).forEach((b) => tasks.push(fromIv(b).catch((e) => { note(b, e.name === 'AbortError' ? 'timeout' : (e.message || 'failed')); throw e; })));
  pp.filter((b) => !badStreams.has(b)).forEach((b) => tasks.push(fromPiped(b).catch((e) => { note(b, e.name === 'AbortError' ? 'timeout' : (e.message || 'failed')); throw e; })));
  if (!tasks.length) throw new Error('no servers');
  return Promise.any(tasks);
}
let hlsLoad = null;
const loadHls = () => hlsLoad || (hlsLoad = new Promise((res, rej) => {
  if (window.Hls) return res(window.Hls);
  const sc = document.createElement('script');
  sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/hls.js/1.5.13/hls.min.js';
  sc.onload = () => res(window.Hls); sc.onerror = () => rej(new Error('hls.js blocked'));
  document.head.appendChild(sc);
}));
async function streamPlay(box, vid, detail) {
  srcLog = [];
  box.innerHTML = '<div class="player__fallback"><h2>Loading video…</h2><p>This page blocks YouTube\'s player, so PremiumTube is fetching a direct stream instead.</p></div>';
  const fail = (why) => box.isConnected && showFallback(box, vid, why, [srcLog.slice(0, 16).join('\n'), String(detail || '').split('\n').slice(0, 2).join('\n')].filter(Boolean).join('\n\n'));
  try {
    const { base, kind, url, q } = await streamUrl(vid);
    if (!box.isConnected) return;
    box.innerHTML = '<video controls autoplay playsinline></video>';
    const v = box.querySelector('video');
    curBase = base;
    v.onerror = () => { badStreams.add(base); srcLog.push(base + ': video failed to load'); fail('The stream server failed to deliver this video. Try again, or open it on YouTube.'); };
    if (kind === 'hls') {
      const Hls = await loadHls();
      if (Hls && Hls.isSupported()) {
        const h = new Hls({ enableWorker: false });
        h.on(Hls.Events.ERROR, (_, d) => { if (d.fatal) { badStreams.add(base); srcLog.push(base + ': hls ' + d.details); fail('The stream server failed to deliver this video. Try again, or open it on YouTube.'); } });
        h.loadSource(url); h.attachMedia(v);
      } else v.src = url; // Safari/iOS play HLS natively
    } else v.src = url;
    toast('Playing ' + (q || 'stream') + ' via ' + base.replace(/^https?:\/\//, ''));
  } catch (e) {
    fail('YouTube\'s player is blocked here and no stream server answered.');
  }
}

// Watches the player iframe and advances to the next mode on: a CSP block, a YouTube error
// (153 etc., reported through the iframe API), or a relay that never says hello.
let player = null;
function stopPlayer() { if (player) { player.stop(); player = null; } }
function startPlayer(vid) {
  stopPlayer();
  const box = document.querySelector('.player');
  if (!box) return;
  const pb0 = box.querySelector('#popPlayer'), sb0 = box.querySelector('#streamBtn');
  if (pb0) pb0.onclick = () => popPlayer(vid);
  if (sb0) sb0.onclick = () => streamPlay(box, vid, '');
  const f = box.querySelector('iframe');
  if (!f) return;
  let tries = 0, timer = 0, done = false, lastCsp = '';
  const arm = () => { clearTimeout(timer); if (MODES[playerMode] === 'relay') timer = setTimeout(() => next(), 7000); };
  function next(manual) {
    if (done) return;
    if (!manual && tries >= MODES.length - 1) {
      done = true;
      streamPlay(box, vid, lastCsp);
      return;
    }
    if (manual && tries >= MODES.length - 1) { done = true; badStreams.clear(); streamPlay(box, vid, lastCsp); return; }
    tries++;
    playerMode = (playerMode + 1) % MODES.length;
    f.src = embedUrl(vid, playerMode);
    arm();
    if (manual) toast('Switched player');
  }
  const onMsg = (e) => {
    if (e.source !== f.contentWindow) return;
    let d = e.data;
    if (typeof d === 'string') { try { d = JSON.parse(d); } catch (_) { return; } }
    if (!d) return;
    if (d.pt === 'ready') clearTimeout(timer);
    else if (d.pt === 'err' || d.event === 'onError') next();
  };
  const onCsp = (e) => {
    if (/youtube|github/.test(e.blockedURI || '')) {
      lastCsp = 'blocked: ' + (e.blockedURI || '').slice(0, 60) + '\nrule: ' + e.violatedDirective + '\npolicy: ' + String(e.originalPolicy || '').slice(0, 400);
    }
    if (/frame|child/.test(e.violatedDirective || '') && /youtube|github/.test(e.blockedURI || '') && !done) {
      done = true; framesBlocked = true; clearTimeout(timer); // no iframe can load in this page
      box.innerHTML = popoutHtml(vid);
      box.querySelector('#popPlayer').onclick = () => popPlayer(vid);
      box.querySelector('#streamBtn').onclick = () => streamPlay(box, vid, lastCsp);
    }
  };
  const onLoad = () => { try { f.contentWindow.postMessage('{"event":"listening","id":1}', '*'); } catch (_) {} };
  window.addEventListener('message', onMsg);
  document.addEventListener('securitypolicyviolation', onCsp);
  f.addEventListener('load', onLoad);
  arm();
  player = { next, finished: () => done, restream() { if (curBase) badStreams.add(curBase); done = true; streamPlay(box, vid, lastCsp); }, stop() { done = true; clearTimeout(timer); window.removeEventListener('message', onMsg); document.removeEventListener('securitypolicyviolation', onCsp); } };
}

// ---------- pages ----------
async function home(id, params) {
  const active = params.get('c') || 'All';
  view.innerHTML = `<div class="chips">${CHIPS.map((c) => `<a class="chip ${c === active ? 'active' : ''}" href="#/${c === 'All' ? '' : '?c=' + encodeURIComponent(c)}">${c}</a>`).join('')}</div><div id="feed">${skeletons()}</div>`;
  const feed = document.getElementById('feed');
  try {
    const loader = active === 'All' ? (t) => api.trending(t) : (t) => api.search(active, t);
    const first = await loader('');
    if (id !== renderId) return;
    feed.innerHTML = '';
    mountGrid(feed, first, loader);
  } catch (e) { if (id === renderId) feed.innerHTML = errorHtml(e); }
}

async function trendingPage(id) {
  view.innerHTML = `<h1 class="section-title">Trending <small>Most popular right now</small></h1><div id="feed">${skeletons()}</div>`;
  const feed = document.getElementById('feed');
  try {
    const first = await api.trending();
    if (id !== renderId) return;
    feed.innerHTML = '';
    mountGrid(feed, first, api.trending, 'wide');
  } catch (e) { if (id === renderId) feed.innerHTML = errorHtml(e); }
}

async function searchPage(id, params) {
  const q = params.get('q') || '';
  document.getElementById('searchInput').value = q;
  view.innerHTML = `<h1 class="section-title">Results for “${esc(q)}”</h1><div id="feed">${skeletons(8)}</div>`;
  const feed = document.getElementById('feed');
  try {
    const first = await api.search(q);
    if (id !== renderId) return;
    feed.innerHTML = '';
    if (!first.items.length) { feed.innerHTML = message('empty', 'No results', 'Try different keywords.'); return; }
    mountGrid(feed, first, (t) => api.search(q, t), 'wide');
  } catch (e) { if (id === renderId) feed.innerHTML = errorHtml(e); }
}

async function listPage(id, title, ids, emptyMsg, extra = '') {
  view.innerHTML = `<h1 class="section-title">${title} ${extra}</h1><div id="feed">${ids.length ? skeletons(Math.min(ids.length, 8)) : ''}</div>`;
  const feed = document.getElementById('feed');
  if (!ids.length) { feed.innerHTML = message('empty', 'Nothing here yet', emptyMsg); return; }
  try {
    const items = await api.videosByIds(ids);
    if (id !== renderId) return;
    feed.innerHTML = `<div class="grid">${items.map((v, i) => card(v, i)).join('')}</div>`;
    const clr = document.getElementById('clearHistory');
    if (clr) clr.onclick = () => { store.clearHistory(); route(); };
  } catch (e) { if (id === renderId) feed.innerHTML = errorHtml(e); }
}

async function watchPage(id, params) {
  const vid = params.get('v');
  view.innerHTML = `<div class="watch"><div><div class="player skel"></div></div><div class="related">${skeletons(4).replace('grid', '')}</div></div>`;
  try {
    const v = await api.video(vid);
    if (id !== renderId) return;
    if (!v) { view.innerHTML = message('empty', 'Video unavailable', 'It may be private or removed.'); return; }
    store.addHistory(vid);
    document.title = `${v.snippet.title} · PremiumTube`;
    let theater = false; try { theater = localStorage.getItem('pt_theater') === '1'; } catch (e) {}
    const saved = store.isSaved(vid);
    const likes = v.statistics?.likeCount ? compact(v.statistics.likeCount) : 'Like';
    view.innerHTML = `
      <div class="watch ${theater ? 'theater' : ''}" id="watch">
        <div>
          <div class="player">
            ${playerHtml(vid, v.snippet.title)}
          </div>
          <div class="player__help">Video not loading?
            <button id="altPlayer">Try alternate player</button> · <a href="${watchUrl(vid)}" target="_blank" rel="noopener">Open on YouTube</a>
          </div>
          <h1 class="watch__title">${esc(v.snippet.title)}</h1>
          <div class="watch__bar">
            <a class="channel" href="#/channel?id=${v.snippet.channelId}">
              <img class="channel__av" id="chAv" alt="" src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==">
              <div><div class="channel__name">${esc(v.snippet.channelTitle)}</div><div class="channel__subs" id="chSubs">&nbsp;</div></div>
            </a>
            <div class="actions">
              <span class="btn btn--primary"><svg viewBox="0 0 24 24"><path d="M1 21h4V9H1zm22-11a2 2 0 0 0-2-2h-6.3l1-4.6v-.3a1.5 1.5 0 0 0-.4-1L14.2 1 7.6 7.6A2 2 0 0 0 7 9v10a2 2 0 0 0 2 2h9a2 2 0 0 0 1.8-1.2l3-7a2 2 0 0 0 .2-.8z"/></svg>${likes}</span>
              <button class="btn ${saved ? 'on' : ''}" id="saveBtn"><svg viewBox="0 0 24 24"><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z"/></svg><span>${saved ? 'Saved' : 'Watch later'}</span></button>
              <button class="btn" id="theaterBtn"><svg viewBox="0 0 24 24"><path d="M19 7H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zm0 8H5V9h14z"/></svg>Theater</button>
              <button class="btn" id="shareBtn"><svg viewBox="0 0 24 24"><path d="M18 16a3 3 0 0 0-2 .8l-7-4.1a3 3 0 0 0 0-1.4l7-4.1A3 3 0 1 0 15 5a3 3 0 0 0 .1.7l-7 4.1a3 3 0 1 0 0 4.4l7.1 4.1a3 3 0 1 0 2.8-2.3z"/></svg>Share</button>
            </div>
          </div>
          <div class="desc" id="desc">
            <div class="desc__stats">${compact(v.statistics?.viewCount)} views · ${ago(v.snippet.publishedAt)}</div>
            <div class="desc__text">${esc(v.snippet.description)}</div>
            <button class="desc__more" id="descMore">Show more</button>
          </div>
          <section class="comments" id="comments"><h3>Comments</h3></section>
        </div>
        <aside class="related" id="related"></aside>
      </div>`;

    // interactions
    document.getElementById('altPlayer').onclick = () => {
      if (!player) return toast('Use “Open on YouTube”');
      if (framesBlocked) return popPlayer(vid);
      if (player.finished()) player.restream(); else player.next(true);
    };
    startPlayer(vid);
    document.getElementById('descMore').onclick = (e) => {
      const d = document.getElementById('desc'); d.classList.toggle('open');
      e.target.textContent = d.classList.contains('open') ? 'Show less' : 'Show more';
    };
    document.getElementById('theaterBtn').onclick = () => {
      const w = document.getElementById('watch'); w.classList.toggle('theater');
      try { localStorage.setItem('pt_theater', w.classList.contains('theater') ? '1' : '0'); } catch {}
    };
    document.getElementById('saveBtn').onclick = (e) => {
      const on = store.toggleSaved(vid);
      e.currentTarget.classList.toggle('on', on);
      e.currentTarget.querySelector('span').textContent = on ? 'Saved' : 'Watch later';
      toast(on ? 'Added to Watch later' : 'Removed from Watch later');
    };
    document.getElementById('shareBtn').onclick = async () => {
      try { await navigator.clipboard.writeText(`https://youtu.be/${vid}`); toast('Link copied'); } catch { toast('Could not copy link'); }
    };

    // secondary loads (each fails independently)
    api.channelsByIds([v.snippet.channelId]).then((m) => {
      const c = m.get(v.snippet.channelId); if (!c || id !== renderId) return;
      document.getElementById('chAv').src = c.snippet.thumbnails.default.url;
      document.getElementById('chSubs').textContent = c.statistics.hiddenSubscriberCount ? '' : `${compact(c.statistics.subscriberCount)} subscribers`;
    }).catch(() => {});
    api.related(v).then((items) => {
      if (id !== renderId) return;
      document.getElementById('related').innerHTML = items.map((x, i) => card(x, i, 'side')).join('');
    }).catch(() => {});
    api.comments(vid).then((list) => {
      if (id !== renderId) return;
      const box = document.getElementById('comments');
      if (!list) { box.innerHTML = '<h3>Comments</h3><p style="color:var(--muted)">Comments are turned off for this video.</p>'; return; }
      box.innerHTML = `<h3>${list.length}+ Comments</h3>` + list.map((c) => `
        <div class="comment"><img src="${esc(c.authorProfileImageUrl)}" alt="" loading="lazy">
          <div><div class="comment__who">${esc(c.authorDisplayName)}<span>${ago(c.publishedAt)}</span></div>
          <div class="comment__text">${esc(c.textDisplay)}</div>
          <div class="comment__likes">👍 ${compact(c.likeCount)}</div></div></div>`).join('');
    });
  } catch (e) { if (id === renderId) view.innerHTML = errorHtml(e); }
}

async function channelPage(id, params) {
  const cid = params.get('id');
  view.innerHTML = skeletons(6);
  try {
    const [c, first] = await Promise.all([api.channel(cid), api.channelVideos(cid)]);
    if (id !== renderId) return;
    if (!c) { view.innerHTML = message('empty', 'Channel not found', ''); return; }
    const banner = c.brandingSettings?.image?.bannerExternalUrl;
    view.innerHTML = `
      ${banner ? `<div class="banner" style="background-image:url('${esc(banner)}=w1600')"></div>` : ''}
      <div class="chead"><img src="${esc(c.snippet.thumbnails.medium.url)}" alt="">
        <div><h1>${esc(c.snippet.title)}</h1>
        <p>${c.snippet.customUrl ? esc(c.snippet.customUrl) + ' · ' : ''}${c.statistics.hiddenSubscriberCount ? '' : compact(c.statistics.subscriberCount) + ' subscribers · '}${compact(c.statistics.videoCount)} videos</p></div></div>
      <h2 class="section-title">Latest videos</h2><div id="feed"></div>`;
    mountGrid(document.getElementById('feed'), first, (t) => api.channelVideos(cid, t));
  } catch (e) { if (id === renderId) view.innerHTML = errorHtml(e); }
}

// ---------- router ----------
function route() {
  const id = ++renderId;
  stopPlayer();
  const { path, params } = parseHash();
  document.title = 'PremiumTube';
  document.body.classList.remove('sidebar-open');
  window.scrollTo(0, 0);
  setActive(path, (params.get('q') || '').toLowerCase());
  if (path !== '/search') document.getElementById('searchInput').value = '';

  if (path === '/') return home(id, params);
  if (path === '/trending') return trendingPage(id);
  if (path === '/search') return searchPage(id, params);
  if (path === '/watch') return watchPage(id, params);
  if (path === '/channel') return channelPage(id, params);
  if (path === '/library') return listPage(id, 'Watch later', store.later(), 'Tap the bookmark on any video to save it here.');
  if (path === '/history') return listPage(id, 'History', store.history(), 'Videos you watch will show up here.', '<button class="btn" id="clearHistory" style="margin-left:auto">Clear</button>');
  view.innerHTML = message('empty', 'Page not found', '<a href="#/" style="color:var(--accent)">Back home</a>');
}

// ---------- global events ----------
document.getElementById('searchForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const q = document.getElementById('searchInput').value.trim();
  if (q) go(`#/search?q=${encodeURIComponent(q)}`);
});
document.getElementById('menuBtn').onclick = () => {
  if (window.innerWidth <= 900) document.body.classList.toggle('sidebar-open');
  else document.body.classList.toggle('sidebar-collapsed');
};
document.getElementById('scrim').onclick = () => document.body.classList.remove('sidebar-open');

// card-level clicks: bookmark button + nested channel links (can't nest <a> in <a>)
view.addEventListener('click', (e) => {
  const save = e.target.closest('[data-save]');
  if (save) {
    e.preventDefault(); e.stopPropagation();
    const on = store.toggleSaved(save.dataset.save);
    save.classList.toggle('on', on);
    toast(on ? 'Added to Watch later' : 'Removed from Watch later');
    return;
  }
  const ch = e.target.closest('[data-href]');
  if (ch) { e.preventDefault(); go(ch.dataset.href); }
});

// every in-app link goes through go(), so navigation never depends on the browser's URL handling
document.addEventListener('click', (e) => {
  if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey) return;
  const a = e.target.closest('a[href^="#/"]');
  if (a && framesBlocked) {
    const m = (a.getAttribute('href') || '').match(/^#\/watch\?(?:.*&)?v=([\w-]{6,20})/);
    if (m) popPlayer(m[1]);
  }
  if (a) { e.preventDefault(); go(a.getAttribute('href')); }
});
// browser Back/Forward
window.addEventListener('hashchange', () => {
  let h = ''; try { h = location.hash; } catch (e) {}
  if (h && h !== current) { current = h; route(); }
});
route();

})();
