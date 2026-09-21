/* ====== WALLET ====== */

function setWFilter(f) {
  window._wFilter = f;
  renderWallet(); // re-renders with updated filter tabs
}
function renderWallet() {
  if (!UD) return;
  // ALWAYS ensure walletMain visible, walletFlow hidden (fixes blank screen bug)
  var wm = $('walletMain'), wf = $('walletFlow');
  if (wm && wm.style.display === 'none') wm.style.display = '';
  if (wf && wf.style.display !== 'none') wf.style.display = 'none';

  // Null-safe balance calculation
  var rm = UD.realMoney || { deposited: 0, winnings: 0, bonus: 0 };
  var dep = Math.max(Number(rm.deposited) || 0, 0);
  var win = Math.max(Number(rm.winnings) || 0, 0);
  var bon = Math.max(Number(rm.bonus) || 0, 0);
  var total = dep + win + bon;
  var coins = Math.max(Number(UD.coins) || 0, 0);
  // Sky diamonds = deposited (bought with real money)
  var skyDia = dep;

  // Update wallet UI elements
  // BUG FIX (2026-07): wTotal/wCoins used to include the emoji prefix in
  // the text itself, which duplicated the emoji now shown separately in
  // the circular icon badge above each number (see index.html). The
  // "Sky Diamonds: X | Coins: Y" breakdown line was removed too — it was
  // redundant with the big numbers already shown in each card.
  var wt = $('wTotal'), wc = $('wCoins');
  if (wt) { wt.textContent = skyDia; wt.style.color = '#00d4ff'; }
  if (wc) wc.textContent = coins;

  // ALWAYS update header balance in real-time
  if (window.updateHdr) updateHdr();

  // Update green diamond count
  var gdc = $('greenDiaCount');
  if (gdc) {
    var greenDia = Math.max(Number(UD.greenDiamonds)||0, 0);
    gdc.innerHTML = '<img src="js/green-diamond.png" style="width:20px;height:20px;vertical-align:middle;object-fit:contain"> <span style="font-size:18px;font-weight:900;color:#00ff64">' + greenDia + '</span>';
  }

  // Update sponsored prize balance card
  var sponsoredCard = $('sponsoredPrizeCard');
  var sponsoredDisp = $('sponsoredBalDisplay');
  if (sponsoredCard) {
    var _sbal = Math.max(Number((UD && UD.sponsored_winnings) || 0), 0);
    if (_sbal > 0) {
      sponsoredCard.style.display = '';
      if (sponsoredDisp) sponsoredDisp.textContent = '₹' + _sbal;
    } else {
      sponsoredCard.style.display = 'none';
    }
  }

  var wh = $('walletHist'); if (!wh) return;

  // Feature 15: Wallet Stats widget above history
  var statsHtml = '';
  if (window.renderWalletStats) statsHtml = window.renderWalletStats();

  // Merge wallet requests (deposit/withdraw) + transactions (entry fees, winnings)
  // ✅ DEDUPLICATION: same amount + type + timestamp (within 60s) = duplicate
  var allTxns = [];
  var _seen = {}; /* key → true for dedup */

  function _dedupKey(src, data) {
    /* Create a fingerprint: source + type + amount + rounded timestamp (60s bucket) */
    var ts   = Math.floor((data.createdAt || data.timestamp || 0) / 60000); /* 60s bucket */
    var amt  = Math.abs(Number(data.amount || data.sd_amount || data.diamonds || 0));
    var type = (data.type || data.txn_type || data.entryType || 'tx').toLowerCase().substring(0, 8);
    return src + '_' + type + '_' + amt + '_' + ts;
  }

  WH.forEach(function(w) {
    var k = _dedupKey('wh', w);
    if (_seen[k]) return; /* Skip duplicate */
    _seen[k] = true;
    allTxns.push({ _src: 'wh', _ts: w.createdAt || w.timestamp || 0, data: w });
  });
  TXNS.forEach(function(t) {
    var k = _dedupKey('tx', t);
    if (_seen[k]) return; /* Skip duplicate */
    _seen[k] = true;
    allTxns.push({ _src: 'txn', _ts: t.timestamp || 0, data: t });
  });
  // Synthetic entry: if green diamonds > 0 but no winning transaction, show balance entry
  var existingWinTxn = TXNS.some(function(t) { return t.type === 'winning' || t.type === 'result'; });
  var currentWin = Number((UD.greenDiamonds !== undefined && UD.greenDiamonds !== null)
                     ? UD.greenDiamonds
                     : (UD.realMoney || {}).winnings) || 0;
  if (currentWin > 0 && !existingWinTxn) {
    allTxns.push({ _src: 'txn', _ts: 0, data: { type: 'winning', amount: currentWin, currency: 'green_diamonds', description: 'Match Winnings (total)', timestamp: 0, _synthetic: true } });
  }
  allTxns.sort(function(a,b) { return b._ts - a._ts; });

  if (!allTxns.length) {
    wh.innerHTML = statsHtml + '<div style="text-align:center;color:var(--txt2);padding:20px;font-size:13px">No transactions yet</div>';
    return;
  }
  // M9 Fix: 5 filter tabs — all, sky, coin, credit, debit
  var activeFilter = (window._wFilter || 'all');
  var filterHtml = '<div id="walletFilterRow" style="display:flex;gap:6px;margin-bottom:12px;overflow-x:auto;padding-bottom:2px">' +
    ['all','sky','coin','credit','debit'].map(function(f) {
      var labels = { all:'All', sky:'💎 Sky', coin:'🪙 Coin', credit:'📈 In', debit:'📉 Out' };
      var colors = { credit:'rgba(0,255,156,.25)', debit:'rgba(255,107,107,.25)' };
      var isActive = activeFilter === f;
      var activeStyle = isActive
        ? 'background:' + (colors[f] || 'linear-gradient(135deg,rgba(0,212,255,.25),rgba(0,212,255,.1))') + ';color:' + (f==='credit'?'#00ff9c':f==='debit'?'#ff6b6b':'#00d4ff') + ';border:1.5px solid ' + (f==='credit'?'rgba(0,255,156,.4)':f==='debit'?'rgba(255,107,107,.4)':'rgba(0,212,255,.4)') + ';'
        : 'background:rgba(255,255,255,.04);color:#666;border:1px solid rgba(255,255,255,.07);';
      return '<button onclick="setWFilter(\'' + f + '\')" style="flex:0 0 auto;padding:7px 12px;border-radius:10px;' + activeStyle + 'font-size:11px;font-weight:800;cursor:pointer">' + labels[f] + '</button>';
    }).join('') + '</div>';
  var h = filterHtml + statsHtml;
  var _af = window._wFilter || 'all';
  if (_af !== 'all') {
    allTxns = allTxns.filter(function(item) {
      var w = item.data;
      var et = (w.entryType||w.type||w.txn_type||'').toLowerCase();
      /* ✅ FIX: All credit-type txn_types */
      var _CREDIT_TYPES = ['credit','match_win','admin_credit','watch_earn','daily_bonus',
        'referral','check_in','checkin','referral_bonus','refund','match_refund',
        'ad_reward','no_show_refund','gift_coins','bonus','winning','wallet_credit'];
      if (_CREDIT_TYPES.indexOf(et) !== -1) w.type = 'credit';
      var amt = Number(w.amount || w.coins || w.diamonds || 0);
      /* M9 Fix: credit/debit filters check amount sign and txn_type */
      if (_af === 'credit') {
        var creditTypes = ['credit','reward','refund','win','bonus','earn','deposit','approved','add'];
        return creditTypes.some(function(t) { return et.indexOf(t) >= 0; }) || amt > 0;
      }
      if (_af === 'debit') {
        var debitTypes = ['debit','entry','join','deduct','purchase','withdraw','spend'];
        return debitTypes.some(function(t) { return et.indexOf(t) >= 0; }) || amt < 0;
      }
      if (_af === 'sky')  return et.indexOf('diamond')>=0||et.indexOf('paid')>=0||et.indexOf('sky')>=0||et.indexOf('deposit')>=0||et.indexOf('withdraw')>=0;
      if (_af === 'coin') return et.indexOf('coin')>=0||et.indexOf('ad')>=0||et.indexOf('check')>=0;
      return true;
    });
  }
  allTxns.forEach(function(item) {
    var w = item.data;
    if (item._src === 'wh') {
      // Deposit/Withdrawal request
      var isD = w.type === 'deposit' || w.type === 'add';
      if (activeFilter === 'credit' && !isD) return;
      if (activeFilter === 'debit' && isD) return;
      var sc = w.status === 'approved' || w.status === 'done' ? 'whs-a' : w.status === 'rejected' ? 'whs-r' : 'whs-p';
      var sl = w.status === 'approved' || w.status === 'done' ? 'Done' : w.status === 'rejected' ? 'Failed' : 'Pending';
      /* ✅ FIX (2026-09-15c): "History me +💎99 dikhta hai jabki maine ₹99
         me 120 diamonds kharide the" — the row hardcoded the 💎 icon onto
         `w.amount`, which core/listeners.js fills from amount_INR (the
         money paid), so a ₹99 purchase rendered as "99 diamonds": two
         currencies mixed into one number. A deposit credits DIAMONDS
         (sd_amount, what admin actually adds), so that is the single
         number shown, with its own icon; only when a row has no diamond
         amount at all (legacy data) does it fall back to the ₹ figure —
         one currency per row, never mixed. Withdrawals are real money,
         so they always show ₹. */
      var _diaAmt = Math.abs(Number(w.sdAmount || w.diamonds || 0));
      var _inrAmt = Math.abs(Number(w.amount || 0));
      var amtTxt = isD
        ? (_diaAmt > 0 ? '+💎' + _diaAmt : '+₹' + _inrAmt)
        : '-₹' + _inrAmt;
      /* ✅ FIX (R19, 2026-09-21): rejected/failed deposit को भी green "+💎120"
         icon+amount मिलता था — misleading (पैसा credit हुआ ही नहीं)। अब failed
         row muted-grey render होती है; red "Failed" badge पहले से था। */
      var _fail = (w.status === 'rejected');
      h += '<div class="wh-card"><div class="wh-icon ' + (isD ? (_fail ? 'whi-m' : 'whi-g') : 'whi-r') + '"><i class="fas fa-' + (isD ? 'arrow-up' : 'arrow-down') + '"></i></div>';
      h += '<div class="wh-info"><div class="wh-name">' + (isD ? 'Deposit via UPI' : 'Withdrawal') + '</div>';
      h += '<div class="wh-time">' + timeAgo(w.createdAt || w.timestamp) + '</div>';
      if (w.utr || w.transactionId) h += '<div class="wh-utr">UTR: ' + (w.utr || w.transactionId) + '</div>';
      h += '</div><div class="wh-amt ' + (isD ? (_fail ? 'wha-m' : 'wha-g') : 'wha-r') + '">' + amtTxt + '</div>';
      h += '<span class="wh-status ' + sc + '">' + sl + '</span></div>';
    } else {
      // Internal transactions (entry fee, winnings, cashback, etc)
      var amt2 = w.amount || 0;
      var isCredit = amt2 > 0;
      if (activeFilter === 'credit' && !isCredit) return;
      if (activeFilter === 'debit' && isCredit) return;
      var typeMap = { winning: '🏆 Prize Won', debit: '🎮 Entry Fee', credit: '💰 Bonus', cashback: '🔄 Cashback', referral: '🤝 Referral', refund: '↩️ Refund', withdraw: '📤 Withdrawal', withdrawal: '📤 Withdrawal', result: '🏆 Prize Won' };
      /* ✅ FIX (R19, 2026-09-21): typeMap हर debit को "Entry Fee" दिखा देता था —
         cosmetics-store से badge खरीदने पर भी "Entry Fee ⚡ BADGE-NAME" render
         होता था (user confusion: उसे लगा entry-fee कट गई)। अब reason से
         असली पहचान: cosmetic_purchase → Store Purchase, reward_redemption →
         Reward Redemption. बाकी reasons पहले जैसा। */
      var label = (w.reason === 'cosmetic_purchase') ? '🛍️ Store Purchase'
                : (w.reason === 'reward_redemption') ? '🎁 Reward Redemption'
                : typeMap[w.type] || w.description || w.type || 'Transaction';
      var desc = w.description || '';
      var iconColor = isCredit ? 'whi-g' : 'whi-r';
      var amtColor = isCredit ? 'wha-g' : 'wha-r';
      /* BUG FIX (2026-08): this always showed 💎 (Sky Diamond) regardless
         of what the transaction actually moved — an ad-watch coin reward
         (currency:'coins') showed up here as "+50 💎" even though the
         user's coin balance is what actually went up, not their diamond
         balance. Now picks the icon from the row's real currency field
         (already correctly set upstream in core/listeners.js's
         _loadTransactions — it just wasn't being read here). */
      var _curIcon = (w.currency === 'sponsored' || w.currency === 'inr' || w.currency === 'money')
                   ? '₹'
                   : (w.currency === 'diamonds' || w.currency === 'sky_diamonds') ? '💎'
                   : (w.currency === 'green_diamonds')
                     ? '<img src="js/green-diamond.png" style="width:13px;height:13px;vertical-align:middle;object-fit:contain">'
                     : '🪙';
      h += '<div class="wh-card"><div class="wh-icon ' + iconColor + '"><i class="fas fa-' + (isCredit ? 'coins' : 'gamepad') + '"></i></div>';
      h += '<div class="wh-info"><div class="wh-name">' + label + '</div>';
      h += '<div class="wh-time">' + timeAgo(w.timestamp) + '</div>';
      if (desc && desc !== label) h += '<div class="wh-utr">' + desc + '</div>';
      h += '</div><div class="wh-amt ' + amtColor + '">' + (isCredit ? '+' : '') + _curIcon + Math.abs(amt2) + '</div></div>';
    }
  });
  wh.innerHTML = h;
}

