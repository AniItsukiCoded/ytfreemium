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


// YouTube decides whether to allow an embed from the page's referrer. Opened from disk (file://)
// there is none (Error 153). In an about:blank launcher the referrer comes from the opener, which
// usually works, so we try the embed and give one-click alternates if it doesn't.
let playerMode = 0; // 0 = youtube-nocookie.com, 1 = youtube.com
const embedUrl = (vid, mode) =>
  `https://${mode === 1 ? 'www.youtube.com' : 'www.youtube-nocookie.com'}/embed/${encodeURIComponent(vid)}?autoplay=1&rel=0&modestbranding=1&playsinline=1`;
const watchUrl = (vid) => 'https://www.youtube.com/watch?v=' + encodeURIComponent(vid);

function playerHtml(vid, title) {
  if (location.protocol === 'file:') {
    return `<div class="player__fallback">
      <h2>Playback needs a web address</h2>
      <p>YouTube blocks embedded players on pages opened from a file. This works once the site is on GitHub Pages or launched through the loader.</p>
      <a class="btn btn--primary" href="${watchUrl(vid)}" target="_blank" rel="noopener">Watch on YouTube</a>
    </div>`;
  }
  return `<iframe src="${embedUrl(vid, playerMode)}" referrerpolicy="strict-origin-when-cross-origin"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen title="${esc(title)}"></iframe>`;
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
      const f = document.querySelector('.player iframe');
      if (!f) return toast('Use “Open on YouTube”');
      playerMode = 1 - playerMode;
      f.src = embedUrl(vid, playerMode);
      toast(playerMode ? 'Switched to youtube.com player' : 'Switched to privacy-enhanced player');
    };
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
  if (a) { e.preventDefault(); go(a.getAttribute('href')); }
});
// browser Back/Forward
window.addEventListener('hashchange', () => {
  let h = ''; try { h = location.hash; } catch (e) {}
  if (h && h !== current) { current = h; route(); }
});
route();

})();
