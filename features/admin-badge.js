/* ================================================================
   ADMIN RESPONSE TIME BADGE — admin-badge.js

   Track karo admin response time:
   - Dispute/support submit hone ka time
   - Admin response dene ka time
   - Average calculate karo

   Firebase:
   appSettings/adminResponseStats: { totalResponded, totalTimeMs, avgResponseMs }

   ✅ D95 (2026-11-09, owner live report):
   1) "Mini eSports Admin hamesha Active show hota hai" — purana code
      bina koi data load hue default badge '⚡ Active' dikha deta tha
      (jab adminResponseStats read na ho ya khali ho). Ye JHOOTH status
      tha. Ab: default = neutral 'Support Team' (koi presence claim
      nahi); asli presence sirf verified data se aati hai
      (appSettings/supportOnline WS + REST fallback): true → 'Online',
      false/unknown → 'Away'. 'Active' literal ab kahin nahi hai.
   2) "Match Dispute par click karte hi screen back ho jati hai" —
      purana button sheet band karke user ko matches screen par phek
      deta tha (dispute form kahin nahi tha).
      Ab button window.showMatchDisputeForm() kholta hai: recent match
      picker + reason + details → support_tickets me 'match_dispute'
      ticket (server-authoritative insert, retry ke saath).
   3) Poora Help & Support sheet stylish redesign (gradient card,
      icon tiles, presence pill).
================================================================ */

