# 🎯 ASSET MAPPING MASTER PLAN — Title / Badge / Cosmetic / Premium / Season Pass
### (2026-10-10 · कोड-आधारित गहन विश्लेषण · Drive की 69 इमेजेज़)

---

## भाग A — कोड के 7 असली सिस्टम (सबूत सहित)

| # | सिस्टम | फ़ाइल/तालिका | क्या दे सकता है | स्थिति |
|---|---|---|---|---|
| 1 | **Rank System** | `js/rank-system.js` → `RANK_TIERS` + `getRankTier()` | 6 रैंक बैज: Bronze(0-300), Silver(301-600), Gold(601-1000), Platinum(1001-1500), Diamond(1501-2000), Legend(2001+). फ़ॉर्मूला: Wins×40 + Kills×2 + Matches×1 + WinStreak×10 | ✅ पूर्ण, ऑटो-डेराइव्ड |
| 2 | **Title System** | `features/match-history.js` → `showPlayerTitles()` | 16 फ़िक्स्ड टाइटल + `user_achievements.title_unlocked` से गतिशील टाइटल | ✅ पूर्ण + विस्तार-योग्य |
| 3 | **Premium** | `features/premium.js` → `PREMIUM_TIERS` | Silver ₹49 (लेवल 1) / Gold ₹99 (लेवल 2) / Diamond ₹199 (लेवल 3) — टियर बैज | ✅ पूर्ण |
| 4 | **Battle/Season Pass** | `features/battle-pass.js` + `battle_passes.tiers` (JSON, सर्वर-कस्टमाइज़ेबल) | 50 टियर: badges/tags, themes/frames, emoji packs, title (t50 Season Legend) | ✅ पूर्ण, हर सीज़न कस्टम |
| 5 | **Cosmetics Store + Inventory** | `features/growth.js` + `user_cosmetics` (cosmetic_key, is_equipped) | टाइप: frame (प्रोफ़ाइल फ़्रेम/ग्लो), tag (नाम-पट्टी), emoji, vip | ✅ पूर्ण |
| 6 | **Season League** | `seasonal_league_history` (season_name, final_tier, badge, reward) | सीज़न-अंत बैज | ✅ पूर्ण |
| 7 | **Top-3 Badges** | `js/rank-system.js` → `assignTop3Badges()` (`_top1/_top2/_top3`) | लीडरबोर्ड टॉप-3 विशेष बैज | ✅ पूर्ण |

**ट्रैक होने वाले स्टैट** (users + match_results): total_wins, total_kills, total_matches, win_streak, streak_days (login), clean_matches, has_clean_badge, rank_points, rank_history, level, exp, premium_level, is_vip, is_creator, tournament wins (placement=1 count), placement (हर मैच: 1/2/3...), kills (हर मैच), matches.mode (solo/duo/squad), coins/green_diamonds/sky_diamonds.

**ट्रैक न होने वाले** (FF गेम-टेलीमेट्री नहीं है): headshots, first-blood, MVP वोट, clutch, survival-time, assists.

---

## भाग B — 69 इमेजेज़ का पूरा मैपिंग निर्णय

### B1. रैंक बैज (6) — ✅ सीधे, कोड टियर से 1:1
| इमेज़ | श्रेणी | आधार | कोड |
|---|---|---|---|
| Bronze(Rank).png | रैंक बैज | rank_points 0–300 | ✅ सीधा |
| Silver(Rank).png | रैंक बैज | 301–600 | ✅ सीधा |
| Gold(Rank).png | रैंक बैज | 601–1000 | ✅ सीधा |
| Platinum(Rank).png | रैंक बैज | 1001–1500 | ✅ सीधा |
| Diamond(Rank).png | रैंक बैज | 1501–2000 | ✅ सीधा |
| Legend(Rank).png | रैंक बैज | 2001+ | ✅ सीधा |

### B2. प्रीमियम बैज (3) — ✅ सीधे, premium_level से
| इमेज़ | श्रेणी | आधार | कोड |
|---|---|---|---|
| file_...39fc71f5 (बेनाम, चाँदी-नीली ढाल ✓कला) | **Premium Silver Badge** | premium_level=1 (₹49) | ✅ सीधा — नाम दें |
| Premium Gold (Badge).png | प्रीमियम बैज | premium_level=2 (₹99) | ✅ सीधा |
| Premium Diamond (Badge).png | प्रीमियम बैज | premium_level=3 (₹199) | ✅ सीधा |
| ⚠️ Premium(Badge).png | **नाम ग़लत — कला REAPER है!** | → Reaper परिवार में जाएगा | ⚠️ देखें B4 |

