/* ============================================================
   USER-FACING POLLS — features/polls.js
   ✅ NEW FEATURE (2026-08-23): "Admin panel me poll feature hai lekin
   user panel me hai hi nahi — user panel me sahi se banao poll feature
   bahut dhyan se". Admin Panel already has full poll CREATE/manage
   (js/features/fa26-poll-suggestion.js), writing to the real Supabase
   `polls` table (options: {key:{label,votes}}, vote_counts jsonb,
   total_votes, status: 'active'|'closed'). This file is the missing
   other half — the actual voting UI players see and use.

   Voting goes through cast_poll_vote(poll_id, option, option_idx) —
   an atomic, server-verified RPC backed by poll_votes' real
   UNIQUE(poll_id, user_id) constraint, so a user genuinely cannot
   double-vote even with a network retry or a fast double-tap; the DB
   itself refuses the second attempt, not just a client-side check.
   ============================================================ */

function _pollsSupa() { return window._supa; }
function _pollsUid() { return window.U ? window.U.uid : null; }

/* Home-screen banner: shows if there's at least one active poll the
   user hasn't voted on yet. Call this from wherever the home screen
   renders its feature banners (see renderHome in the codebase). */
window.renderPollBanner = function(containerId) {
  var el = document.getElementById(containerId || 'pollBannerSlot');
  if (!el || !_pollsSupa() || !_pollsUid()) { if (el) el.innerHTML = ''; return; }

  _pollsSupa().from('polls').select('id,title,question,options,status')
    .eq('status', 'active').order('created_at', { ascending: false }).limit(1)
    .then(function(r) {
      var poll = (r.data || [])[0];
      if (!poll) { el.innerHTML = ''; return; }
      _pollsSupa().rpc('get_my_poll_vote', { p_poll_id: poll.id }).then(function(vr) {
        var alreadyVoted = vr && vr.data;
        var title = poll.title || poll.question || 'Poll';
        el.innerHTML =
          '<div onclick="showActivePoll(\'' + poll.id + '\')" style="display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:14px;background:rgba(0,212,255,.07);border:1px solid rgba(0,212,255,.2);cursor:pointer;margin-bottom:12px">' +
          '<div style="font-size:22px">📊</div>' +
          '<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:800;color:#00d4ff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (window.escHtml ? escHtml(title) : title) + '</div>' +
          '<div style="font-size:11px;color:var(--txt2);margin-top:2px">' + (alreadyVoted ? 'Result dekho' : 'Tap karke vote karo') + '</div></div>' +
          '<i class="fas fa-chevron-right" style="color:#00d4ff;font-size:12px"></i>' +
          '</div>';
      });
    }, function() { el.innerHTML = ''; });
};

/* Full poll list — call from a "Polls" nav entry / profile menu item. */
window.showPollsList = function() {
  if (!_pollsSupa()) { toast('Service unavailable', 'err'); return; }
  if (window.openModal) openModal('📊 Polls', '<div style="text-align:center;padding:30px"><i class="fas fa-spinner fa-spin" style="font-size:22px;color:#00d4ff"></i></div>');

  _pollsSupa().from('polls').select('id,title,question,options,status,total_votes,created_at')
    .order('created_at', { ascending: false }).limit(30)
    .then(function(r) {
      var polls = r.data || [];
      var h = '<div>';
      if (!polls.length) {
        h += '<div style="text-align:center;padding:24px;color:var(--txt2)"><div style="font-size:32px;margin-bottom:8px">📊</div>Abhi koi poll nahi hai</div>';
      }
      polls.forEach(function(p) {
        var isActive = p.status === 'active';
        var title = p.title || p.question || 'Poll';
        h += '<div onclick="showActivePoll(\'' + p.id + '\')" style="padding:12px 14px;border-radius:12px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);margin-bottom:8px;cursor:pointer">';
        h += '<div style="display:flex;justify-content:space-between;align-items:center">';
        h += '<span style="font-size:13px;font-weight:700;flex:1;margin-right:8px">' + (window.escHtml ? escHtml(title) : title) + '</span>';
        h += '<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:8px;background:' + (isActive ? 'rgba(0,255,156,.12);color:#00ff9c' : 'rgba(255,100,100,.12);color:#ff6464') + '">' + (isActive ? '🟢 Active' : '🔴 Closed') + '</span>';
        h += '</div><div style="font-size:11px;color:var(--txt2);margin-top:4px">' + (p.total_votes || 0) + ' votes</div>';
        h += '</div>';
      });
      h += '</div>';
      if (window.openModal) openModal('📊 Polls', h);
    }, function() {
      if (window.openModal) openModal('📊 Polls', '<div style="text-align:center;padding:24px;color:var(--red)">Load nahi ho paya, dobara try karo</div>');
    });
};