(function() {
'use strict';

var _responseStats = null;
/* ✅ D95: verified presence — null = abhi pata nahi (kabhi 'Active'
   jaisa claim nahi karte) */
var _presence = null;

/* ── Load admin response stats ── */
window.loadAdminResponseStats = function() {
  if (!window.db) { setTimeout(window.loadAdminResponseStats, 1000); return; }
  window.db.ref('appSettings/adminResponseStats').on('value', function(snap) {
    _responseStats = snap.val();
  });
  /* ✅ D95: presence bhi subscribe karo (WS) + REST fallback neeche */
  try {
    window.db.ref('appSettings/supportOnline').on('value', function(snap) {
      _presence = !!snap.val();
    });
  } catch (e) {}
  _startPresenceRestPoll();
};

/* ✅ D95: Firebase REST se presence padho — WS ate/atke hone par bhi
   asli status mile (D94 me prove hua tha WS unreliable networks par
   atak jata hai). Rules allow na karein to chupchaap skip. */
function _restPresence() {
  try {
    var url = 'https://fft-app-1e283-default-rtdb.firebaseio.com/appSettings/supportOnline.json';
    fetch(url, { method: 'GET' }).then(function(r) {
      if (!r.ok) return;
      return r.json().then(function(v) { if (v === true || v === false) _presence = !!v; });
    }).catch(function() {});
  } catch (e) {}
}
function _startPresenceRestPoll() {
  if (window._presencePoll) return;
  window._presencePoll = true;
  _restPresence();
  setInterval(_restPresence, 45000);
}
window._supportPresence = function() { return _presence; };

/* ── Get badge text ── */
function getResponseBadge() {
  /* ✅ D95: stats na hon to NEUTRAL — koi jhootha 'Active' claim nahi.
     'Active' word poori file se hataya gaya hai. */
  if (!_responseStats || !_responseStats.totalResponded) {
    return { text: 'Support Team', color: '#9aa4b2', icon: '🛡️' };
  }
  var avgMs = _responseStats.avgResponseMs || 0;
  var avgHrs = avgMs / 3600000;
  var avgMins = avgMs / 60000;

  if (avgMins < 60) {
    return { text: 'Usually responds in ' + Math.round(avgMins) + ' min', color: '#00ff9c', icon: '⚡' };
  } else if (avgHrs < 6) {
    return { text: 'Usually responds in ' + Math.round(avgHrs) + ' hrs', color: '#ffd700', icon: '⏰' };
  } else if (avgHrs < 24) {
    return { text: 'Usually responds same day', color: '#ff9f1c', icon: '📅' };
  } else {
    return { text: 'Usually responds within 1-2 days', color: '#888', icon: '📬' };
  }
}

/* ✅ D95: asli presence pill — sirf verified data se */
function getPresencePill() {
  if (_presence === true) {
    return { html: '<span style="display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:20px;background:rgba(0,255,156,.12);border:1px solid rgba(0,255,156,.35);color:#00ff9c;font-size:11px;font-weight:800"><span style="width:7px;height:7px;border-radius:50%;background:#00ff9c;box-shadow:0 0 8px #00ff9c"></span>Online abhi</span>' };
  }
  if (_presence === false) {
    return { html: '<span style="display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:20px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);color:#9aa4b2;font-size:11px;font-weight:800"><span style="width:7px;height:7px;border-radius:50%;background:#6b7280"></span>Away — message chhod do</span>' };
  }
  return { html: '<span style="display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:20px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);color:#9aa4b2;font-size:11px;font-weight:800">📨 Message chhodo — reply zaroor milega</span>' };
}

/* ── Render badge (shown in support/profile) ── */
window.renderAdminBadge = function() {
  var badge = getResponseBadge();
  return '<div style="display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:20px;padding:5px 12px">' +
    '<span style="font-size:12px">' + badge.icon + '</span>' +
    '<span style="font-size:11px;font-weight:700;color:' + badge.color + '">' + badge.text + '</span>' +
    '</div>';
};


/* ── Show support page with badge (✅ D95 stylish redesign) ── */
window.showSupportWithBadge = function() {
  var badge = getResponseBadge();
  var h = '';
  /* Admin hero card */
  h += '<div style="position:relative;overflow:hidden;border-radius:18px;padding:18px 14px 16px;margin-bottom:14px;text-align:center;' +
       'background:linear-gradient(150deg,rgba(0,255,156,.10),rgba(0,212,255,.05) 45%,rgba(185,100,255,.06));' +
       'border:1px solid rgba(0,255,156,.18)">';
  h += '<div style="position:absolute;inset:0;background:radial-gradient(120px 60px at 50% 0%,rgba(0,255,156,.16),transparent 70%);pointer-events:none"></div>';
  h += '<div style="width:56px;height:56px;margin:0 auto 8px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:26px;' +
       'background:linear-gradient(140deg,rgba(0,255,156,.2),rgba(0,212,255,.14));border:1px solid rgba(0,255,156,.4);box-shadow:0 0 18px rgba(0,255,156,.25)">🛡️</div>';
  h += '<div style="font-size:14px;font-weight:900;letter-spacing:.2px;margin-bottom:6px">Mini eSports Admin</div>';
  h += '<div style="display:flex;justify-content:center;gap:6px;flex-wrap:wrap;margin-bottom:8px">' + getPresencePill().html + '</div>';
  /* Response-time line sirf jab asli stats hon */
  if (_responseStats && _responseStats.totalResponded) {
    h += '<div style="font-size:10px;color:#8b93a0">' + badge.icon + ' ' + badge.text +
         (_responseStats.totalResponded > 5 ? ' · ' + _responseStats.totalResponded + '+ requests resolved' : '') + '</div>';
  }
  h += '</div>';

  /* Menu buttons — icon tiles + gradient hover */
  h += '<div style="display:flex;flex-direction:column;gap:9px">';
  [
    { icon:'⚠️', tile:'rgba(255,170,0,.14)', border:'rgba(255,170,0,.3)', label:'Match Dispute', sub:'Result/prize/room ki shikayat', call:'if(window.showMatchDisputeForm)showMatchDisputeForm()' },
    { icon:'💬', tile:'rgba(0,212,255,.12)', border:'rgba(0,212,255,.3)', label:'Support Chat', sub:'Admin se seedhi baat', call:"closeModal&&closeModal();navTo&&navTo('chat')" },
    /* ✅ D83: EK hub button — list ke andar "+ New Ticket" maujood hai */
    { icon:'🎫', tile:'rgba(185,100,255,.12)', border:'rgba(185,100,255,.3)', label:'Support Tickets', sub:'New ticket + admin replies', fn:'showMyTickets' },
    { icon:'📝', tile:'rgba(0,255,156,.1)', border:'rgba(0,255,156,.28)', label:'Feedback', sub:'App sudhaar ke sujhav', fn:'showMySuggestions' },
  ].forEach(function(btn) {
    var _oc = btn.call ? btn.call : ('if(window.' + btn.fn + ')' + btn.fn + '()');
    h += '<button onclick="' + _oc + '" style="display:flex;align-items:center;gap:11px;width:100%;padding:11px 12px;border-radius:14px;' +
         'background:linear-gradient(120deg,rgba(255,255,255,.05),rgba(255,255,255,.02));border:1px solid rgba(255,255,255,.09);' +
         'color:var(--txt);cursor:pointer;text-align:left">' +
         '<span style="width:36px;height:36px;flex-shrink:0;border-radius:11px;display:flex;align-items:center;justify-content:center;font-size:16px;' +
         'background:' + btn.tile + ';border:1px solid ' + btn.border + '">' + btn.icon + '</span>' +
         '<span style="flex:1;min-width:0"><span style="display:block;font-size:13px;font-weight:800">' + btn.label + '</span>' +
         '<span style="display:block;font-size:10px;color:#8b93a0;margin-top:1px">' + btn.sub + '</span></span>' +
         '<i class="fas fa-chevron-right" style="color:#5b6472;font-size:11px"></i>' +
         '</button>';
  });
  h += '</div>';

  if (window.openModal) openModal('🆘 Help & Support', h);
};


/* ══════════════════════════════════════════════════════════════════
   ✅ D95: MATCH DISPUTE FORM — purana button sheet band karke user ko
   matches screen par phek deta tha ("click karte hi back ho jati hai").
   Ab asli form: recent joined matches ka picker (Supabase), reason
   chips, details → support_tickets me 'match_dispute' ticket.
   ══════════════════════════════════════════════════════════════════ */
window.showMatchDisputeForm = function() {
  var uid = window.U && window.U.uid;
  if (!uid) { if (window.toast) toast('Pehle login karo', 'err'); return; }
  var h = '';
  h += '<div style="font-size:12px;color:#8b93a0;margin-bottom:10px">Kaunsa match? Select karo (ya manually likho), reason chuno aur detail likho — admin ko ticket chala jayega.</div>';
  h += '<div class="f-group"><label>Match</label><select class="f-input" id="dspMatch"><option value="">-- Select match --</option></select></div>';
  h += '<div class="f-group"><label>Ya match ka naam/ID likho</label><input class="f-input" id="dspMatchTxt" placeholder="e.g. TQKings win by ₹100 / match id" autocomplete="off"></div>';
  h += '<div class="f-group"><label>Reason</label><select class="f-input" id="dspReason">' +
       '<option value="galat_result">Galat result declare hua</option>' +
       '<option value="prize_nahi_mila">Prize/coins nahi mile</option>' +
       '<option value="room_issue">Room ID/password issue</option>' +
       '<option value="cheating">Cheating/teaming suspicion</option>' +
       '<option value="entry_refund">Entry fee refund chahiye</option>' +
       '<option value="other">Other</option></select></div>';
  h += '<div class="f-group"><label>Details</label><textarea class="f-input" id="dspMsg" placeholder="Poori baat likho — screenshots ka zikr zaroor karo..."></textarea></div>';
  h += '<button class="f-btn fb-green" onclick="submitMatchDispute()">⚠️ Dispute Submit Karo</button>';
  h += '<button class="f-btn" onclick="if(window.showMyTickets)showMyTickets()" style="margin-top:8px;background:rgba(255,255,255,.05);border:1px solid var(--border);color:var(--txt)">🎫 Mere Tickets Dekho</button>';
  if (window.openModal) openModal('⚠️ Match Dispute', h);
  /* Recent matches bhar do (fail ho to select khali — manual field hai) */
  _fillDisputeMatches(uid);
};

function _fillDisputeMatches(uid) {
  if (!window._supa) return;
  /* Jo matches user ne join kiye: match_participants (Match History jaisa) */
  window._supa.from('match_participants')
    .select('match_id, matches(id, match_name, match_time, status)')
    .eq('user_id', uid)
    .order('match_time', { ascending: false })
    .limit(15)
    .then(function(r) {
      var sel = document.getElementById('dspMatch');
      if (!sel) return;
      var rows = (r && r.data) || [];
      rows.forEach(function(p) {
        var m = p.matches || {};
        var nm = m.match_name || ('Match #' + String(p.match_id || '').slice(0, 8));
        var dt = m.match_time ? new Date(m.match_time).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
        var o = document.createElement('option');
        o.value = nm + (m.id ? ' [' + m.id + ']' : '');
        o.textContent = nm + (dt ? ' · ' + dt : '') + (m.status ? ' · ' + m.status : '');
        sel.appendChild(o);
      });
    }).catch(function() {});
}

window.submitMatchDispute = function() {
  var uid = window.U && window.U.uid;
  if (!uid) { if (window.toast) toast('Pehle login karo', 'err'); return; }
  var sel = (document.getElementById('dspMatch') || {}).value || '';
  var txt = (document.getElementById('dspMatchTxt') || {}).value || '';
  var match = (sel || txt).trim();
  var reason = (document.getElementById('dspReason') || {}).value || 'other';
  var msg = (document.getElementById('dspMsg') || {}).value || '';
  if (!match) { if (window.toast) toast('Match select karo ya naam likho', 'err'); return; }
  if (!msg.trim()) { if (window.toast) toast('Details likho — bina detail dispute adhoora hai', 'err'); return; }
  var body = 'MATCH: ' + match + '\nREASON: ' + reason + '\nDETAILS: ' + msg.trim();
  var _isPrem = window.isPremiumActive ? window.isPremiumActive(3) : false;
  var subject = (_isPrem ? '🔷 PRIORITY — ' : '') + 'match_dispute';
  var _attempt = 0;
  function _doInsert() {
    _attempt++;
    window._supa.from('support_tickets').insert({
      user_id: uid, subject: subject, status: 'open', message: body,
      user_ign: (window.UD && window.UD.ign) || '', user_ff_uid: (window.UD && (window.UD.ffUid || window.UD.ff_uid)) || ''
    }).then(function(r) {
      if (r && r.error) {
        if (_attempt < 3) { setTimeout(_doInsert, 1500); return; }
        if (window.toast) toast('Submit nahi hua: ' + (r.error.message || 'retry karo'), 'err');
        return;
      }
      if (window.closeModal) closeModal();
      if (window.toast) toast('✅ Dispute submit ho gaya! Admin jald dekhega.', 'ok');
    }).catch(function() {
      if (_attempt < 3) { setTimeout(_doInsert, 1500); return; }
      if (window.toast) toast('Submit nahi hua, dobara try karo', 'err');
    });
  }
  if (window._supa) _doInsert();
  else if (window.toast) toast('Connection nahi — dobara try karo', 'err');
};

/* ── Load on startup ── */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() { setTimeout(window.loadAdminResponseStats, 2000); });
} else {
  setTimeout(window.loadAdminResponseStats, 2000);
}

})();
