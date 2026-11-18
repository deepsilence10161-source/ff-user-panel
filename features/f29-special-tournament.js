/* ================================================================
   F29 SPECIAL TOURNAMENT — Sunday / Monthly Special helper
   R25 restore (2026-09-21)
   ================================================================
   Ye object pehle KABHI define nahi hua tha, lekin teen jagah guard
   se call hota tha (sab safe-guarded, isliye koi JS error nahi aati
   thi — feature silently absent tha):

     1. screens/join.js: doJoin() →
        window.f29SpecialTournament.checkEligibility(t, callback)
     2. screens/home.js: match card →
        window.f29SpecialTournament.getEligibilityInfo(t)  → HTML string
     3. js/features-user.js: match history →
        window.f29SpecialTournament.getSpecialBadge(t)     → HTML string

   DATA-ROOT (live-verified): matches table ke columns
     is_special boolean, special_category text ('sunday_special' |
     'monthly_special'), min_rank text.
   Match object side: t.isSundaySpecial / t.isMonthlySpecial booleans
   + t.specialCategory + t.minRank (admin create/edit इन्हें set karta).

   ELIGIBILITY RULE: sirf wahi gate jo panel ke paas actually hai —
   OPTIONAL minRank (join.js mein already `if (t.minRank)` rank-gate
   hai — isliye checkEligibility (a) utna hi enforce karta hai, (b)
   sirf then hi allow karta hai jab sab-required data set ho, aur (c)
   verification-photo zariya leaderboards-publish (result) ke liye
   client ko qualify karta hai. Koi invented condition nahi hai.
================================================================ */
(function(){
  'use strict';

  /* ── छोटे सहायक (dusre modules ke samaan; koi naya dependency nahi) ── */
  function is55(){ return !!window.U; } /* signed-in */
  function uid(){ return window.U && window.U.uid; }

  /* ── कौन-sa special type hai ── */
  function kindOf(t){
    if (!t) return null;
    if (t.isSundaySpecial || t.specialCategory === 'sunday_special' || t.specialType === 'sunday_special') return 'sunday';
    if (t.isMonthlySpecial || t.specialCategory === 'monthly_special' || t.specialType === 'monthly_special') return 'monthly';
    return null;
  }

  /* ── match-object से min-rank (data-परत: t.minRank) ── */
  function minRankOf(t){ return (t && t.minRank) || null; }

  function myRank(ud){
    /* Rank byaaj: same source join.js use karta hai — UD.stats → calcRk */
    var myStats = (ud && ud.stats) ? ud.stats : {};
    if (window.calcRk && typeof window.calcRk === 'function') {
      try { return window.calcRk(myStats) || { badge:'Bronze' }; }
      catch(e){ return { badge:'Bronze' }; }
    }
    return { badge: (ud && ud.rank) || 'Bronze' };
  }

  var RANK_ORDER = { 'Bronze':1, 'Silver':2, 'Gold':3, 'Platinum':4, 'Diamond':5, 'Heroic':6, 'Legend':7, 'Grandmaster':8 };

  function reqRankVal(r){ return (RANK_ORDER[r] || 1); }

  /* ── बैज: match-history ke liye ──
     Sirf label — poora render karta hai jab tak type-index known ho. */
  function getSpecialBadge(t){
    if (!t) return '';
    var k = kindOf(t);
    if (k === 'sunday') {
      return '<span style="display:inline-block;background:linear-gradient(135deg,#b964ff,#00d4ff);color:#fff;font-size:9px;font-weight:900;padding:2px 7px;border-radius:20px;letter-spacing:.3px">⭐ SUNDAY SPECIAL</span>';
    }
    if (k === 'monthly') {
      return '<span style="display:inline-block;background:linear-gradient(135deg,#ffd700,#ff8c00);color:#000;font-size:9px;font-weight:900;padding:2px 7px;border-radius:20px;letter-spacing:.3px">👑 MONTHLY SPECIAL</span>';
    }
    return '';
  }

  /* ── home-match-card के लिए सूचना-पट्टी ── */
  function getEligibilityInfo(t){
    if (!t) return '';
    var k = kindOf(t);
    if (!k) return '';
    var label = (k === 'sunday') ? '⭐ Sunday Special' : '👑 Monthly Special';
    var h = '<div style="margin-top:6px;font-size:10px;color:var(--txt2);background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:9px;padding:6px 8px">';
    h += '<b style="color:var(--txt)">' + label + '</b> — special tournament match';
    var mrank = minRankOf(t);
    if (mrank) h += '<br><i class="fas fa-medal" style="color:#ffd700"></i> <span style="color:#ffd700">' + mrank + '+</span> rank chahiye';
    h += '</div>';
    return h;
  }

  /* ── join-eligibility: callback(ok, reason) ── */
  function checkEligibility(t, cb){
    var done = (typeof cb === 'function') ? cb : function(){};
    if (!is55()) { done(false, 'Login karo pehle'); return; }
    if (!kindOf(t)) { done(true); return; }

    var ud = window.UD || {};
    var mrank = minRankOf(t);
    if (mrank) {
      var mine = reqRankVal(myRank(ud).badge);
      var need = reqRankVal(mrank);
      if (mine < need) {
        done(false, 'Sunday/Monthly Special ke liye minimum ' + mrank + ' rank chahiye — matches khelo aur rank badhao!');
        return;
      }
    }
    /* मौजूदा-panel-नियम: ad-entry के matches पर cJoin ad-gate ले लेता
       है; special-matches में special-category बिना किसी hidden-fee के
       नॉर्मल-entry rules follow करती हैं। */
    done(true);
  }

  /* ── API पंजीकरण ── */
  window.f29SpecialTournament = {
    getSpecialBadge: getSpecialBadge,
    getEligibilityInfo: getEligibilityInfo,
    checkEligibility: checkEligibility,
    kindOf: kindOf
  };

  console.log('[F29] Special Tournament helper loaded (R25)');
})();
