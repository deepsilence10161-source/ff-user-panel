# D103-PLAN v3 (FINAL DRAFT — owner decisions incorporated, 16-Nov-2026)
**Status: kaam tabhi shuru hoga jab owner "ha" kahe. Ye file v1+v2 ko replace karti hai.**

## Owner ke 5 faisle (is message me mile)
1. Hosted match commission **15/20/25%** — ya meri taraf se hamari income ke according set; **percent creator ki rating par depend karega** ("sahi hai na?" ⇒ **haan, sahi hai** — niche exact rules).
2. Laaye hue users ki **poori income** ka maximum plan, **kahi koi problem na ho** — double-payment ka risk khud owner ne pakda ("creator ko SD spending par paise mil rahe hain, fir bhi dekh perfectly") ⇒ **One-Rupee-One-Commission rule** niche.
3. **Video ka paisa hamari taraf se NAHI** — creator ko video ka paisa YouTube/us platform se milega ⇒ content bonus pool **hataya** (₹0 cost).
4. **Coaching/mentor saanjh (share) rahegi** ⇒ mentee premium ka 20% (90 din) barqarar.
5. **Creator auto-approve system high-advanced**; channel-url field me **sirf channel URL** (koi aur link nahi); **TDS jaisa kaam app chalne ke baad** (Phase 2).

---

## A) Rating-based commission tiers (hosted SD matches) — exact rules
`creator_match_ratings` (stars 1–5, 1 rating per player per match) + `creator_result_flags` par based.

| Creator ki halat | Commission (`creator_matches.commission_pct`) |
|---|---|
| Naya (pehle 3 matches, koi rating nahi) | **15%** |
| Rolling rating (pichhle 30 din, ≥5 ratings) **≥4.5** + 0 flags | **25%** |
| Rating **≥4.0** + 0 flags | **20%** |
| Rating **≥3.5** | **15%** |
| Rating **<3.5** | **10%** (probation) |
| Rating **<3.0** ya 2 flagged results lagatar | hosting **suspend** (admin review) |

**Margin check (owner: "percent hamari income ke according"):** SD match ka cash margin ≈ spend − payment fee (~2%) − ₹0 prize-cash (prize **Green Diamond** me, jo cash-out nahi hota) ⇒ 25% bhi safe. GD inflation ko rokne ke liye **GD sinks** roadmap me: cosmetics/titles GD se kharidne ka option (Phase 2), taaki prize-GD wapas burn ho.
**Rating-manipulation guards:** rater ko wo match khela hona zaroori; 1 user = 1 rating per match; device-cluster dedup; naye (<7 din) accounts ki ratings weight 0.5; creator khud apne match me rater nahi; din me ≤20 ratings count.

## B) Referred-users "poori income" stream — MAXIMUM plan, ZERO problems
**Base (NET) =** referred user ki: SD purchases + premium subscription + (coin packs agar bikte hain) + attributed ad revenue
**minus:** refunds/chargebacks, payment fee, us cohort ke prizes/bonuses jo platform ne fund kiye,
**minus (One-Rupee-One-Commission):** wo SD-spend jis par **hosted-match commission (R1) already ban chuka hai** — ledger me har commission row `stream` tag rakhti hai (`host` / `referral`), R2 calculation R1-tagged spend ko auto-exclude karti hai. **Ek rupya do baar commission nahi dega.**

| Rule | Kya | Problem rokta hai |
|---|---|---|
| B1 | First-touch permanent lock: signup par code (7-din window, QR/deep-link auto-fill) | attribution disputes |
| B2 | Rates: **10% → 12% (≥50 active referred) → 15% (≥150 active ya cohort NET ≥₹30k/mo)**; promotion ke liye rating ≥4.0 zaroori | margin + quality |
| B3 | **Stack cap:** same user-month par R1+R2 ≤ **30%** of us user ke NET | double-dip margin erosion |
| B4 | Real-user gate: device-unique install, creator ke device/PAN/UPI cluster se match ⇒ exclude; velocity caps (device/IP/day) | self-referral/sybil |
| B5 | Wash-trade self-defeating: ₹100 kharido ⇒ 10–15% wapas ⇒ 85–90% nuksaan; + refund par **auto-clawback** | farming |
| B6 | **30-din hold** har accrual par; first payout ≥₹500; monthly batch | stolen-card window |
| B7 | **Auto-brake:** mahine ka total creator payout (R1+R2+mentor) > **35% of platform NET** ⇒ agla mahina tiers −5pp auto | systemic loss |
| B8 | Per-creator beta cap ₹25,000/mahina (Phase 1) | bounded exposure |
| B9 | Creator dashboard me per-user masked ledger (kaun, kab, kitna NET, kitna commission) | disputes, trust, halal-transparency |
| B10 | Koi retroactive rate-change nahi; tier-change sirf future months se | halal (gharar) + trust |
| B11 | GD kabhi commission-base me nahi (wo bikta nahi); sirf real-money/real-revenue streams | fake base |
| B12 | Kill-switch: fraud-flags >5% ⇒ program freeze + review | systemic |