/* Single poll — vote form if not yet voted, live results if already voted or closed. */
/* ✅ SPEED FIX (2026-08-24): pollBannerSlot never had a realtime
   subscription at all — it only ever fetched once on renderHome() being
   hooked, and once more per renderHome() call. If admin opens/closes a
   poll while the user is sitting on Home, nothing updated until the
   next full app reload. Now polls is in the supabase_realtime
   publication (this session's DB delta), so subscribe once and refresh
   the banner + any open poll modal live, the instant admin changes
   anything. */
if (window._supa && !window._pollsRtHooked) {
  window._pollsRtHooked = true;
  window._supa.channel('polls-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'polls' }, function() {
      if (window.renderPollBanner) renderPollBanner('pollBannerSlot');
      if (window._openPollId && window.showActivePoll) showActivePoll(window._openPollId);
    })
    .subscribe();
}

window.showActivePoll = function(pollId) {
  window._openPollId = pollId; /* tracked so the live subscription above can refresh an open modal */
  if (!_pollsSupa()) return;
  if (window.openModal) openModal('📊 Poll', '<div style="text-align:center;padding:30px"><i class="fas fa-spinner fa-spin" style="font-size:22px;color:#00d4ff"></i></div>');

  Promise.all([
    _pollsSupa().from('polls').select('id,title,question,options,vote_counts,total_votes,status,image_url').eq('id', pollId).maybeSingle(),
    _pollsUid() ? _pollsSupa().rpc('get_my_poll_vote', { p_poll_id: pollId }) : Promise.resolve({ data: null })
  ]).then(function(results) {
    var poll = results[0] && results[0].data;
    var myVote = results[1] && results[1].data;
    if (!poll) { if (window.openModal) openModal('📊 Poll', '<div style="text-align:center;padding:24px;color:var(--txt2)">Yeh poll nahi mila</div>'); return; }
    _renderPollModal(poll, myVote);
  }, function() {
    if (window.openModal) openModal('📊 Poll', '<div style="text-align:center;padding:24px;color:var(--red)">Load nahi ho paya, dobara try karo</div>');
  });
};

function _renderPollModal(poll, myVote) {
  var title = poll.title || poll.question || 'Poll';
  var opts = _normalizePollOptions(poll.options);
  var counts = poll.vote_counts || {};
  var total = Number(poll.total_votes) || Object.keys(counts).reduce(function(s, k) { return s + (Number(counts[k]) || 0); }, 0);
  var showResults = !!myVote || poll.status !== 'active';

  var h = '<div>';
  if (poll.image_url) h += '<img src="' + poll.image_url + '" style="width:100%;border-radius:12px;margin-bottom:12px;max-height:160px;object-fit:cover">';
  h += '<div style="font-size:15px;font-weight:800;margin-bottom:14px">' + (window.escHtml ? escHtml(title) : title) + '</div>';

  opts.forEach(function(opt) {
    var voteCount = Number(counts[opt.key]) || 0;
    var pct = total > 0 ? Math.round((voteCount / total) * 100) : 0;
    var isMyVote = myVote === opt.key;
    if (showResults) {
      h += '<div style="margin-bottom:10px">';
      h += '<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">';
      h += '<span style="font-weight:' + (isMyVote ? '800' : '600') + ';color:' + (isMyVote ? '#00d4ff' : 'var(--txt)') + '">' + (window.escHtml ? escHtml(opt.label) : opt.label) + (isMyVote ? ' ✓' : '') + '</span>';
      h += '<span style="color:var(--txt2)">' + pct + '% (' + voteCount + ')</span></div>';
      h += '<div style="height:8px;background:rgba(255,255,255,.06);border-radius:6px;overflow:hidden"><div style="height:100%;width:' + pct + '%;background:' + (isMyVote ? '#00d4ff' : 'rgba(0,212,255,.4)') + ';border-radius:6px"></div></div>';
      h += '</div>';
    } else {
      h += '<button onclick="submitPollVote(\'' + poll.id + '\',\'' + opt.key + '\',' + opt.idx + ')" style="width:100%;padding:12px;border-radius:12px;background:rgba(0,212,255,.06);border:1px solid rgba(0,212,255,.25);color:var(--txt);font-size:13px;font-weight:700;cursor:pointer;margin-bottom:8px;text-align:left">' + (window.escHtml ? escHtml(opt.label) : opt.label) + '</button>';
    }
  });

  if (showResults) {
    h += '<div style="text-align:center;font-size:11px;color:var(--txt2);margin-top:10px">' + total + ' total votes' + (poll.status !== 'active' ? ' · Poll band ho chuka hai' : (myVote ? ' · Tumne vote kar diya ✓' : '')) + '</div>';
  }
  h += '</div>';
  if (window.openModal) openModal('📊 Poll', h);
}