function startAdd() {
  if (isVO()) { toast('Complete profile first', 'err'); return; }
  history.pushState(null, null, null); wfStep = 1; wfAmt = 0; wfScreenshot = ''; _wfPreUp = null; showWFStep();
}
/* ✅ Bug 34 Fix: Email verification helper (avoids nested quote issues in onclick) */
window._sendEmailVerif = function() {
  if (window.auth && window.U && window.auth.currentUser) {
    window.auth.currentUser.sendEmailVerification()
      .then(function() { toast('Verification email bheja! Inbox check karo', 'ok'); closeModal(); })
      .catch(function() { toast('Email bhejne mein error — try again', 'err'); });
  }
};

function startWd() {
  /* ✅ Bug 34 Fix: Require email verification before withdrawal */
  var _emailVerified = (window.UD && window.UD.email_verified) ||
                       (window.U && window.U.emailVerified) || false;
  if (!_emailVerified) {
    var _modalHtml = '<div style="text-align:center;padding:16px">' +
      '<div style="font-size:32px;margin-bottom:12px">📧</div>' +
      '<div style="font-size:14px;font-weight:800;margin-bottom:8px">Email Verify Karo</div>' +
      '<div style="font-size:12px;color:var(--txt2);margin-bottom:16px">Withdrawal ke liye email verification zaruri hai. ' +
      'Apni email check karo aur verification link click karo.</div>' +
      '<button onclick="window._sendEmailVerif()" ' +
      'style="width:100%;padding:12px;border-radius:12px;background:linear-gradient(135deg,#4facfe,#00f2fe);border:none;color:#fff;font-weight:800;cursor:pointer">📧 Verification Email Bhejo</button>' +
      '</div>';
    if (window.openModal) window.openModal('Email Verify Karo', _modalHtml);
    else toast('Pehle email verify karo — inbox check karo', 'err');
    return;
  }
  if (isVO()) { toast('Complete profile first', 'err'); return; }
  // ✅ HALAL: Only sponsored tournament prize winnings withdrawable
  var sponsoredBal = Math.max(Number((UD && UD.sponsored_winnings) || 0), 0);
  (function(sponsoredBal) {
    if (sponsoredBal <= 0) {
      // Show info — no sponsored winnings yet
      var h = '<div style="text-align:center;padding:10px 0 4px">';
      h += '<div style="font-size:48px;margin-bottom:12px">🏆</div>';
      h += '<div style="font-size:16px;font-weight:800;margin-bottom:8px">Sponsored Prize Withdraw</div>';
      h += '<div style="font-size:13px;color:var(--txt2);line-height:1.7;margin-bottom:16px">';
      h += 'Filhaal aapke paas koi sponsored prize nahi hai.<br>';
      h += '<strong style="color:#ffd700">Sirf Sponsored Tournaments</strong> ke winners<br>';
      h += 'hi real prize withdraw kar sakte hain.';
      h += '</div>';
      h += '<div style="background:rgba(0,255,156,.06);border:1px solid rgba(0,255,156,.15);border-radius:12px;padding:12px;font-size:12px;color:var(--txt2);line-height:1.7">';
      h += '✅ <strong style="color:#00ff9c">Halal System:</strong><br>';
      h += '• Koi entry fee nahi hogi<br>';
      h += '• Prize sponsor deta hai<br>';
      h += '• Sirf tournament winners ko milega<br>';
      h += '• Admin approve karega withdrawal';
      h += '</div>';
      h += '</div>';
      openModal('💰 Withdraw', h);
      return;
    }
    // Has sponsored winnings — show withdrawal form
    history.pushState(null, null, null);
    var h = '<div style="background:linear-gradient(135deg,rgba(0,255,156,.08),rgba(0,212,255,.05));border:1px solid rgba(0,255,156,.2);border-radius:12px;padding:12px;margin-bottom:14px">';
    h += '<div style="font-size:11px;font-weight:700;color:#00ff9c;margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px">🏆 Sponsored Prize Balance</div>';
    h += '<div style="font-size:26px;font-weight:900;color:#00ff9c">₹' + sponsoredBal + '</div>';
    h += '<div style="font-size:11px;color:var(--txt2);margin-top:4px">Sponsored tournament jeet ke kamaya gaya</div>';
    h += '</div>';
    h += '<div style="background:rgba(0,212,255,.05);border:1px solid rgba(0,212,255,.15);border-radius:10px;padding:10px;margin-bottom:14px;font-size:11px;color:var(--txt2);line-height:1.6">';
    h += '✅ <strong style="color:#00d4ff">Halal Withdrawal</strong> — Ye prize sponsor ka paisa hai, kisi bhi player ki entry fee nahi.';
    h += '</div>';
    h += '<div class="f-group"><label>Amount (₹) — Max ₹' + sponsoredBal + '</label>';
    h += '<input type="number" class="f-input" id="wdAmt" placeholder="Amount enter karo" min="1" max="' + sponsoredBal + '"></div>';
    h += '<div class="f-group"><label>UPI ID</label>';
    h += '<input type="text" class="f-input" id="wdUpi" placeholder="yourname@upi"></div>';
    h += '<button class="f-btn fb-green" onclick="submitSponsoredWd(' + sponsoredBal + ')"><i class="fas fa-paper-plane"></i> Withdrawal Request Bhejo</button>';
    openModal('💰 Prize Withdraw', h);
  }(sponsoredBal));
}

