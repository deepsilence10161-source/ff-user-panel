/* quick-deposit.js - Sky Diamond purchase flow */
window.startAdd = function() {
  if (!window.UD || !window.U) return;
  var h = '<div style="text-align:center;padding:6px 0 16px">';
  h += '<div style="font-size:36px;margin-bottom:8px">💎</div>';
  h += '<div style="font-size:17px;font-weight:900;color:#00d4ff">Buy Sky Diamonds</div>';
  h += '<div style="font-size:12px;color:#888;margin-top:4px">Sky Diamonds se Paid matches khelo</div>';
  h += '</div>';
  /* Info box */
  h += '<div style="background:rgba(0,212,255,.07);border:1px solid rgba(0,212,255,.2);border-radius:12px;padding:12px;margin-bottom:14px;font-size:12px;color:#00d4ff;line-height:1.7">';
  h += '💎 <b>Sky Diamond</b> = Paid matches ki entry fee<br>';
  h += '<img src="js/green-diamond.png" style="width:14px;height:14px;vertical-align:middle;object-fit:contain;display:inline-block"> <b>Green Diamond</b> = Matches jeetne par milta hai (rank ke liye)<br>';
  h += '🪙 <b>Coins</b> = Daily bonus/Ads se milta hai (free matches ke liye)<br>';
  h += '⚠️ Koi bhi diamond <b>withdraw nahi</b> hota — sirf matches khelo!';
  h += '</div>';
  /* Packages from admin settings */
  /* ✅ FIX (2026-08): was reading Firebase 'appSettings/diamondPackages',
     a second, disconnected package-config source from what wallet.js's
     deposit flow uses (window.CFG.sdPackages, sourced from Supabase
     app_settings.live_config — the one the admin's "Sky Diamond
     Packages" editor in App Settings actually saves to). Having two
     separate editors/sources for the same packages meant admin changes
     in one place silently didn't reach this screen. Now reads the same
     live_config-backed CFG.sdPackages everywhere. */
  var pkgs = (window.CFG && window.CFG.sdPackages && window.CFG.sdPackages.length) ? window.CFG.sdPackages : [
    { diamonds: 50,  price: 49,  label: 'Starter' },
    { diamonds: 120, price: 99,  label: 'Popular' },
    { diamonds: 260, price: 199, label: 'Value' },
    { diamonds: 600, price: 399, label: 'Mega' }
  ];
  var pkgHtml = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">';
  pkgs.forEach(function(p) {
    pkgHtml += '<div onclick="window._buyDiamondPkg(' + p.diamonds + ',' + p.price + ')" style="background:rgba(0,212,255,.07);border:1.5px solid rgba(0,212,255,.25);border-radius:14px;padding:14px 10px;text-align:center;cursor:pointer;transition:all .2s">';
    pkgHtml += '<div style="font-size:22px;font-weight:900;color:#00d4ff">💎 ' + p.diamonds + '</div>';
    pkgHtml += '<div style="font-size:10px;color:#00ff9c;font-weight:700;margin:2px 0">' + p.label + '</div>';
    pkgHtml += '<div style="font-size:16px;font-weight:800;color:#fff;margin-top:4px">₹' + p.price + '</div>';
    pkgHtml += '</div>';
  });
  pkgHtml += '</div>';
  var modal = document.getElementById('modalB');
  if (modal) modal.innerHTML = h + pkgHtml + '<div style="font-size:11px;color:#555;text-align:center">UPI payment karo → screenshot admin ko bhejo → 1-2 ghante mein diamonds add honge</div>';
  if (window.openModal) openModal('💎 Buy Sky Diamonds', h + pkgHtml + '<div style="font-size:11px;color:#555;text-align:center">UPI payment karo → screenshot admin ko bhejo → 1-2 ghante mein diamonds add honge</div>');
  return;
};

