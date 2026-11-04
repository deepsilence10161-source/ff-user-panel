/* ====== FEATURE 8: SHAREABLE PLAYER PROFILE CARD (v2 — D36 exact replica) ======
   Ab share image bhi owner-approved design jaisi BANTI hai: PCARD2 core
   base art + wahi coordinate table canvas par draw karta hai. */

(function() {
  window.generateProfileCard = function() {
    if (!UD || !U) { toast('Login required', 'err'); return; }
    var stats = UD.stats || {};
    var m = Number(stats.matches || 0), k = Number(stats.kills || 0), w = Number(stats.wins || 0);
    var rk = calcRk(stats);
    var data = {
      name: UD.ign || UD.displayName || 'Player',
      uid: UD.ffUid || UD.ff_uid || '—',
      level: 1, xp: 0, xpNeed: 10,
      pts: Number(UD.rank_points || 0),
      tier: String(rk.badge || 'Bronze'),
      stats: [m, k, w, m ? (k / m).toFixed(1) : '0.0', (m ? Math.round(w / m * 100) : 0) + '%']
    };
    var go = function () {
      window.PCARD2.loadImg(function (img) {
        var cw = 1000;
        var canvas = document.createElement('canvas');
        canvas.width = cw;
        canvas.height = Math.round(cw * window.PCARD2.H / window.PCARD2.W);
        var ctx = canvas.getContext('2d');
        window.PCARD2.draw(ctx, data, cw, img);
        shareCanvas(canvas);
      });
    };
    /* battle-pass XP async bharo, phir draw */
    if (window._supa && U.uid) {
      window._supa.from('battle_pass_progress').select('current_xp,current_tier').eq('user_id', U.uid).maybeSingle().then(function (r) {
        var cx = (r && r.data && Number(r.data.current_xp)) || 0;
        var lv = ((r && r.data && Number(r.data.current_tier)) || Math.floor(cx / 100)) + 1;
        var need = 10 * lv;
        data.level = lv; data.xp = cx % need; data.xpNeed = need;
        go();
      }).catch(go);
    } else go();
  };

  function shareCanvas(canvas) {
    try {
      canvas.toBlob(function(blob) {
        if (!blob) { downloadCanvas(canvas); return; }
        if (navigator.share && navigator.canShare) {
          var file = new File([blob], 'mini-esports-profile.png', { type: 'image/png' });
          if (navigator.canShare({ files: [file] })) {
            navigator.share({
              title: 'My Mini eSports Profile',
              text: '🎮 Check out my eSports profile!',
              files: [file]
            }).catch(function() { downloadCanvas(canvas); });
          } else {
            downloadCanvas(canvas);
          }
        } else {
          downloadCanvas(canvas);
        }
      }, 'image/png');
    } catch (e) {
      downloadCanvas(canvas);
    }
  }

  function downloadCanvas(canvas) {
    var link = document.createElement('a');
    link.download = 'mini-esports-profile.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
    toast('Profile card downloaded!', 'ok');
  }

  console.log('[Mini eSports] ✅ Feature 8: Profile Card v2 (exact replica) loaded');
})();
