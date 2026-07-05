/* ================================================================
   IMGBB UPLOAD — core/imgbb.js  v32.6-SECRET-FIX
   BUG FIX (v32): uploadBannerImage was saving to avatar_url instead
   of banner_url — fixed to use correct Supabase column.
   SECURITY FIX (v32.6): IMGBB_KEY hata diya yahan se — ab Supabase
   Edge Function (imgbb-upload) use karta hai jo key ko server-side
   secret se padhta hai. Key ab GitHub Pages pe public nahi dikhegi.
================================================================ */
(function() {
  'use strict';

  var IMGBB_PROXY_URL = (window._SUPA_URL || 'https://hddhkculuyrfoevxmlwy.supabase.co') + '/functions/v1/imgbb-upload';

  function _getAuthToken(cb) {
    try {
      if (window.firebase && firebase.auth && firebase.auth().currentUser) {
        firebase.auth().currentUser.getIdToken().then(cb).catch(function() { cb(null); });
      } else {
        cb(null);
      }
    } catch (e) { cb(null); }
  }

  window.uploadToImgBB = function(input, name, callback) {
    if (input instanceof File || input instanceof Blob) {
      var reader = new FileReader();
      reader.onload  = function(e) { _doUpload(e.target.result.split(',')[1], name, callback); };
      reader.onerror = function()  { callback('File read error', null); };
      reader.readAsDataURL(input);
    } else if (typeof input === 'string') {
      _doUpload(input.indexOf(',') > -1 ? input.split(',')[1] : input, name, callback);
    } else {
      callback('Invalid input', null);
    }
  };

  function _doUpload(b64, name, callback) {
    _getAuthToken(function(token) {
      if (!token) { callback('Login required to upload', null); return; }
      fetch(IMGBB_PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ image: b64, name: name || undefined })
      })
        .then(function(r) { return r.json(); })
        .then(function(d) {
          if (d && d.success && d.data && d.data.url) {
            callback(null, d.data.url, d.data.display_url, d.data.thumb && d.data.thumb.url);
          } else {
            callback(d && d.error ? (d.error.message || d.error) : 'Upload failed', null);
          }
        })
        .catch(function(e) { callback(e.message || 'Network error', null); });
    });
  }

  /* ── Profile image upload ── */
  window.uploadProfileImage = function(file, callback) {
    var uid  = window.U ? window.U.uid : 'user';
    var name = 'profile_' + uid + '_' + Date.now();
    compImg(file, 400, 0.8, 150, function(b64) {
      uploadToImgBB(b64, name, function(err, url) {
        if (err) { if (window.toast) toast('Image upload failed: ' + err, 'err'); return; }
        /* Firebase RTDB */
        if (window.db) window.db.ref('users/' + uid + '/profileImage').set(url);
        /* Supabase — correct column: avatar_url ✅ */
        if (window.DB) window.DB.users.update({ avatar_url: url });
        if (window.UD) window.UD.avatar_url = url;
        if (callback) callback(url);
      });
    });
  };

  /* ── Banner image upload ── */
  window.uploadBannerImage = function(file, callback) {
    var uid  = window.U ? window.U.uid : 'user';
    var name = 'banner_' + uid + '_' + Date.now();
    compImg(file, 800, 0.75, 250, function(b64) {
      uploadToImgBB(b64, name, function(err, url) {
        if (err) { if (window.toast) toast('Banner upload failed: ' + err, 'err'); return; }
        /* Firebase RTDB */
        if (window.db) window.db.ref('users/' + uid + '/bannerImage').set(url);
        /* Supabase — BUG FIX: was avatar_url, now correctly banner_url ✅ */
        if (window.DB) window.DB.users.update({ banner_url: url });
        if (window.UD) window.UD.banner_url = url;
        if (callback) callback(url);
      });
    });
  };

  /* ── Wallet screenshot upload ── */
  window.uploadWalletScreenshot = function(b64, callback) {
    var uid  = window.U ? window.U.uid : 'user';
    var name = 'wallet_ss_' + uid + '_' + Date.now();
    uploadToImgBB(b64, name, function(err, url) {
      callback(err ? null : url);
    });
  };

  /* ── Base64 direct upload ── */
  window.uploadToImgBBBase64 = function(base64, name, callback) {
    var b64 = (typeof base64 === 'string' && base64.indexOf(',') > -1)
      ? base64.split(',')[1] : base64;
    _doUpload(b64, name || ('img_' + Date.now()), callback);
  };

  /* ── Image compressor ── */
  window.compImg = function(file, maxDim, quality, maxKB, cb) {
    var reader = new FileReader();
    reader.onload = function(e) {
      var img = new Image();
      img.onload = function() {
        var w = img.width, h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) { h = Math.round(h * maxDim / w); w = maxDim; }
          else       { w = Math.round(w * maxDim / h); h = maxDim; }
        }
        var c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        var q = quality, result = c.toDataURL('image/jpeg', q);
        while (result.length > maxKB * 1370 && q > 0.1) {
          q = Math.round((q - 0.1) * 10) / 10;
          result = c.toDataURL('image/jpeg', q);
        }
        cb(result);
      };
      img.onerror = function() { cb(e.target.result); };
      img.src = e.target.result;
    };
    reader.onerror = function() { cb(null); };
    reader.readAsDataURL(file);
  };

  console.log('[ImgBB] v32-FIX ready — banner_url bug fixed ✅');
})();