**Worst-case:** sab rules ke baad bhi sab fraud nikle ⇒ hold me sab frozen ⇒ paid ₹0; theoretical max loss = clawback-window me gaya CPA-jaisa kuch nahi (R2 me CPA nahi) ⇒ **≈₹0**. Normal case: har payout revenue ke baad ⇒ **ghata impossible by design**.

## C) Video/content = ₹0 hamari taraf se
- Creator ki video income = **YouTube/Instagram/us platform** se (owner decision).
- App me video feature sirf: (a) showcase/profile, (b) **code-tag kit** (reel template + QR + auto caption jisme creator code) ⇒ attribution tool, (c) `creator_videos` status/reports (spam control).
- Content bonus pool **removed** ⇒ hamara cost ₹0, owner ka pool-judge kaam bhi ₹0.

## D) Mentor/coaching saanjh
- Mentee ki **premium subscription ka 20%**, pehle **90 din**, mentor ko (server-side ledger).
- Guards: mentee-manipulation (ek mentee = ek mentor, device cluster check), refund par clawback, B7 cap me included.

## E) Auto-approve system (high-advanced) + strict channel-URL
**URL allowlist (sirf channel URLs):**
- Accept: `https://www.youtube.com/@handle`, `/channel/UC…`, `m.youtube.com/@handle`, `https://www.instagram.com/username/` (aur inke www-/no-www roop).
- **Reject:** `watch?v=`, `/shorts/`, `/playlist?`, `/posts/`, `/reel/`, t.me, wa.me, facebook.com, bit.ly/shorteners, IP addresses, http (non-HTTPS), queries/utm (strip karne ke baad bhi path allowed na ho), koi bhi doosra domain.
- Normalize → validate → **server-side re-check** (approval cron) taaki client bypass na ho sake.

**Auto-approve score (0–100), threshold ≥70 par auto-approve + code issue; warna manual queue (pre-filled report admin ko):**
| Signal | Weight | Source |
|---|---|---|
| Channel exists + public | 20 | fetch/oEmbed |
| Videos ≥3 (YT) / posts ≥9 (IG) | 15 | page parse |
| Subscribers/followers ≥1,000 (YT) / ≥2,000 (IG) | 20 | parse |
| Gaming-content keyword score ≥2 (Free Fire/FF/BGMI/gaming…) | 15 | titles/description |
| Channel age ≥6 mahine (first upload) | 10 | parse |
| Duplicate channel-url across applications = **auto-reject** | gate | DB check |
| Spam burst (≥10 uploads/day kabhi) ⇒ −20 | −20 | parse |
| PAN + KYC complete | gate | payout form |
**Probation:** auto-approved creator ke pehle 30 din commission hold 30-din; rating gate lagu.
**Sab decisions logged** (`review_note` auto-reason ke saath) ⇒ owner ko sirf exceptions dikhte hain.

## F) TDS timing (owner: "app chalne ke baad")
- Phase 1 me: PAN payout-request par collect (bank/UPI transfer ke liye zaroori anyway); 194H threshold ₹15,000/FY/payee — beta caps ke zyada tar cases me cross hi nahi hoga.
- Agar koi payee ₹15k FY cross kare Phase 1 me: **batch sheet me 5% manual cut** (CA process) — automation Phase 2 me (`creator_payouts` se auto TDS calc + 26Q export).
- GST: creator ki side ka matter (turnover >₹20L par unki registration); contract me note.

