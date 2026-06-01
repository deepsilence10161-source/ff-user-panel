# 🎮 MINI eSPORTS — COMPLETE DEVELOPER GUIDE
## User Panel v17 | Admin Panel v15 | Last Updated: May 2026

---

## 📋 TABLE OF CONTENTS

1. [Project Overview](#1-project-overview)
2. [Tech Stack — Har Tool Kisliye](#2-tech-stack--har-tool-kisliye)
3. [File Structure](#3-file-structure)
4. [Services & All Credentials](#4-services--all-credentials)
5. [Database — Supabase Tables](#5-database--supabase-tables)
6. [Firebase RTDB — Only 3 Cheezein](#6-firebase-rtdb--only-3-cheezein)
7. [All Features — Kahan Kya Hai](#7-all-features--kahan-kya-hai)
8. [Global Variables & Core Functions](#8-global-variables--core-functions)
9. [Currency & Economy System](#9-currency--economy-system)
10. [Rank System](#10-rank-system)
11. [Premium Tiers](#11-premium-tiers)
12. [Ad System — AdMob](#12-ad-system--admob)
13. [Push Notifications — OneSignal](#13-push-notifications--onesignal)
14. [Remote Config System (CFG)](#14-remote-config-system-cfg)
15. [Security System](#15-security-system)
16. [Legal Compliance (MES)](#16-legal-compliance-mes)
17. [Referral System](#17-referral-system)
18. [Watch & Earn System](#18-watch--earn-system)
19. [Check-In System](#19-check-in-system)
20. [Anti-Cheat System](#20-anti-cheat-system)
21. [Admin Panel — All Sections](#21-admin-panel--all-sections)
22. [How to Add a New Feature](#22-how-to-add-a-new-feature)
23. [How to Add a New Supabase Table](#23-how-to-add-a-new-supabase-table)
24. [Common Code Patterns](#24-common-code-patterns)
25. [Deployment Checklist](#25-deployment-checklist)
26. [Troubleshooting](#26-troubleshooting)

---

## 1. PROJECT OVERVIEW

Mini eSports — **free-to-play, halal** esports tournament platform for Free Fire / BGMI.

**Business Model:**
```
Revenue Sources:
├── AdMob Ads (main revenue)
│   ├── Banner ads — home screen
│   ├── Rewarded — watch to join Ad Match
│   └── Interstitial — after match ends
├── Premium Subscriptions (₹49 / ₹99 / ₹199 per month)
└── Sky Diamonds (UPI purchase for match entry)

NOT ALLOWED (Halal Rules — kabhi mat todna):
├── ❌ Real money withdrawal
├── ❌ Coins ↔ money conversion
├── ❌ Interest-based deposits
└── ❌ Real gambling mechanics
```

---

## 2. TECH STACK — HAR TOOL KISLIYE

---

### 🔥 FIREBASE

**Kisliye hai:** 4 cheezein (Auth ADD hua)
| Use | Detail |
|-----|--------|
| **Google Auth** | SIRF login ke liye — Firebase handles Google OAuth popup/redirect |
| **Realtime Chat** | User ↔ Admin support chat, real-time messages |
| **Firebase Analytics** | App events auto-track (screen views, joins, etc.) |
| **Firebase Crashlytics** | App crash reports |

**Firebase RTDB pe SIRF yeh paths allowed hain:**
```
/support/{ticketId}/messages/{msgId}   ← Chat
/deviceJoins/{deviceId}/{matchId}      ← Anti-cheat device check
/appSettings/liveConfig                ← Remote config backup
/appSettings/tdsConfig                 ← TDS tax config
/appSettings/diamondPackages           ← SD package prices
```

**File:** `core/firebase.js`
```javascript
Project:      fft-app-1e283
RTDB URL:     https://fft-app-1e283-default-rtdb.firebaseio.com
Auth Domain:  fft-app-1e283.firebaseapp.com
API Key:      AIzaSyA-v9AYigDrg96D_fos0vOW3wU2GY2UYec
App ID:       1:247829466483:web:6961488f1d3c4e3fff4906
Messaging ID: 247829466483
```

---

### 🔐 AUTH FLOW — Google Login (IMPORTANT — v26 me fix hua)

**Full Flow:**
```
User click "Continue with Google"
         ↓
    Firebase GoogleAuthProvider
    (signInWithPopup or signInWithRedirect for WebView)
         ↓
    Firebase onAuthStateChanged fires → user object milta hai
         ↓
    DB.auth.syncFirebaseToken(user) called
    — getIdToken(true) se fresh Firebase JWT lo
    — Supabase client RECREATE karo with:
      Authorization: Bearer <firebase-jwt>
    — Supabase validates JWT via Firebase JWKS
    — auth.uid() in PostgreSQL = Firebase UID ✅
         ↓
    afterLogin(user) → boot app
         ↓
    onIdTokenChanged listener (every ~1hr)
    — Token auto-refresh → Supabase re-sync ✅
```

**FILE: `core/auth.js`** — Login logic
**FILE: `core/db.js`** — `DB.auth.syncFirebaseToken(user)` — Supabase sync logic

**⚠️ KABHI MAT KARO (broke tha v25 me):**
```javascript
// ❌ GALAT — signInWithIdToken provider:'firebase' 
//    → "Unsupported provider" error
//    → Sirf OAuth providers (google/apple) ke liye hai
await _supa.auth.signInWithIdToken({ provider: 'firebase', token });

// ❌ GALAT — Supabase Google OAuth
//    → Google provider Supabase me enabled nahi hai
await _supa.auth.signInWithOAuth({ provider: 'google' });

// ❌ GALAT — Yeh method exists nahi Supabase me  
await _supa.auth.signInWithCustomToken(token);
```

**✅ SAHI TARIKA (v26 se):**
```javascript
// DB.auth.syncFirebaseToken(user) — core/db.js me defined hai
// Firebase JWT → Supabase client recreate with Bearer header
// Supabase Third-Party Auth (enabled: Dashboard → Auth → Third-Party → Firebase ✅)
await DB.auth.syncFirebaseToken(firebaseUser);
```

**Supabase Third-Party Auth Setup:**
```
Supabase Dashboard → Authentication → Third-Party Auth
→ Firebase → ENABLED ✅
→ Firebase Project ID: fft-app-1e283 ✅
```

**RTDB Security Rules (set karo ye exactly):**
```json
{
  "rules": {
    "support": {
      "$ticketId": {
        ".read": "auth != null",
        ".write": "auth != null"
      }
    },
    "deviceJoins": {
      "$deviceId": {
        ".read": "auth != null",
        ".write": "auth != null"
      }
    },
    "appSettings": {
      ".read": true,
      ".write": false
    },
    "$other": {
      ".read": false,
      ".write": false
    }
  }
}
```

---

### 🟢 SUPABASE

**Kisliye hai:** Primary database — SAB KUCH (matches, users, wallet, features, notifications...)

**File:** `core/db.js`
```javascript
URL:      https://hddhkculuyrfoevxmlwy.supabase.co
AnonKey:  eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhkZGhrY3VsdXlyZm9ldnhtbHd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0NTQ1MTgsImV4cCI6MjA5NDAzMDUxOH0.2hhDGez1fVFjS5ljSU3tSOEJuusLmQpERjcrh45T7po
```

**Usage patterns:**
```javascript
// Reference
const db = window._supa;

// SELECT
db.from('table').select('col1,col2').eq('id', uid).single()
  .then(r => r.data).catch(e => console.error(e));

// INSERT
db.from('table').insert({ col: val })
  .then(r => r.data[0]).catch(e => console.error(e));

// UPDATE
db.from('table').update({ col: newVal }).eq('id', id)
  .then(r => {}).catch(e => console.error(e));

// UPSERT (insert or update on conflict)
db.from('table').upsert({ id: uid, col: val }, { onConflict: 'id' })
  .catch(e => console.error(e));

// DELETE
db.from('table').delete().eq('id', id)
  .catch(e => console.error(e));

// FILTER OPERATORS
.eq('col', val)          // equal
.neq('col', val)         // not equal
.gt('col', val)          // greater than
.lt('col', val)          // less than
.gte('col', val)         // >= 
.lte('col', val)         // <=
.in('col', [v1, v2])     // IN array
.or('col1.eq.x,col2.eq.y') // OR condition
.ilike('col', '%search%')   // case-insensitive LIKE
.order('col', { ascending: true/false })
.limit(n)
```

---

### 🖼️ IMGBB — IMAGE UPLOAD

**Kisliye:** Profile photos, payment proofs, match screenshots

**File:** `core/imgbb.js`
```javascript
API Key: c977a42da70cbc98fe176af64fbc484f
API URL: https://api.imgbb.com/1/upload
Max size: 32MB
Free forever: Yes
```

**Usage:**
```javascript
// File input se upload
window.uploadToImgBB(fileInputElement, 'optional-filename', function(err, url) {
  if (err) { toast('Upload failed', 'err'); return; }
  // url = 'https://i.ibb.co/...' (direct image URL)
});

// Base64 string upload
window.uploadToImgBBBase64(base64Data, 'filename', function(err, url) {
  // same callback pattern
});
```

---

### 📱 ADMOB — AD REVENUE

**Kisliye:** App se revenue kamao — rewarded, interstitial, banner ads

**File:** `features/ads.js`
```javascript
App ID:           ca-app-pub-1032532795123223~9674995485
Rewarded Ad ID:   ca-app-pub-1032532795123223/5092857849   ← Ad Match join
Interstitial ID:  ca-app-pub-1032532795123223/7817221971   ← After match ends
Banner ID:        ca-app-pub-1032532795123223/9718498564   ← Home screen
```

**Kaise kaam karta hai:**
```
Web/PWA Mode:
├── Real AdMob SDK NOT available (web limitation)
├── 5-second countdown overlay simulate karta hai
└── After countdown → onAdRewarded() callback fires

Android APK Mode:
├── Real AdMob SDK via WebView JavaScript Bridge
├── window.Android.showRewardedAd(adUnitId) call
└── Android app calls window.onAdRewarded() on success
```

**Usage:**
```javascript
// Check if premium (premium users ko ads nahi dikhate)
if (!window._adIsPremium()) {
  // Show ad
}

// Rewarded ad (for Ad Match join)
window.AdManager.showRewardedAd(function(success) {
  if (success) { /* ad complete — join match */ }
  else { toast('Ad incomplete', 'err'); }
});

// Interstitial (after match ends)
window.AdManager.showInterstitial();

// Banner (auto-managed by ads.js on home screen)
window.AdManager.showBanner();
window.AdManager.hideBanner();
```

---

### 🔔 ONESIGNAL — PUSH NOTIFICATIONS

**Kisliye:** Push notifications — match room released, results, friend requests, etc.

**File:** `index.html` (lines 27-39)
```javascript
App ID:         9c00aa92-4577-484c-996d-4494e8c6afad
Safari Web ID:  web.onesignal.auto.6b7c8d9e-0f1a-2b3c-4d5e-6f7a8b9c0d1e
SDK URL:        https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js
Worker File:    OneSignalSDKWorker.js (root folder mein hona chahiye)
```

**Usage:**
```javascript
// Send push to a user (from admin via OneSignal Dashboard/API)
// App ke andar in-app notifications Supabase se handle hoti hain
// OneSignal sirf push notifications ke liye hai (background/locked screen)

// Tag a user (for targeting)
window.OneSignalDeferred.push(function(OneSignal) {
  OneSignal.User.addTag('uid', window.U.uid);
  OneSignal.User.addTag('city', window.UD.city || '');
});
```

---

### 💳 UPI — PAYMENTS

**Kisliye:** Sky Diamonds purchase, Premium subscription payment (manual approval flow)

```javascript
UPI ID: miniesports@upi
Flow:
  User → screenshot leke UPI payment karta hai
  → screenshot ImgBB pe upload karta hai
  → sd_requests / premiumRequests table mein save
  → Admin approve karta hai
  → Diamonds/Premium manually credited
```

---

### 🌐 FREE FIRE / BGMI API

**Status:** NO API KEY — bahut limited data milti hai

**Jo milta hai FREE Fire se:**
- Player username (IGN) — via login
- Player UID — via login
- Rank (from match result screenshot OCR)
- Kills (from match result screenshot OCR)

**Jo NAHI milta (API key nahi hai):**
- Live match data
- Player stats
- Tournament data
- Real-time rankings

**Workaround:** Admin manually match results enter karta hai admin panel mein.

---

### 🔤 GOOGLE FONTS

**Fonts used:**
```
Inter: 400, 500, 600, 700, 800, 900  ← Body text, UI elements
Syne: 700, 800                        ← Headings, titles

Admin Panel additionally:
Rajdhani: 400, 500, 600, 700          ← Admin body
Orbitron: 400, 500, 600, 700, 800, 900 ← Admin headings (gaming aesthetic)
```

---

### 🎨 FONT AWESOME 6.5.1

**Kisliye:** All icons throughout the app

**CDN:** `https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css`

**Important:** Only FREE icons use karo. Pro icons (fa-sword etc.) nahi chalenge.

**Common icons used:**
```
fas fa-gamepad      ← Games
fas fa-trophy       ← Rankings
fas fa-users        ← Squads/Friends
fas fa-shield-alt   ← Clan War
fas fa-graduation-cap ← Mentor
fas fa-coins        ← Coins
fas fa-spinner fa-spin ← Loading
fas fa-sitemap      ← Bracket
fas fa-map          ← India Map
fas fa-check-circle ← Clean Badge
fas fa-id-card      ← Player Card
fas fa-user-friends ← Friends
fas fa-stream       ← Activity Feed
fas fa-times-circle ← Duel/Challenge
fas fa-city         ← City Championship
```

---

### 📦 SUPABASE JS SDK

**CDN:** `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js`
**Version:** v2 (UMD build)
**Loaded in:** `index.html` line 396

---

## 3. FILE STRUCTURE

```
USER PANEL (v17)/
├── index.html                 ← Entry point — ALL 80 scripts loaded here
├── styles.css                 ← Base CSS (925 lines) — layout, components, variables
├── style.css                  ← CSS upgrade layer (778 lines) — animations, special pills
├── manifest.json              ← PWA manifest
├── sw.js                      ← Service Worker (offline caching)
├── OneSignalSDKWorker.js      ← OneSignal push worker
│
├── js/                        ← Utility & patch layer (loaded after features)
│   ├── user-ui-v10.css        ← UI theme CSS (778 lines) — neon, glassmorphism
│   ├── green-diamond.png      ← 💎 Green Diamond currency icon
│   ├── features-user.js       ← Extra features: renderWalletStats, showCoinHistory, etc.
│   ├── fixes-v7.js            ← Bug fix batch v7
│   ├── fixes-v8.js            ← Bug fix batch v8 (showModal alias, boot patches)
│   ├── fixes-v9.js            ← Bug fix batch v9 (renderWallet upgrade, showClanHome)
│   ├── fix5-listener-manager.js ← Event listener manager, prevents duplicates
│   ├── fix6-offline-queue.js  ← Offline action queue
│   ├── fix8-lazy-loading.js   ← Lazy loading for images/screens
│   ├── fix9-toast-queue.js    ← Toast notification queue manager
│   ├── fix10-server-time-sync.js ← Sync app time with server
│   ├── fix12-push-notifications.js ← Push notification handlers
│   ├── security-patches.js    ← Rate limiting, self-exclusion, room confirm
│   ├── security.js            ← Additional security checks
│   ├── anti-cheat.js          ← Device fingerprinting, duplicate join prevention
│   ├── legal-compliance.js    ← MES: age gate, state ban, self-exclusion
│   ├── diamond-system.js      ← Green Diamond conversion rates, TDS config
│   ├── rank-system.js         ← RANK_TIERS definition, showHowRankWorks
│   ├── wallet-history.js      ← Enhanced wallet history rendering
│   ├── match-timer.js         ← Countdown timers on match cards
│   ├── match-result-detail.js ← Detailed match result view
│   ├── room-reveal.js         ← Room ID/password reveal animation
│   ├── quick-deposit.js       ← Sky Diamond purchase flow (startAdd override)
│   ├── offline-handler.js     ← Offline detection, banner
│   ├── referral-tracker.js    ← Referral dashboard, stats
│   ├── referral-system-fix.js ← Referral code fixes
│   ├── profile-card.js        ← Enhanced profile card
│   ├── smart-automations.js   ← Auto-run: check-in, reminders, combo streak
│   └── preview-mode.js        ← Demo/preview mode for screenshots
│
├── core/                      ← Core system files (load first)
│   ├── firebase.js            ← Firebase init + ALL global variables (U, UD, MT, etc.)
│   ├── db.js                  ← Supabase init (window._supa)
│   ├── db-bridge.js           ← Routes old db.ref() calls → Supabase
│   ├── bugfixes.js            ← $ = getElementById, early fixes
│   ├── utils.js               ← toast(), goBack(), fmtTime(), hasJ(), effSt(), isVO()
│   ├── router.js              ← navTo(), setST(), setCat(), setSpec()
│   ├── modal.js               ← openModal(), closeModal(), showModal(), applyState()
│   ├── header.js              ← updateHdr(), updateBell()
│   ├── auth.js                ← doGoogleLogin(), afterLogin(), showLogin(), showEmailLoginFallback()
│   ├── imgbb.js               ← uploadToImgBB(), uploadToImgBBBase64()
│   ├── listeners.js           ← boot() function, ALL data listeners
│   └── boot.js                ← Starts app, calls boot()
│
├── screens/                   ← UI screens (one per screen)
│   ├── home.js                ← renderHome(), renderSP(), mcHTML() match cards
│   ├── matches.js             ← renderMM() — My Matches tab
│   ├── join.js                ← cJoin(), doJoin(), _doJoinCore() — match entry
│   ├── room.js                ← showRP() — room ID/password reveal
│   ├── wallet.js              ← renderWallet(), startAdd(), startWd()
│   ├── rank.js                ← renderRank(), calcRk(), showAdJoinPopup()
│   ├── profile.js             ← renderProfile(), showClanHome()
│   ├── notifications.js       ← renderNotifs(), showCoinShop(), buyCoinPkg()
│   └── support.js             ← sendChat() — Firebase RTDB chat
│
└── features/                  ← Feature modules (27 files)
    ├── ads.js                 ← AdMob + web fallback + _adIsPremium()
    ├── app-config.js          ← Remote config (window.CFG) from Supabase
    ├── auto-squad.js          ← Auto squad matching queue
    ├── admin-badge.js         ← Admin user badge
    ├── battle-pass.js         ← 50-tier battle pass
    ├── bracket.js             ← Tournament bracket viewer [v17]
    ├── challenge.js           ← 1v1 Duel system [v17]
    ├── checkin-system.js      ← Pre-match check-in
    ├── city-championship.js   ← Monthly city vs city [v17]
    ├── clan-war.js            ← Weekly clan war [v17]
    ├── clan.js                ← Clan create/join/manage/chat
    ├── clean-badge.js         ← 30 clean matches = badge [v17]
    ├── friends.js             ← Friends + activity feed [v17]
    ├── growth.js              ← City LB, missions, achievements, cosmetics store
    ├── india-map.js           ← SVG India player map [v17]
    ├── match-history.js       ← Match history tab
    ├── mentor.js              ← Mentor-student (Premium2+ only) [v17]
    ├── player-card.js         ← Stylish shareable card + auto result card [v17]
    ├── premium-creator.js     ← Creator badge, commission dashboard
    ├── premium.js             ← Subscription (₹49/₹99/₹199)
    ├── seasonal-league.js     ← Season rankings
    ├── skill-matchmaking.js   ← Rank filter chips on home [v17]
    ├── spectator.js           ← Watch live matches
    ├── squad-bank.js          ← Clan GD pool → cosmetics [v17]
    ├── squad-finder.js        ← LFS system [v17]
    ├── streak.js              ← Win streak badges [v17]
    └── watch-earn.js          ← Watch spectate → earn coins


ADMIN PANEL (v15)/
├── index.html                 ← Entry point — 57 scripts loaded
├── admin-base.css             ← Base CSS (sidebar, cards, layout — 444 lines)
├── style.css                  ← UI upgrade CSS (458 lines)
├── green-diamond.png          ← 💎 Currency icon
└── js/
    ├── admin-ui-v10.css       ← Admin UI theme (458 lines)
    ├── admin-inline.js        ← MAIN admin file (showSection, loadTournaments, etc.)
    ├── fa-admin-v10.js        ← Admin features batch
    ├── fa-admin-v10-final.js  ← Admin features final batch
    ├── admin-fixes-v7.js      ← Admin bug fixes
    ├── fixes-admin-v9.js      ← Admin fixes v9
    ├── fa-growth-admin.js     ← Growth analytics admin
    ├── fa-app-settings.js     ← Remote config editor
    ├── fa-sponsored-system.js ← Sponsored prize management
    ├── admin-supabase-sync.js ← Admin ↔ Supabase sync
    ├── fix13-realtime-analytics.js ← Real-time dashboard
    ├── admin-activity-log.js  ← Admin action logging
    ├── admin-analytics.js     ← Analytics section
    ├── admin-chat-enhance.js  ← Enhanced chat tools
    ├── admin-live-dash.js     ← Live dashboard widgets
    ├── admin-notif-templates.js ← Notification templates
    ├── admin-player-lookup.js ← Player search/lookup
    ├── admin-roster.js        ← Team roster management
    ├── admin-scheduler.js     ← Match scheduler
    ├── imgbb.js               ← Image upload (same as user panel)
    └── features/              ← 31 admin feature files
        ├── fa22-match-result.js          ← Match result entry
        ├── fa27-anticheat-complete.js    ← Anti-cheat tools
        ├── fa28-fa43-fraud-control-center.js ← Fraud detection
        ├── fa44-fa52-final-admin-tools.js    ← Final admin tools
        ├── fa53-ocr-autofill.js          ← OCR screenshot reading
        ├── fa-legal-kyc-dispute.js       ← KYC & disputes
        ├── fa56-fa62-automation-bundle.js ← Automation batch 1
        ├── fa63-fa70-automation-bundle.js ← Automation batch 2
        ├── fa71-fa80-automation-bundle.js ← Automation batch 3
        └── fa-v17-features.js            ← v17: Bracket,ClanWar,CityChamp,Mentor,CleanBadge
```

---

## 4. SERVICES & ALL CREDENTIALS

| Service | File | Key/ID | Purpose |
|---------|------|--------|---------|
| Firebase RTDB | `core/firebase.js:15` | `AIzaSyA-v9AYigDrg96D_fos0vOW3wU2GY2UYec` | Chat + Analytics |
| Firebase Project | `core/firebase.js:18` | `fft-app-1e283` | Project ID |
| Supabase URL | `core/db.js:28` | `https://hddhkculuyrfoevxmlwy.supabase.co` | Database |
| Supabase Key | `core/db.js:29` | `eyJhbGci...T7po` | Anon key |
| ImgBB | `core/imgbb.js:11` | `c977a42da70cbc98fe176af64fbc484f` | Image uploads |
| AdMob App | `features/ads.js:21` | `ca-app-pub-1032532795123223~9674995485` | Ad app |
| AdMob Rewarded | `features/ads.js:22` | `ca-app-pub-1032532795123223/5092857849` | Match join ad |
| AdMob Interstitial | `features/ads.js:23` | `ca-app-pub-1032532795123223/7817221971` | Post-match ad |
| AdMob Banner | `features/ads.js:24` | `ca-app-pub-1032532795123223/9718498564` | Home banner |
| OneSignal | `index.html:32` | `9c00aa92-4577-484c-996d-4494e8c6afad` | Push notifications |
| UPI Payment | `features/premium.js:102` | `miniesports@upi` | Payments |

---

## 5. DATABASE — SUPABASE TABLES

### A. Core Tables

**`users`**
```
id              UUID PK     Firebase Auth UID
ign             TEXT        In-game name
ff_uid          TEXT        Free Fire UID
avatar_url      TEXT        ImgBB photo URL
city            TEXT        User city (City Championship)
coins           INT=0       Free coins (ads, check-in, referrals)
green_diamonds  INT=0       Won by winning → spend on cosmetics only
sky_diamonds    INT=0       Purchased with UPI → match entry only
rank_points     INT=0       Calculated from match performance
win_streak      INT=0       Consecutive wins (streak badges)
clean_matches   INT=0       Matches without reports (clean badge)
has_clean_badge BOOL=false  Clean Player Badge awarded
total_wins      INT=0
total_kills     INT=0
total_matches   INT=0
profile_status  TEXT        'pending' | 'approved' | 'rejected'
premium_level   INT=0       0=free, 1=Silver, 2=Gold, 3=Diamond
premium_expires TIMESTAMPTZ
is_banned       BOOL=false
clan_id         UUID FK     → clans.id
referral_code   TEXT        Unique referral code
referred_by     UUID FK     → users.id
```

**`matches`**
```
id              UUID PK
name            TEXT        "Summer Cup 2025"
game            TEXT        'freefire' | 'bgmi'
mode            TEXT        'solo' | 'duo' | 'squad'
entry_type      TEXT        'free' | 'coin' | 'sky_diamond' | 'ad'
entry_fee       INT=0       Amount in coins/SD
prize_type      TEXT        'green_diamonds' | 'coins'
prize_1st       INT=0
prize_2nd       INT=0
prize_3rd       INT=0
max_players     INT=100
status          TEXT        'upcoming' | 'live' | 'completed' | 'cancelled'
scheduled_at    TIMESTAMPTZ
room_id         TEXT        Released by admin
room_password   TEXT        Released by admin
rank_tier       TEXT='all'  'all' | 'Bronze' | 'Silver' | 'Gold' | 'Diamond'
rank_min        INT=0       Min RP required (optional)
rank_max        INT=9999    Max RP allowed (optional)
map             TEXT        Map name
created_by      UUID        Admin UID
```

**`join_requests`**
```
id              UUID PK
match_id        UUID FK     → matches.id
user_id         UUID FK     → users.id
ign             TEXT
ff_uid          TEXT
rank_points     INT
payment_proof   TEXT        ImgBB URL
status          TEXT        'pending' | 'approved' | 'rejected'
entry_type      TEXT
entry_fee       INT
created_at      TIMESTAMPTZ
```

**`notifications`**
```
id              UUID PK
user_id         UUID FK     → users.id
type            TEXT        See types list below
title           TEXT
body            TEXT
ref_id          TEXT        Related resource ID (nullable)
is_read         BOOL=false
created_at      TIMESTAMPTZ

Notification Types:
'match_room'        → Room ID released
'match_result'      → Results announced
'friend_add'        → Friend added
'squad_request'     → Squad invite
'duel_challenge'    → 1v1 challenge
'duel_accepted'     → Challenge accepted
'clan_war_challenge'→ Clan war challenge
'mentor_request'    → Student request
'mentor_accepted'   → Mentor accepted
'mentor_reward'     → GD reward for mentor
'clan_cosmetic'     → Clan cosmetic unlocked
'premium'           → Premium activated
'info'              → General info
```

**`wallet_transactions`**
```
id              UUID PK
user_id         UUID FK     → users.id
txn_type        TEXT        'credit' | 'debit'
amount          INT
currency        TEXT        'coins' | 'green_diamonds' | 'sky_diamonds'
reason          TEXT        Description
ref_id          TEXT        Match/request ID (nullable)
created_at      TIMESTAMPTZ
```

**`sd_requests`** (Sky Diamond purchase)
```
id              UUID PK
user_id         UUID FK
ign             TEXT
amount          INT         SD amount
inr_amount      INT         ₹ paid
payment_proof   TEXT        ImgBB URL
upi_ref         TEXT        UPI transaction ref
status          TEXT        'pending' | 'approved' | 'rejected'
reviewed_by     UUID        Admin UID
created_at      TIMESTAMPTZ
```

### B. Clan Tables

**`clans`**
```
id                      UUID PK
name                    TEXT UNIQUE
badge                   TEXT        Emoji
leader_id               UUID FK     → users.id
description             TEXT
total_members           INT=0
total_wins              INT=0
weekly_score            INT=0
is_private              BOOL=false
join_code               TEXT UNIQUE
squad_bank_gd           INT=0       Squad Bank GD pool
squad_bank_unlocked     JSONB={}    { item_id: { unlockedAt, unlockedBy } }
squad_bank_contributors JSONB={}    { uid: { ign, gd } }
```

**`clan_members`**
```
id          UUID PK
clan_id     UUID FK
user_id     UUID FK
role        TEXT    'leader' | 'co-leader' | 'member'
joined_at   TIMESTAMPTZ
```

**`clan_messages`**
```
id          UUID PK
clan_id     UUID FK
user_id     UUID FK
ign         TEXT
message     TEXT
created_at  TIMESTAMPTZ
```

### C. Feature Tables (v17)

**`squad_finder`**
```
id          UUID PK
uid         UUID UNIQUE     One LFS per user
ign         TEXT
rank_pts    INT
rank_tier   TEXT
mode        TEXT            'Solo' | 'Duo' | 'Squad' | 'Any'
role        TEXT            'Fragger' | 'Support' | 'IGL' | 'Entry' | 'Sniper'
lang        TEXT            'Hindi' | 'English' | 'Hinglish' | ...
note        TEXT
active      BOOL=true
expires_at  TIMESTAMPTZ     auto-expire after 3 hours
created_at  TIMESTAMPTZ
```

**`friendships`**
```
id          UUID PK
user1_id    UUID FK
user2_id    UUID FK
created_at  TIMESTAMPTZ
UNIQUE(user1_id, user2_id)
```

**`user_activities`**
```
id          UUID PK
uid         UUID FK
ign         TEXT
type        TEXT    'win'|'kill'|'rank_up'|'join'|'streak'|'clan'
text        TEXT
created_at  TIMESTAMPTZ
```

**`duel_challenges`**
```
id              UUID PK
challenger_id   UUID FK
challenger_ign  TEXT
challengee_id   UUID FK
challengee_ign  TEXT
mode            TEXT    'solo'|'duo'|'squad'
taunt           TEXT
status          TEXT    'pending'|'accepted'|'declined'|'completed'
result          TEXT    'challenger_win'|'challengee_win'|NULL
created_at      TIMESTAMPTZ
```

**`duel_records`**
```
id          UUID PK
user_id     UUID FK
opponent_id UUID FK
wins        INT=0
losses      INT=0
UNIQUE(user_id, opponent_id)
```

**`city_championship`**
```
id              UUID PK
city            TEXT
month           TEXT    '2025-05' format
score           INT=0   wins×10 + kills×1
wins            INT=0
kills           INT=0
player_count    INT=0
UNIQUE(city, month)
```

**`clan_wars`**
```
id              UUID PK
week            TEXT        '2025-05-12' (Monday date)
clan1_id        UUID FK
clan1_name      TEXT
clan2_id        UUID FK
clan2_name      TEXT
clan1_score     INT=0
clan2_score     INT=0
status          TEXT        'active'|'finished'
winner_id       UUID FK     → clans.id
created_at      TIMESTAMPTZ
```

**`clan_war_challenges`**
```
id          UUID PK
week        TEXT
from_clan   UUID FK
from_name   TEXT
to_clan     UUID FK
to_name     TEXT
status      TEXT    'pending'|'accepted'|'declined'
created_at  TIMESTAMPTZ
```

**`tournament_brackets`**
```
id          UUID PK
name        TEXT
format      TEXT    'Single Elimination'|'Double Elimination'|'Round Robin'
status      TEXT    'upcoming'|'live'|'finished'
team_count  INT
teams       JSONB   ["Team A", "Team B", ...]
rounds      JSONB   [{ name, matches: [{ team1, team2, winner }] }]
champion    TEXT
prize       TEXT
created_at  TIMESTAMPTZ
```

**`mentor_profiles`**
```
id                  UUID PK
uid                 UUID UNIQUE FK
ign                 TEXT
rank_pts            INT
rank_tier           TEXT
avatar_url          TEXT
speciality          TEXT
bio                 TEXT
active              BOOL=true
total_sessions      INT=0
total_students      INT=0
successful_students INT=0
gd_earned           INT=0
registered_at       TIMESTAMPTZ
```

**`mentor_requests`**
```
id                  UUID PK
mentor_id           UUID FK
mentor_ign          TEXT
student_id          UUID FK
student_ign         TEXT
student_rank_pts    INT
student_rank_badge  TEXT
message             TEXT
status              TEXT    'pending'|'accepted'|'declined'|'completed'
created_at          TIMESTAMPTZ
```

### D. Other Tables

**`battle_pass_progress`**, **`daily_checkins`**, **`watch_earn_log`**, **`mission_progress`**,
**`user_achievements`**, **`user_cosmetics`**, **`leaderboard`**, **`rank_history`**,
**`rank_seasons`**, **`referrals`**, **`sponsored_prizes`**, **`sponsored_prize_claims`**,
**`support_tickets`**, **`support_messages`**, **`creator_applications`**,
**`auto_squad_queue`**, **`app_settings`**, **`active_matches`**

---

## 6. FIREBASE RTDB — ONLY 3 CHEEZEIN

```
Firebase RTDB ko SIRF in paths ke liye use karo:

1. SUPPORT CHAT:
   support/{ticketId}/messages/{msgId}
   → File: screens/support.js

2. FIREBASE ANALYTICS:
   → Auto-collected, no manual code needed

3. FIREBASE CRASHLYTICS:
   → Auto-collected, no manual code needed

SPECIAL CASES (DB Bridge handles):
anti-cheat.js uses:
   deviceJoins/{deviceId}/{matchId}     ← device duplicate check
   joinRequests/{id}/deviceMeta         ← join metadata

security-patches.js uses:
   users/{uid}/selfExcluded              ← self-exclusion check
   users/{uid}/selfExcludedTill          ← exclusion expiry

app-config.js uses Firebase as FALLBACK ONLY:
   appSettings/liveConfig               ← if Supabase unavailable
   appSettings/tdsConfig                ← TDS tax rates
   appSettings/diamondPackages          ← SD packages

NOTE: db-bridge.js automatically routes all other db.ref() calls
to Supabase. Only paths above actually use Firebase RTDB.
```

---

## 7. ALL FEATURES — KAHAN KYA HAI

| Feature | File | Entry Point | Database |
|---------|------|-------------|----------|
| Match Listing | `screens/home.js` | Auto-load | Supabase `matches` |
| Match Join | `screens/join.js` | `cJoin(id)` | Supabase `join_requests` |
| Room Reveal | `screens/room.js` | Auto (when room released) | Supabase `matches` |
| Wallet | `screens/wallet.js` | Nav: Wallet | Supabase `wallet_transactions` |
| Rank/Leaderboard | `screens/rank.js` | Nav: Rank | Supabase `leaderboard` |
| Profile | `screens/profile.js` | Nav: Profile | Supabase `users` |
| Notifications | `screens/notifications.js` | Bell icon | Supabase `notifications` |
| Support Chat | `screens/support.js` | Profile menu | **Firebase** `support/` |
| Ads | `features/ads.js` | Auto-inject | AdMob SDK |
| App Config | `features/app-config.js` | Auto-load | Supabase `app_settings` |
| Battle Pass | `features/battle-pass.js` | `showBattlePass()` | Supabase `battle_pass_progress` |
| Clan | `features/clan.js` | `showClanHome()` | Supabase `clans`, `clan_members` |
| Check-In | `features/checkin-system.js` | `doCheckIn()` | Supabase `daily_checkins` |
| Watch & Earn | `features/watch-earn.js` | `watchAdForCoins()` | Supabase `watch_earn_log` |
| Auto Squad | `features/auto-squad.js` | Pill | Supabase `auto_squad_queue` |
| Seasonal League | `features/seasonal-league.js` | Pill | Supabase `rank_seasons` |
| Premium | `features/premium.js` | `showPremiumUpgrade()` | Supabase `users` |
| Spectator | `features/spectator.js` | Pill | Supabase `active_matches` |
| Match History | `features/match-history.js` | Profile tab | Supabase `join_requests` |
| Achievements | `features/growth.js` | `showAchievements()` | Supabase `user_achievements` |
| Cosmetics | `features/growth.js` | `showCosmeticsStore()` | Supabase `user_cosmetics` |
| Missions | `features/growth.js` | `showMissionsPanel()` | Supabase `mission_progress` |
| City LB | `features/growth.js` | `showCityLeaderboard()` | Supabase `leaderboard` |
| **Squad Finder** | `features/squad-finder.js` | `showSquadFinder()` | Supabase `squad_finder` |
| **Friends** | `features/friends.js` | `showFriends()` | Supabase `friendships` |
| **1v1 Duel** | `features/challenge.js` | `sendDuelChallenge()` | Supabase `duel_challenges` |
| **Player Card** | `features/player-card.js` | `showPlayerCard()` | Supabase `users` |
| **Win Streak** | `features/streak.js` | Auto (header badge) | Supabase `users.win_streak` |
| **City Champ** | `features/city-championship.js` | `showCityChampionship()` | Supabase `city_championship` |
| **Clean Badge** | `features/clean-badge.js` | `showCleanBadgeStatus()` | Supabase `users.clean_matches` |
| **Bracket** | `features/bracket.js` | `showBracket()` | Supabase `tournament_brackets` |
| **Squad Bank** | `features/squad-bank.js` | `showSquadBank()` | Supabase `clans.squad_bank_*` |
| **Mentor** | `features/mentor.js` | `showMentorHub()` | Supabase `mentor_profiles` |
| **Clan War** | `features/clan-war.js` | `showClanWar()` | Supabase `clan_wars` |
| **India Map** | `features/india-map.js` | `showIndiaMap()` | Supabase `city_championship` |
| **Rank Filters** | `features/skill-matchmaking.js` | Auto (filter chips) | Supabase `matches` |

---

## 8. GLOBAL VARIABLES & CORE FUNCTIONS

### Global Variables (all in `firebase.js`)

```javascript
U             // Firebase Auth User object (null = not logged in)
UD            // User data object from Supabase users table
MT            // All matches {} — key = matchId
JR            // Join requests {} — key = matchId
NOTIFS        // Notifications array []
WH            // Wallet history []
REFS          // Referrals []
TXNS          // Transactions []
PAY           // Payment data {}
prevMTKeys    // Previous match keys (for change detection)
curScr        // Current screen string ('home', 'wallet', etc.)
prevScr       // Previous screen
hSF           // Home status filter ('upcoming', 'live', 'completed')
hCF           // Home category filter ('paid', 'free', 'ad')
mmSF          // My Matches status filter
db            // Firebase RTDB instance (for chat ONLY)
spType        // Special tab type
cdInt         // Countdown interval
partnerCache  // Partner data cache {}
```

### Core Functions Quick Reference

```javascript
// ── Navigation ──
navTo('wallet')             // Go to screen
setST('upcoming')           // Status tab filter
setCat('free')              // Category filter
goBack()                    // Previous screen

// ── Modal ──
openModal('Title', '<html>') // Open modal
closeModal()                  // Close modal
showModal('Title', '<html>') // Alias of openModal

// ── Notifications ──
toast('Message', 'ok')      // Green toast
toast('Error!', 'err')      // Red toast
toast('Info')               // Default toast

// ── Header ──
updateHdr()                 // Refresh coins/GD/SD display

// ── Utilities ──
$(id)                       // document.getElementById(id)
hasJ(matchId)               // true if user joined this match
effSt(matchObj)             // Get effective match status
fmtTime(timestamp)          // Format to readable time
isVO()                      // true if profile verification pending
titleCase(str)              // "hello world" → "Hello World"

// ── Activity ──
logActivity('win', 'Won!')  // Log to user_activities table
```

### UD Object Structure
```javascript
window.UD = {
  // From Supabase users table
  id: 'uuid',
  ign: 'PlayerName',
  ff_uid: '123456789',
  avatar_url: 'https://i.ibb.co/...',
  city: 'Mumbai',
  coins: 500,
  green_diamonds: 150,
  sky_diamonds: 20,
  rank_points: 750,
  win_streak: 3,          // Added by streak.js + listeners.js
  clean_matches: 15,
  has_clean_badge: false,
  total_wins: 45,
  total_kills: 380,
  total_matches: 90,
  profile_status: 'approved',
  premium_level: 2,        // 0=free, 1=Silver, 2=Gold, 3=Diamond
  is_banned: false,
  clan_id: 'uuid',
  
  // Computed by listeners.js
  premium: {
    tier: 2,               // = premium_level
    expiresAt: 1234567890  // Unix ms
  },
  premiumLevel: 2,         // Alias for features
  
  // Computed by features
  _winStreak: 3,           // = win_streak
  _cleanRecord: { cleanMatches: 15, hasBadge: false }
}
```

---

## 9. CURRENCY & ECONOMY SYSTEM

```
┌─────────────────────────────────────────────────────────────┐
│  3 CURRENCIES — ALL VIRTUAL, NO REAL MONEY VALUE           │
├────────────┬──────────────┬────────────────┬───────────────┤
│ Currency   │ Earn         │ Spend          │ Real Money?   │
├────────────┼──────────────┼────────────────┼───────────────┤
│ 🪙 Coins   │ Watch ads    │ Coin matches   │ ❌ NO         │
│            │ Daily check-in│ Battle Pass   │               │
│            │ Referrals    │ Coin shop items│               │
│            │ Missions     │                │               │
├────────────┼──────────────┼────────────────┼───────────────┤
│ 💎 Green   │ WIN matches  │ Cosmetics ONLY │ ❌ NO         │
│ Diamonds   │ (ONLY source)│ (skins/badges) │               │
│            │              │ Squad Bank     │               │
├────────────┼──────────────┼────────────────┼───────────────┤
│ 🔷 Sky     │ BUY with UPI │ SD match entry │ ✅ Purchase   │
│ Diamonds   │ (₹ → SD)    │ ONLY           │ only          │
└────────────┴──────────────┴────────────────┴───────────────┘

IMPORTANT RULES (Halal compliance):
- Green Diamonds = ZERO real money value
- Coins CANNOT be purchased with money
- NO real money withdrawal ever
- Sky Diamonds only spent on match entry (not withdrawable)
```

---

## 10. RANK SYSTEM

**File:** `js/rank-system.js`

```javascript
window.RANK_TIERS = [
  { name: 'Bronze',   min: 0,    max: 300,  emoji: '🏅', color: '#cd7f32' },
  { name: 'Silver',   min: 301,  max: 600,  emoji: '🥈', color: '#c0c0c0' },
  { name: 'Gold',     min: 601,  max: 1000, emoji: '🥇', color: '#ffd700' },
  { name: 'Platinum', min: 1001, max: 1500, emoji: '🔷', color: '#e0e0ff' },
  { name: 'Diamond',  min: 1501, max: 2000, emoji: '💎', color: '#00d4ff' },
  { name: 'Legend',   min: 2001, max: 9999, emoji: '👑', color: '#b964ff' }
];
```

**Rank Points Formula (from `rank.js`):**
```
Weekly Reset every Monday
Season Reset every 1st of month

Points per match:
  1st place: +25 pts
  2nd place: +15 pts
  3rd place: +10 pts
  Top 10:    +5 pts
  Others:    +1 pt (participation)
  Per kill:  +1 pt

Bonus:
  5-kill match: +3 pts
  10-kill match: +7 pts
  Team wipe:    +5 pts
```

---

## 11. PREMIUM TIERS

**File:** `features/premium.js`

| Tier | Price | Label | GD Bonus | Key Benefits |
|------|-------|-------|----------|--------------|
| 0 | ₹0 | Free | 0 | Basic, ads shown |
| 1 | ₹49/month | 🥈 Silver | +5 GD | No ads, Silver badge |
| 2 | ₹99/month | 🥇 Gold | +15 GD | T1 + Mentor access, private matches |
| 3 | ₹199/month | 💎 Diamond | +35 GD | T2 + early access, exclusive theme |

**Check premium in code:**
```javascript
var ud = window.UD || {};
var tier = Number(ud.premium_level || ud.premiumLevel || (ud.premium && ud.premium.tier) || 0);
var isActive = tier > 0 && ud.premium && ud.premium.expiresAt > Date.now();

// Examples:
if (tier >= 1) { /* Silver or above */ }
if (tier >= 2) { /* Gold or above — Mentor eligible */ }
if (tier >= 3) { /* Diamond only */ }
```

**Payment flow:**
```
User → showPremiumUpgrade()
     → Selects tier
     → Screenshots UPI payment
     → Uploads via ImgBB
     → premiumRequests Firebase node → Admin approves
     → Admin credits premium_level in Supabase users table
```

---

## 12. AD SYSTEM — ADMOB

**File:** `features/ads.js`

```
3 AD TYPES:
┌─────────────────┬────────────────────────────┬──────────────────┐
│ Type            │ When                        │ Coins Reward     │
├─────────────────┼────────────────────────────┼──────────────────┤
│ Rewarded        │ "Watch Ad" to join Ad Match │ 10 coins (CFG)   │
│ Interstitial    │ After match ends            │ No reward        │
│ Banner          │ Home screen (always visible)│ No reward        │
└─────────────────┴────────────────────────────┴──────────────────┘

CONFIG (from window.CFG):
  adCoinsPerWatch: 10      ← coins per rewarded ad view
  adDailyLimit: 5          ← max ads per day
```

---

## 13. PUSH NOTIFICATIONS — ONESIGNAL

**Sending notification from code:**
```javascript
// In-app notification (Supabase notifications table):
window._supa.from('notifications').insert({
  user_id: targetUid,
  type: 'info',
  title: '🎯 Title',
  body: 'Message text',
  ref_id: null,
  is_read: false
});

// Push notification → use OneSignal Dashboard or REST API
// POST https://onesignal.com/api/v1/notifications
// Header: Authorization: Basic <REST_API_KEY>
// Body: { app_id, filters: [{field:'tag',key:'uid',value:targetUid}], headings, contents }
```

---

## 14. REMOTE CONFIG SYSTEM (CFG)

**File:** `features/app-config.js`
**Source:** Supabase `app_settings` table (key = 'live_config')

All defaults (admin can override from dashboard):
```javascript
window.CFG = {
  commission: 0.15,              // Platform commission (15%)
  roomReleaseMins: 10,           // Room details release before match
  matchReminderMins: 30,         // Match reminder notification
  autoSquadEnabled: 1,
  autoSquadTimeout: 15,          // Minutes to wait for squad
  checkInEnabled: 1,
  checkInOpenMins: 30,           // Check-in opens 30 min before
  checkInCloseMins: 5,           // Check-in closes 5 min before
  watchEarnEnabled: 1,
  watchCoinsPerInterval: 2,      // Coins per interval
  watchIntervalMins: 5,          // Interval duration
  watchDailyLimitMins: 30,       // Max watching per day
  seasonName: 'Season 1',
  seasonActive: 1,
  shareCoins: 20,                // Coins for sharing
  missions: {
    daily_login: 5,
    daily_match: 10,
    daily_kills3: 5,
    daily_checkin: 5,
    week_5matches: 50,
    week_top3: 30,
    week_share: 20,
  },
  streakMilestones: {
    3:  { coins: 20,   badge: null },
    7:  { coins: 100,  badge: '🔥 Unstoppable' },
    14: { coins: 200 },
    30: { coins: 500,  badge: '⚡ Dedicated' },
    60: { coins: 1000 },
    100:{ coins: 2000, badge: '👑 Legend' },
  },
  referralJoinCoins: 50,
  referralSDBonusDiamonds: 10,
  referralMatchCoins: 30,
  premium: {
    prices:  { 1: 49,  2: 99,  3: 199  },
    bonuses: { 1: 50,  2: 150, 3: 400  }, // GD bonus on purchase
  },
  cosmetics: {
    frame_neon:   { name: 'Neon Frame',   price: 50  },
    frame_fire:   { name: 'Fire Frame',   price: 75  },
    frame_galaxy: { name: 'Galaxy Frame', price: 100 },
    frame_gold:   { name: 'Gold Champion',price: 150 },
    tag_beast:    { name: '⚡ BEAST MODE',price: 30  },
    tag_pro:      { name: '🎯 PRO PLAYER',price: 30  },
    tag_king:     { name: '👑 KING',      price: 50  },
    vip_slot:     { name: 'VIP Slot Pass',price: 200 },
  },
  adCoinsPerWatch: 10,
  adDailyLimit: 5,
  checkinCoins: 5,
  checkinStreakBonus7: 50,
};
```

**To change config:** Admin Panel → Settings → Live Config JSON editor

---

## 15. SECURITY SYSTEM

**File:** `js/security-patches.js`

```
5 Security Patches Applied:

1. JOIN RATE LIMIT
   - Max 1 join per 4 seconds
   - Prevents bot scripts from spamming joins
   - window.doJoin patched with cooldown check

2. SELF-EXCLUSION LIVE DB CHECK  
   - Respite from gambling (user-initiated break)
   - Checks Firebase DB directly (not cached UD)
   - If exclusion active → blocks join + shows message

3. OFFLINE MODE ROUTING
   - doJoin routes to Offline Queue when offline
   - Join syncs when back online

4. REFERRAL CODE LOCK
   - Referral code UI locked after first use
   - Prevents code change after benefit claimed

5. ROOM CONFIRM ENFORCEMENT
   - Must confirm room before prize claim
   - Prevents prize fraud
```

---

## 16. LEGAL COMPLIANCE (MES)

**File:** `js/legal-compliance.js`
**Trigger:** `window.mesInit()` — called after login

```
MES = Mature Event System
Handles legal requirements:

1. STATE CHECK (mesCheckState)
   Shows state selector on first use
   Banned states shown with warning
   Allowed states proceed normally

2. AGE GATE (mesAgeGate)
   User must confirm 18+ age
   Stored in sessionStorage

3. SELF-EXCLUSION (mesCheckExclusion)
   User can set a break period
   During break: all match joins blocked
   Async check against Firebase (not cached)

4. LEGAL FOOTER (mesLegalFooter)
   Added to payment screens
   Terms & conditions text
```

---

## 17. REFERRAL SYSTEM

**File:** `js/referral-tracker.js`

```
How it works:
1. Every user gets a unique referral code (first 8 chars of UID)
2. New user signs up with referral code
3. Referrer gets coins when referred user joins first match
4. Referrer gets SD bonus when referred user buys Sky Diamonds

Rewards (from CFG):
  referralJoinCoins: 50          ← when referred user joins
  referralSDBonusDiamonds: 10    ← when referred user buys SD
  referralMatchCoins: 30         ← when referred plays 3 matches

Data: Firebase referrals/{uid} + Supabase referrals table
```

---

## 18. WATCH & EARN SYSTEM

**File:** `features/watch-earn.js`

```
How it works:
1. User watches a live match as spectator
2. Every 5 min (watchIntervalMins) = +2 coins (watchCoinsPerInterval)
3. Daily limit: 30 min max watching (watchDailyLimitMins)
4. Uses Firebase for spectator presence tracking
5. Coins credited to Supabase users.coins

Entry: watchAdForCoins() or startWatching(matchId)
```

---

## 19. CHECK-IN SYSTEM

**File:** `features/checkin-system.js`

```
Pre-match check-in:
- Opens 30 min before match (checkInOpenMins)
- Closes 5 min before match (checkInCloseMins)
- Checked-in players get priority slot assignment
- Missing check-in = possible disqualification (admin discretion)

Daily check-in:
- Once per day
- Rewards: checkinCoins (5 by default)
- 7-day streak bonus: checkinStreakBonus7 (50 coins)
```

---

## 20. ANTI-CHEAT SYSTEM

**File:** `js/anti-cheat.js`

```
3 Mechanisms:

1. DEVICE FINGERPRINTING
   - Generates persistent device ID (localStorage)
   - Stores in Firebase: deviceJoins/{deviceId}/{matchId}
   - If same device joins same match twice → blocked
   - Catches account-switching cheaters

2. JOIN METADATA LOGGING
   - Records: deviceId, userAgent, timezone, screenRes, language
   - Stored on every join_request in Firebase
   - Admin can review suspicious joins

3. DOJOIN HOOK
   - anti-cheat checks run BEFORE join is submitted
   - If device already joined → shows error message
```

---

## 21. ADMIN PANEL — ALL SECTIONS

| Section ID | Title | What It Does |
|-----------|-------|-------------|
| `dashboard` | Dashboard | Overview stats, live counters |
| `tournaments` | Tournaments | Create/edit/delete matches |
| `results` | Match Results | Enter results, award prizes |
| `joinedPlayers` | Joined Players | View who joined which match |
| `users` | Users | Search, view, ban, message |
| `wallets` | Wallets | SD requests, approve/reject |
| `premiumRequests` | Premium | Premium subscription requests |
| `skyDiamondRequests` | SD Requests | Sky Diamond purchase approvals |
| `seasonPass` | Season Pass | Season pass management |
| `teams` | Teams | Team/duo registration |
| `attendance` | Attendance | Match check-in records |
| `support` | Support | Chat with users |
| `disputes` | Disputes | User complaints |
| `activity` | Activity Log | Admin action history |
| `settings` | Settings | Remote config editor |
| `analytics` | Analytics | Real-time analytics |
| `quicktools` | Quick Tools | Quick match creation |
| `matchResult` | Match Result | Quick result entry |
| `bracketAdmin` | Brackets | Tournament bracket management |
| `clanWarAdmin` | Clan Wars | War activation/resolution |
| `cityChampAdmin` | City Championship | Monthly standings |
| `mentorAdmin` | Mentors | Mentor management |
| `cleanBadgeAdmin` | Clean Badges | Badge management |

---

## 22. HOW TO ADD A NEW FEATURE

**Step 1:** Create `features/your-feature.js`

```javascript
/* ================================================================
   FEATURE NAME — short description
   Tables: supabase_table_name (columns you need)
================================================================ */
(function(){ 'use strict';

// Standard helpers (always use these)
function _s(){ return window._supa; }
function _uid(){ return window.U && window.U.uid; }
function _ud(){ return window.UD || {}; }

// Main entry function (window.X = accessible from HTML onclick)
window.showMyFeature = function() {
  if(!_uid()){ if(window.toast) toast('Pehle login karo', 'err'); return; }
  
  openModal('🎯 Feature Title', '<div id="myFeatContent"><div style="text-align:center;padding:20px;color:var(--txt2)"><i class="fas fa-spinner fa-spin"></i></div></div>');
  _loadData();
};

function _loadData() {
  if(!_s()) return;
  
  _s().from('your_table')
    .select('*')
    .eq('user_id', _uid())
    .order('created_at', { ascending: false })
    .limit(20)
    .then(function(r) { _render(r.data || []); })
    .catch(function(e) {
      var c = document.getElementById('myFeatContent');
      if(c) c.innerHTML = '<div style="color:#ff6b6b;text-align:center">Error loading</div>';
    });
}

function _render(data) {
  var c = document.getElementById('myFeatContent');
  if(!c) return;
  
  if(!data.length) {
    c.innerHTML = '<div style="text-align:center;padding:30px;color:var(--txt2)"><div style="font-size:36px;opacity:.3">🎯</div><p>Kuch nahi mila</p></div>';
    return;
  }
  
  var h = '<div style="display:flex;flex-direction:column;gap:8px">';
  data.forEach(function(item) {
    h += '<div style="padding:12px;border-radius:12px;background:var(--card);border:1px solid var(--border)">';
    h += '<div style="font-size:14px;font-weight:800">' + item.title + '</div>';
    h += '</div>';
  });
  h += '</div>';
  c.innerHTML = h;
}

// OPTIONAL: Special pill injection
var _c=0, _t=setInterval(function(){
  _c++; if(_c>60){ clearInterval(_t); return; }
  var row = document.querySelector('.special-pills');
  if(!row || row.querySelector('#_myPill')){ if(row) clearInterval(_t); return; }
  clearInterval(_t);
  var p = document.createElement('div');
  p.id = '_myPill'; p.className = 'special-pill';
  p.style.cssText = 'background:rgba(0,212,255,.08);border:1px solid rgba(0,212,255,.2);color:#00d4ff';
  p.innerHTML = '<i class="fas fa-star" style="font-size:11px"></i> My Feature';
  p.onclick = function(){ if(window.showMyFeature) showMyFeature(); };
  row.appendChild(p);
}, 400);

})();
```

**Step 2:** Add to `index.html` before `core/listeners.js`:
```html
<!-- v17 NEW FEATURES -->
<script src="features/your-feature.js"></script>
```

**Step 3:** Syntax check:
```bash
node --check features/your-feature.js
```

---

## 23. HOW TO ADD A NEW SUPABASE TABLE

```sql
-- 1. Create table
CREATE TABLE your_table (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID REFERENCES users(id) ON DELETE CASCADE,
  field1    TEXT,
  field2    INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable Row Level Security (REQUIRED)
ALTER TABLE your_table ENABLE ROW LEVEL SECURITY;

-- 3. Add policies
CREATE POLICY "read_own" ON your_table
  FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "insert_own" ON your_table
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "update_own" ON your_table
  FOR UPDATE USING (auth.uid()::text = user_id::text);

-- 4. Optional: index for performance
CREATE INDEX idx_your_table_user_id ON your_table(user_id);
CREATE INDEX idx_your_table_created ON your_table(created_at DESC);
```

---

## 24. COMMON CODE PATTERNS

### Loading State
```javascript
c.innerHTML = '<div style="text-align:center;padding:20px;color:var(--txt2)"><i class="fas fa-spinner fa-spin"></i></div>';
```

### Empty State
```javascript
c.innerHTML = '<div style="text-align:center;padding:30px;color:var(--txt2)"><div style="font-size:36px;opacity:.3">🎮</div><p style="font-size:13px">Kuch nahi mila</p></div>';
```

### Error State
```javascript
c.innerHTML = '<div style="color:#ff6b6b;text-align:center;padding:20px">Error loading. Dobara try karo.</div>';
```

### Send Notification to a User
```javascript
window._supa.from('notifications').insert({
  user_id: targetUid,
  type: 'info',
  title: '📢 Title Here',
  body: 'Message body text',
  ref_id: null,  // or related ID
  is_read: false
}).catch(function(){});
```

### Deduct Coins
```javascript
var cur = window.UD.coins || 0;
var amt = 10;
if(cur < amt){ toast('Coins kam hain', 'err'); return; }
window._supa.from('users').update({ coins: cur - amt }).eq('id', window.U.uid)
.then(function(){
  window.UD.coins = cur - amt;
  if(window.updateHdr) updateHdr();
  // Log transaction
  window._supa.from('wallet_transactions').insert({
    user_id: window.U.uid, txn_type: 'debit',
    amount: amt, currency: 'coins',
    reason: 'Feature name used'
  }).catch(function(){});
}).catch(function(e){ toast('Error', 'err'); });
```

### Award Green Diamonds
```javascript
var cur = window.UD.green_diamonds || 0;
var reward = 50;
window._supa.from('users').update({ green_diamonds: cur + reward }).eq('id', window.U.uid)
.then(function(){
  window.UD.green_diamonds = cur + reward;
  if(window.updateHdr) updateHdr();
  if(window.logActivity) logActivity('win', '💎 ' + reward + ' Green Diamonds mila!');
}).catch(function(){});
```

### Check Premium Level
```javascript
var ud = window.UD || {};
var tier = Number(ud.premium_level || ud.premiumLevel || (ud.premium && ud.premium.tier) || 0);
// tier: 0=free, 1=Silver, 2=Gold, 3=Diamond
if(tier < 2){ toast('Premium Gold required', 'err'); return; }
```

### Get Rank Tier
```javascript
function getRankTier(pts) {
  pts = Number(pts) || 0;
  if(pts >= 2001) return { name: 'Legend',   emoji: '👑', color: '#b964ff' };
  if(pts >= 1501) return { name: 'Diamond',  emoji: '💎', color: '#00d4ff' };
  if(pts >= 1001) return { name: 'Platinum', emoji: '🔷', color: '#e0e0ff' };
  if(pts >= 601)  return { name: 'Gold',     emoji: '🥇', color: '#ffd700' };
  if(pts >= 301)  return { name: 'Silver',   emoji: '🥈', color: '#c0c0c0' };
  return              { name: 'Bronze',  emoji: '🏅', color: '#cd7f32' };
}
```

### CSS Variables (use in inline styles)
```
--bg         #050507  Main background
--bg2                 Secondary background
--card                Card background
--card2               Input/field background
--txt        #fff     Primary text
--txt2       #7a7a8e  Muted/secondary text
--text-muted          Alias for --txt2
--border              Border color (rgba)
--green      #00ff6a  Accent green
--primary    #00ff6a  Primary actions (= --green)
--yellow     #ffd700  Yellow/gold
--red        #ff2e2e  Red/error
--blue       #00d4ff  Blue/info
--purple     #b964ff  Purple
--orange     #ff8c00  Orange
--b-glow              Neon glow color
```

---

## 25. DEPLOYMENT CHECKLIST

```
PRE-DEPLOY:
□ node --check karo all JS files — 0 errors
□ Firebase project ID correct: fft-app-1e283
□ Supabase URL correct: hddhkculuyrfoevxmlwy.supabase.co
□ ImgBB key valid: c977a42da70cbc98fe176af64fbc484f
□ AdMob App ID: ca-app-pub-1032532795123223~9674995485
□ OneSignal App ID: 9c00aa92-4577-484c-996d-4494e8c6afad
□ UPI ID: miniesports@upi
□ Firebase RTDB rules set (only support/ allowed)
□ Supabase RLS enabled on all tables
□ Supabase policies set for all tables
□ All v17 tables created in Supabase (see schema above)
□ OneSignalSDKWorker.js in root folder

PWA SETUP:
□ manifest.json icons in /icons/ folder
□ sw.js in root
□ HTTPS required (PWA)

ANDROID APK:
□ AdMob App ID set in AndroidManifest.xml
□ WebView bridge implements: showRewardedAd(), showInterstitial(), showBanner()
□ WebView calls: window.onAdRewarded() on success
```

---

## 26. TROUBLESHOOTING

| Problem | Likely Cause | Fix |
|---------|-------------|-----|
| **Custom/extra screen shows on startup** | Orphaned HTML outside `#loginScreen` div | Remove any HTML between `</div><!--loginScreen-->` and `<!-- HEADER -->` that has no parent container |
| **"Unsupported provider" Supabase error** | Old `signInWithIdToken({provider:'firebase'})` call | Use `DB.auth.syncFirebaseToken(user)` — see `core/db.js` |
| **Supabase queries fail after login** | `_supa` client still using anon token | Check `DB.auth.syncFirebaseToken` runs in `_handleSignIn` |
| **RLS fails after 1 hour** | Firebase token expired, Supabase not re-synced | `onIdTokenChanged` listener in `auth.js` handles this auto |
| Blank white screen | `styles.css` missing | Check file exists in root |
| Unstyled UI | `js/user-ui-v10.css` missing | Check file in `js/` folder |
| Login button dead | `doGoogleLogin` undefined | Check `core/auth.js` has alias |
| Firebase 403 error | RTDB rules too strict | Check RTDB security rules above |
| Supabase 401/403 | RLS missing or wrong policy | Add SELECT/INSERT policy |
| Ads not showing | `_adIsPremium()` wrong | Check `UD.premium_level` is set |
| Notifications missing | OneSignal App ID wrong | Check `index.html` line 32 |
| Image upload fails | ImgBB key expired | Get new key from imgbb.com |
| Mentor locked for Gold user | `premium_level` not set | Check `listeners.js` sets `UD.premium_level` |
| Squad Bank not saving | No `squad_bank_gd` column | Add columns to `clans` table |
| Win streak not tracking | `win_streak` column missing | Add to `users` table |
| Clean badge not awarding | `clean_matches` column missing | Add to `users` table |
| City Championship empty | `city_championship` table missing | Create table (see schema) |
| Duel records not saving | `duel_records` table missing | Create table (see schema) |
| Bracket not loading | `tournament_brackets` table missing | Create table (see schema) |
| Friends not working | `friendships` table missing | Create table (see schema) |
| Squad Finder empty | `squad_finder` table missing | Create table (see schema) |
| Admin sections missing | `fa-v17-features.js` not loaded | Check admin `index.html` |
| Modal black screen | `mainContent` hidden timing | Check `boot.js` and `auth.js` |

---

*Guide version: v26 | Update this file whenever new features are added or services change.*
*v26 changes: Auth flow fixed — Firebase Third-Party Auth correct method, orphaned onboarding screen removed*