function submitSponsoredWd(maxBal) {
  var amt = Number(($('wdAmt')||{}).value);
  var upi = (($('wdUpi')||{}).value||'').trim();
  if (!amt || amt < 1)   { toast('Amount enter karo', 'err'); return; }
  if (!upi || !/^[\w.\-]{2,}@[\w]{2,}$/.test(upi.trim())) { toast('Valid UPI ID daalo (e.g. name@upi, phone@paytm)', 'err'); return; }
  if (amt > maxBal)      { toast('Balance se zyada nahi withdraw kar sakte', 'err'); return; }

  /* Supabase-only withdrawal request */
  if (!window._supa || !window._supaReady) { toast('Service unavailable. Try again.', 'err'); return; }
  window._supa.from('wallet_transactions').insert({
    user_id: U.uid,
    txn_type: 'pending_withdraw',
    amount: amt,
    currency: 'sponsored',
    reason: 'Sponsored withdrawal to UPI: ' + upi,
    ref_id: null
  }).then(function() {
    closeModal();
    toast('✅ Withdrawal request submit ho gayi! Admin approve karega.', 'ok');
    if (window.renderWallet) renderWallet();
  }).catch(function(e) {
    toast('Error submitting. Try again.', 'err');
  });
}
function submitWd() {
  // Legacy stub — now handled by submitSponsoredWd()
  toast('Withdrawal form mein UPI ID aur amount bharo', 'ok');
}
function cancelWF() {
  $('walletFlow').style.display = 'none';
  $('walletMain').style.display = '';
  /* Bug H-1 Fix: Clear screenshot data to free memory */
  try { wfScreenshot = ''; wfStep = 1; wfAmt = 0; } catch(e) {}
  _wfPreUp = null; /* 15c: drop any in-flight background proof upload */
  var prev = document.getElementById('ssPreview');
  if (prev) { prev.src = ''; prev.style.display = 'none'; }
}

