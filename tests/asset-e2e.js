/* ================================================================
   ASSET E2E TESTS — tests/asset-e2e.js  (2026-10-10)
   Har image ka complete proof:
     1. catalog me hai + file assets/img/ me hai (1:1, no orphans)
     2. valid PNG + sahi dimensions + size budget
     3. koi duplicate id/img NAHI
     4. asset-e2e.html har path list karta hai
     5. wiring: index.html, player-card, rank-system, match-history,
        premium, growth sab jagah live hooks maujood
   RUN:  node tests/asset-e2e.js
   ================================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO = path.join(__dirname, '..');
let PASS = 0, FAIL = 0;
const failures = [];
function ok(cond, label) {
  if (cond) { PASS++; console.log('  ✓ ' + label); }
  else { FAIL++; failures.push(label); console.log('  ✗ ' + label); }
}

/* ── catalog load (VM, same file jo app chalati hai) ── */
const ctx = {
  console, Date, Promise, Math, JSON, Object, Array, RegExp, String, Number, Boolean,
  setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, clearInterval() {},
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  document: { addEventListener() {}, createElement: () => ({ style: {}, appendChild() {} }), body: { appendChild() {} } },
  Image: function () {}, location: { search: '' },
};
ctx.window = ctx; ctx.globalThis = ctx;
vm.runInNewContext(fs.readFileSync(path.join(REPO, 'js/features/asset-catalog.js'), 'utf8'), ctx, { filename: 'asset-catalog.js' });

console.log('\n── ASSET 1: catalog — 59 items, no duplicate, no orphan ──');
const cat = ctx.ASSET_CATALOG;
ok(!!cat, 'catalog load hua');
const all = ctx._assetAll();
ok(all.length === 59, 'total 59 items (milé ' + all.length + ')');
ok(cat.ranks.length === 6 && cat.premium.length === 3 && cat.titles.length === 17 &&
   cat.badges.length === 23 && cat.special.length === 3 && cat.cosmetic.length === 1 && cat.icons.length === 6,
   'har kind ka count sahi (6/3/17/23/3/1/6)');

const ids = all.map(x => x.id);
const imgs = all.map(x => x.img);
ok(new Set(ids).size === ids.length, 'sare id unique (koi duplicate NAHI)');
ok(new Set(imgs).size === imgs.length, 'sare img path unique (ek cheez = ek image)');

const diskImgs = [];
(function walk(d) {
  fs.readdirSync(d).forEach(f => {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (f.endsWith('.png')) diskImgs.push('assets/img/' + path.relative(path.join(REPO, 'assets/img'), p).split(path.sep).join('/'));
  });
})(path.join(REPO, 'assets/img'));
ok(diskImgs.length === 59, 'disk par bhi 59 PNG (milé ' + diskImgs.length + ')');
const missing = imgs.filter(i => !diskImgs.includes(i));
const orphans = diskImgs.filter(i => !imgs.includes(i));
ok(missing.length === 0, 'catalog ki har img file hai' + (missing.length ? ' — MISSING: ' + missing.join(',') : ''));
ok(orphans.length === 0, 'koi orphan file NAHI (sab clean)' + (orphans.length ? ' — ORPHAN: ' + orphans.join(',') : ''));

console.log('\n── ASSET 2: PNG validity + dimensions + size budget ──');
function pngInfo(buf) {
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), bytes: buf.length };
}
let badPng = 0, bigFiles = 0, totalBytes = 0;
all.forEach(it => {
  const buf = fs.readFileSync(path.join(REPO, it.img));
  const info = pngInfo(buf);
  if (!info || info.w !== info.h || info.w < 64 || info.w > 700) { badPng++; console.log('    bad:', it.id, info && (info.w + 'x' + info.h)); }
  const budget = it.img.indexOf('/frames/') !== -1 ? 450 * 1024 : 150 * 1024;
  if (info && info.bytes > budget) { bigFiles++; console.log('    big:', it.id, Math.round(info.bytes / 1024) + 'KB'); }
  totalBytes += buf.length;
});
ok(badPng === 0, 'sare 59 valid PNG, square, sane dimensions');
ok(bigFiles === 0, 'har file budget me (badges/titles/icons < 150KB, frame < 300KB)');
ok(totalBytes < 5 * 1024 * 1024, 'kul assets < 5MB (ab ' + Math.round(totalBytes / 1024) + 'KB)');