## G) Phases (final)
| Phase | Scope |
|---|---|
| **P0 (wk1–2)** | config me tiers+rating rules; Creator Agreement (hi/en: halal clauses, disclosure line, no-retro); auto-approve rules + URL allowlist code; marketing/code-tag kit; e-sports registration file; GD-sink roadmap note |
| **P1 (wk3–6)** | 5–10 creators onboard; R2 attribution ledger (stream tags + exclusion); mentor share ledger; rating-tier engine; payout monthly batch (+manual TDS sheet); dashboard masked ledger; kill-switch dashboard |
| **P2 (mo2–3)** | TDS automation; gifts 70/30; sponsor brokerage flow; GD sinks (cosmetics GD se); tiers auto-promotion cron |
| **P3** | fan-club, creator league (engagement pool pilot) |
**Exit-gates har phase:** payout-ratio ≤35% NET; flags <2%; ≥3 creators ≥₹500 paid; owner-time ≤1h/mahina.

## H) Owner ke sawaal ka seedha jawab
- **"Percent rating par depend karega, sahi hai na?"** ⇒ **Haan, bilkul sahi** — table A exact rules hain; saath me anti-manipulation guards taaki koi rating-farm karke 25% na le jaye.
- **"Laaye users ki poori income — problem na ho"** ⇒ B1–B12; sabse bada rule **One-Rupee-One-Commission** (R1 wala rupya R2 me ginna hi nahi) + stack cap 30% + auto-brake 35%.
- **Video ₹0, mentor 20%, auto-approve strict, TDS baad me** ⇒ C/D/E/F me locked.

---

## I) CONFIRMATION (owner query 16-Nov): "creator ko sirf user lane par paise nahi milenge — users ki kis-kis activity se milenge?"
**Haan, confirm:** install/signup par **₹0** (koi CPA nahi). Commission sirf **revenue-generating user activity** par banta hai:

| # | User ki activity | Creator ko kitna | Kab banta hai | Kab NAHI banta |
|---|---|---|---|---|
| 1 | Creator ke **hosted match** me **Sky Diamond se entry** li | SD-spend ka **15/20/25%** (rating tier) | result verify + 7-din hold | result flag/dispute/reject par |
| 2 | Code-wale user ne **Sky Diamonds kharide** aur wo spend creator ke hosted match me **nahi** tha (cosmetics/premium/doosre matches) | us NET ka **10/12/15%** | purchase settle + refund-window baad | jo spend hosted match me gin chuka (One-Rupee-One-Commission) |
| 3 | Code-wale user ne **premium subscription** li (₹49/99/199) | NET ka **10/12/15%** | monthly settle | refund par clawback |
| 4 | Code-wale user ne **rewarded ads dekhe** (attributed impressions) | ad-NET ka **10/12/15%** | monthly attribution | invalid/bot traffic |
| 5 | User **creator ka mentee** bana + premium li | premium ka **20%** (90 din) | sub settle | 90 din baad / refund |
| 6 | User ne **creator ki stream/match par gift** bheja (Phase 2) | gift value ka **70%** | gift settle | Phase 2 se pehle |
| 7 | User sirf **install/signup** hua | **₹0** | — | hamesha (koi CPA nahi) |
| 8 | User ne **coins/Green Diamond** kamaye (free currency) | **₹0** | — | GD/coins kabhi commission-base me nahi |

**User-activity ke alawa (non-user) streams:** sponsor lane ki brokerage 10–15% (P2); video ka paisa **₹0 hamari taraf se** (YouTube/us platform dega).
**Example:** user ne hosted SD match me ₹100 lagaye ⇒ R1 20% = ₹20; agle mahine ₹99 pack + cosmetics (non-hosted) ⇒ R2 12% ≈ ₹10–12; mentee premium ₹99 ⇒ ₹19.8. Ek hi rupya do streams me kabhi nahi gina jayega.

---

## J) REAL-TIME CREATOR WALLET ENGINE (owner idea 16-Nov: "purchase par turant commission wallet me" — ab DB-level par perfect)
**Owner ka idea sahi hai, aur use aur pakkа banaya gaya:** har real-money event par commission **turant** creator wallet me dikhe, lekin **Locked** state me (hold), taaki refund/fraud check ke baad hi **Available** ho.

