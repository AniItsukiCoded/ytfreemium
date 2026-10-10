// YouTube Data API v3 key.
// NOTE: on a static site the key is delivered to the browser, so it can never be fully secret.
// It is split up here only to keep it out of casual scrapers. The real protection is to
// restrict the key in Google Cloud Console (HTTP referrers + YouTube Data API v3 only).
window.PT_CONFIG = {
  // A real https page that embeds the YouTube player (player.html in this repo, served by GitHub Pages).
  // Used when the app runs from about:blank, where YouTube rejects the embed (Error 153) or the opener's CSP blocks it.
  relay: 'https://aniitsukicoded.github.io/ytfreemium/player.html',
  k: ['AIzaSyB1lLPm', 'SPnd-RZY37Win', 'LL-fBkOJXYXqnY'],
};
