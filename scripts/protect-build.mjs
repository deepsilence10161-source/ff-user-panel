/* ================================================================
   MINI eSPORTS — scripts/protect-build.mjs   (D88, 07-Nov-2026)
   Owner: "koi mere app ya web ka code ki ek line tak na chura sake"
   ----------------------------------------------------------------
   Source tree (PRIVATE) se PUBLIC-ready protected build banata hai:
     • saara app JS (js/, screens/, features/, core/, sw.js) =
       javascript-obfuscator se obfuscated (comments delete, strings
       base64, identifiers hex; global names retained taaki inline
       onclick handlers + QA harness kaam karte rahen)
     • dev-only cheezein public build me NAHI jaati: tests/, scripts/,
       supabase/, *.md, .github source gates
   Usage:  NODE_PATH=<ui-lab node_modules> node scripts/protect-build.mjs
   Output: build/  (GitHub Pages public repo me yahi tree jaata hai)
   ================================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Obf = require('javascript-obfuscator');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'build');

/* ✅ r7c FIX (15-Nov-2026): 'reports' bhi exclude — warna QA evidence
   (screenshots/logs, ~45 MB) public Pages repo me chala jata tha: repo bloat
   + internal reports public. sync.py clone-only top-levels ko preserve karta
   hai, isliye public repo ka purana reports/ delete nahi hoga. */
const EXCLUDE_TOP = new Set(['.git', '.github', 'node_modules', 'build', 'tests', 'scripts', 'supabase', 'android', 'tools', 'reports']); /* vendor raw copy hota hai (third-party) */
const EXCLUDE_EXT = new Set(['.md']);
const OBF_DIRS = new Set(['js', 'screens', 'features', 'core']);
/* ✅ FIX (2026-11-20): screens/join.js obfuscation se exempt — obfuscator
   iske top-level helpers (_normET/_gdLegacy) ki definitions gira deta tha
   (live ReferenceError → duo invite fail). Repo public hai, obfuscation
   sirf cosmetic; correctness > cosmetics. */
const OBF_SKIP_FILES = new Set(['screens/join.js']);

function walk(src, dest, rel) {
  fs.mkdirSync(dest, { recursive: true });
  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    const r = rel ? rel + '/' + ent.name : ent.name;
    if (ent.isDirectory()) {
      if (rel === '' && EXCLUDE_TOP.has(ent.name)) continue;
      walk(path.join(src, ent.name), path.join(dest, ent.name), r);
      continue;
    }
    const ext = path.extname(ent.name).toLowerCase();
    if (EXCLUDE_EXT.has(ext)) continue;
    const s = path.join(src, ent.name), d = path.join(dest, ent.name);
    const isAppJs = ext === '.js' && !OBF_SKIP_FILES.has(r) && (OBF_DIRS.has(r.split('/')[0]) || (rel === '' && ent.name === 'sw.js'));
    if (isAppJs) {
      const code = fs.readFileSync(s, 'utf8');
      let _o = {
        compact: true,
        controlFlowFlattening: false,          // low-end phones ke liye perf safe
        deadCodeInjection: false,
        debugProtection: false,                // D89-fix: debugger-interval storm low-end phones par boot race karata tha
        debugProtectionInterval: 0,
        disableConsoleOutput: false,
        identifierNamesGenerator: 'hexadecimal',
        renameGlobals: false,                  // inline onclick + harness globals safe
        selfDefending: true,                   // pretty-print/format karne par code toot-ta hai
        stringArray: false,              // D89-fix: stringArray decoder = charAt/not-a-function crash vector (3/3 repro); protection = hex identifiers + compact + selfDefending + private source
        stringArrayCallsTransform: false,   // D89-fix: unstable transform — decoder crashes (charAt/clan_a_name races) on real devices
        stringArrayEncoding: [],          // D89-fix: base64 decoder = charAt crash vector
        stringArrayRotate: false,         // D89-fix: re-eval safety
        splitStrings: false,              // D89-fix: split literals + callsTransform interaction broke decoder
        stringArrayThreshold: 0.6,
        splitStringsChunkLength: 900,
        unicodeEscapeSequence: false,
        target: 'browser'
      };
      if (process.env.DBVAR && r === 'core/db.js') Object.assign(_o, JSON.parse(process.env.DBVAR));
      if (process.env.OBFGLOBAL) Object.assign(_o, JSON.parse(process.env.OBFGLOBAL));
      const res = Obf.obfuscate(code, _o);
      fs.writeFileSync(d, res.getObfuscatedCode());
      process.stdout.write('obf ' + r + '\n');
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

fs.rmSync(OUT, { recursive: true, force: true });
walk(ROOT, OUT, '');
// android/ aur tools/ workflows ke liye chahiye — copy as-is
/* ✅ r7c SECURITY-HYGIENE FIX (15-Nov-2026): tools/ copy karte waqt
   QA/security-sensitive subtree PUBLIC build me jaane se roko:
     • tools/audit   → live-probe scripts (anon/web keys, uids, endpoints)
     • tools/edge    → edge-function mechanics / RECOVERY notes
     • tools/tri-e2e/.state → QA account PASSWORDS (gitignore se bachte the,
       par build dir me copy ho hi jaate the — ek gitignore chook = leak)
   Isse pehle 7 internal scripts galti se public repo me chale gaye the
   (commit c28eb22 → wapas hataye 111c29b). Koi secret value leak nahi hui thi. */
const TOOL_SKIP = new Set(['audit', 'edge']);
/* ✅ r7c: 'tools' ab PUBLIC build me jaata hi nahi — QA/E2E drivers internal
   hain (RPC names, uids, endpoints reveal karte hain) aur public CI inhe
   use hi nahi karta (.github/workflows + scripts me koi tools/ reference nahi).
   android/ CI (build-apk.yml) ke liye zaroori hai, isliye wo copy hota rahega. */
for (const keep of ['android']) {
  const s = path.join(ROOT, keep);
  if (!fs.existsSync(s)) continue;
  if (keep === 'tools') {
    for (const ent of fs.readdirSync(s, { withFileTypes: true })) {
      if (TOOL_SKIP.has(ent.name)) continue;
      const src = path.join(s, ent.name), dst = path.join(OUT, 'tools', ent.name);
      if (ent.isDirectory()) {
        fs.cpSync(src, dst, { recursive: true, filter: (p) => !p.includes(`${path.sep}.state`) });
      } else fs.cpSync(src, dst);
    }
    continue;
  }
  fs.cpSync(s, path.join(OUT, keep), { recursive: true });
}
// ✅ D88-fix: public CI ka Live-Assets check obfuscated catalog grep nahi kar
// sakta — build time par source catalog se plain manifest likho.
const catSrc = path.join(ROOT, 'js', 'features', 'asset-catalog.js');
if (fs.existsSync(catSrc)) {
  const cat = fs.readFileSync(catSrc, 'utf8');
  const paths = [...cat.matchAll(/'([a-z0-9]+\/[a-z0-9-]+\.png)'/g)].map(m => 'assets/img/' + m[1]);
  fs.writeFileSync(path.join(OUT, 'asset-paths.txt'), [...new Set(paths)].sort().join('\n') + '\n');
}
const n = (function count(d){ let c=0; for (const e of fs.readdirSync(d,{withFileTypes:true})) c += e.isDirectory()? count(path.join(d,e.name)) : 1; return c; })(OUT);
console.log('PROTECT-BUILD OK — files:', n);
