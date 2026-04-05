/* =============================================
   FEATURE 24: Result Screenshot + OCR (Puter.js)
   - Admin-uploaded result screenshot viewer
   - User screenshot upload with 2MB limit
   - OCR via Puter.js for auto-extracting rank & kills
   ============================================= */
(function() {
  'use strict';

  /* ─── 2MB file size limit helper ─── */
  window.checkScreenshotSize = function(file) {
    if (!file) return false;
    if (file.size > 2 * 1024 * 1024) {
      if (window.toast) window.toast('Screenshot 2MB se chhoti honi chahiye', 'err');
      return false;
    }
    return true;
  };

  /* ─── OCR via Puter.js ─── */
  window.extractResultFromScreenshot = async function(imageFile) {
    try {
      if (!window.puter || !window.puter.ai || !window.puter.ai.ocr) {
        throw new Error('Puter.js not loaded');
      }
      var result = await window.puter.ai.ocr(imageFile);
      var text = (result && result.text) ? result.text : (typeof result === 'string' ? result : '');
      // Parse rank and kills from OCR text
      var rankMatch = text.match(/#?(\d+)\s*(rank|place|position)?/i) || text.match(/rank[:\s]+(\d+)/i);
      var killMatch = text.match(/(\d+)\s*kills?/i) || text.match(/kills?[:\s]+(\d+)/i);
      return {
        rank: rankMatch ? parseInt(rankMatch[1]) : null,
        kills: killMatch ? parseInt(killMatch[1]) : null,
        rawText: text
      };
    } catch(e) {
      console.warn('[OCR] Failed:', e.message);
      return { rank: null, kills: null, rawText: '' };
    }
  };

  /* ─── Upload result screenshot with 2MB check ─── */
  window.uploadResultScreenshot = function(file, matchId, onDone) {
    if (!window.checkScreenshotSize(file)) return;
    var reader = new FileReader();
    reader.onload = function(e) {
      var b64 = e.target.result;
      if (window.db && matchId) {
        window.db.ref('resultSubmissions/' + (window.U && window.U.uid) + '/' + matchId).set({
          screenshot: b64,
          submittedAt: Date.now(),
          matchId: matchId
        });
      }
      if (onDone) onDone(b64);
    };
    reader.readAsDataURL(file);
  };

  /* ─── Show OCR result autofill popup ─── */
  window.showOCRResult = function(matchId, file) {
    if (!window.checkScreenshotSize(file)) return;
    if (window.toast) window.toast('OCR se rank & kills nikaal raha hai...', 'inf');
    window.extractResultFromScreenshot(file).then(function(parsed) {
      var h = '<div style="text-align:center;padding:8px">';
      h += '<div style="font-size:36px;margin-bottom:8px">🔍</div>';
      h += '<div style="font-size:14px;font-weight:700;margin-bottom:12px">OCR Result</div>';
      if (parsed.rank !== null || parsed.kills !== null) {
        h += '<div style="background:rgba(0,255,156,.08);border:1px solid rgba(0,255,156,.2);border-radius:10px;padding:12px;margin-bottom:12px">';
        if (parsed.rank !== null) h += '<div style="font-size:16px;font-weight:800">🏆 Rank: <span style="color:var(--green)">' + parsed.rank + '</span></div>';
        if (parsed.kills !== null) h += '<div style="font-size:16px;font-weight:800;margin-top:6px">💀 Kills: <span style="color:#ff6b6b">' + parsed.kills + '</span></div>';
        h += '</div>';
        h += '<div style="font-size:11px;color:var(--txt2);margin-bottom:12px">Auto-detected. Galat ho to manually correct karo.</div>';
      } else {
        h += '<div style="color:var(--txt2);font-size:13px;margin-bottom:12px">Auto-detect nahi hua. Manually enter karo.</div>';
      }
      // Input fields for manual correction
      h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">';
      h += '<div><label style="font-size:11px;color:var(--txt2)">Final Rank</label><input id="_ocrRank" type="number" value="' + (parsed.rank||'') + '" placeholder="1-50" style="width:100%;padding:10px;border-radius:10px;background:var(--card2);border:1px solid var(--border);color:var(--txt);box-sizing:border-box"></div>';
      h += '<div><label style="font-size:11px;color:var(--txt2)">Total Kills</label><input id="_ocrKills" type="number" value="' + (parsed.kills||'') + '" placeholder="0-30" style="width:100%;padding:10px;border-radius:10px;background:var(--card2);border:1px solid var(--border);color:var(--txt);box-sizing:border-box"></div>';
      h += '</div>';
      h += '<button onclick="window._submitOCRResult(\'' + matchId + '\')" style="width:100%;padding:12px;border-radius:12px;background:linear-gradient(135deg,#00ff9c,#00cc7a);color:#000;font-weight:800;border:none;cursor:pointer">✅ Submit Result</button>';
      h += '</div>';
      if (window.openModal) window.openModal('📸 Result Screenshot', h);
    });
  };

  window._submitOCRResult = function(matchId) {
    var rank = parseInt((document.getElementById('_ocrRank')||{}).value) || 0;
    var kills = parseInt((document.getElementById('_ocrKills')||{}).value) || 0;
    if (!rank) { if (window.toast) window.toast('Rank enter karo', 'err'); return; }
    if (window.db && window.U) {
      window.db.ref('resultSubmissions/' + window.U.uid + '/' + matchId).update({
        rank: rank, kills: kills, submittedAt: Date.now()
      });
      // Update user stats
      window.db.ref('users/' + window.U.uid + '/stats/kills').transaction(function(k) { return (k||0) + kills; });
    }
    if (window.closeModal) window.closeModal();
    if (window.toast) window.toast('Result submit hua! Admin verify karega.', 'ok');
  };

  /* ─── View admin-uploaded result screenshot ─── */
  function checkResultScreenshots() {
    if (!window.db || !window.JR) return;
    for (var k in window.JR) {
      var jr = window.JR[k];
      if (jr.resultStatus !== 'completed') continue;
      var mid = jr.matchId || jr.tournamentId;
      if (!mid) continue;
      (function(matchId) {
        window.db.ref('matches/' + matchId + '/resultScreenshot').once('value', function(s) {
          if (s.val()) {
            window._resultScreenshots = window._resultScreenshots || {};
            window._resultScreenshots[matchId] = s.val();
          }
        });
      })(mid);
    }
  }

  function showResultScreenshot(matchId, matchName) {
    var sc = window._resultScreenshots && window._resultScreenshots[matchId];
    if (!sc) {
      if (window.toast) window.toast('Result screenshot abhi available nahi hai', 'err');
      return;
    }
    if (!window.openModal) return;
    var h = '<div style="text-align:center">' +
      '<div style="font-size:12px;color:var(--txt2);margin-bottom:10px">Admin-uploaded match result</div>' +
      '<img src="' + sc + '" style="width:100%;border-radius:10px;border:1px solid var(--border)">' +
      '<button onclick="if(window.closeModal)closeModal()" style="width:100%;margin-top:12px;padding:12px;border-radius:12px;background:var(--primary);color:#000;font-weight:700;border:none;cursor:pointer">Close</button>' +
    '</div>';
    window.openModal('📸 ' + (matchName || 'Match') + ' Result', h);
  }

  var _try = 0;
  var _int = setInterval(function() {
    _try++;
    if (window.db && window.JR) { clearInterval(_int); checkResultScreenshots(); }
    if (_try > 60) clearInterval(_int);
  }, 1000);

  window.f24ResultSS = { check: checkResultScreenshots, show: showResultScreenshot };
  window.showResultScreenshot = showResultScreenshot;
})();
