#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
   tools/audit/html-sink-scan.cjs — HTML-building lines me RAW interpolation dhundhta hai
   ───────────────────────────────────────────────────────────────────────────
   D99: support-chat bubble me `+ txt +` raw tha (stored-XSS sink). Us class ke
   baaki sinks systematic tareeke se pakadne ke liye ye scanner hai:
     • line me HTML tag literal ho  AND  koi `+ expr +` interpolation ho
     • us expression ke 90 chars andar `escHtml`/`escapeHtml`/`textContent` na ho
     • obviously-safe values (Number()/parseInt/JSON numbers, `icon`, time strings,
       boolean-derived class names) allowlist me hain
   Output: file:line + variable + snippet → triage ke liye.
   Usage: node tools/audit/html-sink-scan.cjs [dir...]
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOTS = process.argv.slice(2).length ? process.argv.slice(2) : ['screens', 'js', 'features', 'core', 'index.html'];
const SKIP = new Set(['node_modules', '.git', 'reports', 'tools', 'tests', 'android', 'supabase', 'ui-lab']);

/* jo expressions safe maane jaate hain (number/time/static) */
const SAFE_EXPR = /^(Number\(|parseInt\(|parseFloat\(|String\(Number|new Date\(|Date\.now\(\)|icon\b|tm\b|ds\b|idx\b|i\b|n\.length|.*\.length\b|.*Count\b|true|false|null|undefined|''|""|Math\.)/;
/* jin files ko scan nahi karna (build artefacts / legacy dup) */
const SKIP_FILES = /(bugfixes-v29-final|fixes-v29-all-bugs)\.js$/;

function walk(p, out) {
  const st = fs.statSync(p);
  if (st.isDirectory()) {
    if (SKIP.has(path.basename(p))) return out;
    for (const e of fs.readdirSync(p)) walk(path.join(p, e), out);
  } else if (/\.(js|html)$/.test(p) && !SKIP_FILES.test(p)) out.push(p);
  return out;
}

const files = [];
for (const r of ROOTS) if (fs.existsSync(r)) walk(r, files);

const hits = [];
const INTERP = /\+\s*\(?\s*([A-Za-z_$][\w$]*(?:\.[\w$]+)*(?:\([^()]*\))?(?:\s*\|\|[^+]{0,40})?)\s*\)?\s*(\+|;|$|\.)/g;

for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const lines = src.split('\n');
  lines.forEach((ln, i) => {
    const isHtmlLine = /<\/?[a-zA-Z][\s\S]{0,80}?>/.test(ln) && (/innerHTML/.test(ln) || /['"`]\s*</.test(ln) || /h\s*\+=/.test(ln) || /'\s*\+\s*/.test(ln));
    if (!isHtmlLine) return;
    if (!/<[a-zA-Z]/.test(ln)) return;              /* sirf HTML-tag wali lines */
    let m; INTERP.lastIndex = 0;
    while ((m = INTERP.exec(ln))) {
      const expr = m[1].trim();
      if (SAFE_EXPR.test(expr)) continue;
      if (/^['"`]/.test(expr)) continue;
      const ctxStart = Math.max(0, m.index - 90);
      const ctx = ln.slice(ctxStart, m.index + expr.length + 20);
      if (/escHtml|escapeHtml|sanitize|textContent|_esc\(|encodeURI/.test(ctx)) continue;
      if (/style=|class=|href=["']https?:|onclick=/.test(ln) && /^[\w.]+$/.test(expr) && /^(var|txt|cls|ic)/.test(expr) === false && /Color|Style|Class|Cls|Url|Icon|Bg|Width|Height|Pad/.test(expr)) continue;
      hits.push({ file: f, line: i + 1, expr, snippet: ln.trim().slice(0, 150) });
    }
  });
}

const byFile = {};
for (const h of hits) (byFile[h.file] = byFile[h.file] || []).push(h);
console.log('══ HTML-SINK SCAN ══  files scanned:', files.length, ' candidate raw interpolations:', hits.length);
for (const f of Object.keys(byFile).sort()) {
  console.log('\n' + f + '  (' + byFile[f].length + ')');
  for (const h of byFile[f].slice(0, 12)) console.log('  :' + h.line + '  [' + h.expr + ']  ' + h.snippet);
  if (byFile[f].length > 12) console.log('  … +' + (byFile[f].length - 12) + ' more');
}
