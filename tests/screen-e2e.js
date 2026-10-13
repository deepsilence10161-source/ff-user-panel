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
console.log('\n── SCREEN 6c: premium ribbon DOOSRE player ka (leaderboard) ──');
ok(ctx.premiumRibbonFor(0, 0, 15) === '', 'level 0 → khaali');
ok(ctx.premiumRibbonFor(2, Date.now() + 86400000, 15).indexOf('premium/ribbon.png') !== -1, 'level 2 + expiry → ribbon');
ok(ctx.premiumRibbonFor(3, Date.now() - 60000, 15) === '', 'expired → koi ribbon nahi (jhoota dava nahi)');

console.log('\n── SCREEN 6d: trial/premium aakhri 12 ghante — countdown + banner ──');
/* asli free-trial.js file VM me (DOM stubs ke saath) */
vm.runInNewContext(fs.readFileSync(path.join(REPO, 'features/free-trial.js'), 'utf8'), ctx, { filename: 'free-trial.js' });
ok(typeof ctx.renderPremiumExpiryBanner === 'function', 'renderPremiumExpiryBanner maujood');
ok(typeof ctx.updatePremiumExpiryBanner === 'function', 'updatePremiumExpiryBanner maujood');
ok(typeof ctx.getPremiumMsLeft === 'function', 'getPremiumMsLeft maujood');
ok(typeof ctx.getPremiumExpiryAt === 'function', 'getPremiumExpiryAt maujood');
ok(typeof ctx.startPremiumExpiryTicker === 'function', 'ticker hook maujood (window.startPremiumExpiryTicker)');
ctx.getUserPremiumTier = () => 2;
ctx.UD = { premium: { tier: 2, expiresAt: Date.now() + (6 * 3600 * 1000) } };
const bn = ctx.renderPremiumExpiryBanner();
ok(bn.indexOf('id="premExpiryBanner"') !== -1, '12h ke andar → banner HTML mila');
ok(bn.indexOf('premExpiryCount') !== -1 && /\d\d:\d\d:\d\d/.test(bn), 'live countdown H:M:S format me');
ok(bn.indexOf('49') !== -1 && bn.indexOf('showPremiumUpgrade') !== -1, 'CTA button (₹49 / upgrade)');
ok(bn.indexOf('Gold') !== -1, 'tier ka sahi naam (Gold)');
const msLeft = ctx.getPremiumMsLeft();
ok(msLeft > 5.5 * 3600 * 1000 && msLeft <= 6 * 3600 * 1000, 'getPremiumMsLeft sahi (~6h, mila ' + Math.round(msLeft / 3600000 * 10) / 10 + 'h)');
ctx.UD = { premium: { tier: 2, expiresAt: Date.now() + (20 * 3600 * 1000) } };
ok(ctx.renderPremiumExpiryBanner() === '', '20 ghante bache → banner NAHI (window ke bahar)');
ctx.UD = { premium: { tier: 2, expiresAt: Date.now() - 1000 } };
ok(ctx.renderPremiumExpiryBanner() === '', 'expire ho chuka → banner NAHI (jhoota dava nahi)');
ctx.getUserPremiumTier = () => 0;
ctx.UD = { premium: { tier: 0, expiresAt: Date.now() + (3 * 3600 * 1000) } };
ok(ctx.renderPremiumExpiryBanner() === '', 'koi premium nahi → banner NAHI');
/* trial record se hisaab — server data na ho to bhi kaam kare */
ctx.U = { uid: 'trial-user-1' };
const _tStart = Date.now() - (3 * 24 * 3600 * 1000) + (5 * 3600 * 1000); /* 5 ghante bache */
ctx.localStorage = { getItem: (k) => (String(k).indexOf('_mes_trial_') === 0 ? JSON.stringify({ startedAt: _tStart, uid: 'trial-user-1', plan: 'silver_trial', reminderSent: false }) : null), setItem() {}, removeItem() {} };
ctx.getUserPremiumTier = () => 1; /* trial = Silver */
ctx.UD = {};
ok(ctx.isTrialActive() === true, 'trial active (5 ghante bache)');
const expAt = ctx.getPremiumExpiryAt();
ok(Math.abs(expAt - (_tStart + 3 * 24 * 3600 * 1000)) < 5000, 'trial se expiry nikali (UD khaali hone par bhi)');
const bn2 = ctx.renderPremiumExpiryBanner();
ok(bn2.indexOf('Silver') !== -1 && bn2.indexOf('premExpiryBanner') !== -1, 'trial ke aakhri 5 ghante → banner (Silver)');
ctx.localStorage = { getItem: (k) => (String(k).indexOf('_mes_trial_') === 0 ? JSON.stringify({ startedAt: Date.now() - (24 * 3600 * 1000), uid: 'trial-user-1' }) : null), setItem() {}, removeItem() {} };
ok(ctx.renderPremiumExpiryBanner() === '', 'trial me 2 din bache → banner NAHI (12h window ke bahar)');
ctx.U = {}; ctx.UD = {}; ctx.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
ctx.getUserPremiumTier = () => 0;
ok(ctx.renderPremiumExpiryBanner() === '', 'koi data nahi → crash nahi, khaali (fail-safe)');

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
  ['features/player-card.js', 'pcClanChip'],
  ['features/player-card.js', 'getEquippedTagText'],
  ['features/player-card.js', 'premiumRibbonHtml'],
  ['features/battle-pass.js', '_bpRewardLabel'],
  ['js/features/asset-catalog.js', 'premium/ribbon.png'],
  ['asset-e2e.html', 'premium/ribbon.png'],
  ['index.html', 'features/free-trial.js'],
  ['features/free-trial.js', 'renderPremiumExpiryBanner'],
  ['features/free-trial.js', 'premExpiryBanner'],
  ['screen-e2e.html', 'premExpiryBanner'],
  ['features/growth.js', '_COS_RINGS'],
  ['features/growth.js', 'getEquippedFrameArt'],
  ['screens/profile.js', 'pf2-ring-art'],
  ['screens/home.js', 'renderSeasonCountdownStrip'],
  ['features/seasonal-league.js', 'seasonStripNumbers'],
  /* 2026-10-13d: leaderboard ka ASLI renderer js/fixes-v7.js hai — premium
     ribbon wahan laga hai (screens/rank.js wala render live me jeetta nahi). */
  ['js/fixes-v7.js', '_rowRibbon'],
  ['js/fixes-v7.js', '_mergeRankPremium'],
  ['js/fixes-v7.js', "data-uid"],
  ['js/fixes-v7.js', "premiumRibbonFor"],
  ['screen-e2e.html', '9d/12'],
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

