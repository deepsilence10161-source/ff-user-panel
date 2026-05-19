/* ================================================================
   AUTH — Updated for Supabase (Google + Email) + Firebase fallback
   DB.auth.* = Supabase | auth.* = Firebase fallback (for RTDB)
================================================================ */

/* Override doGoogleLogin to use Supabase */
window._supaGoogleLogin = async function() {
  /* Supabase Google OAuth — only if GCP OAuth is configured in Supabase Dashboard */
  /* Until then, Firebase Auth handles Google login (works without extra setup) */
  var supaConfigured = (typeof SUPA_URL !== 'undefined' && SUPA_URL.indexOf('YOUR_PROJECT') === -1)
    || (window.DB && window._supaReady);
  
  if (supaConfigured && window.DB && window.DB.auth) {
    try {
      var btn = $('googleBtn');
      if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in...'; }
      await DB.auth.loginWithGoogle();
      return;
    } catch(e) {
      /* Supabase Google failed — fall through to Firebase */
      console.warn('[Auth] Supabase Google failed, trying Firebase:', e.message);
      var btn2 = $('googleBtn');
      if (btn2) { btn2.disabled = false; btn2.innerHTML = '<svg viewBox="0 0 24 24" fill="none"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg> Continue with Google'; }
    }
  }
  /* Firebase Auth (primary/fallback) */
  window._firebaseGoogleLogin && window._firebaseGoogleLogin();
};

/* Supabase email login */
window.doEmailLoginSupabase = async function(email, pass) {
  email = email || (document.getElementById('fbEmail')||{}).value || '';
  pass  = pass  || (document.getElementById('fbPass')||{}).value  || '';
  if (!window.DB || !window.DB.auth) { doEmailLoginFb(); return; }
  try {
    var result = await DB.auth.loginWithEmail(email, pass);
    if (result && result.user) { closeModal(); }
    else { toast('Login failed — check email/password', 'err'); }
  } catch(e) {
    toast(e.message || 'Login failed', 'err');
  }
};

/* Supabase email register */
window.doEmailRegisterSupabase = async function(name, email, pass) {
  name  = name  || (document.getElementById('fbRegName')||{}).value  || '';
  email = email || (document.getElementById('fbRegEmail')||{}).value || '';
  pass  = pass  || (document.getElementById('fbRegPass')||{}).value  || '';
  if (!window.DB || !window.DB.auth) { doEmailRegisterFb(); return; }
  try {
    var result = await DB.auth.registerWithEmail(email, pass, name);
    if (result && result.user) {
      /* Create user profile in Supabase */
      await DB.users.create(result.user.id, { ign: name, email: email });
      closeModal();
      toast('✅ Account bana! Welcome ' + name, 'ok');
    }
  } catch(e) {
    toast(e.message || 'Register failed', 'err');
  }
};

/* Listen to Supabase auth changes */
window._initSupabaseAuth = function() {
  if (!window._supa) { setTimeout(window._initSupabaseAuth, 500); return; }
  DB.auth.onAuthChange(async function(event, session) {
    if (event === 'SIGNED_IN' && session) {
      /* Mark Supabase handled auth — prevent Firebase auth from duplicating */
      window._supaAuthHandled = true;
      window._authFired = true;
      window.U = {
        uid: session.user.id,
        displayName: session.user.user_metadata.full_name || session.user.email,
        email: session.user.email,
        photoURL: session.user.user_metadata.avatar_url || null
      };
      /* Load user profile from Supabase */
      var profile = await DB.users.getMe();
      if (!profile) {
        /* First login — create profile */
        await DB.users.create(session.user.id, {
          ign: window.U.displayName,
          email: window.U.email,
          avatar_url: window.U.photoURL
        });
        profile = await DB.users.getMe();
      }
      window.UD = profile || {};
      /* Prevent double afterLogin if Firebase also fires */
      if (!window._bootCalled && window.afterLogin) afterLogin(window.U);
      /* Save OneSignal Player ID */
      if (window._saveOneSignalId) _saveOneSignalId(session.user.id);
    } else if (event === 'SIGNED_OUT') {
      window.U = null; window.UD = null;
      $('header').style.display = 'none';
      $('bottomNav').style.display = 'none';
      $('mainContent').style.display = 'none';
      $('loginScreen').style.display = 'flex';
    }
  });
};

