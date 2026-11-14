const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext()).newPage();
  p.on('console', m => console.log('CONSOLE:', m.text().slice(0, 120)));
  await p.goto('https://deepsilence10161-source.github.io/ff-user-panel/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(2000);
  const r = await p.evaluate(async () => {
    const t = async (u, o) => { try { const res = await fetch(u, o); return u.slice(8, 30) + ' -> ' + res.status; } catch (e) { return u.slice(8, 30) + ' -> ERR ' + e.message; } };
    return [
      await t('https://hddhkculuyrfoevmlwy.supabase.co/rest/v1/users?select=id&limit=1', { headers: { apikey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhkZGhrY3VsdXlyZm9ldnhtbHd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0NTQ1MTgsImV4cCI6MjA5NDAzMDUxOH0.2hhDGez1fVFjS5ljSU3tSOEJuusLmQpERjcrh45T7po' } }),
      await t('https://dns.google/resolve?name=google.com'),
      await t('https://ff-user-panel.deepsilence10161.workers.dev/'),
    ];
  });
  console.log(r.join('\n'));
  await b.close();
})();
