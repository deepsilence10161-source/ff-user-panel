#!/usr/bin/env node
/* tools/audit/fb-rebuild-creds.mjs — QA state-file rebuild (wipe recovery).
   Firebase Identity Toolkit (service account) se: 8 QA uids ka email lookup,
   password admin-reset, tools/tri-e2e/.state/d103.json rebuild.
   Usage: node tools/audit/fb-rebuild-creds.mjs [--dry]   */
'use strict';
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
const DRY = process.argv.includes('--dry');
const SA_PATH = process.env.FIREBASE_SERVICE_ACCOUNT || '/home/user/.secrets/firebase_service_account.json';
const OUT = process.env.STATE_OUT || '/home/user/ff-user-panel/tools/tri-e2e/.state/d103.json';
const sa = JSON.parse(fs.readFileSync(SA_PATH, 'utf8')); const PROJECT = sa.project_id;
const MAP = {
  adm1: 'KLostIl8ygUvRiZySH466jSB9yV2', qa1: 'v1n5mN0xGIgiYXkJ5MtZ6r6nTlo1',
  qa2: 'mqgK35NCQyeQLSGoPdDNG1qaxIP2',  qa3: 'p8rDso2OVTXbrOs6gEap2PDD7DA3',
  qa4: 'Doy04RskzATt9eduNUmUUzTT4HT2',  qa5: 'AES1PjQ3v4WnKVU8ESJDeGhQ5Bz1',
  qa6: 'DOwLzeC1VSeeUdwHyZGhXtnTaVt1',  qa7: 'CT6wno8PtTYaPVnKLngwFthTdCA2',
};
const b64u = (b) => Buffer.from(b).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
async function accessToken() {
  const now = Math.floor(Date.now()/1000);
  const header = b64u(JSON.stringify({alg:'RS256',typ:'JWT'}));
  const claims = b64u(JSON.stringify({iss:sa.client_email,scope:'https://www.googleapis.com/auth/cloud-platform',aud:sa.token_uri,iat:now,exp:now+3600}));
  const sign = crypto.createSign('RSA-SHA256'); sign.update(`${header}.${claims}`);
  const sig = sign.sign(sa.private_key,'base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  const r = await fetch(sa.token_uri,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:`grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${header}.${claims}.${sig}`});
  const j = await r.json(); if(!j.access_token) throw new Error('token mint fail: '+JSON.stringify(j).slice(0,200));
  return j.access_token;
}
const call = async (tok,method,body) => {
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:${method}`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+tok},body:JSON.stringify(body)});
  return { status:r.status, body: await r.text() };
};
const tok = await accessToken();
const lk = await call(tok,'lookup',{localId:Object.values(MAP)});
if (lk.status!==200){ console.error('lookup fail',lk.status,lk.body.slice(0,300)); process.exit(1); }
const byId = new Map(((JSON.parse(lk.body).users)||[]).map(u=>[u.localId,u]));
console.log(`lookup -> ${byId.size}/${Object.keys(MAP).length} Firebase accounts`);
const out={}; let ok=0;
for (const [tag,uid] of Object.entries(MAP)) {
  const u = byId.get(uid); if(!u){ console.log(`  x ${tag} missing`); continue; }
  const password = `Qa103!${crypto.randomBytes(4).toString('hex')}`;
  if (!DRY) { const up = await call(tok,'update',{localId:uid,password,returnSecureToken:false}); if(up.status===200) ok++; console.log(`  ${up.status===200?'ok':'FAIL'} ${tag} ${u.email} passReset=${up.status}`); }
  out[tag] = { email:u.email, password: DRY?'':password, uid, ign:u.displayName||null };
}
if (!DRY) { fs.mkdirSync(path.dirname(OUT),{recursive:true}); fs.writeFileSync(OUT,JSON.stringify(out,null,2)+'\n'); console.log(`state likha: ${OUT} (${ok} passwords)`); }
