/* ================================================================
   SPECTATOR MODE / LIVE STREAM  v32-FIX
   BUG FIX: _saveStreamSettings now saves to BOTH Firebase RTDB
   AND Supabase users table (was only saving to Firebase before)
================================================================ */
(function(){
'use strict';

/* ── Live Feed (Home screen widget) ── */
window.renderLiveFeed = function(containerId) {
  var el = document.getElementById(containerId); if (!el) return;
  if (!window.db) { el.style.display = 'none'; return; }
  window.db.ref('liveStreams').orderByChild('live').equalTo(true)
    .limitToLast(5).once('value', function(s) {
      if (!s.exists()) { el.style.display = 'none'; return; }
      var streams = [];
      s.forEach(function(c) { var d = c.val(); d._uid = c.key; streams.push(d); });
      if (!streams.length) { el.style.display = 'none'; return; }
      var h = '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">';
      h += '<div style="width:8px;height:8px;border-radius:50%;background:#ff4444;animation:livePulse 1s ease-in-out infinite"></div>';
      h += '<div style="font-size:13px;font-weight:800;color:#fff">LIVE Matches</div></div>';
      streams.forEach(function(st) {
        var safeTitle = window.escHtml ? window.escHtml(st.title || st.ign || 'Live Match') :
          String(st.title || st.ign || 'Live Match').replace(/</g, '&lt;');
        h += '<div style="padding:12px;border-radius:14px;background:rgba(255,68,68,.06);border:1px solid rgba(255,68,68,.2);margin-bottom:8px">';
        h += '<div style="display:flex;align-items:center;gap:10px">';
        h += '<div style="width:36px;height:36px;border-radius:50%;background:rgba(255,68,68,.15);display:flex;align-items:center;justify-content:center;font-size:16px">' + (st.avatar || '🎮') + '</div>';
        h += '<div style="flex:1"><div style="font-size:13px;font-weight:700;color:#fff">' + safeTitle + '</div>';
        h += '<div style="display:flex;align-items:center;gap:8px;margin-top:2px">';
        h += '<div style="display:flex;align-items:center;gap:4px"><div style="width:7px;height:7px;border-radius:50%;background:#ff4444;animation:livePulse 1s ease-in-out infinite"></div><span style="font-size:10px;color:#ff8888">LIVE</span></div>';
        h += '<span style="font-size:10px;color:#888">👁️ ' + (st.viewers || 0) + ' watch kar rahe hain</span>';
        h += '</div></div>';
        if (st.link) h += '<a href="' + st.link + '" target="_blank" rel="noopener" style="padding:7px 12px;border-radius:10px;border:none;background:rgba(255,68,68,.2);color:#ff8888;font-size:11px;font-weight:700;cursor:pointer;text-decoration:none;white-space:nowrap">Watch 📺</a>';
        h += '</div></div>';
      });
      el.innerHTML = h; el.style.display = 'block';
    });
};

/* ── Stream Settings Modal ── */
window.showStreamSettings = function() {
  if (!window.U || !window.UD) { if (window.toast) toast('Pehle login karo!', 'err'); return; }
  /* GATED (2026-08): live-stream slot is a Premium perk — this is the
     feature that makes Premium worth buying even for a creator who
     already earns via referral commission (Creator Program) without
     needing Premium at all. */
  if (!window.isPremiumActive || !isPremiumActive(2)) {
    if (window.toast) toast('👑 Live Stream sirf Gold Premium (ya usse upar) ke liye hai', 'err');
    if (window.showPremiumUpgrade) { setTimeout(showPremiumUpgrade, 300); }
    return;
  }
  var uid    = window.U.uid;
  var cur    = window.UD.streamLink  || window.UD.stream_link  || '';
  var curT   = window.UD.streamTitle || window.UD.stream_title || '';
  var isLive = window.UD.isLive      || window.UD.is_live      || false;

  var h = '<div style="text-align:center;padding:6px 0 14px">';
  h += '<div style="font-size:34px;margin-bottom:6px">📺</div>';
  h += '<div style="font-size:16px;font-weight:900;color:#fff">Live Stream Settings</div>';
  h += '<div style="font-size:12px;color:#888;margin-top:3px">Apna stream share karo — viewers aayenge!</div></div>';

  h += '<div style="font-size:12px;font-weight:700;color:#aaa;margin-bottom:8px">Live Stream Link</div>';
  h += '<input id="_stLink" type="url" value="' + (cur || '') + '" placeholder="YouTube / Twitch link daalo" style="width:100%;padding:12px;border-radius:12px;border:1.5px solid rgba(255,255,255,.1);background:rgba(255,255,255,.06);color:#fff;font-size:13px;box-sizing:border-box;margin-bottom:6px">';
  h += '<div style="font-size:11px;color:#555;margin-bottom:14px">Example: https://youtube.com/live/xxxxx</div>';

  h += '<div style="font-size:12px;font-weight:700;color:#aaa;margin-bottom:8px">Stream Title (optional)</div>';
  h += '<input id="_stTitle" type="text" value="' + (curT || '') + '" maxlength="40" placeholder="e.g. Solo Ranked Match!" style="width:100%;padding:12px;border-radius:12px;border:1.5px solid rgba(255,255,255,.1);background:rgba(255,255,255,.06);color:#fff;font-size:13px;box-sizing:border-box;margin-bottom:14px">';

  var rowBorder = isLive ? 'rgba(255,68,68,.4)' : 'rgba(255,255,255,.1)';
  var rowBg     = isLive ? 'rgba(255,68,68,.07)' : 'rgba(255,255,255,.04)';
  var dotBg     = isLive ? '#ff4444' : '#555';
  var toggleBg  = isLive ? '#ff4444' : 'rgba(255,255,255,.1)';
  h += '<div onclick="window._togLive&&window._togLive()" id="_liveTogRow" style="display:flex;align-items:center;justify-content:space-between;padding:14px;border-radius:13px;border:1.5px solid ' + rowBorder + ';background:' + rowBg + ';cursor:pointer;margin-bottom:16px">';
  h += '<div style="display:flex;align-items:center;gap:10px">';
  h += '<div id="_liveDot" style="width:10px;height:10px;border-radius:50%;background:' + dotBg + ';' + (isLive ? 'animation:livePulse 1s ease-in-out infinite' : '') + '"></div>';
  h += '<span id="_liveLabel" style="font-size:14px;font-weight:700;color:#fff">' + (isLive ? '🔴 Abhi LIVE ho' : 'Go Live') + '</span></div>';
  h += '<div id="_liveTog" style="width:44px;height:24px;border-radius:12px;background:' + toggleBg + ';position:relative;transition:all .3s"><div style="position:absolute;top:2px;' + (isLive ? 'right' : 'left') + ':2px;width:20px;height:20px;border-radius:50%;background:#fff;transition:all .3s"></div></div>';
  h += '</div>';

  h += '<button onclick="window._saveStreamSettings()" style="width:100%;padding:14px;border-radius:13px;border:none;background:linear-gradient(135deg,#ff4444,#cc0000);color:#fff;font-size:14px;font-weight:900;cursor:pointer;box-shadow:0 4px 16px rgba(255,68,68,.35)">💾 Save Stream Settings</button>';

  var _isLive = isLive;

  window._togLive = function() {
    _isLive = !_isLive;
    var row  = document.getElementById('_liveTogRow');
    var tog  = document.getElementById('_liveTog');
    var dot  = document.getElementById('_liveDot');
    var lbl  = document.getElementById('_liveLabel');
    if (row) {
      row.style.borderColor = _isLive ? 'rgba(255,68,68,.4)' : 'rgba(255,255,255,.1)';
      row.style.background  = _isLive ? 'rgba(255,68,68,.07)' : 'rgba(255,255,255,.04)';
    }
    if (tog) tog.style.background = _isLive ? '#ff4444' : 'rgba(255,255,255,.1)';
    if (dot) dot.style.background = _isLive ? '#ff4444' : '#555';
    if (lbl) lbl.textContent = _isLive ? '🔴 Abhi LIVE ho' : 'Go Live';
  };

  /* ── BUG FIX: Save to BOTH Supabase AND Firebase ── */
  window._saveStreamSettings = function() {
    var link  = (document.getElementById('_stLink')  || {}).value || '';
    var title = (document.getElementById('_stTitle') || {}).value || '';
    link  = link.trim();
    title = title.trim();

    if (_isLive && !link) {
      if (window.toast) toast('Live link daalo pehle!', 'err'); return;
    }

    var saved = false;
    function _done() {
      if (saved) return; saved = true;
      /* Update local UD cache */
      if (window.UD) {
        window.UD.streamLink  = link;  window.UD.stream_link  = link;
        window.UD.streamTitle = title; window.UD.stream_title = title;
        window.UD.isLive      = _isLive; window.UD.is_live    = _isLive;
      }
      if (window.toast) toast(_isLive ? '🔴 Ab tum LIVE ho! Viewers dekh sakte hain.' : '✅ Stream settings save ho gaye!', 'ok');
      if (window.closeModal) closeModal();
    }

    /* 1. Supabase save (primary DB) */
    if (window._supa && window.U) {
      window._supa.from('users').update({
        stream_link:  link  || null,
        stream_title: title || null,
        is_live:      _isLive
      }).eq('id', uid).then(function(r) {
        if (r && r.error) console.warn('[Stream] Supabase save error:', r.error);
        _done();
      }).catch(function(e) { console.warn('[Stream] Supabase error:', e); _done(); });
    }

    /* 2. Firebase RTDB (for live feed widget) */
    if (window.db) {
      var updates = {};
      updates['users/' + uid + '/streamLink']  = link;
      updates['users/' + uid + '/streamTitle'] = title;
      updates['users/' + uid + '/isLive']      = _isLive;
      updates['liveStreams/' + uid] = _isLive ? {
        ign:       (window.UD && window.UD.ign) || 'Player',
        title:     title || ((window.UD && window.UD.ign) || '') + '\'s Stream',
        link:      link,
        live:      true,
        viewers:   0,
        avatar:    (window.UD && window.UD.ign) ? window.UD.ign.charAt(0) : '🎮',
        updatedAt: Date.now()
      } : null;
      window.db.ref().update(updates, function() {
        if (!window._supa) _done(); /* If no Supabase, done after Firebase */
      });
    }

    /* If neither DB available */
    if (!window._supa && !window.db) {
      if (window.toast) toast('Database unavailable', 'err');
    }
  };

  if (window.openModal) openModal('📺 Stream Settings', h);
};

/* ── Watch Live button on profiles ── */
window.addWatchLiveBtn = function(profileUid, container) {
  if (!window.db || !profileUid || !container) return;
  window.db.ref('users/' + profileUid + '/isLive').once('value', function(s) {
    if (!s.val()) return;
    window.db.ref('users/' + profileUid + '/streamLink').once('value', function(sl) {
      var link = sl.val(); if (!link) return;
      var btn = document.createElement('a');
      btn.href = link; btn.target = '_blank'; btn.rel = 'noopener';
      btn.style.cssText = 'display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:10px;background:rgba(255,68,68,.15);border:1px solid rgba(255,68,68,.3);color:#ff8888;font-size:12px;font-weight:700;text-decoration:none;margin:6px 0';
      btn.innerHTML = '<div style="width:7px;height:7px;border-radius:50%;background:#ff4444;animation:livePulse 1s ease-in-out infinite"></div> Watch Live 📺';
      container.appendChild(btn);
    });
  });
};

/* CSS */
if (!document.getElementById('_liveStyle')) {
  var st = document.createElement('style');
  st.id = '_liveStyle';
  st.textContent = '@keyframes livePulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.3);opacity:.7}}';
  document.head.appendChild(st);
}

console.log('[Stream] spectator.js v32-FIX ✅ — Supabase + Firebase dual save');
})();
