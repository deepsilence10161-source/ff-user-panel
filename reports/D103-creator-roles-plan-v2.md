# D103-PLAN v2: Creator Economy — "creator kya-kya kar sakega", owner-kaam NA badhe, GHATA zero
**Status: PLAN ONLY — owner approval ke baad hi kaam (owner order 16-Nov: "pahle maximum research kar")**
**Supersedes:** v1 (`D103-creator-revshare-plan.md`) ko extend karta hai, replace nahi (rates/legal/halal wahi rahenge).

---

## 0) Sabse badi khoj: hamara creator system PEHLE SE BANA hai — bas chalaaya nahi gaya
Live DB (16-Nov snapshot) + source scan se proof:

| Cheez | Status |
|---|---|
| DB tables | `creator_applications`, `creator_codes`, `creator_commissions`, `creator_matches` (commission_pct/type/amount/status/**hold_until**), `creator_payouts` (eligible→pending→paid), `creator_follows`, `creator_match_ratings`, `creator_result_flags`, `creator_showcase`, `creator_stats`, `creator_videos` (platform/link/status/report_count) |
| User panel | `features/creator-match-host.js` (match banana: entry ≤₹50, ≤100 slots, ≤3 active; prize ≤ max collection; prize hamesha **Green Diamond**, Sky Diamond sirf entry), `features/premium-creator.js` (dashboard, earnings, payout request `claim_match_commission_payout`), `features/spectator.js` + `watch-earn.js`, showcase |
| Admin panel | `creatorApplications`, `creatorMatchReview`, `sponsoredTournaments`, mentor/clan/city sections |
| Live config (`app_settings.creator_system`) | `sdMatchCommissionPct: 15`, `commissionHoldDays: 7`, `maxCreatorMatches: 3`, `creatorMatchEnabled: 1`, `creatorFreeMode: 1` |
| **Live usage** | applications **2** (approved **1**), codes **1** (uses **0**), hosted matches **4**, commissions **₹0**, payouts **0**, videos **0**, follows **7**, ratings **0**, flags **0** |

**Matlab:** owner ka idea naya nahi hai — uska **engine already laga hai**, bas (a) incentive chhota tha (sirf hosted SD match par 15%), (b) creators ko laya/promote nahi gaya, (c) payout rail manual tha. Plan v2 = **engine ko fuel + gauge dena**, naya vehicle banana nahi.

---

## 1) Creator KYA-KYA kar sakega (poora role catalogue, Instagram-style system ke barabar)

| # | Role / kaam | App me kahan hai | Creator ko kya milega | Hamara cost | Owner kaam | Fraud risk | Verdict |
|---|---|---|---|---|---|---|---|
| R1 | **Match host karna** (custom room banana, players bharna, result submit) | ✅ BANA HUA (`creator-match-host.js`, admin review) | hosted SD-match ke SD-spend ka **15% → tier 20/25%** | sirf jo revenue aaya uska % | result review **sirf flagged cases** (auto-verify baaki) | wash-trade **khud ghate me** (niche §3) | **Phase 1 — activate + tier** |
| R2 | **Users lana** (creator code signup par; reel/QR/deep-link) | ✅ code system bana hai; attribution sirf hosted-match tak limited tha | referred user ke **poore NET spend ka 10/12/15%** (tier), lifetime lock | % of net (aane ke baad) | zero (auto ledger) | self-referral → device/PAN/UPI match block | **Phase 1 — expand attribution** |
| R3 | **Video/content banakar app par + bahar dalna** (reels, shorts) | ✅ `creator_videos` + `creator_showcase` bana hai | monthly **content bonus pool** (fixed ₹2–5k, top-3) + code-tags se R2 commission | **fixed budget = capped loss** | pool judgment mahine me 15 min | view-fake → proof = platform analytics screenshot + report_count | **Phase 1 (pool pilot)** |
| R4 | **Live stream / spectate sessions** | ✅ premium perk + spectator + watch-earn | Phase 2: **viewer gifts** (diamonds → creator 70% / platform 30%, Instagram-gifts jaisa) | ~0 (virtual goods) | moderation queue (reports auto) | gift-wash → GD non-cashable ⇒ self-defeating | **Phase 2** |
| R5 | **Coaching / mentor** | ✅ mentor hub bana hai | mentee ke **premium sub ka 20%** (pehle 90 din) | % of new premium revenue | zero | fake mentee → sub hi proof hai | **Phase 2** |
| R6 | **Community chlana / moderation me madad** (clan leader, city-champ host) | ✅ clan/city sections | **non-cash perks** (badge, cosmetics, slot priority) + quarterly bonus pool | fixed pool | **ulta kam hota hai** (kaam delegate) | low | **Phase 1 (perks)** |
| R7 | **Local sponsor lana** tournament ke liye | ✅ `sponsoredTournaments` bana hai | sponsor amount ka **10–15% brokerage** | 0 (sponsor ka paisa) | contract sign only | invoice fraud → sponsor se direct confirm | **Phase 2** |
| R8 | **Quality loop** (players creator ke match ko rate karte hain) | ✅ `creator_match_ratings` bana hai | rating ≥4 ⇒ tier-promotion; <3 ⇒ pct cut/suspend | 0 | **zero (self-policing)** | rating-farm → 1-user-1-rating + device check | **Phase 1 (rules on)** |

**Instagram-vs-us mapping (owner ka sawaal):**
| Instagram tool | Hamara equivalent | Kab |
|---|---|---|
| Reels Bonuses | monthly content bonus pool | P1 |
| Gifts (Stars) | viewer gifts on stream/match | P2 |
| Badges in Live | supporter badge in match chat | P2 |
| Subscriptions | creator fan-club (paid) | P3 |
| Affiliate tags | creator code auto-tag kit (QR/reel template) | P1 |
| Brand deals / marketplace | creator-brought sponsors + application portal | P2 |
| **Jo Insta me nahi hai** | **match-hosting commission + mentor share** (hamara core) | P1/P2 |

---

## 2) Owner ka kaam BADHEGA? — nahi, ulta GHATEGA (workload math)

| Kaam | Aaj (manual) | Plan ke baad | Owner time |
|---|---|---|---|
| Creator approval | har application khud dekhna | **auto-approve** objective criteria par (channel URL + followers ≥ threshold + PAN KYC complete); admin sirf exceptions | ~0 |
| Match result verify | har match | **auto-verify** jab `creator_result_flags` = 0 aur stats normal; admin sirf flagged (existing design hi yehi kehta hai: "sirf suspicious cases Admin dekhta hai") | ~5 min/week |
| Fraud review | koi system nahi | **auto-hold (7→30 din first payout)** + velocity rules + clawback auto; review queue sirf high-confidence | ~10 min/week |
| Payout | har request alag se | **monthly batch**: auto-generated UPI list + TDS auto-cut; ek bulk action | ~20 min/**month** |
| Support/questions | owner ke paas | creator FAQ + dashboard self-serve + auto-responses | ~5 min/week |
| Content/bonus pool judge | — | mahine me ek 15-min review (top-3 proof) | 15 min/month |
| **Total steady-state** | — | — | **≈ 45–60 min/MAHINA + exceptions** |

Owner ki 12-ghante-duty reality ke liye yehi model fit hai: **system chalaye, owner sirf exceptions dekhe.**

---

## 3) "Galti se bhi GHATA na ho" — zero-loss guardrails (har ek ka reason)

| # | Guardrail | Kyun ghata rokta hai |
|---|---|---|
| 1 | Commission **sirf NET revenue** par (prize/payment-fee/refund katne ke baad); gross par kabhi nahi | margin ke bahar ek rupya nahi jaata |
| 2 | **Wash-trade self-defeating**: prize **Green Diamond** me milta hai jo **cash-out nahi** hota; fraudster ko real ₹ se SD kharidna padta hai jabki commission sirf 15–25% ⇒ har cycle me **75–85% nuksaan** | fraud economically bekar |
| 3 | `commissionHoldDays` 7 (existing) → **first payout par 30 din hold**; refund/chargeback par **auto-clawback** | stolen-card window cover |
| 4 | Per-creator beta cap **₹25,000/mahina**; total creator payout ≤ **35% of monthly NET** (auto-throttle) | worst-case bounded |
| 5 | Bonus pools = **fixed pre-approved budget** (₹2–5k/mahina) | loss by definition capped |
| 6 | CPA (beta ₹30/first-payer) sirf **verified first purchase + 72h no-refund** ke baad | fake-payer farming block |
| 7 | Self-referral block: device/PAN/UPI/PIN-cluster match; velocity caps (device/IP/day) | sybil farms block |
| 8 | **TDS 194H 5% + PAN gate** (no PAN = 20%); GST-threshold note creator contract me | tax-penalty loss block |
| 9 | **E-sports registration** (Online Gaming Act 2025, Rule 12) + Rule-9-compliant fee/prize structure | existential legal loss block |
| 10 | **Koi retroactive rate-change nahi** (halal + trust); tier-change sirf future cohorts par | dispute/chargeback-loss block |
| 11 | Kill-switches: payout-ratio >35% do mahine ⇒ auto-throttle; fraud-flags >5% ⇒ program freeze review; creator LTV:commission <2.5 ⇒ tier downgrade | systemic loss early cut |
| 12 | Prize-pool cap server-side (prize ≤ max collection) — **already enforced** (`creator_create_match`) | over-payout impossible |

**Worst-case simulation (beta, 10 creators):** sab fraud nikle ⇒ 30-din hold me sab commission frozen ⇒ paid = ₹0; jo CPA gaya wo ≤ 10×₹30=₹300 per creator-cluster rules se block zyada tar ⇒ **max theoretical loss ≈ bonus pool (₹5k) + kuch CPA (≤₹1k) = ₹6k**, wo bhi flags se pehle hold ho jaata hai. Normal case me loss = 0 kyunki har payout revenue ke BAAD hota hai.

---

## 4) Rates (v1 se update, existing config se mapped)

| Stream | Aaj (live config) | Plan |
|---|---|---|
| Hosted SD-match commission (`sdMatchCommissionPct`) | **15%** | tier: **15 → 20 → 25** (rating ≥4 + volume se promote; `creator_matches.commission_pct` per-match already store hota hai) |
| Referred-user NET rev-share | **0** (sirf hosted match tak limited) | **10 / 12 / 15%** tier, lifetime first-touch lock |
| Stack cap (R1+R2 ek hi user par) | — | **≤30% of us user ke NET** |
| Content bonus pool | 0 | ₹2–5k/mahina fixed (top-3) |
| Sponsor brokerage | 0 | 10–15% |
| Mentor share | 0 | 20% of mentee premium (90 din) |
| Gifts (P2) | 0 | creator 70% / platform 30% |
| Payout floor / batch | manual | ₹500 floor, monthly batch, TDS auto |

**Example (mid creator, month 3):** hosted matches SD-spend ₹4,000 ⇒ 20% = ₹800; referred cohort NET ₹3,500 ⇒ 12% = ₹420; pool top-3 = ₹1,500 ⇒ **₹2,720/mahina** — itna kisi aur Indian gaming app me nahi milta (WinZO ₹55–80 one-time), isliye creator **hamare liye kaam karega**.

---

## 5) Phases (existing system ko activate karna — naya build minimal)

| Phase | Time | Kaam (zyada tar config + docs + chhota code) |
|---|---|---|
| **P0** | wk 1–2 | creator_system config me tiers add; Creator Agreement (hi+en, halal clauses, disclosure line); CA/TDS setup; e-sports registration file; auto-approve rules doc; marketing kit (reel templates + QR + code-tag kit); fraud rules live |
| **P1** | wk 3–6 | 5–10 creators onboard (existing applications + outreach); **R2 attribution expand** (ledger column + dashboard view); R8 rating-rules on; R6 perks; content pool pilot; monthly payout batch process; kill-switch dashboard |
| **P2** | mo 2–3 | gifts (R4), mentor share (R5), sponsor flow (R7), tier auto-promotion, supporter badges |
| **P3** | mo 4+ | fan-club subscriptions, creator-hosted league (engagement-pool pilot), creator marketplace page |

**Har phase ka exit-gate:** payout-ratio ≤35% NET, fraud-flags <2%, ≥3 creators ko ≥₹500 payout, owner-time ≤1h/mahina (self-report log).

---

## 6) Owner ke teen sawaalon ke seedhe jawab
1. **"Creator kya-kya kar sakega?"** → 8 roles upar (§1); 4 role **aaj ke app me already live** hain (host, code, videos/showcase, ratings), 4 chhote additions hain (pool, gifts, mentor, sponsor).
2. **"Mera kaam/problem to nahi badhega?"** → nahi: §2 ke mutabiq steady-state **≈45–60 min/mahina**; aaj jo manual kaam hai wo auto/delegate ho jaata hai.
3. **"Galti se bhi ghata na ho?"** → §3 ke 12 guardrails; worst-case bounded ≈₹6k (beta), normal case ₹0-loss kyunki **har payout revenue ke baad** hota hai aur wash-trade fraudster ke liye hi ghate ka sauda hai.

**Abhi kuch CODE nahi chhedna.** Owner "ha" kahega to P0 se shuru.
