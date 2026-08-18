/* ====== PROFILE ====== */
function renderProfile() {
  var pc = $('profileContent'); if (!pc || !UD) return;
  var av = UD.profileImage ? '<img src="' + UD.profileImage + '">' : (UD.ign || UD.displayName || '?').charAt(0).toUpperCase();
  var st = UD.stats || {}, rk = calcRk(st);
  var lv = 1 + Math.floor((st.matches||0)/3) + Math.floor((st.wins||0)*2) + Math.floor((st.kills||0)/10) + Math.floor((st.earnings||0)/50);
  var xp = ((st.matches||0)%3)*3 + ((st.kills||0)%10);
  var maxXp = 10, xpPct = Math.min(Math.round((xp/maxXp)*100), 100);

  // Avatar ring color based on rank
  var ringColor = rk.color || 'var(--green)';
  var ringAnim = lv >= 10 ? 'animation:ringPulse 2s infinite' : '';

  /* Get display UID — show FF UID if available, otherwise show partial Firebase UID */
  var displayUid = UD.ffUid || U.uid.substring(0, 12);

  /* ── Premium badge (computed early so the new header can use it) ── */
  var premBadge = '';
  if (UD.premium && UD.premium.tier) {
    var pt = UD.premium.tier;
    var ptLabel = pt===3?'⭐ Premium III':pt===2?'⭐ Premium II':'⭐ Premium I';
    var ptColor = pt===3?'#b964ff':pt===2?'#00d4ff':'#ffd700';
    premBadge = '<span style="display:inline-flex;align-items:center;gap:3px;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:800;background:linear-gradient(135deg,' + ptColor + '33,' + ptColor + '11);border:1px solid ' + ptColor + '66;color:' + ptColor + ';margin-left:6px;vertical-align:middle">' + ptLabel + '</span>';
  }

  /* ── Profile Header Card (2026-07 redesign) ──
     OLD layout: a full-bleed (edge-to-edge, no visible border) banner
     strip with the avatar centered underneath it. Because it had no
     border/rounded edge of its own and bled off both sides of the
     screen, it read as a loose floating strip rather than a contained
     "card" — the ⚙ settings icon technically sat inside that strip's
     DOM, but visually it looked like it was floating outside any card.
     NEW layout: one self-contained, rounded, bordered card — avatar on
     the left, name/UID/level+rank/XP on the right (reference-inspired
     horizontal layout). No separate "Edit Profile" text button — the
     pencil icon on the avatar already handles that. The ⚙ settings icon
     and 🖼 banner-change icon both live inside this card's own top-right
     corner, grouped together. */
  var bannerImg = UD.bannerImage || '';
  var bannerStyle = bannerImg
    ? 'background:url(' + bannerImg + ') center/cover no-repeat'
    : 'background:linear-gradient(135deg,#0a0e2e 0%,#1a1145 40%,#0e2440 100%)';
  var h = '<div class="prof-header" style="position:relative;overflow:hidden;margin:0 0 14px;padding:16px;border-radius:20px;border:1px solid rgba(255,255,255,.08);display:flex;align-items:center;gap:14px;' + bannerStyle + ';box-shadow:0 8px 24px rgba(0,0,0,.35)">';
  /* Decorative glow overlay so the card still looks alive with no custom banner set */
  if (!bannerImg) {
    h += '<div style="position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle at 12% 25%,rgba(185,100,255,.22) 0%,transparent 45%),radial-gradient(circle at 92% 10%,rgba(0,212,255,.18) 0%,transparent 40%),radial-gradient(circle at 60% 105%,rgba(255,140,0,.12) 0%,transparent 45%)"></div>';
  }
  /* Top-right controls — grouped, INSIDE the card (banner-change + settings) */
  var _premActive = window.isPremiumActive ? isPremiumActive() : false;
  var _premActiveGold = window.isPremiumActive ? isPremiumActive(2) : false; /* Gold+ perks: Live Stream, Creator Program */
  h += '<div style="position:absolute;top:10px;right:10px;display:flex;gap:6px;z-index:5">';
  h += '<div onclick="document.getElementById(\'profBannerIn\').click()" title="' + (_premActive?'Change banner':'Premium feature — change banner') + '" style="width:30px;height:30px;border-radius:9px;background:rgba(0,0,0,.45);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.15);display:flex;align-items:center;justify-content:center;cursor:pointer;position:relative"><i class="fas fa-image" style="font-size:12px;color:#ccc"></i>' + (_premActive?'':'<i class="fas fa-lock" style="position:absolute;bottom:-3px;right:-3px;font-size:8px;color:#ffd700;background:#000;border-radius:50%;padding:2px"></i>') + '</div>';
  h += '<div onclick="showProfileSettings()" title="Settings" style="width:30px;height:30px;border-radius:9px;background:rgba(0,0,0,.45);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.15);display:flex;align-items:center;justify-content:center;cursor:pointer"><i class="fas fa-cog" style="font-size:13px;color:#ccc"></i></div>';
  h += '</div>';
  h += '<input type="file" id="profBannerIn" accept="image/*" style="display:none" onchange="uploadBannerImg(this)">';
  /* Avatar (left) */
  h += '<div class="prof-ava-wrap" style="position:relative;flex-shrink:0;z-index:2;margin:0">';
  h += '<div class="prof-ava" style="width:88px;height:88px;font-size:34px;border:3.5px solid ' + rk.color + ';box-shadow:0 0 0 1px rgba(255,255,255,.06),0 0 24px ' + rk.color + 'aa,0 0 46px ' + rk.color + '44;' + ringAnim + '">' + av + '</div>';
  h += '<div class="prof-edit-btn" onclick="document.getElementById(\'profImgIn\').click()" title="' + (_premActive?'Change photo':'Premium feature — change photo') + '" style="background:' + rk.color + ';border-color:rgba(5,5,7,.8)">' + (_premActive?'<i class="fas fa-pencil-alt"></i>':'<i class="fas fa-lock" style="font-size:11px"></i>') + '</div>';
  h += '<input type="file" id="profImgIn" accept="image/*" style="display:none" onchange="uploadProfImg(this)">';
  h += '</div>';
  /* Info (right) */
  h += '<div style="flex:1;min-width:0;z-index:2;padding-right:36px">';
  h += '<div style="font-size:18px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + (window.escHtml?window.escHtml(UD.ign||UD.displayName||'Player'):(UD.ign||UD.displayName||'Player')) + premBadge + '</div>';
  h += '<div style="font-size:10px;color:#888;margin-top:2px;font-weight:600;letter-spacing:.3px">UID: ' + displayUid + '</div>';
  h += '<div style="display:flex;align-items:center;gap:6px;margin-top:7px;flex-wrap:wrap">';
  h += '<span style="font-size:12px;font-weight:800;color:#fff">Lvl ' + lv + '</span>';
  h += '<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:800;background:' + rk.bg + ';border:1px solid ' + rk.color + '55;color:' + rk.color + '">' + rk.emoji + ' ' + rk.badge + '</span>';
  if (UD.title) h += '<span class="prof-title-chip">' + UD.title + '</span>';
  h += '</div>';
  h += '<div class="xp-bar-wrap" style="margin:8px 0 0;background:transparent;border:none;padding:0"><div class="xp-bar-top" style="margin-bottom:5px"><span class="xp-level" style="font-size:10px;-webkit-text-fill-color:#999;background:none">' + rk.pts + ' pts</span><span class="xp-text" style="font-size:10px">' + xp + '/' + maxXp + ' XP</span></div>';
  h += '<div class="xp-track" style="height:7px"><div class="xp-fill" style="width:' + xpPct + '%"></div></div></div>';
  h += '</div>'; /* end info column */
  h += '</div>'; /* end prof-header card */

  var _pm = Number(st.matches||0), _pw = Number(st.wins||0), _pk = Number(st.kills||0);
  var _pwr = _pm > 0 ? Math.round((_pw/_pm)*100) : 0;
  var _pkd = _pm > 0 ? (_pk/_pm).toFixed(1) : '0.0';
  h += '<div class="prof-stats" style="grid-template-columns:1fr 1fr"><div class="ps-box psb"><div class="ps-val">' + _pm + '</div><div class="ps-lbl">Matches</div></div>';
  h += '<div class="ps-box psr"><div class="ps-val">' + _pk + '</div><div class="ps-lbl">Kills</div></div></div>';
  h += '<div style="display:flex;gap:8px;margin:0 0 10px;padding:10px 12px;background:rgba(255,255,255,.03);border-radius:12px;border:1px solid rgba(255,255,255,.07)">';
  h += '<div style="flex:1;text-align:center"><div style="font-size:16px;font-weight:900;color:#00ff9c">' + _pwr + '%</div><div style="font-size:10px;color:#666;margin-top:2px">Win Rate</div></div>';
  h += '<div style="width:1px;background:rgba(255,255,255,.08)"></div>';
  h += '<div style="flex:1;text-align:center"><div style="font-size:16px;font-weight:900;color:#ff9f1c">' + _pkd + '</div><div style="font-size:10px;color:#666;margin-top:2px">K/Match</div></div>';
  h += '<div style="width:1px;background:rgba(255,255,255,.08)"></div>';
  h += '<div style="flex:1;text-align:center"><div style="font-size:16px;font-weight:900;color:' + rk.color + '">' + rk.emoji + ' ' + rk.badge + '</div><div style="font-size:10px;color:#666;margin-top:2px">Rank</div></div>';
  h += '</div>';
  // Collectible badges — full row button + pinned chips
  var badges = getPlayerBadges(st, lv);
  /* Get achievement levels from ui-fixes.js ACHIEVEMENTS_V2 */
  var unlocked = 0;
  if (window.ACHIEVEMENTS_V2) {
    window.ACHIEVEMENTS_V2.forEach(function(a) {
      var s2 = UD.stats || {}, lv2 = 0;
      a.levels.forEach(function(l) { if (l.check(s2, UD)) lv2 = l.level; });
      if (lv2 > 0) unlocked++;
    });
  } else {
    unlocked = badges.length;
  }
  /* ── My Titles button ── */
  h += '<button class="prof-btn" onclick="window.showPlayerTitles&&showPlayerTitles()" style="background:linear-gradient(135deg,rgba(185,100,255,.12),rgba(0,212,255,.07));border:1px solid rgba(185,100,255,.3);color:#b964ff;margin-bottom:8px">';
  h += '<span style="margin-right:auto"><i class="fas fa-star" style="margin-right:8px;color:#ffd700"></i>My Titles</span>';
  h += '<span style="font-size:12px;background:rgba(185,100,255,.15);padding:2px 8px;border-radius:10px">' + (UD.title ? '1' : '0') + ' active</span></button>';
  /* ✅ Bug 28 Fix: Removed duplicate showAchievements button — keep only showAchievementsV3 below */
  /* ── Battle Pass button ── */
  h += '<button class="prof-btn" onclick="window.showBattlePass&&showBattlePass()" style="background:linear-gradient(135deg,rgba(185,100,255,.12),rgba(255,215,0,.07));border:1px solid rgba(185,100,255,.3);color:#b964ff;margin-bottom:8px">';
  h += '<span style="margin-right:auto"><i class="fas fa-ticket-alt" style="margin-right:8px;color:#b964ff"></i>Season Pass</span>';
  h += '<span style="font-size:12px;background:rgba(185,100,255,.15);padding:2px 8px;border-radius:10px">Battle Pass 🎫</span></button>';
  /* ── Clan button ── */
  h += '<button class="prof-btn" onclick="window.showClanHome&&showClanHome()" style="background:linear-gradient(135deg,rgba(255,215,0,.1),rgba(255,140,0,.06));border:1px solid rgba(255,215,0,.3);color:#ffd700;margin-bottom:8px">';
  h += '<span style="margin-right:auto"><i class="fas fa-shield-alt" style="margin-right:8px"></i>My Clan</span>';
  h += '<span style="font-size:12px;background:rgba(255,215,0,.15);padding:2px 8px;border-radius:10px">' + (UD.clanId ? '🏰 Active' : 'Join / Create') + '</span></button>';
  /* ── Stream Settings button (Premium-gated, 2026-08) ── */
  h += '<button class="prof-btn" onclick="window.showStreamSettings&&showStreamSettings()" style="background:linear-gradient(135deg,rgba(255,68,68,.1),rgba(255,100,100,.05));border:1px solid rgba(255,68,68,.25);color:#ff8888;margin-bottom:8px">';
  h += '<span style="margin-right:auto">' + (UD.isLive ? '<span style="display:inline-flex;align-items:center;gap:6px"><div style="width:7px;height:7px;border-radius:50%;background:#ff4444;animation:livePulse 1s ease-in-out infinite"></div></span>' : '<i class="fas fa-video" style="margin-right:8px"></i>') + 'Live Stream</span>';
  h += '<span style="font-size:12px;background:rgba(255,68,68,.12);padding:2px 8px;border-radius:10px">' + (UD.isLive ? '🔴 LIVE' : (_premActiveGold ? 'Setup' : '👑 Gold+')) + '</span></button>';
  /* Daily Missions button moved (2026-08) to the Wallet tab — see
     index.html's "Ads Dekho — Bonus Pao" button, which now opens
     Missions instead, right where this used to be on Profile. */
  /* ── Cosmetics Store button ── */
  h += '<button class="prof-btn" onclick="window.showCosmeticsStore&&showCosmeticsStore()" style="background:linear-gradient(135deg,rgba(0,212,255,.08),rgba(0,100,255,.05));border:1px solid rgba(0,212,255,.2);color:#00d4ff;margin-bottom:8px">';
  h += '<span style="margin-right:auto"><i class="fas fa-store" style="margin-right:8px;color:#00d4ff"></i>Cosmetics Store</span>';
  h += '<span style="font-size:12px;background:rgba(0,212,255,.1);padding:2px 8px;border-radius:10px">💎 Unlock</span></button>';
  /* ── City Leaderboard button (moved here from home screen, 2026-07) ── */
  h += '<button class="prof-btn" onclick="window.showCityLeaderboard&&showCityLeaderboard()" style="background:linear-gradient(135deg,rgba(255,165,0,.08),rgba(255,140,0,.05));border:1px solid rgba(255,165,0,.2);color:#ff9f1c;margin-bottom:8px">';
  h += '<span style="margin-right:auto"><i class="fas fa-city" style="margin-right:8px;color:#ff9f1c"></i>City Leaderboard</span>';
  h += '<span style="font-size:12px;background:rgba(255,165,0,.1);padding:2px 8px;border-radius:10px">' + (UD&&UD.city ? UD.city : 'Set city') + '</span></button>';
  /* ── Refer & Earn button ── */
  h += '<button class="prof-btn" onclick="window.showReferEarn&&showReferEarn()" style="background:linear-gradient(135deg,rgba(255,215,0,.08),rgba(255,140,0,.05));border:1px solid rgba(255,215,0,.2);color:#ffd700;margin-bottom:8px">';
  h += '<span style="margin-right:auto"><i class="fas fa-user-friends" style="margin-right:8px;color:#ffd700"></i>Refer & Earn</span>';
  var _refCount = Number((UD&&UD.referralCount)||0);
  h += '<span style="font-size:12px;background:rgba(255,215,0,.1);padding:2px 8px;border-radius:10px">' + _refCount + ' friends</span></button>';
  /* ── Creator Dashboard button ── */
  h += '<button class="prof-btn" onclick="window.showCreatorDashboard&&showCreatorDashboard()" style="background:linear-gradient(135deg,rgba(0,100,255,.08),rgba(0,212,255,.05));border:1px solid rgba(0,212,255,.2);color:#00d4ff;margin-bottom:8px">';
  h += '<span style="margin-right:auto"><i class="fas fa-broadcast-tower" style="margin-right:8px;color:#00d4ff"></i>Creator Program</span>';
  var _hasCreator = (UD&&UD.creatorProfile&&UD.creatorProfile.code);
  h += '<span style="font-size:12px;background:rgba(0,212,255,.1);padding:2px 8px;border-radius:10px;color:#00d4ff">' + (_hasCreator?'🔵 Active':'Join →') + '</span></button>';
  /* ── Achievements button (V3 — merged, Bug 28 fix) ── */
  h += '<button class="prof-btn" onclick="window.showAchievementsV3?showAchievementsV3():window.showAchievements&&showAchievements()" style="background:linear-gradient(135deg,rgba(255,215,0,.1),rgba(255,140,0,.06));border:1px solid rgba(255,215,0,.2);color:#ffd700;margin-bottom:8px">';
  h += '<span style="margin-right:auto"><i class="fas fa-medal" style="margin-right:8px;color:#ffd700"></i>Achievements</span>';
  var _achV3 = Object.keys((UD&&UD.achievementsV3)||{}).length;
  var _achV1 = Number(unlocked) || 0;
  var _achTotal = Math.max(_achV3, _achV1); /* show higher count */
  h += '<span style="font-size:12px;background:rgba(255,215,0,.15);padding:2px 8px;border-radius:10px">' + _achTotal + ' earned</span></button>';
  /* ── Career Stats Card ── */
  if (window.renderPlayerStatsCard) h += renderPlayerStatsCard();

  /* ── Season Info button ── */
  var _s = window.getCurrentSeason ? window.getCurrentSeason() : null;
  if (_s && _s.active) {
    h += '<button class="prof-btn" onclick="if(window.showSeasonInfo)showSeasonInfo()" style="background:linear-gradient(135deg,rgba(255,215,0,.08),rgba(255,140,0,.05));border:1px solid rgba(255,215,0,.2);color:#ffd700;margin-bottom:8px">';
    h += '<span style="margin-right:auto"><i class="fas fa-trophy" style="margin-right:8px;color:#ffd700"></i>' + _s.name + '</span>';
    h += '<span style="font-size:12px;background:rgba(255,215,0,.1);padding:2px 8px;border-radius:10px">' + _s.daysLeft + ' din</span></button>';
  }

  /* ── Match History button ── */
  h += '<button class="prof-btn" onclick="if(window.showMatchHistory)showMatchHistory()" style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);margin-bottom:8px">';
  h += '<span style="margin-right:auto"><i class="fas fa-history" style="margin-right:8px;color:#00d4ff"></i>Match History</span>';
  var _mCount = (UD&&UD.stats&&UD.stats.matches)||0;
  h += '<span style="font-size:12px;background:rgba(0,212,255,.08);padding:2px 8px;border-radius:10px;color:#00d4ff">' + _mCount + ' matches</span></button>';
  /* Bug 37 Fix: Wire up showPerformanceTracker */
  h += '<button onclick="window.showPerformanceTracker&&showPerformanceTracker()" class="prof-btn" style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);margin-bottom:8px"><span style="margin-right:auto"><i class="fas fa-chart-line" style="margin-right:8px;color:#ff9f1c"></i>Performance Stats</span><span style="font-size:11px;opacity:.6">→</span></button>';

  /* ── Season History button ── */
  h += '<button class="prof-btn" onclick="if(window.showSeasonHistory)showSeasonHistory()" style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);margin-bottom:8px">';
  h += '<span style="margin-right:auto"><i class="fas fa-calendar-alt" style="margin-right:8px;color:#b964ff"></i>Season History</span>';
  h += '<span style="font-size:12px;color:#888">Past Seasons</span></button>';

  /* ── Watch History button ── */
  h += '<button class="prof-btn" onclick="if(window.showLiveSpectateList)showLiveSpectateList()" style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);margin-bottom:8px">';
  h += '<span style="margin-right:auto"><i class="fas fa-eye" style="margin-right:8px;color:#ff4444"></i>Watch Live & Earn</span>';
  h += '<span style="font-size:12px;color:#ff4444;font-weight:700">+' + ((window.CFG&&window.CFG.watchCoinsPerInterval)||2) + '🪙/min</span></button>';

  /* ── Premium Card ── */
  if (window.renderPremiumCard) h += renderPremiumCard();
  /* ── Badges Grid — beautiful animated cards ── */
  if (badges.length > 0) {
    h += '<div style="margin-bottom:14px">';
    h += '<div style="font-size:12px;font-weight:800;color:#555;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">🏅 Badges Earned</div>';
    h += '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px">';
    badges.forEach(function(b) {
      var animCss = '';
      if (b.anim === 'badge-pulse') animCss = 'animation:badgePulse 2s ease-in-out infinite';
      if (b.anim === 'badge-glow')  animCss = 'animation:badgeGlow 2s ease-in-out infinite';
      if (b.anim === 'badge-fire')  animCss = 'animation:badgeFire 1.5s ease-in-out infinite';
      h += '<div style="position:relative;padding:10px 12px;border-radius:14px;background:' + b.bg + ';border:1.5px solid ' + b.color + '55;box-shadow:' + b.glow + ';display:flex;align-items:center;gap:10px;overflow:hidden;' + animCss + '">';
      h += '<div style="font-size:26px;flex-shrink:0;filter:drop-shadow(0 0 6px ' + b.color + '88)">' + b.icon + '</div>';
      h += '<div><div style="font-size:12px;font-weight:800;color:' + b.color + '">' + b.name + '</div>';
      h += '<div style="font-size:10px;color:#666;margin-top:1px">' + b.desc + '</div></div>';
      h += '<div style="position:absolute;bottom:-8px;right:-8px;width:36px;height:36px;border-radius:50%;background:' + b.color + '15;filter:blur(8px)"></div>';
      h += '</div>';
    });
    h += '</div></div>';
  }

  /* Game Info section + Request Profile Update button removed (2026-07) —
     both duplicated what "Edit Profile" (opened via the gear icon, which
     calls the same showProfileUpdate()) already does. */
  /* Show pending status with submitted details */
  if (UD.profileRequired === true || UD.profileStatus === 'pending') {
    h += '<div class="pending-box" style="flex-direction:column;align-items:flex-start">';
    h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><i class="fas fa-clock"></i> Profile update pending admin approval...</div>';
    /* Show what user submitted */
    var pendingIgn = UD.pendingIgn || UD.ign || '-';
    var pendingUid = UD.pendingUid || UD.ffUid || '-';
    h += '<div style="width:100%;padding:10px;background:rgba(0,0,0,.2);border-radius:8px;margin-top:4px">';
    h += '<div style="font-size:11px;color:var(--txt2);margin-bottom:4px">You submitted:</div>';
    h += '<div style="font-size:13px;font-weight:700;color:var(--txt)">IGN: ' + pendingIgn + '</div>';
    h += '<div style="font-size:13px;font-weight:700;color:var(--txt);margin-top:2px">UID: ' + pendingUid + '</div>';
    h += '</div>';
    h += '<div style="font-size:10px;color:var(--txt2);margin-top:6px">Admin will verify and approve these details</div>';
    h += '</div>';
  }
  // Stats Chart + Profile Completion
  if (window.renderStatsChart) h += window.renderStatsChart();
  if (window.renderProfileCompletion) h += window.renderProfileCompletion();
  /* Performance Dashboard button */
  h += '<button class="prof-btn" onclick="window.showPerformanceDashboard&&showPerformanceDashboard()" style="background:linear-gradient(135deg,rgba(0,212,255,.1),rgba(0,255,156,.06));border:1px solid rgba(0,212,255,.2);color:#00d4ff;margin-bottom:8px">';
  h += '<span style="margin-right:auto"><i class="fas fa-chart-line" style="margin-right:8px"></i>Performance Dashboard</span>';
  h += '<span style="font-size:11px;opacity:.6">→</span></button>';
  if (window.renderNextMatchCountdown) h += window.renderNextMatchCountdown();

  // Bio — show if set
  if (UD.bio) h += '<div style="padding:10px 14px;background:rgba(0,255,156,.06);border:1px solid rgba(0,255,156,.15);border-radius:12px;font-size:13px;font-style:italic;color:var(--green);margin-bottom:14px">"' + (window.escHtml?window.escHtml(UD.bio):UD.bio) + '"</div>';

  // Settings hint card removed (2026-07) — the gear icon at the top of this
  // page already opens showProfileSettings(), so this was a duplicate
  // entry point to the exact same modal.
  // 💡 Suggestion button
  h += '<div onclick="window.showMySuggestions&&showMySuggestions()" style="display:flex;align-items:center;gap:14px;padding:14px 18px;border-radius:16px;background:rgba(255,215,0,.04);border:1px solid rgba(255,215,0,.12);cursor:pointer;margin-bottom:6px;-webkit-tap-highlight-color:transparent">';
  h += '<div style="width:40px;height:40px;border-radius:12px;background:rgba(255,215,0,.1);border:1px solid rgba(255,215,0,.2);display:flex;align-items:center;justify-content:center;flex-shrink:0"><i class="fas fa-lightbulb" style="color:#ffd700;font-size:18px"></i></div>';
  h += '<div style="flex:1"><div style="font-size:14px;font-weight:700;color:var(--txt)">💡 Suggest a Feature</div><div style="font-size:12px;color:var(--txt2);margin-top:2px">App mein koi kami hai? Batao — reward milega!</div></div>';
  h += '<i class="fas fa-chevron-right" style="color:var(--txt2);font-size:13px"></i></div>';
  // Legal & Compliance footer moved (2026-08) to the Settings modal
  // (⚙ icon → showProfileSettings), just above Logout — see
  // js/legal-compliance.js's mesLegalFooter for the actual content,
  // now opened via window.mesShowLegalModal() instead of being
  // rendered inline on this page every time.
  pc.innerHTML = h;
}

