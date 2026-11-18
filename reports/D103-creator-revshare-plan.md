# D103-PLAN: Creator-Led Growth + Revenue-Share Model (mini eSports)
**Status: PLAN ONLY — owner approval ke baad hi kaam shuru hoga (owner order 16-Nov-2026)**
**Owner ka idea:** "pahle users dhundhte the, ab creator dhundhenge. Creator paise ke liye khud app monetize/promote karenge, khud users layenge; badle me unhe milega har match me spend kiye gaye sky diamonds ki keemat ka % — ya jo bhi system se hamari income hoti hai. Kitna % de? Maximum depth research kar, har tarika dhundh, pehle plan bana."

---

## 0) Ek-line me recommendation
**Creator ko "gross diamond spend" ka % mat do; "net platform revenue (cohort-attributed)" ka tiered 20% → 25% → 30% do, saath me optional hybrid CPA (₹25–40 per verified first-payer) beta me test karo.** Reason niche §4–§6 me numbers ke saath.

---

## 1) Industry benchmarks (maximum-depth research, 16-Nov-2026)

| Model / Platform | Creator ko kya milta hai | Source-note |
|---|---|---|
| **Fortnite Support-A-Creator** | **5%** of attributed V-Bucks/net spend (player extra nahi deta; Epic apne margin se deta hai). Double-SAC promo me 10% (temporary) | Epic program, 2018 se |
| **Fortnite engagement pool (UEFN)** | Pool = **40% of net Item-Shop + real-money revenue**, islands me engagement-share se banta | Creator Economy 2.0 |
| **Roblox DevEx** | Effective **~25–30%** of player spend (store fee + platform fee katne ke baad); 2025 me rate +8.5% | RDC 2025 |
| **Streaming subs** | Twitch 50% (Partner Plus 70%), YouTube 70%, Kick **95%**; ads 50–55%; TikTok gifts ~50% | 2026 platform stats |
| **iGaming affiliates** | Rev-share **25–45% of NGR, median 30%**; hybrid (CPA+revshare) = 41% of new deals; CPA $150–400/FTD tier-1 | Track360/industry 2026 |
| **iGaming discipline rule** | CPA cap = **30–50% of expected 12-month NGR**; healthy **LTV:CPA 2.5–4x** | operator benchmarks |
| **Mobile game influencer CPI** | **$0.50–$5.00 per verified install** (India low-end); micro (10K–100K) flat $150–1,500/post | 2026 rate cards |
| **India referral programs** | WinZO **₹55–80/referral** + "Superstar" influencer program; Dream11 ₹111+coins; gaming creator integration ₹1–5 lakh per 200K subs | India market 2025-26 |
| **Referral quality** | Referred users **LTV +16–25%**, CAC **−30–60%** vs paid; gaming referral click→install **25–45%**; micro-influencer conversion ~2.8% vs macro 0.9% | referral benchmarks |
| **K-factor** | K = invites/user × conversion/invite; K>1 = viral; mobile game typical 0.5–0.75 | Tenjin glossary |

**Seekh:**
1. Sirf "code lagao aur 5%" (Fortnite) tab chalta hai jab platform khud UA karti hai aur creator sirf stream karta hai. Hamara case ulta hai — **creator poori UA ka kaam karega** ⇒ uska share 5% nahi, **iGaming-style 20–30% band** me hona chahiye.
2. iGaming me 30% **NGR (net)** par hota hai, gross par nahi. Gross par dene se operator margin khatam ho jata hai.
3. Hybrid (chhota CPA + rev-share) aaj 41% nayi deals me default hai — creator ko early cash milta hai, platform ko long-term alignment.
4. Creator-led traffic paid ads se sasta aur behtar hota hai (LTV +16–25%, CAC −30–60%) — owner ki "12 ghante duty" problem ka sahi jawab.

---

## 2) hamari apni economy (app source se naapi hui)

| Revenue source | Rate/price | Margin note |
|---|---|---|
| Sky Diamond purchase | ₹ ≈ 1:1 diamond (₹99 → 99 diamonds; live config se) | payment fee ~2% kat-ti hai |
| Premium subscription | ₹49 / ₹99 / ₹199 per month | ~98% margin |
| AdMob rewarded ads | India eCPM ~$1–1.85 / 1000 impressions | ~₹0.12–0.16 per rewarded view |
| Match entry (diamond spend) | rake/prize-recycle model | **gross spend ≠ platform income** — prize me wapas jaata hai |
| Cosmetics/titles/badges unlock | diamond spend | high margin |

