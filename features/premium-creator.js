/* ================================================================
   PREMIUM + CREATOR SYSTEM — premium-creator-system.js
   Mini eSports User Panel v12
   
   1. Streak Milestones (Day 7 / 30 / 100)
   2. Premium Enforcement (ad-free, early access, monthly bonus)
   3. Creator Dashboard (Blue Diamond commission)
   4. Achievements v3 (City King, Unstoppable, Veteran etc.)
   ================================================================ */

(function() {
'use strict';

function db()  { return window.db;  }
function uid() { return window.U && window.U.uid; }
function ud()  { return window.UD || {}; }

/* ================================================================
   1. STREAK MILESTONES
   ================================================================ */
/* ✅ BUG FIX (2026-08-24): "Streak Milestone popup har app refresh par
   aati hai aur 20 coin faltu me add ho jate hain". Root cause was
   twofold:
     1. This entire feature was still pure Firebase RTDB
        (db().ref(...).transaction(...)) — completely disconnected from
        the Supabase `users` row this app otherwise reads UD from. The
        claimed-flag was written to Firebase, but UD.streakMilestonesClaimed
        was never populated from anywhere (no such Supabase column
        existed, and _applyUser in listeners.js never read one) — so
        `claimed['day_3']` was ALWAYS empty on every single load,
        the `streak >= m.day` check passed again, and the Firebase
        transaction fired again, crediting +20 coins AGAIN — every load.
     2. initPremiumCreator() called this unconditionally on every app
        boot (3s after UD ready), not just after a genuine check-in —
        so even with claim-tracking fixed, this would still evaluate on
        every load (harmlessly, once actually idempotent, but wastefully).
   Fix: moved entirely to Supabase — streak_milestones_claimed JSONB
   column + a single atomic claim_streak_milestone RPC (same
   FOR-UPDATE-locked, check-and-set-in-one-transaction pattern as the
   already-correct purchase_cosmetic RPC) so concurrent/repeated calls
   can never double-credit. UD.streakMilestonesClaimed is now populated
   from the real Supabase column in listeners.js's _applyUser. */
window.checkStreakMilestones = function() {
  if (!uid() || !window._supa) return;
  var streak = Number(ud().loginStreak || 0);
  var claimed = ud().streakMilestonesClaimed || {};

  var _smCfg = (window.CFG && window.CFG.streakMilestones) || {};
  var MILESTONES = [3,7,14,30,60,100].map(function(d){
    var def = {3:{coins:20,badge:null},7:{coins:100,badge:'🔥 Unstoppable'},14:{coins:200,badge:null},30:{coins:500,badge:'⚡ Dedicated'},60:{coins:1000,badge:'👑 Legend'},100:{coins:2000,badge:'🌟 Immortal'}};
    var cfg = _smCfg[d] || def[d] || {coins:50,badge:null};
    return { day: d, coins: Number(cfg.coins||50), badge: cfg.badge||null, label: d+'-Day Streak!' };
  });

  MILESTONES.forEach(function(m) {
    if (streak >= m.day && !claimed['day_' + m.day]) {
      window._supa.rpc('claim_streak_milestone', {
        p_day: m.day, p_coins: m.coins, p_badge: m.badge
      }).then(function(r) {
        var res = r && r.data;
        if (r.error || !res || !res.ok) return; /* silent — no coins, no popup, safe to retry next load */
        if (!window.UD) window.UD = {};
        if (!window.UD.streakMilestonesClaimed) window.UD.streakMilestonesClaimed = {};
        window.UD.streakMilestonesClaimed['day_' + m.day] = true;
        if (res.already_claimed) return; /* someone else's call already claimed it — no popup, no re-credit */
        if (typeof res.new_balance === 'number') window.UD.coins = res.new_balance;
        if (window.updateHdr) window.updateHdr();
        setTimeout(function() { showStreakCelebration(m); }, 1000);
      }, function(){ /* network error — silent, safe to retry next load */ });
    }
  });
};

function showStreakCelebration(m) {
  var h = '<div style="text-align:center;padding:10px 0">';
  h += '<div style="font-size:56px;margin-bottom:12px">🔥</div>';
  h += '<div style="font-size:20px;font-weight:900;color:#ffd700;margin-bottom:6px">' + m.label + '</div>';
  h += '<div style="font-size:14px;color:var(--txt2);margin-bottom:16px">Login streak ' + m.day + ' din!</div>';
  h += '<div style="background:rgba(255,215,0,.08);border:1px solid rgba(255,215,0,.25);border-radius:14px;padding:14px;margin-bottom:14px">';
  h += '<div style="font-size:28px;font-weight:900;color:#ffd700">+' + m.coins + ' 🪙</div>';
  h += '<div style="font-size:12px;color:var(--txt2);margin-top:4px">Streak Bonus Coins</div>';
  if (m.badge) {
    h += '<div style="margin-top:8px;font-size:13px;font-weight:700;color:#b964ff">' + m.badge + ' badge mila!</div>';
  }
  h += '</div>';
  h += '<button onclick="if(window.closeModal)closeModal()" style="width:100%;padding:13px;border-radius:12px;background:linear-gradient(135deg,#ffd700,#ff8c00);border:none;color:#000;font-size:14px;font-weight:800;cursor:pointer">🎉 Awesome!</button>';
  h += '</div>';
  if (window.openModal) openModal('🔥 Streak Milestone!', h);
  if (window.updateHdr) window.updateHdr();
}

// Upgrade doCheckIn to call milestone check — lazy wrap on first call
var _checkInWrapped = false;
var _origDoCheckIn = null;
window._wrapCheckIn = function() {
  if (_checkInWrapped) return;
  _checkInWrapped = true;
  _origDoCheckIn = window.doCheckIn;
  window.doCheckIn = function() {
    if (_origDoCheckIn) _origDoCheckIn.apply(this, arguments);
    setTimeout(window.checkStreakMilestones, 800);
  };
};
// Will be called from init() after all scripts load

/* ================================================================
   2. PREMIUM ENFORCEMENT
   ================================================================ */
function getPremiumTier() {
  var p = ud().premium;
  /* BUG #4/#5/#29 FIX (2026-07): same root cause as getUserPremiumTier in premium.js —
     no .active field is ever populated, active status is derived from tier+expiry. */
  if (!p || !p.tier || p.tier <= 0) return 0;
  if (p.expiresAt && p.expiresAt < Date.now()) return 0;
  return Number(p.tier || p.premiumTier || 1);
}
window.getPremiumTier = getPremiumTier;
window.isPremium = function() { return getPremiumTier() > 0; };

// MONTHLY BONUS COINS — auto credit on login
/* ✅ BUG FIX (2026-08-22, CRITICAL): "Monthly Premium Bonus milta hai har
   app refresh par, jabki monthly hona chahiye". Root cause: the
   "already claimed this month" check/write used a fake Firebase-style
   bridge path (users/{uid}/premiumMonthlyBonus/{monthKey}) that has NO
   matching case in core/db-bridge.js's users/{uid}/{field} dispatch —
   it fell through to the generic "unmapped field, silently succeed"
   no-op. That means .once('value') always read back nothing (so the
   "already claimed" guard never actually blocked), and .set(true)
   persisted nothing (so there was never anything TO read back next
   time either). Net effect: the bonus paid out again on every single
   app load, forever. Fixed by moving both the claim-check AND the
   credit into one atomic Supabase RPC (claim_premium_monthly_bonus)
   backed by a UNIQUE(user_id, month_key) constraint — the DB itself
   now refuses a second claim in the same month, so this can't
   regress even if the bridge path is wrong for some other field too. */
window.checkPremiumMonthlyBonus = function() {
  if (!uid() || !window._supa) return;
  var tier = getPremiumTier();
  if (!tier) return;

  var _pm = window.CFG && window.CFG.premium && window.CFG.premium.bonuses;
  var bonusMap = _pm || { 1: 50, 2: 150, 3: 400 };
  var bonus = bonusMap[tier] || 0;
  if (!bonus) return;

  window._supa.rpc('claim_premium_monthly_bonus', { p_tier: tier, p_bonus_coins: bonus }).then(function(r) {
    var res = r && r.data;
    if (!res || !res.ok) return; // already claimed this month, or not authenticated — silent, expected
    if (window.UD) { window.UD.coins = (window.UD.coins || 0) + bonus; }
    var tierName = tier === 3 ? 'Diamond' : tier === 2 ? 'Gold' : 'Silver';
    toast('💎 ' + tierName + ' Monthly Bonus: +' + bonus + '🪙 Coins!', 'ok');
    if (window.updateHdr) window.updateHdr();
  }, function() { /* network error — silently skip, will retry next load */ });
};

// EARLY ACCESS — show matches 10 min early for premium
window.canSeeEarlyAccess = function(matchStartTime) {
  if (!getPremiumTier()) return false;
  var now = Date.now();
  var start = Number(matchStartTime) || 0;
  return (start - now) <= 10 * 60 * 1000; // 10 min window
};

// AD GATE — show interstitial before result, skip for premium
window.gateResultWithAd = function(callback) {
  if (isPremium()) {
    if (callback) callback();
    return;
  }
  // Show interstitial ad, then call callback
  if (window.admob && window.admob.showInterstitial) {
    try {
      window.admob.showInterstitial(function() {
        if (callback) callback();
      });
    } catch(e) {
      if (callback) callback();
    }
  } else if (window.AdManager && window.AdManager.showInterstitial) {
    try {
      window.AdManager.showInterstitial();
    } catch(e) {}
    setTimeout(function() { if (callback) callback(); }, 1000);
  } else {
    if (callback) callback();
  }
};

// PREMIUM STATUS CARD — shown in profile
window.renderPremiumCard = function() {
  var tier = getPremiumTier();
  var _pm = window.CFG && window.CFG.premium && window.CFG.premium.bonuses;
  var bonusMap = _pm || { 1: 50, 2: 150, 3: 400 };
  var nameMap  = { 1: 'Silver', 2: 'Gold', 3: 'Diamond' };
  var colorMap = { 1: '#ffd700', 2: '#00d4ff', 3: '#b964ff' };
  var _pp = window.CFG && window.CFG.premium && window.CFG.premium.prices;
  var priceMap = _pp ? {1:'₹'+_pp[1],2:'₹'+_pp[2],3:'₹'+_pp[3]} : { 1: '₹49', 2: '₹99', 3: '₹199' };

  if (!tier) {
    // Non-premium — show upgrade card
    var h = '<div style="background:linear-gradient(135deg,rgba(185,100,255,.08),rgba(255,215,0,.05));border:1.5px solid rgba(185,100,255,.2);border-radius:16px;padding:16px;margin-bottom:12px">';
    h += '<div style="font-size:13px;font-weight:800;color:#b964ff;margin-bottom:8px">👑 Premium Upgrade Karo</div>';
    h += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px">';
    [1,2,3].forEach(function(t) {
      h += '<div style="background:rgba(0,0,0,.3);border-radius:12px;padding:10px;text-align:center;cursor:pointer;border:1px solid rgba(255,255,255,.08)" onclick="window.showPremiumUpgrade&&showPremiumUpgrade(' + t + ')">';
      h += '<div style="font-size:13px;font-weight:900;color:' + colorMap[t] + '">' + nameMap[t] + '</div>';
      h += '<div style="font-size:16px;font-weight:900;color:#fff;margin:4px 0">' + priceMap[t] + '</div>';
      h += '<div style="font-size:10px;color:var(--txt2)">+' + bonusMap[t] + '🪙/mo</div>';
      h += '</div>';
    });
    h += '</div>';
    h += '<div style="font-size:11px;color:var(--txt2);line-height:1.7">✅ Ad-free results &nbsp;✅ Early match access<br>✅ Monthly bonus coins &nbsp;✅ Premium badge</div>';
    h += '</div>';
    return h;
  }

  // Premium user card
  var p = ud().premium || {};
  var expDate = p.expiresAt ? new Date(p.expiresAt).toLocaleDateString('en-IN') : 'Unknown';
  var col = colorMap[tier] || '#ffd700';
  var h = '<div style="background:linear-gradient(135deg,rgba(' + (tier===3?'185,100,255':tier===2?'0,212,255':'255,215,0') + ',.08),transparent);border:1.5px solid rgba(' + (tier===3?'185,100,255':tier===2?'0,212,255':'255,215,0') + ',.25);border-radius:16px;padding:16px;margin-bottom:12px">';
  h += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">';
  h += '<div style="font-size:14px;font-weight:900;color:' + col + '">👑 ' + nameMap[tier] + ' Premium</div>';
  h += '<div style="font-size:10px;color:var(--txt2)">Expires: ' + expDate + '</div>';
  h += '</div>';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">';
  [['🚫 Ads', 'Result se pehle ad nahi'], ['⚡ Early Access', '10 min pehle matches'], ['+' + bonusMap[tier] + '🪙', 'Monthly bonus'], ['💎 Badge', nameMap[tier] + ' profile badge']].forEach(function(f) {
    h += '<div style="background:rgba(0,0,0,.2);border-radius:10px;padding:8px;font-size:11px"><div style="font-weight:800;color:' + col + '">' + f[0] + '</div><div style="color:var(--txt2);margin-top:2px">' + f[1] + '</div></div>';
  });
  h += '</div></div>';
  return h;
};

/* ================================================================
   3. CREATOR DASHBOARD — Blue Diamond Commission Tracking
   ================================================================ */
/* ================================================================
   3. CREATOR PROGRAM (2026-08 full rewrite)
   Redesigned per product decision:
   - Commission triggers on REFERRED-USER SPEND in a paid match (Sky
     Diamonds), not on purchase. Enforced server-side in
     validate_and_join_match — see that RPC's migration notes. This
     file only reads/displays state; it never computes commission.
   - Admin creates all real-money matches (anti-fraud) — creators do
     NOT self-host matches. A creator's job is purely to refer players
     via their code/link; every match a referred player pays real Sky
     Diamonds to join earns the creator 25%, automatically, for as
     long as that player keeps playing — not a one-time payout.
   - Live-streaming your own gameplay/matches is a PREMIUM perk (see
     showPremiumInfo), not a Creator Program perk — a creator without
     Premium can still refer and earn, they just don't get the
     in-app live-stream slot unless they also subscribe.
   - Talks to the real Supabase tables directly (creator_codes,
     creator_stats, creator_commissions) instead of the old
     Firebase-RTDB-shaped db().ref(...) calls, which silently failed
     to sync because core/db-bridge.js never mapped `creatorProfile`
     at all (confirmed: grep of the bridge found zero handling for
     that path — every signup before this rewrite was writing to a
     dead end).
   ================================================================ */
window.showCreatorDashboard = function() {
  if (!uid() || !window._supa) { toast('Login karo pehle', 'err'); return; }

  window._supa.from('users').select('is_creator,creator_code,creator_rating,creator_rating_count,creator_strikes,creator_suspended_until,creator_suspended_permanently').eq('id', uid()).single().then(function(r) {
    var me = r.data || {};
    if (!me.is_creator) { showCreatorSignup(); return; }

    Promise.all([
      window._supa.from('creator_stats').select('*').eq('user_id', uid()).maybeSingle(),
      window._supa.from('creator_codes').select('*').eq('user_id', uid()).maybeSingle()
    ]).then(function(results) {
      var stats = (results[0] && results[0].data) || { total_matches: 0, total_earnings: 0 };
      var codeRow = (results[1] && results[1].data) || { code: me.creator_code || '' };
      renderCreatorDash(codeRow, stats, me);
    });
  });
};

function showCreatorSignup() {
  /* GATED (2026-08, confirmed by product decision): Creator Program is
     a Premium perk — you must already be a paying Premium member to
     apply. This makes sense two ways: (1) it filters signups to people
     who've already shown real intent/investment in the platform, and
     (2) it ties Premium's value directly to "this is how you unlock
     hosting your own matches + earning commission", not just cosmetic
     perks. Match-hosting privileges (creator_create_match RPC) don't
     independently re-check Premium status — being an approved creator
     already implies it, since approval only happens after this gate. */
  var _premActive = window.isPremiumActive ? isPremiumActive(2) : false;
  if (!_premActive) {
    var gh = '<div style="text-align:center;padding:8px 0">';
    gh += '<div style="font-size:48px;margin-bottom:12px">👑</div>';
    gh += '<div style="font-size:17px;font-weight:900;margin-bottom:8px">Gold Premium Chahiye</div>';
    gh += '<div style="font-size:13px;color:var(--txt2);line-height:1.7;margin-bottom:18px">Creator Program — apne matches host karo, referral commission kamao — ye ek <strong style="color:#ffd700">Gold ya usse upar</strong> Premium perk hai.</div>';
    gh += '<button onclick="if(window.closeModal)closeModal();if(window.showPremiumUpgrade)showPremiumUpgrade();" style="width:100%;padding:14px;border-radius:12px;background:linear-gradient(135deg,#ffd700,#ff8c00);border:none;color:#000;font-size:14px;font-weight:800;cursor:pointer">👑 Premium Dekho</button>';
    gh += '</div>';
    if (window.openModal) openModal('🔵 Creator Program', gh);
    return;
  }

  /* ✅ BUG FIX (2026-08-23): "Creator Program Join pe click karne par
     'ye code pehle se liya hua hai' error aata hai jabki code naya
     hota hai". Root cause: creator_applications has UNIQUE(user_id),
     NOT unique(creator_code) — the 23505 conflict fires when the SAME
     USER already has an application row (any status), regardless of
     what code they type this time. submitCreatorSignup's error-message
     mapping wrongly assumed any 23505 meant "code taken", which is
     never actually what that constraint checks. This showed up for a
     real user who genuinely had a pending application from a previous
     day — the fresh code they typed the second time was never the
     problem. Fix: check for an existing application FIRST and show its
     real status instead of a blank signup form the user can never
     successfully submit through. */
  window._supa.from('creator_applications').select('creator_code,status,created_at').eq('user_id', uid()).maybeSingle().then(function(ar) {
    if (ar.data) {
      var app = ar.data;
      var statusLabel = app.status === 'pending' ? '⏳ Pending review'
                       : app.status === 'rejected' ? '❌ Rejected'
                       : app.status;
      var ph = '<div style="text-align:center;padding:8px 0">';
      ph += '<div style="font-size:48px;margin-bottom:12px">📋</div>';
      ph += '<div style="font-size:17px;font-weight:900;margin-bottom:8px">Application Already Submitted</div>';
      ph += '<div style="background:rgba(0,212,255,.06);border:1px solid rgba(0,212,255,.2);border-radius:14px;padding:14px;margin-bottom:16px;text-align:left">';
      ph += '<div style="font-size:12px;color:var(--txt2)">Code</div><div style="font-size:16px;font-weight:800;color:#00d4ff;margin-bottom:8px">' + (app.creator_code || '') + '</div>';
      ph += '<div style="font-size:12px;color:var(--txt2)">Status</div><div style="font-size:14px;font-weight:800">' + statusLabel + '</div>';
      ph += '</div>';
      if (app.status === 'pending') {
        ph += '<div style="font-size:12px;color:var(--txt2)">Admin 24hr mein review karega. Yahan naya application submit nahi ho sakta jab tak yeh resolve na ho.</div>';
      } else if (app.status === 'rejected') {
        ph += '<button onclick="if(window._supa)window._supa.from(\'creator_applications\').delete().eq(\'user_id\',\''+uid()+'\').then(function(){if(window.closeModal)closeModal();showCreatorSignup();})" style="width:100%;padding:14px;border-radius:12px;background:linear-gradient(135deg,#0066ff,#00d4ff);border:none;color:#fff;font-size:14px;font-weight:800;cursor:pointer">🔄 Dobara Apply Karo</button>';
      }
      ph += '</div>';
      if (window.openModal) openModal('🔵 Creator Program', ph);
      return;
    }
    _renderCreatorSignupForm();
  }, function() { _renderCreatorSignupForm(); });
}

function _renderCreatorSignupForm() {

  var h = '<div style="text-align:center;padding:8px 0">';
  h += '<div style="font-size:48px;margin-bottom:12px">🔵</div>';
  h += '<div style="font-size:17px;font-weight:900;margin-bottom:8px">Creator Ban Jao!</div>';
  h += '<div style="font-size:13px;color:var(--txt2);line-height:1.7;margin-bottom:16px">';
  h += 'Apne YouTube/Instagram followers ko Mini eSports pe lao apne code se.<br>';
  h += 'Jab woh <strong style="color:#00d4ff">Sky Diamonds kharch karke paid match khelte hain</strong>, tumhe har match pe <strong style="color:#00d4ff">25% commission</strong> milta hai!';
  h += '</div>';
  h += '<div style="background:rgba(0,212,255,.06);border:1px solid rgba(0,212,255,.2);border-radius:14px;padding:14px;margin-bottom:16px;text-align:left">';
  h += '<div style="font-size:12px;font-weight:700;color:#00d4ff;margin-bottom:8px">💰 Kaise kaam karta hai</div>';
  h += '<div style="font-size:12px;color:var(--txt2);line-height:1.9">';
  h += '1️⃣ Apna code banao, followers ko share karo<br>';
  h += '2️⃣ Woh signup pe tumhara code daalte hain<br>';
  h += '3️⃣ Jab bhi woh Sky Diamonds se ek paid match join karte hain, tumhe 25% milta hai — <strong style="color:#00ff9c">sirf ek baar nahi, har match pe jab tak woh khelte rahenge</strong><br>';
  h += '4️⃣ Apna khud ka chhota tournament bhi host kar sakte ho — room set karo, result submit karo';
  h += '</div>';
  h += '<div style="font-size:10px;color:var(--txt2);margin-top:8px;padding-top:8px;border-top:1px solid rgba(0,212,255,.15)">ℹ️ Sirf khareedne se commission nahi milta — referral ko real match khelna hoga. Result submit hote hi auto-verify hota hai; sirf suspicious cases Admin dekhta hai.</div>';
  h += '</div>';
  h += '<div class="f-group"><label>Apna Creator Code banao</label>';
  h += '<input type="text" id="newCreatorCode" class="f-input" placeholder="e.g. BEAST_GAMER (letters + _ only)" style="text-transform:uppercase"></div>';
  h += '<div class="f-group"><label>YouTube / Instagram Channel Link</label>';
  h += '<input type="text" id="creatorChannelUrl" class="f-input" placeholder="https://youtube.com/@..."></div>';
  h += '<div class="f-group"><label>Approximate Followers</label>';
  h += '<select id="creatorFollowers" class="f-input"><option value="1k-5k">1K–5K</option><option value="5k-10k">5K–10K</option><option value="10k-50k">10K–50K</option><option value="50k+">50K+</option></select></div>';
  h += '<button onclick="submitCreatorSignup()" style="width:100%;padding:14px;border-radius:12px;background:linear-gradient(135deg,#0066ff,#00d4ff);border:none;color:#fff;font-size:14px;font-weight:800;cursor:pointer"><i class="fas fa-rocket"></i> Creator Program Join Karo</button>';
  h += '</div>';
  if (window.openModal) openModal('🔵 Creator Program', h);
}

window.submitCreatorSignup = function() {
  var code    = ((document.getElementById('newCreatorCode')||{}).value||'').toUpperCase().trim().replace(/[^A-Z0-9_]/g,'');
  var channel = ((document.getElementById('creatorChannelUrl')||{}).value||'').trim();
  var followers = ((document.getElementById('creatorFollowers')||{}).value||'1k-5k');

  if (!code || code.length < 4) { toast('Code min 4 characters (letters + _ only)', 'err'); return; }
  if (!channel) { toast('Channel URL daalo', 'err'); return; }
  if (!window._supa) { toast('Service unavailable', 'err'); return; }

  window._supa.from('creator_applications').insert({
    user_id: uid(), creator_code: code, status: 'pending'
  }).then(function(r) {
    if (r.error) {
      /* ✅ BUG FIX (2026-08-23): creator_applications has UNIQUE(user_id),
         not unique(creator_code) — a 23505 here means the user already
         has an application (from a race with a second tap, since the
         normal case is now caught earlier by showCreatorSignup's
         pre-check), not that the CODE they typed is taken by someone
         else. The old message ("ye code pehle se liya hua hai") was
         actively misleading users into retyping a different code that
         was never going to fix anything. */
      var msg = r.error.code === '23505' ? 'Aapka application already submit ho chuka hai' : (r.error.message || 'Submit failed');
      toast(msg, 'err');
      return;
    }
    if (window.closeModal) closeModal();
    toast('✅ Creator request submit ho gayi! Admin 24hr mein approve karega.', 'ok');
  });
};

function renderCreatorDash(codeRow, stats, me) {
  var h = '';
  var code = codeRow.code || '';
  me = me || {};

  // Suspension banner — clear, upfront, tells the creator exactly why
  // and for how long, instead of them silently failing to host.
  var _permBan = me.creator_suspended_permanently;
  var _tempSuspend = me.creator_suspended_until && new Date(me.creator_suspended_until) > new Date();
  if (_permBan) {
    h += '<div style="background:rgba(255,60,60,.1);border:1.5px solid rgba(255,60,60,.35);border-radius:14px;padding:14px;margin-bottom:14px;text-align:center">';
    h += '<div style="font-size:14px;font-weight:800;color:#ff6b6b">🚫 Permanently Banned</div>';
    h += '<div style="font-size:12px;color:var(--txt2);margin-top:6px">Repeated cheating ke wajah se Creator Program se permanently ban kar diya gaya hai.</div></div>';
  } else if (_tempSuspend) {
    h += '<div style="background:rgba(255,170,0,.08);border:1.5px solid rgba(255,170,0,.3);border-radius:14px;padding:14px;margin-bottom:14px;text-align:center">';
    h += '<div style="font-size:14px;font-weight:800;color:#ffaa00">⏸️ Hosting Suspended</div>';
    h += '<div style="font-size:12px;color:var(--txt2);margin-top:6px">' + new Date(me.creator_suspended_until).toLocaleDateString('en-IN') + ' tak match host nahi kar sakte. Strikes: ' + (me.creator_strikes||0) + '/6.</div></div>';
  } else if ((me.creator_strikes||0) > 0) {
    h += '<div style="background:rgba(255,215,0,.06);border:1px solid rgba(255,215,0,.2);border-radius:12px;padding:10px 12px;margin-bottom:12px;font-size:11px;color:#ffd700">⚠️ ' + me.creator_strikes + '/6 strikes — 3 strikes pe hosting 30 din suspend hoti hai.</div>';
  }

  // Rating summary
  var _rating = Number(me.creator_rating || 5);
  var _stars = ''; for (var si=1; si<=5; si++) _stars += (si <= Math.round(_rating) ? '★' : '☆');
  h += '<div style="text-align:center;margin-bottom:12px"><span style="color:#ffd700;font-size:15px">' + _stars + '</span> <span style="font-size:11px;color:#888">' + _rating.toFixed(1) + ' (' + (me.creator_rating_count||0) + ' ratings)</span></div>';

  // Creator code card
  h += '<div style="background:linear-gradient(135deg,rgba(0,100,255,.08),rgba(0,212,255,.05));border:1.5px solid rgba(0,212,255,.25);border-radius:16px;padding:16px;margin-bottom:14px">';
  h += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">';
  h += '<div style="font-size:13px;font-weight:800;color:#00d4ff">🔵 Creator Code</div><span style="color:#00ff9c;font-weight:700;font-size:12px">✅ Active</span>';
  h += '</div>';
  h += '<div style="font-size:28px;font-weight:900;color:#fff;letter-spacing:3px;margin-bottom:6px">' + code + '</div>';
  h += '<div style="font-size:11px;color:var(--txt2)">Followers signup pe ye code daalein — commission tabhi milega jab woh paid match khelenge</div>';
  h += '<button onclick="copyCreatorCode(\'' + code + '\')" style="margin-top:8px;padding:7px 14px;border-radius:10px;background:rgba(0,212,255,.12);border:1px solid rgba(0,212,255,.25);color:#00d4ff;font-size:12px;font-weight:700;cursor:pointer"><i class="fas fa-copy"></i> Code Copy</button>';
  h += '</div>';

  // Stats grid — tied to real creator_stats columns (total_matches, total_earnings)
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">';
  [
    { label: 'Referred Matches Played', val: stats.total_matches||0, unit: 'matches', color: '#00d4ff' },
    { label: 'Total Commission', val: '💎'+(stats.total_earnings||0), unit: 'earned (25%/match)', color: '#00ff9c' },
  ].forEach(function(s) {
    h += '<div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:12px">';
    h += '<div style="font-size:10px;color:var(--txt2);margin-bottom:4px">' + s.label + '</div>';
    h += '<div style="font-size:20px;font-weight:900;color:' + s.color + '">' + s.val + '</div>';
    h += '<div style="font-size:10px;color:#555">' + s.unit + '</div></div>';
  });
  h += '</div>';

  // Share link
  var shareLink = 'https://deepsilence10161-source.github.io/ff-user-panel/?ref=' + code;
  var shareMsg = '🎮 Mini eSports pe Free Fire tournaments!\n🪙 Free coins, ranked matches!\n\nMere code se join karo: ' + code + '\n👉 ' + shareLink;

  h += '<div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:12px;margin-bottom:10px">';
  h += '<div style="font-size:11px;color:var(--txt2);margin-bottom:6px">Tumhara Referral Link</div>';
  h += '<div style="font-size:11px;color:#00d4ff;word-break:break-all">' + shareLink + '</div>';
  h += '</div>';

  h += '<button onclick="doShareCreatorLink(\'' + encodeURIComponent(shareMsg) + '\')" style="width:100%;padding:13px;border-radius:12px;background:linear-gradient(135deg,#25d366,#128c7e);border:none;color:#fff;font-size:13px;font-weight:800;cursor:pointer;margin-bottom:10px"><i class="fab fa-whatsapp"></i> Promote on WhatsApp</button>';

  h += '<button onclick="showCreatorEarnings()" style="width:100%;padding:11px;border-radius:11px;background:rgba(185,100,255,.08);border:1px solid rgba(185,100,255,.2);color:#b964ff;font-size:12px;font-weight:700;cursor:pointer;margin-bottom:8px">📊 Commission History Dekho</button>';

  // Match Hosting (2026-08 reinstated, secure RPC-backed — see
  // features/creator-match-host.js for the security model). Lets the
  // creator run their own small-stakes matches instead of only ever
  // referring players into admin-run ones.
  h += '<div style="height:1px;background:rgba(255,255,255,.07);margin:14px 0"></div>';
  h += '<div style="font-size:13px;font-weight:800;color:#00ff9c;margin-bottom:8px">🎮 Match Hosting</div>';
  h += '<div style="font-size:11px;color:var(--txt2);margin-bottom:10px">Apna khud ka chhota tournament host karo — room set karo, result submit karo. Payout Admin verify karke karega.</div>';
  if (_permBan || _tempSuspend) {
    h += '<button disabled style="width:100%;padding:11px;border-radius:11px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);color:#555;font-size:13px;font-weight:700;cursor:not-allowed">🔒 Hosting Unavailable</button>';
  } else {
    h += '<button onclick="if(window.closeModal)closeModal();if(window.showCreatorMatchForm)showCreatorMatchForm();" style="width:100%;padding:11px;border-radius:11px;background:rgba(0,255,156,.08);border:1px solid rgba(0,255,156,.2);color:#00ff9c;font-size:13px;font-weight:700;cursor:pointer;margin-bottom:8px">➕ Naya Match Host Karo</button>';
    h += '<button onclick="if(window.closeModal)closeModal();if(window.showMyCreatorMatches)showMyCreatorMatches();" style="width:100%;padding:11px;border-radius:11px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);color:#aaa;font-size:12px;font-weight:700;cursor:pointer">📋 Mere Matches</button>';
  }

  var _premActive = window.isPremiumActive ? isPremiumActive(2) : false;
  h += '<div style="height:1px;background:rgba(255,255,255,.07);margin:14px 0"></div>';
  h += '<div style="font-size:13px;font-weight:800;color:#ff6b35;margin-bottom:8px">📡 Live Stream Slot</div>';
  if (_premActive) {
    h += '<div style="font-size:12px;color:var(--txt2);margin-bottom:10px">Premium member ho — apna live stream link app mein dikha sakte ho, apna YouTube watch-time badhao!</div>';
    h += '<button onclick="if(window.closeModal)closeModal();if(window.showStreamSettings)showStreamSettings();" style="width:100%;padding:11px;border-radius:11px;background:rgba(255,107,53,.1);border:1px solid rgba(255,107,53,.25);color:#ff6b35;font-size:13px;font-weight:700;cursor:pointer">🎥 Live Stream Setup</button>';
  } else {
    h += '<div style="font-size:12px;color:var(--txt2);margin-bottom:10px">Apni live stream ka link app mein dikhana chahte ho (apna YouTube watch-time badhane ke liye)? Ye ek <strong style="color:#ffd700">Premium</strong> perk hai.</div>';
    h += '<button onclick="if(window.closeModal)closeModal();if(window.showPremiumUpgrade)showPremiumUpgrade();" style="width:100%;padding:11px;border-radius:11px;background:rgba(255,215,0,.08);border:1px solid rgba(255,215,0,.25);color:#ffd700;font-size:13px;font-weight:700;cursor:pointer">👑 Premium Dekho</button>';
  }

  if (window.openModal) openModal('🔵 Creator Dashboard', h);
}

window.copyCreatorCode = function(code) {
  if (navigator.clipboard) navigator.clipboard.writeText(code);
  toast('Code copy ho gaya! 🎉', 'ok');
};

window.doShareCreatorLink = function(encodedMsg) {
  window.openWhatsApp(decodeURIComponent(encodedMsg));
};

window.showCreatorEarnings = function() {
  if (!uid() || !window._supa) return;
  var h = '<div id="_credEarnBody" style="text-align:center;padding:20px;color:var(--txt2)"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';
  if (window.openModal) openModal('📊 Commission History', h);
  window._supa.from('creator_commissions').select('*').eq('creator_uid', uid()).order('created_at', { ascending: false }).limit(50)
    .then(function(r) {
      var rows = r.data || [];
      var body = document.getElementById('_credEarnBody');
      if (!body) return;
      if (!rows.length) { body.innerHTML = '<div style="padding:10px;font-size:13px">Abhi tak koi commission nahi aayi</div>'; return; }
      var bh = '';
      rows.forEach(function(c) {
        var statusColor = c.status === 'eligible' || c.status === 'paid' ? '#00ff9c' : '#ffd700';
        var statusLabel = c.status === 'hold' ? 'Hold (7 din)' : c.status === 'eligible' ? 'Eligible' : c.status === 'paid' ? 'Paid' : c.status;
        bh += '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.05)">';
        bh += '<div><div style="font-size:12px;font-weight:700">Match Commission</div><div style="font-size:10px;color:#666">' + new Date(c.created_at).toLocaleDateString('en-IN') + '</div></div>';
        bh += '<div style="text-align:right"><div style="font-size:14px;font-weight:800;color:#00d4ff">+' + c.amount + ' 💎</div><div style="font-size:10px;color:' + statusColor + '">' + statusLabel + '</div></div>';
        bh += '</div>';
      });
      body.innerHTML = bh;
    }, function() {
      var body = document.getElementById('_credEarnBody');
      if (body) body.innerHTML = '<div style="padding:10px;font-size:13px;color:#ff6b6b">Load failed</div>';
    });
};

/* ================================================================
   4. ACHIEVEMENTS V3 — City King + Unstoppable + Enhanced
   ================================================================ */
var ACHIEVEMENTS_V3_EXTRA = [
  {
    id: 'city_king', icon: '🌆', title: 'City King',
    desc: 'Apni city mein 3 baar #1 rank lo',
    check: function() { return Number((ud().stats||{}).cityTopOneCount||0) >= 3; }
  },
  {
    id: 'unstoppable', icon: '🔥', title: 'Unstoppable',
    desc: '7-day login streak maintain karo',
    check: function() { return Number(ud().loginStreak||0) >= 7; }
  },
  {
    id: 'veteran', icon: '🎖️', title: 'Veteran',
    desc: '100 matches complete karo',
    check: function() { return Number((ud().stats||{}).matches||0) >= 100; }
  },
  {
    id: 'slayer', icon: '⚡', title: 'Slayer',
    desc: '500 total kills karo',
    check: function() { return Number((ud().stats||{}).kills||0) >= 500; }
  },
  {
    id: 'legend', icon: '👑', title: 'Legend',
    desc: '50 matches jeeto',
    check: function() { return Number((ud().stats||{}).wins||0) >= 50; }
  },
  {
    id: 'recruiter', icon: '🤝', title: 'Recruiter',
    desc: '10 friends refer karo',
    check: function() { return Number(ud().referralCount||0) >= 10; }
  },
  {
    id: 'wealthy', icon: '💎', title: 'Diamond Hoarder',
    desc: '1000 Green Diamonds kamao',
    check: function() { return Number(ud().greenDiamonds||0) >= 1000; }
  },
  {
    id: 'clan_chief', icon: '⚔️', title: 'Clan Chief',
    desc: 'Clan banao aur 5 members rakho',
    check: function() { var c = ud().clan; return c && c.isLeader && Number(c.memberCount||0) >= 5; }
  },
];

window.checkAndAwardAchievements = function() {
  if (!uid() || !db()) return;
  var owned = ud().achievementsV3 || {};

  ACHIEVEMENTS_V3_EXTRA.forEach(function(a) {
    if (owned[a.id]) return; // already awarded
    try {
      if (a.check && a.check()) {
        db().ref('users/' + uid() + '/achievementsV3/' + a.id).set({ awardedAt: Date.now() });
        db().ref('users/' + uid() + '/coins').transaction(function(v){ return (v||0) + 50; });
        showAchievementPopup(a);
      }
    } catch(e) {}
  });
};

window.showAchievementsV3 = function() {
  var owned = ud().achievementsV3 || {};
  var h = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">';
  ACHIEVEMENTS_V3_EXTRA.forEach(function(a) {
    var isOwned = !!owned[a.id];
    var unlocked = false;
    try { unlocked = a.check && a.check(); } catch(e) {}
    h += '<div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,' + (isOwned?'.2':'.06') + ');border-radius:14px;padding:12px;text-align:center;opacity:' + (isOwned?'1':unlocked?'.9':'.45') + '">';
    h += '<div style="font-size:30px;margin-bottom:6px">' + a.icon + '</div>';
    h += '<div style="font-size:12px;font-weight:800;color:' + (isOwned?'#ffd700':'var(--txt)') + '">' + a.title + '</div>';
    h += '<div style="font-size:10px;color:var(--txt2);margin-top:4px;line-height:1.4">' + a.desc + '</div>';
    if (isOwned) h += '<div style="margin-top:6px;font-size:10px;color:#00ff9c;font-weight:700">✅ Earned</div>';
    else if (unlocked) h += '<div style="margin-top:6px;font-size:10px;color:#ffd700;font-weight:700">🎉 Claim!</div>';
    h += '</div>';
  });
  h += '</div>';
  if (window.openModal) openModal('🏅 Achievements', h);
};

function showAchievementPopup(a) {
  var h = '<div style="text-align:center;padding:8px 0">';
  h += '<div style="font-size:56px;margin-bottom:12px">' + a.icon + '</div>';
  h += '<div style="font-size:18px;font-weight:900;color:#ffd700;margin-bottom:6px">Achievement Unlock!</div>';
  h += '<div style="font-size:22px;font-weight:900;margin-bottom:6px">' + a.title + '</div>';
  h += '<div style="font-size:13px;color:var(--txt2);margin-bottom:16px">' + a.desc + '</div>';
  h += '<div style="background:rgba(255,215,0,.08);border:1px solid rgba(255,215,0,.2);border-radius:12px;padding:10px;margin-bottom:14px">';
  h += '<div style="font-size:22px;font-weight:900;color:#ffd700">+50 🪙</div>';
  h += '<div style="font-size:11px;color:var(--txt2);margin-top:3px">Achievement Bonus</div></div>';
  h += '<button onclick="if(window.closeModal)closeModal()" style="width:100%;padding:12px;border-radius:12px;background:linear-gradient(135deg,#ffd700,#ff8c00);border:none;color:#000;font-size:14px;font-weight:800;cursor:pointer">🔥 Let\'s Go!</button>';
  h += '</div>';
  setTimeout(function() {
    if (window.openModal) openModal('🏅 New Achievement!', h);
    if (window.updateHdr) window.updateHdr();
  }, 1500);
}

/* ================================================================
   INIT — run on app ready
   ================================================================ */
function initPremiumCreator() {
  if (!window.db || !window.U || !window.UD) {
    setTimeout(initPremiumCreator, 1500);
    return;
  }
  // Run checks after small delay so UD is fully loaded
  setTimeout(function() {
    window._wrapCheckIn && window._wrapCheckIn();
    window.checkPremiumMonthlyBonus && window.checkPremiumMonthlyBonus();
    window.checkStreakMilestones    && window.checkStreakMilestones();
    window.checkAndAwardAchievements && window.checkAndAwardAchievements();
  }, 3000);
  console.log('✅ premium-creator-system.js loaded');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function(){ setTimeout(initPremiumCreator, 2000); });
} else {
  setTimeout(initPremiumCreator, 2000);
}

window._premiumCreatorInitFn = initPremiumCreator;
window.initPremiumCreator    = initPremiumCreator; /* ✅ inside IIFE scope */

/* ================================================================
   CREATOR VIDEO UPLOAD FORM (C2)
   ================================================================ */
window.showCreatorVideoUpload = function() {
  var platforms = (window.CFG && window.CFG.videoAllowedPlatforms) || 'both';
  var placeholderHint = platforms === 'youtube'   ? 'https://youtube.com/watch?v=...'
                      : platforms === 'instagram' ? 'https://www.instagram.com/reel/...'
                      : 'YouTube ya Instagram link';

  var h = '<div style="padding:4px 0">';
  h += '<div class="f-group"><label>🔗 Video Link</label>';
  h += '<input type="url" id="cvLink" class="f-input" placeholder="' + placeholderHint + '"></div>';
  h += '<div class="f-group"><label>📝 Title (max 60 characters)</label>';
  h += '<input type="text" id="cvTitle" class="f-input" maxlength="60" placeholder="Video ka title"></div>';
  h += '<div class="f-group"><label>📄 Description (max 200 characters)</label>';
  h += '<textarea id="cvDesc" class="f-input" maxlength="200" rows="3" placeholder="Short description..."></textarea></div>';
  h += '<div style="font-size:11px;color:#888;margin-bottom:14px">✅ Platform allowed: ' + (platforms === 'both' ? 'YouTube + Instagram' : platforms) + '</div>';
  h += '<button onclick="submitCreatorVideo()" style="width:100%;padding:13px;border-radius:12px;background:linear-gradient(135deg,#ff6b35,#ff3d00);border:none;color:#fff;font-size:14px;font-weight:800;cursor:pointer">📤 Video Share Karo</button>';
  h += '</div>';
  if (window.openModal) openModal('📹 New Video Share', h);
};

window.submitCreatorVideo = function() {
  var link  = ((document.getElementById('cvLink') ||{}).value||'').trim();
  var title = ((document.getElementById('cvTitle')||{}).value||'').trim();
  var desc  = ((document.getElementById('cvDesc') ||{}).value||'').trim();

  if (!link || !title) { toast('Link aur title required hain.', 'err'); return; }

  // Platform validation
  var platforms = (window.CFG && window.CFG.videoAllowedPlatforms) || 'both';
  var isYT  = /youtube\.com|youtu\.be/.test(link);
  var isIG  = /instagram\.com/.test(link);
  if (platforms === 'youtube'   && !isYT) { toast('Sirf YouTube links allowed hain.', 'err'); return; }
  if (platforms === 'instagram' && !isIG) { toast('Sirf Instagram links allowed hain.', 'err'); return; }
  if (platforms === 'both'      && !isYT && !isIG) { toast('Sirf YouTube ya Instagram links allowed hain.', 'err'); return; }

  // Client-side keyword filter (Layer 2)
  var bannedKw = (window.CFG && window.CFG.videoBannedKeywords) || [];
  var combined = (title + ' ' + desc).toLowerCase();
  for (var i = 0; i < bannedKw.length; i++) {
    if (bannedKw[i] && combined.indexOf(bannedKw[i].toLowerCase()) !== -1) {
      toast('Yeh content hamari community guidelines ke against hai. Title/Description theek karo.', 'err');
      return;
    }
  }

  var platform  = isYT ? 'youtube' : 'instagram';
  var creatorId = uid();
  if (!creatorId || !db()) { toast('Login required.', 'err'); return; }

  var videoId  = db().ref('creatorVideos').push().key;
  var videoData = {
    creatorUid:  creatorId,
    title:       title,
    description: desc,
    link:        link,
    platform:    platform,
    status:      'live',
    reportCount: 0,
    createdAt:   Date.now(),
  };

  db().ref('creatorVideos/' + videoId).set(videoData, function(err) {
    if (err) { toast('Error: ' + err.message, 'err'); return; }

    // Mirror to Supabase creator_videos
    if (window._supa) {
      window._supa.from('creator_videos').insert({
        firebase_id:  videoId,
        creator_uid:  creatorId,
        title:        title,
        description:  desc,
        link:         link,
        platform:     platform,
        status:       'live',
        report_count: 0,
        created_at:   new Date().toISOString(),
      }).then(null, function(e){ console.warn('[Creator] Supabase video insert error:', e.message); });
    }

    toast('✅ Video live ho gaya! 🎉', 'ok');
    if (window.closeModal) closeModal();
  });
};

/* ================================================================
   MY CREATOR VIDEOS LIST
   ================================================================ */
window.showMyCreatorVideos = function() {
  if (!uid() || !db()) return;
  db().ref('creatorVideos').orderByChild('creatorUid').equalTo(uid()).limitToLast(20)
    .once('value', function(snap) {
      var videos = [];
      snap.forEach(function(c){ var v = c.val(); v._id = c.key; videos.push(v); });
      videos.sort(function(a,b){ return (b.createdAt||0) - (a.createdAt||0); });

      var h = '<div style="display:grid;gap:10px">';
      if (!videos.length) {
        h += '<div style="text-align:center;color:#888;padding:20px">Koi video nahi hai abhi.</div>';
      } else {
        videos.forEach(function(v) {
          var statusColor = v.status === 'live' ? '#00ff9c' : v.status === 'auto_hidden' ? '#ffd700' : '#ff6b6b';
          var statusText  = v.status === 'live' ? '✅ Live' : v.status === 'auto_hidden' ? '⚠️ Hidden (' + v.reportCount + ' reports)' : '🚫 Removed';
          h += '<div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:12px">';
          h += '<div style="font-size:13px;font-weight:700;color:#fff;margin-bottom:4px">' + v.title + '</div>';
          h += '<div style="font-size:11px;color:' + statusColor + ';margin-bottom:4px">' + statusText + '</div>';
          h += '<a href="' + v.link + '" target="_blank" style="font-size:11px;color:#00d4ff">' + v.link.slice(0,40) + '...</a>';
          h += '</div>';
        });
      }
      h += '</div>';
      if (window.openModal) openModal('📹 Mere Videos', h);
    });
};

/* ================================================================
   CREATOR MATCH FORM (C3) — delegated to creator-match-host.js
   ================================================================ */
// showCreatorMatchForm(), showMyCreatorMatches() — defined in creator-match-host.js

/* ================================================================
   CREATOR EARNINGS VIEW (C4)
   ================================================================ */
window.showCreatorEarnings = function() {
  if (!uid() || !db()) return;
  db().ref('creatorCommission/' + uid()).limitToLast(20)
    .once('value', function(snap) {
      var list = [];
      snap.forEach(function(c){ var v = c.val(); v._key = c.key; list.push(v); });
      list.sort(function(a,b){ return (b.createdAt||0) - (a.createdAt||0); });

      var h = '';
      if (!list.length) {
        h = '<div style="text-align:center;color:#888;padding:20px">Koi commission history nahi abhi.\n\nPehle match host karo aur complete karo!</div>';
      } else {
        h = '<div style="display:grid;gap:8px">';
        list.forEach(function(c) {
          var stColor = c.status === 'paid' ? '#00ff9c' : c.status === 'eligible' ? '#ffd700' : '#aaa';
          var stLabel = c.status === 'paid' ? '✅ Paid' : c.status === 'eligible' ? '💰 Eligible' : '🔒 Hold';
          var dtStr   = c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-IN') : '';
          var eligStr = c.eligibleAt && c.status === 'hold' ? ' (eligible: ' + new Date(c.eligibleAt).toLocaleDateString('en-IN') + ')' : '';
          var amtStr  = c.currency === 'gd' ? c.amount + ' 🟢 GD' : '₹' + (c.amount||0);

          h += '<div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:10px;display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center">';
          h += '<div>';
          h += '<div style="font-size:11px;color:#888">Match: ' + (c.matchId||'').slice(0,8) + '... · ' + dtStr + '</div>';
          h += '<div style="font-size:10px;color:' + stColor + '">' + stLabel + eligStr + '</div>';
          h += '</div>';
          h += '<div style="font-size:15px;font-weight:900;color:#b964ff">' + amtStr + '</div>';
          h += '</div>';
        });

        // Eligible payout button for INR commissions
        var eligInr = list.filter(function(c){ return c.status === 'eligible' && c.currency === 'inr'; })
                         .reduce(function(s,c){ return s + (c.amount||0); }, 0);
        if (eligInr >= ((window.CFG && window.CFG.creatorMinPayout) || 100)) {
          h += '<button onclick="requestMatchCommissionPayout(' + eligInr + ')" style="width:100%;margin-top:10px;padding:12px;border-radius:11px;background:linear-gradient(135deg,#00ff9c,#00cc7a);border:none;color:#000;font-size:13px;font-weight:800;cursor:pointer">💰 ₹' + eligInr + ' Payout Request</button>';
        }
        h += '</div>';
      }
      if (window.openModal) openModal('💰 Commission Earnings', h);
    });
};

window.requestMatchCommissionPayout = function(amount) {
  if (!uid() || !db()) return;
  if (!confirm('₹' + amount + ' match commission payout request karo?')) return;
  db().ref('creatorPayouts').push({
    uid: uid(), ign: ud().ign||'', amount: amount,
    type: 'match_commission', status: 'pending', createdAt: Date.now(),
  });
  /* ✅ BUG FIX (2026-07-19, CRITICAL): was a direct client-side
     creator_commissions.update({status:'pending_payout'}) — this table's
     RLS has no self-UPDATE policy at all (only cc_select_creator, SELECT
     only), so this call has always been silently rejected and swallowed
     by its own .catch(), meaning no match-hosting commission has ever
     actually been marked eligible-for-payout in Supabase, no matter how
     many times a creator clicked this button. claim_match_commission_payout
     does the correct, scoped transition (only the caller's own 'eligible'
     INR rows, atomically) instead of a raw update that would have needed
     an equally-raw RLS policy able to bypass the hold/eligible lifecycle. */
  if (window._supa) {
    window._supa.rpc('claim_match_commission_payout').then(function(res) {
      if (res.error || (res.data && res.data.success === false)) {
        var msg = (res.data && res.data.error) || (res.error && res.error.message) || 'Unknown error';
        console.error('[Creator] claim_match_commission_payout failed:', msg);
        if (window.toast) toast('⚠️ Payout claim sync fail: ' + msg, 'err');
        return;
      }
    });
  }
  toast('✅ Payout request submit! Admin process karega.', 'ok');
  if (window.closeModal) closeModal();
};

})();