**Wallet ke 3 bucket:** `LOCKED` (abhi abhi mila, hold me) → `AVAILABLE` (hold + checks clear) → `PAID` (monthly batch me gaya). + `REVERSED` (refund/fraud par ulta).

**Har event = 1 commission row, turant:**
| Event | Row kab banti hai | Stream tag | Unique key (double-payment killer) |
|---|---|---|---|
| Code-user ka SD pack purchase (₹) | payment settle hote hi **turant** | referral | `UNIQUE(txn_id)` |
| Code-user ki premium subscription | activate hote hi **turant** | referral | `UNIQUE(txn_id)` |
| Code-user ka cosmetics/unlock real-money purchase | turant | referral | `UNIQUE(txn_id)` |
| Code-user ka rewarded ad complete | ad-event log hote hi **turant** (conservative rate ₹0.08–0.12/view) | ads | `UNIQUE(event_id)` + monthly **true-up row (±)** actual eCPM se |
| Hosted match me SD entry (result verify par) | result verify hote hi turant | host | `UNIQUE(entry_txn_id)` |
| Mentee ki premium purchase | turant | mentor | `UNIQUE(txn_id,'mentor')` |

**Double-payment ab MATHEMATICALLY namumkin:**
1. `UNIQUE(txn_id)` ⇒ ek purchase se do row ban hi nahi sakti (DB reject karta hai).
2. **SD Lot Ledger (FIFO)** — har SD purchase ek "lot" hai; jab user SD kharch karta hai (hosted match ya kahin), server lot-consumption record karta hai. Host-share lot-consumption par banta hai, referral-share lot-create par; dono alag keys ⇒ ek rupya par ek stream ka ek share, aur **stack cap 30%** dono ke jog par.
3. Refund/chargeback ⇒ us txn_id ki row **REVERSED** (wallet se auto-katoti).
4. Ads true-up ± row ⇒ over/under estimate month-end par balance.

**Creator dashboard:** har row ka reason dikhega — "user M*** ne premium liya ⇒ ₹19.80 LOCKED (30-din hold)" ⇒ transparency + motivation (turant dikhta hai) + disputes khatam.
**Admin:** wallet-state summary + reversal queue sirf exceptions par.
**Phases:** P1a = wallet buckets + referral/mentor/ads instant rows + unique keys + holds; P1b = SD lot ledger (host-split exact); P2 = ads true-up automation + TDS automation.

## K) MENTOR SYSTEM — seedhi bhasha me samjhaya (owner query)
**Aaj app me kya hai:** Premium2+ aur rank ≥600 wala player "Be Mentor" se register karta hai (speciality + bio); naye players Mentor Hub me list dekhte hain, **session request** bhejte hain; mentor Accept/Decline karta hai; session hota hai; mentor ko aaj **Green Diamond** reward milta hai (gd_earned) — naqd nahi.
**Plan kya jodta hai (aapki manzoori wali saanjh):** agar mentee (student) **90 din ke andar premium subscription** kharidta hai (₹49/99/199), to mentor ko us premium ka **20% naqd commission** milega (wallet me turant LOCKED row, 30-din hold ke baad AVAILABLE).
**Kahani se samjho:** Rahul (mentor, Diamond rank) ne Aman (naya player) ko 3 session me rank-push sikhaya. Aman khush hokar ₹99 wali premium leta hai ⇒ Rahul ke wallet me **₹19.80** turant LOCKED dikhta hai; 30 din baad AVAILABLE; monthly batch me bank/UPI par. Aman dobara ₹199 leta hai ⇒ ₹39.80 aur. 90 din baad share band (tab tak mentor ka kaam khatam maana jata hai).
**Safeguard:** 1 student = 1 mentor (first-lock); mentor-student device/PAN cluster match ⇒ row nahi; refund par REVERSED; mentor share bhi 35% auto-brake ke andar; mentee ki sirf **real-money premium** gini jati hai (coins/GD nahi).
**Fayda:** naye users ko seekhne wala milta hai (retention ↑), senior players ko kamai ka reason (wo hi users layenge = aapka creator model), hamara cost sirf nayi premium revenue ka 20%.
