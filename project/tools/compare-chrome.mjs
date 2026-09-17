/**
 * Compares the Restore Forward header and footer as our pages draw them against the live
 * restoreny.org, at the widths where the layout changes, and writes an HTML report.
 *
 *   npm run compare
 *   npm run compare -- --ours http://localhost:5500/project/rf-review-hub/deploy/workshops-and-retreats/retreats/
 *
 * The two sites are measured the same way: elements are found by what they are (the header's
 * biggest image is the logo, the link reading "Donate" is the Donate pill), never by class name,
 * because Wix's class names are generated and ours are not.
 *
 * Some differences are deliberate — our footer carries two buttons where the live site carries
 * forms — so those rows are reported as context rather than counted as failures.
 */
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

const arg = (flag, fallback) => {
  const i = process.argv.indexOf(flag);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

const LIVE = arg('--live', 'https://www.restoreny.org/');
const OURS = arg('--ours', 'https://restoreny.github.io/workshops-and-retreats/retreats/');
const WIDTHS = (arg('--widths', '320,390,750,1024,1280,1920')).split(',').map(Number);

/** Anything under this is a match; the fonts themselves move text by a fraction of a pixel. */
const PASS = 0.75;
const WARN = 2;

/** Runs inside the page. Finds the chrome by role and text, so it works on both sites. */
function measureInPage() {
  const num = (v) => Math.round(v * 10) / 10;
  const vis = (el) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const box = (el, origin) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const o = origin ? origin.getBoundingClientRect() : { left: 0, top: 0 };
    return { x: num(r.left - o.left), y: num(r.top - o.top), w: num(r.width), h: num(r.height) };
  };
  const ownText = (el) => [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();

  const header = document.querySelector('.rf-header') || document.querySelector('header');
  const footer = document.querySelector('.rf-footer') || document.querySelector('footer');
  const out = {};
  if (!header || !footer) return { error: 'no header or footer found' };

  // ---- header ----
  const headerImgs = [...header.querySelectorAll('img')].filter(vis);
  const logo = headerImgs.sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0];
  const donate = [...header.querySelectorAll('a, button')].filter((e) => /donate/i.test(e.textContent) && vis(e))[0];
  const menuBtn = [...header.querySelectorAll('button, [role=button]')]
    .filter((e) => /menu|navigation/i.test((e.getAttribute('aria-label') || '') + e.className) && vis(e))[0];
  const deskNav = [...header.querySelectorAll('a')].some((a) => a.textContent.trim() === 'Stays' && vis(a));

  out.header = { h: num(header.getBoundingClientRect().height) };
  out.logo = box(logo, header);
  out.donate = box(donate, header);
  out.menuButton = box(menuBtn, header);
  out.layout = { desktopNav: deskNav };

  // ---- footer: column positions, address, icons ----
  const all = [...footer.querySelectorAll('*')].filter(vis);
  const byText = (re) => all.find((e) => re.test(ownText(e)));
  out.footerMenuHeading = box(byText(/^MENU$/i), footer);
  out.footerAddressHeading = box(byText(/^OUR ADDRESS$/i), footer);
  out.footerMessageHeading = box(byText(/^LEAVE YOUR/i), footer);
  out.footerAddress = box(byText(/^201 Main/i), footer);

  const fb = footer.querySelector('a[href*=facebook]');
  let bar = fb ? fb.parentElement : null;
  while (bar && !bar.querySelector('a[href*=linkedin]')) bar = bar.parentElement;
  const icons = bar ? [...bar.querySelectorAll('a')].filter(vis) : [];
  out.socialFirst = icons[0] ? box(icons[0].querySelector('img') || icons[0], footer) : null;
  out.socialPitch = icons.length > 1
    ? { v: num(icons[1].getBoundingClientRect().left - icons[0].getBoundingClientRect().left) }
    : null;

  // deliberate difference: our footer replaced the two forms with buttons
  out.footerHeight = { h: num(footer.getBoundingClientRect().height) };
  return out;
}

