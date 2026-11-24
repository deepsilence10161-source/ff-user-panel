/* ================================================================
   MODAL — core/modal.js  v32-FIX
   BUG FIX: history.pushState/back removed from openModal/closeModal
   Previously: closeModal() → history.back() → utils.js popstate
   → goBack() → navigated away or re-triggered content
   Fix: X button ONLY removes 'show' class. Back button handled
   by utils.js popstate → goBack() → closeModal(). No conflict.
================================================================ */

function openModal(title, html) {
  var t = $('modalT'), b = $('modalB'), mo = $('modalOv');
  if (!mo) return;
  if (t) t.textContent = title || '';
  if (b) b.innerHTML = html || '';
  mo.classList.add('show');
  /* NO history.pushState — causes popstate conflict in WebView */
}
window.showModal = openModal;

function closeModal() {
  var mo = $('modalOv');
  if (!mo) return;
  mo.classList.remove('show');
  /* NO history.back() — utils.js popstate already handles back button */
}
window.closeModal = closeModal;

/* Accessibility enhancer (A11Y-001..003): automatically adds role="button" and
   tabindex="0" + Enter/Space keyboard activation to dynamic div/span[onclick] elements */
(function() {
  function _a11yScan(root) {
    try {
      var scope = root && root.querySelectorAll ? root : document;
      var nodes = scope.querySelectorAll('div[onclick], span[onclick]');
      for (var i = 0; i < nodes.length; i++) {
        var el = nodes[i];
        if (el.id === 'modalOv' || el.classList.contains('modal-overlay')) continue;
        if (!el.hasAttribute('role')) el.setAttribute('role', 'button');
        if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
      }
      var btns = scope.querySelectorAll('button, [role="button"]');
      for (var j = 0; j < btns.length; j++) {
        var b = btns[j];
        if (!b.getAttribute('aria-label') && !(b.textContent || '').trim()) {
          var ttl = b.getAttribute('title') || (b.querySelector('i') && b.querySelector('i').className) || 'Button';
          b.setAttribute('aria-label', String(ttl).replace(/fa[srb]?\s+fa-/g, '').replace(/-/g, ' ').trim() || 'Button');
        }
      }
    } catch (_e) {}
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { _a11yScan(document); });
  } else {
    _a11yScan(document);
  }
  try {
    var _obs = new MutationObserver(function(muts) {
      for (var i = 0; i < muts.length; i++) {
        var added = muts[i].addedNodes;
        for (var j = 0; j < added.length; j++) {
          if (added[j] && added[j].nodeType === 1) _a11yScan(added[j]);
        }
      }
    });
    if (document.body) _obs.observe(document.body, { childList: true, subtree: true });
    else document.addEventListener('DOMContentLoaded', function() { _obs.observe(document.body, { childList: true, subtree: true }); });
  } catch (_e2) {}
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') { closeModal(); return; }
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var t = e.target;
    if (t && (t.tagName === 'DIV' || t.tagName === 'SPAN') && t.getAttribute('role') === 'button' && typeof t.onclick === 'function') {
      e.preventDefault();
      t.click();
    }
  });
})();

/* ================================================================
   CITY LEADERBOARD + ONE-TIME AUTOMATIC LOCATION (2026-08 rewrite)
   BUG FIX: showCityLeaderboard() didn't exist anywhere in the codebase
   — the Profile screen's "City Leaderboard" button called it but
   nothing happened. Also _showSetLocation()/_saveLocation() (a manual
   state+city dropdown picker) was never wired to anything and let a
   user set/change location freely, which conflicts with "location is
   set automatically, once, via device GPS — no manual re-entry".
   Replaced both with a single one-time geolocation flow gated by the
   server-side set_user_location_once RPC (DB-level lock — enforced
   even if the client is tampered with, not just hidden in the UI). */
window.showCityLeaderboard = function() {
  if (window.UD && window.UD.locationSetAt) {
    _renderCityLeaderboardModal();
    return;
  }
  _promptSetLocationOnce();
};

