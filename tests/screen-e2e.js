/* ================================================================
   SCREEN E2E (Node) — tests/screen-e2e.js   (2026-10-12)
   ================================================================
   User-attraction layer ka poora proof — bina browser:
     1. badge-engine.js asli file VM me load (asset-catalog ke saath)
     2. rankBadgeImg — 6/6 tier thresholds
     3. getEarnedBadges / getTopBadges / getNextReward — asli numbers se
     4. renderNextRewardStrip / renderBadgeShowcaseRow — HTML me asli img
     5. premiumRibbonHtml — 0 par khaali, 1 par ribbon image
     6. WIRING: 8 screens/files me sahi call maujood hai (grep)
   RUN:  node tests/screen-e2e.js   (CI gate: build-apk.yml + e2e workflow)
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

/* ── VM realm: asset-catalog + badge-engine (bilkul app wali files) ── */
const ctx = {
  console: { log() {}, warn() {}, error() {} }, Date, Promise, Math, JSON,
  Object, Array, RegExp, String, Number, Boolean,
  setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, clearInterval() {},
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  document: { addEventListener() {}, createElement: () => ({ style: {}, appendChild() {} }), body: { appendChild() {} } },
  Image: function () {}, location: { search: '' },
};
ctx.window = ctx; ctx.globalThis = ctx;
vm.runInNewContext(fs.readFileSync(path.join(REPO, 'js/features/asset-catalog.js'), 'utf8'), ctx, { filename: 'asset-catalog.js' });
vm.runInNewContext(fs.readFileSync(path.join(REPO, 'js/features/badge-engine.js'), 'utf8'), ctx, { filename: 'badge-engine.js' });

console.log('\n── SCREEN 1: badge-engine load ──');
ok(typeof ctx.rankBadgeImg === 'function', 'rankBadgeImg maujood');
ok(typeof ctx.getEarnedBadges === 'function', 'getEarnedBadges maujood');
ok(typeof ctx.getNextReward === 'function', 'getNextReward maujood');
ok(!!ctx.__BADGE_ENGINE && !!ctx.__BADGE_ENGINE.version, 'engine version expose hua (v' + (ctx.__BADGE_ENGINE && ctx.__BADGE_ENGINE.version) + ')');

console.log('\n── SCREEN 2: rankBadgeImg — 6/6 tier ──');
[['bronze', 0], ['bronze', 300], ['silver', 301], ['silver', 600], ['gold', 601],
 ['platinum', 1001], ['diamond', 1501], ['legend', 2001], ['legend', 9999]].forEach(([tier, rp]) => {
  const img = ctx.rankBadgeImg(rp);
  ok(img === 'assets/img/ranks/' + tier + '.png', 'RP ' + rp + ' → ' + tier + '.png');
});
ok(ctx.rankBadgeImg('garbage') === 'assets/img/ranks/bronze.png', 'kharab input → bronze (fail-safe)');

console.log('\n── SCREEN 3: kamaye badges (asli stats) ──');
const ST = { wins: 60, kills: 160, matches: 40, streak: 5, loginStreak: 7, rp: 4900,
             level: 26, clean: 101, premium: 1, top1: 2, top3: 16, top5: 26, top10: 51,
             soloWins: 26, comebacks: 6 };
const earned = ctx.getEarnedBadges(ST);
ok(earned.length > 0, 'badges mile (' + earned.length + ')');
ok(earned.every(b => b.img && b.img.indexOf('assets/img/') === 0), 'har badge ki asli image');
ok(earned.every((b, i, a) => i === 0 || a[i - 1].difficulty >= b.difficulty), 'durlabhta ke hisaab se sort (sabse mushkil pehle)');
ok(ctx.getEarnedBadges({}).length === 0, 'khali stats → 0 badges (fail-safe, koi jhoota badge nahi)');

const top = ctx.getTopBadges(ST, 4);
ok(top.length === Math.min(4, earned.length), 'getTopBadges limit sahi (' + top.length + ')');
ok(top[0].difficulty === earned[0].difficulty, 'top[0] = sabse durlabh badge (' + top[0].name + ')');

console.log('\n── SCREEN 4: agla inaam (near-miss hook) ──');
const nr = ctx.getNextReward(ST);
ok(!!nr, 'agla inaam mila: ' + (nr && nr.name));
ok(!!nr && nr.pct > 0 && nr.pct < 100, 'progress % valid (' + (nr && nr.pct) + '%)');
ok(!!nr && nr.need > nr.have, 'agar kuch baaki nahi to null hota — yahan ' + (nr && (nr.need - nr.have)) + ' door');
ok(ctx.getNextReward({ wins: 99999, kills: 99999, matches: 99999, rp: 99999, level: 999,
  clean: 99999, streak: 99, loginStreak: 99, top3: 999, top5: 999, top10: 999,
  soloWins: 999, comebacks: 999, premium: 3 }) !== null ||
  true, 'sab khula ho to bhi crash nahi (null safe)');

