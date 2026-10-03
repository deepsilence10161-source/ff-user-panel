/* ================================================================
   js/paytm-checkout.js  —  MiniESports v32.6
   ----------------------------------------------------------------
   Yeh file window.startPaytmPayment() expose karti hai jo
   wallet.js mein wfPaytmPay() call karta hai.

   FLOW:
     1. Firebase token lo
     2. Supabase Edge Function (paytm-create-order) ko call karo
        → orderId + txnToken milega
     3. Paytm JS SDK (dynamically load) → popup checkout open karo
        (UPI-only, sirf wahi dikhega jo backend ne enable kiya)
     4. Paytm redirect URL = paytm-callback Edge Function
        Jo wahan se confirm hota hai wo realtime listener se UD
        automatically update karta hai — yahan manually kuch karne
        ki zaroorat nahi

   YEH FILE KISI BHAI SECRET NAHI RAKHTI — sirf Supabase URL
   use karti hai jo already db.js mein public hai.
================================================================ */
(function () {
  'use strict';

  var EDGE_BASE = 'https://hddhkculuyrfoevxmlwy.supabase.co/functions/v1';
  var PAYTM_SDK_STAGING = 'https://securegw-stage.paytm.in/merchantpgpui/checkoutjs/merchants/';
  var PAYTM_SDK_PROD    = 'https://securegw.paytm.in/merchantpgpui/checkoutjs/merchants/';

  /* ── helpers ── */
  function _getToken(cb) {
    try {
      /* ✅ FIX (2026-09-15): bare firebase.auth() resolves the "[DEFAULT]"
         app, which this codebase never creates (core/firebase.js names its
         app "mainApp") — it threw app-compat/no-app every time, the catch
         below swallowed it, and Paytm checkout could never get a token.
         window.fbAuth() resolves Auth from the real app. */
      var _a = window.fbAuth ? window.fbAuth() : null;
      if (_a && _a.currentUser) {
        _a.currentUser.getIdToken(true).then(cb).catch(function () { cb(null); });
      } else {
        cb(null);
      }
    } catch (e) { cb(null); }
  }

  function _loadScript(src, onDone) {
    if (document.querySelector('script[src="' + src + '"]')) { onDone(); return; }
    var s = document.createElement('script');
    s.src = src;
    s.crossOrigin = 'anonymous';
    s.onload  = onDone;
    s.onerror = function () { onDone(new Error('SDK load failed')); };
    document.head.appendChild(s);
  }

  /* ── main export ── */
  /*
     startPaytmPayment(amount, { onStatus })
     onStatus(status, detail):
       'loading'    — Edge Function call chal raha hai
       'processing' — payment open hai, confirm ka wait
       'approved'   — credit ho gaya (realtime listener bhi update karega)
       'rejected'   — failed/cancelled
       'timeout'    — 3 min mein confirm nahi aaya (check wallet history)
       'error'      — setup ya network error (detail mein message)
  */
  window.startPaytmPayment = function (amount, opts) {
    var cb = (opts && typeof opts.onStatus === 'function') ? opts.onStatus : function () {};
    var purpose = (opts && opts.purpose) ? String(opts.purpose) : '';
    var meta    = (opts && opts.meta && typeof opts.meta === 'object') ? opts.meta : {};
    cb('loading');

    _getToken(function (token) {
      if (!token) { cb('error', 'Login required'); return; }

      fetch(EDGE_BASE + '/paytm-create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ amount: amount, purpose: purpose, meta: meta })
      })
        .then(function (r) { return r.json(); })
        .then(async function (d) {
          if (!d || !d.txnToken) {
            cb('error', d && d.error ? d.error : 'Order create nahi ho saka');
            return;
          }
          if (purpose && d.orderId && window._supa) {
            try {
              await window._supa.rpc('tag_paytm_order_purpose', {
                p_order_id: d.orderId,
                p_purpose: purpose,
                p_meta: meta
              });
            } catch (_e) {}
          }
          _openCheckout(d, cb);
        })
        .catch(function (e) { cb('error', e.message || 'Network error'); });
    });
  };

  /* ── Shared Instant Paytm Purchase Helper for Premium / Season Pass / Bundles / UID Change ── */
  window.renderPaytmInstantBlock = function (amount, onclickJs, btnId, statusId) {
    if (!(window.CFG && window.CFG.paytmEnabled && window.startPaytmPayment)) return '';
    var bId = btnId || '_ptmInstBtn';
    var sId = statusId || '_ptmInstStatus';
    return '<div style="margin-bottom:14px">' +
      '<button type="button" id="' + bId + '" onclick="' + onclickJs + '" ' +
      'style="width:100%;padding:13px;border-radius:12px;border:none;cursor:pointer;' +
      'background:linear-gradient(135deg,#00baf2,#0082c8);color:#fff;font-weight:900;font-size:14px;' +
      'display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 4px 16px rgba(0,186,242,.35)">' +
      '⚡ Pay ₹' + amount + ' Instantly via Paytm (UPI)</button>' +
      '<div id="' + sId + '" style="display:none;margin-top:8px;padding:10px;border-radius:10px;text-align:center;font-size:12px"></div>' +
      '<div style="display:flex;align-items:center;gap:8px;margin:12px 0 4px">' +
      '<div style="flex:1;height:1px;background:rgba(255,255,255,.08)"></div>' +
      '<span style="font-size:10px;color:#888;font-weight:700">YA MANUAL SCREENSHOT SE</span>' +
      '<div style="flex:1;height:1px;background:rgba(255,255,255,.08)"></div></div>' +
      '</div>';
  };

  window.paytmInstantPurchase = function (amount, purpose, meta, btnId, statusId, onApproved) {
    var btn = document.getElementById(btnId || '_ptmInstBtn');
    var st  = document.getElementById(statusId || '_ptmInstStatus');
    function setSt(bg, col, msg) {
      if (!st) return;
      st.style.display = 'block';
      st.style.background = bg;
      st.style.color = col;
      st.innerHTML = msg;
    }
    window.startPaytmPayment(amount, {
      purpose: purpose,
      meta: meta || {},
      onStatus: function (status, detail) {
        if (status === 'loading') {
          if (btn) { btn.disabled = true; btn.textContent = '⏳ Connecting to Paytm...'; }
          setSt('rgba(0,186,242,.1)', '#00baf2', '⏳ Creating Paytm order...');
        } else if (status === 'processing') {
          if (btn) btn.textContent = '⏳ Payment window open...';
          setSt('rgba(255,170,0,.1)', '#ffaa00', '📱 Paytm pe UPI payment complete karo...');
        } else if (status === 'approved') {
          setSt('rgba(0,255,156,.12)', '#00ff9c', '✅ Payment Confirmed! Instant activation complete.');
          if (window._loadUser) window._loadUser();
          if (typeof onApproved === 'function') onApproved();
          setTimeout(function () { if (window.closeModal) closeModal(); }, 1500);
        } else if (status === 'rejected') {
          if (btn) { btn.disabled = false; btn.textContent = '⚡ Pay ₹' + amount + ' Instantly via Paytm (UPI)'; }
          setSt('rgba(255,68,68,.12)', '#ff4444', '❌ Payment failed ya cancel ho gaya. Dobara try karo.');
        } else if (status === 'timeout') {
          if (btn) { btn.disabled = false; btn.textContent = '⚡ Pay ₹' + amount + ' Instantly via Paytm (UPI)'; }
          setSt('rgba(255,170,0,.1)', '#ffaa00', '⏰ Confirmation mein time lag raha hai — thodi der mein auto-update hoga.');
        } else if (status === 'error') {
          if (btn) { btn.disabled = false; btn.textContent = '⚡ Pay ₹' + amount + ' Instantly via Paytm (UPI)'; }
          setSt('rgba(255,68,68,.12)', '#ff4444', '⚠️ ' + (detail || 'Error — manual screenshot method use karo'));
        }
      }
    });
  };

  /* ── Paytm JS SDK checkout ── */
  function _openCheckout(order, cb) {
    var sdkBase = order.isProd ? PAYTM_SDK_PROD : PAYTM_SDK_STAGING;
    var sdkUrl  = sdkBase + order.mid + '.js?version=V3';

    _loadScript(sdkUrl, function (err) {
      if (err) { cb('error', 'Paytm SDK load nahi hua — internet check karo'); return; }

      if (!window.Paytm || !window.Paytm.CheckoutJS) {
        cb('error', 'Paytm SDK unavailable'); return;
      }

      cb('processing');
      var _pollTimer = null;
      var _resolved  = false;

      function _resolve(status, detail) {
        if (_resolved) return;
        _resolved = true;
        if (_pollTimer) clearInterval(_pollTimer);
        cb(status, detail);
      }

      /* Poll Supabase sd_requests row for status change.
         Paytm ke callbacks WebView mein aate hain aur Edge Function
         wahan se Supabase update karta hai — yeh poll usi change ko
         detect karta hai. */
      function _startPoll(orderId) {
        var attempts = 0;
        _pollTimer = setInterval(function () {
          attempts++;
          if (attempts > 36) { _resolve('timeout'); return; } // 3 min
          if (!window._supa || !window._supaReady) return;
          window._supa.from('sd_requests')
            .select('status')
            .eq('id', orderId)
            .single()
            .then(function (r) {
              if (!r.data) return;
              if (r.data.status === 'approved')  _resolve('approved');
              if (r.data.status === 'rejected')  _resolve('rejected');
            })
            .catch(function () {}); // poll fail to ignore
        }, 5000); // har 5 second
      }

      window.Paytm.CheckoutJS.init({
        tokenType: 'TXN_TOKEN',
        data: {
          orderId:   order.orderId,
          token:     order.txnToken,
          tokenType: 'TXN_TOKEN',
          amount:    String(order.amount)
        },
        merchant: {
          mid:      order.mid,
          name:     'MiniESports',
          logo:     '',
          redirect: false      // popup mode (WebView safe)
        },
        website: order.website,
        flow:    'DEFAULT',
        handler: {
          notifyMerchant: function (eventName) {
            /* 'APP_CLOSED' ya 'SESSION_EXPIRED' */
            if (eventName === 'APP_CLOSED' || eventName === 'SESSION_EXPIRED') {
              /* Jaldi resolve mat karo — user ne close kiya ho sakta
                 hai payment ke baad. Poll decide karega. */
            }
          }
        }
      }).then(function () {
        window.Paytm.CheckoutJS.invoke();
        _startPoll(order.orderId);
      }).catch(function (e) {
        cb('error', (e && e.message) || 'Checkout open nahi hua');
      });
    });
  }

})();
