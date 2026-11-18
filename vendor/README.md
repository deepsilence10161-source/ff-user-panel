# vendor/ — local (CDN-free) SDK copies

## supabase.min.js
- **Source:** `@supabase/supabase-js@2` ka official UMD bundle
  (`https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js`).
- **Transpile:** esbuild `--target=es2017 --minify` (build ke waqt manual).
- **Kyun vendor kiya:** CDN ka naya bundle `||=` / `&&=` / `?.` jaisa syntax
  use karta hai jo **purane Android WebView (Chromium 83 tak)** parse nahi kar
  pate — wahan output hota tha
  `Uncaught SyntaxError: Unexpected token '='` (supabase.min.js line 7),
  `window.supabase` kabhi define nahi hota tha, `_supa` client banta hi nahi
  tha aur app ka boot 15s ke hard ceiling par login screen par atak jata tha.
  Sasta Android phone (hamara market) = purana WebView, isliye yeh real users
  ka bug tha, sirf CI ka nahi.
- **Fallback:** agar yeh file load/parse na ho, `core/db.js` ka `_initClient()`
  khud CDN se SDK laane ki koshish karta hai.

### Update kaise karein
```bash
curl -o /tmp/sb.js https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js
npx --yes esbuild@0.21.5 /tmp/sb.js --target=es2017 --minify --outfile=vendor/supabase.min.js
```
Transpile ke baad check karo: `grep -c '||=' vendor/supabase.min.js` → 0 aana chahiye.