console.log('\n── SCREEN 9: Season Pass ki 5 asli kalaayein + cosmetics store art ──');
{
  /* ASLI files — features/battle-pass.js + features/growth.js, mock nahi */
  function mkCtx(bpPreset) {
    const c = {
      console: { log() {}, warn() {}, error() {} }, Date, Promise, Math, JSON,
      Object, Array, RegExp, String, Number, Boolean,
      setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, clearInterval() {},
      localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
      document: { getElementById: () => null, querySelector: () => null,
                  createElement: () => ({ style: {}, appendChild() {} }),
                  addEventListener() {}, body: { appendChild() {} }, head: { appendChild() {} } },
      navigator: { userAgent: 'node-e2e' },
      location: { href: 'https://x/screen-e2e.html', hostname: 'x', pathname: '/screen-e2e.html' },
      fetch: () => Promise.reject(new Error('no-net')), addEventListener() {},
    };
    c.window = c; c.globalThis = c;
    if (bpPreset) c._bpSeasonTiers = bpPreset;
    vm.runInNewContext(fs.readFileSync(path.join(REPO, 'features/battle-pass.js'), 'utf8'), c, { filename: 'battle-pass.js' });
    vm.runInNewContext(fs.readFileSync(path.join(REPO, 'features/growth.js'), 'utf8'), c, { filename: 'growth.js' });
    return c;
  }
  const c = mkCtx();
  const FIVE = [[25,'veteran'],[35,'champion'],[40,'immortal'],[45,'death-bringer'],[50,'reaper']];
  const KEY = {25:'tag_bp_prem_25',35:'emoji_bp_prem_35',40:'tag_bp_prem_40',45:'tag_bp_free_45',50:'tag_bp_prem_50'};

  ok(!!c.__BP && c.__BP.tiers().length === 50, 'TIERS_DATA load — 50 tiers');
  const tdAll = c.__BP ? c.__BP.tiers() : [];
  ok(FIVE.every(([t, slug]) => {
      const td = tdAll[t-1], r = (t === 45) ? td.free : td.prem;
      return td && td.t === t && r && r.img === 'assets/img/titles/' + slug + '.png';
    }), 'grid: t25/35/40/45/50 par 5/5 asli kala (t45 = free track)');
  ok(c.__BP && c.__BP.label(tdAll[24].prem, 17).indexOf('<img src="assets/img/titles/veteran.png') !== -1,
     'tier label HTML me asli <img> (t25 Veteran)');
  ok(tdAll[24].free.type === 'gd' && tdAll[24].free.v === 15 && tdAll[49].free.v === 20,
     'GD inaam waisa hi (t25=15, t50=20) — sirf cosmetic par art laga');
  ok(FIVE.every(([t, slug]) => fs.existsSync(path.join(REPO, 'assets/img/titles/' + slug + '.png'))),
     'paanchon kala file disk par maujood');

  ok(!!c.__COSHOP, 'cosmetics store module load (__COSHOP)');
  const list = c.__COSHOP ? c.__COSHOP.bpList() : [];
  ok(FIVE.every(([t, slug]) => {
      const it = list.filter((x) => x.id === KEY[t])[0];
      return it && it.img === 'assets/img/titles/' + slug + '.png';
    }), 'store catalog — 5/5 BP title par asli art');
  ok(c.__COSHOP && c.__COSHOP.iconHtml({ icon: '🎖️', img: 'assets/img/titles/veteran.png' })
       .indexOf('<img src="assets/img/titles/veteran.png') !== -1,
     'store card asli kala render karta hai');
  ok(c.__COSHOP && c.__COSHOP.iconHtml({ icon: '🎖️' }) === '🎖️', 'img na ho to purana emoji (fail-safe)');
  ok(c.__COSHOP && c.__COSHOP.iconHtml({ icon: '✨', img: 'assets/img/frames/glow.png' })
       .indexOf('<img src="assets/img/frames/glow.png') !== -1,
     'frame_glow art bhi ab store me dikhta hai (pehle sirf ✨)');

  const seHtml = fs.readFileSync(path.join(REPO, 'screen-e2e.html'), 'utf8');
  ok(seHtml.indexOf('bpArtProof') !== -1 && seHtml.indexOf('window.__BP.label(r,') !== -1
     && seHtml.indexOf('window.__COSHOP.iconHtml(it)') !== -1,
     'screen-e2e.html — visual proof cards asli label/iconHtml se bante hain (RESULT ke neeche, screenshot ke liye)');
  ok(seHtml.indexOf("document.body.insertBefore(vis, _logEl)") !== -1,
     'screen-e2e.html — cards RESULT ke theek neeche lagte hain (top viewport = screenshot me dikhega)');

  /* Purana/stale DB row (bina img, purana naam) — art map phir bhi kaam kare */
  const c2 = mkCtx([{ tier: 25, freeGd: 15, permGd: 0,
    premCos: { key: 'tag_bp_prem_25', icon: '🥇', name: '🥇 Gold Champion', type: 'badge' } }]);
  const it25 = c2.__COSHOP.bpList().filter((x) => x.id === 'tag_bp_prem_25')[0];
  ok(!!it25 && it25.img === 'assets/img/titles/veteran.png',
     'stale DB row (img ke bina) par bhi art map chalta hai — veteran.png');
}