/* Auto-init Supabase auth */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', window._initSupabaseAuth);
} else {
  setTimeout(window._initSupabaseAuth, 300);
}

/* ====== GOOGLE LOGIN ====== */
/* Simple signInWithPopup — works on browser & GitHub Pages */
var _GOOGLE_BTN_HTML = '<svg viewBox="0 0 24 24" fill="none"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg> Continue with Google';

/* ── WEBVIEW DETECTION ── */
function _isWebView() {
  if (window.isAndroidApp === true) return true;
  var ua = navigator.userAgent || '';
  if (/; wv\)/.test(ua)) return true;
  if (/Version\/[\d.]+.*Chrome\/[\d.]+.*Mobile Safari/.test(ua)) return true;
  return false;
}

/* ── GOOGLE LOGIN — 100% WebView + Browser compatible ── */
window._firebaseGoogleLogin = function() {
  var btn = $('googleBtn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in...'; }

  var isWV = _isWebView();

  if (isWV) {
    // ── WEBVIEW: signInWithRedirect ──
    // Firebase redirect Firebase ke servers pe jaata hai phir wapas aata hai
    // AppMint ka WebView URL ko handle karta hai
    gp.setCustomParameters({ prompt: 'select_account' });
    auth.signInWithRedirect(gp)
      .catch(function(e) {
        if (btn) { btn.disabled = false; btn.innerHTML = _GOOGLE_BTN_HTML; }
        var code = e.code || '';
        if (code === 'auth/unauthorized-domain') {
          // Show manual email login as fallback
          if (btn) btn.disabled = false;
          showEmailLoginFallback();
        } else {
          toast(e.message || 'Login failed — Email se try karo', 'err');
          setTimeout(showEmailLoginFallback, 1500);
        }
      });
    return;
  }

  // ── BROWSER: signInWithPopup ──
  auth.signInWithPopup(gp).then(function() {
    // onAuthStateChanged handle karega
  }).catch(function(err) {
    if (btn) { btn.disabled = false; btn.innerHTML = _GOOGLE_BTN_HTML; }
    var code = err.code || '';
    if (code === 'auth/popup-closed-by-user') {
      toast('Login cancel kiya', 'inf');
    } else if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
      toast('Redirect se try kar raha hoon...', 'inf');
      auth.signInWithRedirect(gp).catch(function(e2){ toast(e2.message||'Login failed','err'); });
    } else if (code === 'auth/unauthorized-domain') {
      var lh = document.querySelector('.login-help');
      if (lh) lh.innerHTML = '<span style="color:#ff6b6b;font-weight:700">⚠️ Domain authorized nahi — Firebase Console mein add karo.</span>';
      toast('Domain not authorized', 'err');
    } else {
      auth.signInWithRedirect(gp).catch(function(e2){ toast(e2.message||'Login failed','err'); });
    }
  });
}

