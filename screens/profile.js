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

  /* ── Banner + Avatar Header ── */
  var bannerImg = UD.bannerImage || '';
  var bannerStyle = bannerImg
    ? 'background:url(' + bannerImg + ') center/cover no-repeat'
    : 'background:linear-gradient(135deg,#0d0d1a 0%,#1a0d2e 40%,#0d1a2e 70%,#0d0d1a 100%)';
  var h = '<div class="prof-header" style="position:relative;overflow:hidden;padding:0;margin-bottom:0">';
  /* Banner area with change button */
  h += '<div id="profBannerWrap" style="position:relative;width:100%;height:110px;' + bannerStyle + ';border-radius:16px 16px 0 0;overflow:hidden">';
  /* Animated background particles if no banner */
  if (!bannerImg) {
    h += '<div style="position:absolute;inset:0;background:radial-gradient(circle at 20% 50%,rgba(185,100,255,.25) 0%,transparent 50%),radial-gradient(circle at 80% 20%,rgba(0,212,255,.2) 0%,transparent 40%),radial-gradient(circle at 50% 80%,rgba(255,140,0,.15) 0%,transparent 40%)"></div>';
    h += '<div style="position:absolute;inset:0;background:repeating-linear-gradient(45deg,transparent,transparent 40px,rgba(255,255,255,.01) 40px,rgba(255,255,255,.01) 80px)"></div>';
  }
  /* Settings cog top right */
  h += '<div onclick="showProfileSettings()" style="position:absolute;top:10px;right:10px;width:34px;height:34px;border-radius:10px;background:rgba(0,0,0,.5);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.15);display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:5"><i class="fas fa-cog" style="font-size:14px;color:#ccc"></i></div>';
  /* Change banner button */
  h += '<div onclick="document.getElementById(\'profBannerIn\').click()" style="position:absolute;bottom:8px;right:10px;padding:5px 10px;border-radius:8px;background:rgba(0,0,0,.55);backdrop-filter:blur(6px);border:1px solid rgba(255,255,255,.15);font-size:10px;font-weight:700;color:#ddd;cursor:pointer;display:flex;align-items:center;gap:5px"><i class="fas fa-image" style="font-size:10px"></i>Banner</div>';
  h += '<input type="file" id="profBannerIn" accept="image/*" style="display:none" onchange="uploadBannerImg(this)">';
  h += '</div>';
  /* Avatar overlapping banner */
  h += '<div style="display:flex;flex-direction:column;align-items:center;margin-top:-44px;position:relative;z-index:2;padding-bottom:14px;background:linear-gradient(180deg,transparent 0%,rgba(5,5,7,.95) 50px)">';
  h += '<div class="prof-ava-wrap"><div class="prof-ava" style="width:86px;height:86px;font-size:30px;border:3px solid ' + rk.color + ';box-shadow:0 0 20px ' + rk.color + '88,0 0 0 3px rgba(5,5,7,.8);' + ringAnim + '">' + av + '</div>';
  h += '<div class="prof-edit-btn" onclick="document.getElementById(\'profImgIn\').click()" style="background:' + rk.color + ';border-color:rgba(5,5,7,.8)"><i class="fas fa-pencil-alt"></i></div>';
  h += '<input type="file" id="profImgIn" accept="image/*" style="display:none" onchange="uploadProfImg(this)"></div>';
  /* Premium badge if applicable */
  var premBadge = '';
  if (UD.premium && UD.premium.tier) {
    var pt = UD.premium.tier;
    var ptLabel = pt===3?'⭐ Premium III':pt===2?'⭐ Premium II':'⭐ Premium I';
    var ptColor = pt===3?'#b964ff':pt===2?'#00d4ff':'#ffd700';
    premBadge = '<span style="display:inline-flex;align-items:center;gap:3px;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:800;background:linear-gradient(135deg,' + ptColor + '33,' + ptColor + '11);border:1px solid ' + ptColor + '66;color:' + ptColor + ';margin-left:6px">' + ptLabel + '</span>';
  }
  h += '<div style="font-size:20px;font-weight:900;margin-top:8px;text-align:center">' + (UD.ign || UD.displayName || 'Player') + premBadge + '</div>';
  /* Rank badge below name */
  h += '<div style="display:inline-flex;align-items:center;gap:5px;padding:4px 12px;border-radius:20px;margin-top:5px;font-size:12px;font-weight:800;background:' + rk.bg + ';border:1px solid ' + rk.color + '55;color:' + rk.color + ';box-shadow:0 0 10px ' + rk.color + '33">' + rk.emoji + ' ' + rk.badge + ' · ' + rk.pts + ' pts</div>';
  /* Title display */
  if (UD.title) {
    h += '<div class="prof-title-chip" style="margin-top:5px">' + UD.title + '</div>';
  }
  h += '<div style="font-size:11px;color:#444;margin-top:5px;font-weight:600;letter-spacing:.5px">UID: ' + displayUid + '</div>';
  h += '</div>';
  h += '</div>';
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
  h += '<div class="xp-bar-wrap"><div class="xp-bar-top"><span class="xp-level">Level ' + lv + ' — ' + rk.emoji + ' ' + rk.badge + '</span><span class="xp-text">' + xp + '/' + maxXp + ' XP</span></div>';
  h += '<div class="xp-track"><div class="xp-fill" style="width:' + xpPct + '%"></div></div></div>';

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
  /* ── Stream Settings button ── */
  h += '<button class="prof-btn" onclick="window.showStreamSettings&&showStreamSettings()" style="background:linear-gradient(135deg,rgba(255,68,68,.1),rgba(255,100,100,.05));border:1px solid rgba(255,68,68,.25);color:#ff8888;margin-bottom:8px">';
  h += '<span style="margin-right:auto">' + (UD.isLive ? '<span style="display:inline-flex;align-items:center;gap:6px"><div style="width:7px;height:7px;border-radius:50%;background:#ff4444;animation:livePulse 1s ease-in-out infinite"></div></span>' : '<i class="fas fa-video" style="margin-right:8px"></i>') + 'Live Stream</span>';
  h += '<span style="font-size:12px;background:rgba(255,68,68,.12);padding:2px 8px;border-radius:10px">' + (UD.isLive ? '🔴 LIVE' : 'Setup') + '</span></button>';
  /* ── Missions button ── */
  h += '<button class="prof-btn" onclick="window.showMissionsPanel&&showMissionsPanel()" style="background:linear-gradient(135deg,rgba(0,255,156,.08),rgba(0,212,255,.05));border:1px solid rgba(0,255,156,.2);color:var(--green);margin-bottom:8px">';
  h += '<span style="margin-right:auto"><i class="fas fa-tasks" style="margin-right:8px;color:var(--green)"></i>Daily Missions</span>';
  h += '<span style="font-size:12px;background:rgba(0,255,156,.1);padding:2px 8px;border-radius:10px;color:var(--green)">Earn 🪙</span></button>';
  /* ── Cosmetics Store button ── */
  h += '<button class="prof-btn" onclick="window.showCosmeticsStore&&showCosmeticsStore()" style="background:linear-gradient(135deg,rgba(0,212,255,.08),rgba(0,100,255,.05));border:1px solid rgba(0,212,255,.2);color:#00d4ff;margin-bottom:8px">';
  h += '<span style="margin-right:auto"><i class="fas fa-store" style="margin-right:8px;color:#00d4ff"></i>Cosmetics Store</span>';
  h += '<span style="font-size:12px;background:rgba(0,212,255,.1);padding:2px 8px;border-radius:10px">💎 Unlock</span></button>';
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

  h += '<div class="prof-section"><h3><i class="fas fa-gamepad"></i> Game Info</h3>';
  h += '<div class="gi-row"><span class="gi-l">IGN</span><span class="gi-v">' + (UD.ign || '-') + '</span></div>';
  h += '<div class="gi-row"><span class="gi-l">FF UID</span><span class="gi-v">' + (UD.ffUid || '-') + '</span></div>';
  if (UD.phone) h += '<div class="gi-row"><span class="gi-l">📱 Phone</span><span class="gi-v">' + UD.phone + '</span></div>';
  h += '</div>';
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
  h += '<button class="prof-btn pb-orange" onclick="showProfileUpdate()" ' + (UD.profileStatus === 'pending' ? 'disabled' : '') + '><i class="fas fa-edit"></i> Request Profile Update</button>';
  // Stats Chart + Profile Completion
  if (window.renderStatsChart) h += window.renderStatsChart();
  if (window.renderProfileCompletion) h += window.renderProfileCompletion();
  /* Performance Dashboard button */
  h += '<button class="prof-btn" onclick="window.showPerformanceDashboard&&showPerformanceDashboard()" style="background:linear-gradient(135deg,rgba(0,212,255,.1),rgba(0,255,156,.06));border:1px solid rgba(0,212,255,.2);color:#00d4ff;margin-bottom:8px">';
  h += '<span style="margin-right:auto"><i class="fas fa-chart-line" style="margin-right:8px"></i>Performance Dashboard</span>';
  h += '<span style="font-size:11px;opacity:.6">→</span></button>';
  if (window.renderNextMatchCountdown) h += window.renderNextMatchCountdown();

  // Bio — show if set
  if (UD.bio) h += '<div style="padding:10px 14px;background:rgba(0,255,156,.06);border:1px solid rgba(0,255,156,.15);border-radius:12px;font-size:13px;font-style:italic;color:var(--green);margin-bottom:14px">"' + UD.bio + '"</div>';

  // Settings hint card
  h += '<div onclick="showProfileSettings()" style="display:flex;align-items:center;gap:14px;padding:16px 18px;border-radius:16px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);cursor:pointer;margin-bottom:6px;-webkit-tap-highlight-color:transparent">';
  h += '<div style="width:40px;height:40px;border-radius:12px;background:rgba(0,255,156,.1);border:1px solid rgba(0,255,156,.2);display:flex;align-items:center;justify-content:center;flex-shrink:0"><i class="fas fa-cog" style="color:var(--green);font-size:18px"></i></div>';
  h += '<div style="flex:1"><div style="font-size:14px;font-weight:700;color:var(--txt)">Settings & More</div><div style="font-size:12px;color:var(--txt2);margin-top:2px">Team, Referral, Voucher, Achievements...</div></div>';
  h += '<i class="fas fa-chevron-right" style="color:var(--txt2);font-size:13px"></i>';
  h += '</div>';
  // 💡 Suggestion button
  h += '<div onclick="window.showMySuggestions&&showMySuggestions()" style="display:flex;align-items:center;gap:14px;padding:14px 18px;border-radius:16px;background:rgba(255,215,0,.04);border:1px solid rgba(255,215,0,.12);cursor:pointer;margin-bottom:6px;-webkit-tap-highlight-color:transparent">';
  h += '<div style="width:40px;height:40px;border-radius:12px;background:rgba(255,215,0,.1);border:1px solid rgba(255,215,0,.2);display:flex;align-items:center;justify-content:center;flex-shrink:0"><i class="fas fa-lightbulb" style="color:#ffd700;font-size:18px"></i></div>';
  h += '<div style="flex:1"><div style="font-size:14px;font-weight:700;color:var(--txt)">💡 Suggest a Feature</div><div style="font-size:12px;color:var(--txt2);margin-top:2px">App mein koi kami hai? Batao — reward milega!</div></div>';
  h += '<i class="fas fa-chevron-right" style="color:var(--txt2);font-size:13px"></i></div>';
  // ✅ LEGAL: Legal footer
  if (window.mesLegalFooter) h += window.mesLegalFooter();
  pc.innerHTML = h;
}

