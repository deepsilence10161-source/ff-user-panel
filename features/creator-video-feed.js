/* ================================================================
   CREATOR VIDEO FEED — features/creator-video-feed.js
   User Panel v32 | MiniEsports
   
   Features:
   - Renders all live creator videos (YouTube + Instagram embeds)
   - 20-second watch detection → credits coins (1x per video/day)
   - Daily per-video per-user watch tracking (Firebase: videoWatched/)
   - Report button → counts reports → auto-hides at threshold
   - Auto-hide push notification to admin
   
   Firebase paths used:
     creatorVideos/{videoId}
     videoReports/{videoId}/{uid}
     videoWatched/{uid}/{date}/{videoId}
   
   Supabase:
     creator_videos (read), video_watches (write), video_reports (write)
   ================================================================ */

(function() {
'use strict';

function db()  { return window.rtdb || window.db; }
function uid() { return window.U && window.U.uid; }
function ud()  { return window.UD || {}; }
function toast(msg, type) { if (window.showToast) showToast(msg, type === 'err'); else alert(msg); }
function todayKey() { return new Date().toISOString().slice(0,10).replace(/-/g,''); }

/* ─── Render Video Feed Section ─────────────────────────────────── */
window.renderCreatorVideoFeed = function(containerId) {
  var cont = document.getElementById(containerId || 'creatorVideoFeedContainer');
  if (!cont) return;

  if (!db()) {
    cont.innerHTML = '<div style="text-align:center;padding:30px;color:#666">Loading...</div>';
    setTimeout(function(){ window.renderCreatorVideoFeed(containerId); }, 1000);
    return;
  }

  // Check if video system is ON
  if (Number((window.CFG && window.CFG.videoEnabled) || 1) === 0) {
    cont.innerHTML = '<div style="text-align:center;padding:30px;color:#888">Creator videos abhi available nahi hain.</div>';
    return;
  }

  cont.innerHTML = '<div style="text-align:center;padding:24px;color:#666"><i class="fas fa-spinner fa-spin" style="font-size:20px"></i></div>';

  db().ref('creatorVideos').orderByChild('status').equalTo('live').limitToLast(30)
    .once('value', function(snap) {
      var videos = [];
      snap.forEach(function(c) {
        var v = c.val();
        v._id = c.key;
        videos.push(v);
      });
      videos.sort(function(a,b){ return (b.createdAt||0) - (a.createdAt||0); });
      _renderVideoList(cont, videos);
    });
};

function _renderVideoList(cont, videos) {
  if (!videos.length) {
    cont.innerHTML = '<div style="text-align:center;padding:30px;color:#888">📹 Abhi koi creator video nahi hai. Creators jald hi share karenge!</div>';
    return;
  }

  var coinsPerVideo = Number((window.CFG && window.CFG.videoWatchCoins) || 5);
  var html = '';
  html += '<div style="font-size:11px;color:#888;margin-bottom:12px;text-align:center">▶️ ' + coinsPerVideo + ' 🪙 coins milenge har video ke baad (1 baar/din)</div>';
  html += '<div style="display:grid;gap:14px">';

  videos.forEach(function(v) {
    var embedHtml = _buildEmbed(v);
    var platIcon  = v.platform === 'instagram' ? '📸 Instagram' : '▶️ YouTube';

    html += '<div id="vcard_' + v._id + '" style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:16px;overflow:hidden">';
    // Embed
    html += '<div style="position:relative;padding-top:56.25%;background:#000">';
    html += embedHtml;
    html += '</div>';
    // Info + controls
    html += '<div style="padding:12px">';
    html += '<div style="font-size:13px;font-weight:700;color:#fff;margin-bottom:4px">' + _esc(v.title) + '</div>';
    if (v.description) {
      html += '<div style="font-size:11px;color:#888;margin-bottom:8px">' + _esc(v.description) + '</div>';
    }
    html += '<div style="display:flex;justify-content:space-between;align-items:center">';
    html += '<span style="font-size:11px;color:#555">' + platIcon + '</span>';
    html += '<div style="display:flex;gap:8px">';
    // Coin earn button (appears after watching)
    html += '<button id="earnBtn_' + v._id + '" onclick="claimVideoCoins(\'' + v._id + '\')" ' +
      'style="display:none;padding:6px 12px;border-radius:20px;background:rgba(255,215,0,.1);border:1px solid rgba(255,215,0,.25);color:#ffd700;font-size:11px;font-weight:700;cursor:pointer">' +
      '🪙 +' + coinsPerVideo + ' Claim</button>';
    // Report button
    html += '<button onclick="reportCreatorVideo(\'' + v._id + '\')" ' +
      'style="padding:6px 10px;border-radius:20px;background:rgba(255,60,60,.07);border:1px solid rgba(255,60,60,.15);color:#ff8888;font-size:11px;cursor:pointer">🚩 Report</button>';
    html += '</div></div>'; // flex end
    html += '</div>'; // info
    html += '</div>'; // card
  });

  html += '</div>';
  cont.innerHTML = html;

  // Setup watch timers for each video
  videos.forEach(function(v) {
    _setupWatchTimer(v._id);
  });
}

function _buildEmbed(v) {
  if (v.platform === 'youtube' || !v.platform) {
    var ytId = _extractYTId(v.link);
    if (ytId) {
      return '<iframe style="position:absolute;top:0;left:0;width:100%;height:100%;border:0" ' +
        'src="https://www.youtube.com/embed/' + ytId + '?enablejsapi=1&origin=' + encodeURIComponent(window.location.origin) + '" ' +
        'id="ytframe_' + v._id + '" allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope" allowfullscreen></iframe>';
    }
  }
  if (v.platform === 'instagram') {
    return '<blockquote class="instagram-media" data-instgrm-permalink="' + _esc(v.link) + '" ' +
      'style="position:absolute;top:0;left:0;width:100%;height:100%;border:0"></blockquote>';
  }
  // Fallback: direct link
  return '<div style="position:absolute;top:0;left:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center">' +
    '<a href="' + _esc(v.link) + '" target="_blank" rel="noopener" style="color:#00d4ff;font-size:13px">🔗 Video Open Karo</a></div>';
}

/* ─── Watch Timer (20-second detection) ─────────────────────────── */
var _watchTimers = {};

function _setupWatchTimer(videoId) {
  // Check if already watched today
  var userId = uid();
  if (!userId || !db()) return;
  var today = todayKey();

  db().ref('videoWatched/' + userId + '/' + today + '/' + videoId).once('value', function(s) {
    if (s.val()) {
      // Already watched — show "Watched" badge instead of earn button
      var btn = document.getElementById('earnBtn_' + videoId);
      if (btn) { btn.style.display = 'inline-flex'; btn.textContent = '✅ Watched'; btn.disabled = true; btn.style.opacity = '0.5'; btn.onclick = null; }
      return;
    }

    // Start intersection observer — only count watch when video is in view
    var card = document.getElementById('vcard_' + videoId);
    if (!card) return;

    var obs = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          // Start timer
          if (!_watchTimers[videoId]) {
            _watchTimers[videoId] = setTimeout(function() {
              _markVideoWatched(videoId);
            }, 20000); // 20 seconds
          }
        } else {
          // Clear timer if user scrolled away
          if (_watchTimers[videoId]) {
            clearTimeout(_watchTimers[videoId]);
            delete _watchTimers[videoId];
          }
        }
      });
    }, { threshold: 0.5 });
    obs.observe(card);
  });
}