/* ── EMAIL FALLBACK LOGIN — agar Google redirect bhi na chale ── */
function showEmailLoginFallback() {
  var h = '<div>';
  h += '<div style="background:rgba(255,165,0,.08);border:1px solid rgba(255,165,0,.2);border-radius:12px;padding:10px 12px;margin-bottom:14px;font-size:12px;color:#ff9f1c">';
  h += '<i class="fas fa-info-circle"></i> Google login APK mein issue aa raha hai — Email se login karo (same account)';
  h += '</div>';
  h += '<div class="f-group"><label>Email</label><input type="email" class="f-input" id="fbEmail" placeholder="apna@gmail.com" autocomplete="email"></div>';
  h += '<div class="f-group"><label>Password</label><input type="password" class="f-input" id="fbPass" placeholder="Password" autocomplete="current-password"></div>';
  h += '<button class="f-btn fb-green" onclick="doEmailLoginSupabase()"><i class="fas fa-sign-in-alt"></i> Login</button>';
  h += '<div style="text-align:center;margin-top:10px"><span style="color:var(--txt2);font-size:12px">Account nahi? </span>';
  h += '<span onclick="showEmailRegisterFb()" style="color:var(--green);font-weight:700;cursor:pointer;font-size:12px">Register karo</span></div>';
  h += '</div>';
  openModal('Login', h);
}

function doEmailLoginFb() {
  var email = ($('fbEmail')||{}).value||'';
  var pass  = ($('fbPass')||{}).value||'';
  if (!email || !pass) { toast('Email aur password daalo', 'err'); return; }
  auth.signInWithEmailAndPassword(email, pass)
    .then(function() { closeModal(); })
    .catch(function(e) {
      if (e.code === 'auth/user-not-found' || e.code === 'auth/wrong-password') {
        toast('Email ya password galat hai', 'err');
      } else {
        toast(e.message, 'err');
      }
    });
}

function showEmailRegisterFb() {
  var h = '<div>';
  h += '<div class="f-group"><label>Name / IGN</label><input type="text" class="f-input" id="fbRegName" placeholder="Tumhara naam"></div>';
  h += '<div class="f-group"><label>Email</label><input type="email" class="f-input" id="fbRegEmail" placeholder="apna@gmail.com"></div>';
  h += '<div class="f-group"><label>Password</label><input type="password" class="f-input" id="fbRegPass" placeholder="Min 6 characters"></div>';
  h += '<button class="f-btn fb-green" onclick="doEmailRegisterSupabase()"><i class="fas fa-user-plus"></i> Register</button>';
  h += '</div>';
  openModal('Register', h);
}

function doEmailRegisterFb() {
  var name  = ($('fbRegName')||{}).value||'';
  var email = ($('fbRegEmail')||{}).value||'';
  var pass  = ($('fbRegPass')||{}).value||'';
  if (!name || !email || !pass) { toast('Sab fields bharo', 'err'); return; }
  if (pass.length < 6) { toast('Password min 6 characters', 'err'); return; }
  auth.createUserWithEmailAndPassword(email, pass)
    .then(function(uc) { return uc.user.updateProfile({ displayName: name }); })
    .then(function() { closeModal(); toast('✅ Account bana! Welcome ' + name, 'ok'); })
    .catch(function(e) { toast(e.message, 'err'); });
}

function enablePushNotifs() {
  if (window.f17MatchReminder) {
    window.f17MatchReminder.request(function(ok) {
      if (ok) {
        toast('🔔 Notifications enabled! Match reminders milenge.', 'ok');
      } else if (('Notification' in window) && Notification.permission === 'denied') {
        openModal('🔔 Notifications Blocked', '<div style="text-align:center;padding:8px"><div style="font-size:40px;margin-bottom:12px">🔕</div><div style="font-size:14px;font-weight:700;margin-bottom:8px">Browser ne block kar diya hai</div><div style="font-size:12px;color:var(--txt2);line-height:1.6">Notifications enable karne ke liye:<br><strong>1.</strong> Address bar mein 🔒 lock icon tap karo<br><strong>2.</strong> Notifications → Allow karo<br><strong>3.</strong> Page refresh karo</div></div>');
      } else {
        toast('❌ Notifications supported nahi hain is browser mein', 'err');
      }
    });
  }
}