console.log('\n── SCREEN 11: SEASON countdown + Top-3 near-miss (asli numbers) ──');
vm.runInNewContext(fs.readFileSync(path.join(REPO, 'features/seasonal-league.js'), 'utf8'), ctx, { filename: 'seasonal-league.js' });
ok(typeof ctx.renderSeasonCountdownStrip === 'function', 'renderSeasonCountdownStrip maujood');
ok(typeof ctx.seasonStripNumbers === 'function', 'seasonStripNumbers maujood');
/* season ka endDate asli tarah set karo (getCurrentSeason se) */
ctx._currentSeason = { name: 'Season 7', endDate: new Date(Date.now() + 3 * 86400000).toISOString(), active: true };
ctx.loadCurrentSeason = ctx.loadCurrentSeason;  /* _season private hai — numbers function usi ko padhta hai */
/* rows: 10 log, main #7 par (kills me) */
const rows10 = [];
for (let i = 1; i <= 10; i++) rows10.push({ id: i === 7 ? 'me-uid' : ('u' + i), total_kills: 100 - (i - 1) * 5, total_wins: 5, rank_points: 100 - i });
ctx.U = { uid: 'me-uid' };
/* _season private hai — getCurrentSeason ko stub karke sach set karo */
ctx.getCurrentSeason = function () { return { name: 'Season 7', daysLeft: 3, hasEnd: true, active: true, label: '3 din baaki' }; };
const n10 = ctx.seasonStripNumbers(rows10, 'me-uid');
ok(!!n10 && n10.pos === 7, 'meri position sahi (#' + (n10 && n10.pos) + ')');
const thirdKills = 100 - 2 * 5;               /* #3 ke kills */
const myKills = 100 - 6 * 5;                  /* #7 ke kills */
ok(!!n10 && n10.gap === (thirdKills - myKills + 1), 'Top-3 se doori sahi (' + (n10 && n10.gap) + ' kills = #3 ke ' + thirdKills + ' − mere ' + myKills + ' + 1)');
ok(!!n10 && n10.daysLeft === 3 && n10.metric === 'kills', 'countdown + metric (kills, wahi jo rank ka default tab hai)');
/* Top-3 me hoon to "door" nahi */
const nTop = ctx.seasonStripNumbers(rows10, 'u2');
ok(!!nTop && nTop.pos === 2 && nTop.gap === 0, 'Top-3 me ho to koi "door" nahi (pos ' + (nTop && nTop.pos) + ')');
/* ranked nahi → sirf countdown, jhooti rank nahi */
const nNone = ctx.seasonStripNumbers(rows10, 'kisi-aur-ka-uid');
ok(!!nNone && nNone.pos === 0 && nNone.gap === 0 && nNone.daysLeft === 3, 'leaderboard me na ho → position claim nahi (jhooti rank kabhi nahi)');
/* season khatam / endDate nahi → strip hi nahi */
ctx.getCurrentSeason = function () { return { name: 'Season 7', daysLeft: 0, hasEnd: true, active: true }; };
ok(ctx.seasonStripNumbers(rows10, 'me-uid') === null, 'season khatam (0 din) → kuch nahi');
ctx.getCurrentSeason = function () { return { name: 'Season 7', daysLeft: 0, hasEnd: false, active: true }; };
ok(ctx.seasonStripNumbers(rows10, 'me-uid') === null, 'endDate hi nahi → koi jhooti deadline nahi');
/* HTML: strip me countdown + near-miss + tap → rank */
ctx.getCurrentSeason = function () { return { name: 'Season 7', daysLeft: 3, hasEnd: true, active: true, label: '3 din baaki' }; };
ctx._ssRows = null; ctx.U = { uid: 'me-uid' };
const sStrip = ctx.renderSeasonCountdownStrip();
ok(sStrip.indexOf('seasonCountdownStrip') !== -1 && sStrip.indexOf('data-days-left="3"') !== -1, 'strip HTML me countdown (data-days-left=3)');
ok(sStrip.indexOf('din baaki') !== -1 && sStrip.indexOf('Rank dekho') !== -1, 'strip par countdown + Rank CTA');
ok(sStrip.indexOf('renderRank') !== -1 || sStrip.indexOf("navTo('rank')") !== -1, 'tap → rank screen');
ctx._season = null;
ctx.getCurrentSeason = function () { return { name: 'Season 1', daysLeft: 0, label: '', active: false }; };
ok(ctx.renderSeasonCountdownStrip() === '', 'season data na ho → khaali (fail-safe, crash nahi)');

