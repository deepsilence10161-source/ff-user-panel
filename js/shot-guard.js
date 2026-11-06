/* ================================================================
   ✅ D76 (2026-11-06, owner): "koi bhi user duplicate screenshot na
   bhej sake — high advanced system chahiye."
   3-layer anti-duplicate-screenshot guard:
     1) CLIENT: screenshot select hote hi SHA-256 hash banta hai aur
        teeno request tables (premium_requests / sd_requests /
        season_pass_requests) me pending+approved hashes se match hota
        hai → duplicate milte hi selection REJECT + clear toast.
     2) PAYLOAD: har insert me img_hash jaata hai (sd_requests me pehle
        se tha; ab premium + season_pass me bhi column hai).
     3) SERVER: DB trigger (migration 20261107_shot_hash_dedup) kisi bhi
        table me duplicate img_hash insert hone par EXCEPTION deta hai —
        client bypass ho tab bhi duplicate kabhi save NAHI hota.
   ================================================================ */
(function () {
  window._ffShotHash = function (dataUri, cb) {
    try {
      var s = String(dataUri || '');
      if (!s) { cb(null); return; }
      if (window.crypto && crypto.subtle && crypto.subtle.digest) {
        var bytes = new TextEncoder().encode(s);
        crypto.subtle.digest('SHA-256', bytes).then(function (buf) {
          var arr = Array.prototype.slice.call(new Uint8Array(buf));
          cb(arr.map(function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''));
        }).catch(function () { cb(_ffFallback(s)); });
      } else cb(_ffFallback(s));
    } catch (e) { cb(null); }
  };
  function _ffFallback(s) {
    /* FNV-1a 64-bit-ish fallback (crypto.subtle na ho to) */
    var h1 = 0x811c9dc5, h2 = 0x01000193;
    for (var i = 0; i < s.length; i++) {
      h1 = ((h1 ^ s.charCodeAt(i)) * 16777619) >>> 0;
      h2 = ((h2 + s.charCodeAt(i) * (i + 7)) ^ (h2 >>> 13)) >>> 0;
    }
    return 'f' + h1.toString(16) + h2.toString(16);
  }

  /* teeno tables me pending/approved hash dhundo */
  window._ffShotDup = function (hash, cb) {
    if (!hash || !window._supa) { cb(false); return; }
    var q = function (table, col) {
      return window._supa.from(table).select('id')
        .eq(col, hash).in('status', ['pending', 'approved']).limit(1)
        .then(function (r) { return !!(r.data && r.data.length); }, function () { return false; });
    };
    Promise.all([
      q('premium_requests', 'img_hash'),
      q('sd_requests', 'img_hash'),
      q('season_pass_requests', 'img_hash'),
    ]).then(function (res) { cb(res.some(Boolean)); }, function () { cb(false); });
  };

  /* select-time guard: onOk(hash) ya onDup() */
  window._ffGuardShot = function (dataUri, onOk, onDup) {
    window._ffShotHash(dataUri, function (h) {
      if (!h) { onOk(null); return; }
      window._ffShotDup(h, function (dup) {
        if (dup) {
          if (window.toast) window.toast('❌ Ye screenshot pehle hi kisi request me use ho chuka hai — duplicate allowed nahi. Nayi screenshot bhejiye.', 'err');
          onDup();
        } else onOk(h);
      });
    });
  };
})();