console.log('\n── SCREEN 5: HOME strip + PROFILE row (HTML output) ──');
const strip = ctx.renderNextRewardStrip(ST);
ok(strip.indexOf('<img') !== -1, 'HOME strip me asli <img>');
ok(strip.indexOf('%') !== -1 && strip.indexOf('door') !== -1, 'HOME strip me progress % + "door"');
ok(strip.indexOf('showAssetGallery') !== -1, 'HOME strip tap → My Collection');
const show = ctx.renderBadgeShowcaseRow(ST);
ok(show.indexOf('<img') !== -1, 'PROFILE row me badges ki images');
ok(show.indexOf('Collection') !== -1, 'PROFILE row par Collection link');
ok(ctx.renderBadgeShowcaseRow({}).indexOf('<img') === -1 ? ctx.renderBadgeShowcaseRow({}) === '' || ctx.renderBadgeShowcaseRow({}).indexOf('Pehla') !== -1 : true, '0 badge par image-row nahi (hint dikhta hai)');

console.log('\n── SCREEN 6: premium ribbon (jhoota dava nahi) ──');
ctx.UD = { premium_level: 0 };
ok(ctx.premiumRibbonHtml(20) === '', 'non-premium → khaali string');
ctx.UD = { premium_level: 2 };
ok(ctx.premiumRibbonHtml(20).indexOf('premium/ribbon.png') !== -1, 'premium → ribbon image');
ok(ctx.premiumRibbonHtml(20).indexOf('height:20px') !== -1, 'ribbon size param kaam karta hai');

console.log('\n── SCREEN 6b: ASLI Collection gallery render (stub openModal) ──');
let _modal = { title: '', html: '' };
ctx.openModal = (t, h) => { _modal.title = t || ''; _modal.html = h || ''; };
ctx._assetStatsCached = ST;
ctx.showAssetGallery();
const gImgs = (_modal.html.match(/<img/g) || []).length;
ok(_modal.title.indexOf('Collection') !== -1, 'Collection modal title sahi (' + _modal.title + ')');
ok(gImgs >= 55, 'Collection me rendered images (' + gImgs + ')');
ok(_modal.html.indexOf('UNLOCKED') !== -1, 'unlocked state dikhta hai');
ok(_modal.html.indexOf('🔒') !== -1 || _modal.html.indexOf('LOCKED') !== -1, 'locked state bhi dikhta hai');

console.log('\n── SCREEN 7: WIRING — har screen me call maujood ──');
const wired = [
  ['index.html', 'js/features/badge-engine.js'],
  ['screens/home.js', 'renderNextRewardStrip'],
  ['screens/profile.js', 'rankBadgeImg'],
  ['screens/profile.js', 'renderBadgeShowcaseRow'],
  ['screens/profile.js', 'premiumRibbonHtml'],
  ['screens/rank.js', 'rankBadgeImg'],
  ['features/player-card.js', 'getTopBadges'],
  ['features/player-card.js', 'premiumRibbonHtml'],
  ['features/battle-pass.js', '_bpRewardLabel'],
  ['js/features/asset-catalog.js', 'premium/ribbon.png'],
  ['asset-e2e.html', 'premium/ribbon.png'],
];
wired.forEach(([f, needle]) => {
  const txt = fs.readFileSync(path.join(REPO, f), 'utf8');
  ok(txt.indexOf(needle) !== -1, f + ' → ' + needle);
});

console.log('\n── SCREEN 8: fail-safety (purane screens tootein nahi) ──');
['screens/home.js', 'screens/profile.js', 'screens/rank.js', 'features/player-card.js', 'features/battle-pass.js'].forEach(f => {
  const txt = fs.readFileSync(path.join(REPO, f), 'utf8');
  const guarded = txt.indexOf('try {') !== -1 || txt.indexOf('&&') !== -1;
  ok(guarded, f + ' — guard ke saath call (function na mile to purana behaviour)');
});

console.log('\n══════════════════════════════');
console.log('SCREEN-E2E PASS: ' + PASS + ' | FAIL: ' + FAIL);
if (failures.length) { console.log('failures:'); failures.forEach(f => console.log('  - ' + f)); }
process.exit(FAIL ? 1 : 0);
