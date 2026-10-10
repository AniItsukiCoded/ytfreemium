(function () {
// Pure HTML-string builders. Everything from the API is escaped before it reaches the DOM.
const store = window.PT_STORE;

const esc = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function compact(n) {
  n = Number(n);
  if (!Number.isFinite(n)) return '';
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

function duration(iso = '') {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return '';
  const [h, mi, s] = [m[1] || 0, m[2] || 0, m[3] || 0].map(Number);
  const pad = (x) => String(x).padStart(2, '0');
  return h ? `${h}:${pad(mi)}:${pad(s)}` : `${mi}:${pad(s)}`;
}

function ago(iso) {
  const sec = (Date.now() - new Date(iso).getTime()) / 1000;
  const units = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]];
  for (const [name, s] of units) {
    if (sec >= s) { const n = Math.floor(sec / s); return `${n} ${name}${n > 1 ? 's' : ''} ago`; }
  }
  return 'just now';
}

const thumb = (sn) => (sn.thumbnails.maxres || sn.thumbnails.standard || sn.thumbnails.high || sn.thumbnails.medium).url;
const bookmark = '<svg viewBox="0 0 24 24"><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z"/></svg>';

function card(v, i = 0, variant = '') {
  const sn = v.snippet;
  const saved = store.isSaved(v.id);
  const views = v.statistics?.viewCount ? `${compact(v.statistics.viewCount)} views · ` : '';
  const dur = v.contentDetails ? duration(v.contentDetails.duration) : '';
  const href = `#/watch?v=${v.id}`;
  const chHref = `#/channel?id=${sn.channelId}`;
  const thumbHtml = `
    <div class="card__thumb">
      <img src="${esc(thumb(sn))}" alt="" loading="lazy">
      ${dur ? `<span class="card__dur">${dur}</span>` : ''}
      <button class="card__save ${saved ? 'on' : ''}" data-save="${v.id}" aria-label="Watch later">${bookmark}</button>
    </div>`;
  const style = `style="animation-delay:${Math.min(i, 12) * 40}ms"`;

  if (variant === 'wide') {
    return `
      <a class="card card--wide" href="${href}" ${style}>
        ${thumbHtml}
        <div class="card__body">
          <div class="card__title">${esc(sn.title)}</div>
          <div class="card__sub">${views}${ago(sn.publishedAt)}</div>
          <div class="card__sub"><span data-href="${chHref}">${esc(sn.channelTitle)}</span></div>
          <div class="card__desc">${esc(sn.description)}</div>
        </div>
      </a>`;
  }
  if (variant === 'side') {
    return `
      <a class="card card--side" href="${href}" ${style}>
        ${thumbHtml}
        <div>
          <div class="card__title">${esc(sn.title)}</div>
          <div class="card__sub">${esc(sn.channelTitle)}</div>
          <div class="card__sub">${views}${ago(sn.publishedAt)}</div>
        </div>
      </a>`;
  }
  return `
    <a class="card" href="${href}" ${style}>
      ${thumbHtml}
      <div class="card__meta">
        <div class="card__ch">${esc(sn.channelTitle.charAt(0).toUpperCase())}</div>
        <div>
          <div class="card__title">${esc(sn.title)}</div>
          <div class="card__sub"><span data-href="${chHref}">${esc(sn.channelTitle)}</span></div>
          <div class="card__sub">${views}${ago(sn.publishedAt)}</div>
        </div>
      </div>
    </a>`;
}

function skeletons(n = 12) {
  return `<div class="grid">${Array.from({ length: n }, () => `
    <div><div class="skel skel--thumb"></div><div class="skel skel--line"></div><div class="skel skel--line s"></div></div>`).join('')}</div>`;
}

function message(kind, title, body) {
  return `<div class="${kind}"><h2>${esc(title)}</h2><p>${body}</p></div>`;
}

window.PT_UI = { esc, compact, duration, ago, card, skeletons, message };
})();