/* ====== MY TEAM MODAL ====== */
function showMyTeamModal() {
  if (!window.UD || !window.U) return;
  var UD = window.UD, U = window.U;
  var h = '';

  // Duo Partner
  h += '<div style="background:var(--card2);border-radius:16px;padding:16px;margin-bottom:14px">';
  h += '<h4 style="margin:0 0 14px;font-size:14px;display:flex;align-items:center;gap:8px"><i class="fas fa-user-friends" style="color:var(--green)"></i> Duo Partner</h4>';
  h += '<div style="display:flex;gap:14px;align-items:flex-start">';
  // You slot
  h += '<div style="text-align:center"><div style="width:54px;height:54px;border-radius:50%;background:rgba(0,255,156,.15);border:2px solid var(--green);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:800;color:var(--green);margin:0 auto 6px">' + (UD.profileImage ? '<img src="'+UD.profileImage+'" style="width:100%;height:100%;border-radius:50%;object-fit:cover">' : (UD.ign||'Y').charAt(0)) + '</div><div style="font-size:11px;font-weight:700;color:var(--green)">You 👑</div></div>';
  // Partner slot
  var duoT = UD.duoTeam;
  if (duoT && duoT.memberUid) {
    h += '<div style="text-align:center"><div style="width:54px;height:54px;border-radius:50%;background:rgba(0,255,156,.1);border:2px solid var(--green);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:800;color:var(--txt);margin:0 auto 6px">' + (duoT.memberName||'T').charAt(0) + '</div><div style="font-size:11px;font-weight:600;color:var(--txt)">' + (duoT.memberName||'Teammate') + '</div><div onclick="removeTM(\'duo\',0)" style="font-size:10px;color:#ff5555;cursor:pointer;margin-top:4px">✕ Remove</div></div>';
  } else {
    h += '<div style="text-align:center"><div onclick="if(window.closeModal)closeModal();addTM(\'duo\')" style="width:54px;height:54px;border-radius:50%;background:rgba(255,255,255,.04);border:2px dashed rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:22px;color:rgba(255,255,255,.3);margin:0 auto 6px;cursor:pointer">+</div><div style="font-size:11px;color:var(--txt2)">Add</div></div>';
  }
  h += '</div></div>';

  // Squad Team
  h += '<div style="background:var(--card2);border-radius:16px;padding:16px">';
  h += '<h4 style="margin:0 0 14px;font-size:14px;display:flex;align-items:center;gap:8px"><i class="fas fa-users" style="color:var(--green)"></i> Squad Team</h4>';
  h += '<div style="display:flex;gap:12px;flex-wrap:wrap">';
  // You
  h += '<div style="text-align:center"><div style="width:50px;height:50px;border-radius:50%;background:rgba(0,255,156,.15);border:2px solid var(--green);display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:800;color:var(--green);margin:0 auto 6px">' + (UD.profileImage ? '<img src="'+UD.profileImage+'" style="width:100%;height:100%;border-radius:50%;object-fit:cover">' : (UD.ign||'Y').charAt(0)) + '</div><div style="font-size:10px;font-weight:700;color:var(--green)">You 👑</div></div>';
  var sqMembers = (UD.squadTeam && UD.squadTeam.members) || [];
  for (var i = 0; i < 3; i++) {
    if (sqMembers[i]) {
      h += '<div style="text-align:center"><div style="width:50px;height:50px;border-radius:50%;background:rgba(0,255,156,.1);border:2px solid var(--green);display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:800;color:var(--txt);margin:0 auto 6px">' + (sqMembers[i].name||'T').charAt(0) + '</div><div style="font-size:10px;font-weight:600;color:var(--txt)">' + (sqMembers[i].name||'Mate') + '</div><div onclick="removeTM(\'squad\',' + i + ')" style="font-size:10px;color:#ff5555;cursor:pointer;margin-top:3px">✕</div></div>';
    } else {
      h += '<div style="text-align:center"><div onclick="if(window.closeModal)closeModal();addTM(\'squad\')" style="width:50px;height:50px;border-radius:50%;background:rgba(255,255,255,.04);border:2px dashed rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:20px;color:rgba(255,255,255,.3);margin:0 auto 6px;cursor:pointer">+</div><div style="font-size:10px;color:var(--txt2)">Add</div></div>';
    }
  }
  h += '</div></div>';

  if (window.openModal) openModal('👥 My Team', h);
}

