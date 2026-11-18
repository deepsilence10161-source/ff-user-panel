const BASE = 'https://deepsilence10161-source.github.io/ff-user-panel/';
const txt = async u => (await fetch(u)).text();
const status = async u => { try { const r = await fetch(u, { method: 'HEAD' }); return r.status; } catch (e) { return 'ERR'; } };
const html = await txt(BASE + 'index.html');
const scripts = [...html.matchAll(/src="([^"]+\.js[^"]*)"/g)].map(m => m[1]);
const codes = [html];
for (const s of scripts) { try { codes.push(await txt(BASE + s.split('?')[0])); } catch (e) {} }
const all = codes.join('\n');
const refs = new Set();
for (const m of all.matchAll(/(?:assets|icons|img)\/[A-Za-z0-9_\-./]+\.(?:png|jpg|jpeg|svg|webp|gif)/g)) refs.add(m[0]);
const bad = [];
for (const r of [...refs].sort()) { const st = await status(BASE + r); if (st !== 200) bad.push(st + ' ' + r); }
console.log('refs=', refs.size, 'missing=', bad.length); console.log(bad.slice(0, 20).join('\n'));