function uploadProfImg(inp) {
  if (!inp.files || !inp.files[0]) return;
  /* GATED (2026-08): profile photo change is now a premium perk.
     Free users get a clear message instead of a silent no-op. */
  if (!window.isPremiumActive || !isPremiumActive()) {
    toast('👑 Profile photo change sirf Premium members ke liye hai', 'err');
    inp.value = '';
    if (window.showPremiumUpgrade) showPremiumUpgrade();
    return;
  }
  /* uploadProfileImage is defined in imgbb.js — always use it */
  if (window.uploadProfileImage) {
    uploadProfileImage(inp.files[0], function(url) {
      if (url) { toast('Photo updated! ✅', 'ok'); setTimeout(renderProfile, 300); }
      /* NOTE: uploadProfileImage's own error path already calls
         toast() on failure (see core/imgbb.js) — if neither the
         success nor the error branch is visibly firing, check the
         browser console for a thrown exception before this callback
         (e.g. compImg() failing silently on an unreadable file). */
    });
    return;
  }
  compImg(inp.files[0], 400, 0.8, 150, function(b64) {
    uploadToImgBB(b64, 'profile_' + U.uid, function(err, url) {
      if (!err && url) { if (window.DB) DB.users.update({ avatar_url: url }); toast('Photo updated! ✅', 'ok'); setTimeout(renderProfile, 300); }
      else { toast('Upload failed: ' + (err||'unknown'), 'err'); }
    });
  });
}
function uploadBannerImg(inp) {
  if (!inp.files || !inp.files[0]) return;
  /* GATED (2026-08): banner change is also a premium perk. */
  if (!window.isPremiumActive || !isPremiumActive()) {
    toast('👑 Banner change sirf Premium members ke liye hai', 'err');
    inp.value = '';
    if (window.showPremiumUpgrade) showPremiumUpgrade();
    return;
  }
  if (window.uploadBannerImage) { uploadBannerImage(inp.files[0], function(url) { if (url) { toast('Banner updated! ✅', 'ok'); setTimeout(renderProfile, 300); } }); return; }
  compImg(inp.files[0], 800, 0.75, 250, function(b64) {
    uploadToImgBB(b64, 'banner_' + U.uid, function(err, url) {
      if (!err && url) { if (window.DB) DB.users.update({ banner_url: url }); toast('Banner updated! ✅', 'ok'); setTimeout(renderProfile, 300); }
      else { toast('Upload failed: ' + (err||'unknown'), 'err'); }
    });
  });
}
function applyReferralCode() {
  var inp = document.getElementById('applyRefInput');
  var code = inp ? inp.value.trim().toUpperCase() : '';
  if (!code || code.length < 4) { toast('Valid code enter karo', 'err'); return; }
  var myCode = UD.referralCode || U.uid.substring(0, 8).toUpperCase();
  if (code === myCode) { toast('Apna code nahi laga sakte!', 'err'); return; }
  // Get admin-configured referral reward amount
  var rewardCoins = (window.CFG && window.CFG.referralJoinCoins) || 50;
  if (!window._supa || !window._supaReady) { toast('Service unavailable', 'err'); return; }
  window._supa.from('user_public_profiles').select('id').eq('referral_code', code.toUpperCase()).maybeSingle() /* BUG #38 FIX */
    .then(function(rr) {
      var referrerUid = rr.data ? rr.data.id : null;
      if (!referrerUid) { toast('Yeh code nahi mila', 'err'); return; }
      if (referrerUid === U.uid) { toast('Apna code use nahi kar sakte', 'err'); return; }
      window._supa.from('referrals').upsert({ referrer_id: referrerUid, referred_id: U.uid, join_bonus_paid: true }, { onConflict: 'referred_id' })
        .then(function() {
          window._supa.rpc('increment_balance', { p_uid: referrerUid, p_col: 'coins', p_amount: rewardCoins }).then(null, function(){});
          window._supa.from('notifications').insert({ user_id: referrerUid, type: 'referral', title: '🎁 Referral Reward!', body: (UD.ign||'Koi')+' join hua! +'+rewardCoins+' coins!' }).then(null, function(){});
          window._supa.rpc('increment_balance', { p_uid: U.uid, p_col: 'coins', p_amount: rewardCoins }).then(null, function(){});
          window._supa.from('users').update({ referred_by: referrerUid }).eq('id', U.uid).then(null, function(){});
          if (UD) { UD.coins = (UD.coins||0)+rewardCoins; if (window.updateHdr) updateHdr(); }
          toast('✅ Referral applied! +' + rewardCoins + ' coins!', 'ok');
          closeModal();
        }).catch(function() { toast('Code already used hai', 'err'); });
    }).catch(function() { toast('Code nahi mila', 'err'); });
}
function shareRef(code) {
  var url = window.location.href;
  var msg = '🎮 Join Mini eSports — India\'s Best Free Fire Tournament App! 🔥\n\n💰 Win Real Cash Prizes!\n🪙 Get FREE bonus coins on signup!\n\n👉 Use my referral code: ' + code + '\n📲 Download now:';
  /* BUG FIX (2026-07): native whatsapp:// scheme instead of the wa.me web
     link — opens the WhatsApp app directly with no browser page/prompt
     in between. navigator.share (native OS share sheet) is tried first
     since that's an even better UX where supported; this is the fallback. */
  if (navigator.share) {
    navigator.share({ title: 'Mini eSports - Refer & Earn', text: msg, url: url }).catch(function() {
      window.open('whatsapp://send?text=' + encodeURIComponent(msg + '\n' + url), '_self');
    });
  } else {
    window.open('whatsapp://send?text=' + encodeURIComponent(msg + '\n' + url), '_self');
  }
}
function addTM(mode) {
  if (isVO()) { toast('Complete profile first', 'err'); return; }
  var h = '<div style="font-size:14px;font-weight:700;margin-bottom:12px"><i class="fas fa-user-plus"></i> Add ' + (mode === 'duo' ? 'Duo Partner' : 'Squad Member') + '</div>';
  h += '<div class="f-group"><label>Teammate FF UID</label>' +
    '<input type="text" class="f-input" id="tmUid" placeholder="Enter FF UID" oninput="tmLookup(\'uid\')">' +
    '<div id="tmUidStatus" style="font-size:11px;margin-top:4px;min-height:16px"></div></div>';
  h += '<div style="text-align:center;font-size:11px;color:var(--txt2);margin:4px 0">— ya —</div>';
  h += '<div class="f-group"><label>Teammate IGN</label>' +
    '<input type="text" class="f-input" id="tmIgn" placeholder="Enter IGN" oninput="tmLookup(\'ign\')">' +
    '<div id="tmIgnStatus" style="font-size:11px;margin-top:4px;min-height:16px"></div></div>';
  h += '<div id="tmFoundCard" style="display:none;background:rgba(0,255,156,.06);border:1px solid rgba(0,255,156,.2);border-radius:10px;padding:10px;margin:8px 0;font-size:13px"></div>';
  h += '<button class="f-btn fb-green" onclick="saveTM(\'' + mode + '\')">Add Teammate</button>';
  openModal('Add Teammate', h);
}