function showWFStep() {
  $('walletMain').style.display = 'none'; var wf = $('walletFlow'); wf.style.display = '';
  var prog = '<div class="w-progress"><div class="w-step-dot ' + (wfStep >= 1 ? 'active' : '') + '">1</div><div class="w-step-line ' + (wfStep >= 2 ? 'done' : '') + '"></div><div class="w-step-dot ' + (wfStep >= 2 ? 'active' : '') + '">2</div><div class="w-step-line ' + (wfStep >= 3 ? 'done' : '') + '"></div><div class="w-step-dot ' + (wfStep >= 3 ? 'active' : '') + '">3</div></div>';
  var h = prog;
  if (wfStep === 1) {
    h += '<div style="font-size:16px;font-weight:700;margin-bottom:14px">Enter Amount</div>';
    /* Sky Diamond non-refundable warning — moved here (2026-08) from
       always-visible on the Wallet card to only-on-purchase-intent,
       shown in red since it's a hard rule the buyer must acknowledge
       right before spending money, not passive background info. */
    h += '<div style="background:rgba(255,68,68,.08);border:1.5px solid rgba(255,68,68,.35);border-radius:12px;padding:10px 12px;margin-bottom:14px;font-size:12px;color:#ff6b6b;line-height:1.5;text-align:left;font-weight:600">⚠️ <strong>Withdraw nahi hoga</strong> — Sky Diamonds sirf matches khelne ke liye hain, ye ek non-refundable in-app currency hai.</div>';
    h += '<div class="f-group"><label>Amount (₹) — Min ₹10</label><input type="number" class="f-input" id="addAmt" placeholder="Enter amount" min="10" value="' + (wfAmt || '') + '"></div>';
    var _sdPkgs = (window.CFG && window.CFG.sdPackages) || [{label:'₹50',price:50},{label:'₹99',price:99},{label:'₹199',price:199},{label:'₹499',price:499}];
    h += '<div class="w-amt-grid">';
    _sdPkgs.forEach(function(p){ h += '<div class="w-amt-btn" onclick="pickAmt('+p.price+')">₹'+p.price+'<br><small style="font-size:9px;opacity:.7">'+p.label+'</small></div>'; });
    h += '</div>';
    h += '<button class="f-btn fb-green" onclick="wfNext()">Continue (Manual UPI)</button>';
    if (window.CFG && window.CFG.paytmEnabled) {
      h += '<button class="f-btn" style="background:linear-gradient(135deg,#00baf2,#0095d7);color:#fff;margin-top:8px" onclick="wfPaytmPay()">⚡ Pay Instantly via Paytm (UPI)</button>';
    }
    h += '<button class="f-btn" style="background:var(--card2);color:var(--txt2);margin-top:8px" onclick="cancelWF()">Cancel</button>';
  } else if (wfStep === 2) {
    var upiId = PAY.upiId || 'merchant@upi', payeeName = PAY.payeeName || 'Mini eSports';
    var upiLink = 'upi://pay?pa=' + upiId + '&pn=' + encodeURIComponent(payeeName) + '&am=' + wfAmt + '&cu=INR&tn=Mini_eSports_Wallet';
    // UPI 2.0 deeplinks for specific apps
    var gpayLink = 'gpay://upi/pay?pa=' + upiId + '&pn=' + encodeURIComponent(payeeName) + '&am=' + wfAmt + '&cu=INR&tn=Mini_eSports';
    var phonepeLink = 'phonepe://pay?pa=' + upiId + '&pn=' + encodeURIComponent(payeeName) + '&am=' + wfAmt + '&cu=INR&tn=Mini_eSports';
    var paytmLink = 'paytmmp://pay?pa=' + upiId + '&pn=' + encodeURIComponent(payeeName) + '&am=' + wfAmt + '&cu=INR&tn=Mini_eSports';
    h += '<div style="font-size:16px;font-weight:700;margin-bottom:14px">Pay ₹' + wfAmt + '</div>';
    h += '<div style="background:var(--card);border-radius:12px;padding:12px;margin-bottom:12px"><div style="font-size:11px;color:var(--txt2);margin-bottom:6px;font-weight:700;text-transform:uppercase;letter-spacing:.5px">Pay To</div><div style="font-size:15px;font-weight:800;display:flex;justify-content:space-between;align-items:center">' + upiId + '<button onclick="copyTxt(\'' + upiId + '\')" style="background:rgba(0,255,106,.1);border:none;color:var(--green);padding:5px 10px;border-radius:8px;cursor:pointer;font-size:12px"><i class="fas fa-copy"></i></button></div><div style="font-size:12px;color:var(--txt2);margin-top:2px">Amount: <strong style="color:var(--green)">₹' + wfAmt + '</strong></div></div>';
    h += '<div style="margin-bottom:12px"><div style="font-size:11px;color:var(--txt2);margin-bottom:8px;font-weight:700">⚡ UPI INSTANT — App Choose Karo:</div>';
    h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">';
    h += '<a href="' + gpayLink + '" style="display:flex;align-items:center;justify-content:center;gap:8px;padding:12px;border-radius:12px;background:rgba(66,133,244,.12);border:1.5px solid rgba(66,133,244,.3);color:#4285f4;font-weight:800;font-size:13px;text-decoration:none"><img src="https://upload.wikimedia.org/wikipedia/commons/f/f2/Google_Pay_Logo.svg" style="height:18px;filter:brightness(2)" onerror="this.style.display=\'none\'"> Google Pay</a>';
    h += '<a href="' + phonepeLink + '" style="display:flex;align-items:center;justify-content:center;gap:8px;padding:12px;border-radius:12px;background:rgba(99,36,242,.12);border:1.5px solid rgba(99,36,242,.3);color:#6324f2;font-weight:800;font-size:13px;text-decoration:none">💜 PhonePe</a>';
    h += '<a href="' + paytmLink + '" style="display:flex;align-items:center;justify-content:center;gap:8px;padding:12px;border-radius:12px;background:rgba(0,149,215,.12);border:1.5px solid rgba(0,149,215,.3);color:#0095d7;font-weight:800;font-size:13px;text-decoration:none">🔵 Paytm</a>';
    h += '<a href="' + upiLink + '" style="display:flex;align-items:center;justify-content:center;gap:8px;padding:12px;border-radius:12px;background:rgba(0,255,106,.08);border:1.5px solid rgba(0,255,106,.25);color:var(--green);font-weight:800;font-size:13px;text-decoration:none"><i class="fas fa-university"></i> Any UPI App</a>';
    h += '</div></div>';
    h += '<div class="f-warn"><i class="fas fa-info-circle"></i> App open hone ke baad payment karo, phir "I Have Paid" tap karo.</div>';
    h += '<button class="f-btn fb-green" style="margin-top:12px" onclick="wfNext()">✅ I Have Paid →</button>';
    h += '<button class="f-btn" style="background:var(--card2);color:var(--txt2);margin-top:8px" onclick="cancelWF()">Cancel</button>';
  } else if (wfStep === 3) {
    /* ✅ FIX (2026-09-16): wfStep-3 re-renders from scratch on every
       navigation (back/forward between steps included), so any pre-upload
       promise from a previous visit is stale by the time Submit reads it.
       Drop the stale handle so this step always starts clean — the upload
       (re)kicks off the moment a screenshot is picked, exactly like
       quick-deposit.js. */
    _wfPreUp = null;
    window._wfPreGen = (window._wfPreGen || 0) + 1;
    h += '<div style="font-size:16px;font-weight:700;margin-bottom:14px">Enter Transaction Details</div>';
    h += '<div class="f-group"><label>UTR Number (Mandatory)</label><input type="text" class="f-input" id="addUtr" placeholder="Enter UTR from your UPI app"><div style="font-size:11px;color:var(--txt2);margin-top:4px">Find UTR in your UPI app payment history</div></div>';
    h += '<div class="f-group"><label>Payment Screenshot</label><div class="upload-area" onclick="$(\'ssInput\').click()"><i class="fas fa-cloud-upload-alt" style="display:block;font-size:28px;color:var(--txt2);margin-bottom:8px"></i><p>Tap to upload screenshot</p><input type="file" id="ssInput" accept="image/*" style="display:none" onchange="handleSS(this)"></div><img id="ssPreview" class="upload-preview" style="display:none"></div>';
    h += '<button class="f-btn fb-green" onclick="submitAddMoney()">Submit for Verification</button>';
    h += '<button class="f-btn" style="background:var(--card2);color:var(--txt2);margin-top:8px" onclick="cancelWF()">Cancel</button>';
  }
  wf.innerHTML = h;
}
function pickAmt(v) { var inp = $('addAmt'); if (inp) inp.value = v; wfAmt = v; }
function wfNext() { if (wfStep === 1) { var a = Number(($('addAmt') || {}).value); if (!a || a < 10) { toast('Minimum ₹10', 'err'); return; } wfAmt = a; } wfStep++; showWFStep(); }
/* ✅ NEW (v32.6): Paytm instant UPI checkout — manual flow (wfNext) ko
   touch nahi karta, sirf ek alternative path hai. Balance update
   apne aap ho jaata hai existing realtime listener (listeners.js
   _bootUser) se — yahan manually refresh karne ki zaroorat nahi. */