function uploadProfImg(inp) {
  if (!inp.files || !inp.files[0]) return;
  if (window.uploadProfileImage) { uploadProfileImage(inp.files[0]); return; }
  compImg(inp.files[0], 400, 0.8, 150, function(b64) { db.ref('users/' + U.uid + '/profileImage').set(b64); toast('Photo updated! ✅', 'ok'); });
}
function uploadBannerImg(inp) {
  if (!inp.files || !inp.files[0]) return;
  compImg(inp.files[0], 800, 0.75, 250, function(b64) {
    db.ref('users/' + U.uid + '/bannerImage').set(b64);
    toast('Banner updated! ✅', 'ok');
    setTimeout(renderProfile, 300);
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
  if (!window._supa) { toast('Service unavailable', 'err'); return; }
  window._supa.from('users').select('id').eq('referral_code', code.toUpperCase()).maybeSingle()
    .then(function(rr) {
      var referrerUid = rr.data ? rr.data.id : null;
      if (!referrerUid) { toast('Yeh code nahi mila', 'err'); return; }
      if (referrerUid === U.uid) { toast('Apna code use nahi kar sakte', 'err'); return; }
      window._supa.from('referrals').upsert({ referrer_id: referrerUid, referred_id: U.uid, join_bonus_paid: true }, { onConflict: 'referred_id' })
        .then(function() {
          window._supa.rpc('increment_balance', { p_uid: referrerUid, p_col: 'coins', p_amount: rewardCoins }).catch(function(){});
          window._supa.from('notifications').insert({ user_id: referrerUid, type: 'referral', title: '🎁 Referral Reward!', body: (UD.ign||'Koi')+' join hua! +'+rewardCoins+' coins!' }).catch(function(){});
          window._supa.rpc('increment_balance', { p_uid: U.uid, p_col: 'coins', p_amount: rewardCoins }).catch(function(){});
          window._supa.from('users').update({ referred_by: referrerUid }).eq('id', U.uid).catch(function(){});
          if (UD) { UD.coins = (UD.coins||0)+rewardCoins; if (window.updateHdr) updateHdr(); }
          toast('✅ Referral applied! +' + rewardCoins + ' coins!', 'ok');
          closeModal();
        }).catch(function() { toast('Code already used hai', 'err'); });
    }).catch(function() { toast('Code nahi mila', 'err'); });
}
function shareRef(code) {
  var url = window.location.href;
  var msg = '🎮 Join Mini eSports — India\'s Best Free Fire Tournament App! 🔥\n\n💰 Win Real Cash Prizes!\n🪙 Get FREE bonus coins on signup!\n\n👉 Use my referral code: ' + code + '\n📲 Download now:';
  if (navigator.share) {
    navigator.share({ title: 'Mini eSports - Refer & Earn', text: msg, url: url }).catch(function() {
      window.open('https://wa.me/?text=' + encodeURIComponent(msg + '\n' + url), '_blank');
    });
  } else {
    window.open('https://wa.me/?text=' + encodeURIComponent(msg + '\n' + url), '_blank');
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
        foundCard.innerHTML = av + '<div><div style="font-weight:700">' + (pData.ign||'Unknown') + '</div><div style="font-size:11px;color:var(--txt2)">UID: ' + (pData.ffUid||'—') + '</div></div><span style="margin-left:auto;font-size:11px;padding:2px 8px;border-radius:8px;background:rgba(0,255,156,.1);color:var(--green)">✅ Verified</span>';
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
  h += '<div class="f-group"><label>Bio <span style="font-size:10px;color:var(--txt2)">(optional)</span></label><input type="text" class="f-input" id="puBio" placeholder="About you..." maxlength="80" value="' + (UD.bio || '') + '"></div>';
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
function _doSubmitProfileRequest(ign, uid, phone, btn) {
    var isVerified = (UD.profileStatus === 'approved');
    var reqType = isVerified ? 'update' : 'verification';

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
    
    /* Save to correct path based on ban status and profile verification */
    var _isBanned = UD.isBanned || UD.blocked;
    var _savePath = (_isBanned || UD.profileVerified) ? 'profileUpdates' : 'profileRequests';
    db.ref(_savePath + '/' + U.uid).set(Object.assign(requestData, { 
      isBannedUser: _isBanned || false,
      requestCount: (UD.profileRequestCount || 0) + 1  // track how many times user has requested
    }));
    
    /* Also update user's profile with requested values (for display while pending) */
    var bio = (($('puBio') || {}).value || '').trim().substring(0, 80);
    var userUpdate = { profileStatus: 'pending', profileRequired: true, pendingIgn: ign, pendingUid: uid, profileRequestCount: (UD.profileRequestCount || 0) + 1 };
    if (phone && phone.length >= 10) userUpdate.phone = phone;
    if (bio) userUpdate.bio = bio;
    db.ref('users/' + U.uid).update(userUpdate);
    _profileUpdateSubmitting = false;
    if (btn) { btn.disabled = false; btn.textContent = 'Submit for Verification'; }
    closeModal();
    toast('Profile sent for verification! ✅', 'ok');
}
function redeemVoucher() {
  var code = ($('voucherIn') || {}).value;
  if (!code || !code.trim()) { toast('Enter voucher code', 'err'); return; }
  code = code.trim().toUpperCase();
  db.ref('vouchers/' + code).once('value', function(s) {
    if (!s.exists()) { toast('Invalid voucher code', 'err'); return; }
    var v = s.val();
    if (v.status !== 'active') { toast('Voucher expired', 'err'); return; }
    if (v.usedBy && v.usedBy[U.uid]) { toast('Already redeemed!', 'inf'); return; }
    if (v.maxUses && (v.usedCount || 0) >= v.maxUses) { toast('Voucher limit reached', 'err'); return; }
    var rt = v.rewardType || 'coins', ra = Number(v.rewardAmount) || 0;
    if (rt === 'coins') db.ref('users/' + U.uid + '/coins').transaction(function(c) { return (c || 0) + ra; });
    else db.ref('users/' + U.uid + '/realMoney/bonus').transaction(function(b) { return (b || 0) + ra; });
    db.ref('vouchers/' + code + '/usedBy/' + U.uid).set(true);
    db.ref('vouchers/' + code + '/usedCount').transaction(function(c) { return (c || 0) + 1; });
    toast('Voucher redeemed! +' + (rt === 'coins' ? '🪙 ' : '💎') + ra, 'ok');
  });
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
  var id = db.ref('supportRequests').push().key;
  db.ref('supportRequests/' + id).set({ requestId: id, userId: U.uid, userName: UD.ign || UD.displayName || '', displayName: UD.displayName || '', userEmail: UD.email || '', userIGN: UD.ign || '', userFFUID: UD.ffUid || '', type: type, message: msg.trim(), status: 'open', createdAt: Date.now() });
  closeModal(); toast('Ticket submitted!', 'ok');
}
function showRules() {
  var rules = ['Use only your registered IGN and UID. Mismatch = disqualification.', 'No teaming with enemies. Fair play only.', 'Join the room on time. Late = no refund.', 'Screenshots/proof may be required for disputes.', 'Admin decisions are final in all matters.', 'No abusive language in chat or support.', 'Multiple accounts will result in permanent ban.'];
  var h = '';
  rules.forEach(function(r, i) { h += '<div style="display:flex;gap:10px;padding:12px 0;border-bottom:1px solid var(--border)"><div style="width:24px;height:24px;border-radius:8px;background:rgba(0,255,106,.1);color:var(--green);font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">' + (i + 1) + '</div><div style="font-size:13px;line-height:1.5;color:var(--txt2)">' + r + '</div></div>'; });
  openModal('Rules & Fair Play', h);
}

