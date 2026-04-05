/* ====== FEATURE 45: USER SUGGESTION SYSTEM ======
   User apni suggestions deta hai → Admin approve kare → Reward mile
*/
(function(){
'use strict';

/* ── Open suggestion form ── */
window.openSuggestionForm = function() {
  if (!window.U) return;
  var h = '<div>';
  h += '<div style="background:linear-gradient(135deg,rgba(255,215,0,.08),rgba(255,165,0,.04));border:1px solid rgba(255,215,0,.2);border-radius:12px;padding:12px;margin-bottom:14px">';
  h += '<div style="font-size:13px;font-weight:700;color:#ffd700;margin-bottom:4px">💡 Apni Suggestion Do!</div>';
  h += '<div style="font-size:11px;color:var(--txt2)">Agar teri suggestion hamare kaam aayi to hum tujhe <strong style="color:#ffd700">₹ ya Coins</strong> reward karenge!</div>';
  h += '</div>';

  h += '<div style="margin-bottom:10px"><label style="font-size:11px;color:var(--txt2);display:block;margin-bottom:4px">Category</label>';
  h += '<select id="sgCat" style="width:100%;padding:9px 12px;border-radius:10px;background:rgba(255,255,255,.06);border:1px solid var(--border);color:var(--txt);font-size:13px">';
  h += '<option value="bug">🐛 Bug / Glitch</option>';
  h += '<option value="feature">✨ New Feature</option>';
  h += '<option value="ux">🎨 UI/UX Improvement</option>';
  h += '<option value="fraud">🛡️ Fraud Prevention</option>';
  h += '<option value="other">💬 Other</option>';
  h += '</select></div>';

  h += '<div style="margin-bottom:10px"><label style="font-size:11px;color:var(--txt2);display:block;margin-bottom:4px">Title (Short mein)</label>';
  h += '<input id="sgTitle" type="text" maxlength="80" placeholder="e.g. Squad auto-fill button add karo" style="width:100%;padding:9px 12px;border-radius:10px;background:rgba(255,255,255,.06);border:1px solid var(--border);color:var(--txt);font-size:13px;box-sizing:border-box"></div>';

  h += '<div style="margin-bottom:14px"><label style="font-size:11px;color:var(--txt2);display:block;margin-bottom:4px">Detail mein batao</label>';
  h += '<textarea id="sgDesc" rows="4" maxlength="500" placeholder="Poori detail likho — kya problem hai, kaise solve ho sakti hai..." style="width:100%;padding:9px 12px;border-radius:10px;background:rgba(255,255,255,.06);border:1px solid var(--border);color:var(--txt);font-size:13px;resize:none;box-sizing:border-box"></textarea></div>';

  h += '<button onclick="submitSuggestion()" style="width:100%;padding:12px;border-radius:12px;background:linear-gradient(135deg,#ffd700,#ffaa00);color:#000;font-weight:800;border:none;cursor:pointer;font-size:14px">💡 Submit Suggestion</button>';
  h += '</div>';

  if (window.openModal) openModal('💡 Suggest a Feature', h);
};

/* ── Submit suggestion ── */
window.submitSuggestion = function() {
  var cat = (document.getElementById('sgCat')||{}).value || 'other';
  var title = ((document.getElementById('sgTitle')||{}).value || '').trim();
  var desc = ((document.getElementById('sgDesc')||{}).value || '').trim();

  if (!title || title.length < 5) { if (window.toast) toast('Title kam se kam 5 characters ka ho', 'err'); return; }
  if (!desc || desc.length < 10) { if (window.toast) toast('Thoda detail mein batao (10+ chars)', 'err'); return; }

  var uid = window.U.uid;
  var userName = (window.UD && (window.UD.ign || window.UD.displayName)) || 'User';

  // Check: ek din mein max 3 suggestions
  var _sgKey = '_mes_sg_' + uid + '_' + new Date().toDateString();
  var _sgCount = parseInt(localStorage.getItem(_sgKey) || '0', 10);
  if (_sgCount >= 3) { if (window.toast) toast('Ek din mein max 3 suggestions allowed hain', 'err'); return; }

  db.ref('suggestions').push({
    uid: uid,
    userName: userName,
    category: cat,
    title: title,
    description: desc,
    status: 'pending',
    upvotes: 0,
    createdAt: Date.now()
  }).then(function() {
    localStorage.setItem(_sgKey, _sgCount + 1);
    if (window.toast) toast('✅ Suggestion submit ho gayi! Admin review karega.', 'ok');
    if (window.closeModal) closeModal();
  }).catch(function(e) {
    if (window.toast) toast('Error: ' + e.message, 'err');
  });
};

/* ── My Suggestions list ── */
window.showMySuggestions = function() {
  if (!window.U) return;
  db.ref('suggestions').orderByChild('uid').equalTo(window.U.uid).limitToLast(10).once('value', function(s) {
    var list = [];
    if (s.exists()) s.forEach(function(c) { var d = c.val(); d._key = c.key; list.unshift(d); });

    if (!list.length) {
      if (window.openModal) openModal('My Suggestions', '<div style="text-align:center;padding:20px;color:var(--txt2)">Tumne abhi tak koi suggestion nahi di.<br><br><button onclick="openSuggestionForm()" style="padding:10px 20px;border-radius:10px;background:var(--primary);color:#000;border:none;font-weight:700;cursor:pointer">+ Give Suggestion</button></div>');
      return;
    }

    var statusColors = { pending: '#ffaa00', approved: '#00ff9c', rejected: '#ff4444', rewarded: '#ffd700' };
    var statusLabels = { pending: '⏳ Review mein', approved: '✅ Accepted', rejected: '❌ Rejected', rewarded: '🏆 Rewarded!' };
    var h = '<div>';
    list.forEach(function(sg) {
      var col = statusColors[sg.status] || '#aaa';
      var lbl = statusLabels[sg.status] || sg.status;
      h += '<div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:12px;margin-bottom:8px">';
      h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px">';
      h += '<span style="font-size:12px;font-weight:700;color:var(--txt);flex:1;margin-right:8px">' + sg.title + '</span>';
      h += '<span style="font-size:10px;font-weight:700;color:' + col + ';white-space:nowrap;background:rgba(0,0,0,.3);padding:2px 7px;border-radius:8px">' + lbl + '</span>';
      h += '</div>';
      h += '<div style="font-size:11px;color:var(--txt2)">' + sg.description.substring(0, 80) + (sg.description.length > 80 ? '...' : '') + '</div>';
      if (sg.reward) h += '<div style="font-size:12px;color:#ffd700;margin-top:6px;font-weight:700">🎁 Reward: ' + sg.reward + '</div>';
      if (sg.adminNote) h += '<div style="font-size:11px;color:#00d4ff;margin-top:4px">Admin: ' + sg.adminNote + '</div>';
      h += '</div>';
    });
    h += '<button onclick="openSuggestionForm()" style="width:100%;padding:10px;border-radius:10px;background:rgba(255,215,0,.1);border:1px solid rgba(255,215,0,.2);color:#ffd700;font-weight:700;border:none;cursor:pointer;margin-top:4px">+ New Suggestion</button>';
    h += '</div>';
    if (window.openModal) openModal('💡 My Suggestions', h);
  });
};

/* ── Upvote another user's suggestion (top suggestions page) ── */
window.showTopSuggestions = function() {
  db.ref('suggestions').orderByChild('status').equalTo('pending').limitToLast(20).once('value', function(s) {
    var list = [];
    if (s.exists()) s.forEach(function(c) { var d = c.val(); d._key = c.key; list.push(d); });
    list.sort(function(a,b) { return (b.upvotes||0) - (a.upvotes||0); });

    var myUpvotes = {};
    try { myUpvotes = JSON.parse(localStorage.getItem('_mes_upv_' + (window.U||{}).uid) || '{}'); } catch(e) {}

    var h = '<div>';
    if (!list.length) { h += '<div style="text-align:center;padding:16px;color:var(--txt2)">Koi pending suggestions nahi hain</div>'; }
    list.forEach(function(sg, idx) {
      var voted = myUpvotes[sg._key];
      h += '<div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:10px;margin-bottom:8px;display:flex;gap:10px;align-items:center">';
      h += '<div style="text-align:center;min-width:36px">';
      h += '<button onclick="upvoteSuggestion(\'' + sg._key + '\')" style="background:' + (voted ? 'rgba(0,255,156,.15)' : 'rgba(255,255,255,.06)') + ';border:1px solid ' + (voted ? 'rgba(0,255,156,.3)' : 'rgba(255,255,255,.1)') + ';color:' + (voted ? 'var(--green)' : 'var(--txt2)') + ';width:36px;height:36px;border-radius:10px;cursor:pointer;font-size:16px">' + (voted ? '👍' : '🔼') + '</button>';
      h += '<div style="font-size:10px;color:var(--txt2);margin-top:2px">' + (sg.upvotes||0) + '</div></div>';
      h += '<div style="flex:1"><div style="font-size:12px;font-weight:700">' + sg.title + '</div>';
      h += '<div style="font-size:10px;color:var(--txt2);margin-top:2px">' + sg.description.substring(0,60) + '...</div></div>';
      h += '</div>';
    });
    h += '</div>';
    if (window.openModal) openModal('🔥 Top Suggestions (Vote Karo)', h);
  });
};

window.upvoteSuggestion = function(key) {
  if (!window.U) return;
  var uid = window.U.uid;
  var myUpvotes = {};
  try { myUpvotes = JSON.parse(localStorage.getItem('_mes_upv_' + uid) || '{}'); } catch(e) {}
  if (myUpvotes[key]) { if (window.toast) toast('Already upvote kiya hai!', 'inf'); return; }

  db.ref('suggestions/' + key + '/upvotes').transaction(function(v) { return (v||0)+1; });
  db.ref('suggestions/' + key + '/upvoters/' + uid).set(true);
  myUpvotes[key] = true;
  try { localStorage.setItem('_mes_upv_' + uid, JSON.stringify(myUpvotes)); } catch(e) {}
  if (window.toast) toast('✅ Upvoted!', 'ok');
  // Re-render
  setTimeout(window.showTopSuggestions, 300);
};

console.log('[Mini eSports] ✅ Feature 45: Suggestion System loaded');
})();