/** Rows that must match, and the fields of each that are compared. */
const CHECKS = [
  ['header', 'Header height', ['h']],
  ['logo', 'Logo', ['x', 'y', 'w', 'h']],
  ['donate', 'Donate pill', ['x', 'y', 'w', 'h']],
  ['menuButton', 'Menu button', ['x', 'y', 'w', 'h']],
  ['footerMenuHeading', 'Footer “Menu” heading', ['x']],
  ['footerAddressHeading', 'Footer “Our Address” heading', ['x']],
  ['footerMessageHeading', 'Footer message heading', ['x']],
  ['footerAddress', 'Footer address block', ['x']],
  ['socialFirst', 'First social icon', ['x', 'w', 'h']],
  ['socialPitch', 'Social icon spacing', ['v']],
];

/** Reported for context, never failed: we changed these on purpose. */
const CONTEXT = [
  ['footerHeight', 'Footer height (ours is shorter: forms became buttons)', ['h']],
];

const verdict = (d) => (d === null ? 'skip' : Math.abs(d) <= PASS ? 'pass' : Math.abs(d) <= WARN ? 'warn' : 'fail');

async function measure(page, url, width) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1200); // Wix settles its layout after load
  return page.evaluate(measureInPage);
}

const rows = [];
/* Drives the Chrome already installed on this machine, so nothing has to be downloaded.
   Falls back to Playwright's own build if that isn't there. Either way it runs headless,
   in a throwaway profile — it never touches your signed-in Chrome. */
let browser;
try {
  browser = await chromium.launch({ channel: 'chrome' });
} catch {
  browser = await chromium.launch();
}
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const width of WIDTHS) {
    process.stdout.write(`measuring ${width}px … `);
    const live = await measure(page, LIVE, width);
    const ours = await measure(page, OURS, width);
    if (live.error || ours.error) {
      rows.push({ width, name: 'page', field: '', live: live.error || '', ours: ours.error || '', delta: null, status: 'fail' });
      console.log('error');
      continue;
    }
    rows.push({ width, name: 'Layout', field: 'desktop nav', live: String(live.layout.desktopNav), ours: String(ours.layout.desktopNav), delta: null, status: live.layout.desktopNav === ours.layout.desktopNav ? 'pass' : 'fail' });
    for (const [key, label, fields] of CHECKS) {
      for (const f of fields) {
        const a = live[key]?.[f], b = ours[key]?.[f];
        if (a == null || b == null) { rows.push({ width, name: label, field: f, live: a ?? '—', ours: b ?? '—', delta: null, status: 'skip' }); continue; }
        rows.push({ width, name: label, field: f, live: a, ours: b, delta: Math.round((b - a) * 10) / 10, status: verdict(b - a) });
      }
    }
    for (const [key, label, fields] of CONTEXT) {
      for (const f of fields) {
        const a = live[key]?.[f], b = ours[key]?.[f];
        rows.push({ width, name: label, field: f, live: a ?? '—', ours: b ?? '—', delta: a != null && b != null ? Math.round((b - a) * 10) / 10 : null, status: 'context' });
      }
    }
    console.log('done');
  }
} finally {
  await browser.close();
}

