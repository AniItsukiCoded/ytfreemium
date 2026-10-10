# PremiumTube

A YouTube Premium–styled front end for the YouTube Data API v3. 100% static: no server, no build needed to run.

## Files
```
index.html          multi-file version (uses css/ and js/)
css/styles.css
js/                 config.js (API key), api.js, store.js, components.js, app.js
premiumtube.html    ONE-FILE bundle of everything above (for loaders / about:blank)
launcher.html       opens an about:blank tab and loads premiumtube.html from GitHub raw
build.js            regenerates premiumtube.html after you edit the source: node build.js
```

## Option A: GitHub Pages (simplest)
Upload everything, then Settings → Pages → Deploy from branch `main` / `(root)`.
Live at `https://<username>.github.io/<repo>/`.

## Option B: about:blank launcher (loads from GitHub raw)
1. Upload everything to your repo (keep `premiumtube.html` in it).
2. On GitHub open `premiumtube.html` → click **Raw** → copy that URL.
3. Open `launcher.html`, replace the `RAW = '...'` line with your URL.
4. Host `launcher.html` somewhere over https (GitHub Pages works), open it, click **Launch PremiumTube**.

The loader does `window.open('about:blank')`, fetches the raw file, and `document.write`s it in.
That's why the bundle is one file: relative `css/` and `js/` paths don't exist in about:blank.

Remember to run `node build.js` and re-upload `premiumtube.html` whenever you change the source.

### Video playback
YouTube only allows embedded players on pages that have a real web address. In the launcher the
opened tab takes the launcher page's address, so it must be hosted over https (not opened from
disk). If a video shows an error, use **Try alternate player** under the video (switches between
two YouTube embed domains) or **Open on YouTube**. Pages opened straight from disk show
Error 153 / a notice instead of a player; that's YouTube's rule, not a bug.

## API key (`js/config.js`)
A static site has to send the key to the browser, so it can't be fully secret. Protect it in Google
Cloud Console → Credentials → your key:
- API restrictions → YouTube Data API v3 only.
- Website restrictions → add your site, e.g. `https://<username>.github.io/*`.

Note: with the about:blank launcher, requests may carry a different/empty referrer, so a
website-restricted key can be blocked. If the feed says "Key blocked for this address", add the
launcher's address or loosen the website restriction, and keep the YouTube-API-only restriction.

## Notes
- Ads that YouTube serves on a video still play inside the embed.
- Daily quota is 10,000 units (a search costs 100). Responses are cached for 10 minutes per tab.