/* Teammate auto-lookup — FF UID se IGN auto-fill, ya IGN se UID auto-fill */
var _tmLookupTimer = null;
function tmLookup(field) {
  clearTimeout(_tmLookupTimer);
  _tmLookupTimer = setTimeout(function() {
    var uidEl = $('tmUid'), ignEl = $('tmIgn');
    var uidStatus = $('tmUidStatus'), ignStatus = $('tmIgnStatus');
    var foundCard = $('tmFoundCard');
    if (!uidEl || !ignEl) return;

    var val = field === 'uid' ? uidEl.value.trim() : ignEl.value.trim();
    if (!val || val.length < 3) return;

    if (uidStatus) uidStatus.innerHTML = field === 'uid' ? '<span style="color:var(--txt2)">Searching...</span>' : '';
    if (ignStatus) ignStatus.innerHTML = field === 'ign' ? '<span style="color:var(--txt2)">Searching...</span>' : '';

    var _teamSearchFn = field === 'uid' ? _findUserByFF : _findUserByIGN;
    _teamSearchFn(val, function(fKey, fData) {
      if (!fKey || !fData) {
        if (field === 'uid' && uidStatus) uidStatus.innerHTML = '<span style="color:var(--red)">❌ UID not found</span>';
        if (field === 'ign' && ignStatus) ignStatus.innerHTML = '<span style="color:var(--red)">❌ IGN not found</span>';
        if (foundCard) foundCard.style.display = 'none';
        return;
      }
      var pData = null, pKey = null;
      s.forEach(function(c) { if (!pData) { pData = c.val(); pKey = c.key; } });
      if (!pData) return;

      // Check verification
      if (pData.profileStatus !== 'approved' && !pData.profileVerified) {
        var statusEl = field === 'uid' ? uidStatus : ignStatus;
        if (statusEl) statusEl.innerHTML = '<span style="color:var(--orange)">⚠️ User not verified — cannot add</span>';
        if (foundCard) foundCard.style.display = 'none';
        return;
      }

      // Auto-fill the other field
      if (field === 'uid' && ignEl) {
        ignEl.value = pData.ign || pData.displayName || '';
        if (uidStatus) uidStatus.innerHTML = '<span style="color:var(--green)">✅ Found!</span>';
        if (ignStatus) ignStatus.innerHTML = '';
      } else if (field === 'ign' && uidEl) {
        uidEl.value = pData.ffUid || '';
        if (ignStatus) ignStatus.innerHTML = '<span style="color:var(--green)">✅ Found!</span>';
        if (uidStatus) uidStatus.innerHTML = '';
      }

      // Show found card
      if (foundCard) {
        var av = pData.profileImage ? '<img src="' + pData.profileImage + '" style="width:32px;height:32px;border-radius:50%;object-fit:cover">' : '<div style="width:32px;height:32px;border-radius:50%;background:var(--card2);display:flex;align-items:center;justify-content:center;font-weight:700">' + (pData.ign||'?').charAt(0) + '</div>';
        foundCard.style.display = 'flex';
        foundCard.style.alignItems = 'center';
        foundCard.style.gap = '10px';
        foundCard.innerHTML = av + '<div><div style="font-weight:700">' + (window.escHtml ? window.escHtml(pData.ign||'Unknown') : (pData.ign||'Unknown')) + '</div><div style="font-size:11px;color:var(--txt2)">UID: ' + (pData.ffUid||'—') + '</div></div><span style="margin-left:auto;font-size:11px;padding:2px 8px;border-radius:8px;background:rgba(0,255,156,.1);color:var(--green)">✅ Verified</span>';
      }
    });
  }, 500); // 500ms debounce
}

