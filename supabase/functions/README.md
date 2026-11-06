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

GitHub App ko workflow-write permission nahi mil rahi ho to repository owner
`supabase/functions/deploy-imgbb-upload.yml.template` ka poora content GitHub
web editor se manually is exact path par create kare:
`.github/workflows/deploy-imgbb-upload.yml`.

Uske baad `main` par `imgbb-upload` ya `supabase/config.toml` change merge hote
hi sirf image function deploy hota hai (payment functions ko bina wajah touch
nahi karta). Repo me ek baar yeh secret hona chahiye:
**Settings → Secrets and variables → Actions → `SUPABASE_ACCESS_TOKEN`**
(supabase.com → Account/Settings → Access Tokens). Optional `IMGBB_KEY`
repository secret diya ho to workflow function secret bhi sync karta hai;
warna Supabase me pehle se configured `IMGBB_KEY` untouched rehta hai.

Workflow deployment ke baad health-check bhi karta hai. Bina Firebase token
ke request ko **function ka** `Login required` 401 milna chahiye. Agar relay
ka `UNAUTHORIZED_NO_AUTH_HEADER` aaye, workflow fail hota hai — iska matlab
gateway `verify_jwt` abhi bhi galat tarah ON hai.

`supabase/functions/deploy-edge.yml.template` legacy all-functions example
sirf reference ke liye hai. Image-only workflow ke liye upar wala exact
`deploy-imgbb-upload.yml.template` hi use karein.

### 2) Manual (abhi turant)

```bash
npm i -g supabase          # ya: npx supabase@latest ...
supabase login             # browser khulega, ek baar
supabase projects list     # ref confirm karo: hddhkculuyrfoevxmlwy

# secrets (ek baar; IMGBB_KEY apni ImgBB dashboard se)
supabase secrets set IMGBB_KEY=xxxxxxxx --project-ref hddhkculuyrfoevxmlwy
supabase secrets set FIREBASE_PROJECT_ID=fft-app-1e283 --project-ref hddhkculuyrfoevxmlwy

# deploy
supabase functions deploy imgbb-upload --project-ref hddhkculuyrfoevxmlwy --no-verify-jwt
```

(`--no-verify-jwt` aur `supabase/config.toml` dono jaan-boojh kar: gateway
Firebase-body token dekhne se pehle request reject na kare. Asli auth band
NAHI hota — function Firebase ID token ko Google JWKS se RS256 signature,
audience, issuer aur expiry ke saath verify karta hai; Supabase JWT ko Auth
server se verify karta hai. Anonymous/project key ko user identity NAHI
maanta.)

Project ref exactly `hddhkculuyrfoevxmlwy` hai (`...evx...`). Purane docs /
template me `x` chhoot gaya tha, isliye un commands se deploy galat/nonexistent
project ko target karta tha.

## Deploy ke baad verify karo

```bash
curl -i -X POST https://hddhkculuyrfoevxmlwy.supabase.co/functions/v1/imgbb-upload \
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

Dono tests asli source files chalate hain (copy nahi) — client ke standard
`apikey`/Authorization headers, preflight-free recovery, profile/banner field
mapping, single compressor, ImgBB payload aur function ka fail-closed token
verification regress hone par fail ho jaayenge.
