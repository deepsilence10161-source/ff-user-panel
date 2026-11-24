/* ── Show Support with Admin Response Badge ── */
window.openSupport = function() {
  if (window.showSupportWithBadge) {
    showSupportWithBadge();
  } else {
    startChat();
  }
};

/* ====== CHAT (STANDARDIZED - support/ path only) ====== */
/* BUG FIX #4: Use ONLY support/{uid} path for consistency with Admin panel */
var _chatListenerActive = false;
var _chatOnlineListenerActive = false;

/* ✅ D95 (2026-11-09, owner live report): "Support chat me purane messages
   show nahi hote" — root cause: chat history SIRF Firebase websocket
   listener se aati thi, aur D94 me prove ho chuka tha ke ye WS unreliable
   networks par atak jati hai (tab history kabhi load hi nahi hoti).
   Ab DOUBLE channel: (1) Firebase REST fetch (HTTPS — WS se azad) turant
   + har 20s, (2) WS listener live updates ke liye. Dono ek hi render
   funnel me aate hain, isliye koi duplicate nahi. */
var FB_REST_BASE = 'https://fft-app-1e283-default-rtdb.firebaseio.com';

function _fbIdToken(cb) {
  try {
    var auth = firebase.app('mainApp').auth();
    if (auth.currentUser) { auth.currentUser.getIdToken().then(function(t) { cb(t || null); }, function() { cb(null); }); return; }
  } catch (e) {}
  cb(null);
}

/* REST se messages padho — orderBy="$key" hamesha indexed hota hai
   (custom index ki zaroorat nahi), push-keys chronological hoti hain;
   client par createdAt se dobara sort kar lete hain. */
function _restMessages(uid, limit, cb) {
  _fbIdToken(function(tok) {
    var url = FB_REST_BASE + '/support/' + uid + '/messages.json?orderBy=%22$key%22&limitToLast=' + limit;
    if (tok) url += '&auth=' + encodeURIComponent(tok);
    fetch(url, { method: 'GET' }).then(function(r) {
      if (!r.ok) { cb(null); return; }
      return r.json().then(function(obj) {
        var arr = [];
        if (obj) Object.keys(obj).forEach(function(k) { var m = obj[k]; if (m && typeof m === 'object') { m._key = k; arr.push(m); } });
        arr.sort(function(a, b) { return (Number(a.createdAt) || 0) - (Number(b.createdAt) || 0); });
        cb(arr);
      });
    }).catch(function() { cb(null); });
  });
}

/* REST se message likho — server-authoritative (admin ka WS listener ye
   turant dekhta hai). WS atka ho to bhi message chala jata hai. */
function _restPutMsg(uid, key, data, cb) {
  _fbIdToken(function(tok) {
    var url = FB_REST_BASE + '/support/' + uid + '/messages/' + key + '.json';
    if (tok) url += '?auth=' + encodeURIComponent(tok);
    fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      .then(function(r) { cb && cb(r.ok); })
      .catch(function() { cb && cb(false); });
  });
}

function _restPatchInfo(uid, patch) {
  _fbIdToken(function(tok) {
    var url = FB_REST_BASE + '/support/' + uid + '/info.json';
    if (tok) url += '?auth=' + encodeURIComponent(tok);
    fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) }).catch(function() {});
  });
}

function startChat() {
  if (!U) return;
  _injectChatStyles();
  /* Sync user identity (WS + REST dono) */
  var userInfo = {
    userId: U.uid, uid: U.uid,
    userName: UD ? (UD.ign || UD.displayName || '') : '',
    displayName: UD ? (UD.displayName || '') : '',
    userEmail: UD ? (UD.email || '') : '',
    userIGN: UD ? (UD.ign || '') : '',
    userFFUID: UD ? (UD.ffUid || '') : '',
    profileImage: UD ? (UD.profileImage || '') : ''
  };
  db.ref('support/' + U.uid + '/info').update(userInfo);
  _restPatchInfo(U.uid, userInfo);

  /* FIX: Only attach listeners ONCE — prevent double messages */
  if (!_chatOnlineListenerActive) {
    _chatOnlineListenerActive = true;
    db.ref('appSettings/supportOnline').on('value', function(s) {
      _setChatSt(!!s.val());
    });
  }
  if (!_chatListenerActive) {
    _chatListenerActive = true;
    /* ✅ Bug 16 Fix: limitToLast(50) — no more full history load */
    db.ref('support/' + U.uid + '/messages')
      .orderByChild('createdAt')
      .limitToLast(50)
      .on('value', function(s) { renderChatMsgs(s); });
  } else {
    db.ref('support/' + U.uid + '/messages')
      .orderByChild('createdAt')
      .limitToLast(window._supportMsgLimit || 50)
      .once('value', function(s) { renderChatMsgs(s); });
  }
  /* ✅ D95: REST channel — turant history (purane messages!) + 20s poll */
  _restRefresh();
  if (!window._chatRestPoll) {
    window._chatRestPoll = setInterval(function() {
      if (window.curScr === 'chat' || (document.getElementById('scrChat') || {}).classList && document.getElementById('scrChat').classList.contains('active')) _restRefresh();
    }, 20000);
  }
}

