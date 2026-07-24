/**
 * rasterize.mjs — turn an SVG file into a pixel-exact PNG via headless Chromium.
 *
 * Chromium renders SVG (and real font-family fallbacks) faithfully, so this is the
 * right tool for favicons/wordmarks — sharp/ImageMagick would drop the monospace type.
 *
 * Usage:
 *   node rasterize.mjs <input.svg> <output.png> <width> [height]
 *   (height defaults to width — square)
 *
 * The SVG is drawn at its natural aspect into a <img> sized to WxH on a true-black page,
 * then the element is screenshotted, giving a crisp deviceScaleFactor-independent PNG.
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [, , inPath, outPath, wArg, hArg] = process.argv;
if (!inPath || !outPath || !wArg) {
  console.error('usage: node rasterize.mjs <input.svg> <output.png> <width> [height]');
  process.exit(1);
}
const width = Number(wArg);
const height = Number(hArg ?? wArg);

const svg = readFileSync(resolve(inPath), 'utf8');
// Encode as a data URL so the browser treats it as a standalone image (no CORS/font quirks).
const dataUrl = 'data:image/svg+xml;base64,' + Buffer.from(svg, 'utf8').toString('base64');

const html = `<!doctype html><html><head><meta charset="utf-8">
<style>
  html,body{margin:0;padding:0;background:#000;}
  #stage{width:${width}px;height:${height}px;background:#000;display:block;}
  #stage img{width:${width}px;height:${height}px;display:block;image-rendering:auto;}
</style></head>
<body><div id="stage"><img src="${dataUrl}"></div></body></html>`;

const browser = await chromium.launch();
try {
  // deviceScaleFactor:2 → supersample, then the element screenshot is downscaled to exact px.
  const page = await browser.newPage({ viewport: { width: Math.max(width, 32), height: Math.max(height, 32) }, deviceScaleFactor: 2 });
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts?.ready);
  const el = await page.$('#stage');
  await el.screenshot({ path: resolve(outPath), omitBackground: false });
  console.log(`✓ ${outPath} (${width}x${height})`);
} finally {
  await browser.close();
}
