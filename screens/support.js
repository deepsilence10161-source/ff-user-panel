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
function startChat() {
  if (!U) return;
  /* Sync user identity */
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

  /* FIX: Only attach listeners ONCE — prevent double messages */
  if (!_chatOnlineListenerActive) {
    _chatOnlineListenerActive = true;
    db.ref('appSettings/supportOnline').on('value', function(s) {
      var el = $('chatSt');
      if (el) {
        if (s.val()) { el.textContent = 'Online'; el.style.color = 'var(--green)'; }
        else { el.textContent = 'Away'; el.style.color = 'var(--txt2)'; }
      }
    });
  }
  if (!_chatListenerActive) {
    _chatListenerActive = true;
    db.ref('support/' + U.uid + '/messages').orderByChild('createdAt').on('value', function(s) {
      renderChatMsgs(s);
    });
  } else {
    /* Already listening — just re-render from existing data */
    db.ref('support/' + U.uid + '/messages').orderByChild('createdAt').once('value', function(s) {
      renderChatMsgs(s);
    });
  }
}

function renderChatMsgs(s) {
  var cm = $('chatMsgs'); if (!cm) return;
  var msgs = []; if (s.exists()) s.forEach(function(c) { msgs.push(c.val()); });
  if (!msgs.length) {
    cm.innerHTML = '<div style="text-align:center;padding:50px 20px;color:var(--txt2)"><div style="font-size:40px;margin-bottom:8px;opacity:.2">💬</div><p style="font-size:13px">Koi message nahi — say hi!</p></div>';
    return;
  }
  var h = '', ld = '';
  msgs.forEach(function(m) {
    var isAdmin = m.senderId === 'admin' || m.senderRole === 'admin';
    var ts = new Date(m.createdAt || m.timestamp || Date.now());
    var ds = ts.toLocaleDateString('en-IN', {day:'numeric',month:'short'});
    var tm = ts.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    if (ds !== ld) {
      ld = ds;
      h += '<div style="text-align:center;margin:12px 0"><span style="font-size:10px;color:var(--txt2);background:var(--card2);padding:4px 12px;border-radius:20px;border:1px solid var(--border)">' + ds + '</span></div>';
    }
    if (isAdmin) {
      h += '<div style="display:flex;justify-content:flex-start;margin:3px 0 8px">' +
           '<div style="max-width:78%;background:var(--card2);border:1px solid var(--border);border-radius:4px 16px 16px 16px;padding:10px 14px;font-size:13px;line-height:1.5">' +
           '<div style="font-size:10px;color:var(--primary);margin-bottom:4px;font-weight:700;display:flex;align-items:center;gap:4px"><span>🛡️</span> Admin</div>' +
           '<div style="color:var(--txt)">' + (m.text || m.message || '') + '</div>' +
           '<div style="font-size:10px;color:var(--txt2);margin-top:5px;text-align:right">' + tm + '</div>' +
           '</div></div>';
    } else {
      h += '<div style="display:flex;justify-content:flex-end;margin:3px 0 8px">' +
           '<div style="max-width:78%;background:rgba(0,255,156,.1);border:1px solid rgba(0,255,156,.2);border-radius:16px 4px 16px 16px;padding:10px 14px;font-size:13px;line-height:1.5">' +
           '<div style="color:var(--txt)">' + (m.text || m.message || '') + '</div>' +
           '<div style="font-size:10px;color:var(--txt2);margin-top:5px;text-align:right">' + tm + ' <span style="color:var(--green)">✓✓</span></div>' +
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
  db.ref('support/' + U.uid + '/messages/' + id).set(msgData);

  /* Update chat info for admin panel to show latest message */
  var infoUpdate = {
    lastMessage: msg,
    lastMessageTime: Date.now(),
    unreadByAdmin: true
  };
  db.ref('support/' + U.uid + '/info').update(infoUpdate);
}

/* ====== NOTIFICATIONS ====== */
