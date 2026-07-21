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
      if (window.firebase && firebase.auth && firebase.auth().currentUser) {
        firebase.auth().currentUser.getIdToken(true).then(cb).catch(function () { cb(null); });
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
    cb('loading');

    _getToken(function (token) {
      if (!token) { cb('error', 'Login required'); return; }

      fetch(EDGE_BASE + '/paytm-create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ amount: amount })
      })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (!d || !d.txnToken) {
            cb('error', d && d.error ? d.error : 'Order create nahi ho saka');
            return;
          }
          _openCheckout(d, cb);
        })
        .catch(function (e) { cb('error', e.message || 'Network error'); });
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
          if (!window._supa) return;
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