function _markVideoWatched(videoId) {
  var userId = uid();
  if (!userId) return;
  var today = todayKey();
  delete _watchTimers[videoId];

  // Check daily limit
  var dailyLimit = Number((window.CFG && window.CFG.videoDailyLimit) || 10);
  db().ref('videoWatched/' + userId + '/' + today).once('value', function(daySnap) {
    var watchedCount = 0;
    daySnap.forEach(function() { watchedCount++; });

    if (watchedCount >= dailyLimit) {
      // Already at daily limit — show as watched but no coins
      var btn = document.getElementById('earnBtn_' + videoId);
      if (btn) { btn.style.display = 'inline-flex'; btn.textContent = '📅 Daily limit'; btn.disabled = true; btn.style.opacity = '0.5'; btn.onclick = null; }
      return;
    }

    // Show claim button
    var btn = document.getElementById('earnBtn_' + videoId);
    if (btn) { btn.style.display = 'inline-flex'; }

    // Mark as watched in Firebase (before claim to prevent double-tap)
    db().ref('videoWatched/' + userId + '/' + today + '/' + videoId).set(true);

    // Log watch event in Supabase
    var coinsPerVideo = Number((window.CFG && window.CFG.videoWatchCoins) || 5);
    if (window._supa) {
      window._supa.from('video_watches').insert({
        user_uid: userId, video_id: videoId,
        watched_at: new Date().toISOString(), coins_earned: coinsPerVideo,
      }).catch(function(){});
    }
  });
}

