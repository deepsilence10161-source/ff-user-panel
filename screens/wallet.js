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
  var wt = $('wTotal'), wb = $('wBreak'), wc = $('wCoins');
  if (wt) { wt.textContent = '💎 ' + skyDia; wt.style.color = '#00d4ff'; }
  if (wb) wb.innerHTML = 'Sky Diamonds: 💎' + skyDia + '  |  Coins: 🪙' + coins;
  if (wc) wc.textContent = '🪙 ' + coins;

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
    db.ref('users/' + U.uid + '/sponsoredWinnings').once('value', function(ssnap) {
      var sbal = Math.max(Number(ssnap.val()) || 0, 0);
      if (sbal > 0) {
        sponsoredCard.style.display = '';
        if (sponsoredDisp) sponsoredDisp.textContent = '₹' + sbal;
      } else {
        sponsoredCard.style.display = 'none';
      }
    });
  }

  var wh = $('walletHist'); if (!wh) return;

  // Feature 15: Wallet Stats widget above history
  var statsHtml = '';
  if (window.renderWalletStats) statsHtml = window.renderWalletStats();

  // Merge wallet requests (deposit/withdraw) + transactions (entry fees, winnings)
  var allTxns = [];
  WH.forEach(function(w) {
    allTxns.push({ _src: 'wh', _ts: w.createdAt || w.timestamp || 0, data: w });
  });
  TXNS.forEach(function(t) {
    allTxns.push({ _src: 'txn', _ts: t.timestamp || 0, data: t });
  });
  // Synthetic entry: if winnings > 0 but no winning transaction, show balance entry
  var existingWinTxn = TXNS.some(function(t) { return t.type === 'winning' || t.type === 'result'; });
  var currentWin = Number((UD.realMoney || {}).winnings) || 0;
  if (currentWin > 0 && !existingWinTxn) {
    allTxns.push({ _src: 'txn', _ts: 0, data: { type: 'winning', amount: currentWin, description: 'Match Winnings (total)', timestamp: 0, _synthetic: true } });
  }
  allTxns.sort(function(a,b) { return b._ts - a._ts; });

  if (!allTxns.length) {
    wh.innerHTML = statsHtml + '<div style="text-align:center;color:var(--txt2);padding:20px;font-size:13px">No transactions yet</div>';
    return;
  }
  // Build filter tabs
  var activeFilter = (window._wFilter || 'all');
  var filterHtml = '<div id="walletFilterRow" style="display:flex;gap:8px;margin-bottom:12px">' +
    ['all','sky','coin'].map(function(f) {
      var labels = { all: 'All', sky: '💎 Sky', coin: '🪙 Coin' };
      var isActive = activeFilter === f;
      return '<button onclick="setWFilter(\'' + f + '\')" style="flex:1;padding:8px;border-radius:10px;' +
        (isActive ? 'background:linear-gradient(135deg,rgba(0,212,255,.25),rgba(0,212,255,.1));color:#00d4ff;border:1.5px solid rgba(0,212,255,.4);' : 'background:rgba(255,255,255,.04);color:#666;border:1px solid rgba(255,255,255,.07);') +
        'font-size:12px;font-weight:800;border:none;cursor:pointer">' + labels[f] + '</button>';
    }).join('') + '</div>';
  var h = filterHtml + statsHtml;
  var _af = window._wFilter || 'all';
  if (_af !== 'all') {
    allTxns = allTxns.filter(function(item) {
      var w = item.data;
      var et = (w.entryType||w.type||'').toLowerCase();
      if (_af === 'sky')  return et.indexOf('diamond')<0 ? (et.indexOf('paid')>=0||et.indexOf('sky')>=0||et.indexOf('deposit')>=0||et.indexOf('withdraw')>=0) : true;
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
      var amt = Math.abs(w.amount || 0);
      h += '<div class="wh-card"><div class="wh-icon ' + (isD ? 'whi-g' : 'whi-r') + '"><i class="fas fa-' + (isD ? 'arrow-up' : 'arrow-down') + '"></i></div>';
      h += '<div class="wh-info"><div class="wh-name">' + (isD ? 'Deposit via UPI' : 'Withdrawal') + '</div>';
      h += '<div class="wh-time">' + timeAgo(w.createdAt || w.timestamp) + '</div>';
      if (w.utr || w.transactionId) h += '<div class="wh-utr">UTR: ' + (w.utr || w.transactionId) + '</div>';
      h += '</div><div class="wh-amt ' + (isD ? 'wha-g' : 'wha-r') + '">' + (isD ? '+' : '-') + '💎' + amt + '</div>';
      h += '<span class="wh-status ' + sc + '">' + sl + '</span></div>';
    } else {
      // Internal transactions (entry fee, winnings, cashback, etc)
      var amt2 = w.amount || 0;
      var isCredit = amt2 > 0;
      if (activeFilter === 'credit' && !isCredit) return;
      if (activeFilter === 'debit' && isCredit) return;
      var typeMap = { winning: '🏆 Prize Won', debit: '🎮 Entry Fee', credit: '💰 Bonus', cashback: '🔄 Cashback', referral: '🤝 Referral', refund: '↩️ Refund' };
      var label = typeMap[w.type] || w.description || w.type || 'Transaction';
      var desc = w.description || '';
      var iconColor = isCredit ? 'whi-g' : 'whi-r';
      var amtColor = isCredit ? 'wha-g' : 'wha-r';
      h += '<div class="wh-card"><div class="wh-icon ' + iconColor + '"><i class="fas fa-' + (isCredit ? 'coins' : 'gamepad') + '"></i></div>';
      h += '<div class="wh-info"><div class="wh-name">' + label + '</div>';
      h += '<div class="wh-time">' + timeAgo(w.timestamp) + '</div>';
      if (desc && desc !== label) h += '<div class="wh-utr">' + desc + '</div>';
      h += '</div><div class="wh-amt ' + amtColor + '">' + (isCredit ? '+' : '') + '💎' + Math.abs(amt2) + '</div></div>';
    }
  });
  wh.innerHTML = h;
}

