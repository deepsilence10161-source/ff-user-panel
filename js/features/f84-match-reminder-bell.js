/* =============================================
   FEATURE 39: Match Reminder Bell (Per Match)
   - Har joined match pe bell icon
   - Tap karo → set reminder 30/15/5 min pehle
   - Firebase stores reminder preference
   ============================================= */
(function() {
  'use strict';

  var _reminders = JSON.parse(localStorage.getItem('matchReminders_v2') || '{}');

  function setMatchReminder(matchId, minutesBefore) {
    var t = window.MT && window.MT[matchId];
    if (!t || !t.matchTime) return;
    var matchTime = Number(t.matchTime);
    var now = Date.now();
    var triggerAt = matchTime - (minutesBefore * 60 * 1000);
    if (triggerAt <= now) {
      if (window.toast) window.toast('Match bahut paas hai, reminder set nahi hua', 'err');
      return;
    }
    _reminders[matchId] = { matchId: matchId, name: t.name, matchTime: matchTime, minutesBefore: minutesBefore, triggerAt: triggerAt };
    localStorage.setItem('matchReminders_v2', JSON.stringify(_reminders));
    var delay = triggerAt - now;
    setTimeout(function() { fireReminder(matchId); }, delay);
    if (window.toast) window.toast('⏰ Reminder set: ' + minutesBefore + ' min pehle!', 'ok');
    if (window.closeModal) window.closeModal();
  }

  function fireReminder(matchId) {
    var r = _reminders[matchId];
    if (!r) return;
    if (window.toast) window.toast('⏰ ' + (r.name||'Match') + ' shuru hone wala hai!', 'ok');
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('⏰ Match Reminder!', { body: (r.name||'Match') + ' ' + (r.minutesBefore||30) + ' min mein!', icon: '/favicon.ico' });
    }
    delete _reminders[matchId];
    localStorage.setItem('matchReminders_v2', JSON.stringify(_reminders));
  }

  function showReminderPicker(matchId) {
    var t = window.MT && window.MT[matchId];
    var existing = _reminders[matchId];
    if (!window.openModal) return;
    var h = '<div>' +
      '<div style="font-size:13px;color:var(--txt2);margin-bottom:14px;text-align:center">' + (t ? t.name : 'Match') + ' ke liye reminder</div>' +
      (existing ? '<div style="text-align:center;background:rgba(0,255,156,.08);border-radius:10px;padding:8px;margin-bottom:12px;font-size:12px;color:var(--green)">✅ ' + existing.minutesBefore + ' min pehle reminder set hai</div>' : '') +
      '<div style="display:flex;flex-direction:column;gap:8px">';
    [5, 15, 30].forEach(function(m) {
      h += '<button onclick="window.f39Reminder.set(\'' + matchId + '\',' + m + ')" style="padding:12px;border-radius:12px;background:var(--card2);border:1px solid var(--border);color:var(--txt);font-size:13px;font-weight:700;cursor:pointer">⏰ ' + m + ' minutes pehle</button>';
    });
    h += '</div></div>';
    window.openModal('⏰ Set Reminder', h);
  }

  // Re-schedule reminders on page load
  Object.keys(_reminders).forEach(function(mid) {
    var r = _reminders[mid];
    if (!r || !r.triggerAt) return;
    var delay = r.triggerAt - Date.now();
    if (delay > 0) setTimeout(function() { fireReminder(mid); }, delay);
    else delete _reminders[mid];
  });
  localStorage.setItem('matchReminders_v2', JSON.stringify(_reminders));

  window.f39Reminder = { show: showReminderPicker, set: setMatchReminder };
  window.showMatchReminderPicker = showReminderPicker;
})();