function _promptSetLocationOnce() {
  var h = '<div style="text-align:center;padding:10px 4px">';
  h += '<div style="font-size:40px;margin-bottom:10px">📍</div>';
  h += '<div style="font-size:15px;font-weight:800;margin-bottom:8px">Apna city set karo</div>';
  h += '<div style="font-size:12px;color:var(--txt2);line-height:1.6;margin-bottom:16px">City Leaderboard dekhne ke liye apna live location allow karo.<br>Ye <strong style="color:var(--txt)">sirf ek baar</strong> set hoga — baad mein khud change nahi kar paoge.</div>';
  h += '<button onclick="_doAutoSetLocation()" id="_locSetBtn" style="padding:13px 28px;border-radius:14px;border:none;background:linear-gradient(135deg,#ffaa00,#ff8c00);color:#000;font-weight:900;font-size:14px;cursor:pointer"><i class="fas fa-location-crosshairs"></i> Location Allow Karo</button>';
  h += '</div>';
  openModal('📍 Set Your City', h);
}

/* ✅ D101 (owner: "location on karva lo user se"): device LOCATION (GPS)
   OFF ho to detection fail hota rehta hai — isliye detect karne se PEHLE
   check + seedha Settings tak le jaane wala guide. Android par native
   bridge (isLocationEnabled/openLocationSettings), web par clear toast. */
window._openLocSettings = function() {
  if (window.AndroidBridge && window.AndroidBridge.openLocationSettings) {
    try { window.AndroidBridge.openLocationSettings(); return; } catch (e) {}
  }
  toast('Phone Settings → Location → ON karo, phir wapas aakar retry karo', 'inf');
};
function _locOffGuide() {
  var h = '<div style="text-align:center;padding:10px 4px">';
  h += '<div style="font-size:40px;margin-bottom:10px">🛰️</div>';
  h += '<div style="font-size:15px;font-weight:800;margin-bottom:8px">Phone ki Location OFF hai</div>';
  h += '<div style="font-size:12px;color:var(--txt2);line-height:1.6;margin-bottom:16px">City detect karne ke liye device ki <strong style="color:var(--txt)">Location (GPS) ON</strong> honi chahiye.<br>Settings kholo → Location → ON karo → wapas aakar Retry karo.</div>';
  h += '<button onclick="window._openLocSettings&&_openLocSettings()" style="padding:12px 22px;border-radius:14px;border:none;background:linear-gradient(135deg,#0066ff,#00d4ff);color:#fff;font-weight:900;font-size:13px;cursor:pointer;margin-bottom:8px"><i class="fas fa-gear"></i> Location Settings Kholo</button><br>';
  h += '<button onclick="window.closeModal&&closeModal();window._doAutoSetLocation&&_doAutoSetLocation()" style="padding:10px 22px;border-radius:14px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.05);color:var(--txt);font-weight:800;font-size:12px;cursor:pointer">Retry — maine ON kar diya</button>';
  h += '</div>';
  openModal('📍 Location ON karo', h);
}
window._locOffGuide = _locOffGuide;

