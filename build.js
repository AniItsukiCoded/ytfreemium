// Builds premiumtube.html: ONE self-contained file (CSS + JS inlined, no network needed for the app files).
// Reads the CSS/JS lists from the bootstrap in index.html. Usage: node build.js
const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');
const list = (name) => [...html.match(new RegExp('var ' + name + ' = \\[([^\\]]*)\\]'))[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
const css = list('CSS'), js = list('JS');
const boot = /  <script>\n  \/\/ Loads the app's CSS[\s\S]*?<\/script>\n/;
if (!boot.test(html)) throw new Error('bootstrap script not found in index.html');
const style = css.map((f) => `<style>\n${fs.readFileSync(f, 'utf8')}\n</style>`).join('\n');
const scripts = js.map((f) => `<script>\n${fs.readFileSync(f, 'utf8').replace(/<\/script/gi, '<\\/script')}\n</script>`).join('\n');
html = html.replace('</head>', style + '\n</head>').replace(boot, () => scripts + '\n');
fs.writeFileSync('premiumtube.html', html);
console.log('wrote premiumtube.html', (html.length / 1024).toFixed(1) + ' KB');
