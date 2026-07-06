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
window.checkStreakMilestones = function() {
  if (!uid() || !db()) return;
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
      // Claim this milestone
      db().ref('users/' + uid() + '/streakMilestonesClaimed/day_' + m.day).set(true);
      db().ref('users/' + uid() + '/coins').transaction(function(v){ return (v||0) + m.coins; });
      if (m.badge && !ud().title) {
        db().ref('users/' + uid() + '/title').set(m.badge);
      }
      // Show celebration popup
      setTimeout(function() {
        showStreakCelebration(m);
      }, 1000);
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
  if (!p || !p.active) return 0;
  if (p.expiresAt && p.expiresAt < Date.now()) return 0;
  return Number(p.tier || p.premiumTier || 1);
}
window.getPremiumTier = getPremiumTier;
window.isPremium = function() { return getPremiumTier() > 0; };

// MONTHLY BONUS COINS — auto credit on login
window.checkPremiumMonthlyBonus = function() {
  if (!uid() || !db()) return;
  var tier = getPremiumTier();
  if (!tier) return;

  var _pm = window.CFG && window.CFG.premium && window.CFG.premium.bonuses;
  var bonusMap = _pm || { 1: 50, 2: 150, 3: 400 };
  var bonus = bonusMap[tier] || 0;
  var monthKey = new Date().toISOString().substring(0, 7); // "2026-05"

  db().ref('users/' + uid() + '/premiumMonthlyBonus/' + monthKey).once('value', function(s) {
    if (s.val()) return; // already claimed this month
    db().ref('users/' + uid() + '/premiumMonthlyBonus/' + monthKey).set(true);
    db().ref('users/' + uid() + '/coins').transaction(function(v){ return (v||0) + bonus; });
    /* ✅ Sync to Supabase */
    if (window._supa && uid()) {
      window._supa.rpc('increment_balance', { p_uid: uid(), p_col: 'coins', p_amount: bonus }).catch(function(){});
      window._supa.from('wallet_transactions').insert({ user_id: uid(), currency: 'coins', txn_type: 'credit', amount: bonus, reason: 'premium_bonus', note: 'Monthly Premium Bonus Tier ' + tier }).catch(function(){});
    }
    if (window.UD) { window.UD.coins = (window.UD.coins||0) + bonus; }
    var tierName = tier===3?'Diamond':tier===2?'Gold':'Silver';
    toast('💎 ' + tierName + ' Monthly Bonus: +' + bonus + '🪙 Coins!', 'ok');
    if (window.updateHdr) window.updateHdr();
  });
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
window.showCreatorDashboard = function() {
  if (!uid() || !db()) { toast('Login karo pehle', 'err'); return; }

  db().ref('users/' + uid() + '/creatorProfile').once('value', function(snap) {
    var cp = snap.val() || {};
    var hasCode = !!cp.code;

    if (!hasCode) {
      showCreatorSignup();
      return;
    }

    // Load commission stats
    db().ref('creatorStats/' + uid()).once('value', function(statSnap) {
      var stats = statSnap.val() || {};
      renderCreatorDash(cp, stats);
    });
  });
};

function showCreatorSignup() {
  var h = '<div style="text-align:center;padding:8px 0">';
  h += '<div style="font-size:48px;margin-bottom:12px">🔵</div>';
  h += '<div style="font-size:17px;font-weight:900;margin-bottom:8px">Creator Ban Jao!</div>';
  h += '<div style="font-size:13px;color:var(--txt2);line-height:1.7;margin-bottom:16px">';
  h += 'Apne YouTube/Instagram followers ko Mini eSports pe lao.<br>';
  h += 'Jab woh Sky Diamonds se <strong style="color:#00d4ff">paid match khelte hain</strong>, tumhe <strong style="color:#00d4ff">20% commission</strong> milta hai!';
  h += '</div>';
  h += '<div style="background:rgba(0,212,255,.06);border:1px solid rgba(0,212,255,.2);border-radius:14px;padding:14px;margin-bottom:16px">';
  h += '<div style="font-size:12px;font-weight:700;color:#00d4ff;margin-bottom:8px">💰 Earning Example</div>';
  h += '<div style="font-size:12px;color:var(--txt2);line-height:1.8">';
  h += '10K followers × 1% convert = 100 users<br>';
  h += '100 users ₹99 ke Sky Diamonds khareedte hain aur unse paid matches khelte hain<br>';
  h += '<strong style="color:#00ff9c">Tumhara 20% = ₹1,980</strong> — jaise-jaise woh khelte rahenge!';
  h += '</div>';
  h += '<div style="font-size:10px;color:var(--txt2);margin-top:8px;padding-top:8px;border-top:1px solid rgba(0,212,255,.15)">ℹ️ Commission tabhi milta hai jab tumhara referral apne Sky Diamonds se ek paid match khelta hai — sirf kharidne se nahi. Isse tumhe genuinely active players laane ka fayda milta hai.</div>';
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

  // Check if code is taken
  db().ref('creatorCodes/' + code).once('value', function(s) {
    if (s.val()) { toast('Ye code pehle se liya hua hai — doosra code try karo', 'err'); return; }

    var data = { code: code, channel: channel, followers: followers, uid: uid(), ign: ud().ign||ud().displayName||'', status: 'pending', createdAt: Date.now() };
    db().ref('users/' + uid() + '/creatorProfile').set(data);
    db().ref('creatorCodes/' + code).set(uid());
    db().ref('creatorStats/' + uid()).set({ totalSales: 0, totalCommission: 0, pendingPayout: 0, paidOut: 0 });

    if (window.closeModal) closeModal();
    toast('✅ Creator request submit ho gayi! Admin 24hr mein approve karega.', 'ok');
  });
};

function renderCreatorDash(cp, stats) {
  var status = cp.status || 'pending';
  var statusHtml = status === 'approved'
    ? '<span style="color:#00ff9c;font-weight:700;font-size:12px">✅ Approved</span>'
    : status === 'pending'
    ? '<span style="color:#ffd700;font-weight:700;font-size:12px">⏳ Pending Approval</span>'
    : '<span style="color:#ff6b6b;font-weight:700;font-size:12px">❌ Rejected</span>';

  var h = '';

  // Creator code card
  h += '<div style="background:linear-gradient(135deg,rgba(0,100,255,.08),rgba(0,212,255,.05));border:1.5px solid rgba(0,212,255,.25);border-radius:16px;padding:16px;margin-bottom:14px">';
  h += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">';
  h += '<div style="font-size:13px;font-weight:800;color:#00d4ff">🔵 Creator Code</div>' + statusHtml;
  h += '</div>';
  h += '<div style="font-size:28px;font-weight:900;color:#fff;letter-spacing:3px;margin-bottom:6px">' + cp.code + '</div>';
  h += '<div style="font-size:11px;color:var(--txt2)">Users ye code Sky Diamond purchase pe use karein</div>';
  h += '<button onclick="copyCreatorCode(\'' + cp.code + '\')" style="margin-top:8px;padding:7px 14px;border-radius:10px;background:rgba(0,212,255,.12);border:1px solid rgba(0,212,255,.25);color:#00d4ff;font-size:12px;font-weight:700;cursor:pointer"><i class="fas fa-copy"></i> Code Copy</button>';
  h += '</div>';

  // Stats grid
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">';
  [
    { label: 'Total Sales', val: stats.totalSales||0, unit: 'orders', color: '#00d4ff' },
    { label: 'Total Commission', val: '₹'+(stats.totalCommission||0), unit: 'earned', color: '#00ff9c' },
    { label: 'Pending Payout', val: '₹'+(stats.pendingPayout||0), unit: 'to receive', color: '#ffd700' },
    { label: 'Paid Out', val: '₹'+(stats.paidOut||0), unit: 'total', color: '#888' },
  ].forEach(function(s) {
    h += '<div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:12px">';
    h += '<div style="font-size:10px;color:var(--txt2);margin-bottom:4px">' + s.label + '</div>';
    h += '<div style="font-size:20px;font-weight:900;color:' + s.color + '">' + s.val + '</div>';
    h += '<div style="font-size:10px;color:#555">' + s.unit + '</div></div>';
  });
  h += '</div>';

  // Share link
  var shareLink = 'https://deepsilence10161-source.github.io/ff-user-panel/?ref=' + cp.code;
  var shareMsg = '🎮 Mini eSports pe Free Fire tournaments!\n☪️ Halal gaming — no gambling\n🪙 Free coins, ranked matches!\n\nMere code se join karo: ' + cp.code + '\n👉 ' + shareLink;

  h += '<div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:12px;margin-bottom:10px">';
  h += '<div style="font-size:11px;color:var(--txt2);margin-bottom:6px">Tumhara Referral Link</div>';
  h += '<div style="font-size:11px;color:#00d4ff;word-break:break-all">' + shareLink + '</div>';
  h += '</div>';

  h += '<button onclick="doShareCreatorLink(\'' + encodeURIComponent(shareMsg) + '\')" style="width:100%;padding:13px;border-radius:12px;background:linear-gradient(135deg,#25d366,#128c7e);border:none;color:#fff;font-size:13px;font-weight:800;cursor:pointer;margin-bottom:8px"><i class="fab fa-whatsapp"></i> Promote on WhatsApp</button>';

  // Payout request (referral commissions)
  var _minPayout = (window.CFG && window.CFG.creatorMinPayout) || 100;
  if ((stats.pendingPayout||0) >= _minPayout) {
    h += '<button onclick="requestCreatorPayout(' + (stats.pendingPayout||0) + ')" style="width:100%;padding:13px;border-radius:12px;background:linear-gradient(135deg,#00ff9c,#00cc7a);border:none;color:#000;font-size:13px;font-weight:800;cursor:pointer">💰 Payout Request — ₹' + stats.pendingPayout + '</button>';
  } else {
    h += '<div style="text-align:center;font-size:11px;color:#555;padding:8px">Minimum ₹100 hone pe payout request kar sakte ho (abhi ₹' + (stats.pendingPayout||0) + ')</div>';
  }

  // ── NEW: Creator Video Sharing (C2) ─────────────────────────────
  if (status === 'approved') {
    h += '<div style="height:1px;background:rgba(255,255,255,.07);margin:14px 0"></div>';
    h += '<div style="font-size:13px;font-weight:800;color:#ff6b35;margin-bottom:10px">📹 Video Sharing</div>';

    // Check suspension
    var strikes = ud().videoStrikes || {};
    if (strikes.suspended) {
      var suspMsg = strikes.suspendedUntil === -1
        ? 'Aap permanently video sharing se ban ho gaye hain.'
        : 'Video sharing suspend hai until ' + new Date(strikes.suspendedUntil).toLocaleDateString('en-IN') + '.';
      h += '<div style="background:rgba(255,60,60,.08);border:1px solid rgba(255,60,60,.2);border-radius:10px;padding:12px;font-size:12px;color:#ff6b6b;margin-bottom:10px">🚫 ' + suspMsg + '</div>';
    } else if (Number(window.CFG.videoEnabled) === 0) {
      h += '<div style="font-size:12px;color:#888;padding:8px">Video system abhi off hai.</div>';
    } else {
      h += '<button onclick="showCreatorVideoUpload()" style="width:100%;padding:11px;border-radius:11px;background:rgba(255,107,53,.1);border:1px solid rgba(255,107,53,.25);color:#ff6b35;font-size:13px;font-weight:700;cursor:pointer;margin-bottom:8px">📤 New Video Share Karo</button>';
      h += '<button onclick="showMyCreatorVideos()" style="width:100%;padding:11px;border-radius:11px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);color:#aaa;font-size:12px;cursor:pointer">📋 Mere Videos Dekho</button>';
      if (strikes.count) {
        h += '<div style="font-size:11px;color:#ffd700;margin-top:6px">⚠️ Strikes: ' + strikes.count + '/3</div>';
      }
    }

    // ── NEW: Creator Match Hosting (C3) ───────────────────────────
    h += '<div style="height:1px;background:rgba(255,255,255,.07);margin:14px 0"></div>';
    h += '<div style="font-size:13px;font-weight:800;color:#00ff9c;margin-bottom:10px">🎮 Match Hosting</div>';

    if (Number(window.CFG.creatorMatchEnabled) === 0) {
      h += '<div style="font-size:12px;color:#888;padding:8px">Creator match hosting abhi off hai.</div>';
    } else {
      h += '<button onclick="showCreatorMatchForm()" style="width:100%;padding:11px;border-radius:11px;background:rgba(0,255,156,.08);border:1px solid rgba(0,255,156,.2);color:#00ff9c;font-size:13px;font-weight:700;cursor:pointer;margin-bottom:8px">➕ Naya Match Host Karo</button>';
      h += '<button onclick="showMyCreatorMatches()" style="width:100%;padding:11px;border-radius:11px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);color:#aaa;font-size:12px;cursor:pointer">📋 Mere Matches</button>';
    }

    // ── NEW: Earnings tab (C4) ────────────────────────────────────
    h += '<div style="height:1px;background:rgba(255,255,255,.07);margin:14px 0"></div>';
    h += '<div style="font-size:13px;font-weight:800;color:#b964ff;margin-bottom:10px">💰 My Earnings (Match Commissions)</div>';
    h += '<button onclick="showCreatorEarnings()" style="width:100%;padding:11px;border-radius:11px;background:rgba(185,100,255,.08);border:1px solid rgba(185,100,255,.2);color:#b964ff;font-size:12px;cursor:pointer">📊 Commission History Dekho</button>';
  }

  if (window.openModal) openModal('🔵 Creator Dashboard', h);
}

window.copyCreatorCode = function(code) {
  if (navigator.clipboard) navigator.clipboard.writeText(code);
  toast('Code copy ho gaya! 🎉', 'ok');
};

window.doShareCreatorLink = function(encodedMsg) {
  /* BUG FIX (2026-07): '_self' not '_blank', see growth.js doShareResult */
  window.open('https://wa.me/?text=' + encodeURIComponent(decodeURIComponent(encodedMsg)), '_self');
};

window.requestCreatorPayout = function(amount) {
  if (!uid() || !db()) return;
  if (!confirm('₹' + amount + ' ka payout request karo?')) return;
  db().ref('creatorPayouts').push({ uid: uid(), ign: ud().ign||'', amount: amount, status: 'pending', createdAt: Date.now() });
  db().ref('creatorStats/' + uid() + '/pendingPayout').transaction(function(v){ return 0; });
  toast('✅ Payout request submit! Admin 2-3 din mein process karega.', 'ok');
  if (window.closeModal) closeModal();
};

// Track creator code on SD purchase
window.trackCreatorSale = function(amount, creatorCode) {
  if (!creatorCode || !db()) return;
  db().ref('creatorCodes/' + creatorCode.toUpperCase()).once('value', function(s) {
    var creatorUid = s.val();
    if (!creatorUid) return;
    var commission = Math.round(amount * 0.20);
    /* BUG FIX / LOGIC CHANGE (2026-07): commission used to be paid the
       INSTANT someone bought Sky Diamonds with a creator's code — even if
       that person never actually played a single match. That means a
       creator could get paid purely for bringing a one-time depositor who
       generates zero real engagement, while Junaid still owes real ₹ out
       of pocket. Per Junaid's request, commission is now LOCKED here and
       only RELEASED (moved from lockedCommission → pendingPayout, the
       bucket admin actually pays out from) the first time this buyer
       actually spends Sky Diamonds on a paid match — see
       releaseCreatorCommissionIfPending() in screens/join.js. This ties
       creator earnings to real gameplay, not just a deposit. */
    db().ref('creatorStats/' + creatorUid + '/totalSales').transaction(function(v){ return (v||0)+1; });
    db().ref('creatorStats/' + creatorUid + '/lockedCommission').transaction(function(v){ return (v||0)+commission; });
    /* Remember which creator to credit + how much, the first time THIS
       buyer spends — read back by releaseCreatorCommissionIfPending(). */
    db().ref('users/' + window.U.uid + '/_pendingCreatorCommission').set({
      creatorUid: creatorUid, amount: commission, purchaseAmount: amount, createdAt: Date.now()
    });
  });
};

/* Called once, the first time a referred user actually spends Sky Diamonds
   on a paid match (see hooks in screens/join.js: deductMoney(), and the
   squad-captain / participant-fee-share join paths — marked with TODO
   comments where the same call needs to be added for full coverage).
   Moves the creator's LOCKED commission for this buyer into pendingPayout
   (what admin actually pays out), then clears the pending marker so it
   only ever fires once per buyer. */
window.releaseCreatorCommissionIfPending = function(uid) {
  if (!uid || !db()) return;
  db().ref('users/' + uid + '/_pendingCreatorCommission').once('value', function(s) {
    var pending = s.val();
    if (!pending || !pending.creatorUid) return;
    db().ref('creatorStats/' + pending.creatorUid + '/lockedCommission').transaction(function(v){ return Math.max((v||0)-pending.amount, 0); });
    db().ref('creatorStats/' + pending.creatorUid + '/totalCommission').transaction(function(v){ return (v||0)+pending.amount; });
    db().ref('creatorStats/' + pending.creatorUid + '/pendingPayout').transaction(function(v){ return (v||0)+pending.amount; });
    db().ref('users/' + pending.creatorUid + '/notifications').push({
      type: 'creator_sale', title: '💰 Commission Mili!',
      message: 'Tumhare referral ne apna pehla paid match khela → Tumhara commission: ₹' + pending.amount,
      read: false, timestamp: Date.now()
    });
    db().ref('users/' + uid + '/_pendingCreatorCommission').remove();
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
      }).catch(function(e){ console.warn('[Creator] Supabase video insert error:', e.message); });
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
  // Mark eligible commissions as pending_payout in Supabase
  if (window._supa) {
    window._supa.from('creator_commissions')
      .update({ status: 'pending_payout', updated_at: new Date().toISOString() })
      .eq('creator_uid', uid()).eq('status', 'eligible').eq('currency', 'inr')
      .catch(function(){});
  }
  toast('✅ Payout request submit! Admin process karega.', 'ok');
  if (window.closeModal) closeModal();
};

})();
