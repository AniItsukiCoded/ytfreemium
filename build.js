// Builds premiumtube.html: ONE self-contained file (CSS + JS inlined) for loaders / about:blank.
// Usage: node build.js
const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');
html = html.replace(/<link rel="stylesheet" href="(css\/[^"]+)">/g, (_, f) => `<style>\n${fs.readFileSync(f, 'utf8')}\n</style>`);
html = html.replace(/<script src="(js\/[^"]+)"><\/script>/g, (_, f) =>
  `<script>\n${fs.readFileSync(f, 'utf8').replace(/<\/script/gi, '<\\/script')}\n</script>`);
fs.writeFileSync('premiumtube.html', html);
console.log('wrote premiumtube.html', (html.length / 1024).toFixed(1) + ' KB');