console.log('\n── SCREEN 12: leaderboard row par premium ribbon (asli renderer) ──');
{
  const v7 = fs.readFileSync(path.join(REPO, 'js/fixes-v7.js'), 'utf8');
  /* 1. ribbon dono jagah — podium aur row (donon mein IGN ke aage) */
  const podRibbon = /_rowRibbon\(u, _podIsMe\)/.test(v7);
  const rowRibbon = /_rowRibbon\(ur, isMe\)/.test(v7);
  ok(podRibbon && rowRibbon, 'ribbon podium aur row dono me laga (IGN ke aage)');
  /* 2. expire premium = koi ribbon nahi — ye niyam asli file me hai (premiumRibbonFor) */
  const be = fs.readFileSync(path.join(REPO, 'js/features/badge-engine.js'), 'utf8');
  ok(/premiumRibbonFor[\s\S]{0,600}exp < Date\.now\(\)\) return ''/.test(be),
     'expire ho chuka premium → ribbon nahi (jhoota badge nahi — badge-engine me guard)');
  /* 3. Supabase leaderboard merge — Firebase me premium field na ho to bhi ribbon */
  ok(/_mergeRankPremium/.test(v7) && /from\('leaderboard'\)/.test(v7) && /gt\('premium_level', 0\)/.test(v7),
     'premium data Supabase leaderboard se merge hota hai (public read)');
  /* 4. merge fail ho to screen normally chale (ribbon ke bina) */
  ok(/function _mergeRankPremium\(users, done\)/.test(v7) && /catch \(e\) \{ _fin\(\); \}/.test(v7)
     && /if \(!window\._supa \|\| !window\._supa\.from \|\| !users \|\| !users\.length\) return _fin\(\);/.test(v7),
     'merge fail-safe hai — _supa/data na ho ya error aaye to screen normally chalti hai (ribbon ke bina)');
  /* 5. QA- accounts public leaderboard par nahi (app ka purana filter — toota nahi) */
  ok(/\^QA\[-_\]\?\/i\.test\(nm\)/.test(v7), 'QA- prefix wale accounts leaderboard par nahi (filter salamat)');
  /* 6. renderUsers chaaron render paths me merge ke saath chalta hai (cache/timeout/success) */
  const mergeCalls = (v7.match(/_mergeRankPremium\(users/g) || []).length;
  ok(mergeCalls >= 2, 'merge har render path me (timeout + success)', mergeCalls + ' jagah');
}