**Sabse important baat:** "har match me spend kiye sky diamonds" ka **poora amount hamari income nahi hai** — uska bada hissa prize/bonus me recycle hota hai. Isliye creator ko **gross diamond spend ka % dena mathematically ghalat hai**; dena hai to **net revenue** ka %.

**Net revenue (cohort) ka formula (plan):**
```
NET = (diamond purchase ₹  − refunds/chargebacks − payment fee)
    + (premium subscription ₹ attributed)
    + (ad revenue attributed: rewarded impressions × eCPM/1000)
    + (cosmetics/unlock diamond-spend ka platform-retained hissa)
    − (us cohort ke prizes/bonuses jo platform ne fund kiye)
```
Creator share = tier% × NET (monthly, cohort-wise ledger me visible).

---

## 3) Legal & Halal framework (India, 16-Nov-2026 tak)

### 3a) Online Gaming Act 2025 + Rules 2026 (in force 1-May-2026)
| Category | Status | Hamara position |
|---|---|---|
| Online money game (stake → monetary enrichment expectation) | **PROHIBITED** (+ advertising ban: 2 saal / ₹50 lakh; payments ban) | hamein isme nahi girna hai |
| **E-sports** (organised competitive, no betting) | **Allowed + mandatory registration** (MeitY authority, Rule 12; certificate ≤10 saal) | mini eSports = FF custom-room tournaments ⇒ **e-sports registration karwana zaroori** |
| Online social game | Allowed (registration light) | fallback category |
| **Rule 9 carve-out** | e-sports me **registration/participation fee jo sirf entry/admin cost cover kare** + **performance-based prize money** = permitted (bet/wager nahi hona chahiye) | hamara entry-fee + prize model isi carve-out me fit hona chahiye |

**Action (Phase 0):** e-sports registration application + fee→cost mapping doc + prize policy ("performance-based prize money") likhna. Creator program ka income isse affected nahi hota (wo marketing commission hai), par **app ka compliant rehna creator income ko halal/clean rakhta hai**.

### 3b) Tax/compliance (creator payouts par)
| Item | Rule |
|---|---|
| TDS | **Section 194H: 5%** on commission/brokerage, threshold **₹15,000/payee/FY**; **referral commission explicitly covered**; PAN na ho to **20%** (206AA) |
| TDS base | GST alag se invoice me ho to **GST-excluded amount** par |
| GST | Creator ki side: brokerage service = **18%**; registration sirf turnover > **₹20 lakh/FY** par; niche wale bina GST invoice ke payment le sakte hain |
| Filings | TDS deposit 7th of next month; quarterly **26Q**; certificate **16A** |
| KYC | PAN mandatory (warna 20% TDS), 18+, bank/UPI payout rail |

### 3c) Halal structuring (owner ka "halal rahega" condition)
Commission/brokerage = **samsarah / wakalah bil-ujrah / ju'alah** — classical fiqh me **jaiz** (Dar al-Ifta Misriyyah & Urduniyyah fatwas; "Muslims are bound by their conditions"). Conditions jo plan me hard-rule banenge:
1. **Product halal ho** — registered e-sports, no betting/wagering, no haram content. ✔ (app compliance se)
2. **Commission pehle se clear ho** — % contract me likha, **retroactive change nahi** (gharar ban jaata hai).
3. **Imandari + disclosure** — creator ko promote karte waqt batana zaroori: "mere code se mujhe commission milta hai" (ghish se bachna).
4. **Koi riba/maysir nahi** — na late-fee, na guaranteed return, na lottery-jaisa payout.
5. Ledger transparent — creator apna cohort + calculation khud dekh sake.
6. Zakat: creator income ordinary earned income hai (2.5% zakat applicable agar nisab poora ho) — info note contract me.

---

## 4) % kitna de? — options + recommendation

