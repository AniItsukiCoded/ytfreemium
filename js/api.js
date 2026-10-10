(function () {
const BASE = 'https://www.googleapis.com/youtube/v3/';
const KEY = (window.PT_CONFIG && window.PT_CONFIG.k || []).join('');
const TTL = 10 * 60 * 1000; // cache responses 10 min to save daily quota

function cacheGet(k) {
  try {
    const raw = sessionStorage.getItem('ptc:' + k);
    if (!raw) return null;
    const { t, d } = JSON.parse(raw);
    return Date.now() - t < TTL ? d : null;
  } catch (e) { return null; }
}
function cacheSet(k, d) {
  try { sessionStorage.setItem('ptc:' + k, JSON.stringify({ t: Date.now(), d })); } catch (e) {}
}

async function call(endpoint, params) {
  if (!KEY) { const e = new Error('API key missing'); e.reason = 'noKey'; throw e; }
  const qs = new URLSearchParams(params).toString();
  const ck = endpoint + '?' + qs;
  const hit = cacheGet(ck);
  if (hit) return hit;
  let res;
  try {
    res = await fetch(BASE + endpoint + '?' + qs + '&key=' + KEY);
  } catch (e) {
    const err = new Error('Could not reach YouTube. Check your internet connection.');
    err.reason = 'network';
    throw err;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error((data.error && data.error.message) || 'Request failed (' + res.status + ')');
    err.reason = (data.error && data.error.errors && data.error.errors[0] && data.error.errors[0].reason) || '';
    err.status = res.status;
    throw err;
  }
  cacheSet(ck, data);
  return data;
}

// search results only carry snippets; fetch stats + duration for those ids
async function enrich(items) {
  const ids = items.map((i) => i.id?.videoId || i.id).filter(Boolean);
  if (!ids.length) return [];
  const d = await call('videos', { part: 'snippet,contentDetails,statistics', id: ids.join(',') });
  const byId = new Map(d.items.map((v) => [v.id, v]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
}

async function trending(pageToken = '') {
  const d = await call('videos', {
    part: 'snippet,contentDetails,statistics', chart: 'mostPopular',
    regionCode: 'US', maxResults: 24, ...(pageToken && { pageToken }),
  });
  return { items: d.items, next: d.nextPageToken };
}

async function search(q, pageToken = '') {
  const d = await call('search', {
    part: 'snippet', type: 'video', q, maxResults: 24, safeSearch: 'moderate',
    ...(pageToken && { pageToken }),
  });
  return { items: await enrich(d.items), next: d.nextPageToken };
}

async function video(id) {
  const d = await call('videos', { part: 'snippet,contentDetails,statistics', id });
  return d.items[0] || null;
}

async function videosByIds(ids) {
  if (!ids.length) return [];
  const d = await call('videos', { part: 'snippet,contentDetails,statistics', id: ids.slice(0, 50).join(',') });
  const byId = new Map(d.items.map((v) => [v.id, v]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
}

// the old "related videos" parameter was removed by YouTube, so search by title instead
async function related(v) {
  const d = await call('search', { part: 'snippet', type: 'video', q: v.snippet.title, maxResults: 15 });
  const items = d.items.filter((i) => i.id.videoId !== v.id);
  return enrich(items);
}

async function comments(id) {
  try {
    const d = await call('commentThreads', { part: 'snippet', videoId: id, maxResults: 20, order: 'relevance', textFormat: 'plainText' });
    return d.items.map((t) => t.snippet.topLevelComment.snippet);
  } catch (e) {
    return null; // comments disabled
  }
}

async function channel(id) {
  const d = await call('channels', { part: 'snippet,statistics,brandingSettings', id });
  return d.items[0] || null;
}

async function channelsByIds(ids) {
  const uniq = [...new Set(ids)];
  if (!uniq.length) return new Map();
  const d = await call('channels', { part: 'snippet,statistics', id: uniq.slice(0, 50).join(',') });
  return new Map(d.items.map((c) => [c.id, c]));
}

async function channelVideos(id, pageToken = '') {
  const d = await call('search', { part: 'snippet', channelId: id, type: 'video', order: 'date', maxResults: 24, ...(pageToken && { pageToken }) });
  return { items: await enrich(d.items), next: d.nextPageToken };
}

window.PT_API = { trending, search, video, videosByIds, related, comments, channel, channelsByIds, channelVideos };
})();