function startAdd() {
  if (isVO()) { toast('Complete profile first', 'err'); return; }
  history.pushState(null, null, null); wfStep = 1; wfAmt = 0; wfScreenshot = ''; showWFStep();
}
function startWd() {
  if (isVO()) { toast('Complete profile first', 'err'); return; }
  // ✅ HALAL: Only sponsored tournament prize winnings withdrawable
  // Check sponsored winnings balance
  db.ref('users/' + U.uid + '/sponsoredWinnings').once('value', function(snap) {
    var sponsoredBal = Number(snap.val()) || 0;
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
  });
}

function submitSponsoredWd(maxBal) {
  var amt = Number(($('wdAmt')||{}).value);
  var upi = (($('wdUpi')||{}).value||'').trim();
  if (!amt || amt < 1)   { toast('Amount enter karo', 'err'); return; }
  if (!upi || !upi.includes('@')) { toast('Valid UPI ID enter karo', 'err'); return; }
  if (amt > maxBal)      { toast('Balance se zyada nahi withdraw kar sakte', 'err'); return; }

  var id = db.ref('walletRequests').push().key;
  var data = {
    requestId: id, uid: U.uid,
    userName: (UD && UD.ign) || (UD && UD.displayName) || '',
    amount: amt, upiId: upi,
    status: 'pending', type: 'sponsored_withdraw',
    createdAt: Date.now()
  };
  db.ref('walletRequests/' + id).set(data);
  // Deduct from sponsoredWinnings immediately (pending state)
  db.ref('users/' + U.uid + '/sponsoredWinnings').transaction(function(v) {
    return Math.max((v||0) - amt, 0);
  });
  closeModal();
  toast('✅ Withdrawal request submit ho gayi! Admin approve karega.', 'ok');
}
function submitWd() {
  // Legacy stub — now handled by submitSponsoredWd()
  toast('Withdrawal form mein UPI ID aur amount bharo', 'ok');
}
function cancelWF() { $('walletFlow').style.display = 'none'; $('walletMain').style.display = ''; }