function wfPaytmPay() {
  var a = Number(($('addAmt') || {}).value);
  if (!a || a < 10) { toast('Minimum ₹10', 'err'); return; }
  if (!window.startPaytmPayment) { toast('Paytm abhi ready nahi hai, app update karo', 'err'); return; }
  wfAmt = a;
  window.startPaytmPayment(a, {
    onStatus: function (status, detail) {
      if (status === 'loading') toast('Order ban raha hai...', 'info');
      else if (status === 'processing') toast('Confirm ho raha hai...', 'info');
      else if (status === 'approved') { toast('💎 Sky Diamonds add ho gaye!', 'success'); cancelWF(); }
      else if (status === 'rejected') { toast('Payment fail ho gaya', 'err'); cancelWF(); }
      else if (status === 'timeout') { toast('Thodi der lag rahi hai — Wallet History mein check karo', 'info'); cancelWF(); }
      else if (status === 'error') { toast(detail || 'Kuch galat ho gaya', 'err'); }
    }
  });
}
function handleSS(inp) {
  if (!inp.files || !inp.files[0]) return;
  var _ssFile = inp.files[0];
  /* Clear immediately so choosing the same screenshot after any failure
     still fires onchange. */
  inp.value = '';
  if (_ssFile.type && _ssFile.type.indexOf('image/') !== 0) {
    toast('Sirf image file upload karo!', 'err'); return;
  }
  if (!window.compImg) { toast('Image tool load nahi hua — app refresh karo', 'err'); return; }
  window.compImg(_ssFile, 800, 0.7, 150, function(b64) {
    if (!b64) { toast('Screenshot read nahi hui — JPG/PNG dobara choose karo', 'err'); return; }
    wfScreenshot = b64;
    var prev = $('ssPreview');
    if (prev) { prev.src = b64; prev.style.display = 'block'; }
    _startWfPreUpload();
  });
}
/* ✅ FIX (2026-09-15c, SPEED): same background pre-upload as the Sky
   Diamond modal (js/quick-deposit.js) — the ImgBB round-trip starts when
   the screenshot is picked instead of when Submit is tapped, so the
   submit click no longer stalls for the whole upload. Generations make
   a re-picked screenshot invalidate the older upload. */
