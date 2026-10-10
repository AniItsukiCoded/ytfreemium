# PremiumTube

A YouTube Premium–styled front end for the YouTube Data API v3. 100% static: no server, no build needed to run.

## Files
```
index.html          the app shell. On load it fetches css/ and js/ from the raw GitHub files and inlines them
css/styles.css
js/                 config.js (API key), api.js, store.js, components.js, app.js
premiumtube.html    ONE-FILE offline bundle of everything above (built by build.js)
player.html         relay page: a real https page that embeds the YouTube player (see Video playback)
launcher.html       opens an about:blank tab and loads index.html from GitHub raw
loader.js           the same loader as a standalone snippet
build.js            regenerates premiumtube.html after you edit the source: node build.js
```

## Option A: GitHub Pages (simplest)
Upload everything, then Settings → Pages → Deploy from branch `main` / `(root)`.
Live at `https://<username>.github.io/<repo>/`.

## Option B: about:blank launcher (loads from GitHub raw)
`launcher.html` is already set to `AniItsukiCoded/ytfreemium` (branch `main`). `index.html` itself fetches
`css/styles.css` and every `js/` file from raw.githubusercontent.com and inlines them (raw serves text/plain, so a
normal `<script src>` would never run), so it works from any address: about:blank, an iframe, GitHub Pages, or
disk. If raw GitHub can't be reached it tries the same files next to the page.

1. Upload everything in this folder to the repo (keep the `css/` and `js/` folders and `premiumtube.html`).
2. Host `launcher.html` over https: easiest is GitHub Pages (repo Settings → Pages → `main` / root), then open
   `https://aniitsukicoded.github.io/ytfreemium/launcher.html` and click **Launch PremiumTube**.
3. Or paste `loader.js` into the console of any https page, then run `launchPremiumTube()`.

To point it at a different repo/branch, edit `RAW` in the bootstrap at the bottom of `index.html` (and `RAW_INDEX` in the launcher).
`premiumtube.html` is optional now; run `node build.js` if you want the offline single-file copy.

### Video playback
YouTube only allows embedded players on pages with a real web address, and an `about:blank` page also inherits the
security policy (CSP) of whatever opened it, which can block YouTube frames completely. The player therefore tries a
chain and moves on by itself when one step fails (CSP block, Error 153, or no response):
1. `youtube-nocookie.com` embed, 2. `youtube.com` embed, 3. `player.html` on GitHub Pages (a real https page).
Inside `about:blank` it starts with step 3. Last resort is a **Watch on YouTube** button.

For step 3 to work: enable GitHub Pages (repo Settings → Pages → `main` / root) and keep `player.html` in the repo. If
the page that hosts your `about:blank` tab has its own CSP, it must allow `https://aniitsukicoded.github.io` in `frame-src`
(and `www.youtube-nocookie.com` / `www.youtube.com` if you want the direct embeds). The relay address is `relay` in `js/config.js`.
If the network blocks YouTube itself (some school filters), nothing here can get around that; use **Watch on YouTube**.

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