function showWFStep() {
  $('walletMain').style.display = 'none'; var wf = $('walletFlow'); wf.style.display = '';
  var prog = '<div class="w-progress"><div class="w-step-dot ' + (wfStep >= 1 ? 'active' : '') + '">1</div><div class="w-step-line ' + (wfStep >= 2 ? 'done' : '') + '"></div><div class="w-step-dot ' + (wfStep >= 2 ? 'active' : '') + '">2</div><div class="w-step-line ' + (wfStep >= 3 ? 'done' : '') + '"></div><div class="w-step-dot ' + (wfStep >= 3 ? 'active' : '') + '">3</div></div>';
  var h = prog;
  if (wfStep === 1) {
    h += '<div style="font-size:16px;font-weight:700;margin-bottom:14px">Enter Amount</div>';
    h += '<div class="f-group"><label>Amount (₹) — Min ₹10</label><input type="number" class="f-input" id="addAmt" placeholder="Enter amount" min="10" value="' + (wfAmt || '') + '"></div>';
    var _sdPkgs = (window.CFG && window.CFG.sdPackages) || [{label:'₹50',price:50},{label:'₹99',price:99},{label:'₹199',price:199},{label:'₹499',price:499}];
    h += '<div class="w-amt-grid">';
    _sdPkgs.forEach(function(p){ h += '<div class="w-amt-btn" onclick="pickAmt('+p.price+')">₹'+p.price+'<br><small style="font-size:9px;opacity:.7">'+p.label+'</small></div>'; });
    h += '</div>';
    h += '<button class="f-btn fb-green" onclick="wfNext()">Continue</button>';
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
function handleSS(inp) {
  if (!inp.files || !inp.files[0]) return;
  compImg(inp.files[0], 800, 0.7, 150, function(b64) { wfScreenshot = b64; var prev = $('ssPreview'); if (prev) { prev.src = b64; prev.style.display = 'block'; } });
}
function compImg(file, maxDim, quality, maxKB, cb) {
  var reader = new FileReader();
  reader.onload = function(e) {
    var img = new Image();
    img.onload = function() {
      var w = img.width, h = img.height;
      if (w > maxDim || h > maxDim) { if (w > h) { h = h * (maxDim / w); w = maxDim; } else { w = w * (maxDim / h); h = maxDim; } }
      var c = document.createElement('canvas'); c.width = w; c.height = h;
      var ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0, w, h);
      var q = quality, result = c.toDataURL('image/jpeg', q);
      while (result.length > maxKB * 1370 && q > 0.1) { q -= 0.1; result = c.toDataURL('image/jpeg', q); }
      cb(result);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}
var _addMoneySubmitting = false;
function submitAddMoney() {
  if (_addMoneySubmitting) return; // Prevent double tap
  if (!wfScreenshot || wfScreenshot.length < 100) { toast("Payment screenshot upload karo — mandatory hai!", "err"); return; }
  var utr = ($('addUtr') || {}).value;
  if (!utr || utr.trim().length < 6) { toast('Enter valid UTR (min 6 chars)', 'err'); return; }
  utr = utr.trim();
  _addMoneySubmitting = true;
  var btn = document.querySelector('.fb-green');
  if (btn) { btn.disabled = true; btn.textContent = 'Submitting...'; }
  db.ref('walletRequests').orderByChild('utr').equalTo(utr).once('value', function(s) {
    if (s.exists()) {
      toast('This UTR has already been submitted!', 'err');
      _addMoneySubmitting = false;
      if (btn) { btn.disabled = false; btn.textContent = 'Submit for Verification'; }
      return;
    }
    var id = 'wr_' + Date.now() + '_' + Math.random().toString(36).substr(2,5);
    var data = { requestId: id, uid: U.uid, userName: UD.ign || UD.displayName || '', displayName: UD.displayName || '', userEmail: UD.email || '', amount: wfAmt, transactionId: utr, utr: utr, screenshotBase64: wfScreenshot || '', status: 'pending', type: 'deposit', createdAt: Date.now() };
    db.ref('walletRequests/' + id).set(data);
    db.ref('paymentRequests/' + id).set(data);
    /* Supabase sync */
    if (window._supa) { window._supa.from('sd_requests').insert({ user_id: U.uid, amount_inr: wfAmt, sd_amount: wfAmt, upi_ref: utr, screenshot_url: data.screenshotUrl||null, status: 'pending' }).catch(function(){}); }
    _addMoneySubmitting = false;
    cancelWF(); toast('Payment submitted for verification! ✅', 'ok');
  }, function() {
    _addMoneySubmitting = false;
    if (btn) { btn.disabled = false; btn.textContent = 'Submit for Verification'; }
    toast('Network error. Try again.', 'err');
  });
}
/* ====== LOOT CRATE ANIMATION ====== */
