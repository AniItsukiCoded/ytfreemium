// YouTube Data API v3 key.
// NOTE: on a static site the key is delivered to the browser, so it can never be fully secret.
// It is split up here only to keep it out of casual scrapers. The real protection is to
// restrict the key in Google Cloud Console (HTTP referrers + YouTube Data API v3 only).
window.PT_CONFIG = {
  // OPTIONAL. Full https address of player.html on whichever site you actually host this on, e.g.
// 'https://your-main-site.example/player.html'. Leave '' to skip the relay step; the player then
// just tries the two direct embeds and finally shows a "Watch on YouTube" button.
  relay: '',
  k: ['AIzaSyB1lLPm', 'SPnd-RZY37Win', 'LL-fBkOJXYXqnY'],
};