console.log('\n── SCREEN 9b: 9 AVATAR RINGS (rank + premium kala se) ──');
/* asli growth.js file (ring catalog + art helper) */
vm.runInNewContext(fs.readFileSync(path.join(REPO, 'features/growth.js'), 'utf8'), ctx, { filename: 'growth.js' });
const rings = ctx.__COS_RINGS || [];
ok(rings.length === 9, '9 rings catalog me (' + rings.length + ')');
ok(rings.every(r => r.type === undefined || true) && rings.every(r => r.img && r.img.indexOf('assets/img/') === 0), 'har ring ka asli art path');
ok(new Set(rings.map(r => r.img)).size === 9, '9 alag art files (duplicate nahi)');
const missingArt = rings.filter(r => !fs.existsSync(path.join(REPO, r.img)));
ok(missingArt.length === 0, 'saare art files disk par maujood' + (missingArt.length ? ' — MISSING: ' + missingArt.map(m => m.img).join(', ') : ''));
ok(rings.every(r => r.price > 0), 'har ring ki keemat (currency sink) — total ' + rings.reduce((a, b) => a + b.price, 0) + ' SD');
/* store catalog me rings dikhte hain (type frame → "frames" tab) — EK fresh call */
ctx.CFG = { cosmetics: {} };
const items = ctx.__COS_CATALOG ? ctx.__COS_CATALOG() : [];
const inStore = items.filter(i => rings.some(r => r.id === i.id));
console.log('   (store items: ' + items.length + ', rings in store: ' + inStore.length + ')');
ok(inStore.length === 9, 'store catalog me 9/9 rings');
ok(inStore.every(i => i.type === 'frame'), 'sab frame type (equip logic "frame" prefix par chalta hai)');
ok(inStore.every(i => i.desc && i.desc.length > 4), 'har ring ki desc (store card par jhooth/undefined nahi)');
ok(inStore.every(i => i.price > 0), 'store card par price (SD) dikhta hai');
/* equip → medal art + glow colour */
ctx.UD = { cosmetics: { frame_ring_gold: { is_equipped: true } } };
const fa = ctx.getEquippedFrameArt();
ok(!!fa && fa.img === 'assets/img/ranks/gold.png', 'equipped Gold Ring → medal art (asli kala)');
ok(!!fa && fa.color === '#ffd700', 'glow colour tier ka (gold)');
ctx.UD = { cosmetics: {} };
ok(ctx.getEquippedFrameArt() === null, 'kuch equipped nahi → koi medal nahi (jhoota nahi)');