window._doAutoSetLocation = function() {
  var btn = document.getElementById('_locSetBtn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Detecting...'; }

  /* ✅ D101: GPS OFF ho to pehle guide — warna detect fail hi hoga */
  if (window.AndroidBridge && window.AndroidBridge.isLocationEnabled) {
    try {
      if (!window.AndroidBridge.isLocationEnabled()) {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-location-crosshairs"></i> Location Allow Karo'; }
        _locOffGuide();
        return;
      }
    } catch (e) {}
  }

  if (!navigator.geolocation) {
    toast('Device geolocation support nahi karta', 'err');
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-location-crosshairs"></i> Location Allow Karo'; }
    return;
  }

  navigator.geolocation.getCurrentPosition(function(pos) {
    var lat = pos.coords.latitude, lng = pos.coords.longitude;
    var _resetBtn = function() {
      var b = document.getElementById('_locSetBtn');
      if (b) { b.disabled = false; b.innerHTML = '<i class="fas fa-location-crosshairs"></i> Location Allow Karo'; }
    };
    /* ✅ D100-F7: ANDROID app me reverse-geocode ab NATIVE bridge se
       (android.location.Geocoder — offline-ish, reliable, koi third-party
       rate-limit nahi). Web/bridge-fail par Nominatim fallback.
       Purana 'My City' fake-label fallback HATAYA — usse board par
       jhoothi "My City" entries banti thin (owner: Unknown cities). */
    if (window.AndroidBridge && window.AndroidBridge.reverseGeocode) {
      try {
        var gj = JSON.parse(window.AndroidBridge.reverseGeocode(lat, lng) || '{}');
        if (gj && gj.ok && gj.city) { _submitLocationToServer(gj.city, gj.state || '', lat, lng); return; }
      } catch (e) { /* bridge geocode fail → Nominatim fallback */ }
    }
    fetch('https://nominatim.openstreetmap.org/reverse?format=json&lat=' + lat + '&lon=' + lng + '&zoom=10&addressdetails=1')
      .then(function(r) { return r.json(); })
      .then(function(d) {
        var addr = (d && d.address) || {};
        var city = addr.city || addr.town || addr.village || addr.county || addr.state_district || '';
        if (!city) { toast('City detect nahi hui — GPS signal weak, bahar khule me retry karo', 'err'); _resetBtn(); return; }
        _submitLocationToServer(city, addr.state || '', lat, lng);
      })
      .catch(function() {
        toast('Location resolve nahi hui — internet/GPS check karke retry karo', 'err');
        _resetBtn();
      });
  }, function(err) {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-location-crosshairs"></i> Location Allow Karo'; }
    var msg = err.code === 1 ? 'Location permission deny ki gayi — settings se allow karo'
             : err.code === 2 ? 'Location detect nahi ho paayi — phone ki Location (GPS) ON karo'
             : 'Location request timeout ho gaya';
    toast(msg, 'err');
    /* ✅ D101: GPS OFF (code 2) ho to seedha Settings-guide dikhao */
    if (err.code === 2) { try { _locOffGuide(); } catch (e) {} }
  }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
};

/* ✅ D100-F7 (owner: "android app me permission set kar — location ki live
   location set hogi users ki direct"): Android app boot par KHUD city set
   karta hai — runtime location permission pehle se _askCorePerms (onCreate
   + 4s + 12s retries) me maangi jaati hai; yahan flow: bridge detect →
   ek baar per install (localStorage flag) → GPS fix → native Geocoder
   reverse-geocode (fallback Nominatim) → set_user_location_once RPC
   (server-side lock, sirf ek baar). Koi modal nahi — sirf success toast.
   Fail hone par flag hat jaata hai, agle boot par phir try. */
window._autoCityAndroid = function() {
  try {
    if (!window.AndroidBridge || !window.AndroidBridge.reverseGeocode) return;
    if (!window.U || !window.U.uid || !window._supa) return;
    if (window.UD && window.UD.city) return;
    if (localStorage.getItem('mpCityAutoDone') === '1') return;
    /* ✅ D101: GPS OFF ho to auto-flow skip (fail-loop nahi) — agle boot retry */
    if (window.AndroidBridge.isLocationEnabled) {
      try { if (!window.AndroidBridge.isLocationEnabled()) return; } catch (e) {}
    }
    localStorage.setItem('mpCityAutoDone', '1');
    if (!navigator.geolocation) { localStorage.removeItem('mpCityAutoDone'); return; }
    navigator.geolocation.getCurrentPosition(function(pos) {
      var lat = pos.coords.latitude, lng = pos.coords.longitude;
      var done = false;
      try {
        var gj = JSON.parse(window.AndroidBridge.reverseGeocode(lat, lng) || '{}');
        if (gj && gj.ok && gj.city) { done = true; _submitLocationToServer(gj.city, gj.state || '', lat, lng, true); }
      } catch (e) {}
      if (done) return;
      fetch('https://nominatim.openstreetmap.org/reverse?format=json&lat=' + lat + '&lon=' + lng + '&zoom=10&addressdetails=1')
        .then(function(r) { return r.json(); })
        .then(function(d) {
          var a = (d && d.address) || {};
          var c = a.city || a.town || a.village || a.county || a.state_district || '';
          if (c) _submitLocationToServer(c, a.state || '', lat, lng, true);
          else localStorage.removeItem('mpCityAutoDone');
        })
        .catch(function() { localStorage.removeItem('mpCityAutoDone'); });
    }, function() {
      /* permission denied / GPS off — agle boot par phir try */
      localStorage.removeItem('mpCityAutoDone');
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 3600000 });
  } catch (e) {}
};
/* Boot hook: UD/auth load hone ka time dekar 2 koshishen (8s + 25s) */
setTimeout(function() {
  window._autoCityAndroid();
  setTimeout(function() { window._autoCityAndroid(); }, 17000);
}, 8000);

function _submitLocationToServer(city, state, lat, lng, silent) {
  /* ✅ D100-F7: silent=true → Android auto-flow (koi modal reopen nahi) */
  if (!window._supa) { toast('Service unavailable', 'err'); return; }
  window._supa.rpc('set_user_location_once', { p_city: city, p_state: state, p_lat: lat, p_lng: lng })
    .then(function(r) {
      var d = r.data;
      if (d && d.success) {
        if (window.UD) { UD.city = d.city; UD.state = d.state; UD.locationSetAt = new Date().toISOString(); }
        toast('📍 Location set: ' + d.city, 'ok');
        closeModal();
        setTimeout(function() {
          if (window.renderProfile) renderProfile();
          /* ✅ D100-F6: board dobara khulta hai to growth.js wala gated
             tab-board (My City ab sirf apni city dikhata hai) */
          if (!silent && window.showCityLeaderboard) window.showCityLeaderboard();
          else if (!silent) _renderCityLeaderboardModal();
        }, 300);
      } else if (d && d.error === 'already_set') {
        toast('Location already set hai', 'inf');
        closeModal();
        if (!silent) setTimeout(function() {
          if (window.showCityLeaderboard) window.showCityLeaderboard();
          else _renderCityLeaderboardModal();
        }, 300);
      } else {
        toast('Location save nahi ho payi — retry karo', 'err');
        var btn = document.getElementById('_locSetBtn');
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-location-crosshairs"></i> Location Allow Karo'; }
      }
    })
    .catch(function(e) {
      toast('Error: ' + (e.message || 'network'), 'err');
    });
}

function _renderCityLeaderboardModal() {
  var city = (window.UD && window.UD.city) || '';
  var h = '<div style="padding:4px">';
  h += '<div style="text-align:center;padding:10px 0 16px"><div style="font-size:12px;color:var(--txt2)">Tumhara city</div><div style="font-size:18px;font-weight:900;color:#ff9f1c">📍 ' + (window.escHtml?escHtml(city):city) + '</div></div>';
  h += '<div id="_cityLbBody" style="text-align:center;padding:20px;color:var(--txt2)"><i class="fas fa-spinner fa-spin"></i> Loading leaderboard...</div>';
  h += '</div>';
  openModal('🏙️ City Leaderboard', h);

  if (!window._supa || !city) { return; }
  window._supa.from('users').select('ign,rank_points,total_wins,city')
    .eq('city', city).order('rank_points', { ascending: false }).limit(50)
    .then(function(r) {
      var rows = r.data || [];
      var body = document.getElementById('_cityLbBody');
      if (!body) return;
      if (!rows.length) { body.innerHTML = '<div style="padding:10px;font-size:13px">Abhi koi player nahi hai is city mein</div>'; return; }
      var bh = '';
      rows.forEach(function(u, i) {
        bh += '<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.05)">';
        bh += '<div style="width:24px;font-weight:900;color:' + (i<3?'#ffd700':'var(--txt2)') + '">#' + (i+1) + '</div>';
        bh += '<div style="flex:1;text-align:left;font-weight:700;font-size:13px">' + (window.escHtml?escHtml(u.ign||'Player'):(u.ign||'Player')) + '</div>';
        bh += '<div style="font-size:12px;color:var(--txt2)">🏆 ' + (u.total_wins||0) + '</div>';
        bh += '<div style="font-size:13px;font-weight:800;color:#ff9f1c">' + (u.rank_points||0) + 'pts</div>';
        bh += '</div>';
      });
      body.innerHTML = bh;
    })
    .catch(function() {
      var body = document.getElementById('_cityLbBody');
      if (body) body.innerHTML = '<div style="padding:10px;font-size:13px;color:#ff6b6b">Load failed, retry karo</div>';
    });
}

/* State Banner */
function applyState() {
  var b = $('stateBanner'); if (!b) return;
  if (!window.UD) { b.style.display = 'none'; return; }
  if (window.UD.profileStatus === 'approved') {
    b.style.display = 'none';
  } else if (window.UD.profileStatus === 'pending') {
    b.className = 'state-banner yellow';
    b.innerHTML = '<i class="fas fa-clock"></i> Profile verification pending. App is in view-only mode until admin approval.';
    b.style.display = 'flex';
  } else {
    b.className = 'state-banner blue';
    b.innerHTML = '<i class="fas fa-info-circle"></i> Complete your profile to participate. <a onclick="navTo(\'profile\')">Go to Profile →</a>';
    b.style.display = 'flex';
  }
}
window.applyState = applyState;