var _wfPreUp = null;
function _startWfPreUpload() {
  _wfPreUp = null;
  if (!wfScreenshot || !window.uploadToImgBBBase64) return;
  var gen = (window._wfPreGen || 0) + 1; window._wfPreGen = gen;
  var st = { gen: gen, state: 'uploading', url: null, err: null, waiters: [] };
  _wfPreUp = st;
  try {
    window.uploadToImgBBBase64(wfScreenshot, 'payment_proof_pre_' + Date.now(), function(err, url) {
      if (_wfPreUp !== st) return;
      if (err) { st.state = 'error'; st.err = err; }
      else     { st.state = 'done';  st.url = url; }
      var ws = st.waiters; st.waiters = [];
      for (var i = 0; i < ws.length; i++) { try { ws[i](); } catch (e) {} }
    });
  } catch (e) { st.state = 'error'; st.err = String((e && e.message) || e); }
}
/* cb(errOrNull, urlOrNull, inlineB64OrNull) */
function _wfEnsureUpload(retried, btn, cb) {
  /* ✅ FIX (2026-09-16): if no pre-upload ever started (e.g. the uploader
     wasn't ready the moment the screenshot was picked), don't jump
     straight to the inline fallback — actually attempt a real upload
     first. The inline path stays as the last-resort safety net so a
     payment proof is never lost, but only AFTER a genuine attempt. */
  if (!_wfPreUp && wfScreenshot && wfScreenshot.indexOf('data:image/') === 0 && window.uploadToImgBBBase64 && !retried) {
    _startWfPreUpload();
    _wfEnsureUpload(true, btn, cb);
    return;
  }
  if (_wfPreUp && _wfPreUp.state === 'done') { cb(null, _wfPreUp.url, null); return; }
  if (_wfPreUp && _wfPreUp.state === 'uploading') {
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Screenshot upload ho raha hai…'; }
    _wfPreUp.waiters.push(function() { _wfEnsureUpload(retried, btn, cb); });
    return;
  }
  if (_wfPreUp && _wfPreUp.state === 'error' && !retried) {
    _startWfPreUpload();
    _wfEnsureUpload(true, btn, cb);
    return;
  }
  var reason = (_wfPreUp && _wfPreUp.err) || 'upload fail';
  if (wfScreenshot && wfScreenshot.length < 700000 && wfScreenshot.indexOf('data:image/') === 0) {
    /* This is a successful durability fallback, not a failed payment.
       `screenshot_url` accepts the compressed data URL and the admin panel
       renders it directly — exactly why the proof was visible in the
       user's screenshot despite the old warning. Keep the technical
       failure in the console, then let the confirmed DB insert's success
       toast be the only user-facing result. */
    console.warn('[Wallet] Hosted proof upload failed; saving compressed proof inline:', reason);
    cb(null, null, wfScreenshot);
    return;
  }
  cb(reason, null, null);
}
var _addMoneySubmitting = false;
function submitAddMoney() {
  if (_addMoneySubmitting) return;
  /* Cross-cutting #3 Fix: Guard offline submissions — wallet deposits need
     server-side processing, cannot be queued for later like match joins. */
  if (!navigator.onLine) {
    toast('📡 Internet nahi hai. Online hone ke baad try karo. (Paise bhej diye to screenshot sambhal ke rakhna!)', 'err');
    return;
  }
  if (!wfScreenshot || wfScreenshot.length < 100) { toast('Payment screenshot upload karo — mandatory hai!', 'err'); return; }
  var utr = ($('addUtr') || {}).value;
  if (!utr || utr.trim().length < 6) { toast('Enter valid UTR (min 6 chars)', 'err'); return; }
  utr = utr.trim().toUpperCase(); /* Normalize UTR */
  _addMoneySubmitting = true;
  /* Bug #94 Fix: Auto-reset submitting flag after 60s in case of hung request */
  var _subTimeoutGuard = setTimeout(function() {
    if (_addMoneySubmitting) {
      _addMoneySubmitting = false;
      console.warn('[Wallet] submitAddMoney: 60s timeout, resetting flag');
    }
  }, 60000);
  var btn = document.querySelector('.fb-green');
  if (btn) { btn.disabled = true; btn.textContent = 'Submitting...'; }

  /* Bug 5 Fix: Use SHA-256 (crypto.subtle) — same as quick-deposit.js.
     djb2 had collision risk; SHA-256 is collision-resistant for large user bases. */
  function _hashScreenshot(str, cb) {
    var data = str.substring(0, 500) + str.substring(Math.max(0, str.length - 200)) + utr + wfAmt;
    if (window.crypto && window.crypto.subtle) {
      var buf = new TextEncoder().encode(data.substring(0, 4000));
      window.crypto.subtle.digest('SHA-256', buf).then(function(hashBuf) {
        var hex = Array.from(new Uint8Array(hashBuf)).map(function(b){ return b.toString(16).padStart(2,'0'); }).join('');
        cb('SD' + hex.substring(0, 20).toUpperCase());
      }).catch(function() { cb(_djb2Fallback(data)); });
    } else { cb(_djb2Fallback(data)); }
  }
  function _djb2Fallback(str) {
    var hash = 5381;
    for (var i = 0; i < Math.min(str.length, 2000); i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i); hash = hash & hash;
    }
    return 'SD' + Math.abs(hash).toString(36).toUpperCase();
  }
  var _scData = wfScreenshot || '';
  _hashScreenshot(_scData, function(_imgHash) {

  if (!window._supa || !window._supaReady) {
    _addMoneySubmitting = false;
    if (btn) { btn.disabled = false; btn.textContent = 'Submit for Verification'; }
    toast('Service unavailable. Try again.', 'err');
    return;
  }

  /* Check both UTR AND screenshot hash for duplicates */
  Promise.all([
    window._supa.from('sd_requests').select('id,upi_ref').eq('upi_ref', utr).limit(1),
    window._supa.from('sd_requests').select('id,img_hash').eq('img_hash', _imgHash).limit(1)
  ]).then(function(results) {
    var utrDup = results[0].data && results[0].data.length > 0;
    var hashDup = results[1].data && results[1].data.length > 0;

    if (utrDup) {
      toast('❌ This UTR has already been submitted!', 'err');
      _addMoneySubmitting = false;
      if (btn) { btn.disabled = false; btn.textContent = 'Submit for Verification'; }
      return;
    }
    if (hashDup) {
      toast('❌ This screenshot was already used in a previous request!', 'err');
      _addMoneySubmitting = false;
      if (btn) { btn.disabled = false; btn.textContent = 'Submit for Verification'; }
      return;
    }

    /* Upload screenshot to ImgBB
       ✅ 2026-09-15c: reuses the background pre-upload kicked off in
       handleSS when the screenshot was picked — normally already done,
       so Submit no longer waits on the ImgBB round-trip. */
    var _pkgMatch = ((window.CFG && window.CFG.sdPackages) || []).filter(function(p){ return Number(p.price) === Number(wfAmt); })[0];
    /* ✅ FIX (2026-09-15c): sd_amount used to be wfAmt — the RUPEE figure —
       so a ₹99 package bought through this wizard was recorded (and then
       credited by admin) as 99 diamonds instead of the package's real
       diamond count (120). Map price → diamonds from the same live config
       the Buy modal uses; custom amounts keep the old 1:1 semantics. */
    var _diaAmt = (_pkgMatch && _pkgMatch.diamonds) ? Number(_pkgMatch.diamonds) : Number(wfAmt);
    function saveRequest(screenshotUrl) {
      /* ✅ FIX (2026-09-16): `screenshotUrl` is either an ImgBB-hosted URL
         or, when ImgBB was unreachable, the compressed proof inline as a
         data-URL (see _wfEnsureUpload below). Both are saved to
         screenshot_url — the single column sd_requests (and the admin
         panel's "Sky Diamond Requests" view) already reads for proof — so
         the proof ALWAYS reaches admin exactly how it leaves the phone,
         hosted or inline. */
      window._supa.from('sd_requests').insert({
        user_id: U.uid,
        ign: (UD && UD.ign) || '',
        amount_inr: wfAmt,
        sd_amount: _diaAmt,
        upi_ref: utr,
        screenshot_url: screenshotUrl || null,
        img_hash: _imgHash,
        status: 'pending'
      }).then(function(res) {
        /* ✅ FIX (2026-09-15c): supabase-js v2 RESOLVES with `.error` on
           DB/RLS failures instead of rejecting — the old single-callback
           .then() treated those as success and toasted "submitted" while
           nothing was saved. Both outcomes are handled now. */
        if (res && res.error) {
          console.warn('[Wallet] sd_requests insert failed:', res.error.message);
          _addMoneySubmitting = false;
          if (btn) { btn.disabled = false; btn.textContent = 'Submit for Verification'; }
          toast('❌ Request save nahi hua — dobara try karo', 'err');
          return;
        }
        /* Issue #23 Fix: Also log UTR in wallet_transactions as ref_id
           so it's queryable in Supabase admin views alongside balance changes.
           15c: amount here is the DIAMOND count (currency sky_diamonds),
           not the rupee figure — same currency-mixing bug as the history
           row fixed above. */
        window._supa.from('wallet_transactions').insert({
          user_id: U.uid, txn_type: 'pending_deposit',
          currency: 'sky_diamonds', amount: _diaAmt,
          ref_id: utr,
          description: 'UPI payment pending — UTR: ' + utr
        }).then(null, function(){});
        _addMoneySubmitting = false;
        cancelWF();
        toast('Payment submitted for verification! ✅ Admin 24h mein approve karega.', 'ok');
        if (window.renderWallet) renderWallet();
      }, function(e) {
        console.warn('[Wallet] sd_requests insert failed:', e && e.message);
        _addMoneySubmitting = false;
        if (btn) { btn.disabled = false; btn.textContent = 'Submit for Verification'; }
        toast('❌ Request save nahi hua — dobara try karo', 'err');
      });
    }
    _wfEnsureUpload(false, btn, function(err, url, inlineB64) {
      if (err) {
        console.warn('[Wallet] ImgBB upload error:', err);
        _addMoneySubmitting = false;
        if (btn) { btn.disabled = false; btn.textContent = 'Submit for Verification'; }
        toast('❌ Screenshot upload failed: ' + err + ' — dobara try karo', 'err');
        return;
      }
      saveRequest(url || inlineB64);
    });
  }).catch(function(e) {
    _addMoneySubmitting = false;
    if (btn) { btn.disabled = false; btn.textContent = 'Submit for Verification'; }
    toast('Network error. Try again.', 'err');
  });
  }); // end _hashScreenshot callback (Bug 5 Fix)
}
/* ====== LOOT CRATE ANIMATION ====== */