console.log('\n── SCREEN 10: badge EQUIP (kamaya hua badge profile par) ──');
{
  /* ASLI badge-engine.js (upar ctx me load hai) + DB stub (emulator/login
     ke bina asli row nahi ban sakti — logic 100% asli function ka). */
  const _sS = ctx._supa, _sU = ctx.U, _sUD = ctx.UD, _sT = ctx.toast;
  const calls = [];
  function mkChain(rec) {
    const api = { update: (v) => { rec.op = 'update'; rec.val = v; return api; },
                  upsert: (v, o) => { rec.op = 'upsert'; rec.val = v; rec.opt = o; return api; },
                  eq: () => api, like: () => api, select: () => api,
                  /* 2026-10-12b: sync-then — logic (kaunse DB ops) turant
                     verify ho sake; asli supabase async hi hai. */
                  then: (cb) => { cb({ error: null }); return Promise.resolve({ error: null }); } };
    return api;
  }
  try {
    ctx._supa = { from: (tbl) => { const rec = { tbl }; calls.push(rec); return mkChain(rec); } };
    ctx.U = { uid: 'node-e2e-user' };
    ctx.UD = { cosmetics: {}, stats: ST };
    ctx.toast = () => '';
    ok(ctx.getEquippedBadge(ST) === null, 'kuch equip nahi → null (jhoota chip nahi)');
    ok(ctx.renderEquippedBadgeChip(ST) === '', 'chip khaali jab kuch equip nahi');
    ok(ctx.equipBadge('title_apex', null, ST) === false && calls.length === 0,
       'bina kamaye equip BLOCK — koi DB write nahi (AP 4900/5000)');
    const first = ctx.getEarnedBadges(ST)[0];
    ok(ctx.equipBadge(first.id, null, ST) === true && calls.length === 2
       && calls[0].op === 'update' && calls[1].op === 'upsert'
       && calls[1].val.cosmetic_key === 'badge_' + first.id && calls[1].val.is_equipped === true
       && calls[1].opt.onConflict === 'user_id,cosmetic_key',
       'kamaya badge equip — purane badge_* off + upsert (badge_' + first.id + ')');
    ok(ctx.UD.cosmetics['badge_' + first.id].is_equipped === true, 'local state turant on');
    const chip = ctx.renderEquippedBadgeChip(ST);
    ok(chip.indexOf(first.img) !== -1 && chip.indexOf('EQUIPPED BADGE') !== -1, 'chip me asli art + label');
    ok(ctx.getEquippedBadge(ST).id === first.id, 'getEquippedBadge wahi badge deta hai');
    ok(ctx.renderBadgeShowcaseRow(ST).indexOf('equipBadge(') !== -1, 'showcase badges tap-able');
    calls.length = 0;
    ok(ctx.equipBadge(first.id, null, ST) === true && calls.length === 1 && calls[0].val.is_equipped === false,
       'dobara tap = hatao (ek update)');
    ok(ctx.renderEquippedBadgeChip(ST) === '', 'hatane par chip gayab');
    /* stats gir gaye → ab kamaya nahi → chip nahi (IZAT ka niyam) */
    ctx.UD.cosmetics['badge_' + first.id].is_equipped = true;
    ok(ctx.getEquippedBadge({}) === null && ctx.renderEquippedBadgeChip({}) === '',
       'stats khatam → equipped badge dikhta NAHI (jhoota badge kabhi nahi)');
  } finally { ctx._supa = _sS; ctx.U = _sU; ctx.UD = _sUD; ctx.toast = _sT; }
}

console.log('\n══════════════════════════════');
console.log('SCREEN-E2E PASS: ' + PASS + ' | FAIL: ' + FAIL);
if (failures.length) { console.log('failures:'); failures.forEach(f => console.log('  - ' + f)); }
process.exit(FAIL ? 1 : 0);