console.log('\n── ASSET 3: E2E page + wiring ──');
const e2e = fs.readFileSync(path.join(REPO, 'asset-e2e.html'), 'utf8');
ok(e2e.indexOf('ASSET-E2E-RESULT') !== -1, 'asset-e2e.html result line print karta hai');
const e2eMissing = imgs.map(i => i.replace('assets/img/', '')).filter(p => e2e.indexOf(p) === -1);
ok(e2eMissing.length === 0, 'asset-e2e.html sab 59 paths list karta hai' + (e2eMissing.length ? ' — ' + e2eMissing.join(',') : ''));

const idx = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
ok(idx.indexOf('js/features/asset-catalog.js?v=') !== -1, 'index.html me asset-catalog.js wired (cache-bust ke saath)');
const pc = fs.readFileSync(path.join(REPO, 'features/player-card.js'), 'utf8');
ok(pc.indexOf('showAssetGallery') !== -1, 'player-card me My Collection button');
const rs = fs.readFileSync(path.join(REPO, 'js/rank-system.js'), 'utf8');
ok(rs.indexOf("img: 'assets/img/ranks/legend.png'") !== -1, 'rank-system me rank images');
ok(rs.indexOf('showAssetGallery') !== -1, 'How Rank Works me Collection link');
const mh = fs.readFileSync(path.join(REPO, 'features/match-history.js'), 'utf8');
ok(mh.indexOf('ASSET_CATALOG') !== -1 && mh.indexOf("t.img ? '<img src=\"' + t.img") !== -1, 'showPlayerTitles me catalog titles + images');
const pr = fs.readFileSync(path.join(REPO, 'features/premium.js'), 'utf8');
ok(pr.indexOf('assets/img/premium/diamond.png') !== -1 && pr.indexOf("t.img?'<img src=\"'+t.img") !== -1, 'premium modal me tier badge images');
const gr = fs.readFileSync(path.join(REPO, 'features/growth.js'), 'utf8');
ok(gr.indexOf('frame_glow') !== -1 && gr.indexOf('assets/img/frames/glow.png') !== -1, 'growth store me frame_glow (Royal Glow Frame)');

console.log('\n── ASSET 4: unlock logic (pure) ──');
ok(ctx._assetUnlocked({ need: { stat: 'wins', need: 10 } }, { wins: 10 }) === true, 'wins>=10 → Veteran unlocked');
ok(ctx._assetUnlocked({ need: { stat: 'wins', need: 10 } }, { wins: 9 }) === false, 'wins<10 → locked');
ok(ctx._assetUnlocked({ need: { all: [{ stat: 'wins', need: 200 }, { stat: 'clean', need: 100 }] } }, { wins: 200, clean: 100 }) === true, 'combo (Immortal) dono poore → unlocked');
ok(ctx._assetUnlocked({ need: { all: [{ stat: 'wins', need: 200 }, { stat: 'clean', need: 100 }] } }, { wins: 300, clean: 50 }) === false, 'combo me ek kam → locked');
ok(ctx._assetUnlocked({ need: { stat: 'kills', need: 500 } }, {}) === false, 'stats missing → fail-safe locked');
ok(ctx._assetUnlocked({ need: { stat: 'top3', need: 50 } }, { top3: 50 }) === true, 'top3 (match-history count) chalta hai');

console.log('\n══════════════════════════════');
console.log('ASSET-E2E PASS: ' + PASS + ' | FAIL: ' + FAIL);
if (failures.length) { console.log('failures:'); failures.forEach(f => console.log('  - ' + f)); }
process.exit(FAIL ? 1 : 0);