window.claimVideoCoins = function(videoId) {
  var userId = uid();
  if (!userId || !db()) return;
  var coinsPerVideo = Number((window.CFG && window.CFG.videoWatchCoins) || 5);

  // Credit coins via Firebase transaction
  db().ref('users/' + userId + '/coins').transaction(function(coins) {
    return (coins || 0) + coinsPerVideo;
  }, function(err) {
    if (err) { toast('Coins credit error: ' + err.message, 'err'); return; }
    // Log wallet transaction in Supabase
    if (window._supa) {
      window._supa.from('wallet_transactions').insert({
        user_id: userId, txn_type: 'credit', amount: coinsPerVideo,
        currency: 'coins', reason: 'creator_video_watch',
        created_at: new Date().toISOString(),
      }).catch(function(){});
    }
    // Update coin display
    var currentCoins = (window.UD && window.UD.coins) || 0;
    if (window.UD) window.UD.coins = currentCoins + coinsPerVideo;
    if (window.updateHdr) window.updateHdr();

    // Show claimed state
    var btn = document.getElementById('earnBtn_' + videoId);
    if (btn) {
      btn.textContent = '✅ +' + coinsPerVideo + ' Claimed!';
      btn.disabled = true;
      btn.style.opacity = '0.6';
      btn.style.background = 'rgba(0,255,156,.1)';
      btn.style.borderColor = 'rgba(0,255,156,.2)';
      btn.style.color = '#00ff9c';
      btn.onclick = null;
    }
    toast('🪙 +' + coinsPerVideo + ' coins mila! Video dekhne ke liye shukriya.', 'ok');
  });
};

/* ─── Report Video ───────────────────────────────────────────────── */
window.reportCreatorVideo = function(videoId) {
  var userId = uid();
  if (!userId) { toast('Login karo pehle.', 'err'); return; }
  if (!db()) return;

  // Show reason picker
  var reasons = ['Inappropriate Content', 'Spam/Fake', 'Abuse/Harassment', 'Cheating/Hacks', 'Other'];
  var h = '<div style="display:grid;gap:8px">';
  reasons.forEach(function(r) {
    h += '<button onclick="submitVideoReport(\'' + videoId + '\',\'' + r + '\')" ' +
      'style="padding:11px;border-radius:10px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);color:#aaa;text-align:left;font-size:13px;cursor:pointer">' + r + '</button>';
  });
  h += '</div>';
  if (window.openModal) openModal('🚩 Report Video', h);
};

window.submitVideoReport = function(videoId, reason) {
  var userId = uid();
  if (!userId || !db()) return;

  // Check: already reported this video?
  db().ref('videoReports/' + videoId + '/' + userId).once('value', function(s) {
    if (s.val()) {
      toast('Aapne ye video pehle se report kiya hua hai.', 'err');
      if (window.closeModal) closeModal();
      return;
    }

    // Write report
    var reportData = { reason: reason, timestamp: Date.now() };
    db().ref('videoReports/' + videoId + '/' + userId).set(reportData);

    // Mirror to Supabase
    if (window._supa) {
      window._supa.from('video_reports').insert({
        video_id: videoId, reporter_uid: userId, reason: reason,
        created_at: new Date().toISOString(), resolved: false,
      }).catch(function(){});
    }

    // Increment report count + check auto-hide threshold
    db().ref('creatorVideos/' + videoId + '/reportCount').transaction(function(count) {
      return (count || 0) + 1;
    }, function(err, committed, snap) {
      if (err || !committed) return;
      var newCount = snap.val();
      var threshold = Number((window.CFG && window.CFG.videoAutoHideReports) || 5);

      if (newCount >= threshold) {
        // Auto-hide the video
        db().ref('creatorVideos/' + videoId).update({
          status: 'auto_hidden',
          autoHiddenAt: Date.now(),
        });

        // Mirror status to Supabase
        if (window._supa) {
          window._supa.from('creator_videos').update({ status: 'auto_hidden' })
            .eq('firebase_id', videoId)
            .catch(function(){});
        }

        // Notify admin via Firebase adminAlerts + OneSignal
        db().ref('adminAlerts').push({
          type:    'video_auto_hidden',
          videoId: videoId,
          reports: newCount,
          message: '⚠️ Video auto-hidden: ' + newCount + ' reports. Review required.',
          createdAt: Date.now(),
        });

        // Hide card from user's feed immediately
        var card = document.getElementById('vcard_' + videoId);
        if (card) {
          card.style.opacity = '0';
          card.style.transition = 'opacity 0.4s';
          setTimeout(function(){ if (card.parentNode) card.parentNode.removeChild(card); }, 500);
        }
      }
    });

    toast('Report submit ho gaya. Shukriya!', 'ok');
    if (window.closeModal) closeModal();
  });
};

/* ─── Helpers ────────────────────────────────────────────────────── */
function _extractYTId(url) {
  var match = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

function _esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

console.log('✅ creator-video-feed.js loaded');
})();