function _restRefresh() {
  if (!window.U) return;
  _restMessages(U.uid, window._supportMsgLimit || 50, function(arr) {
    if (arr === null) return;           /* REST fail (rules/network) → WS bharosa */
    if (!arr.length && _lastRenderCount > 0) return; /* khali REST purane render ko na mitaye */
    renderChatList(arr);
  });
  /* presence pill/chatSt ko REST presence se bhi taza karo */
  try {
    if (window._supportPresence) {
      var p = window._supportPresence();
      if (p === true || p === false) _setChatSt(p);
    }
  } catch (e) {}
}

function _setChatSt(online) {
  var el = $('chatSt');
  if (!el) return;
  if (online) { el.textContent = 'Online'; el.style.color = '#00ff9c'; }
  else { el.textContent = 'Away — reply jald milega'; el.style.color = '#8b93a0'; }
}

/* ── Load More support messages ── */
window._loadMoreSupportMsgs = function() {
  window._supportMsgLimit = (window._supportMsgLimit || 50) + 50;
  /* ✅ D95: REST primary (WS atka ho to bhi history mile) */
  _restMessages(U.uid, window._supportMsgLimit, function(arr) {
    if (arr === null) {
      db.ref('support/' + U.uid + '/messages')
        .orderByChild('createdAt').limitToLast(window._supportMsgLimit)
        .once('value', function(s) { renderChatMsgs(s); });
      return;
    }
    renderChatList(arr);
  });
};

var _lastRenderCount = 0;
var _lastRenderSig = '';

function renderChatMsgs(s) {
  var msgs = []; if (s.exists()) s.forEach(function(c) { msgs.push(c.val()); });
  msgs.sort(function(a, b) { return (Number(a.createdAt) || 0) - (Number(b.createdAt) || 0); });
  renderChatList(msgs);
}

/* ✅ D95: stylish chat bubbles — date pills, admin shield header,
   green gradient own bubbles, read ticks */
function renderChatList(msgs) {
  var cm = $('chatMsgs'); if (!cm) return;
  var sig = msgs.map(function(m) { return (m._key || '') + ':' + (m.createdAt || 0) + ':' + (m.text || m.message || '').length; }).join('|');
  if (sig === _lastRenderSig) return;   /* same data → re-render skip (no flicker) */
  _lastRenderSig = sig; _lastRenderCount = msgs.length;
  /* ✅ Bug 16 Fix: Load More button for 50+ messages */
  var loadMoreHtml = (msgs.length >= 50)
    ? '<div style="text-align:center;padding:6px 0 10px"><button onclick="window._loadMoreSupportMsgs&&_loadMoreSupportMsgs()" style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:#aab3c0;padding:7px 18px;border-radius:20px;font-size:11px;font-weight:700;cursor:pointer">⬆ Purane messages dekho</button></div>'
    : '';
  if (!msgs.length) {
    cm.innerHTML = '<div style="text-align:center;padding:50px 20px;color:#8b93a0"><div style="width:64px;height:64px;margin:0 auto 12px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:26px;background:linear-gradient(140deg,rgba(0,212,255,.14),rgba(0,255,156,.1));border:1px solid rgba(0,212,255,.25)">💬</div><p style="font-size:13px;font-weight:700;color:#cdd3dc">Koi message nahi</p><p style="font-size:11px;margin-top:3px">Support team ko pehla message bhejo — say hi!</p></div>';
    return;
  }
  var h = loadMoreHtml, ld = '';
  msgs.forEach(function(m) {
    var isAdmin = m.senderId === 'admin' || m.senderRole === 'admin';
    var ts = new Date(m.createdAt || m.timestamp || Date.now());
    var ds = ts.toLocaleDateString('en-IN', {day:'numeric',month:'short'});
    var tm = ts.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    if (ds !== ld) {
      ld = ds;
      h += '<div style="text-align:center;margin:12px 0 8px"><span style="font-size:10px;font-weight:700;color:#8b93a0;background:rgba(255,255,255,.05);padding:4px 14px;border-radius:20px;border:1px solid rgba(255,255,255,.09)">' + ds + '</span></div>';
    }
    /* ✅ D99-F1: support-chat bubble me message text RAW innerHTML me jata tha —
       admin reply ya koi bhi stored message HTML/script inject kar sakta tha.
       (xss-pass me stray=2 nodes isi sink ke mile the: #chatMsgs ke andar
       img[onerror] + svg[onload] zinda DOM nodes.) Ab escHtml. */
    var txt = (window.escHtml ? window.escHtml(m.text || m.message || '') : String(m.text || m.message || ''));
    if (isAdmin) {
      h += '<div style="display:flex;justify-content:flex-start;margin:3px 0 9px">' +
           '<div style="max-width:80%;background:linear-gradient(150deg,rgba(255,255,255,.07),rgba(255,255,255,.03));border:1px solid rgba(255,255,255,.1);border-radius:6px 18px 18px 18px;padding:10px 14px;font-size:13px;line-height:1.5;box-shadow:0 2px 10px rgba(0,0,0,.25)">' +
           '<div style="font-size:10px;color:#00d4ff;margin-bottom:4px;font-weight:800;display:flex;align-items:center;gap:5px"><span style="width:16px;height:16px;border-radius:50%;background:rgba(0,212,255,.15);border:1px solid rgba(0,212,255,.4);display:inline-flex;align-items:center;justify-content:center;font-size:9px">🛡️</span> Admin</div>' +
           '<div style="color:var(--txt);word-break:break-word">' + txt + '</div>' +
           '<div style="font-size:10px;color:#79808c;margin-top:5px;text-align:right">' + tm + '</div>' +
           '</div></div>';
    } else {
      h += '<div style="display:flex;justify-content:flex-end;margin:3px 0 9px">' +
           '<div style="max-width:80%;background:linear-gradient(150deg,rgba(0,255,156,.16),rgba(0,255,156,.07));border:1px solid rgba(0,255,156,.25);border-radius:18px 6px 18px 18px;padding:10px 14px;font-size:13px;line-height:1.5;box-shadow:0 2px 10px rgba(0,0,0,.25)">' +
           '<div style="color:var(--txt);word-break:break-word">' + txt + '</div>' +
           '<div style="font-size:10px;color:#79808c;margin-top:5px;text-align:right">' + tm + ' <span style="color:#00ff9c">✓✓</span></div>' +
           '</div></div>';
    }
  });
  cm.innerHTML = h;
  cm.scrollTop = cm.scrollHeight;
}