| Option | Creator share | Platform par asar | Verdict |
|---|---|---|---|
| A. Gross diamond spend ka % (owner ka first idea) | e.g. 10–20% of gross | ❌ prize-recycle hissa bhi commission me chala jaata hai ⇒ margin negative ho sakta hai | **Reject** |
| B. **Net revenue rev-share, tiered** | **20% base / 25% mid / 30% top** | ✅ iGaming median 30% ke andar; margin safe; creator ko full-UA ka fair share | **RECOMMEND** |
| C. Hybrid: CPA + rev-share | ₹25–40 per verified first-payer + 15–20% net | ✅ creator ko early cash; 41% industry deals aise hain | **Beta me test** |
| D. Pure CPA per install | ₹5–15/install | ❌ fraud-prone, low-quality users, creator ko long-term stake nahi | Reject |
| E. Pure CPA per payer | ₹55–111 (WinZO/Dream11 style) | ❌ one-time cost, cohort LTV platform ke paas; creator churn | Reject as sole model |
| F. Engagement pool (Fortnite-style 40% pool) | pool share by creator-hosted tournaments/rooms | ✅ Phase 2 me pilot (creator-hosted matches = hamara core) | Phase 2 |
| G. Streaming-style 50–70% split | ❌ hamare paas content-cost creator bear nahi karta; margin nahi bachega | Reject |

### Tiers (recommended B, numbers):
| Tier | Condition | Share of NET |
|---|---|---|
| T1 Starter | approved creator, code active | **20%** |
| T2 Builder | ≥50 active referred users **ya** cohort NET ≥ ₹10,000/month | **25%** |
| T3 Partner | ≥150 active referred users **ya** cohort NET ≥ ₹30,000/month + exclusive conduct | **30%** |
| Beta (Phase 1, 60 din) | flat **20%** + **₹30 CPA** per verified first-payer (hybrid test) | — |

**Caps/guardrails:** kisi mahine total creator payout > **35% of platform NET** ho to tier-bonus auto-throttle; refund/chargeback par clawback; naye cohort earnings par **30-day hold**; fraud par forfeit.

### Attribution rules (simple + dispute-free):
- **First-touch permanent lock:** signup par creator code enter hua ⇒ user us creator ka cohort (lifetime), jaise Fortnite ka sticky attach.
- Code entry window: install ke **7 din** tak (deep-link/QR se auto-fill).
- Ek user = ek creator (last-touch nahi, disputes kam).
- Self-referral ban: same device/PAN/UPI-id match par block.

---

## 5) Financial model (₹, monthly, per creator) — assumptions transparent

Assumptions: micro-creator audience 10–50K; install conversion ~2.8% (micro benchmark); gaming referral click→install 25–45%; D30 active 20–25%; payer rate 8–12% of actives; ARPPU ₹120/month (₹99 pack + top-ups); ad revenue ₹4/active-user/month; net margin on purchases 70% (prize-recycle + fees ke baad).

| Scenario | Installs/mo | D30 active | Payers | Gross/mo | NET/mo | Creator 20–25% |
|---|---|---|---|---|---|---|
| Low | 60 | 13 | 1 | ₹120 | ₹90 | ₹18–23 |
| Mid | 300 | 70 | 8 | ₹1,240 | ₹930 | ₹186–233 |
| High | 900 | 210 | 23 | ₹3,500 | ₹2,600 | ₹520–650 |

**Cohort compounding:** har mahine naya cohort judta hai; month-12 par mid creator ka run-rate ≈ 6–8 live cohorts ⇒ **₹1,200–1,900/mo** sirf rev-share se (+ tier bonus + CPA beta). Top partner (T3) ₹5,000–15,000/mo realistic (Fortnite mid-tier SAC $500–2,500 se compare — hamara scale chhota par share bada).

**Platform side:** paid UA India CPI ₹30–80/install upfront vs creator model = **zero upfront risk, sirf revenue aane par cost**. Owner ki 12-hour duty constraint ke liye yehi sabse bada fayda hai.

---

## 6) Fraud & quality controls (launch se pehle zaroori)
1. Device-fingerprint + install attribution (code + first-open), emulator/root flag.
2. Self-referral: PAN/UPI/device/PIN-code cluster match → block + forfeit.
3. Velocity rules: ek device se >3 signups/day, ek IP se >10/day → hold.
4. Payer verification: first purchase successful + 72h no refund ⇒ CPA/rev-share count.
5. 30-day payout hold + monthly fraud review; clawback on chargebacks.
6. Creator conduct clause: fake claims/spam/bot traffic = termination + forfeit (contract me).
7. Beta cap: per-creator payout ≤ ₹25,000/month (Phase 1).