function saveTM(mode) {
  var uid = ($('tmUid') || {}).value, ign = ($('tmIgn') || {}).value;
  uid = (uid||'').trim(); ign = (ign||'').trim();
  if (!uid && !ign) { toast('FF UID ya IGN mein se koi ek daalo', 'err'); return; }
  if (!uid || uid.length < 5) { toast('Valid FF UID chahiye (min 5 digits)', 'err'); return; }
  if (!ign) ign = uid; // fallback if IGN not filled
  uid = uid.trim(); ign = ign.trim();
  // Self-check
  if (uid === (UD.ffUid || '')) { toast('Cannot add yourself!', 'err'); return; }
  _findUserByFF(uid, function(partnerKey, partnerData) {
    if (!partnerKey || !partnerData) { toast('UID "' + uid + '" not found!', 'err'); return; }
    var myUid = UD.ffUid || '';
    var myName = UD.ign || UD.displayName || 'Player';
    var partnerName = partnerData.ign || partnerData.displayName || ign;
    if (mode === 'duo') {
      // TWO-WAY SYNC: Save in BOTH users' profiles (duoTeam + partnerUid)
      var myTeamData = { memberUid: uid, memberName: partnerName };
      var partnerTeamData = { memberUid: myUid, memberName: myName };
      // Save duoTeam object
      db.ref('users/' + U.uid + '/duoTeam').set(myTeamData);
      db.ref('users/' + partnerKey + '/duoTeam').set(partnerTeamData);
      // ALSO save partnerUid for quick lookup
      db.ref('users/' + U.uid + '/partnerUid').set(uid);
      db.ref('users/' + partnerKey + '/partnerUid').set(myUid);
      console.log('[Mini eSports] ✅ Duo sync (2-way): ' + myName + ' ↔ ' + partnerName);
      console.log('[Mini eSports]   users/' + U.uid + '/partnerUid = ' + uid);
      console.log('[Mini eSports]   users/' + partnerKey + '/partnerUid = ' + myUid);
    } else {
      // Check squad not full
      var myMembers = (UD.squadTeam && UD.squadTeam.members) || [];
      if (myMembers.length >= 3) { toast('Squad full! (Max 3 teammates)', 'err'); return; }
      // Check not already in squad
      var alreadyInMySquad = false;
      myMembers.forEach(function(m) { if (m.uid === uid) alreadyInMySquad = true; });
      if (alreadyInMySquad) { toast('Already in your squad!', 'inf'); return; }
      // TWO-WAY SYNC: Add to BOTH users' squads
      myMembers.push({ uid: uid, name: partnerName });
      db.ref('users/' + U.uid + '/squadTeam/members').set(myMembers);
      // Also save squad UIDs array for quick lookup
      db.ref('users/' + U.uid + '/squadUids').set(myMembers.map(function(m) { return m.uid; }));
      var partnerMembers = (partnerData.squadTeam && partnerData.squadTeam.members) || [];
      var alreadyInPartnerSquad = false;
      partnerMembers.forEach(function(m) { if (m.uid === myUid) alreadyInPartnerSquad = true; });
      if (!alreadyInPartnerSquad) {
        partnerMembers.push({ uid: myUid, name: myName });
        db.ref('users/' + partnerKey + '/squadTeam/members').set(partnerMembers);
        db.ref('users/' + partnerKey + '/squadUids').set(partnerMembers.map(function(m) { return m.uid; }));
      }
      console.log('[Mini eSports] ✅ Squad sync (2-way): ' + myName + ' ↔ ' + partnerName);
    }
    closeModal(); toast('✅ ' + partnerName + ' added as teammate! (Synced both profiles)', 'ok');
  });
}
function removeTM(mode, idx) {
  if (mode === 'duo') {
    var old = UD.duoTeam;
    // Remove from MY profile (both duoTeam + partnerUid)
    db.ref('users/' + U.uid + '/duoTeam').remove();
    db.ref('users/' + U.uid + '/partnerUid').remove();
    // TWO-WAY: Remove from PARTNER's profile too
    if (old && old.memberUid) {
      _findUserByFF(old.memberUid, function(oldPartnerKey) {
        if (oldPartnerKey && oldPartnerKey !== U.uid) {
          db.ref('users/' + oldPartnerKey + '/duoTeam').remove();
          db.ref('users/' + oldPartnerKey + '/partnerUid').remove();
        }
      });
    }
    toast('Duo partner removed (both profiles updated)', 'ok');
  } else {
    var members = (UD.squadTeam && UD.squadTeam.members) || [];
    if (idx < 0 || idx >= members.length) return;
    var removed = members[idx];
    // Remove from MY squad
    members.splice(idx, 1);
    db.ref('users/' + U.uid + '/squadTeam/members').set(members.length > 0 ? members : null);
    db.ref('users/' + U.uid + '/squadUids').set(members.length > 0 ? members.map(function(m) { return m.uid; }) : null);
    // TWO-WAY: Remove ME from PARTNER's squad
    if (removed && removed.uid) {
      _findUserByFF(removed.uid, function(removedKey) {
        if (removedKey && removedKey !== U.uid) {
          db.ref('users/' + removedKey + '/squadTeam/members').set(null);
          db.ref('users/' + removedKey + '/squadUids').set(null);
        }
      });
    }
    toast('Squad member removed (both profiles updated)', 'ok');
  }
}
function showProfileUpdate() {
  if (window.showProfileUpdate_v2) { window.showProfileUpdate_v2(); return; }
  var h = '<div class="f-group"><label>In-Game Name (IGN)</label><input type="text" class="f-input" id="puIgn" placeholder="Your Free Fire IGN" value="' + (UD.ign || '') + '"></div>';
  /* FF UID lock after verified */
  var ffSet = UD.ffUid && UD.ffUid.trim().length >= 5;
  var isVerified = UD.profileStatus === "approved" || UD.profileVerified;
  if (ffSet && isVerified) {
    h += '<div class="f-group"><label>Free Fire UID <span style="color:#ffd700;font-size:10px">🔒 Locked</span></label><input type="text" class="f-input" id="puUid" value="' + (UD.ffUid||'') + '" readonly style="opacity:.6;cursor:not-allowed"></div>';
    h += '<div style="background:rgba(255,215,0,.06);border:1px solid rgba(255,215,0,.15);border-radius:8px;padding:8px 12px;font-size:11px;color:#ffaa00;margin-bottom:10px"><i class="fas fa-lock"></i> FF UID locked after first verification. Contact admin to change.</div>';
  } else {
    h += '<div style="background:rgba(0,255,156,.05);border:1px solid rgba(0,255,156,.12);border-radius:8px;padding:8px 12px;font-size:11px;color:#00ff9c;margin-bottom:6px"><i class="fas fa-info-circle"></i> FF UID set karne ke baad change nahi hogi — sahi UID daalna!</div>';
    h += '<div class="f-group"><label>Free Fire UID (5-15 digits)</label><input type="text" class="f-input" id="puUid" placeholder="Your FF UID" value="' + (UD.ffUid || '') + '"></div>';
  }
  h += '<div class="f-group"><label>WhatsApp Number <span style="font-size:10px;color:var(--txt2)">(prizes ke liye)</span></label><input type="tel" class="f-input" id="puPhone" placeholder="10-digit number" maxlength="10" value="' + (UD.phone || '') + '"></div>';
  h += '<div class="f-group"><label>Bio <span style="font-size:10px;color:var(--txt2)">(optional)</span></label><input type="text" class="f-input" id="puBio" placeholder="About you..." maxlength="80" value="' + (window.escHtml?window.escHtml(UD.bio||''):(UD.bio||'').replace(/"/g,'&quot;')) + '"></div>';
  h += '<div class="f-warn"><i class="fas fa-exclamation-triangle"></i> Only real Free Fire IGN and UID allowed. Fake info = disqualified.</div>';
  h += '<button class="f-btn fb-orange" style="margin-top:14px" onclick="doProfileUpdate()">Submit for Verification</button>';
  openModal('Profile Update', h);
}
var _profileUpdateSubmitting = false;
function doProfileUpdate() {
  if (_profileUpdateSubmitting) return;
  var ign = ($('puIgn') || {}).value, uid = ($('puUid') || {}).value;
  if (!ign || !ign.trim()) { toast('Enter IGN', 'err'); return; }
  /* Improvement 1: Proper FF UID validation — Free Fire UIDs are 8-12 digit numbers only */
  var _cleanUid = (uid || '').trim();
  if (!_cleanUid || !/^\d{8,12}$/.test(_cleanUid)) {
    toast('⚠️ FF UID sirf 8-12 digit numbers hone chahiye (e.g. 123456789)', 'err'); return;
  }
  ign = ign.trim(); uid = _cleanUid;

  /* ✅ Bug 9 Fix: Server-side FF UID lock check BEFORE submitting
     Even if UI lock is bypassed, this verifies via Supabase that ff_uid isn't already set */
  var existingFFUid = (UD && UD.ffUid && UD.ffUid.trim()) || '';
  var isVerifiedAlready = UD && (UD.profileStatus === 'approved' || UD.profileVerified);
  if (existingFFUid && isVerifiedAlready && uid !== existingFFUid) {
    /* FF UID already verified — block change client-side */
    toast('🔒 FF UID already verified — change nahi ho sakta. Admin se contact karo.', 'err');
    return;
  }
  /* Supabase server-side check: if ff_uid already set and verified, block */
  if (window._supa && existingFFUid && isVerifiedAlready) {
    window._supa.from('users').select('ff_uid, profile_status').eq('id', U.uid).single()
      .then(function(r) {
        var serverFFUid = r.data && r.data.ff_uid;
        var serverStatus = r.data && r.data.profile_status;
        if (serverFFUid && serverStatus === 'approved' && uid !== serverFFUid) {
          toast('🔒 Server: FF UID locked — change not allowed. Contact admin.', 'err');
          return;
        }
        _proceedWithProfileUpdate(ign, uid);
      })
      .catch(function() {
        /* If Supabase check fails, proceed (fail-open for UX) */
        _proceedWithProfileUpdate(ign, uid);
      });
    return;
  }
  _proceedWithProfileUpdate(ign, uid);
}

function _proceedWithProfileUpdate(ign, uid) {
  _profileUpdateSubmitting = true;
  var btn = document.querySelector('.fb-orange');
  if (btn) { btn.disabled = true; btn.textContent = 'Submitting...'; }
  _findUserByIGN(ign, function(dupIgnKey) {
    if (dupIgnKey && dupIgnKey !== U.uid) { toast('IGN already taken!', 'err'); _profileUpdateSubmitting = false; if (btn) { btn.disabled = false; btn.textContent = 'Submit for Verification'; } return; }
    _findUserByFF(uid, function(dupFFKey) {
      if (dupFFKey && dupFFKey !== U.uid) { toast('⚠️ Yeh FF UID pehle se registered hai!', 'err'); _profileUpdateSubmitting = false; if (btn) { btn.disabled = false; btn.textContent = 'Submit for Verification'; } return; }
      var phone = (($('puPhone') || {}).value || '').replace(/[^0-9]/g, '').trim();
      if (phone && phone.length >= 10) {
        _findUserByPhone(phone, function(dupPhKey) {
          if (dupPhKey && dupPhKey !== U.uid) { toast('⚠️ Yeh phone number pehle se registered hai!', 'err'); _profileUpdateSubmitting = false; if (btn) { btn.disabled = false; btn.textContent = 'Submit for Verification'; } return; }
          _doSubmitProfileRequest(ign, uid, phone, btn);
        });
      } else {
        _doSubmitProfileRequest(ign, uid, phone, btn);
      }
    });
  });
}
/* ✅ BUG FIX (2026-08): an already-verified user editing their profile
   (IGN/UID/phone) was landing in Admin Panel's "New Verifications" queue
   instead of "Profile Updates". Root cause: this function always wrote
   to the `profile_requests` table no matter what, even though it already
   computed reqType ('verification' vs 'update') correctly — that value
   was only ever saved as a label inside the row, never used to pick the
   table. Admin Panel reads "New Verifications" from `profile_requests`
   and "Profile Updates" from a completely separate `profile_updates`
   table, so an already-approved user's edit never reached the right
   queue at all. Fix: route to profile_updates for already-verified
   users, profile_requests for brand-new verification. */
async function _doSubmitProfileRequest(ign, uid, phone, btn) {
    var isVerified = (UD.profileStatus === 'approved');
    var reqType = isVerified ? 'update' : 'verification';

    if (isVerified) {
      return _submitProfileUpdateForVerifiedUser(ign, uid, phone, btn);
    }

    /* phone already passed as param */
    var requestData = {
      /* User identity */
      uid: U.uid,
      name: UD.displayName || '',
      userName: UD.ign || UD.displayName || '',
      displayName: UD.displayName || '',
      userEmail: UD.email || '',
      
      /* Requested new values (EXPLICIT fields for Admin) */
      requestedIgn: ign,
      requestedUid: uid,
      
      /* Also save as ign/ffuid for backward compatibility */
      ign: ign,
      ffUid: uid,
      
      /* Phone number */
      phone: phone,
      
      /* Old values for comparison */
      oldIgn: UD.ign || '',
      oldUid: UD.ffUid || '',
      
      /* Request metadata */
      type: reqType,
      status: 'pending',
      createdAt: Date.now()
    };
    
    /* ✅ Supabase profile_requests table (not Firebase profileRequests/profileUpdates) */
    var _isBanned = UD.isBanned || UD.blocked;
    var bio = (($('puBio') || {}).value || '').trim().substring(0, 80);
    if (!window._supa || !window._supaReady) {
      toast('Service unavailable — retry karo', 'err');
      _profileUpdateSubmitting = false;
      if (btn) { btn.disabled = false; btn.textContent = 'Submit for Verification'; }
      return;
    }

    /* ✅ BUG FIX (2026-07): "insert or update on table profile_requests
       violates foreign key constraint profile_requests_user_id_fkey".
       Root cause: for a BRAND NEW user, the Supabase `users` row is
       created in the BACKGROUND (core/boot.js _doSupaLoad → DB.users.
       create()) while the UI is already interactive (_earlyBoot shows
       the app immediately). If the user opens Profile and hits "Submit
       for Verification" fast enough, that background insert may not
       have committed yet — so profile_requests.user_id points at a
       users.id that doesn't exist yet, and the FK constraint rejects it.
       Fix: self-heal by ensuring the users row exists (idempotent —
       DB.users.create() upserts with ignoreDuplicates, so this is a
       harmless no-op 99% of the time when the row already exists, and
       only actually creates it in that rare race-condition window). */
    if (window.DB && window.DB.users && window.DB.users.create) {
      try {
        await window.DB.users.create(U.uid, {
          ign:   (window.UD && window.UD.ign) || U.displayName || U.email || 'Player',
          email: U.email || ''
        });
      } catch (e) { /* best-effort — the upsert below will surface any real problem */ }
    }

    window._supa.from('profile_requests').upsert({
      user_id:       U.uid,
      requested_ign: ign,
      requested_uid: uid,
      phone:         phone || null,
      bio:           bio   || null,
      request_type:  reqType,
      is_banned:     _isBanned || false,
      request_count: (UD.profileRequestCount || 0) + 1,
      status:        'pending'
    }, { onConflict: 'user_id' }).then(function(result) {
      /* ✅ Audit Fix: supabase-js resolves normally (does not reject) on a
         database/RLS error — it comes back as {data:null, error:{...}}.
         Without this check, a real failure here either fell through to a
         confusing state or could have shown a false success toast. */
      if (result && result.error) {
        console.error('[doProfileUpdate] Supabase upsert error:', result.error.message || result.error, '| code:', result.error.code, '| details:', result.error.details);
        toast('Submit failed: ' + (result.error.message || 'unknown error') + ' — retry karo', 'err');
        _profileUpdateSubmitting = false;
        if (btn) { btn.disabled = false; btn.textContent = 'Submit for Verification'; }
        return;
      }
      /* Also update user's display values optimistically */
      var userUpdate = {
        profile_status: 'pending', pending_ign: ign,
        profile_request_count: (UD.profileRequestCount || 0) + 1
      };
      if (bio)   userUpdate.bio   = bio;
      if (phone && phone.length >= 10) userUpdate.phone = phone;
      window._supa.from('users').update(userUpdate).eq('id', U.uid).then(null, function(){});
      /* Update local UD */
      if (window.UD) {
        window.UD.profileStatus    = 'pending';
        window.UD.pendingIgn       = ign;
        window.UD.profileRequestCount = (UD.profileRequestCount || 0) + 1;
        if (bio)   window.UD.bio   = bio;
      }
      _profileUpdateSubmitting = false;
      if (btn) { btn.disabled = false; btn.textContent = 'Submit for Verification'; }
      closeModal();
      toast('Profile sent for verification! ✅', 'ok');
    }).catch(function(e) {
      console.error('[doProfileUpdate] Network/unexpected error:', e && e.message);
      toast('Submit failed: ' + (e && e.message ? e.message : 'network error') + ' — retry karo', 'err');
      _profileUpdateSubmitting = false;
      if (btn) { btn.disabled = false; btn.textContent = 'Submit for Verification'; }
    });
}

/* Handles edit requests from an ALREADY-VERIFIED user — goes to the
   separate `profile_updates` table (Admin Panel's "Profile Updates"
   tab), NOT `profile_requests` ("New Verifications"). Crucially this
   does NOT touch users.profile_status — the user stays 'approved' and
   keeps full access (joining matches etc.) while the edit is pending
   admin review, since only their IGN/UID/phone are changing, not their
   verification standing. */
async function _submitProfileUpdateForVerifiedUser(ign, uid, phone, btn) {
    var bio = (($('puBio') || {}).value || '').trim().substring(0, 80);
    if (!window._supa || !window._supaReady) {
      toast('Service unavailable — retry karo', 'err');
      _profileUpdateSubmitting = false;
      if (btn) { btn.disabled = false; btn.textContent = 'Submit for Verification'; }
      return;
    }

    window._supa.from('profile_updates').insert({
      user_id:        U.uid,
      new_ign:        ign,
      new_ff_uid:     uid,
      current_ign:    UD.ign || '',
      current_ff_uid: UD.ffUid || '',
      new_phone:      phone || null,
      status:         'pending',
      request_count:  (UD.profileRequestCount || 0) + 1
    }).then(function(result) {
      if (result && result.error) {
        console.error('[profileUpdate] Supabase insert error:', result.error.message || result.error);
        toast('Submit failed: ' + (result.error.message || 'unknown error') + ' — retry karo', 'err');
        _profileUpdateSubmitting = false;
        if (btn) { btn.disabled = false; btn.textContent = 'Submit for Verification'; }
        return;
      }
      if (bio && window._supa) {
        window._supa.from('users').update({ bio: bio }).eq('id', U.uid).then(null, function(){});
        if (window.UD) window.UD.bio = bio;
      }
      /* profile_status intentionally left untouched — user stays approved */
      if (window.UD) {
        window.UD.pendingIgn = ign;
        window.UD.profileRequestCount = (UD.profileRequestCount || 0) + 1;
      }
      _profileUpdateSubmitting = false;
      if (btn) { btn.disabled = false; btn.textContent = 'Submit for Verification'; }
      closeModal();
      toast('Update request sent for review! ✅', 'ok');
    }).catch(function(e) {
      console.error('[profileUpdate] Network/unexpected error:', e && e.message);
      toast('Submit failed: ' + (e && e.message ? e.message : 'network error') + ' — retry karo', 'err');
      _profileUpdateSubmitting = false;
      if (btn) { btn.disabled = false; btn.textContent = 'Submit for Verification'; }
    });
}

function redeemVoucher() {
  var code = ($('voucherIn') || {}).value;
  if (!code || !code.trim()) { toast('Enter voucher code', 'err'); return; }
  code = code.trim().toUpperCase();
  if (!window._supa || !window.U) { toast('Login karo pehle', 'err'); return; }
  /* Fetch from Supabase vouchers table */
  window._supa.from('vouchers').select('*').eq('code', code).single()
    .then(function(r) {
      if (!r.data) { toast('Invalid voucher code', 'err'); return; }
      var v = r.data;
      if (v.expires_at && new Date(v.expires_at) < new Date()) { toast('Voucher expired', 'err'); return; }
      if ((v.used_count || 0) >= (v.max_uses || 1)) { toast('Voucher limit reach ho gaya', 'err'); return; }
      var rt = v.reward_type || 'coins', ra = Number(v.reward_amount) || 0;
      var _col = rt === 'coins' ? 'coins' : rt === 'green_diamonds' ? 'green_diamonds' : 'sky_diamonds';
      window._supa.rpc('increment_balance', { p_uid: window.U.uid, p_col: _col, p_amount: ra })
        .then(function() {
          window._supa.from('vouchers').update({ used_count: (v.used_count || 0) + 1 }).eq('code', code).then(null, function(){});
          window._supa.from('wallet_transactions').insert({ user_id: window.U.uid, currency: _col, txn_type: 'credit', amount: ra, reason: 'voucher', ref_id: code }).then(null, function(){});
          if (window.UD) { window.UD[_col] = (window.UD[_col] || 0) + ra; if (window.updateHdr) window.updateHdr(); }
          toast('✅ Voucher redeemed! +' + (_col === 'coins' ? '🪙 ' : '💎') + ra, 'ok');
          closeModal();
        }).catch(function() { toast('Redemption failed, dobara try karo', 'err'); });
    }).catch(function() { toast('Invalid voucher code', 'err'); });
}

function showSupportForm() {
  var h = '<div class="f-group"><label>Issue Type</label><select class="f-input" id="supType"><option value="payment">Payment Issue</option><option value="match">Match Issue</option><option value="account">Account Issue</option><option value="bug">Bug Report</option><option value="other">Other</option></select></div>';
  h += '<div class="f-group"><label>Describe your issue</label><textarea class="f-input" id="supMsg" placeholder="Explain your problem in detail..."></textarea></div>';
  h += '<button class="f-btn fb-green" onclick="submitSupport()">Submit Ticket</button>';
  openModal('Support Ticket', h);
}
function submitSupport() {
  var type = ($('supType') || {}).value, msg = ($('supMsg') || {}).value;
  if (!msg || !msg.trim()) { toast('Describe your issue', 'err'); return; }
  /* ✅ Save to Supabase support_tickets (not Firebase RTDB) */
  if (window._supa && window.U && window.UD) {
    window._supa.from('support_tickets').insert({
      user_id: window.U.uid, subject: type || 'general',
      status: 'open', message: msg.trim(),
      user_ign: window.UD.ign || '', user_ff_uid: window.UD.ff_uid || ''
    }).then(function() {
      closeModal(); toast('✅ Ticket submitted! Hum jald jawab denge.', 'ok');
    }).catch(function() { toast('Submit nahi hua, dobara try karo', 'err'); });
  } else {
    /* Fallback to Firebase RTDB chat */
    if (window.db && window.U) {
      db.ref('supportRequests').push({ userId: window.U.uid, type: type, message: msg.trim(), status: 'open', createdAt: Date.now() });
    }
    closeModal(); toast('✅ Ticket submitted!', 'ok');
  }
}
function showRules() {
  var rules = ['Use only your registered IGN and UID. Mismatch = disqualification.', 'No teaming with enemies. Fair play only.', 'Join the room on time. Late = no refund.', 'Screenshots/proof may be required for disputes.', 'Admin decisions are final in all matters.', 'No abusive language in chat or support.', 'Multiple accounts will result in permanent ban.'];
  var h = '';
  rules.forEach(function(r, i) { h += '<div style="display:flex;gap:10px;padding:12px 0;border-bottom:1px solid var(--border)"><div style="width:24px;height:24px;border-radius:8px;background:rgba(0,255,106,.1);color:var(--green);font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">' + (i + 1) + '</div><div style="font-size:13px;line-height:1.5;color:var(--txt2)">' + r + '</div></div>'; });
  openModal('Rules & Fair Play', h);
}


/* ================================================================
   PROFILE SETTINGS SHEET — v32-FIX
   BUG FIX: showProfileSettings() was NEVER DEFINED anywhere
   Now creates a proper bottom sheet with all settings options
================================================================ */

window.showProfileSettings = function() {
  /* Remove existing if open (toggle behavior) */
  var existing = document.getElementById('profSettingsSheet');
  if (existing) { window.closeProfileSettings(); return; }

  var sheet = document.createElement('div');
  sheet.id = 'profSettingsSheet';
  sheet.style.cssText = [
    'position:fixed', 'top:0', 'left:0', 'right:0', 'bottom:0',
    'z-index:8500', 'background:rgba(0,0,0,.75)', 'backdrop-filter:blur(6px)',
    '-webkit-backdrop-filter:blur(6px)',
    'display:flex', 'align-items:flex-end', 'justify-content:center',
    'animation:fadeIn .2s ease'
  ].join(';');

  var items = [
    { icon:'fa-user-edit',     label:'Edit Profile',          color:'#00d4ff', fn:'if(window.showProfileUpdate)showProfileUpdate();window.closeProfileSettings()' },
    { icon:'fa-camera',        label:'Change Profile Photo',  color:'#00ff9c', fn:'var i=document.getElementById("profImgIn");if(i)i.click();window.closeProfileSettings()' },
    { icon:'fa-image',         label:'Change Banner Photo',   color:'#b964ff', fn:'var i=document.getElementById("profBannerIn");if(i)i.click();window.closeProfileSettings()' },
    { icon:'fa-tv',            label:'Stream Settings',       color:'#ff4444', fn:'if(window.showStreamSettings)showStreamSettings();window.closeProfileSettings()' },
    { icon:'fa-users',         label:'Add Teammate',          color:'#ffaa00', fn:'if(window.addTM)addTM("duo");window.closeProfileSettings()' },
    { icon:'fa-ticket-alt',    label:'Redeem Voucher',        color:'#ffcc00', fn:'if(window.showVoucherModal)showVoucherModal();else navTo("wallet");window.closeProfileSettings()' },
    { icon:'fa-scroll',        label:'Rules & Fair Play',     color:'#aaa',    fn:'if(window.showRules)showRules();window.closeProfileSettings()' },
    { icon:'fa-headset',       label:'Support',               color:'#ffaa00', fn:'if(window.showSupportForm)showSupportForm();window.closeProfileSettings()' },
    { icon:'fa-scale-balanced', label:'Legal & Compliance',   color:'#00d4ff', fn:'if(window.mesShowLegalModal)mesShowLegalModal();window.closeProfileSettings()' },
    { icon:'fa-sign-out-alt',  label:'Logout',                color:'#ff4444', fn:'if(window.doLogout&&confirm("Logout karna chahte ho?"))doLogout();window.closeProfileSettings()' },
  ];

  function _rgb(hex) {
    var r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return r ? parseInt(r[1],16)+','+parseInt(r[2],16)+','+parseInt(r[3],16) : '255,255,255';
  }

  var h = '<div style="background:#0d0d1a;border-radius:24px 24px 0 0;width:100%;max-width:480px;padding-bottom:env(safe-area-inset-bottom,12px);max-height:88vh;overflow-y:auto;-webkit-overflow-scrolling:touch">';
  /* Drag handle */
  h += '<div style="text-align:center;padding:14px 0 6px"><div style="width:36px;height:4px;border-radius:2px;background:rgba(255,255,255,.18);margin:0 auto"></div></div>';
  /* Header */
  h += '<div style="display:flex;align-items:center;justify-content:space-between;padding:4px 20px 14px">';
  h += '<div style="font-size:16px;font-weight:900;color:#fff">⚙️ Settings</div>';
  h += '<div onclick="window.closeProfileSettings()" style="width:30px;height:30px;border-radius:50%;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.1);display:flex;align-items:center;justify-content:center;cursor:pointer"><i class="fas fa-times" style="font-size:13px;color:#aaa"></i></div>';
  h += '</div>';
  /* Items */
  h += '<div style="padding:0 14px 16px">';
  items.forEach(function(item) {
    var rgb = _rgb(item.color);
    h += '<div onclick="' + item.fn.replace(/"/g, '&quot;') + '" ';
    h += 'style="display:flex;align-items:center;gap:14px;padding:13px 14px;border-radius:14px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);cursor:pointer;margin-bottom:7px;-webkit-tap-highlight-color:transparent;transition:background .15s" ';
    h += 'ontouchstart="this.style.background=\'rgba(255,255,255,.09)\'" ontouchend="this.style.background=\'rgba(255,255,255,.04)\'">';
    h += '<div style="width:38px;height:38px;border-radius:11px;background:rgba('+rgb+',.12);border:1px solid rgba('+rgb+',.28);display:flex;align-items:center;justify-content:center;flex-shrink:0">';
    h += '<i class="fas ' + item.icon + '" style="color:' + item.color + ';font-size:15px"></i></div>';
    h += '<div style="flex:1;font-size:14px;font-weight:600;color:#fff">' + item.label + '</div>';
    h += '<i class="fas fa-chevron-right" style="color:rgba(255,255,255,.25);font-size:11px"></i>';
    h += '</div>';
  });
  h += '</div></div>';

  sheet.innerHTML = h;

  /* Tap outside to close */
  sheet.addEventListener('click', function(e) {
    if (e.target === sheet) window.closeProfileSettings();
  });

  /* Slide-up animation */
  var inner = sheet.querySelector('div');
  if (inner) { inner.style.transform = 'translateY(100%)'; inner.style.transition = 'transform .3s ease'; }
  document.body.appendChild(sheet);
  /* Trigger animation */
  requestAnimationFrame(function() {
    requestAnimationFrame(function() {
      if (inner) inner.style.transform = 'translateY(0)';
    });
  });
};

window.closeProfileSettings = function() {
  var sheet = document.getElementById('profSettingsSheet');
  if (!sheet) return;
  var inner = sheet.querySelector('div');
  if (inner) {
    inner.style.transition = 'transform .25s ease';
    inner.style.transform  = 'translateY(100%)';
  }
  sheet.style.transition = 'opacity .25s';
  sheet.style.opacity    = '0';
  setTimeout(function() { if (sheet.parentNode) sheet.parentNode.removeChild(sheet); }, 260);
};

/* Also expose showVoucherModal if not exists */
if (!window.showVoucherModal) {
  window.showVoucherModal = function() {
    var h = '<div class="f-group"><label>Voucher Code</label>';
    h += '<input type="text" class="f-input" id="voucherIn" placeholder="Enter code..." style="text-transform:uppercase"></div>';
    h += '<button class="f-btn fb-green" onclick="redeemVoucher()">Redeem Voucher</button>';
    if (window.openModal) openModal('🎟️ Redeem Voucher', h);
  };
}

/* ── My Suggestions — real implementation ──
   Users submit platform suggestions. Each submission saved to
   user_suggestions table (added Section 16 in COMPLETE_SCHEMA.sql).
   Users see their own past submissions + admin reply status. */
window.showMySuggestions = function() {
  if (!window.U) { if (window.toast) toast('Login karo pehle', 'err'); return; }

  function _buildSuggestUI(past) {
    var h = '';
    /* Submit box */
    h += '<div style="margin-bottom:16px">';
    h += '<div style="font-size:13px;font-weight:800;color:#fff;margin-bottom:8px">✍️ Naya Suggestion</div>';
    h += '<textarea id="suggestTxt" placeholder="Platform ke baare mein koi bhi idea, feedback, ya request likho..." ';
    h += 'style="width:100%;box-sizing:border-box;min-height:90px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:10px 12px;color:#fff;font-size:13px;resize:vertical;outline:none"></textarea>';
    h += '<button onclick="_submitSuggestion()" style="width:100%;margin-top:8px;padding:12px;border-radius:12px;border:none;background:linear-gradient(135deg,#ffd700,#ff8c00);color:#000;font-size:13px;font-weight:900;cursor:pointer">Submit Suggestion</button>';
    h += '</div>';

    /* Past submissions */
    h += '<div style="font-size:13px;font-weight:800;color:#fff;margin-bottom:8px">📋 Meri Previous Suggestions</div>';
    if (!past.length) {
      h += '<div style="text-align:center;padding:20px;color:#666;font-size:12px">Abhi tak koi suggestion nahi diya.<br>Upar box mein likho!</div>';
    } else {
      var statusStyle = {
        pending:     { col: '#888',   label: '⏳ Pending' },
        reviewed:    { col: '#00d4ff', label: '👀 Reviewed' },
        implemented: { col: '#00ff9c', label: '✅ Implemented' },
        declined:    { col: '#ff6b6b', label: '❌ Declined' }
      };
      past.forEach(function(s) {
        var st = statusStyle[s.status] || statusStyle.pending;
        var dt = s.created_at ? new Date(s.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : '';
        h += '<div style="padding:12px;border-radius:12px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);margin-bottom:8px">';
        h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">';
        h += '<span style="font-size:10px;color:' + st.col + ';font-weight:800">' + st.label + '</span>';
        h += '<span style="font-size:10px;color:#555">' + dt + '</span>';
        h += '</div>';
        h += '<div style="font-size:13px;color:#ccc;line-height:1.5">' + escH(s.message) + '</div>';
        if (s.admin_reply) {
          h += '<div style="margin-top:8px;padding:8px 10px;border-radius:8px;background:rgba(0,212,255,.07);border-left:2px solid #00d4ff">';
          h += '<div style="font-size:10px;font-weight:800;color:#00d4ff;margin-bottom:2px">Admin Reply:</div>';
          h += '<div style="font-size:12px;color:#aaa">' + escH(s.admin_reply) + '</div></div>';
        }
        h += '</div>';
      });
    }
    return h;
  }

  function escH(str) { return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  if (window.openModal) openModal('💡 My Suggestions', '<div id="suggestBody"><div style="text-align:center;padding:24px;color:#555"><i class="fas fa-spinner fa-spin"></i> Loading...</div></div>');

  if (!window._supa) {
    var b = document.getElementById('suggestBody');
    if (b) b.innerHTML = _buildSuggestUI([]);
    return;
  }

  window._supa.from('user_suggestions')
    .select('id,message,status,admin_reply,created_at')
    .eq('user_id', window.U.uid)
    .order('created_at', { ascending: false })
    .limit(20)
    .then(function(r) {
      var b = document.getElementById('suggestBody');
      if (b) b.innerHTML = _buildSuggestUI(r.data || []);
    })
    .catch(function() {
      var b = document.getElementById('suggestBody');
      if (b) b.innerHTML = _buildSuggestUI([]);
    });
};

/* Called inline from the modal's submit button */
window._submitSuggestion = function() {
  var txt = (document.getElementById('suggestTxt') || {}).value || '';
  txt = txt.trim();
  if (!txt) { if (window.toast) toast('Kuch to likho!', 'err'); return; }
  if (txt.length < 10) { if (window.toast) toast('Thoda aur detail do (min 10 chars)', 'err'); return; }
  if (txt.length > 500) { if (window.toast) toast('Max 500 characters allowed', 'err'); return; }
  if (!window._supa || !window.U) { if (window.toast) toast('Connection error', 'err'); return; }
  var btn = document.querySelector('#suggestBody button');
  if (btn) { btn.textContent = 'Submitting…'; btn.disabled = true; }
  window._supa.from('user_suggestions')
    .insert({ user_id: window.U.uid, message: txt, status: 'pending' })
    .then(function(r) {
      if (r.error) throw r.error;
      if (window.toast) toast('Suggestion submit ho gaya! 🎉', 'ok');
      /* Refresh the modal with updated list */
      window.showMySuggestions();
    })
    .catch(function(e) {
      if (btn) { btn.textContent = 'Submit Suggestion'; btn.disabled = false; }
      if (window.toast) toast('Submit fail: ' + (e.message || 'retry karo'), 'err');
    });
};

/* ── Performance Dashboard — real implementation ──
   Uses the same join_requests + matches data match-history.js already
   reads, but aggregates it differently: win-rate-by-mode breakdown,
   average kills/match, best placement, and a recent-form strip —
   complementary to Match History's chronological list, not a duplicate. */
window.showPerformanceDashboard = function() {
  if (!window.U) { if (window.toast) toast('Login karo pehle', 'err'); return; }
  var h = '<div id="perfDashBody"><div style="text-align:center;padding:30px;color:#555"><i class="fas fa-spinner fa-spin"></i> Loading...</div></div>';
  if (window.openModal) openModal('📈 Performance Dashboard', h);

  if (!window._supa) {
    var body0 = document.getElementById('perfDashBody');
    if (body0) body0.innerHTML = '<div style="text-align:center;padding:24px;color:var(--txt2)">Connection error.</div>';
    return;
  }

  window._supa.from('join_requests')
    .select('kills,placement,mode,prize_earned,created_at,status')
    .eq('user_id', window.U.uid)
    .in('status', ['approved', 'completed'])
    .order('created_at', { ascending: false })
    .limit(100)
    .then(function(r) {
      var body = document.getElementById('perfDashBody');
      if (!body) return;
      var rows = r.data || [];
      if (!rows.length) {
        body.innerHTML = '<div style="text-align:center;padding:30px;color:var(--txt2)"><div style="font-size:40px;margin-bottom:10px">📈</div>Abhi koi match data nahi hai.<br>Match khelo, performance yahan dikhega!</div>';
        return;
      }

      var totalKills = 0, wins = 0, byMode = { solo: [], duo: [], squad: [] };
      var best = null;
      rows.forEach(function(jr) {
        totalKills += jr.kills || 0;
        if (jr.placement === 1) wins++;
        if (best === null || (jr.placement > 0 && jr.placement < best)) best = jr.placement || best;
        var m = (jr.mode || 'solo').toLowerCase();
        if (!byMode[m]) byMode[m] = [];
        byMode[m].push(jr);
      });
      var matches = rows.length;
      var winRate = matches ? Math.round((wins / matches) * 100) : 0;
      var avgKills = matches ? (totalKills / matches).toFixed(1) : '0.0';

      var hh = '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:14px">';
      hh += statCard('🎮', matches, 'Matches', '#00d4ff');
      hh += statCard('🏆', winRate + '%', 'Win Rate', '#00ff9c');
      hh += statCard('💀', avgKills, 'Avg Kills/Match', '#ff6b6b');
      hh += statCard('🥇', best ? '#' + best : '—', 'Best Placement', '#ffd700');
      hh += '</div>';

      hh += '<div style="font-size:13px;font-weight:800;color:#fff;margin-bottom:8px">Mode Breakdown</div>';
      hh += '<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:14px">';
      ['solo', 'duo', 'squad'].forEach(function(m) {
        var list = byMode[m] || [];
        if (!list.length) return;
        var mw = list.filter(function(x) { return x.placement === 1; }).length;
        var mwr = Math.round((mw / list.length) * 100);
        hh += '<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08)">';
        hh += '<div style="width:54px;font-size:11px;font-weight:800;color:#aaa;text-transform:capitalize">' + m + '</div>';
        hh += '<div style="flex:1;height:6px;border-radius:3px;background:rgba(255,255,255,.08);overflow:hidden"><div style="height:100%;width:' + mwr + '%;background:linear-gradient(90deg,#00d4ff,#00ff9c)"></div></div>';
        hh += '<div style="font-size:11px;color:#888;min-width:70px;text-align:right">' + list.length + ' games · ' + mwr + '%</div>';
        hh += '</div>';
      });
      hh += '</div>';

      hh += '<div style="font-size:13px;font-weight:800;color:#fff;margin-bottom:8px">Recent Form</div>';
      hh += '<div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:4px" class="scroll-fade-x">';
      rows.slice(0, 10).forEach(function(jr) {
        var won = jr.placement === 1;
        var col = won ? '#00ff9c' : (jr.placement && jr.placement <= 3 ? '#ffd700' : '#888');
        hh += '<div style="min-width:48px;text-align:center;padding:8px 6px;border-radius:10px;background:rgba(255,255,255,.04);border:1px solid ' + col + '33;flex-shrink:0">';
        hh += '<div style="font-size:13px;font-weight:900;color:' + col + '">' + (jr.placement ? '#' + jr.placement : '—') + '</div>';
        hh += '<div style="font-size:9px;color:#888;margin-top:2px">💀' + (jr.kills || 0) + '</div>';
        hh += '</div>';
      });
      hh += '</div>';

      body.innerHTML = hh;
    })
    .catch(function() {
      var body = document.getElementById('perfDashBody');
      if (body) body.innerHTML = '<div style="text-align:center;padding:24px;color:var(--txt2)">Performance data load nahi hui.</div>';
    });

  function statCard(icon, val, label, color) {
    return '<div style="text-align:center;background:rgba(255,255,255,.03);border-radius:12px;padding:12px"><div style="font-size:18px">' + icon + '</div><div style="font-size:18px;font-weight:900;color:' + color + ';margin-top:4px">' + val + '</div><div style="font-size:9px;color:#888;margin-top:2px">' + label + '</div></div>';
  }
};

console.log('[Profile] showProfileSettings v32-FIX ✅');