window._buyDiamondPkg = function(diamonds, price) {
  var h = '<div style="text-align:center;padding:8px 0 14px">';
  h += '<div style="font-size:28px;font-weight:900;color:#00d4ff">💎 ' + diamonds + '</div>';
  h += '<div style="font-size:22px;font-weight:900;color:#fff;margin:6px 0">₹' + price + '</div>';
  h += '</div>';
  h += '<div style="background:rgba(0,0,0,.3);border-radius:12px;padding:12px;margin-bottom:12px;font-size:12px;line-height:1.7;color:#ccc">';
  h += 'UPI ID: <b style="color:#ffd700">miniesports@upi</b><br>';
  h += 'Amount: <b style="color:#00ff9c">₹' + price + '</b><br>';
  h += 'Note: <b>Diamonds-' + (window.UD && window.UD.ffUid || 'myUID') + '</b>';
  h += '</div>';
  h += '<div class="f-group"><label>Payment Screenshot *</label>';
  h += '<div id="_diaDepArea" onclick="document.getElementById(\'_diaDepIn\').click()" style="border:2px dashed rgba(0,212,255,.25);border-radius:12px;padding:18px;text-align:center;cursor:pointer">';
  h += '<i class="fas fa-camera" style="font-size:26px;color:#00d4ff55;display:block;margin-bottom:6px"></i>';
  h += '<div style="font-size:12px;color:#666">Screenshot tap karke upload karo</div>';
  h += '<input type="file" id="_diaDepIn" accept="image/*" style="display:none" onchange="window._diaDepSs(this)"></div>';
  h += '<img id="_diaDepPreview" style="display:none;width:100%;border-radius:10px;margin-top:8px"></div>';
  /* ✅ FIX (2026-08-17, CRITICAL): the form never collected a UTR/UPI
     reference number at all — sd_requests.upi_ref stayed permanently
     empty for every purchase, which is exactly why the admin's Wallet
     Requests table always showed "—" under UTR/UPI even after a payment
     screenshot was uploaded. */
  h += '<div class="f-group" style="margin-top:10px"><label>UTR / UPI Reference Number *</label>';
  h += '<input type="text" id="_diaDepUtr" placeholder="e.g. 123456789012" style="width:100%;padding:11px;border-radius:10px;border:1px solid rgba(0,212,255,.25);background:rgba(0,0,0,.3);color:#fff;font-size:13px;box-sizing:border-box">';
  h += '<div style="font-size:10px;color:#666;margin-top:4px">Payment app ke transaction/UTR number screenshot ke saath match karo</div></div>';
  h += '<button onclick="window._submitDiaDep(' + diamonds + ',' + price + ')" style="width:100%;padding:13px;border-radius:12px;border:none;background:linear-gradient(135deg,#0066ff,#00d4ff);color:#fff;font-size:14px;font-weight:900;cursor:pointer;margin-top:4px">Submit Payment 💎</button>';
  if (window.openModal) openModal('💎 Buy ' + diamonds + ' Sky Diamonds', h);
  var _ss = '';
  window._diaDepSs = function(inp) {
    if (!inp.files || !inp.files[0]) return;
    var r = new FileReader();
    r.onload = function(e) {
      _ss = e.target.result;
      var prev = document.getElementById('_diaDepPreview');
      var area = document.getElementById('_diaDepArea');
      if (prev) { prev.src = _ss; prev.style.display = 'block'; }
      if (area) area.innerHTML = '<i class="fas fa-check-circle" style="color:#00ff9c;font-size:20px;display:block;margin-bottom:4px"></i><div style="font-size:11px;color:#00ff9c">Screenshot ready ✅</div><input type="file" id="_diaDepIn" accept="image/*" style="display:none" onchange="window._diaDepSs(this)">';
    };
    r.readAsDataURL(inp.files[0]);
  };
  window._submitDiaDep = function(diamonds, price) {
    if (!_ss) { if (window.toast) toast('Screenshot upload karo!', 'err'); return; }
    /* ✅ FIX (2026-08-17, CRITICAL): UTR/UPI reference number was never
       collected or validated at all before this fix. */
    var _utrInput = document.getElementById('_diaDepUtr');
    var _utr = _utrInput ? _utrInput.value.trim() : '';
    if (!_utr) { if (window.toast) toast('UTR / UPI reference number daalo!', 'err'); return; }
    if (!window.U || !window.db) return;

    /* Issue #10 Fix: Replace djb2 with SHA-256 (crypto.subtle) to eliminate
       hash collisions on large user base. async/await handled via Promise chain. */
    function _hashStr(str) {
      if (window.crypto && window.crypto.subtle) {
        var msgBuf = new TextEncoder().encode(str.substring(0, 4000));
        return window.crypto.subtle.digest('SHA-256', msgBuf).then(function(hashBuf) {
          var hexArr = Array.from(new Uint8Array(hashBuf));
          var hex = hexArr.map(function(b) { return b.toString(16).padStart(2,'0'); }).join('');
          return 'DP' + hex.substring(0, 16).toUpperCase();
        });
      }
      /* Fallback for old browsers (no crypto.subtle) */
      var h = 0, i = str.length;
      while (i--) { h = ((h << 5) - h) + str.charCodeAt(i); h |= 0; }
      return Promise.resolve('DP' + Math.abs(h).toString(36).toUpperCase().padStart(8,'0'));
    }

    _hashStr(_ss.substring(0, 2000)).then(function(_imgHash) {

    /* ✅ FIX (2026-08-17, CRITICAL): _doSubmit() used to take no arguments
       and always write screenshotBase64 (the raw base64 data URL) to
       Firebase instead of the ImgBB-hosted URL — the ImgBB upload ran
       earlier but its returned `url` was silently discarded, never
       reaching either Firebase or Supabase. sd_requests.screenshot_url
       and sd_requests.upi_ref stayed NULL for every single purchase,
       which is exactly why the admin's Wallet Requests / Sky Diamond
       Requests tables always showed "No photo" and blank UTR/UPI even
       though the user had uploaded a screenshot. Now takes the real
       ImgBB URL and writes it (plus the UTR) to both sides. */
    function _doSubmit(screenshotUrl) {
      var id = window.db.ref('walletRequests').push().key;
      window.db.ref('walletRequests/' + id).set({
        requestId: id, uid: window.U.uid,
        userName: (window.UD && window.UD.ign) || '',
        type: 'diamond_purchase', diamonds: diamonds, amount: price,
        screenshotUrl: screenshotUrl,
        utrNumber: _utr,
        imgHash: _imgHash,
        status: 'pending',
        createdAt: firebase.database.ServerValue.TIMESTAMP
      });
      if (window._supa) {
        window._supa.from('sd_requests').insert({
          user_id: window.U.uid,
          ign: (window.UD && window.UD.ign) || '',
          firebase_req_id: id,
          request_type: 'sky_diamond_purchase',
          sd_amount: diamonds,
          amount_inr: price,
          screenshot_url: screenshotUrl,
          upi_ref: _utr,
          img_hash: _imgHash,
          status: 'pending'
        }).then(null, function(e){ console.warn('[quick-deposit] Supabase insert failed:', e.message); });
      }
      /* ✅ FIX (2026-08-17): removed self-notification — the user just
         submitted this request themselves, so notifying them "you sent a
         request" adds no information and only irritates (per direct
         feedback). The success toast below already confirms submission;
         a real notification will arrive once admin approves/rejects. */
      if (window.toast) toast('✅ Request submit! Admin 1-2 ghante mein diamonds add karega.', 'ok');
      if (window.closeModal) closeModal();
    }

    /* Duplicate screenshot check via Supabase */
    if (window._supa) {
      window._supa.from('sd_requests')
        .select('id,status')
        .eq('img_hash', _imgHash)
        .limit(1)
        .then(function (res) {
          if (res.data && res.data.length > 0) {
            var existing = res.data[0];
            if (window.toast) toast('⚠️ Yeh screenshot pehle se use ho chuka hai! (Status: ' + existing.status + ')', 'err');
            return;
          }
          /* Issue #29 Fix: ImgBB error handling before submitting */
          if (_ss && window.uploadToImgBBBase64) {
            window.uploadToImgBBBase64(_ss, 'dia_proof_' + Date.now(), function(err, url) {
              if (err) {
                if (window.toast) toast('❌ Screenshot upload failed: ' + err + '. Try again.', 'err');
                return;
              }
              _doSubmit(url);
            });
          } else {
            _doSubmit(_ss); /* fallback: no ImgBB configured, store raw data URL */
          }
        })
        .catch(function () { _doSubmit(_ss); });
    } else {
      _doSubmit(_ss);
    }

    }); /* end _hashStr .then */
  };
};