/* Options can arrive as {opt1:{label,votes}} (object) or as an array —
   the admin panel's own render code (fa26-poll-suggestion.js) already
   handles both shapes for exactly this reason, so this mirrors that. */
function _normalizePollOptions(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map(function(o, i) {
      if (typeof o === 'string') return { key: o, label: o, idx: i };
      return { key: o.id || o.key || o.label || ('opt' + i), label: o.label || o.text || o.id || 'Option', idx: i };
    });
  }
  return Object.keys(raw).map(function(k, i) {
    var o = raw[k];
    var label = (o && typeof o === 'object') ? (o.label || k) : (o || k);
    return { key: k, label: label, idx: i };
  });
}

window.submitPollVote = function(pollId, optionKey, optionIdx) {
  if (!_pollsUid()) { toast('Login karo pehle', 'err'); return; }
  if (!_pollsSupa()) { toast('Service unavailable', 'err'); return; }

  _pollsSupa().rpc('cast_poll_vote', { p_poll_id: pollId, p_option: optionKey, p_option_idx: optionIdx }).then(function(r) {
    var res = r && r.data;
    if (r.error || !res || !res.ok) {
      var errCode = (res && res.error) || (r.error && r.error.message) || 'unknown';
      var msg = errCode === 'already_voted' ? 'Tumne pehle hi vote kar diya hai'
              : errCode === 'poll_closed' ? 'Yeh poll band ho chuka hai'
              : 'Vote submit nahi hua, dobara try karo';
      toast(msg, 'err');
      /* Even on "already_voted" (e.g. a race from a double-tap), refresh
         to show the real current state instead of leaving a stale form. */
      if (errCode === 'already_voted' || errCode === 'poll_closed') showActivePoll(pollId);
      return;
    }
    toast('✅ Vote submit ho gaya!', 'ok');
    showActivePoll(pollId);
  }, function() {
    toast('Network error — dobara try karo', 'err');
  });
};

/* Home-screen injection — the #pollBannerSlot div lives permanently in
   index.html right after the category pills (a sibling of #homeList,
   never touched by renderHome()'s own re-renders). Just hook renderHome
   to also refresh this slot's content after each render, same
   established pattern as the "Invite & Earn" banner in js/fixes-v7.js. */
if (typeof waitFor === 'function') {
  waitFor(function () { return window.renderHome; }, function () {
    if (window._pollBannerHooked) return;
    window._pollBannerHooked = true;
    var origRenderHome = window.renderHome;
    window.renderHome = function () {
      origRenderHome.apply(this, arguments);
      if (window.renderPollBanner) renderPollBanner('pollBannerSlot');
    };
  });
  /* Also render once on initial load, in case the user lands on Home
     before renderHome() is first called by the app's own boot flow. */
  waitFor(function () { return window.U && window._supa; }, function () {
    setTimeout(function () { if (window.renderPollBanner) renderPollBanner('pollBannerSlot'); }, 800);
  });
}
