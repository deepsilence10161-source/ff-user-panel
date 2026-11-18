/* ✅ D103 (owner order 14-Nov-2026): "Hindi, English dono mode ke liye perfect bana poori tarah"
   Lightweight global i18n applier — static UI leaves (nav, section titles, buttons, sheets)
   jo render-ternaries se cover nahi hote, unhe appLang ke hisaab se swap karta hai.
   EN⇄HI dono direction; text-node level (icon+text patterns bhi cover). */
(function () {
  'use strict';
  var EN2HI = {
    'Home': 'होम', 'Rank': 'रैंक', 'Matches': 'मैचेस', 'Wallet': 'वॉलेट', 'Profile': 'प्रोफ़ाइल',
    'My Titles': 'मेरे टाइटल', 'View all': 'सभी देखें', 'Season Pass': 'सीज़न पास',
    'My Clan': 'मेरा क्लैन', 'Join / Create': 'जॉइन / बनाएं', 'Live Stream': 'लाइव स्ट्रीम',
    'Setup': 'सेटअप', 'Cosmetics Store': 'कॉस्मेटिक्स स्टोर', 'Unlock': 'अनलॉक',
    'Polls': 'पोल्स', 'Vote': 'वोट', 'City Leaderboard': 'सिटी लीडरबोर्ड',
    'Refer & Earn': 'रेफ़र और कमाएं', 'Creator Program': 'क्रिएटर प्रोग्राम',
    'MY BADGES': 'मेरे बैज', 'My Badges': 'मेरे बैज', 'MY': 'मेरे', 'BADGES': 'बैज', 'Collection ›': 'कलेक्शन ›', 'Friends': 'दोस्त',
    'Apply': 'लगाएं', 'Skip': 'छोड़ें', 'Next': 'आगे', 'Next →': 'आगे →',
    'Finish': 'समाप्त', "Let's Play!": 'चलो खेलें!', "Let's Go!": 'चलो शुरू करें!',
    'Search': 'खोजें', 'Quick Tour': 'क्विक टूर', 'Welcome to Mini eSports!': 'mini eSports में स्वागत है!',
    'New Achievement!': 'नया अचीवमेंट!', 'Achievement Unlock!': 'अचीवमेंट अनलॉक!',
    'Achievement Bonus': 'अचीवमेंट बोनस', 'Battle Pass': 'बैटल पास',
    'Join →': 'जॉइन →', 'View Full History →': 'पूरी हिस्ट्री देखें →',
    'Leaderboard': 'लीडरबोर्ड', 'Notifications': 'सूचनाएं', 'Settings': 'सेटिंग्स',
    'Win Rate': 'विन रेट', 'Kills': 'किल्स', 'Wins': 'विंस', 'Earned': 'कमाई',
    'Best Placement': 'बेस्ट प्लेसमेंट', 'Avg Kills/Match': 'औसत किल्स/मैच',
    /* D103-UI polish (17-Nov): Hindi coverage deepen — home/match/wallet/detail leaves */
    'Buy Sky Diamonds': 'स्काई डायमंड खरीदें', 'Daily Check-In ›': 'डेली चेक-इन ›',
    'Earn Coins ›': 'सिक्के कमाएं ›', 'COINS': 'सिक्के', 'SKY DIAMOND BALANCE': 'स्काई डायमंड बैलेंस',
    'GREEN DIAMOND': 'ग्रीन डायमंड', 'Daily Missions': 'डेली मिशन्स',
    'ENTRY FEE': 'एंट्री फीस', 'PER KILL': 'प्रति किल', 'START TIME': 'शुरू का समय',
    'View Only': 'केवल देखें', 'Match Details': 'मैच विवरण', 'Playing As': 'खेल रहे हैं',
    'Share Match — Invite Friends': 'मैच शेयर करें — दोस्तों को बुलाएं',
    'Set Match Reminder': 'मैच रिमाइंडर लगाएं',
    'Room details will be shared before match start': 'रूम की जानकारी मैच शुरू होने से पहले मिलेगी',
    'Upcoming': 'आगामी', 'All Ranks': 'सभी रैंक', 'All': 'सभी', 'Paid': 'पेड',
    'Coin': 'सिक्का', 'Ad Free': 'बिना विज्ञापन',
    '1ST PRIZE': 'पहला इनाम', '2ND PRIZE': 'दूसरा इनाम', '3RD PRIZE': 'तीसरा इनाम',
    'Slots': 'स्लॉट्स', 'Creator Hosted': 'क्रिएटर होस्टेड', 'Tap for details': 'विवरण के लिए टैप करें',
    'Coin History': 'सिक्का हिस्ट्री', 'Transaction Summary': 'लेन-देन सारांश',
    'Logout': 'लॉग आउट', 'Sign Out': 'साइन आउट', 'Support': 'सपोर्ट',
    'Prize Breakdown': 'इनाम विवरण', 'Entry Fee': 'एंट्री फीस', 'Start Time': 'शुरू का समय',
    'Match Name': 'मैच का नाम', 'Mode': 'मोड', 'Map': 'मैप',
    /* D103-UI polish-2 (17-Nov): wallet leaves — exact node texts (DOM-probe se) */
    'Earn Coins': 'सिक्के कमाएं', 'Withdraw': 'निकासी', 'Summary': 'सारांश',
    'Transaction History': 'लेन-देन हिस्ट्री', 'Daily': 'डेली', 'Check-In': 'चेक-इन',
    'Buy Sky': 'स्काई डायमंड', 'Diamonds': 'खरीदें', 'Sponsored Prize': 'प्रायोजित इनाम',
    'Sponsor tournament se kamaya': 'स्पॉन्सर टूर्नामेंट से कमाया',
    'Match Winnings (total)': 'मैच जीत (कुल)',
    'Special Tournaments': 'स्पेशल टूर्नामेंट', 'Explore →': 'एक्सप्लोर →',
    'No upcoming matches': 'कोई आगामी मैच नहीं',
    'Sunday Special': 'संडे स्पेशल', 'Monthly Special': 'मंथली स्पेशल',
    'No Sunday Special matches': 'कोई संडे स्पेशल मैच नहीं',
    'Clan Leaderboard': 'क्लैन लीडरबोर्ड', 'Clan Chat': 'क्लैन चैट', 'Leave Clan': 'क्लैन छोड़ें',
    /* D103-UI polish-3 (17-Nov): home chips + match-card leaves (dbg-homechat-nodes se) */
    'All Ranks': 'सभी रैंक', '🎮 All': '🎮 सभी', '💰 Paid': '💰 पेड', '🪙 Coin': '🪙 कॉइन', '📺 Ad Free': '📺 ऐड फ्री',
    'ALL': 'सभी', 'COIN': 'कॉइन', '🎮 Creator Hosted': '🎮 क्रिएटर होस्टेड', 'Battle Royale': 'बैटल रॉयल',
    '1st PRIZE': 'पहला इनाम', '2nd PRIZE': 'दूसरा इनाम', '3rd PRIZE': 'तीसरा इनाम',
    'Entry Fee': 'एंट्री फीस', 'Per Kill': 'प्रति किल', 'Start Time': 'शुरू का समय', 'View Only': 'केवल देखें',
    'Support Team': 'सपोर्ट टीम', 'Online': 'ऑनलाइन',
    /* D103-UI polish-4 (17-Nov): modals (wd/add/shop/clan/notif) — dbg-modals-nodes se */
    'No notifications': 'कोई सूचनाएं नहीं',
    'Email Verify Karo': 'ईमेल सत्यापित करें', '📧 Verification Email Bhejo': '📧 सत्यापन ईमेल भेजें',
    '💎 Buy Sky Diamonds': '💎 स्काई डायमंड खरीदें',
    'Sky Diamonds se Paid matches khelo': 'स्काई डायमंड से पेड मैच खेलो',
    'withdraw nahi': 'निकासी नहीं', 'hota — sirf matches khelo!': 'हوتا — सिर्फ मैच खेलो!',
    'Starter': 'स्टार्टर', 'Popular': 'पॉपुलर', 'Value': 'वैल्यू', 'Mega': 'मेगा',
    '🏰 Clans': '🏰 क्लैन्स', '+ Clan Banao': '+ क्लैन बनाओ', 'Code se Join': 'कोड से जॉइन',
    '🔥 Top Clans': '🔥 टॉप क्लैन्स', 'Join': 'जॉइन',
    /* D103-UI polish-5 (17-Nov): match-detail modal (dbg-modals-nodes showDet) */
    '1st Prize': 'पहला इनाम', '2nd Prize': 'दूसरा इनाम', '3rd Prize': 'तीसरा इनाम',
    'Mark as Interested': 'रुचि दर्शाएं', '🎁 Gift Entry to Friend': '🎁 दोस्त को एंट्री गिफ्ट करें',
    /* D103-UI polish-6 (17-Nov): check-in + user-search modals */
    '📅 Check-in Streak': '📅 चेक-इन स्ट्रीक', '1-Day Streak!': '1-दिन स्ट्रीक!',
    'Aaj ka check-in bonus:': 'आज का चेक-इन बोनस:', '+🪙 5 Coins': '+🪙 5 सिक्के', 'Chalo! 🔥': 'चलो! 🔥',
    '🔍 Search Players': '🔍 प्लेयर्स खोजें', 'IGN ya FF UID se koi bhi player dhundo': 'IGN या FF UID से कोई भी प्लेयर ढूंढो',
    /* D103-UI polish-7 (17-Nov): profile leaves (dbg-profile-nodes se) */
    'Gold': 'गोल्ड', 'Gold+': 'गोल्ड+', 'Silver': 'सिल्वर', 'Diamond': 'डायमंड',
    'Copied! ✅': 'कॉपी हो गया! ✅', 'Copy failed': 'कॉपी विफल',
    /* D103-UI z36: avatar-bg picker labels (fixes-v9 BG_COLORS) */
    '🎨 Profile Icon Background': '🎨 प्रोफ़ाइल आइकॉन बैकग्राउंड',
    /* D103-UI z38: batch-2 modals (invite/profile-settings/uid/rules/tickets/suggestions/perf/asset-gallery) */
    'Tumhara Referral Code': 'तुम्हारा रेफरल कोड', '🏆 Top Inviters This Month': '🏆 इस महीने के टॉप इनवाइटर्स', 'Abhi koi referrals nahi — pehle bano! 🚀': 'अभी कोई रेफरल नहीं — पहले बनाओ! 🚀', '(prizes ke liye)': '(इनामों के लिए)',
    'Submit for Verification': 'वेरिफिकेशन के लिए सबमिट करें', 'Profile Verification': 'प्रोफ़ाइल वेरिफिकेशन', '⚙️ Settings': '⚙️ सेटिंग्स', 'Edit Profile': 'प्रोफ़ाइल एडिट करें',
    'Change Banner Photo': 'बैनर फोटो बदलें', 'Rules & Fair Play': 'नियम और फेयर प्ले', 'My Tickets & Replies': 'मेरे टिकट और जवाब', 'Legal & Compliance': 'कानूनी और अनुपालन',
    'Change Profile Photo': 'प्रोफ़ाइल फोटो बदलें', 'Payment Screenshot *': 'पेमेंट स्क्रीनशॉट *', 'Screenshot tap karke upload karo': 'स्क्रीनशॉट टैप करके अपलोड करो', 'Submit Payment & Request': 'पेमेंट सबमिट और रिक्वेस्ट करें',
    '🎫 My Tickets': '🎫 मेरे टिकट', 'Tumhare submitted tickets & admin replies': 'तुम्हारे सबमिटेड टिकट और एडमिन जवाब',
    '+ New Ticket': '+ नया टिकट', 'Koi ticket submit nahi hua': 'कोई टिकट सबमिट नहीं हुआ', 'Koi dikkat ho to "+ New Ticket" dabayein': 'कोई दिक्कत हो तो "+ नया टिकट" दबाएं', '💡 My Suggestions': '💡 मेरे सुझाव',
    '✍️ Naya Suggestion': '✍️ नया सुझाव', 'Submit Suggestion': 'सुझाव सबमिट करें', '📋 Meri Previous Suggestions': '📋 मेरे पिछले सुझाव', '📈 Performance Dashboard': '📈 परफॉर्मेंस डैशबोर्ड',
    '✅ UNLOCKED': '✅ अनलॉक्ड', 'Premium Gold': 'प्रीमियम गोल्ड', 'Premium Ribbon': 'प्रीमियम रिबन', 'Arena King': 'एरीना किंग',
    'Immortal': 'इमॉर्टल', 'Mythic': 'मिथिक', 'Shadow Hunter': 'शैडो हंटर', 'Death Bringer': 'डेथ ब्रिंगर',
    'Titan': 'टाइटन', 'Reaper': 'रीपर', 'Destroyer': 'डिस्ट्रॉयर', 'Supreme': 'सुप्रीम',
    'Apex': 'एपेक्स', 'Cosmic': 'कॉस्मिक', 'Infinity': 'इनफिनिटी', 'Lone Wolf': 'लोन वुल्फ',
    'Phoenix': 'फीनिक्स', 'Unstoppable': 'अनस्टॉपेबल', 'Hunter': 'हंटर', 'Predator': 'प्रेडेटर',
    'God of War': 'गॉड ऑफ वॉर', 'Elite Fighter': 'एलीट फाइटर', 'King of Arena': 'किंग ऑफ एरीना', '10+ comeback wins': '10+ कमबैक विंस',
    '7+ consecutive wins': '7+ लगातार विंस', '5+ consecutive wins': '5+ लगातार विंस', 'Legend tier + 50 wins': 'लेजेंड टियर + 50 विंस', '5+ comeback wins': '5+ कमबैक विंस',
    'Clan War winner badge': 'क्लैन वॉर विनर बैज',
    /* D103-UI z39: asset-gallery batch-3 + quick-rules LONG move */
    '50+ podium finishes (Top-3)': '50+ पोडियम फिनिश (टॉप-3)', 'Royal Legend': 'रॉयल लेजेंड', 'The Conqueror': 'द कॉन्करर', 'Top 10': 'टॉप 10',
    'Top 5': 'टॉप 5', 'Podium Master': 'पोडियम मास्टर', 'One Man Army': 'वन मैन आर्मी', 'Win Streak': 'विन स्ट्रीक',
    'Week Warrior': 'वीक वॉरियर', '7-day login streak': '7-दिन लॉगिन स्ट्रीक', 'Grinder': 'ग्राइंडर', 'Survivor': 'सर्वाइवर',
    'Rising Star': 'राइजिंग स्टार', 'Legend Born': 'लेजेंड बॉर्न', 'Rank Climber': 'रैंक क्लाइम्बर', 'Legend Winner': 'लेजेंड विनर',
    'Comeback King': 'कमबैक किंग', 'Leaderboard par Top-3 (asli position)': 'लीडरबोर्ड पर टॉप-3 (असली पोजीशन)', 'Crown': 'क्राउन', 'UI icon — Legend/king': 'UI आइकॉन — लेजेंड/किंग',
    'UI icon — Winner': 'UI आइकॉन — विनर', 'Currency icon': 'करेंसी आइकॉन', 'Fire': 'फायर',
    'Trophy': 'ट्रॉफी', 'On Fire / emoji-pack icon': 'ऑन फायर / इमोजी-पैक आइकॉन',
    '1️⃣ Profile me apna Free Fire IGN set karo': '1️⃣ प्रोफ़ाइल में अपना फ्री फायर IGN सेट करो', '2️⃣ Match join karo': '2️⃣ मैच जॉइन करो',
    '⬛ Default Dark': '⬛ डिफ़ॉल्ट डार्क', '🔵 Blue': '🔵 नीला', '🟣 Purple': '🟣 पर्पल', '🟢 Green': '🟢 हरा',
    '🔴 Red': '🔴 लाल', '🟠 Orange': '🟠 नारंगी', '⚫ Black': '⚫ काला', '🌌 Galaxy': '🌌 गैलेक्सी',
    '🌊 Ocean': '🌊 ओशन', '🔥 Fire': '🔥 फायर', '💎 Diamond': '💎 डायमंड', '🌸 Pink': '🌸 पिंक',
    '🔱 Warlord': '🔱 वारलॉर्ड', '⚔️ Slayer': '⚔️ स्लेयर', '💫 Elite': '💫 एलीट', '🎯 Sniper': '🎯 स्नाइपर',
    '🔥 Blaze': '🔥 ब्लेज़', '🌟 Star': '🌟 स्टार', '🎖️ Knight': '🎖️ नाइट',
    '💎 Sky': '💎 स्काई', '📉 Out': '📉 आउट', '📈 In': '📈 इन', '🪙 Coin': '🪙 कॉइन',
    '🏆 How Rank Works': '🏆 रैंक कैसे काम करता है', '🏆 How Rank Works 🏆': '🏆 रैंक कैसे काम करता है 🏆',
    'Starting Rank • Build Your Skills': 'शुरुआती रैंक • अपनी स्किल्स बनाओ', 'Show Your Improvement': 'अपनी बेहतरी दिखाओ',
    'Play Better • Climb Higher': 'बेहतर खेलो • ऊपर चढ़ो', 'Prove Your Consistency': 'अपनी निरंतरता साबित करो',
    'Elite Players • Top Performers': 'एलीट प्लेयर्स • टॉप परफॉर्मर्स', 'Elite प्लेयरs • Top Performers': 'एलीट प्लेयर्स • टॉप परफॉर्मर्स',
    'The Ultimate Rank • Be a Legend': 'अंतिम रैंक • लेजेंड बनो', 'Weekly reset': 'वीक्ली रीसेट', 'every Monday': 'हर सोमवार',
    'सीज़न reset': 'सीज़न रीसेट', 'every 1st of month': 'हर महीने की 1 तारीख को', 'Top 3 badges': 'टॉप 3 बैज', 'Top 10 titles': 'टॉप 10 टाइटल',
    '🏅 Achievements': '🏅 अचीवमेंट्स', 'Achievements Unlocked': 'अचीवमेंट्स अनलॉक', 'Max Level!': 'मैक्स लेवल!', 'Earn 💎50': '💎50 कमाओ',
    '🔒 Locked': '🔒 लॉक्ड', 'Refer 1 friend': '1 दोस्त रेफर करो', 'On Fire': 'ऑन फायर', '3 day streak': '3 दिन स्ट्रीक', 'High Roller': 'हाई रोलर',
    '🏆 Leaderboard': '🏆 लीडरबोर्ड', 'My City': 'मेरा शहर', '🆘 Help & Support': '🆘 सहायता और सपोर्ट', 'Online abhi': 'ऑनलाइन अभी',
    'Match Dispute': 'मैच विवाद', 'Support Chat': 'सपोर्ट चैट', 'Support Tickets': 'सपोर्ट टिकट्स', 'New ticket + admin replies': 'नया टिकट + एडमिन जवाब',
    'Feedback': 'फीडबैक', '🔑 Code se Join': '🔑 कोड से जॉइन',
    'Your Balance': 'आपका बैलेंस', 'Tags': 'टैग्स', '🎯 PRO PLAYER': '🎯 प्रो प्लेयर', '🎯 PRO PLAYER tag': '🎯 प्रो प्लेयर टैग',
    '👑 KING': '👑 किंग', '👑 KING tag': '👑 किंग टैग', 'VIP Slot Pass': 'VIP स्लॉट पास', '⭐ VIP badge apne profile par': '⭐ VIP बैज अपने प्रोफ़ाइल पर',
    '⚡ BEAST MODE': '⚡ बीस्ट मोड', '⚡ BEAST MODE tag': '⚡ बीस्ट मोड टैग', 'Jalti Fire border': 'जलती फायर बॉर्डर', 'Neon glow border': 'नीयॉन ग्लो बॉर्डर',
    'Galaxy purple glow': 'गैलेक्सी पर्पल ग्लो', 'Bronze Ring': 'ब्रॉन्ज़ रिंग', 'Gold Ring': 'गोल्ड रिंग', 'Platinum Ring': 'प्लेटिनम रिंग',
    'Legend Ring': 'लेजेंड रिंग', 'Premium Gold Ring': 'प्रीमियम गोल्ड रिंग',
    'Rank Ring — Bronze (avatar medal)': 'रैंक रिंग — ब्रॉन्ज़ (अवतार मेडल)', 'Rank Ring — Gold (avatar medal)': 'रैंक रिंग — गोल्ड (अवतार मेडल)',
    'Rank Ring — Platinum (avatar medal)': 'रैंक रिंग — प्लेटिनम (अवतार मेडल)', 'Rank Ring — Legend (avatar medal)': 'रैंक रिंग — लेजेंड (अवतार मेडल)',
    'Premium Ring — Gold (avatar medal)': 'प्रीमियम रिंग — गोल्ड (अवतार मेडल)', '🎖️ Starter Badge': '🎖️ स्टार्टर बैज',
    '💎 Cosmetics Store': '💎 कॉस्मेटिक्स स्टोर', 'बैटल पास reward': 'बैटल पास रिवॉर्ड', '🎫 सीज़न Pass reward': '🎫 सीज़न पास रिवॉर्ड',
    '🌟 Chosen One': '🌟 चुज़न वन', '🔥 Fire Pack': '🔥 फायर पैक', '⚡ Lightning Pack': '⚡ लाइटनिंग पैक', '🟣 Purple Haze Border': '🟣 पर्पल हेज़ बॉर्डर',
    '🎖️ Veteran': '🎖️ वेटेरन', '👑 Crown Pack': '👑 क्राउन पैक', '🌊 Ocean Wave Border': '🌊 ओशन वेव बॉर्डर', '⚡ Immortal': '⚡ इमॉर्टल',
    '🔴 Fire God Pack': '🔴 फायर गॉड पैक', '🌌 Galaxy Border': '🌌 गैलेक्सी बॉर्डर', '☠️ Reaper (सीज़न Legend)': '☠️ रीपर (सीज़न लेजेंड)',
    'Bronze Warrior': 'ब्रॉन्ज़ वॉरियर', '🎖️ Participant': '🎖️ पार्टिसिपेंट', '💪 Grinder': '💪 ग्राइंडर', '💀 Death Bringer': '💀 डेथ ब्रिंगर',
    'WinStreak×10': 'विनस्ट्रीक×10', '👑 My कलेक्शन (Titles + Badges) ➤': '👑 मेरा कलेक्शन (टाइटल्स + बैज) ➤',
    'Result/prize/room ki shikayat': 'रिज़ल्ट/प्राइज़/रूम की शिकायत', 'Admin se seedhi baat': 'एडमिन से सीधी बात', 'App sudhaar ke sujhav': 'ऐप सुधार के सुझाव',
    'बैटल पास सीज़न reward': 'बैटल पास सीज़न रिवॉर्ड',
    '💎 Unlock': '💎 अनलॉक', '🗳️ Vote': '🗳️ वोट',
    'Achievements': 'उपलब्धियां', 'Match History': 'मैच हिस्ट्री', 'Performance Stats': 'परफॉर्मेंस स्टैट्स',
    'Watch Live & Earn': 'लाइव देखें और कमाएं', '+2🪙/min': '+2🪙/मिनट',
    '👑 Premium Upgrade Karo': '👑 प्रीमियम अपग्रेड करो',
    '🏅 Badges Earned': '🏅 अर्जित बैज', 'First Match': 'पहला मैच', 'First match played': 'पहला मैच खेला',
    'Veteran': 'वेटेरन', 'Champion': 'चैंपियन', 'First win!': 'पहली जीत!', 'Dominator': 'डोमिनेटर',
    'Blade': 'ब्लेड', 'Kill Machine': 'किल मशीन', 'Pro Player': 'प्रो प्लेयर', 'Elite': 'एलीट',
    'Profile update pending admin approval...': 'प्रोफ़ाइल अपडेट एडमिन अप्रूवल के अधीन...',
    'You submitted:': 'आपने जमा किया:',
    'Admin will verify and approve these details': 'एडमिन इन विवरणों की जांच और स्वीकृति करेगा',
    'Complete karo!': 'पूरा करो!', '+ WhatsApp Number': '+ व्हाट्सएप नंबर', '+ Profile Photo': '+ प्रोफ़ाइल फोटो',
    'Performance Dashboard': 'परफॉर्मेंस डैशबोर्ड', '💡 Suggest a Feature': '💡 फीचर सुझाएं',
    /* D103-UI polish-8 (17-Nov): premium trial modal + public profile + voucher btn */
    '🎁 Free Trial': '🎁 फ्री ट्रायल', 'FREE Trial Milega!': 'फ्री ट्रायल मिलेगा!',
    'Silver Premium 3 din bilkul free try karo': 'सिल्वर प्रीमियम 3 दिन बिल्कुल फ्री ट्राई करो',
    '🚫 No Ads': '🚫 कोई ऐड नहीं', 'Silver Badge': 'सिल्वर बैज',
    '🖼️ Photo & Banner Change': '🖼️ फोटो और बैनर बदलें', '🎁 3 Din FREE Try Karo!': '🎁 3 दिन फ्री ट्राई करो!',
    'Seedha khareedna hai → Plans dekho': 'सीधा खरीदना है → प्लान्स देखो',
    'Platinum': 'प्लैटिनम', 'Win Rate:': 'विन रेट:', 'Redeem Voucher': 'वॉउचर रीडीम करें',
    /* D103-UI polish-9 (17-Nov): clan-create modal (qa2 se live dump) */
    '🏰 Clan Banao': '🏰 क्लैन बनाओ', 'Clan Name *': 'क्लैन नाम *', 'Tag (2-4 chars) *': 'टैग (2-4 अक्षर) *',
    'Emblem *': 'एम्बलम *', '🏰 Clan Banao!': '🏰 क्लैन बनाओ!',
    /* D103-UI polish-12 (17-Nov): login/countdown/notif-type/coin-shop leaves */
    'Days': 'दिन', 'Hours': 'घंटे', 'Mins': 'मिनट', 'Secs': 'सेकंड',
    'Pehla badge:': 'पहला बैज:', 'Dekho ›': 'देखो ›',
    '🎮 Quick Tour': '🎮 क्विक टूर', 'Matches Join Karo': 'मैच जॉइन करो',
    '100% Free — koi payment nahi chahiye': '100% फ्री — कोई पेमेंट नहीं चाहिए', 'Watch Ad': 'ऐड देखें',
    'Roz naye tasks poore karo, coins kamao': 'रोज़ नए टास्क पूरे करो, सिक्के कमाओ',
    '📡 No connection — data may be outdated': '📡 कोई कनेक्शन नहीं — डेटा पुराना हो सकता है',
    'India ka Halal Esports Platform': 'भारत का हलाल एस्पोर्ट्स प्लेटफॉर्म',
    'Free Fire Tournaments — Bilkul Free!': 'फ्री फायर टूर्नामेंट — बिल्कुल फ्री!',
    'Continue with Google': 'Google से जारी रखें', 'Logging in...': 'लॉग इन हो रहा है...',
    '🔒 Secure Google login · No password needed': '🔒 सुरक्षित Google लॉगिन · पासवर्ड जरूरी नहीं',
    'Loading your arena...': 'आपका एरीना लोड हो रहा है...',
    'daily_checkin': 'डेली चेक-इन', '🏆 Prize Won': '🏆 इनाम जीता',
    'Coins Kaise Kamao': 'सिक्के कैसे कमाएं',
    /* D103-UI polish-13 (17-Nov): earn-modal/maintenance/ad-footer leaves */
    'Rewarded Ad dekho →': 'रिवॉर्डेड ऐड देखो →', 'turant milenge': 'तुरंत मिलेंगे',
    'Daily 5 baar tak • Har din reset hota hai': 'डेली 5 बार तक • हर दिन रीसेट होता है',
    'Daily Check-In': 'डेली चेक-इन', 'Roz login karo →': 'रोज़ लॉगिन करो →', 'guaranteed': 'गारंटीड',
    'Referral': 'रेफरल', 'Dost ko invite karo →': 'दोस्त को इनवाइट करो →', 'dono ko': 'दोनों को',
    'Match Jeetna': 'मैच जीतना', 'Match results ke baad auto credit hota hai': 'मैच रिज़ल्ट के बाद ऑटो क्रेडिट होता है',
    'Coins = Free gaming currency.': 'सिक्के = फ्री गेमिंग करेंसी।',
    'Mini eSports — Tournament Platform': 'मिनी ईस्पोर्ट्स — टूर्नामेंट प्लेटफॉर्म',
    'Maintenance Mode': 'मेंटेनेंस मोड', 'Thodi der ki baat hai 🙏': 'थोड़ी देर की बात है 🙏',
    'Hum app ko aur behtar bana rahe hain.': 'हम ऐप को और बेहतर बना रहे हैं।',
    'India ka best Free Fire tournament platform!': 'भारत का बेस्ट फ्री फायर टूर्नामेंट प्लेटफॉर्म!',
    /* D103-UI polish-14 (17-Nov): maintenance overlay + verify banner */
    'Bas': 'बस', 'thodi der': 'थोड़ी देर', 'Auto check': 'ऑटो चेक',
    '🔄 Abhi Check Karo': '🔄 अभी चेक करो', '💬 Support se baat karo': '💬 सपोर्ट से बात करो',
    'Aapka data safe hai · Mini eSports': 'आपका डेटा सुरक्षित है · मिनी ईस्पोर्ट्स',
    '✔ Verify Now (30s)': '✔ अभी वेरिफाई करें (30 सेकंड)', 'Abhi nahi': 'अभी नहीं',
    /* D103-UI polish-15 (17-Nov): match status chips + empty states */
    '✅ Completed': '✅ पूर्ण', '🔴 Live': '🔴 लाइव', '🚫 Cancelled': '🚫 रद्द',
    'No completed matches': 'कोई पूर्ण मैच नहीं', 'No cancelled matches': 'कोई रद्द मैच नहीं', 'No live matches': 'कोई लाइव मैच नहीं',
    /* D103-UI polish-16 (17-Nov): result page + features-user labels/badges/toasts */
    'My Match Result': 'मेरा मैच रिज़ल्ट', 'Result copied!': 'रिज़ल्ट कॉपी हुआ!', 'Result data nahi mila': 'रिज़ल्ट डेटा नहीं मिला',
    'Rookie': 'रूकी', 'Green Diamond': 'ग्रीन डायमंड', 'Status': 'स्टेटस',
    'Earn/Match': 'कमाई/मैच', 'Earned': 'कमाया', 'Earnings': 'कमाई', 'Kills/Match': 'किल्स/मैच',
    'Free Fire UID': 'फ्री फायर UID', 'Event': 'इवेंट', 'FREE': 'फ्री',
    'Beginner': 'बिगिनर', 'High Flyer': 'हाई फ्लायर', 'First Blood': 'फर्स्ट ब्लड', 'Kill Proof': 'किल प्रूफ',
    'Influencer': 'इन्फ्लुएंसर', 'Fair Play': 'फेयर प्ले', 'Cheating': 'चीटिंग', 'Active': 'सक्रिय',
    'Chat sewa abhi uplabdh nahi': 'चैट सेवा अभी उपलब्ध नहीं', 'Copy failed': 'कॉपी विफल',
    'Description likhna zaroori hai': 'विवरण लिखना जरूरी है', 'FF UID not set!': 'FF UID सेट नहीं!',
    'Interest save nahi hua': 'इंटरेस्ट सेव नहीं हुआ', 'Interest sewa abhi uplabdh nahi': 'इंटरेस्ट सेवा अभी उपलब्ध नहीं',
    'Koi result nahi mila abhi': 'अभी कोई रिज़ल्ट नहीं मिला',
    /* D103-UI polish-17 (17-Nov): room-reveal labels/toasts */
    'Your Slot Number': 'आपका स्लॉट नंबर', 'Your Team Slots': 'आपकी टीम स्लॉट्स',
    'Host ne abhi room details nahi daale': 'होस्ट ने अभी रूम डिटेल नहीं डाले',
    'Pehle is match mein join karo': 'पहले इस मैच में जॉइन करो',
    'Room details abhi available nahi': 'रूम डिटेल अभी उपलब्ध नहीं',
    /* D103-UI polish-18 (17-Nov): compliance/checkout/clan-war/notif toasts+labels */
    'My Clan': 'मेरा क्लैन', 'Login karo': 'लॉगिन करो', 'WINNING': 'विनिंग', 'LOSING': 'लोज़िंग',
    'Aadhaar 12 digits hona chahiye': 'आधार 12 अंक होना चाहिए', 'Age verified!': 'उम्र सत्यापित!',
    'Checkbox tick karo': 'चेकबॉक्स टिक करो', 'Date of birth enter karo': 'जन्म तिथि दर्ज करो',
    'Dono checkboxes tick karo': 'दोनों चेकबॉक्स टिक करो', 'Full name enter karo': 'पूरा नाम दर्ज करो',
    'Match ID enter karo': 'मैच ID दर्ज करो', 'Please login first': 'पहले लॉगिन करें',
    'State save failed': 'स्टेट सेव विफल', 'Welcome to Mini eSports!': 'मिनी ईस्पोर्ट्स में स्वागत!',
    'Zyada detail do': 'ज़्यादा विवरण दो', 'Platform Owner': 'प्लेटफॉर्म ओनर',
    'Haryana': 'हरियाणा', 'Delhi': 'दिल्ली', 'Punjab': 'पंजाब', 'Other': 'अन्य',
    'Telangana': 'तेलंगाना', 'Andhra Pradesh': 'आंध्र प्रदेश', 'Tamil Nadu': 'तमिलनाडु',
    'Checkout open nahi hua': 'चेकआउट खुला नहीं', 'Login required': 'लॉगिन जरूरी',
    'Network error': 'नेटवर्क त्रुटि', 'Order create nahi ho saka': 'ऑर्डर बन नहीं सका',
    'Paytm SDK unavailable': 'पेटीएम SDK अनुपलब्ध', 'SDK load failed': 'SDK लोड विफल',
    'Invalid amount': 'अमान्य राशि', 'Kuch galat ho gaya': 'कुछ गलत हो गया',
    'Invitation load nahi hui': 'इनवाइट लोड नहीं हुई', 'Login karo pehle': 'पहले लॉगिन करो',
    'Pending invitation nahi mili': 'कोई पेंडिंग इनवाइट नहीं मिली', 'Response failed': 'रिस्पॉन्स विफल',
    /* D103-UI polish-19 (17-Nov): timer/push/security labels */
    'Cancelled': 'रद्द', 'Ended': 'समाप्त',
    'Notification permission request failed': 'सूचना अनुमति अनुरोध विफल',
    'Suspicious login detected': 'संदिग्ध लॉगिन मिला', 'UTR empty hai': 'UTR खाली है', 'No file': 'कोई फाइल नहीं',
    /* D103-UI polish-20 (17-Nov): QR/rules/refer/report/bio/txn/clan-full modals */
    'Your FF UID': 'आपका FF UID', 'Share your FF UID': 'अपना FF UID शेयर करो', 'Copy UID': 'UID कॉपी करें',
    '📋 Quick Rules': '📋 क्विक रूल्स', 'Results': 'रिज़ल्ट', 'Withdrawal': 'निकासी',
    '🕐 Recent Joins': '🕐 हाल के जॉइन', 'No recent joins': 'कोई हालिया जॉइन नहीं',
    '🏆 Recent Winners': '🏆 हाल के विजेता', 'Koi recent winners nahi': 'कोई हालिया विजेता नहीं',
    '🎁 Refer & Earn': '🎁 रेफर और कमाओ', 'Dosto ko invite karo, coins kamao!': 'दोस्तों को इनवाइट करो, सिक्के कमाओ!',
    'Your Referral Code': 'आपका रेफरल कोड', 'Copy Code': 'कोड कॉपी करें', 'Coins Earned': 'सिक्के अर्जित', 'Share & Invite': 'शेयर और इनवाइट',
    '🚩 Report Player': '🚩 प्लेयर रिपोर्ट करें', 'Report Type': 'रिपोर्ट प्रकार',
    '🎮 Cheating / Hack': '🎮 चीटिंग / हैक', '🤬 Abusive Language': '🤬 अभद्र भाषा', '🚶 AFK / Not Playing': '🚶 AFK / नहीं खेल रहा',
    '📍 Wrong Slot': '📍 गलत स्लॉट', '⚔️ Result Dispute': '⚔️ रिज़ल्ट विवाद', '❓ Other': '❓ अन्य',
    'Description': 'विवरण', 'Proof Screenshot (optional)': 'प्रूफ स्क्रीनशॉट (वैकल्पिक)', 'Submit Report': 'रिपोर्ट जमा करें',
    'Ek season mein sabse zyada points jito!': 'एक सीज़न में सबसे ज़्यादा पॉइंट्स जीतो!',
    '✏️ Set Bio': '✏️ बायो सेट करें', 'Apna gaming status set karo (60 chars max)': 'अपना गेमिंग स्टेटस सेट करो (60 अक्षर अधिकतम)',
    'Headshots only 🎯': 'सिर्फ हेडशॉट्स 🎯', 'Top Fragger 💀': 'टॉप फ्रैगर 💀', 'Clutch King 👑': 'क्लच किंग 👑',
    'Rush or Die 🔥': 'रश या डाई 🔥', 'Solo Carry 💪': 'सोलो कैरी 💪', 'Squad Goals 🤝': 'स्क्वाड गोल्स 🤝', 'Save Bio': 'बायो सेव करें',
    '💰 Total Deposited': '💰 कुल जमा', '📤 Total Withdrawn': '📤 कुल निकासी', '📊 Net Position': '📊 नेट पोजीशन',
    'Players ne tumhara profile dekha': 'प्लेयर्स ने तुम्हारा प्रोफ़ाइल देखा', 'weekly': 'साप्ताहिक',
    'Dost ne invite code diya hoga — woh daalo:': 'दोस्त ने इनवाइट कोड दिया होगा — वह डालो:', 'Join Karo →': 'जॉइन करो →',
    'Send': 'भेजें', 'Live feed match start hone par dikhe ga': 'लाइव फीड मैच शुरू होने पर दिखेगा',
    /* D103-UI polish-21 (17-Nov): rules lines + clan LB title */
    'Admin 30 min mein result publish karega.': 'एडमिन 30 मिनट में रिज़ल्ट पब्लिश करेगा।',
    '🏆 Clan Leaderboard': '🏆 क्लैन लीडरबोर्ड',
    /* D103-UI polish-22 (17-Nov): dispute/refund toasts+title */
    'Report Dispute': 'रिपोर्ट विवाद', 'Thoda detail mein likhiyo': 'थोड़ा डिटेल में लिखियो',
    'Not authorized': 'अधिकृत नहीं', 'Submit nahi hua, dobara try karo': 'सबमिट नहीं हुआ, दोबारा प्रयास करो',
    /* D103-UI polish-25 (17-Nov): Hinglish toast batch-3 */
    'Valid FF UID enter karo': 'मान्य FF UID दर्ज करो', 'Valid Room ID daalo': 'मान्य रूम ID डालो', 'Valid UID enter karo': 'मान्य UID दर्ज करो',
    'Valid code daalo!': 'मान्य कोड डालो!', 'Verification email bheja! Inbox check karo': 'सत्यापन ईमेल भेजा! इनबॉक्स देखो', 'Yeh sirf premium users ke liye hai!': 'यह सिर्फ प्रीमियम यूज़र्स के लिए है!',
    'ℹ️ Yeh match pehle se queue mein hai!': 'ℹ️ यह मैच पहले से कतार में है!', '⚠️ Already Squad mein hai!': '⚠️ पहले से स्क्वाड में है!', '⚠️ IGN 20 characters se zyada nahi ho sakta': '⚠️ IGN 20 अक्षर से ज़्यादा नहीं हो सकता',
    '⚠️ Match bhar gaya — queued join cancel': '⚠️ मैच भर गया — कतार वाला जॉइन रद्द', '⚠️ Pehle upar naya 8-12 digit FF UID daalo!': '⚠️ पहले ऊपर नया 8-12 अंक FF UID डालो!', '⚠️ Yeh FF UID pehle se registered hai!': '⚠️ यह FF UID पहले से पंजीकृत है!',
    '⚠️ Yeh phone number pehle se registered hai!': '⚠️ यह फोन नंबर पहले से पंजीकृत है!', '⚠️ Yeh player already Squad mein hai!': '⚠️ यह प्लेयर पहले से स्क्वाड में है!', '✅ Bio saved!': '✅ बायो सेव हुआ!',
    '✅ Dispute submit ho gaya! Admin jald dekhega.': '✅ विवाद सबमिट हो गया! एडमिन जल्द देखेगा।', '✅ LFS Post ho gayi!': '✅ LFS पोस्ट हो गई!', '✅ Rating submit ho gayi!': '✅ रेटिंग सबमिट हो गई!',
    '✅ Rating submit hua!': '✅ रेटिंग सबमिट हुआ!', '✅ Room ID set! Match ab LIVE hai.': '✅ रूम ID सेट! मैच अब लाइव है।', '✅ Showcase me add ho gayi': '✅ शोकेस में जुड़ गई',
    '✅ Support request sent! Admin se chat karo.': '✅ सपोर्ट रिक्वेस्ट भेजी! एडमिन से चैट करो।', '✅ Vote submit ho gaya!': '✅ वोट सबमिट हो गया!', '❌ Apply nahi hua, dobara try karo': '❌ लागू नहीं हुआ, दोबारा प्रयास करो',
    '❌ Internet nahi hai, baad mein try karo': '❌ इंटरनेट नहीं है, बाद में प्रयास करो', '❌ Network error, dobara try karo': '❌ नेटवर्क त्रुटि, दोबारा प्रयास करो', '❌ Remove nahi hua, dobara try karo': '❌ हटाया नहीं गया, दोबारा प्रयास करो',
    '❌ Request save nahi hua — dobara try karo': '❌ रिक्वेस्ट सेव नहीं हुई — दोबारा प्रयास करो', '❌ Service unavailable — join nahi ho paya.': '❌ सेवा अनुपलब्ध — जॉइन नहीं हो पाया।', '❌ Submit error (save):': '❌ सबमिट त्रुटि (सेव):',
    '❌ Valid YouTube link daalo': '❌ मान्य YouTube लिंक डालो', '⭐ Watchlist mein add hua!': '⭐ वॉचलिस्ट में जुड़ा!', '🆕 New app update available! Refresh karo.': '🆕 नया ऐप अपडेट उपलब्ध! रीफ्रेश करो।',
    '🎁 Code apply ho gaya! Account linked!': '🎁 कोड लागू हो गया! अकाउंट लिंक हुआ!', '🎁 Daily bonus available! Check-in karo.': '🎁 डेली बोनस उपलब्ध! चेक-इन करो।', '🎁 Link ka referral apply ho gaya!': '🎁 लिंक का रेफरल लागू हो गया!',
    '🎉 Mentor register ho gaye!': '🎉 मेंटर रजिस्टर हो गए!', '💎 Sky Diamonds add ho gaye!': '💎 स्काई डायमंड जुड़ गए!', '🔔 Notifications abhi allow nahi ki gayi': '🔔 सूचनाएं अभी अनुमति नहीं दी गईं',
    '🔔 Notifications ke liye button pe tap karo': '🔔 सूचनाओं के लिए बटन पर टैप करो',
    /* D103-UI polish-24 (17-Nov): Hinglish toast batch-2 */
    'Message copy ho gaya — paste karke share karo!': 'संदेश कॉपी हो गया — पेस्ट करके शेयर करो!', 'Network error — dobara try karo': 'नेटवर्क त्रुटि — दोबारा प्रयास करो', 'Order ban raha hai...': 'ऑर्डर बन रहा है...',
    'Payment fail ho gaya': 'पेमेंट विफल हो गया', 'Paytm abhi ready nahi hai, app update karo': 'पेटीएम अभी तैयार नहीं, ऐप अपडेट करो', 'Pehle apna current clan chhodo!': 'पहले अपनी मौजूदा क्लैन छोड़ो!',
    'Pehle clan join ya create karo!': 'पहले क्लैन जॉइन या बनाओ!', 'Pehle email verify karo — inbox check karo': 'पहले ईमेल सत्यापित करो — इनबॉक्स देखो', 'Pehle is match mein join karo': 'पहले इस मैच में जॉइन करो',
    'Pehle login karo': 'पहले लॉगिन करो', 'Pehle login karo!': 'पहले लॉगिन करो!', 'Pehle se claim ho chuka hai': 'पहले से क्लेम हो चुका है',
    'Pehle se dekh rahe ho! 👀': 'पहले से देख रहे हो! 👀', 'Pehle se vote ho chuka hai! ✅': 'पहले से वोट हो चुका है! ✅', 'Pending invitation nahi mili': 'कोई पेंडिंग इनवाइट नहीं मिली',
    'Photo upload already chal rahi hai…': 'फोटो अपलोड पहले से चल रही है…', 'Player nahi mila': 'प्लेयर नहीं मिला', 'Prize amount negative nahi ho sakta': 'इनाम राशि नेगेटिव नहीं हो सकती',
    'Profile settings jald aa rahi hain': 'प्रोफ़ाइल सेटिंग्स जल्द आ रही हैं', 'Redemption failed, dobara try karo': 'रीडेम्पशन विफल, दोबारा प्रयास करो', 'Referral code daalo pehle': 'पहले रेफरल कोड डालो',
    'Reminder sewa abhi uplabdh nahi': 'रिमाइंडर सेवा अभी उपलब्ध नहीं', 'Result data nahi mila': 'रिज़ल्ट डेटा नहीं मिला', 'Result save nahi hua, dobara try karo': 'रिज़ल्ट सेव नहीं हुआ, दोबारा प्रयास करो',
    'Room confirm nahi hua: ': 'रूम कन्फर्म नहीं हुआ:', 'Room details abhi available nahi': 'रूम डिटेल अभी उपलब्ध नहीं', 'Save nahi hua: ': 'सेव नहीं हुआ:',
    'Screenshot select karo!': 'स्क्रीनशॉट चुनो!', 'Screenshot upload karo!': 'स्क्रीनशॉट अपलोड करो!', 'Service unavailable — retry karo': 'सेवा अनुपलब्ध — दोबारा प्रयास करो',
    'Settings load nahi hui — app refresh karo': 'सेटिंग्स लोड नहीं हुईं — ऐप रीफ्रेश करो', 'Share ya copy nahi hua': 'शेयर या कॉपी नहीं हुआ', 'Sirf image file choose karo!': 'सिर्फ इमेज फाइल चुनो!',
    'Sirf image file upload karo!': 'सिर्फ इमेज फाइल अपलोड करो!', 'Sirf image files allowed hain! (': 'सिर्फ इमेज फाइलें स्वीकृत! (', 'Sky Diamonds kam hain! Wallet se kharido 💎': 'स्काई डायमंड कम हैं! वॉलेट से खरीदो 💎',
    'Stars select karo': 'स्टार्स चुनो', 'State save nahi hui — dobara try karo': 'स्टेट सेव नहीं हुई — दोबारा प्रयास करो', 'Stream link nahi mila': 'स्ट्रीम लिंक नहीं मिला',
    'Submit failed — retry karo': 'सबमिट विफल — दोबारा प्रयास करो', 'Submit failed, retry karo': 'सबमिट विफल, दोबारा प्रयास करो', 'Submit failed, retry karo.': 'सबमिट विफल, दोबारा प्रयास करो।',
    'Submit nahi hua': 'सबमिट नहीं हुआ', 'Submit nahi hua, dobara try karo': 'सबमिट नहीं हुआ, दोबारा प्रयास करो', 'Submit nahi hua: ': 'सबमिट नहीं हुआ:',
    'Suggestion submit ho gaya! 🎉': 'सुझाव सबमिट हो गया! 🎉', 'Trial start failed, retry karo': 'ट्रायल शुरू विफल, दोबारा प्रयास करो', 'Tumhare paas Green Diamonds nahi hain': 'तुम्हारे पास ग्रीन डायमंड नहीं हैं',
    'UID copy ho gayi': 'UID कॉपी हो गई', 'UID nahi mili': 'UID नहीं मिली', 'UTR / UPI reference number daalo!': 'UTR / UPI रेफरेंस नंबर डालो!',
    'Message 500 akshar se bada nahi ho sakta': 'संदेश 500 अक्षर से बड़ा नहीं हो सकता',
    /* D103-UI polish-23 (17-Nov): Hinglish toast batch-1 */
    'Aaj ki limit ho gayi!': 'आज की लिमिट हो गई!', 'Aapne already ek code use kar liya hai': 'आपने पहले ही एक कोड इस्तेमाल कर लिया है', 'Accept save nahi hua — dobara try karo': 'स्वीकृति सेव नहीं हुई — दोबारा प्रयास करो',
    'Ad load nahi hua': 'ऐड लोड नहीं हुआ', 'Ad load nahi hua, dobara try karo.': 'ऐड लोड नहीं हुआ, दोबारा प्रयास करो।', 'Ad pura dekho reward ke liye!': 'ऐड पूरा देखो इनाम के लिए!',
    'Ad pura dekho!': 'ऐड पूरा देखो!', 'Age verify save nahi hui — dobara try karo': 'उम्र सत्यापन सेव नहीं हुआ — दोबारा प्रयास करो', 'Amount enter karo': 'राशि दर्ज करो',
    'Apna khud ka code use nahi kar sakte': 'अपना खुद का कोड इस्तेमाल नहीं कर सकते', 'Apne aap ko add nahi kar sakte!': 'खुद को ऐड नहीं कर सकते!', 'Apne aap ko gift nahi kar sakte 😄': 'खुद को गिफ्ट नहीं कर सकते 😄',
    'Apni profile par photo edit karo': 'अपनी प्रोफ़ाइल पर फोटो एडिट करो', 'Balance se zyada nahi withdraw kar sakte': 'बैलेंस से ज़्यादा निकासी नहीं कर सकते', 'Banner upload already chal rahi hai…': 'बैनर अपलोड पहले से चल रही है…',
    'Caption copied! Instagram pe paste karo 📋': 'कैप्शन कॉपी हुआ! इंस्टाग्राम पर पेस्ट करो 📋', 'Challenge decline ho gaya': 'चैलेंज अस्वीकार हो गया', 'Channel URL daalo': 'चैनल URL डालो',
    'Claim failed, retry karo.': 'क्लेम विफल, दोबारा प्रयास करो।', 'Clan ID ya code daalo!': 'क्लैन ID या कोड डालो!', 'Clan nahi mila': 'क्लैन नहीं मिला',
    'Clan nahi mila! Code dobara check karo.': 'क्लैन नहीं मिला! कोड दोबारा जांचो।', 'Code copy ho gaya! 🎉': 'कोड कॉपी हो गया! 🎉', 'Coins credit nahi ho paye, dobara try karo': 'सिक्के क्रेडिट नहीं हो पाए, दोबारा प्रयास करो',
    'Confirm ho raha hai...': 'कन्फर्म हो रहा है...', 'Connection error — dobara try karo': 'कनेक्शन त्रुटि — दोबारा प्रयास करो', 'Connection error, retry karo.': 'कनेक्शन त्रुटि, दोबारा प्रयास करो।',
    'Connection nahi — dobara try karo': 'कनेक्शन नहीं — दोबारा प्रयास करो', 'Copy fail': 'कॉपी विफल', 'Copy ho gaya ✅': 'कॉपी हो गया ✅',
    'Copy ho gaya! 📋': 'कॉपी हो गया! 📋', 'Copy manually karo': 'मैनुअली कॉपी करो', 'Date/time set karo': 'दिनांक/समय सेट करो',
    'Duel record save nahi hua': 'ड्यूअल रिकॉर्ड सेव नहीं हुआ', 'Duel result load nahi hua': 'ड्यूअल रिज़ल्ट लोड नहीं हुआ', 'Equip nahi hua — retry karo.': 'इक्विप नहीं हुआ — दोबारा प्रयास करो।',
    'FF UID enter karo': 'FF UID दर्ज करो', 'FF UID ya IGN mein se koi ek daalo': 'FF UID या IGN में से कोई एक डालो', 'Friend remove ho gaya': 'दोस्त हट गया',
    'Gift send failed — retry karo': 'गिफ्ट भेजना विफल — दोबारा प्रयास करो', 'Hataya nahi — network?': 'हटाया नहीं — नेटवर्क?', 'History load failed, retry karo': 'हिस्ट्री लोड विफल, दोबारा प्रयास करो',
    'Interest save nahi hua:': 'इंटरेस्ट सेव नहीं हुआ:', 'Is match ka live stream available nahi hai': 'इस मैच का लाइव स्ट्रीम उपलब्ध नहीं है', 'Join failed — retry karo': 'जॉइन विफल — दोबारा प्रयास करो',
    'Khud ko challenge nahi kar sakte!': 'खुद को चैलेंज नहीं कर सकते!', 'Kitne minute pehle? (1 se 1440)': 'कितने मिनट पहले? (1 से 1440)', 'Kuch to likho!': 'कुछ तो लिखो!',
    'Live link daalo pehle!': 'लाइव लिंक पहले डालो!', 'Match chuno — Matches list se report karo': 'मैच चुनो — मैचेस लिस्ट से रिपोर्ट करो', 'Match end ho gaya — watching stopped': 'मैच समाप्त हो गया — वॉचिंग रुकी',
    'Match khatam ho gaya — Watch & Earn ended.': 'मैच खत्म हो गया — वॉच और अर्न समाप्त।', 'Match load ho raha hai, thoda ruko...': 'मैच लोड हो रहा है, थोड़ा रुको...', 'Match nahi mila': 'मैच नहीं मिला',
    'Match select karo ya naam likho': 'मैच चुनो या नाम लिखो',
    /* D103-UI polish-10 (17-Nov): join-flow literals (screens/join.js) */
    'Confirm Join': 'कन्फर्म जॉइन', 'Join Tournament': 'टूर्नामेंट जॉइन करें',
    'Bronze': 'ब्रॉन्ज़', 'Heroic': 'हीरोइक', 'Legend': 'लेजेंड', 'Grandmaster': 'ग्रैंडमास्टर',
    'Captain': 'कैप्टन', 'Partner': 'पार्टनर', 'Player': 'प्लेयर',
    'Aap already join ho chuke ho': 'आप पहले से जॉइन कर चुके हो',
    'Teammates verify nahi huye': 'टीममेट्स वेरीफाई नहीं हुए',
    'Invite nahi bhej paaye': 'इनवाइट नहीं भेज पाए',
    'Match already started': 'मैच पहले ही शुरू हो चुका', 'Match cancelled': 'मैच रद्द हुआ', 'Match has ended': 'मैच समाप्त हुआ',
    'Team members missing': 'टीम मेंबर्स अधूरे', 'Service unavailable': 'सर्विस अनुपलब्ध',
    'Validate partner UID first': 'पहले पार्टनर UID वेरीफाई करें', 'Invite failed': 'इनवाइट विफल'
  };
  var HI2EN = {};
  Object.keys(EN2HI).forEach(function (k) { HI2EN[EN2HI[k]] = k; });
  /* 44-char se lambe nodes walker skip karta hai — known long strings yahan */
  var LONG_HI = { 'App mein koi kami hai? Batao — reward milega!': 'ऐप में कोई कमी है? बताओ — इनाम मिलेगा!',
    'Sunday & monthly specials — bade rewards ke liye khelo!': 'संडे और मंथली स्पेशल्स — बड़े इनामों के लिए खेलो!',
    'Admin approve karega — UPI pe direct transfer hoga.': 'एडमिन अप्रूव करेगा — UPI पर सीधा ट्रांसफर होगा।',
    'Day 1 par itne coins • 7-din cycle • har 30 din bonus': 'दिन 1 पर इतने सिक्के • 7-दिन साइकल • हर 30 दिन बोनस',
    'Coin Match ya Ad Match jeeto → coins prize milenge': 'कॉइन मैच या ऐड मैच जीतो → सिक्के इनाम मिलेंगे',
    '⚠️ Unverified — tap to verify': '⚠️ असत्यापित — सत्यापित करने के लिए टैप करें',
    'IGN + FF UID verify karayein — sirf 30 second, ek baar.': 'IGN + FF UID वेरिफाई कराएं — सिर्फ 30 सेकंड, एक बार।',
    'me wapas aa jaayenge — tab tak breathe karo 😄': 'में वापस आ जाएंगे — तब तक ब्रीद करो 😄',
    'Hack/cheat = permanent ban aur prize forfeit.': 'हैक/चीट = स्थायी बैन और इनाम जब्त।',
    'Banner image read nahi hui — JPG/PNG dobara choose karo': 'बैनर इमेज पढ़ी नहीं गई — JPG/PNG दोबारा चुनो',
    'Clan war service abhi ready nahi — retry karo': 'क्लैन वॉर सेवा अभी तैयार नहीं — दोबारा प्रयास करो',
    'Collection load nahi hui — app refresh karo': 'कलेक्शन लोड नहीं हुई — ऐप रीफ्रेश करो',
    'Details likho — bina detail dispute adhoora hai': 'विवरण लिखो — बिना विवरण विवाद अधूरा है',
    'Image service load nahi hui — app refresh karo': 'इमेज सेवा लोड नहीं हुई — ऐप रीफ्रेश करो',
    'Image tool load nahi hua — app refresh karo': 'इमेज टूल लोड नहीं हुआ — ऐप रीफ्रेश करो',
    'Login sync ho raha hai — ek baar phir try karo': 'लॉगिन सिंक हो रहा है — एक बार फिर प्रयास करो',
    'Match mein enough slots nahi hain teammates ke liye': 'मैच में साथियों के लिए पर्याप्त स्लॉट नहीं हैं',
    'Match shuru ho chuka hai — ab reminder set nahi ho sakta': 'मैच शुरू हो चुका है — अब रिमाइंडर सेट नहीं हो सकता',
    'Payment screenshot upload karo — mandatory hai!': 'पेमेंट स्क्रीनशॉट अपलोड करो — जरूरी है!',
    'Prize pool match ke max collection se zyada hai — kam karo': 'इनाम पूल मैच की अधिकतम कलेक्शन से ज़्यादा है — कम करो',
    'Screenshot read nahi hui — JPG/PNG dobara choose karo': 'स्क्रीनशॉट पढ़ी नहीं गई — JPG/PNG दोबारा चुनो',
    'Thodi der lag rahi hai — Wallet History mein check karo': 'थोड़ी देर लग रही है — वॉलेट हिस्ट्री में देखो',
    'UTR number poora daalo (kam se kam 6 characters)': 'UTR नंबर पूरा डालो (कम से कम 6 अक्षर)',
    'Some saved partners not found. Enter manually.': 'कुछ सेव्ड पार्टनर्स नहीं मिले। मैनुअली दर्ज करो।',
    'Sirf approved creators match host kar sakte hain': 'सिर्फ स्वीकृत क्रिएटर्स मैच होस्ट कर सकते हैं',
    'Valid UPI ID daalo (e.g. name@upi, phone@paytm)': 'मान्य UPI ID डालो (जैसे name@upi, phone@paytm)',
    'Ye badge abhi kamaya nahi — pehle unlock karo!': 'यह बैज अभी कमाया नहीं — पहले अनलॉक करो!',
    'Ye section sirf apni profile card par hota hai': 'यह सेक्शन सिर्फ अपनी प्रोफ़ाइल कार्ड पर होता है',
    'Ye toh tumhara current UID hai — naya UID daalo': 'यह तो तुम्हारा मौजूदा UID है — नया UID डालो',
    '⚠️ Is device se pehle kisi aur ne join kiya hai!': '⚠️ इस डिवाइस से पहले किसी और ने जॉइन किया है!',
    '⚠️ Yeh player already tumhara Duo partner hai!': '⚠️ यह प्लेयर पहले से तुम्हारा ड्यूओ पार्टनर है!',
    '⚠️ Yeh screenshot pehle se use ho chuka hai! (Status:': '⚠️ यह स्क्रीनशॉट पहले से इस्तेमाल हो चुका है! (स्टेटस:',
    '⛔ Aapka account ban hai. Match join nahi kar sakte.': '⛔ आपका अकाउंट बैन है। मैच जॉइन नहीं कर सकते।',
    '✅ Aap is match mein already join ho chuke ho!': '✅ आप इस मैच में पहले से जॉइन हो चुके हो!',
    '✅ Match banaya gaya! Players abhi register kar sakte hain.': '✅ मैच बनाया गया! प्लेयर्स अभी रजिस्टर कर सकते हैं।',
    '✅ Payment Confirmed! FF UID change request submit ho gaya.': '✅ पेमेंट कन्फर्म! FF UID बदलने की रिक्वेस्ट सबमिट हो गई।',
    '✅ Result submit ho gaya! Admin review ke baad payout hoga.': '✅ रिज़ल्ट सबमिट हो गया! एडमिन रिव्यू के बाद पेआउट होगा।',
    '✅ Tum already team mein ho — captain ne join kar liya!': '✅ तुम पहले से टीम में हो — कैप्टन ने जॉइन कर लिया!',
    '✅ Withdrawal request submit ho gayi! Admin approve karega.': '✅ निकासी रिक्वेस्ट सबमिट हो गई! एडमिन स्वीकृत करेगा।',
    '❌ Is browser mein notifications supported nahi hain': '❌ इस ब्राउज़र में सूचनाएं समर्थित नहीं हैं',
    '❌ Team members verify nahi huye — dobara check karo': '❌ टीम मेंबर्स वेरीफाई नहीं हुए — दोबारा जांचो',
    '🎮 Ad-Match Credit mila! 1 match free join kar sakte ho.': '🎮 ऐड-मैच क्रेडिट मिला! 1 मैच फ्री जॉइन कर सकते हो।',
    '👑 Banner change sirf Premium members ke liye hai': '👑 बैनर बदलना सिर्फ प्रीमियम मेंबर्स के लिए है',
    '👑 Profile photo change sirf Premium members ke liye hai': '👑 प्रोफ़ाइल फोटो बदलना सिर्फ प्रीमियम मेंबर्स के लिए है',
    '💡 Squad bank contribution ke liye Squad Bank tab use karo': '💡 स्क्वाड बैंक योगदान के लिए स्क्वाड बैंक टैब इस्तेमाल करो',
    'Welcome to Mini eSports - Join Match Coins & Diamonds jeeto !': 'mini eSports में स्वागत — मैच खेलो, Coins & Diamonds जीतो !' ,
    'Withdrawal ke liye email verification zaruri hai. Apni email check karo aur verification link click karo.': 'निकासी के लिए ईमेल सत्यापन ज़रूरी है। अपनी ईमेल जांचें और सत्यापन लिंक पर क्लिक करें।' ,
    '✅ Coins kharidne ki zaroorat nahi — neeche se free earn karo!': '✅ सिक्के खरीदने की ज़रूरत नहीं — नीचे मुफ़्त कमाओ!' ,
    'Verified profile से match rewards, leaderboard trust और team-features smooth चलते हैं। Admin approval के बाद UID lock हो जाता है — safe।': 'Verified profile se match rewards, leaderboard trust aur team-features smooth chalte hain. Admin approval ke baad UID lock ho jata hai — safe.',
    'Verified profile se match rewards, leaderboard trust aur team-features smooth chalte hain. Admin approval ke baad UID lock ho jata hai — safe.': 'वेरिफाइड प्रोफ़ाइल से मैच रिवॉर्ड्स, लीडरबोर्ड ट्रस्ट और टीम-फीचर्स स्मूद चलते हैं। एडमिन अप्रूवल के बाद UID लॉक हो जाता है — सुरक्षित।',
    'Entry fee non-refundable hai (cancelled match ke siwa).': 'एंट्री फीस नॉन-रिफंडेबल है (कैंसिल मैच के सिवा)।', 'Kill count dispute ke liye screenshot upload karo.': 'किल काउंट विवाद के लिए स्क्रीनशॉट अपलोड करो।',
    'Wahi naam match room me use hoga — sahi IGN zaroori hai.': 'वही नाम मैच रूम में यूज़ होगा — सही IGN ज़रूरी है।',
    'Entry fee wallet se kategi; jeetne par prize turant wallet me aayega. 🏆': 'एंट्री फीस वॉलेट से कटेगी; जीतने पर प्राइज़ तुरंत वॉलेट में आएगा। 🏆',
    '3️⃣ Room time se 15 minute pehle notification aayega': '3️⃣ रूम टाइम से 15 मिनट पहले नोटिफिकेशन आएगा',
    'Room ID + password push notification me milega — tab tak ready rehna. 🔔': 'रूम ID + पासवर्ड पुश नोटिफिकेशन में मिलेगा — तब तक रेडी रहना। 🔔' };
  var LONG_EN = { 'ऐप में कोई कमी है? बताओ — इनाम मिलेगा!': 'App mein koi kami hai? Batao — reward milega!',
    'संडे और मंथली स्पेशल्स — बड़े इनामों के लिए खेलो!': 'Sunday & monthly specials — bade rewards ke liye khelo!',
    'एडमिन अप्रूव करेगा — UPI पर सीधा ट्रांसफर होगा।': 'Admin approve karega — UPI pe direct transfer hoga.',
    'दिन 1 पर इतने सिक्के • 7-दिन साइकल • हर 30 दिन बोनस': 'Day 1 par itne coins • 7-din cycle • har 30 din bonus',
    'कॉइन मैच या ऐड मैच जीतो → सिक्के इनाम मिलेंगे': 'Coin Match ya Ad Match jeeto → coins prize milenge',
    '⚠️ असत्यापित — सत्यापित करने के लिए टैप करें': '⚠️ Unverified — tap to verify',
    'IGN + FF UID वेरिफाई कराएं — सिर्फ 30 सेकंड, एक बार।': 'IGN + FF UID verify karayein — sirf 30 second, ek baar.',
    'में वापस आ जाएंगे — तब तक ब्रीद करो 😄': 'me wapas aa jaayenge — tab tak breathe karo 😄',
    'हैक/चीट = स्थायी बैन और इनाम जब्त।': 'Hack/cheat = permanent ban aur prize forfeit.',
    'बैनर इमेज पढ़ी नहीं गई — JPG/PNG दोबारा चुनो': 'Banner image read nahi hui — JPG/PNG dobara choose karo',
    'क्लैन वॉर सेवा अभी तैयार नहीं — दोबारा प्रयास करो': 'Clan war service abhi ready nahi — retry karo',
    'कलेक्शन लोड नहीं हुई — ऐप रीफ्रेश करो': 'Collection load nahi hui — app refresh karo',
    'विवरण लिखो — बिना विवरण विवाद अधूरा है': 'Details likho — bina detail dispute adhoora hai',
    'इमेज सेवा लोड नहीं हुई — ऐप रीफ्रेश करो': 'Image service load nahi hui — app refresh karo',
    'इमेज टूल लोड नहीं हुआ — ऐप रीफ्रेश करो': 'Image tool load nahi hua — app refresh karo',
    'लॉगिन सिंक हो रहा है — एक बार फिर प्रयास करो': 'Login sync ho raha hai — ek baar phir try karo',
    'मैच में साथियों के लिए पर्याप्त स्लॉट नहीं हैं': 'Match mein enough slots nahi hain teammates ke liye',
    'मैच शुरू हो चुका है — अब रिमाइंडर सेट नहीं हो सकता': 'Match shuru ho chuka hai — ab reminder set nahi ho sakta',
    'पेमेंट स्क्रीनशॉट अपलोड करो — जरूरी है!': 'Payment screenshot upload karo — mandatory hai!',
    'इनाम पूल मैच की अधिकतम कलेक्शन से ज़्यादा है — कम करो': 'Prize pool match ke max collection se zyada hai — kam karo',
    'स्क्रीनशॉट पढ़ी नहीं गई — JPG/PNG दोबारा चुनो': 'Screenshot read nahi hui — JPG/PNG dobara choose karo',
    'थोड़ी देर लग रही है — वॉलेट हिस्ट्री में देखो': 'Thodi der lag rahi hai — Wallet History mein check karo',
    'UTR नंबर पूरा डालो (कम से कम 6 अक्षर)': 'UTR number poora daalo (kam se kam 6 characters)',
    'कुछ सेव्ड पार्टनर्स नहीं मिले। मैनुअली दर्ज करो।': 'Some saved partners not found. Enter manually.',
    'सिर्फ स्वीकृत क्रिएटर्स मैच होस्ट कर सकते हैं': 'Sirf approved creators match host kar sakte hain',
    'मान्य UPI ID डालो (जैसे name@upi, phone@paytm)': 'Valid UPI ID daalo (e.g. name@upi, phone@paytm)',
    'यह बैज अभी कमाया नहीं — पहले अनलॉक करो!': 'Ye badge abhi kamaya nahi — pehle unlock karo!',
    'यह सेक्शन सिर्फ अपनी प्रोफ़ाइल कार्ड पर होता है': 'Ye section sirf apni profile card par hota hai',
    'यह तो तुम्हारा मौजूदा UID है — नया UID डालो': 'Ye toh tumhara current UID hai — naya UID daalo',
    '⚠️ इस डिवाइस से पहले किसी और ने जॉइन किया है!': '⚠️ Is device se pehle kisi aur ne join kiya hai!',
    '⚠️ यह प्लेयर पहले से तुम्हारा ड्यूओ पार्टनर है!': '⚠️ Yeh player already tumhara Duo partner hai!',
    '⚠️ यह स्क्रीनशॉट पहले से इस्तेमाल हो चुका है! (स्टेटस:': '⚠️ Yeh screenshot pehle se use ho chuka hai! (Status:',
    '⛔ आपका अकाउंट बैन है। मैच जॉइन नहीं कर सकते।': '⛔ Aapka account ban hai. Match join nahi kar sakte.',
    '✅ आप इस मैच में पहले से जॉइन हो चुके हो!': '✅ Aap is match mein already join ho chuke ho!',
    '✅ मैच बनाया गया! प्लेयर्स अभी रजिस्टर कर सकते हैं।': '✅ Match banaya gaya! Players abhi register kar sakte hain.',
    '✅ पेमेंट कन्फर्म! FF UID बदलने की रिक्वेस्ट सबमिट हो गई।': '✅ Payment Confirmed! FF UID change request submit ho gaya.',
    '✅ रिज़ल्ट सबमिट हो गया! एडमिन रिव्यू के बाद पेआउट होगा।': '✅ Result submit ho gaya! Admin review ke baad payout hoga.',
    '✅ तुम पहले से टीम में हो — कैप्टन ने जॉइन कर लिया!': '✅ Tum already team mein ho — captain ne join kar liya!',
    '✅ निकासी रिक्वेस्ट सबमिट हो गई! एडमिन स्वीकृत करेगा।': '✅ Withdrawal request submit ho gayi! Admin approve karega.',
    '❌ इस ब्राउज़र में सूचनाएं समर्थित नहीं हैं': '❌ Is browser mein notifications supported nahi hain',
    '❌ टीम मेंबर्स वेरीफाई नहीं हुए — दोबारा जांचो': '❌ Team members verify nahi huye — dobara check karo',
    '🎮 ऐड-मैच क्रेडिट मिला! 1 मैच फ्री जॉइन कर सकते हो।': '🎮 Ad-Match Credit mila! 1 match free join kar sakte ho.',
    '👑 बैनर बदलना सिर्फ प्रीमियम मेंबर्स के लिए है': '👑 Banner change sirf Premium members ke liye hai',
    '👑 प्रोफ़ाइल फोटो बदलना सिर्फ प्रीमियम मेंबर्स के लिए है': '👑 Profile photo change sirf Premium members ke liye hai',
    '💡 स्क्वाड बैंक योगदान के लिए स्क्वाड बैंक टैब इस्तेमाल करो': '💡 Squad bank contribution ke liye Squad Bank tab use karo',
    'mini eSports में स्वागत — मैच खेलो, Coins & Diamonds जीतो !': 'Welcome to Mini eSports - Join Match Coins & Diamonds jeeto !' ,
    'निकासी के लिए ईमेल सत्यापन ज़रूरी है। अपनी ईमेल जांचें और सत्यापन लिंक पर क्लिक करें।': 'Withdrawal ke liye email verification zaruri hai. Apni email check karo aur verification link click karo.' ,
    '✅ सिक्के खरीदने की ज़रूरत नहीं — नीचे मुफ़्त कमाओ!': '✅ Coins kharidne ki zaroorat nahi — neeche se free earn karo!' ,
    'Verified profile se match rewards, leaderboard trust aur team-features smooth chalte hain. Admin approval ke baad UID lock ho jata hai — safe.': 'Verified profile से match rewards, leaderboard trust और team-features smooth चलते हैं। Admin approval के बाद UID lock हो जाता है — safe।',
    'वेरिफाइड प्रोफ़ाइल से मैच रिवॉर्ड्स, लीडरबोर्ड ट्रस्ट और टीम-फीचर्स स्मूद चलते हैं। एडमिन अप्रूवल के बाद UID लॉक हो जाता है — सुरक्षित।': 'Verified profile se match rewards, leaderboard trust aur team-features smooth chalte hain. Admin approval ke baad UID lock ho jata hai — safe.',
    'एंट्री फीस नॉन-रिफंडेबल है (कैंसिल मैच के सिवा)।': 'Entry fee non-refundable hai (cancelled match ke siwa).', 'किल काउंट विवाद के लिए स्क्रीनशॉट अपलोड करो।': 'Kill count dispute ke liye screenshot upload karo.',
    'वही नाम मैच रूम में यूज़ होगा — सही IGN ज़रूरी है।': 'Wahi naam match room me use hoga — sahi IGN zaroori hai.',
    'एंट्री फीस वॉलेट से कटेगी; जीतने पर प्राइज़ तुरंत वॉलेट में आएगा। 🏆': 'Entry fee wallet se kategi; jeetne par prize turant wallet me aayega. 🏆',
    '3️⃣ रूम टाइम से 15 मिनट पहले नोटिफिकेशन आएगा': '3️⃣ Room time se 15 minute pehle notification aayega',
    'रूम ID + पासवर्ड पुश नोटिफिकेशन में मिलेगा — तब तक रेडी रहना। 🔔': 'Room ID + password push notification me milega — tab tak ready rehna. 🔔' };
  /* D103-UI polish-11: attribute-level i18n (title/aria-label/placeholder) */
  var ATTR_HI = {
    'Search Matches': 'मैच खोजें', 'Notifications': 'सूचनाएं', 'Help & Support': 'सहायता और सपोर्ट',
    'Help and Support': 'सहायता और सपोर्ट', 'Coins': 'सिक्के', 'Wallet Coins': 'वॉलेट सिक्के',
    'Sky Diamonds': 'स्काई डायमंड', 'Green Diamonds': 'ग्रीन डायमंड', 'Invite Card': 'इनवाइट कार्ड',
    'Type your message...': 'अपना संदेश लिखें...', 'Bottom Navigation': 'बॉटम नेविगेशन',
    'Home': 'होम', 'Rank Leaderboard': 'रैंक लीडरबोर्ड', 'My Matches': 'मेरे मैच',
    'Wallet': 'वॉलेट', 'Profile': 'प्रोफ़ाइल', 'Close modal': 'मोडल बंद करें',
    'IGN ya FF UID search karo...': 'IGN या FF UID खोजें...',
    'Coins Kaise Kamao': 'सिक्के कैसे कमाएं', 'Close Earn Coins': 'सिक्के कमाएं बंद करें',
    'info circle': 'जानकारी', 'card action': 'कार्ड क्रिया', 'paper plane': 'भेजें',
  };
  var ATTR_EN = { 'IGN या FF UID खोजें...': 'IGN ya FF UID search karo...' };
  Object.keys(ATTR_HI).forEach(function (k) { ATTR_EN[ATTR_HI[k]] = k; });

  /* ✅ D103 z22: baked-asset swap — wallet card backgrounds + profile card frame
     me English text IMAGE ke andar baked tha; Hindi variants assets/*_hi.* ab
     lang ke hisaab se swap hote hain (inline style + frame img src). */
  var BG_PAIRS = [
    ['assets/wallet/sky_bg.jpg', 'assets/wallet/sky_bg_hi.jpg'],
    ['assets/wallet/coin_bg.jpg', 'assets/wallet/coin_bg_hi.jpg'],
    ['assets/wallet/green_bg.jpg', 'assets/wallet/green_bg_hi.jpg']
  ];
  function swapBakedAssets(lang) {
    try {
      document.querySelectorAll('[style*="wallet/"]').forEach(function (el) {
        var s = el.getAttribute('style') || ''; var o = s;
        BG_PAIRS.forEach(function (pr) {
          if (lang === 'hi') { if (s.indexOf(pr[1]) === -1) s = s.split(pr[0]).join(pr[1]); }
          else if (s.indexOf(pr[1]) > -1) { s = s.split(pr[1]).join(pr[0]); }
        });
        if (s !== o) el.setAttribute('style', s);
      });
      document.querySelectorAll('img[data-pc2frame]').forEach(function (im) {
        var cur = im.getAttribute('src') || '';
        var want = lang === 'hi' ? 'assets/profile/card_frame_hi.png' : 'assets/profile/card_frame.png';
        if (cur.indexOf('card_frame') > -1 && cur.indexOf(want) === -1) {
          var q = cur.indexOf('?'); im.setAttribute('src', want + (q > -1 ? cur.slice(q) : ''));
        }
      });
    } catch (e) {}
  }
  /* multi-occurrence LONG swap (ticker node text duplicated hota hai) */
  function tickSwap(s, lang) {
    var m = lang === 'hi' ? LONG_HI : LONG_EN; var v = s;
    Object.keys(m).forEach(function (k) { if (k.length > 30 && v.indexOf(k) > -1) v = v.split(k).join(m[k]); });
    return v;
  }
  window._i18nTick = function (s) {
    var lang = 'hi'; try { lang = window._lang || localStorage.getItem('appLang') || 'hi'; } catch (e) {}
    return tickSwap(s || '', lang);
  };

  /* ✅ D103 z25: composite chains ab function me — 44+ char nodes par bhi lagti hain */
  function compHi(v) {
    return v.replace('bring friends, earn 🪙!', 'दोस्त लाओ 🪙 पाओ!') .replace('Past Seasons', 'पिछले सीज़न').replace('Invite & Earn', 'इनवाइट और कमाओ') .replace('✅ Ad-free results', '✅ एड-फ्री रिज़ल्ट').replace('✅ Monthly bonus coins', '✅ मासिक बोनस सिक्के') .replace('✅ Premium badge', '✅ प्रीमियम बैज').replace('✅ Photo/Banner change', '✅ फोटो/बैनर बदलें') .replace(' friends', ' दोस्त').replace(' earned', ' अर्जित').replace(' matches', ' मैचेस') .replace(' wins', ' विंस').replace(' kills', ' किल्स').replace(' pts', ' अंक') .replace('% Complete', '% पूर्ण').replace('Profile ', 'प्रोफ़ाइल ').replace('Level ', 'लेवल ') .replace(' History', ' हिस्ट्री') .replace('Battle Pass', 'बैटल पास').replace('Collection', 'कलेक्शन').replace('Friends', 'दोस्त').replace('View all', 'सभी देखें') .replace('Clan War', 'क्लैन वॉर').replace('City Champ', 'सिटी चैंप').replace('Mentor Hub', 'मेंटर हब') .replace('Points', 'पॉइंट्स').replace('Season', 'सीज़न').replace('Kills', 'किल्स').replace('Wins', 'विंस') .replace('Welcome to Mini eSports - Join Match Coins & Diamonds jeeto !', 'mini eSports में स्वागत — मैच खेलो, Coins & Diamonds जीतो !') .replace('Rank = Wins×40 + Kills×2 + Matches×1', 'रैंक = विंस×40 + किल्स×2 + मैचेस×1') .replace('Tap for details', 'विवरण के लिए टैप करें') .replace('Room details will be shared before match start', 'रूम की जानकारी मैच शुरू होने से पहले मिलेगी') .replace('Daily Missions', 'डेली मिशन्स').replace('Deposits', 'जमा').replace('Withdrawals', 'निकासियां') .replace('Winnings', 'जीत').replace('Bonus', 'बोनस').replace('Total: ₹', 'कुल: ₹') .replace('Upcoming', 'आगामी') .replace('Abhi koi special scheduled nahi', 'अभी कोई स्पेशल शेड्यूल नहीं') .replace('next special announce hote hi countdown yahan chalega!', 'अगला स्पेशल घोषित होते ही काउंटडाउन यहाँ चलेगा!') .replace('Slots (', 'स्लॉट (').replace('% Full)', '% भरा)').replace('/Kill', '/किल') .replace('Koi bhi diamond', 'कोई भी डायमंड').replace('members • Score:', 'मेंबर्स • स्कोर:') .replace('-Day Streak!', '-दिन स्ट्रीक!').replace(' Coins', ' सिक्के') .replace('d ago', ' दिन पहले').replace('h ago', ' घंटे पहले').replace('m ago', ' मिनट पहले') .replace('Pehli baar?', 'पहली बार?').replace('auto-create hoga', 'ऑटो-क्रिएट होगा') .replace('Referral Code share karo', 'रेफरल कोड शेयर करो').replace('Sunday', 'संडे').replace(' din baad — ', ' दिन बाकी — ') .replace('Break active hai till ', 'ब्रेक सक्रिय है — ') .replace('din baaki', 'दिन बाकी') .replace(/(\d+)d (\d+)h/g, '$1 दिन $2 घंटे').replace(/(\d+)h (\d+)m/g, '$1 घंटे $2 मिनट').replace(/(\d+)m (\d+)s/g, '$1 मिनट $2 सेकंड') .replace(' Referred', ' रेफर्ड').replace('Reporting:', 'रिपोर्टिंग:').replace('Total ', 'कुल ').replace(' members •', ' मेंबर्स •') .replace(' Player', ' प्लेयर') .replace('Interest save nahi hua', 'इंटरेस्ट सेव नहीं हुआ').replace('Challenge bhej nahi saki:', 'चैलेंज नहीं भेज सकी:').replace('Clan full hai! (', 'क्लैन भरी है! (') .replace('me wapas aa jaayenge — tab tak breathe karo 😄', 'में वापस आ जाएंगे — तब तक ब्रीद करो 😄').replace('Verification pending', 'वेरिफिकेशन पेंडिंग') .replace('Kaise Kamao', 'कैसे कमाओ') .replace(' Jan ', ' जन ').replace(' Feb ', ' फर ').replace(' Mar ', ' मार्च ').replace(' Apr ', ' अप्रै ') .replace(' May ', ' मई ').replace(' Jun ', ' जून ').replace(' Jul ', ' जुल ').replace(' Aug ', ' अग ') .replace(' Sep ', ' सित ').replace(' Oct ', ' अक्टू ').replace(' Nov ', ' नव ').replace(' Dec ', ' दिस ') .replace('Rewarded Ad dekho →', 'रिवॉर्डेड ऐड देखें →').replace(' turant milenge', ' तुरंत मिलेंगे').replace('Roz login karo →', 'रोज़ लॉगिन करें →').replace(' guaranteed', ' गारंटीड').replace('Dost ko invite karo →', 'दोस्त को इनवाइट करें →').replace(' dono ko', ' दोनों को').replace('Daily 5 baar tak • Har din reset hota hai', 'दिन में 5 बार तक • हर दिन रीसेट होता है').replace('Profile → Referral Code share karo', 'प्रोफ़ाइल → रेफरल कोड शेयर करें').replace('Coin Match ya Ad Match jeeto → coins prize milenge', 'कॉइन मैच या ऐड मैच जीतें → सिक्के इनाम मिलेंगे').replace('Match results ke baad auto credit hota hai', 'मैच रिज़ल्ट के बाद ऑटो क्रेडिट होता है').replace('Coins kharidne ki zaroorat nahi — neeche se free earn karo!', 'सिक्के खरीदने की ज़रूरत नहीं — नीचे मुफ़्त कमाओ!').replace('Kharidne ki zaroorat nahi — bas active raho, earn karte raho!', 'खरीदने की ज़रूरत नहीं — बस एक्टिव रहो, कमाते रहो!').replace('Day 2 par fine coins', 'दिन 2 पर फाइन सिक्के').replace('7-day cycle', '7-दिन चक्र').replace('har 30 din bonus', 'हर 30 दिन बोनस').replace(/Day (\d+) par itne coins/, 'दिन $1 पर इतने सिक्के').replace('7-din cycle', '7-दिन साइकल').replace('Rank = ', 'रैंक = ').replace('Matches×1', 'मैचेस×1').replace(/\bJan\b/, 'जन').replace(/\bFeb\b/, 'फर').replace(/\bMar\b/, 'मार्च').replace(/\bApr\b/, 'अप्रै').replace(/\bMay\b/, 'मई').replace(/\bJun\b/, 'जून').replace(/\bJul\b/, 'जुल').replace(/\bAug\b/, 'अग').replace(/\bSep\b/, 'सित').replace(/\bOct\b/, 'अक्टू').replace(/\bNov\b/, 'नव').replace(/\bDec\b/, 'दिस').replace(/Next: Win (\d+) मैचेस/, 'आगे: $1 मैचेस जीतो').replace(/Next: (\d+) मैचेस/, 'आगे: $1 मैचेस').replace('WinStreak×10', 'विनस्ट्रीक×10').replace('Bronze Warrior', 'ब्रॉन्ज़ वॉरियर');
  }
  function compEn(v) {
    return v.replace('दोस्त लाओ 🪙 पाओ!', 'bring friends, earn 🪙!') .replace('पिछले सीज़न', 'Past Seasons').replace('इनवाइट और कमाओ', 'Invite & Earn') .replace('✅ एड-फ्री रिज़ल्ट', '✅ Ad-free results').replace('✅ मासिक बोनस सिक्के', '✅ Monthly bonus coins') .replace('✅ प्रीमियम बैज', '✅ Premium badge').replace('✅ फोटो/बैनर बदलें', '✅ Photo/Banner change') .replace(' दोस्त', ' friends').replace(' अर्जित', ' earned').replace(' मैचेस', ' matches') .replace(' विंस', ' wins').replace(' किल्स', ' kills').replace(' अंक', ' pts') .replace('% पूर्ण', '% Complete').replace('प्रोफ़ाइल ', 'Profile ').replace('लेवल ', 'Level ') .replace(' हिस्ट्री', ' History') .replace('बैटल पास', 'Battle Pass').replace('कलेक्शन', 'Collection').replace('दोस्त', 'Friends').replace('सभी देखें', 'View all') .replace('क्लैन वॉर', 'Clan War').replace('सिटी चैंप', 'City Champ').replace('मेंटर हब', 'Mentor Hub') .replace('पॉइंट्स', 'Points').replace('सीज़न', 'Season').replace('किल्स', 'Kills').replace('विंस', 'Wins') .replace('mini eSports में स्वागत — मैच खेलो, Coins & Diamonds जीतो !', 'Welcome to Mini eSports - Join Match Coins & Diamonds jeeto !') .replace('रैंक = विंस×40 + किल्स×2 + मैचेस×1', 'Rank = Wins×40 + Kills×2 + Matches×1') .replace('विवरण के लिए टैप करें', 'Tap for details') .replace('रूम की जानकारी मैच शुरू होने से पहले मिलेगी', 'Room details will be shared before match start') .replace('डेली मिशन्स', 'Daily Missions').replace('जमा', 'Deposits').replace('निकासियां', 'Withdrawals') .replace('जीत', 'Winnings').replace('बोनस', 'Bonus').replace('कुल: ₹', 'Total: ₹') .replace('आगामी', 'Upcoming') .replace('अभी कोई स्पेशल शेड्यूल नहीं', 'Abhi koi special scheduled nahi') .replace('अगला स्पेशल घोषित होते ही काउंटडाउन यहाँ चलेगा!', 'next special announce hote hi countdown yahan chalega!') .replace('स्लॉट (', 'Slots (').replace('% भरा)', '% Full)').replace('/किल', '/Kill') .replace('पहला इनाम', '1st PRIZE').replace('दूसरा इनाम', '2nd PRIZE').replace('तीसरा इनाम', '3rd PRIZE') .replace('कोई भी डायमंड', 'Koi bhi diamond').replace('मेंबर्स • स्कोर:', 'members • Score:') .replace('-दिन स्ट्रीक!', '-Day Streak!').replace(' सिक्के', ' Coins') .replace(' दिन पहले', 'd ago').replace(' घंटे पहले', 'h ago').replace(' मिनट पहले', 'm ago') .replace('पहली बार?', 'Pehli baar?').replace('ऑटो-क्रिएट होगा', 'auto-create hoga') .replace('रेफरल कोड शेयर करो', 'Referral Code share karo').replace('संडे', 'Sunday').replace(' दिन बाकी — ', ' din baad — ') .replace('ब्रेक सक्रिय है — ', 'Break active hai till ') .replace('दिन बाकी', 'days left').replace('din baaki', 'days left') .replace(/(\d+) दिन (\d+) घंटे/g, '$1d $2h').replace(/(\d+) घंटे (\d+) मिनट/g, '$1h $2m').replace(/(\d+) मिनट (\d+) सेकंड/g, '$1m $2s') .replace(' रेफर्ड', ' Referred').replace('रिपोर्टिंग:', 'Reporting:').replace('कुल ', 'Total ').replace(' मेंबर्स •', ' members •') .replace(' प्लेयर', ' Player') .replace('इंटरेस्ट सेव नहीं हुआ', 'Interest save nahi hua').replace('चैलेंज नहीं भेज सकी:', 'Challenge bhej nahi saki:').replace('क्लैन भरी है! (', 'Clan full hai! (') .replace('में वापस आ जाएंगे — तब तक ब्रीद करो 😄', 'me wapas aa jaayenge — tab tak breathe karo 😄').replace('वेरिफिकेशन पेंडिंग', 'Verification pending') .replace('कैसे कमाओ', 'Kaise Kamao') .replace(' जन ', ' Jan ').replace(' फर ', ' Feb ').replace(' मार्च ', ' Mar ').replace(' अप्रै ', ' Apr ') .replace(' मई ', ' May ').replace(' जून ', ' Jun ').replace(' जुल ', ' Jul ').replace(' अग ', ' Aug ') .replace(' सित ', ' Sep ').replace(' अक्टू ', ' Oct ').replace(' नव ', ' Nov ').replace(' दिस ', ' Dec ') .replace('रिवॉर्डेड ऐड देखें →', 'Rewarded Ad dekho →').replace(' तुरंत मिलेंगे', ' turant milenge').replace('रोज़ लॉगिन करें →', 'Roz login karo →').replace(' गारंटीड', ' guaranteed').replace('दोस्त को इनवाइट करें →', 'Dost ko invite karo →').replace(' दोनों को', ' dono ko').replace('दिन में 5 बार तक • हर दिन रीसेट होता है', 'Daily 5 baar tak • Har din reset hota hai').replace('प्रोफ़ाइल → रेफरल कोड शेयर करें', 'Profile → Referral Code share karo').replace('कॉइन मैच या ऐड मैच जीतें → सिक्के इनाम मिलेंगे', 'Coin Match ya Ad Match jeeto → coins prize milenge').replace('मैच रिज़ल्ट के बाद ऑटो क्रेडिट होता है', 'Match results ke baad auto credit hota hai').replace('सिक्के खरीदने की ज़रूरत नहीं — नीचे मुफ़्त कमाओ!', 'Coins kharidne ki zaroorat nahi — neeche se free earn karo!').replace('खरीदने की ज़रूरत नहीं — बस एक्टिव रहो, कमाते रहो!', 'Kharidne ki zaroorat nahi — bas active raho, earn karte raho!').replace('दिन 2 पर फाइन सिक्के', 'Day 2 par fine coins').replace('7-दिन चक्र', '7-day cycle').replace('हर 30 दिन बोनस', 'har 30 din bonus').replace(/दिन (\d+) पर इतने सिक्के/, 'Day $1 par itne coins').replace('7-दिन साइकल', '7-din cycle').replace('रैंक = ', 'Rank = ').replace('मैचेस×1', 'Matches×1').replace('🔱 वारलॉर्ड', '🔱 Warlord').replace('⚔️ स्लेयर', '⚔️ Slayer').replace('💫 एलीट', '💫 Elite').replace('🎯 स्नाइपर', '🎯 Sniper').replace('🔥 ब्लेज़', '🔥 Blaze').replace('🌟 स्टार', '🌟 Star').replace('🎖️ नाइट', '🎖️ Knight').replace('💎 स्काई', '💎 Sky').replace('📉 आउट', '📉 Out').replace('📈 इन', '📈 In').replace('🪙 कॉइन', '🪙 Coin').replace('कॉपी हो गया! ✅', 'Copied! ✅').replace('कॉपी विफल', 'Copy failed').replace(/\bजन\b/, 'Jan').replace(/\bफर\b/, 'Feb').replace(/\bमार्च\b/, 'Mar').replace(/\bअप्रै\b/, 'Apr').replace(/\bमई\b/, 'May').replace(/\bजून\b/, 'Jun').replace(/\bजुल\b/, 'Jul').replace(/\bअग\b/, 'Aug').replace(/\bसित\b/, 'Sep').replace(/\bअक्टू\b/, 'Oct').replace(/\bनव\b/, 'Nov').replace(/\bदिस\b/, 'Dec').replace(/आगे: (\d+) मैचेस जीतो/, 'Next: Win $1 मैचेस').replace(/आगे: (\d+) मैचेस/, 'Next: $1 मैचेस').replace('रैंक कैसे काम करता है', 'How Rank Works').replace('शुरुआती रैंक • अपनी स्किल्स बनाओ', 'Starting Rank • Build Your Skills').replace('अपनी बेहतरी दिखाओ', 'Show Your Improvement').replace('बेहतर खेलो • ऊपर चढ़ो', 'Play Better • Climb Higher').replace('अपनी निरंतरता साबित करो', 'Prove Your Consistency').replace('एलीट प्लेयर्स • टॉप परफॉर्मर्स', 'Elite Players • Top Performers').replace('अंतिम रैंक • लेजेंड बनो', 'The Ultimate Rank • Be a Legend').replace('वीक्ली रीसेट', 'Weekly reset').replace('हर सोमवार', 'every Monday').replace('सीज़न रीसेट', 'सीज़न reset').replace('हर महीने की 1 तारीख को', 'every 1st of month').replace('टॉप 3 बैज', 'Top 3 badges').replace('टॉप 10 टाइटल', 'Top 10 titles').replace('अचीवमेंट्स अनलॉक', 'Achievements Unlocked').replace('🏅 अचीवमेंट्स', '🏅 Achievements').replace('मैक्स लेवल!', 'Max Level!').replace('💎50 कमाओ', 'Earn 💎50').replace('🔒 लॉक्ड', '🔒 Locked').replace('1 दोस्त रेफर करो', 'Refer 1 friend').replace('ऑन फायर', 'On Fire').replace('3 दिन स्ट्रीक', '3 day streak').replace('हाई रोलर', 'High Roller').replace('🏆 लीडरबोर्ड', '🏆 Leaderboard').replace('मेरा शहर', 'My City').replace('🆘 सहायता और सपोर्ट', '🆘 Help & Support').replace('ऑनलाइन अभी', 'Online abhi').replace('मैच विवाद', 'Match Dispute').replace('सपोर्ट चैट', 'Support Chat').replace('सपोर्ट टिकट्स', 'Support Tickets').replace('नया टिकट + एडमिन जवाब', 'New ticket + admin replies').replace('🔑 कोड से जॉइन', '🔑 Code se Join').replace('आपका बैलेंस', 'Your Balance').replace('🎯 प्रो प्लेयर टैग', '🎯 PRO PLAYER tag').replace('🎯 प्रो प्लेयर', '🎯 PRO PLAYER').replace('👑 किंग टैग', '👑 KING tag').replace('👑 किंग', '👑 KING').replace('VIP स्लॉट पास', 'VIP Slot Pass').replace('⭐ VIP बैज अपने प्रोफ़ाइल पर', '⭐ VIP badge apne profile par').replace('⚡ बीस्ट मोड टैग', '⚡ BEAST MODE tag').replace('⚡ बीस्ट मोड', '⚡ BEAST MODE').replace('जलती फायर बॉर्डर', 'Jalti Fire border').replace('नीयॉन ग्लो बॉर्डर', 'Neon glow border').replace('गैलेक्सी पर्पल ग्लो', 'Galaxy purple glow').replace('ब्रॉन्ज़ रिंग', 'Bronze Ring').replace('गोल्ड रिंग', 'Gold Ring').replace('प्लेटिनम रिंग', 'Platinum Ring').replace('लेजेंड रिंग', 'Legend Ring').replace('प्रीमियम गोल्ड रिंग', 'Premium Gold Ring').replace('रैंक रिंग — ब्रॉन्ज़ (अवतार मेडल)', 'Rank Ring — Bronze (avatar medal)').replace('रैंक रिंग — गोल्ड (अवतार मेडल)', 'Rank Ring — Gold (avatar medal)').replace('रैंक रिंग — प्लेटिनम (अवतार मेडल)', 'Rank Ring — Platinum (avatar medal)').replace('रैंक रिंग — लेजेंड (अवतार मेडल)', 'Rank Ring — Legend (avatar medal)').replace('प्रीमियम रिंग — गोल्ड (अवतार मेडल)', 'Premium Ring — Gold (avatar medal)').replace('🎖️ स्टार्टर बैज', '🎖️ Starter Badge').replace('💎 कॉस्मेटिक्स स्टोर', '💎 Cosmetics Store').replace('बैटल पास रिवॉर्ड', 'बैटल पास reward').replace('🎫 सीज़न पास रिवॉर्ड', '🎫 सीज़न Pass reward').replace('🌟 चुज़न वन', '🌟 Chosen One').replace('🔥 फायर पैक', '🔥 Fire Pack').replace('⚡ लाइटनिंग पैक', '⚡ Lightning Pack').replace('🟣 पर्पल हेज़ बॉर्डर', '🟣 Purple Haze Border').replace('🎖️ वेटेरन', '🎖️ Veteran').replace('👑 क्राउन पैक', '👑 Crown Pack').replace('🌊 ओशन वेव बॉर्डर', '🌊 Ocean Wave Border').replace('⚡ इमॉर्टल', '⚡ Immortal').replace('🔴 फायर गॉड पैक', '🔴 Fire God Pack').replace('🌌 गैलेक्सी बॉर्डर', '🌌 Galaxy Border').replace('☠️ रीपर (सीज़न लेजेंड)', '☠️ Reaper (सीज़न Legend)').replace('ब्रॉन्ज़ वॉरियर', 'Bronze Warrior').replace('🎖️ पार्टिसिपेंट', '🎖️ Participant').replace('💪 ग्राइंडर', '💪 Grinder').replace('💀 डेथ ब्रिंगर', '💀 Death Bringer').replace('विनस्ट्रीक×10', 'WinStreak×10').replace('👑 मेरा कलेक्शन (टाइटल्स + बैज) ➤', '👑 My कलेक्शन (Titles + Badges) ➤').replace('रिज़ल्ट/प्राइज़/रूम की शिकायत', 'Result/prize/room ki shikayat').replace('एडमिन से सीधी बात', 'Admin se seedhi baat').replace('ऐप सुधार के सुझाव', 'App sudhaar ke sujhav').replace('विनस्ट्रीक×10', 'WinStreak×10').replace('ब्रॉन्ज़ वॉरियर', 'Bronze Warrior').replace('बैटल पास सीज़न रिवॉर्ड', 'बैटल पास सीज़न reward');
  }

  function applyLang() {
    var lang = 'hi';
    try { lang = window._lang || localStorage.getItem('appLang') || 'hi'; } catch (e) {}
    var map = lang === 'hi' ? EN2HI : HI2EN;
    try { document.documentElement.setAttribute('lang', lang === 'hi' ? 'hi' : 'en'); } catch (e) {}
    /* TEXT-NODE level swap — icon+text wale parents bhi cover hote hain */
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    var n;
    while ((n = walker.nextNode())) {
      var raw = n.nodeValue || '';
      var t = raw.trim();
      var longMap = lang === 'hi' ? LONG_HI : LONG_EN;
      if (longMap[t]) { n.nodeValue = raw.replace(t, longMap[t]); continue; }
      if (t.length > 44) { var vL = tickSwap(raw, lang); if (vL === raw) vL = lang === 'hi' ? compHi(raw) : compEn(raw); if (vL !== raw) { n.nodeValue = vL; } continue; }
      if (!t) continue;
      var hit = map[t];
      if (hit) { n.nodeValue = raw.replace(t, hit); continue; }
      var v = lang === 'hi' ? compHi(raw) : compEn(raw);
      if (v !== raw) n.nodeValue = v;
    }
    /* ✅ D103 z22: baked-English image assets → Hindi variants */
    swapBakedAssets(lang);
    /* ATTRIBUTE pass — title/aria-label/placeholder */
    try {
      var amap = lang === 'hi' ? ATTR_HI : ATTR_EN;
      document.querySelectorAll('[placeholder],[title],[aria-label]').forEach(function (el) {
        ['placeholder','title','aria-label'].forEach(function (a) {
          var v = el.getAttribute(a); if (!v) return;
          var t = v.trim(); if (!t || t.length > 44) return;
          var hit = amap[t];
          if (hit) { el.setAttribute(a, v.replace(t, hit)); return; }
          var w = v;
          if (lang === 'hi') w = w.replace('Your Rank Tier — ', 'आपका रैंक टियर — ').replace('equip karne ke liye tap karo', 'सज्ज करने के लिए टैप करो').replace('Veteran — ', 'वेटेरन — ');
          else w = w.replace('आपका रैंक टियर — ', 'Your Rank Tier — ').replace('सज्ज करने के लिए टैप करो', 'equip karne ke liye tap karo').replace('वेटेरन — ', 'Veteran — ');
          if (w !== v) el.setAttribute(a, w);
        });
      });
    } catch (e) {}
  }
  /* ══════════════════════════════════════════════════════════════════════
     ✅ D103 r7c FIX (15-Nov-2026) — HINDI-MODE RENDERER CRASH (P0)
     ──────────────────────────────────────────────────────────────────────
     BUG: MutationObserver poore document.body par {childList, subtree,
       characterData} observe karta tha, aur applyLang() KHUD text nodes
       likhta hai (n.nodeValue = ...). Har likhawat observer ko fire karti
       thi → 350 ms baad phir applyLang → phir likhawat → BE-ANT LOOP.
       English mode me map (HI2EN) UI text se match hi nahi karta ⇒ koi
       mutation nahi ⇒ loop chalu hi nahi hota. Isliye crash SIRF Hindi me.
     LIVE PROOF (qa4 account, live Pages):
       • i18n-apply.js load hone diya → notif screen par renderer
         "Target crashed" (3 baar reproduce: ix3, ix1, ix1)
       • i18n-apply.js BLOCK kiya (page.route abort) → 9/9 screens,
         0 findings, 0 crash
       ⇒ culprit isi file ka self-triggering loop tha.
     FIX (teen layer, translation behaviour bilkul same rakha):
       1) applying-flag + observer.disconnect() apply ke dauraan → apni
          khud ki mutations observe hi nahi hoti (loop ki jad khatam).
          Flag macrotask (setTimeout 0) me clear hota hai kyunki mutation
          records microtask me deliver hote hain → beech ke records ignore.
       2) Rate-limit: do full walks ke beech kam se kam MIN_GAP ms.
       3) document.hidden par kaam nahi (background tab me CPU/ battery
          waste band), aur visibilitychange par ek fresh apply.
     ══════════════════════════════════════════════════════════════════════ */
  var tid = null;
  var applying = false;
  var lastRun = 0;
  var MIN_GAP = 900;                 /* ms — pehle 350 tha, koi limit nahi thi */
  var mo = null;
  var MO_OPTS = { childList: true, subtree: true, characterData: true };

  function safeApply() {
    if (applying) return;
    applying = true;
    if (mo) { try { mo.disconnect(); } catch (e) {} }
    try { applyLang(); } catch (e) {}
    lastRun = Date.now();
    setTimeout(function () {
      applying = false;
      if (mo) { try { mo.observe(document.body, MO_OPTS); } catch (e) {} }
    }, 0);
  }

  function queue() {
    if (applying) return;                       /* ✅ self-trigger ignore */
    try { if (document.hidden) return; } catch (e) {}
    if (tid) clearTimeout(tid);
    var wait = Math.max(350, MIN_GAP - (Date.now() - lastRun));
    tid = setTimeout(function () { tid = null; safeApply(); }, wait);
  }

  function boot() {
    safeApply();
    try {
      mo = new MutationObserver(queue);
      mo.observe(document.body, MO_OPTS);
    } catch (e) { setInterval(function () { if (!applying) safeApply(); }, 4000); }
    var _sl = window.setLanguage;
    window.setLanguage = function (l) { var r = _sl && _sl(l); setTimeout(safeApply, 60); return r; };
    document.addEventListener('DOMContentLoaded', safeApply);
    try {
      document.addEventListener('visibilitychange', function () {
        if (!document.hidden) { lastRun = 0; queue(); }   /* wapas aane par fresh */
      });
    } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  /* ✅ D103 z22: async-render leak fix — DB listener render ke BAAD node bante hain
     (home match-cards etc.) jo applyLang miss kar deta tha. childList-only
     MutationObserver (characterData observe NAHI — purana infinite loop wahin
     se aata tha) + 260ms debounce: naye added nodes par apply lag jaata hai. */
  try {
    var _moT = null;
    var _mo = new MutationObserver(function (muts) {
      var add = false;
      for (var i = 0; i < muts.length; i++) { if (muts[i].addedNodes && muts[i].addedNodes.length) { add = true; break; } }
      if (!add) return;
      if (_moT) clearTimeout(_moT);
      _moT = setTimeout(function () { _moT = null; try { safeApply(); } catch (e) {} }, 260);
    });
    _mo.observe(document.body, { childList: true, subtree: true });
  } catch (e) {}

  window._i18nApply = safeApply;            /* guarded entry (pehle raw applyLang tha) */
  window._i18nApplyRaw = applyLang;         /* tests/debug ke liye raw */
  /* ✅ deploy-marker: numeric literal obfuscation ke baad bhi grep ho sakta
     hai (strings base64 ho jate hain, numbers nahi) ⇒ live Pages par fix
     pahuncha ya nahi, ek curl me confirm hota hai. */
  window._i18nFixRev = 20261115;
})();