const counts = rows.reduce((a, r) => ((a[r.status] = (a[r.status] || 0) + 1), a), {});
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Chrome comparison</title>
<style>
  :root{--cream:#fffbf0;--slate:#59637e;--line:#59637e33;--pass:#2f6f4f;--warn:#9a6b17;--fail:#a6372c;--ground:#fffbf0;color-scheme:light}
  *{box-sizing:border-box}
  body{margin:0;padding:0 clamp(16px,4vw,40px) 64px;background:var(--ground);color:var(--slate);
       font:300 16px/1.45 "Avenir","Nunito Sans",system-ui,sans-serif}
  header{padding:28px 0 18px}
  h1{margin:0 0 6px;font:300 clamp(30px,5vw,48px)/1 Georgia,"Times New Roman",serif;text-transform:uppercase;letter-spacing:.01em}
  .meta{font-size:14px;opacity:.85}
  .meta code{font:inherit;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
  .summary{display:flex;flex-wrap:wrap;gap:10px;margin:18px 0 26px}
  .pill{padding:7px 14px;border:1px solid var(--line);border-radius:999px;font-size:14px}
  .pill b{font-weight:400;font-variant-numeric:tabular-nums}
  .tablewrap{overflow-x:auto;border-top:1px solid var(--slate)}
  table{border-collapse:collapse;width:100%;min-width:680px;font-variant-numeric:tabular-nums}
  th,td{padding:9px 12px;text-align:left;border-bottom:1px solid var(--line);font-size:14.5px;white-space:nowrap}
  th{font:400 12px/1.3 "Wix Madefor Display","Nunito Sans",system-ui,sans-serif;letter-spacing:.06em;text-transform:uppercase}
  tbody tr:hover{background:#59637e0d}
  td.name{white-space:normal}
  .w{font-weight:400;opacity:.7}
  .status{font-size:12.5px;letter-spacing:.04em;text-transform:uppercase}
  .pass .status{color:var(--pass)} .warn .status{color:var(--warn)} .fail .status{color:var(--fail)}
  .skip .status,.context .status{opacity:.6}
  .fail td{background:#a6372c0f}
  tr.wstart td{border-top:2px solid var(--slate)}
  footer{margin-top:28px;font-size:13.5px;opacity:.8;max-width:60ch}
</style></head><body>
<header>
  <h1>Chrome comparison</h1>
  <p class="meta">Live <code>${esc(LIVE)}</code> against ours <code>${esc(OURS)}</code> · ${new Date().toLocaleString()}</p>
  <p class="meta">A difference of ${PASS}px or less passes; up to ${WARN}px warns. Elements are found by role and text on both sites, never by class name.</p>
</header>
<div class="summary">
  <span class="pill">pass <b>${counts.pass || 0}</b></span>
  <span class="pill">warn <b>${counts.warn || 0}</b></span>
  <span class="pill">fail <b>${counts.fail || 0}</b></span>
  <span class="pill">not found <b>${counts.skip || 0}</b></span>
  <span class="pill">by design <b>${counts.context || 0}</b></span>
</div>
<div class="tablewrap"><table>
<thead><tr><th>Width</th><th>Element</th><th>Field</th><th>restoreny.org</th><th>ours</th><th>diff</th><th>Result</th></tr></thead>
<tbody>
${rows.map((r, i) => {
  const first = i === 0 || rows[i - 1].width !== r.width;
  return `<tr class="${r.status}${first ? ' wstart' : ''}"><td class="w">${first ? r.width + 'px' : ''}</td><td class="name">${esc(r.name)}</td><td>${esc(r.field)}</td><td>${esc(r.live)}</td><td>${esc(r.ours)}</td><td>${r.delta == null ? '' : (r.delta > 0 ? '+' : '') + r.delta}</td><td class="status">${r.status}</td></tr>`;
}).join('\n')}
</tbody></table></div>
<footer>
  <p>Rows marked <b>by design</b> record choices we made on purpose — the footer forms became buttons that open the real ones on restoreny.org, so our footer is shorter. <b>Not found</b> means an element was missing at that width, which is expected where the desktop nav or the phone menu button is hidden.</p>
</footer>
</body></html>`;

const out = join(HERE, 'compare-report.html');
writeFileSync(out, html);
console.log(`\npass ${counts.pass || 0} · warn ${counts.warn || 0} · fail ${counts.fail || 0} · not found ${counts.skip || 0} · by design ${counts.context || 0}`);
console.log(`report: ${out}`);
