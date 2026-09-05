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

window._doAutoSetLocation = function() {
  var btn = document.getElementById('_locSetBtn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Detecting...'; }

  if (!navigator.geolocation) {
    toast('Device geolocation support nahi karta', 'err');
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-location-crosshairs"></i> Location Allow Karo'; }
    return;
  }

  navigator.geolocation.getCurrentPosition(function(pos) {
    var lat = pos.coords.latitude, lng = pos.coords.longitude;
    /* Reverse geocode via free OpenStreetMap Nominatim — no API key needed */
    fetch('https://nominatim.openstreetmap.org/reverse?format=json&lat=' + lat + '&lon=' + lng + '&zoom=10&addressdetails=1')
      .then(function(r) { return r.json(); })
      .then(function(d) {
        var addr = (d && d.address) || {};
        var city = addr.city || addr.town || addr.village || addr.county || addr.state_district || 'Unknown';
        var state = addr.state || '';
        _submitLocationToServer(city, state, lat, lng);
      })
      .catch(function() {
        /* Reverse geocode failed — still save coordinates with a generic label */
        _submitLocationToServer('My City', '', lat, lng);
      });
  }, function(err) {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-location-crosshairs"></i> Location Allow Karo'; }
    var msg = err.code === 1 ? 'Location permission deny ki gayi — settings se allow karo'
             : err.code === 2 ? 'Location detect nahi ho paayi — GPS on karo'
             : 'Location request timeout ho gaya';
    toast(msg, 'err');
  }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
};

function _submitLocationToServer(city, state, lat, lng) {
  if (!window._supa) { toast('Service unavailable', 'err'); return; }
  window._supa.rpc('set_user_location_once', { p_city: city, p_state: state, p_lat: lat, p_lng: lng })
    .then(function(r) {
      var d = r.data;
      if (d && d.success) {
        if (window.UD) { UD.city = d.city; UD.state = d.state; UD.locationSetAt = new Date().toISOString(); }
        toast('📍 Location set: ' + d.city, 'ok');
        closeModal();
        setTimeout(function() { if (window.renderProfile) renderProfile(); _renderCityLeaderboardModal(); }, 300);
      } else if (d && d.error === 'already_set') {
        toast('Location already set hai', 'inf');
        closeModal();
        setTimeout(_renderCityLeaderboardModal, 300);
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