/* ====== VOUCHER MODAL ====== */
function showVoucherModal() {
  var h = '<div style="text-align:center;padding:10px 0 20px">';
  h += '<div style="font-size:48px;margin-bottom:12px">🎫</div>';
  h += '<div style="font-size:15px;font-weight:700;color:var(--txt);margin-bottom:6px">Redeem Voucher</div>';
  h += '<div style="font-size:12px;color:var(--txt2);margin-bottom:20px">Enter your voucher code to get coins or balance</div>';
  h += '<input type="text" id="voucherIn" placeholder="Enter voucher code" style="width:100%;padding:13px 16px;border-radius:12px;background:var(--card2);border:1px solid var(--border);color:var(--txt);font-size:14px;text-align:center;text-transform:uppercase;letter-spacing:2px;box-sizing:border-box;margin-bottom:14px">';
  h += '<button onclick="redeemVoucher()" style="width:100%;padding:13px;border-radius:12px;background:linear-gradient(135deg,#ffaa00,#ff8800);color:#000;font-weight:900;border:none;cursor:pointer;font-size:14px">🎫 Redeem</button>';
  h += '</div>';
  if (window.openModal) openModal('🎫 Redeem Voucher', h);
}

/* ====== PROFILE SETTINGS BOTTOM SHEET ====== */
function showProfileSettings() {
  var existing = document.getElementById('profSettingsSheet');
  if (existing) existing.remove();

  var sheet = document.createElement('div');
  sheet.id = 'profSettingsSheet';
  sheet.style.cssText = 'position:fixed;inset:0;z-index:9000;display:flex;flex-direction:column;justify-content:flex-end';

  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px)';
  overlay.onclick = function() { closeProfileSettings(); };

  var panel = document.createElement('div');
  panel.style.cssText = 'position:relative;background:#111;border-radius:22px 22px 0 0;padding:0 0 32px;max-height:90vh;overflow-y:auto;animation:slideUp .28s cubic-bezier(.4,0,.2,1)';

  var items = [
    { icon: 'fa-users',       label: 'My Team',         color: '#00ff9c', fn: "showMyTeamModal()",                                   bg: 'rgba(0,255,156,.08)',   border: 'rgba(0,255,156,.2)' },
    { icon: 'fa-gift',        label: 'Refer & Earn',    color: '#aa55ff', fn: "window.showReferralStats&&showReferralStats()",        bg: 'rgba(170,85,255,.08)',  border: 'rgba(170,85,255,.2)' },
    { icon: 'fa-medal',       label: 'Achievements',    color: '#ffd700', fn: "window.showAchievements&&showAchievements()",          bg: 'rgba(255,215,0,.08)',   border: 'rgba(255,215,0,.2)' },
    { icon: 'fa-crosshairs',  label: 'My Rival 🎯',    color: '#ff4444', fn: "window.showRivalCard&&showRivalCard()",               bg: 'rgba(255,68,68,.08)',   border: 'rgba(255,68,68,.2)' },
    { icon: 'fa-id-card',     label: 'Player Card',     color: '#00ff9c', fn: "window.generateAdvancedPlayerCard&&generateAdvancedPlayerCard()", bg: 'rgba(0,255,156,.1)', border: 'rgba(0,255,156,.25)' },
    { icon: 'fa-chart-bar',   label: 'Stat Card',       color: '#00d4ff', fn: "window.generateStatCard&&generateStatCard()",         bg: 'rgba(0,212,255,.08)',   border: 'rgba(0,212,255,.2)' },
    { icon: 'fa-store',       label: 'Rewards Store',   color: '#ff8c00', fn: "window.showRewardsStore&&showRewardsStore()",         bg: 'rgba(255,140,0,.08)',   border: 'rgba(255,140,0,.2)' },
    { icon: 'fa-ticket-alt',  label: 'Redeem Voucher',  color: '#ffaa00', fn: "showVoucherModal()",                                  bg: 'rgba(255,170,0,.08)',   border: 'rgba(255,170,0,.2)' },
    { icon: 'fa-history',     label: 'Match History',   color: '#00d4ff', fn: "window.showMatchHistory&&showMatchHistory()",         bg: 'rgba(0,212,255,.08)',   border: 'rgba(0,212,255,.2)' },
    { icon: 'fa-crown',       label: 'Season Stats',    color: '#ffd700', fn: "window.showSeasonStats&&showSeasonStats()",           bg: 'rgba(255,215,0,.08)',   border: 'rgba(255,215,0,.2)' },

    { icon: 'fa-sign-out-alt',label: 'Logout',          color: '#ff4444', fn: "doLogout()",                                          bg: 'rgba(255,60,60,.08)',   border: 'rgba(255,60,60,.25)' },
  ];

  var html = '<div style="display:flex;justify-content:center;padding:12px 0 4px"><div style="width:36px;height:4px;border-radius:2px;background:rgba(255,255,255,.15)"></div></div>';
  html += '<div style="padding:16px 20px 12px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,.07)">';
  html += '<span style="font-size:16px;font-weight:700;color:#fff"><i class="fas fa-cog" style="color:var(--green);margin-right:8px"></i>Settings</span>';
  html += '<div onclick="closeProfileSettings()" style="width:30px;height:30px;border-radius:8px;background:rgba(255,255,255,.08);display:flex;align-items:center;justify-content:center;cursor:pointer"><i class="fas fa-times" style="color:#aaa;font-size:13px"></i></div>';
  html += '</div>';
  html += '<div style="padding:14px 16px;display:grid;grid-template-columns:1fr 1fr;gap:10px">';

  items.forEach(function(item) {
    html += '<div onclick="(function(){history.pushState(null,null,null);try{' + item.fn + '}catch(e){}setTimeout(function(){closeProfileSettings();},250);})()" style="display:flex;align-items:center;gap:10px;padding:13px 14px;border-radius:14px;background:' + item.bg + ';border:1px solid ' + item.border + ';cursor:pointer;transition:all .15s;-webkit-tap-highlight-color:transparent">';
    html += '<div style="width:32px;height:32px;border-radius:9px;background:' + item.border + ';display:flex;align-items:center;justify-content:center;flex-shrink:0"><i class="fas ' + item.icon + '" style="color:' + item.color + ';font-size:14px"></i></div>';
    html += '<span style="font-size:12px;font-weight:700;color:#ddd;line-height:1.3">' + item.label + '</span>';
    html += '</div>';
  });

  // Legal & Compliance section
  html += '</div>';
  /* Permissions section */
  html += '<div style="padding:4px 16px 8px">';
  html += '<div style="font-size:10px;font-weight:800;color:#555;text-transform:uppercase;letter-spacing:1px;padding:8px 0 6px;border-top:1px solid rgba(255,255,255,.05)">🔔 App Permissions</div>';
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">';
  var permHtml = '';
  /* Notification permission */
  var notifStatus = (typeof Notification !== 'undefined') ? Notification.permission : 'unknown';
  var notifColor = notifStatus === 'granted' ? '#00ff9c' : '#ffaa00';
  var notifLabel = notifStatus === 'granted' ? '✅ Notifications' : '🔔 Notifications';
  permHtml += '<div onclick="window._reqNotifPerm&&_reqNotifPerm()" style="display:flex;align-items:center;gap:10px;padding:13px 14px;border-radius:14px;background:rgba(255,170,0,.06);border:1px solid rgba(255,170,0,.2);cursor:pointer">';
  permHtml += '<div style="width:32px;height:32px;border-radius:9px;background:rgba(255,170,0,.15);display:flex;align-items:center;justify-content:center"><i class="fas fa-bell" style="color:' + notifColor + ';font-size:14px"></i></div>';
  permHtml += '<span style="font-size:12px;font-weight:700;color:#ddd">' + notifLabel + '</span></div>';
  /* Location permission */
  permHtml += '<div onclick="window._reqLocationPerm&&_reqLocationPerm()" style="display:flex;align-items:center;gap:10px;padding:13px 14px;border-radius:14px;background:rgba(0,255,156,.06);border:1px solid rgba(0,255,156,.2);cursor:pointer">';
  permHtml += '<div style="width:32px;height:32px;border-radius:9px;background:rgba(0,255,156,.15);display:flex;align-items:center;justify-content:center"><i class="fas fa-map-marker-alt" style="color:#00ff9c;font-size:14px"></i></div>';
  permHtml += '<span style="font-size:12px;font-weight:700;color:#ddd">📍 Location</span></div>';
  html += permHtml + '</div></div>';

  /* Legal section */
  html += '<div style="padding:4px 16px 8px"><div style="font-size:10px;font-weight:800;color:#555;text-transform:uppercase;letter-spacing:1px;padding:8px 0 6px;border-top:1px solid rgba(255,255,255,.05)">⚖️ Legal & Compliance</div>';
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">';
  var legalDefs = [
    { icon: 'fa-file-contract',  label: 'Terms',          color: '#00d4ff', fn: 'mesShowTerms',   bg: 'rgba(0,212,255,.06)',   brd: 'rgba(0,212,255,.2)' },
    { icon: 'fa-user-shield',    label: 'Privacy',        color: '#00d4ff', fn: 'mesShowPrivacy', bg: 'rgba(0,212,255,.06)',   brd: 'rgba(0,212,255,.2)' },
    /* Tax Summary removed — no withdrawal system */
    { icon: 'fa-id-card',        label: 'KYC',            color: '#b964ff', fn: 'mesShowKYC',     bg: 'rgba(185,100,255,.06)', brd: 'rgba(185,100,255,.2)' },
    { icon: 'fa-heart',          label: 'Safe Gaming',    color: '#00ff9c', fn: 'mesRG',          bg: 'rgba(0,255,156,.06)',   brd: 'rgba(0,255,156,.2)' },
    { icon: 'fa-exclamation-circle', label: 'Dispute',   color: '#ffaa00', fn: 'mesDispute',     bg: 'rgba(255,170,0,.06)',   brd: 'rgba(255,170,0,.2)' },
  ];
  legalDefs.forEach(function(ld) {
    html += '<div onclick="(function(){' +
      'var sh=document.getElementById(\'profSettingsSheet\');' +
      'if(sh){sh.style.opacity=\'0\';sh.style.transform=\'translateY(30px)\';sh.style.transition=\'all .25s\';' +
      'setTimeout(function(){if(sh.parentNode)sh.remove();' +
      'history.pushState(null,null,null);' +
      'setTimeout(function(){if(window.' + ld.fn + ')window.' + ld.fn + '();},80);},250);}' +
      'else{history.pushState(null,null,null);if(window.' + ld.fn + ')window.' + ld.fn + '();}' +
      '})()" style="display:flex;align-items:center;gap:10px;padding:13px 14px;border-radius:14px;background:' + ld.bg + ';border:1px solid ' + ld.brd + ';cursor:pointer;-webkit-tap-highlight-color:transparent">';
    html += '<div style="width:32px;height:32px;border-radius:9px;background:' + ld.brd + ';display:flex;align-items:center;justify-content:center;flex-shrink:0"><i class="fas ' + ld.icon + '" style="color:' + ld.color + ';font-size:14px"></i></div>';
    html += '<span style="font-size:12px;font-weight:700;color:#ddd;line-height:1.3">' + ld.label + '</span>';
    html += '</div>';
  });
  html += '</div></div>';
  panel.innerHTML = html;
  sheet.appendChild(overlay);
  sheet.appendChild(panel);
  document.body.appendChild(sheet);
}