---

## 7) Phased rollout plan

### Phase 0 — Policy & Legal (Week 1–2, no code)
- [ ] E-sports registration (Rule 12) ki application + fee→cost mapping + prize policy doc
- [ ] Creator Agreement draft (Hindi+English): % tiers, attribution, disclosure clause, halal conditions, conduct, TDS/GST, payout terms
- [ ] CA se TDS 194H + 26Q/16A setup; payout rail choose (UPI-payout API ya bank NEFT)
- [ ] Fraud policy doc + beta caps
- [ ] Admin ledger design (existing `creatorProgram` section extend)

### Phase 1 — Beta (Week 3–8): 5–10 creators (existing creatorApplications pool se)
- [ ] Signup par creator-code field + deep-link/QR auto-fill
- [ ] Attribution table + monthly NET ledger (cohort-wise)
- [ ] Creator dashboard: installs, actives, payers, NET, earned, tier, payout status
- [ ] Payout export + TDS deduction auto
- [ ] Beta rate: flat 20% + ₹30 CPA per verified first-payer (hybrid test)
- [ ] Marketing kit: reel templates, QR posters, Hindi pitch deck
- KPI gate: fraud <2%, D30 ≥20%, payout ratio ≤30% of NET, ≥3 creators ko ₹500+ payout

### Phase 2 — Scale (Month 3+)
- [ ] Tiers 20/25/30 live + monthly bonus pool (top-3 creators)
- [ ] Creator-hosted tournaments pilot (engagement-pool style: host ko us match ke NET ka extra 5%)
- [ ] Leaderboard + verified badge + exclusive cosmetics for creators
- [ ] User-side referral (2-sided: referrer ko diamonds, referee ko bonus) — creator program se alag
- [ ] Quarterly rate review (retroactive change nahi — sirf future cohorts)

### Non-creator growth levers (owner ne "har tarika" poocha tha)
| Tarika | Cost | Note |
|---|---|---|
| ASO + Play Store listing optimise | ₹0 | baseline |
| College/city ambassadors (non-cash: diamonds/badges) | low | creator pipeline ka feeder |
| WhatsApp/Telegram community + match alerts | ₹0 | retention + K-factor |
| YouTube Shorts reel templates (creator kit se) | ₹0 | creator-led UA ka fuel |
| E-sports registration = marketing angle ("govt-recognised esports platform") | ₹0 | trust + PR |
| FF community cross-promo (clan wars, city champs) | low | existing features |

---

## 8) Risks & mitigations
| Risk | Mitigation |
|---|---|
| Margin erosion agar prize-recycle zyada ho | NET formula me prize deduction; monthly payout cap 35% of NET |
| Fraud farms | §6 controls + 30-day hold + beta caps |
| Legal (money-game classification) | e-sports registration + Rule 9 compliant fee/prize structure; no user cash-out |
| Creator churn agar early earning kam ho | Beta hybrid CPA + bonus pool + non-cash perks |
| TDS/GST mistakes | CA-retained process; PAN gate; 26Q calendar |
| Attribution disputes | first-touch permanent lock + support SOP + ledger transparency |

---

## 9) Owner ke sawaal ka seedha jawab
- **"Sky diamond ki keemat ka kitna %?"** → Gross ka nahi. **Net platform revenue ka 20% (starter) / 25% (builder) / 30% (partner)**; beta me +₹30 CPA per verified first-payer.
- **Kyun nahi 40–50%?** Kyunki hamara gross spend ka bada hissa prizes me wapas jaata hai; 40–50% net-dena bhi margin khatam kar deta. iGaming ka 30% median bhi **net** par hai.
- **Kyun nahi sirf 5% (Fortnite jaisa)?** Kyunki wahan platform UA karti hai; yahan creator poori UA karega ⇒ uska share UA-value ke barabar hona chahiye (20–30% band).
- **Halal?** Haan — brokerage/ju'alah structure, conditions §3c me hard-rules banenge.
- **Legal?** Haan — creator payout = marketing commission (194H TDS 5%); app ko e-sports registered rakhna zaroori hai.

**Next step (owner approval ke baad):** Phase 0 shuru (policy docs + CA + registration), phir Phase 1 build. Is plan par kaam tabhi hoga jab owner "ha" kahe.
