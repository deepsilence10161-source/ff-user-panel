/* ====== FEATURE 2: SMART ROOM ID REVEAL WITH COUNTDOWN ====== */
/* Shows countdown to room reveal, then animated popup with copy */

(function() {
  var _roomInterval = null;

  function updateRoomCountdowns() {
    if (_roomInterval) clearInterval(_roomInterval);
    _roomInterval = setInterval(function() {
      for (var mid in MT) {
        var t = MT[mid];
        if (!t || !hasJ(mid)) continue;
        var el = document.getElementById('room-cd-' + mid);
        if (!el) continue;

        var mt = Number(t.matchTime);
        if (!mt) continue;
        var diff = mt - Date.now();
        var revealTime = mt - 90000; // 90 seconds before match
        var revealDiff = revealTime - Date.now();

        if (t.roomStatus === 'released' && t.roomId && t.roomPassword) {
          // Room is released — show it
          if (revealDiff <= 0 || diff <= 0) {
            /* Bug M-5 Fix: Use data-copy attributes instead of inline onclick
             to safely handle room IDs/passwords with single quotes or special chars */
          var safeRoomId  = (t.roomId || '').replace(/'/g, "&#x27;");
          var safeRoomPw  = (t.roomPassword || '').replace(/'/g, "&#x27;");
          var copyIdBtn   = '<button data-copy-val="' + safeRoomId + '" class="_roomCopyBtn" style="background:rgba(0,255,106,.15);border:none;color:var(--green);padding:4px 8px;border-radius:6px;font-size:11px;cursor:pointer"><i class="fas fa-copy"></i> Copy</button>';
          var copyPwBtn   = '<button data-copy-val="' + safeRoomPw + '" class="_roomCopyBtn" style="background:rgba(0,255,106,.15);border:none;color:var(--green);padding:4px 8px;border-radius:6px;font-size:11px;cursor:pointer"><i class="fas fa-copy"></i> Copy</button>';
          el.innerHTML = '<div style="background:rgba(0,255,106,.08);border:1px solid rgba(0,255,106,.2);border-radius:10px;padding:10px;margin-top:6px">' +
              '<div style="font-size:11px;color:var(--txt2);text-transform:uppercase;margin-bottom:4px">🔑 Room ID</div>' +
              '<div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:18px;font-weight:900;color:var(--green)">' + (t.roomId||'') + '</span>' + copyIdBtn + '</div>' +
              '<div style="font-size:11px;color:var(--txt2);text-transform:uppercase;margin-top:6px;margin-bottom:4px">🔒 Password</div>' +
              '<div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:18px;font-weight:900;color:var(--green)">' + (t.roomPassword||'') + '</span>' + copyPwBtn + '</div></div>';
          /* Attach safe copy handlers */
          setTimeout(function() {
            el.querySelectorAll('._roomCopyBtn').forEach(function(btn) {
              btn.onclick = function() {
                var txt = btn.getAttribute('data-copy-val') || '';
                if (window.copyTxt) copyTxt(txt);
                else if (navigator.clipboard) navigator.clipboard.writeText(txt).catch(function(){});
                else { var ta = document.createElement('textarea'); ta.value = txt; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); }
              };
            });
          }, 50);
          } else {
            // Show countdown to reveal
            var mins = Math.floor(revealDiff / 60000);
            var secs = Math.floor((revealDiff % 60000) / 1000);
            el.innerHTML = '<div style="background:rgba(0,212,255,.08);border:1px solid rgba(0,212,255,.2);border-radius:10px;padding:10px;margin-top:6px;text-align:center">' +
              '<div style="font-size:11px;color:var(--blue);margin-bottom:4px"><i class="fas fa-clock"></i> Room reveals in</div>' +
              '<div style="font-size:20px;font-weight:900;color:var(--blue)">' + mins + ':' + String(secs).padStart(2, '0') + '</div></div>';
          }
        } else {
          el.innerHTML = '<div style="font-size:11px;color:var(--txt2);padding:6px 0"><i class="fas fa-clock"></i> Room details will be shared soon</div>';
        }
      }
    }, 1000);
  }

  window.updateRoomCountdowns = updateRoomCountdowns;

  // Auto-start when My Matches renders
  var _origRenderMM = window.renderMM;
  if (_origRenderMM) {
    window.renderMM = function() {
      _origRenderMM();
      setTimeout(updateRoomCountdowns, 100);
    };
  }

  console.log('[Mini eSports] ✅ Feature 2: Room Reveal loaded');
})();