function closeProfileSettings() {
  var s = document.getElementById('profSettingsSheet');
  if (s) {
    s.style.opacity = '0';
    s.style.transform = 'translateY(20px)';
    s.style.transition = 'all .2s';
    setTimeout(function() { if (s.parentNode) s.remove(); }, 200);
  }
}

/* ====== PERMISSION REQUEST FUNCTIONS ====== */
window._reqNotifPerm = function() {
  if (!('Notification' in window)) {
    if (window.toast) toast('Notifications not supported in this browser', 'inf'); return;
  }
  if (Notification.permission === 'granted') {
    if (window.toast) toast('✅ Notifications already enabled!', 'ok'); return;
  }
  Notification.requestPermission().then(function(result) {
    if (result === 'granted') {
      if (window.toast) toast('✅ Notifications enabled! You will get match reminders.', 'ok');
      if (window.enablePushNotifs) enablePushNotifs();
    } else if (result === 'denied') {
      if (window.toast) toast('Notifications blocked. Go to browser settings to enable.', 'err');
    }
  });
};

window._reqLocationPerm = function() {
  if (!('geolocation' in navigator)) {
    if (window.toast) toast('Location not supported', 'inf'); return;
  }
  navigator.geolocation.getCurrentPosition(
    function(pos) {
      /* Got location — do reverse geocode via open API */
      var lat = pos.coords.latitude, lon = pos.coords.longitude;
      fetch('https://nominatim.openstreetmap.org/reverse?lat=' + lat + '&lon=' + lon + '&format=json')
        .then(function(r){ return r.json(); })
        .then(function(data) {
          var addr = data.address || {};
          var state = addr.state || addr.province || '';
          var city = addr.city || addr.town || addr.village || addr.county || '';
          var loc = city ? city + ', ' + state : state;
          if (loc && window.U && window.db) {
            window.db.ref('users/' + window.U.uid).update({ city: loc, state: state, lat: lat, lon: lon });
            if (window.UD) { window.UD.city = loc; window.UD.state = state; }
            if (window.toast) toast('📍 Location saved: ' + loc, 'ok');
          }
        })
        .catch(function() {
          if (window.toast) toast('📍 Location saved automatically!', 'ok');
        });
    },
    function(err) {
      if (err.code === 1) {
        if (window.toast) toast('Location permission denied. Enable in browser settings.', 'err');
      } else {
        if (window.toast) toast('Could not get location. Try again.', 'err');
      }
    },
    { timeout: 10000, enableHighAccuracy: false }
  );
};

/* Also add slideUp animation if not already there */
(function() {
  if (!document.getElementById('profSettingsStyle')) {
    var style = document.createElement('style');
    style.id = 'profSettingsStyle';
    style.textContent = '@keyframes slideUp{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}';
    document.head.appendChild(style);
  }
})();

function doLogout() {
  /* Sign out from both Firebase and Supabase */
  try { if (window.auth) auth.signOut(); } catch(e) {}
  try { if (window.DB && window.DB.auth) DB.auth.logout(); } catch(e) {}
  window._supaAuthHandled = false;
  window._bootCalled = false;
  UD = null; U = null; MT = {}; JR = {}; NOTIFS = []; WH = []; REFS = []; TXNS = []; _READ_KEYS = {};
  $('header').style.display = 'none'; $('bottomNav').style.display = 'none';
  $('mainContent').style.display = 'none'; $('loginScreen').style.display = 'flex';
}

/* ====== AUTH STATE ====== */
/* Named app "userPanel" isolates auth from admin panel completely */

/* ── SPLASH HARD FALLBACK: agar onAuthStateChanged 3 sec mein fire na kare ── */
/* window._authFired = global taaki fixes-v8.js bhi dekh sake */
window._authFired = false;
