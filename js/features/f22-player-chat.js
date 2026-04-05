/* =============================================
   FEATURE 22: Player Lobby Chat
   - Global chat for all verified players
   - Match-specific chat rooms
   - Anti-spam: 3 second cooldown
   - Firebase: lobbyChat/ and matchChat/{matchId}/
   ============================================= */
(function() {
  'use strict';

  var _lobbyChatActive = false;
  var _lastMsgTime = 0;
  var COOLDOWN_MS = 3000;
  var MAX_MSG_LEN = 120;

  // ── LOBBY CHAT SCREEN HTML ──────────────────
  function getLobbyHTML() {
    return [
      '<div style="display:flex;flex-direction:column;height:100%">',
        '<div style="display:flex;gap:8px;padding:0 0 10px 0;border-bottom:1px solid var(--border);margin-bottom:10px">',
          '<div id="lcTabLobby" class="lc-tab active" onclick="switchLobbyTab(\'lobby\')">🌐 Lobby</div>',
          '<div id="lcTabMatch" class="lc-tab" onclick="switchLobbyTab(\'match\')">🎮 My Match</div>',
        '</div>',
        '<div id="lcMessages" style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:6px;padding-right:4px"></div>',
        '<div style="display:flex;gap:8px;padding-top:10px;border-top:1px solid var(--border);margin-top:8px">',
          '<input id="lcInput" type="text" maxlength="120" placeholder="Kuch bolo..." ',
            'style="flex:1;background:var(--card2);border:1px solid var(--border);border-radius:10px;',
            'padding:10px 12px;color:var(--text);font-size:13px;outline:none" ',
            'onkeydown="if(event.key===\'Enter\')sendLobbyMsg()">',
          '<button onclick="sendLobbyMsg()" style="background:var(--green);border:none;border-radius:10px;',
            'padding:10px 14px;color:#000;font-weight:700;cursor:pointer;font-size:16px">➤</button>',
        '</div>',
      '</div>'
    ].join('');
  }

  // Inject lobby chat as a section within Rank page or standalone
  function injectLobbyChat() {
    // Add to rank page as a second tab
    var rankContent = document.getElementById('rankContent');
    if (!rankContent) return;

    // Check if already injected
    if (document.getElementById('lobbyChatWrap')) return;

    var wrap = document.createElement('div');
    wrap.id = 'lobbyChatWrap';
    wrap.style.cssText = 'margin-top:16px;background:var(--card);border-radius:14px;padding:14px;min-height:300px;display:flex;flex-direction:column';
    wrap.innerHTML = [
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">',
        '<span style="font-size:16px">💬</span>',
        '<span style="font-weight:700;font-size:14px;color:var(--text)">Player Chat</span>',
        '<span id="lcOnlineCount" style="margin-left:auto;font-size:10px;color:var(--green);font-weight:700"></span>',
      '</div>',
      '<div class="lc-tabs" style="display:flex;gap:6px;margin-bottom:10px">',
        '<div id="lcTabLobby" class="lc-tab active" onclick="window.switchLobbyTab(\'lobby\')">🌐 Lobby</div>',
        '<div id="lcTabMatch" class="lc-tab" onclick="window.switchLobbyTab(\'match\')">🎮 My Match</div>',
      '</div>',
      '<div id="lcMessages" style="flex:1;overflow-y:auto;max-height:260px;display:flex;flex-direction:column;gap:5px;padding-right:4px"></div>',
      '<div style="display:flex;gap:8px;padding-top:10px;border-top:1px solid var(--border);margin-top:8px">',
        '<input id="lcInput" type="text" maxlength="120" placeholder="Lobby mein bolo..." ',
          'style="flex:1;background:var(--card2,#1a1a2e);border:1px solid var(--border);border-radius:10px;',
          'padding:9px 12px;color:var(--text);font-size:13px;outline:none" ',
          'onkeydown="if(event.key===\'Enter\')window.sendLobbyMsg()">',
        '<button onclick="window.sendLobbyMsg()" style="background:var(--green,#00ff9c);border:none;border-radius:10px;',
          'padding:9px 14px;color:#000;font-weight:700;cursor:pointer;font-size:15px">➤</button>',
      '</div>'
    ].join('');
    rankContent.appendChild(wrap);

    // Add tab styles
    if (!document.getElementById('lcStyles')) {
      var s = document.createElement('style');
      s.id = 'lcStyles';
      s.textContent = [
        '.lc-tab{padding:6px 14px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;',
          'color:var(--txt2);background:var(--card2,#1a1a2e);border:1px solid var(--border);transition:all .2s}',
        '.lc-tab.active{background:rgba(0,255,156,.12);color:var(--green,#00ff9c);border-color:rgba(0,255,156,.3)}',
        '.lc-msg{display:flex;flex-direction:column;gap:2px;background:var(--card2,#1a1a2e);',
          'border-radius:10px;padding:8px 10px;animation:msgIn .2s ease}',
        '.lc-msg.own{background:rgba(0,255,156,.08);border:1px solid rgba(0,255,156,.15)}',
        '.lc-msg-name{font-size:10px;font-weight:700;color:var(--green,#00ff9c)}',
        '.lc-msg-text{font-size:13px;color:var(--text);word-break:break-word}',
        '.lc-msg-time{font-size:9px;color:var(--txt3,#555);align-self:flex-end}',
        '@keyframes msgIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}'
      ].join('');
      document.head.appendChild(s);
    }
  }

  var _curTab = 'lobby';
  var _lobbyListener = null;
  var _matchChatListener = null;

  window.switchLobbyTab = function(tab) {
    _curTab = tab;
    document.querySelectorAll('.lc-tab').forEach(function(t) { t.classList.remove('active'); });
    var activeTab = document.getElementById(tab === 'lobby' ? 'lcTabLobby' : 'lcTabMatch');
    if (activeTab) activeTab.classList.add('active');
    loadChat(tab);
  };

  function loadChat(tab) {
    var db = window.db;
    if (!db) return;
    var msgs = document.getElementById('lcMessages');
    if (!msgs) return;
    msgs.innerHTML = '<div style="text-align:center;color:var(--txt2);padding:20px;font-size:12px">Loading...</div>';

    // Detach old listener
    if (_lobbyListener) { db.ref(_lobbyListener.path).off('value', _lobbyListener.fn); }

    var path = tab === 'lobby' ? 'lobbyChat' : getMatchChatPath();
    if (!path) {
      msgs.innerHTML = '<div style="text-align:center;color:var(--txt2);padding:20px;font-size:12px">Koi active match nahi hai</div>';
      return;
    }

    var fn = function(s) {
      var list = [];
      if (s.exists()) s.forEach(function(c) { list.push(c.val()); });
      renderMessages(list);
    };
    _lobbyListener = { path: path + '/messages', fn: fn };
    db.ref(path + '/messages').orderByChild('ts').limitToLast(50).on('value', fn);
  }

  function getMatchChatPath() {
    // Find most recent joined active match
    if (!window.JR || !window.MT) return null;
    for (var k in window.JR) {
      var mid = window.JR[k].matchId;
      var t = window.MT && window.MT[mid];
      if (t && (window.effSt ? window.effSt(t) : t.status) !== 'completed') {
        return 'matchChat/' + mid;
      }
    }
    return null;
  }

  function renderMessages(list) {
    var msgs = document.getElementById('lcMessages');
    if (!msgs) return;
    if (!list.length) {
      msgs.innerHTML = '<div style="text-align:center;color:var(--txt2);padding:20px;font-size:12px">Abhi koi message nahi — pehla message bhejo! 👋</div>';
      return;
    }
    var uid = window.U ? window.U.uid : '';
    msgs.innerHTML = list.map(function(m) {
      var isOwn = m.uid === uid;
      var time = m.ts ? new Date(m.ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '';
      return [
        '<div class="lc-msg' + (isOwn ? ' own' : '') + '">',
          '<span class="lc-msg-name">' + (isOwn ? 'You' : escHtml(m.name || 'Player')) + '</span>',
          '<span class="lc-msg-text">' + escHtml(m.text) + '</span>',
          '<span class="lc-msg-time">' + time + '</span>',
        '</div>'
      ].join('');
    }).join('');
    // Auto-scroll to bottom
    msgs.scrollTop = msgs.scrollHeight;
  }

  window.sendLobbyMsg = function() {
    var inp = document.getElementById('lcInput');
    if (!inp) return;
    var text = inp.value.trim();
    if (!text) return;
    if (!window.U || !window.UD) { if (window.toast) window.toast('Login required', 'err'); return; }

    // Profile check — only verified users can chat
    if (!window.UD.profileStatus || window.UD.profileStatus !== 'approved') {
      if (window.toast) window.toast('Profile verify karo pehle', 'err');
      return;
    }

    // Spam protection
    var now = Date.now();
    if (now - _lastMsgTime < COOLDOWN_MS) {
      if (window.toast) window.toast('Thoda ruko...', 'inf');
      return;
    }
    _lastMsgTime = now;

    if (text.length > MAX_MSG_LEN) text = text.slice(0, MAX_MSG_LEN);

    var db = window.db;
    if (!db) return;
    var path = _curTab === 'lobby' ? 'lobbyChat' : getMatchChatPath();
    if (!path) return;

    inp.value = '';
    db.ref(path + '/messages').push({
      uid: window.U.uid,
      name: window.UD.ign || window.UD.displayName || 'Player',
      text: text,
      ts: firebase.database.ServerValue.TIMESTAMP
    });
  };

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Init after rank page loads
  var _rankWatchInterval = setInterval(function() {
    if (window.db && window.U && window.UD) {
      clearInterval(_rankWatchInterval);
      // Hook into navTo for rank
      var origNavTo = window.navTo;
      if (origNavTo) {
        window.navTo = function(scr) {
          origNavTo.apply(this, arguments);
          if (scr === 'rank') {
            setTimeout(function() {
              injectLobbyChat();
              loadChat('lobby');
            }, 200);
          }
        };
      }
    }
  }, 1000);

  window.f22PlayerChat = { sendMsg: window.sendLobbyMsg };
})();