function sendChat() {
  var inp = $('chatIn'); if (!inp) return;
  var msg = inp.value.trim(); if (!msg) return; inp.value = '';

  var msgData = {
    senderId: U.uid,
    senderUid: U.uid,
    senderName: UD ? (UD.ign || UD.displayName || '') : '',
    senderDisplayName: UD ? (UD.displayName || '') : '',
    senderEmail: UD ? (UD.email || '') : '',
    senderRole: 'user',
    text: msg,
    createdAt: Date.now()
  };

  /* BUG FIX #4: Save ONLY to support/ path — Admin's primary path */
  var id = db.ref('support/' + U.uid + '/messages').push().key;
  /* ✅ D95: REST PUT primary — WS atka ho to bhi message server tak;
     fail ho to purana WS set fallback. */
  _restPutMsg(U.uid, id, msgData, function(ok) {
    if (!ok) {
      db.ref('support/' + U.uid + '/messages/' + id).set(msgData);
    }
    _restRefresh();
  });

  /* Update chat info for admin panel to show latest message */
  var infoUpdate = {
    lastMessage: msg,
    lastMessageTime: Date.now(),
    unreadByAdmin: true
  };
  db.ref('support/' + U.uid + '/info').update(infoUpdate);
  _restPatchInfo(U.uid, infoUpdate);
}

/* ✅ D95: chat screen ka stylish look — header glass + gradient send */
function _injectChatStyles() {
  if (document.getElementById('chatUiV2')) return;
  var s = document.createElement('style');
  s.id = 'chatUiV2';
  s.textContent =
    '#scrChat .chat-header{background:linear-gradient(120deg,rgba(0,255,156,.10),rgba(0,212,255,.07));border-bottom:1px solid rgba(0,255,156,.18);backdrop-filter:blur(10px)}' +
    '#scrChat .ch-ava{background:linear-gradient(140deg,rgba(0,255,156,.25),rgba(0,212,255,.18));border:1px solid rgba(0,255,156,.4);box-shadow:0 0 14px rgba(0,255,156,.25);color:#00ff9c}' +
    '#scrChat .ch-name{font-weight:900;letter-spacing:.2px}' +
    '#scrChat .chat-messages{background:radial-gradient(340px 200px at 50% 0%,rgba(0,212,255,.05),transparent 70%),transparent;padding:14px 12px}' +
    '#scrChat .chat-input-wrap{background:linear-gradient(180deg,rgba(10,14,20,.6),rgba(10,14,20,.95));border-top:1px solid rgba(255,255,255,.08);backdrop-filter:blur(10px)}' +
    '#scrChat .chat-input-wrap input{border-radius:22px!important;background:rgba(255,255,255,.06)!important;border:1px solid rgba(255,255,255,.12)!important;padding:11px 16px!important;font-size:13px}' +
    '#scrChat .chat-send-btn{border-radius:50%!important;width:42px;height:42px;background:linear-gradient(140deg,#00ff9c,#00d4ff)!important;color:#041018!important;box-shadow:0 0 16px rgba(0,255,156,.35)}';
  document.head.appendChild(s);
}

/* ====== NOTIFICATIONS ====== */
