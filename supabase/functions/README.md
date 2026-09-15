# Supabase Edge Functions — deploy & diagnose

Yeh folder teen Edge Functions rakhta hai:

| Function            | Kaam                                                             |
| ------------------- | ---------------------------------------------------------------- |
| `imgbb-upload`      | Images (payment proof, profile photo, banner) ko ImgBB par host karta hai, key server-side secret me rakhte hue |
| `paytm-create-order`| Paytm UPI checkout order banata hai                               |
| `paytm-callback`    | Paytm payment callback verify karta hai                           |

## ⚠️ Sabse zaroori baat

**Repo me code push karne se Edge Function deploy NAHI hota.** GitHub Pages
par client (index.html/js) khud chala jaata hai, lekin function Supabase par
tab tak purana version chalata rahega jab tak deploy na kiya jaaye.
2026-09-15 ka poora "Failed to fetch / Screenshot server pe upload nahi hua"
incident isi gap se aaya tha: client fix ship ho gaya, function purana (v1)
rah gaya jo har upload ko 401 deta tha.

Ab do raaste hain:

### 1) Automatic (recommended)

`supabase/functions/deploy-edge.yml.template` ek ready GitHub Actions
workflow hai. Ek baar enable karo:

```bash
mkdir -p .github/workflows
cp supabase/functions/deploy-edge.yml.template .github/workflows/deploy-edge.yml
git add .github/workflows && git commit -m "ci: auto-deploy edge functions" && git push
```

Uske baad `supabase/functions/**` ko chhune wala har push function deploy
kar dega — bas ek baar repo me yeh secret daalo:
**Settings → Secrets and variables → Actions → `SUPABASE_ACCESS_TOKEN`**
(supabase.ai → Account/Settings → Access Tokens). Optional: `IMGBB_KEY`
secret bhi daalo to workflow function secret bhi sync kar dega.

### 2) Manual (abhi turant)

```bash
npm i -g supabase          # ya: npx supabase@latest ...
supabase login             # browser khulega, ek baar
supabase projects list     # ref confirm karo: hddhkculuyrfoevmlwy

# secrets (ek baar; IMGBB_KEY apni ImgBB dashboard se)
supabase secrets set IMGBB_KEY=xxxxxxxx --project-ref hddhkculuyrfoevmlwy
supabase secrets set FIREBASE_PROJECT_ID=fft-app-1e283 --project-ref hddhkculuyrfoevmlwy

# deploy
supabase functions deploy imgbb-upload --project-ref hddhkculuyrfoevmlwy --no-verify-jwt
```

(`--no-verify-jwt` jaan-boojh kar: gateway-level JWT check off rakhte hain
taki CI/purane clients na tootein; asli user-verification function khud
karta hai — Firebase ID token ko Google ke public JWKS se, ya Supabase JWT
ko service role se. Anonymous/gateway key ko identity NAHI maanta.)

## Deploy ke baad verify karo

```bash
curl -i -X POST https://hddhkculuyrfoevmlwy.supabase.co/functions/v1/imgbb-upload \
  -H 'Content-Type: application/json' -d '{"image":"aGVsbG8="}'
```

| Response                                          | Matlab                                   |
| ------------------------------------------------- | ---------------------------------------- |
| `401 {"success":false,"error":"Login required — dobara login karo"}` | ✅ v2 LIVE hai (bina user token ke reject — expected) |
| `401 ... "Invalid session, dobara login karo"`   | ❌ purana v1 abhi bhi deployed hai — dobara deploy karo |
| `404` / HTML                                     | ❌ function deployed hi nahi hai          |
| App me upload par `IMGBB_KEY secret set nahi hai` | ❌ `supabase secrets set IMGBB_KEY=...` chhoot gaya |
| App me upload par `Invalid API key`              | ❌ ImgBB key galat/expired (imgbb.com dashboard) |

Client side (core/imgbb.js v33+) yeh server message toast me dikhata hai,
isliye upar wali table se har failure ki jagah turant pata chal jaati hai.

## Tests

```bash
node tests/imgbb-upload-cors.test.mjs   # client request shape + CORS preflight rules
node tests/imgbb-upload-auth.test.mjs   # function ki token-verification (RS256/JWKS)
```

Dono tests asli source files chalate hain (copy nahi) — client ke headers,
body shape aur function ka fail-closed verify path regress hone par fail
ho jaayenge.