### B3. टाइटल — (Title) नामित 16 — ✅ में से 2 सीधे, 14 विस्तार से
| इमेज़ | श्रेणी | आधार (शर्त) | कोड |
|---|---|---|---|
| Veteran(Title).png | टाइटल | total_wins ≥ 10 | ✅ सीधा (कोड में मौजूद) |
| Champion(Title).png | टाइटल | total_wins ≥ 50 | ✅ सीधा (कोड में मौजूद) |
| Unstoppable.png | टाइटल | win_streak ≥ 7 | ✅ सीधा (कोड में मौजूद) |
| Immortal(Title).png | टाइटल | wins ≥ 200 + clean_matches | ⚠️ विस्तार |
| Apex(Title).png | टाइटल | rank_points ≥ 5000 (Grandmaster स्लॉट) | ⚠️ विस्तार |
| Titan(Title).png | टाइटल | total_kills ≥ 1000 | ⚠️ विस्तार |
| Mythic(Title).png | टाइटल | wins ≥ 300 | ⚠️ विस्तार |
| Supreme(Title).png | टाइटल | rank_points ≥ 2500 | ⚠️ विस्तार |
| Cosmic(Title).png | टाइटल | level ≥ 50 | ⚠️ विस्तार |
| Infinity(Title).png | टाइटल | total_matches ≥ 1000 | ⚠️ विस्तार |
| Destroyer(Title).png | टाइटल | total_kills ≥ 2000 | ⚠️ विस्तार |
| Death Bringer (Title).png | टाइटल | total_kills ≥ 500 (Terminator स्लॉट) | ⚠️ विस्तार |
| Shadow Hunter (Title).png | टाइटल | total_kills ≥ 250 | ⚠️ विस्तार |
| Lone Wolf (Title).png | टाइटल | solo-mode wins ≥ 25 | ⚠️ विस्तार (mode-track होता है) |
| Arena King(Title).png | टाइटल | tournament placement=1 ≥ 25 | ⚠️ विस्तार |
| Phoenix(Title).png | टाइटल | comeback (हार-के-बाद-जीत) ≥ 10 | ⚠️ विस्तार (match-history से गणना) |
| Reaper(Title).png | टाइटल (वेरिएंट) | ऊपर के किसी टाइटल की कला | कला-वेरिएंट |
| Premium(Badge).png (⚠️ Reaper कला) | टाइटल/बैज वेरिएंट | Reaper परिवार की तीसरी कला | कला-वेरिएंट |

### B4. उपलब्धि बैज (plain-नामित ~22) — ⚠️/❌ मिश्रित
| इमेज़ | श्रेणी | आधार | कोड-स्थिति |
|---|---|---|---|
| Kill Machine.png | उपलब्धि बैज | total_kills ≥ 500 | ✅ विस्तार (स्टैट मौजूद) |
| Hunter.png | उपलब्धि बैज | total_kills ≥ 100 | ✅ विस्तार |
| God of War.png | उपलब्धि बैज | kills ≥ 500 + wins ≥ 50 | ✅ विस्तार |
| Win Streak.png | उपलब्धि बैज | win_streak ≥ 5 | ✅ विस्तार |
| Week warrior.png | उपलब्धि बैज | streak_days ≥ 7 (login-streak) | ✅ विस्तार |
| Grinder.png | उपलब्धि बैज | total_matches ≥ 250 | ✅ विस्तार (BP free-t50 में भी नाम) |
| Top 10.png | उपलब्धि बैज | placement ≤10 काउंट ≥ 50 | ✅ विस्तार (match_results) |
| Top 5.png | उपलब्धि बैज | placement ≤5 काउंट ≥ 25 | ✅ विस्तार |
| Podium Master.png | उपलब्धि बैज | placement ≤3 काउंट ≥ 15 | ✅ विस्तार (+ assignTop3Badges) |
| King of Arena.png | उपलब्धि बैज | placement=1 काउंट ≥ 25 | ✅ विस्तार |
| One Man Army.png | उपलब्धि बैज | solo wins ≥ 25 | ✅ विस्तार (mode) |
| MVP.png | उपलब्धि बैज | सीज़न में सबसे ज़्यादा #1 (placement) | ✅ विस्तार |
| Predator.png | उपलब्धि बैज | kills ≥ 150 + top-10 ≥ 30 | ✅ विस्तार |
| Rising Star.png | उपलब्धि बैज | level ≥ 25 | ✅ विस्तार (level/exp) |
| Elight Fighter.png (Elite) | उपलब्धि बैज | wins ≥ 25 | ✅ विस्तार |
| Legend Winner.png | उपलब्धि बैज | Legend टियर + wins ≥ 50 | ✅ विस्तार |
| Legend Born.png | उपलब्धि बैज | Legend टियर पहुँचना (2001 RP) | ✅ विस्तार |
| Rank Climber.png | उपलब्धि बैज | rank_history में +500 RP उछाल | ✅ विस्तार (rank_history) |
| Comeback King.png | उपलब्धि बैज | 3+ हार के बाद जीत ×5 | ✅ विस्तार (match-history अनुक्रम) |
| Immortal Player.png | उपलब्धि बैज | wins ≥ 100 + clean_matches ≥ 100 | ✅ विस्तार |
| Survivor.png | उपलब्धि बैज | नया अर्थ: clean_matches ≥ 200 (बिना रिपोर्ट) | ⚠️ अर्थ-गठन |
| Headshot King.png | उपलब्धि बैज | headshots — ट्रैक नहीं होते | ❌ अभी नहीं (केवल हाथ से) |
| First Blood.png | उपलब्धि बैज | पहला किल — ट्रैक नहीं | ❌ अभी नहीं (केवल हाथ से) |
| Clutch master. Png | उपलब्धि बैज | clutch राउंड — ट्रैक नहीं | ❌ अभी नहीं (केवल हाथ से) |

