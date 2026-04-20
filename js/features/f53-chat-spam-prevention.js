/* ====== ANTI-SPAM FEATURE f53: CHAT SPAM & FLOOD PREVENTION ======
   - Same message repeated spam block
   - Message flood rate limit (5 msg/10sec)
   - Profanity/abuse word filter
   - Suspicious link detection
   - Auto-mute spammers
*/
(function(){
'use strict';

var MSG_LIMIT = 5;
var MSG_WINDOW = 10000; // 10 seconds
var chatTimestamps = [];
var lastMessages = [];
var muteUntil = 0;
var MUTE_DURATION = 120000; // 2 min mute

var BAD_WORDS = ['fraud', 'cheat', 'fake', 'bc', 'mc', 'scam']; // Extend as needed
var LINK_PATTERN = /(https?:\/\/|www\.|\.com|\.in|bit\.ly|t\.me)/i;

/* ── Main spam check before sending ── */
window.checkChatSpam = function(message) {
  var now = Date.now();

  // Check if muted
  if (now < muteUntil) {
    var secLeft = Math.ceil((muteUntil - now) / 1000);
    if (window.toast) toast('🔇 Auto-muted for spam. ' + secLeft + 's baad baat karo.', 'err');
    return false;
  }

  // Rate limit
  chatTimestamps = chatTimestamps.filter(function(t) { return now - t < MSG_WINDOW; });
  if (chatTimestamps.length >= MSG_LIMIT) {
    muteUntil = now + MUTE_DURATION;
    if (window.toast) toast('⚠️ Bahut fast messages! 2 minute ke liye mute ho gaye.', 'err');
    _logSpam('chat_flood', 'Message flood: ' + chatTimestamps.length + ' messages in 10s');
    return false;
  }

  // Duplicate spam check
  if (lastMessages.slice(-3).filter(function(m) { return m === message.trim().toLowerCase(); }).length >= 2) {
    if (window.toast) toast('🚫 Same message repeat mat karo.', 'err');
    _logSpam('chat_repeat_spam', 'Repeated message spam: "' + message.slice(0, 30) + '"');
    return false;
  }

  // Link detection
  if (LINK_PATTERN.test(message)) {
    if (window.toast) toast('🔗 Links send karna allowed nahi hai.', 'err');
    _logSpam('chat_link_spam', 'Link sent in chat: ' + message.slice(0, 50));
    return false;
  }

  // Bad word filter (basic)
  var lowerMsg = message.toLowerCase();
  var foundBadWord = BAD_WORDS.some(function(w) { return lowerMsg.includes(w); });
  if (foundBadWord) {
    if (window.toast) toast('⛔ Abusive language detected. Warning logged.', 'err');
    _logSpam('chat_abuse', 'Abusive content: "' + message.slice(0, 30) + '"', 'MEDIUM');
    return false;
  }

  chatTimestamps.push(now);
  lastMessages.push(message.trim().toLowerCase());
  if (lastMessages.length > 10) lastMessages.shift();
  return true;
};

function _logSpam(type, message, severity) {
  if (!window.db || !window.U) return;
  window.db.ref('adminAlerts').push({
    type: type,
    uid: window.U.uid,
    message: message,
    timestamp: Date.now(),
    severity: severity || 'LOW',
    source: 'chat_spam_filter'
  });
}

/* ── Hook into sendChatMessage ── */
var _hookI = setInterval(function() {
  if (window.sendChatMessage && !window._chatSpamHooked) {
    clearInterval(_hookI);
    window._chatSpamHooked = true;
    var orig = window.sendChatMessage;
    window.sendChatMessage = function(msg, extra) {
      if (!window.checkChatSpam(msg)) return;
      orig(msg, extra);
    };
  }
}, 700);

/* ── Render mute indicator ── */
window.getChatMuteStatus = function() {
  var now = Date.now();
  if (now < muteUntil) {
    return { muted: true, secondsLeft: Math.ceil((muteUntil - now) / 1000) };
  }
  return { muted: false };
};

console.log('[Anti-Spam] ✅ f53: Chat Spam & Flood Prevention loaded');
})();
