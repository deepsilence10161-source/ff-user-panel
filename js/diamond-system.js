/* ================================================================
   MINI eSPORTS — DIAMOND SYSTEM v1.0
   
   CONCEPT:
   - User ₹100 deposit karta hai → 100 💎 Diamonds milte hain
   - App ke andar sab kuch DIAMONDS mein dikhta hai (₹ sign nahi)
   - Entry fee bhi diamonds mein
   - Winnings bhi diamonds mein
   - Sirf WITHDRAW karte time convert hota hai:
     * TDS OFF: 100 💎 = ₹100
     * TDS ON:  100 💎 = ₹70 (30% TDS katke)
   
   FIREBASE STRUCTURE (same as before, sirf display change):
   - realMoney.deposited = diamonds (1:1 with rupees)
   - realMoney.winnings = diamonds earned from matches
   - realMoney.bonus = bonus diamonds
   ================================================================ */
(function () {
  'use strict';

  /* ════ CONFIG ════ */
  var DIAMOND_SYMBOL = '💎';
  var DIAMOND_TEXT   = 'Diamonds';
  var RATE_NORMAL    = 1;    /* 1 diamond = ₹1 when TDS off */
  var TDS_RATE       = 0.30; /* 30% TDS */

  /* TDS state — Firebase se load hoga */
  var _tdsActive = false;

  /* TDS state load karo on init */
  function loadTDSState() {
    if (!window.db) { setTimeout(loadTDSState, 500); return; }
    window.db.ref('appSettings/tdsConfig').on('value', function (s) {
      _tdsActive = (s.val() || {}).active === true;
      /* Wallet aur header re-render karo */
      if (window.renderWallet) renderWallet();
      if (window.updateHdr) updateHdr();
    });
  }

  /* ════ UTILITY: Diamonds to Rupees convert karo ════ */
  window.diamondsToRupees = function (diamonds) {
    if (_tdsActive) {
      return Math.floor(diamonds * (1 - TDS_RATE)); /* 100 💎 = ₹70 */
    }
    return diamonds; /* 100 💎 = ₹100 */
  };

  window.rupeesToDiamonds = function (rupees) {
    return rupees; /* 1:1 conversion on deposit */
  };

  /* ════ FORMAT: Display ke liye ════ */
  window.fmtDiamond = function (val) {
    return DIAMOND_SYMBOL + ' ' + (Number(val) || 0);
  };

  window.fmtRupee = function (val) {
    return '₹' + (Number(val) || 0);
  };

  /* ════ OVERRIDE: renderWallet — Diamond display ════ */
  var _origRenderWallet = window.renderWallet;
  window.renderWallet = function () {
    if (!window.UD) { if (_origRenderWallet) _origRenderWallet(); return; }

    var rm = window.UD.realMoney || {};
    var dep  = Math.max(Number(rm.deposited) || 0, 0);
    var win  = Math.max(Number(rm.winnings)  || 0, 0);
    var bon  = Math.max(Number(rm.bonus)     || 0, 0);
    var totalDiamonds = dep + win + bon;
    var coins = Math.max(Number(window.UD.coins) || 0, 0);

    /* Withdrawal value (rupees) */
    var withdrawRupees = _tdsActive
      ? Math.floor((dep + win) * (1 - TDS_RATE))
      : (dep + win);

    /* Update wallet main elements */
    var wt = document.getElementById('wTotal');
    var wb = document.getElementById('wBreak');
    var wc = document.getElementById('wCoins');

    if (wt) {
      wt.textContent = DIAMOND_SYMBOL + ' ' + totalDiamonds;
      wt.style.color = '#00d4ff'; /* blue for diamonds */
    }
    if (wb) {
      var breakText = 'Deposited: ' + DIAMOND_SYMBOL + dep
        + '  |  Winnings: ' + DIAMOND_SYMBOL + win
        + '  |  Bonus: ' + DIAMOND_SYMBOL + bon;
      if (_tdsActive) {
        breakText += '<br><span style="color:#ffaa00;font-size:11px">⚠️ Withdraw value: ₹' + withdrawRupees + ' (30% TDS active)</span>';
      } else {
        breakText += '<br><span style="color:#00ff9c;font-size:11px">✅ Withdraw value: ₹' + withdrawRupees + ' (TDS off)</span>';
      }
      wb.innerHTML = breakText;
    }
    if (wc) wc.textContent = '🪙 ' + coins;

    /* Header update */
    if (window.updateHdr) updateHdr();

    /* Call original to render transaction history */
    if (_origRenderWallet) {
      /* Temporarily swap values to show diamonds in history */
      _origRenderWallet();
      /* After render, fix the total display (original sets ₹ symbol) */
      setTimeout(function () {
        var wt2 = document.getElementById('wTotal');
        if (wt2 && wt2.textContent && wt2.textContent.indexOf('₹') === 0) {
          wt2.textContent = DIAMOND_SYMBOL + ' ' + totalDiamonds;
          wt2.style.color = '#00d4ff';
        }
        /* Fix wBreak too */
        var wb2 = document.getElementById('wBreak');
        if (wb2 && wb2.innerHTML.indexOf('Deposited: ₹') >= 0) {
          var breakText2 = 'Deposited: ' + DIAMOND_SYMBOL + dep
            + '  |  Winnings: ' + DIAMOND_SYMBOL + win
            + '  |  Bonus: ' + DIAMOND_SYMBOL + bon;
          if (_tdsActive) {
            breakText2 += '<br><span style="color:#ffaa00;font-size:11px">⚠️ Withdraw value: ₹' + withdrawRupees + ' (30% TDS active)</span>';
          } else {
            breakText2 += '<br><span style="color:#00ff9c;font-size:11px">✅ Withdraw value: ₹' + withdrawRupees + '</span>';
          }
          wb2.innerHTML = breakText2;
        }
        /* Add diamond TDS conversion card if not exists */
        addDiamondConversionCard();
      }, 50);
    }
  };

  /* ════ OVERRIDE: updateHdr — Diamond header ════ */
  var _origUpdateHdr = window.updateHdr;
  window.updateHdr = function () {
    if (!window.UD) { if (_origUpdateHdr) _origUpdateHdr(); return; }
    var rm = window.UD.realMoney || {};
    var totalDiamonds = Math.max(Number(rm.deposited)||0,0) + Math.max(Number(rm.winnings)||0,0) + Math.max(Number(rm.bonus)||0,0);
    var coins = Math.max(Number(window.UD.coins)||0,0);
    var hc = document.getElementById('hdrCoins');
    var hm = document.getElementById('hdrMoney');
    if (hc) hc.textContent = coins;
    if (hm) {
      /* Header mein diamonds dikhao, ₹ nahi */
      hm.textContent = totalDiamonds;
      /* Parent chip ka icon change karo */
      var chip = hm.parentElement;
      if (chip) {
        var iconSpan = chip.querySelector('span:first-child');
        if (iconSpan && iconSpan.textContent === '₹') {
          iconSpan.textContent = DIAMOND_SYMBOL;
        }
      }
    }
    /* Animate if changed */
    if (_origUpdateHdr) {
      /* Call original but our override will win for display */
      try { _origUpdateHdr(); } catch(e) {}
      /* Re-apply diamond display after original runs */
      var hm2 = document.getElementById('hdrMoney');
      if (hm2) {
        hm2.textContent = totalDiamonds;
        var chip2 = hm2.parentElement;
        if (chip2) {
          var iconSpan2 = chip2.querySelector('span:first-child');
          if (iconSpan2 && iconSpan2.textContent === '₹') iconSpan2.textContent = DIAMOND_SYMBOL;
        }
      }
    }
  };

  /* ════ Diamond conversion card wallet mein ════ */
  function addDiamondConversionCard() {
    var walletMain = document.getElementById('walletMain');
    if (!walletMain) return;
    var existing = document.getElementById('_diamondConvCard');
    if (existing) existing.remove(); /* refresh */

    var rm = (window.UD || {}).realMoney || {};
    var dep  = Math.max(Number(rm.deposited)||0,0);
    var win  = Math.max(Number(rm.winnings) ||0,0);
    var totalWithdrawable = dep + win;
    var rupeesIfWithdraw = _tdsActive
      ? Math.floor(totalWithdrawable * (1 - TDS_RATE))
      : totalWithdrawable;
    var tdsAmount = totalWithdrawable - rupeesIfWithdraw;

    var card = document.createElement('div');
    card.id = '_diamondConvCard';
    card.style.cssText = 'margin:8px 0';

    var bgCol    = _tdsActive ? 'rgba(255,170,0,.07)' : 'rgba(0,212,255,.07)';
    var borderCol= _tdsActive ? 'rgba(255,170,0,.25)' : 'rgba(0,212,255,.25)';
    var titleCol = _tdsActive ? '#ffaa00'             : '#00d4ff';

    var h = '<div style="background:' + bgCol + ';border:1px solid ' + borderCol + ';border-radius:14px;padding:14px">';
    h += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">';
    h += '<div style="font-size:13px;font-weight:800;color:' + titleCol + '">' + DIAMOND_SYMBOL + ' Diamond → ₹ Conversion</div>';
    /* TDS badge hidden */ //h += '<div style="font-size:10px;background:' + bgCol + ';border:1px solid ' + borderCol + ';color:' + titleCol + ';padding:3px 8px;border-radius:20px">' + (_tdsActive ? 'TDS ON' : 'TDS OFF') + '</div>';
    h += '</div>';

    /* Conversion table */
    h += '<div style="background:rgba(0,0,0,.25);border-radius:10px;padding:10px;font-size:12px">';
    h += '<div style="display:flex;justify-content:space-between;margin-bottom:6px;padding-bottom:6px;border-bottom:1px solid rgba(255,255,255,.06)">';
    h += '<span style="color:#aaa">Aapke Diamonds</span>';
    h += '<span style="font-weight:800;color:#00d4ff">' + DIAMOND_SYMBOL + ' ' + totalWithdrawable + '</span></div>';

    if (_tdsActive) {
      h += '<div style="display:flex;justify-content:space-between;margin-bottom:4px"><span style="color:#aaa">TDS @30%</span><span style="color:#ff6b6b">-₹' + tdsAmount + '</span></div>';
      h += '<div style="display:flex;justify-content:space-between;font-weight:900;font-size:13px;padding-top:6px;border-top:1px solid rgba(255,255,255,.08)">';
      h += '<span style="color:#fff">Aapko Milega</span><span style="color:#00ff9c">₹' + rupeesIfWithdraw + '</span></div>';
      /* TDS info line hidden */
    } else {
      h += '<div style="display:flex;justify-content:space-between;font-weight:900;font-size:13px;padding-top:6px;border-top:1px solid rgba(255,255,255,.08)">';
      h += '<span style="color:#fff">Aapko Milega</span><span style="color:#00ff9c">₹' + rupeesIfWithdraw + '</span></div>';
      h += '<div style="margin-top:8px;font-size:11px;color:#00ff9c;text-align:center">100 ' + DIAMOND_SYMBOL + ' = ₹100 &nbsp;|&nbsp; Koi TDS nahi</div>';
    }
    h += '</div>';

    /* Withdraw button shortcut */
    h += '<button onclick="window.startWd&&startWd()" style="width:100%;margin-top:10px;padding:11px;border-radius:11px;background:linear-gradient(135deg,#00ff9c,#00cc7a);border:none;color:#000;font-weight:900;font-size:13px;cursor:pointer"><i class="fas fa-arrow-down"></i> &nbsp;Withdraw ₹' + rupeesIfWithdraw + '</button>';
    h += '</div>';
    card.innerHTML = h;

    /* wCard ke baad insert karo */
    var firstCard = walletMain.querySelector('.w-card');
    if (firstCard && firstCard.nextSibling) {
      walletMain.insertBefore(card, firstCard.nextSibling);
    } else {
      walletMain.appendChild(card);
    }
  }

  /* ════ OVERRIDE: startWd — Diamond-aware withdrawal ════ */
  window.startWd = function () {
    var UD = window.UD; var U = window.U; var db = window.db;
    if (!UD || !U || !db) return;
    if (window.isVO && isVO()) { if (window.toast) toast('Complete profile first', 'err'); return; }

    var rm = UD.realMoney || {};
    var dep  = Math.max(Number(rm.deposited)||0,0);
    var win  = Math.max(Number(rm.winnings) ||0,0);
    var bon  = Math.max(Number(rm.bonus)    ||0,0);
    var totalWithdrawableDiamonds = dep + win;

    if (totalWithdrawableDiamonds <= 0) {
      if (window.toast) toast('Withdrawal ke liye diamonds nahi hain!', 'err'); return;
    }

    /* KYC check */
    if (window.mesKYCGate && !window.mesKYCGate(totalWithdrawableDiamonds, null)) return;

    /* Rupees calculate karo */
    var maxRupees = _tdsActive
      ? Math.floor(totalWithdrawableDiamonds * (1 - TDS_RATE))
      : totalWithdrawableDiamonds;

    var h = '';

    /* Balance card */
    h += '<div style="background:rgba(0,212,255,.06);border:1px solid rgba(0,212,255,.2);border-radius:14px;padding:14px;margin-bottom:12px">';
    h += '<div style="font-size:12px;font-weight:800;color:#00d4ff;margin-bottom:10px">' + DIAMOND_SYMBOL + ' Diamond Balance</div>';
    h += '<div style="font-size:12px">';
    h += '<div style="display:flex;justify-content:space-between;margin-bottom:4px"><span style="color:#aaa">' + DIAMOND_SYMBOL + ' Winnings</span><span style="color:#00ff9c;font-weight:700">' + win + '</span></div>';
    h += '<div style="display:flex;justify-content:space-between;margin-bottom:4px"><span style="color:#aaa">' + DIAMOND_SYMBOL + ' Deposited</span><span style="font-weight:700">' + dep + '</span></div>';
    if (bon > 0) h += '<div style="display:flex;justify-content:space-between;margin-bottom:4px"><span style="color:#aaa">' + DIAMOND_SYMBOL + ' Bonus</span><span style="color:#ffd700;font-weight:700">' + bon + ' (non-WD)</span></div>';
    h += '<div style="border-top:1px solid rgba(255,255,255,.1);padding-top:6px;margin-top:4px;display:flex;justify-content:space-between;font-weight:900">';
    h += '<span>Withdrawable</span><span style="color:#00d4ff">' + DIAMOND_SYMBOL + ' ' + totalWithdrawableDiamonds + '</span></div>';
    h += '</div></div>';

    /* TDS info */
    if (_tdsActive) {
      h += '<div style="background:rgba(255,170,0,.08);border:1px solid rgba(255,170,0,.2);border-radius:12px;padding:12px;margin-bottom:12px">';
      h += '<div style="font-size:12px;font-weight:800;color:#ffaa00;margin-bottom:6px">⚠️ TDS Active — Section 194BA</div>';
      h += '<div style="font-size:11px;color:#ccc">';
      h += '100 ' + DIAMOND_SYMBOL + ' → ₹70 milega (₹30 TDS government ko)<br>';
      h += 'Aapke ' + totalWithdrawableDiamonds + ' ' + DIAMOND_SYMBOL + ' → <strong style="color:#00ff9c">₹' + maxRupees + '</strong> max milega';
      h += '</div></div>';
    } else {
      h += '<div style="background:rgba(0,255,156,.05);border:1px solid rgba(0,255,156,.15);border-radius:12px;padding:10px;margin-bottom:12px;font-size:11px;color:#00ff9c">';
      h += '✅ TDS Off — 100 ' + DIAMOND_SYMBOL + ' = ₹100 &nbsp;|&nbsp; Aapko milega: ₹' + maxRupees;
      h += '</div>';
    }

    /* Amount input — diamonds mein enter karein */
    h += '<div class="f-group">';
    h += '<label>' + DIAMOND_SYMBOL + ' Diamonds (kitne withdraw karne hain?)</label>';
    h += '<input type="number" class="f-input" id="wdDiamonds" placeholder="Enter diamonds amount" min="1" max="' + totalWithdrawableDiamonds + '" oninput="window._wdDiamondPreview&&_wdDiamondPreview(this.value)">';
    h += '</div>';

    /* Live preview */
    h += '<div id="_wdDiamondPreviewBox" style="background:rgba(0,0,0,.3);border-radius:10px;padding:10px;margin-bottom:10px;font-size:12px;display:none">';
    h += '<div style="display:flex;justify-content:space-between;margin-bottom:4px"><span style="color:#aaa">' + DIAMOND_SYMBOL + ' Withdraw:</span><span id="_wdDiaEnt" style="font-weight:700;color:#00d4ff">0</span></div>';
    if (_tdsActive) {
      h += '<div style="display:flex;justify-content:space-between;margin-bottom:4px"><span style="color:#aaa">TDS @30%:</span><span id="_wdDiaTds" style="color:#ff6b6b;font-weight:700">-₹0</span></div>';
    }
    h += '<div style="display:flex;justify-content:space-between;padding-top:6px;border-top:1px solid rgba(255,255,255,.1);font-weight:900">';
    h += '<span style="color:#fff">Aapko Milega:</span><span id="_wdDiaGet" style="color:#00ff9c;font-size:14px">₹0</span></div>';
    h += '</div>';

    h += '<div class="f-group"><label>Your UPI ID</label><input type="text" class="f-input" id="wdUpi" placeholder="yourname@upi"></div>';
    h += '<div class="f-group"><label>Payment Screenshot (UPI screenshot - optional but recommended)</label>';
    h += '<div id="_wdSsArea" onclick="document.getElementById(\'_wdSsIn\').click()" style="border:2px dashed rgba(255,255,255,.15);border-radius:12px;padding:16px;text-align:center;cursor:pointer;background:rgba(255,255,255,.02)">';
    h += '<i class="fas fa-camera" style="font-size:24px;color:#555;display:block;margin-bottom:6px"></i>';
    h += '<div style="font-size:12px;color:#555">Tap to add screenshot (optional)</div>';
    h += '<input type="file" id="_wdSsIn" accept="image/*" style="display:none" onchange="window._wdHandleSs(this)">';
    h += '</div><img id="_wdSsPreview" style="display:none;width:100%;border-radius:10px;margin-top:8px"></div>';
    h += '<button class="f-btn fb-green" onclick="window._confirmDiamondWD&&_confirmDiamondWD(' + totalWithdrawableDiamonds + ')">Request Withdrawal</button>';

    if (window.openModal) openModal('💎 Withdraw Diamonds', h);

    /* Live preview update */
    window._wdDiamondPreview = function (val) {
      val = Math.min(Number(val) || 0, totalWithdrawableDiamonds);
      var box = document.getElementById('_wdDiamondPreviewBox');
      if (!box) return;
      if (val <= 0) { box.style.display = 'none'; return; }
      box.style.display = 'block';
      var rupeesGot = _tdsActive ? Math.floor(val * (1 - TDS_RATE)) : val;
      var tdsAmt    = val - rupeesGot;
      document.getElementById('_wdDiaEnt').textContent = DIAMOND_SYMBOL + ' ' + val;
      var tdEl = document.getElementById('_wdDiaTds');
      if (tdEl) tdEl.textContent = '-₹' + tdsAmt;
      document.getElementById('_wdDiaGet').textContent = '₹' + rupeesGot;
    };
  };

  /* Screenshot handler for withdrawal */
  var _wdScreenshot = '';
  window._wdHandleSs = function(inp) {
    if (!inp.files || !inp.files[0]) return;
    var reader = new FileReader();
    reader.onload = function(e) {
      var img = new Image();
      img.onload = function() {
        var cv = document.createElement('canvas');
        var maxW = 800, w = img.width, h = img.height;
        if (w > maxW) { h = h * (maxW/w); w = maxW; }
        cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(img, 0, 0, w, h);
        var q = 0.7, data = cv.toDataURL('image/jpeg', q);
        while (data.length > 400*1024 && q > 0.2) { q -= 0.1; data = cv.toDataURL('image/jpeg', q); }
        _wdScreenshot = data;
        var prev = document.getElementById('_wdSsPreview');
        var area = document.getElementById('_wdSsArea');
        if (prev) { prev.src = data; prev.style.display = 'block'; }
        if (area) area.innerHTML = '<i class="fas fa-check-circle" style="color:#00ff9c;font-size:20px;margin-bottom:4px;display:block"></i><div style="font-size:11px;color:#00ff9c">Screenshot added ✅</div><input type="file" id="_wdSsIn" accept="image/*" style="display:none" onchange="window._wdHandleSs(this)">';
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(inp.files[0]);
  };

  /* ════ Confirm Diamond Withdrawal ════ */
  window._confirmDiamondWD = function (maxDiamonds) {
    var UD = window.UD; var U = window.U; var db = window.db;
    if (!UD || !U || !db) return;

    var diaAmt = Math.min(Number((document.getElementById('wdDiamonds') || {}).value) || 0, maxDiamonds);
    var upi    = ((document.getElementById('wdUpi') || {}).value || '').trim();

    if (!diaAmt || diaAmt < 1) { if (window.toast) toast(DIAMOND_SYMBOL + ' Diamonds enter karo', 'err'); return; }
    if (!upi || !upi.includes('@')) { if (window.toast) toast('Valid UPI ID enter karo', 'err'); return; }

    /* Check admin min/max */
    db.ref('appSettings/withdrawal').once('value', function (cfgSnap) {
      var cfg = cfgSnap.val() || { minAmount: 50, maxAmount: 5000 };
      var minD = Number(cfg.minAmount) || 50;
      var maxD = Number(cfg.maxAmount) || 5000;

      if (diaAmt < minD) { if (window.toast) toast('Minimum ' + DIAMOND_SYMBOL + minD + ' withdraw karo', 'err'); return; }
      if (diaAmt > maxD) { if (window.toast) toast('Maximum ' + DIAMOND_SYMBOL + maxD + ' per request', 'err'); return; }

      /* Rupee value calculate karo */
      var rupeesGot = _tdsActive ? Math.floor(diaAmt * (1 - TDS_RATE)) : diaAmt;
      var tdsAmt    = diaAmt - rupeesGot;

      /* TDS confirmation */
      if (_tdsActive && tdsAmt > 0 && !sessionStorage.getItem('_dia_tds_conf')) {
        var conf = confirm(
          DIAMOND_SYMBOL + ' ' + diaAmt + ' withdraw karna chahte ho?\n\n'
          + 'TDS @30%: -₹' + tdsAmt + '\n'
          + 'Aapko milega: ₹' + rupeesGot + '\n\n'
          + 'Proceed karna hai?'
        );
        if (!conf) return;
        sessionStorage.setItem('_dia_tds_conf', '1');
      }

      var rm  = UD.realMoney || {};
      var dep = Number(rm.deposited) || 0;
      var win = Number(rm.winnings)  || 0;

      /* Financial year */
      var fy = (function () {
        var d = new Date();
        return d.getMonth() < 3
          ? (d.getFullYear()-1) + '-' + d.getFullYear()
          : d.getFullYear() + '-' + (d.getFullYear()+1);
      })();

      var id  = db.ref('walletRequests').push().key;
      var req = {
        requestId: id, uid: U.uid,
        userName: UD.ign || UD.displayName || '',
        displayName: UD.displayName || '',
        userEmail: UD.email || '',
        amount: rupeesGot,
        diamondsWithdrawn: diaAmt,
        amountAfterTDS: rupeesGot,
        tdsDeducted: tdsAmt,
        tdsActive: _tdsActive,
        upiId: upi, status: 'pending', type: 'withdraw',
        screenshotBase64: _wdScreenshot || '',
        financialYear: fy,
        createdAt: firebase.database.ServerValue.TIMESTAMP
      };
      _wdScreenshot = ''; /* reset */

      db.ref('walletRequests/' + id).set(req);
      db.ref('paymentRequests/' + id).set(req);

      /* Diamonds (realMoney) se deduct karo — winnings pehle, phir deposited */
      var left = diaAmt;
      var wdWin = Math.min(win, left); left -= wdWin;
      var wdDep = Math.min(dep, left);

      if (wdWin > 0) db.ref('users/' + U.uid + '/realMoney/winnings').transaction(function(v){ return Math.max((v||0)-wdWin,0); });
      if (wdDep > 0) db.ref('users/' + U.uid + '/realMoney/deposited').transaction(function(v){ return Math.max((v||0)-wdDep,0); });
      if (wdWin > 0) db.ref('users/' + U.uid + '/wallet/winningBalance').transaction(function(v){ return Math.max((v||0)-wdWin,0); });
      if (wdDep > 0) db.ref('users/' + U.uid + '/wallet/depositBalance').transaction(function(v){ return Math.max((v||0)-wdDep,0); });

      /* TDS records */
      if (_tdsActive && tdsAmt > 0) {
        db.ref('users/' + U.uid + '/tds/tdsDeducted').transaction(function(v){ return (v||0)+tdsAmt; });
        db.ref('tdsRecords').push({
          uid: U.uid, ign: UD.ign || UD.displayName || '',
          pan: ((UD.kyc||{}).panFull) || 'NOT_SUBMITTED',
          type: 'tds_deducted',
          diamondsWithdrawn: diaAmt,
          withdrawalAmount: rupeesGot,
          tdsDeducted: tdsAmt,
          amountPaid: rupeesGot,
          upiId: upi, walletRequestId: id,
          financialYear: fy, timestamp: Date.now()
        });
        db.ref('tdsHeld').push({
          uid: U.uid, ign: UD.ign || UD.displayName || '',
          amount: tdsAmt, walletRequestId: id,
          depositedToGovt: false, financialYear: fy, timestamp: Date.now()
        });
      }

      /* Transaction log */
      db.ref('users/' + U.uid + '/transactions').push({
        type: 'withdrawal', amount: -diaAmt,
        description: 'Withdrawal: ' + DIAMOND_SYMBOL + diaAmt + ' → ₹' + rupeesGot + (tdsAmt > 0 ? ' (TDS: ₹' + tdsAmt + ')' : ''),
        timestamp: Date.now()
      });

      /* Notification */
      db.ref('users/' + U.uid + '/notifications').push({
        title: '📤 Withdrawal Submitted',
        message: DIAMOND_SYMBOL + ' ' + diaAmt + ' withdraw request submit hua! Aapko ₹' + rupeesGot + ' milega' + (tdsAmt > 0 ? ' (TDS ₹' + tdsAmt + ' kataega)' : '') + '. 24-48 hrs mein process hoga.',
        timestamp: Date.now(), read: false, type: 'withdrawal_pending'
      });

      sessionStorage.removeItem('_dia_tds_conf');
      if (window.closeModal) closeModal();

      var msg = _tdsActive && tdsAmt > 0
        ? DIAMOND_SYMBOL + diaAmt + ' request submit! ₹' + rupeesGot + ' milega (TDS: ₹' + tdsAmt + ')'
        : DIAMOND_SYMBOL + diaAmt + ' withdrawal request submit! ₹' + rupeesGot + ' milega';
      if (window.toast) toast(msg, 'ok');
    });
  };

  /* ════ Wallet Add Money label fix ════ */
  function fixAddMoneyButton() {
    /* "Add Money" button ko "Add Diamonds" mein change karo */
    var allBtns = document.querySelectorAll('.wb-add');
    allBtns.forEach(function (btn) {
      if (btn.innerHTML.indexOf('Add Money') >= 0) {
        btn.innerHTML = '<i class="fas fa-plus"></i> Add ' + DIAMOND_SYMBOL;
      }
    });
    var label = document.getElementById('wTotal');
    if (label) {
      var parent = label.closest('.w-card');
      if (parent) {
        var lbl = parent.querySelector('.w-label');
        if (lbl && lbl.textContent === 'Real Money Balance') {
          lbl.textContent = DIAMOND_SYMBOL + ' Diamond Balance';
        }
      }
    }
  }

  /* ════ Profile earnings display fix ════ */
  /* Profile stats mein ₹ ko diamonds show karo */
  var _origRenderProfile = null;
  function hookProfile() {
    if (!window.renderProfile || window._diamondProfileHooked) return;
    window._diamondProfileHooked = true;
    _origRenderProfile = window.renderProfile;
    window.renderProfile = function () {
      _origRenderProfile.apply(this, arguments);
      setTimeout(function () {
        /* Profile stats mein "Earned" ko diamonds dikhao */
        var psBoxes = document.querySelectorAll('.ps-box.psy .ps-val');
        psBoxes.forEach(function (el) {
          if (el.textContent.indexOf('₹') === 0) {
            var val = el.textContent.replace('₹', '');
            el.textContent = DIAMOND_SYMBOL + ' ' + val;
          }
        });
      }, 200);
    };
  }

  /* ════ Admin se deposit approve pe: Rupees → Diamonds 1:1 ════ */
  /* (Admin side pe code already sahi hai — 100 rupees deposit → 100 realMoney.deposited)
     User side pe ab hum wahi 100 ko 100 💎 dikhate hain */

  /* ════ Init ════ */
  function init() {
    loadTDSState();
    /* DOM ready hone pe fix buttons */
    setTimeout(fixAddMoneyButton, 800);
    setTimeout(fixAddMoneyButton, 2000);

    /* navTo hook */
    var _origNavTo = window.navTo;
    if (_origNavTo && !window._diamondNavHooked) {
      window._diamondNavHooked = true;
      window.navTo = function (scr) {
        _origNavTo.apply(this, arguments);
        if (scr === 'wallet') {
          setTimeout(fixAddMoneyButton, 300);
          setTimeout(addDiamondConversionCard, 500);
        }
      };
    }

    /* Profile hook */
    var _try = 0;
    var _iv = setInterval(function () {
      _try++;
      if (window.renderProfile) { clearInterval(_iv); hookProfile(); }
      if (_try > 30) clearInterval(_iv);
    }, 400);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  console.log('[Mini eSports] ✅ Diamond System loaded');
})();