### B5. उच्च-श्रेणी क्रेस्ट/विशेष (4 named + 4 unnamed)
| इमेज़ | श्रेणी | आधार | कोड |
|---|---|---|---|
| Royal Legend.png | विशेष टाइटल/बैज | Legend टियर विशेष | ⚠️ विस्तार |
| Eternal Champion.png | विशेष टाइटल/बैज | wins ≥ 500 | ⚠️ विस्तार |
| The Conqueror.png | विशेष टाइटल/बैज | tournament wins ≥ 50 | ⚠️ विस्तार |
| file_...091c71f5 (बेनाम, लाल-सुनहरा रॉयल क्रेस्ट ✓कला) | **Season League चैम्पियन बैज** या Royal Legend कला | सीज़न #1 | ✅ season system |
| file_...209c71f5 (बेनाम, हरा महल-क्रेस्ट ✓कला) | **"King of Arena" बैज कला** (किला = arena-राज) | placement=1 ≥ 25 | ⚠️ विस्तार |
| file_...e00071f5 (बेनाम, तीन सुनहरी मूर्तियाँ ✓कला) | **Top-3 / Podium विशेष बैज** (assignTop3Badges) | leaderboard टॉप-3 | ✅ सीधा |
| file_...39fc71f5 (बेनाम, चाँदी ढाल ✓कला) | **Premium Silver Badge** (देखें B2) | premium_level=1 | ✅ सीधा |

### B6. सीज़न पास इनाम (सुझाव — battle_passes.tiers JSON में)
| स्लॉट | सुझाई इमेज़ | टियर उदाहरण |
|---|---|---|
| t50 Premium Title | Cosmic(Title).png / Infinity(Title).png | सीज़न लीजेंड की जगह |
| t40/45 Premium Badge | God of War.png / Predator.png | |
| t25 Premium Badge | King of Arena.png (छोटा संस्करण) | |
| Frames (t13/23/33/38/48) | profile image glow शैली के नए फ़्रेम (बनवाने होंगे) | Blue Flame आदि |
| Emoji packs (t8/18/28/35/43) | Fire.png वेरिएंट | |
| Free badges (t5/15/30/45) | Rising Star / Grinder / Elite Fighter / Top 10 | |

### B7. कॉस्मेटिक + आइकॉन
| इमेज़ | श्रेणी | आधार | कोड |
|---|---|---|---|
| profile image glow.png ✓कला | **कॉस्मेटिक — प्रोफ़ाइल फ़्रेम (frame)** | user_cosmetics + is_equipped; store में GD से या premium के साथ | ✅ सीधा |
| Fire.png | आइकॉन / इमोजी-पैक | "On Fire" टाइटल आइकॉन | ✅ |
| Crown.png | आइकॉन | Legend रैंक/👑 | ✅ |
| Trophy.png | आइकॉन | Winner टाइटल 🏆 | ✅ |
| Coin.png | आइकॉन | करेंसी | ✅ |
| Xp.png | आइकॉन | level/exp | ✅ |
| Diamond.png | आइकॉन | green/sky diamonds | ✅ |

---

## भाग C — "दे सकते हैं / नहीं दे सकते" (कोड-अंतिम)

✅ **सीधे दे सकते हैं (आज ही):** 6 रैंक बैज, 3 प्रीमियम बैज, Veteran/Champion/Unstoppable टाइटल, प्रोफ़ाइल-ग्लो फ़्रेम, Top-3 बैज (तीन-मूर्ति क्रेस्ट), सीज़न-लीग बैज।

⚠️ **विस्तार से दे सकते हैं (छोटा कोड + user_achievements/titles catalog):** ~21 उपलब्धि बैज + 14 नए टाइटल — सब शर्तें ऊपर दी हैं, स्टैट मौजूद हैं।

❌ **अभी नहीं दे सकते (स्टैट ट्रैक नहीं होते):** Headshot King, First Blood, Clutch Master, Survivor (गेम-टेलीमेट्री बिना) — ये केवल admin-मैनुअल (hand-granted) हो सकते हैं, या भविष्य में OCR/result-फ़ॉर्म में नए फ़ील्ड जोड़कर।

⚠️ **नाम-सावधानी:** "Premium(Badge).png" की कला REAPER है — Silver प्रीमियम के लिए बेनाम चाँदी ढाल (file_...39fc71f5) लें।
