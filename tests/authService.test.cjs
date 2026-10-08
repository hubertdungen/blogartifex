const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
let google, server, base, dir, revoked = [];
before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ba-auth-'));
  google = http.createServer(async (req, res) => {
    let body = ''; for await (const c of req) body += c; const p = new URLSearchParams(body);
    res.setHeader('Content-Type', 'application/json');
    if (req.url.startsWith('/revoke')) { revoked.push(new URL(req.url, 'http://x').searchParams.get('token')); return res.end('{}'); }
    if (p.get('client_secret') !== 'shh') { res.writeHead(401); return res.end('{"error":"invalid_client"}'); }
    if (p.get('grant_type') === 'authorization_code') return res.end(JSON.stringify(p.get('code') === 'good' ? { access_token: 'at1', expires_in: 3599, refresh_token: 'rt1', scope: 'https://www.googleapis.com/auth/blogger' } : { error: 'invalid_grant' }));
    if (p.get('refresh_token') === 'rt1') return res.end(JSON.stringify({ access_token: 'at2', expires_in: 3599, scope: 'https://www.googleapis.com/auth/blogger' }));
    res.writeHead(400); res.end('{"error":"invalid_grant"}');
  });
  await new Promise(r => google.listen(0, '127.0.0.1', r));
  const g = 'http://127.0.0.1:' + google.address().port;
  Object.assign(process.env, { BLOGARTIFEX_GOOGLE_TOKEN_URL: g + '/token', BLOGARTIFEX_GOOGLE_REVOKE_URL: g + '/revoke', BLOGARTIFEX_AUTH_DIR: dir, REACT_APP_GOOGLE_CLIENT_ID: 'cid', GOOGLE_CLIENT_SECRET: 'shh' });
  const { handleAuth } = require('../authService');
  server = http.createServer((req, res) => handleAuth(req, res, new URL(req.url, 'http://localhost')));
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  base = 'http://127.0.0.1:' + server.address().port;
});
after(async () => { server.close(); google.close(); fs.rmSync(dir, { recursive: true, force: true }); });
const post = (route, body, cookie) => fetch(base + '/api/auth' + route, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(body || {}) });
test('exchanges the code, keeps the refresh token server-side, renews, and revokes on logout', async () => {
  assert.deepEqual(await (await fetch(base + '/api/auth/status')).json(), { available: true });
  assert.equal((await post('/exchange', { code: 'bad' })).status, 502);
  assert.equal((await fetch(base + '/api/auth/exchange', { method: 'POST', headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' }, body: '{"code":"good"}' })).status, 403);
  const r = await post('/exchange', { code: 'good' });
  assert.equal(r.status, 200);
  const data = await r.json();
  assert.equal(data.access_token, 'at1'); assert.equal(data.renewable, true); assert.equal(data.refresh_token, undefined);
  const cookie = r.headers.get('set-cookie'); assert.match(cookie, /HttpOnly; SameSite=Lax/);
  const sid = cookie.split(';')[0];
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, sid.split('=')[1] + '.json'), 'utf8')).refresh_token, 'rt1');
  assert.equal((await post('/refresh')).status, 401);
  assert.equal((await (await post('/refresh', null, sid)).json()).access_token, 'at2');
  assert.equal((await post('/logout', null, sid)).status, 200);
  await new Promise(r => setTimeout(r, 100));
  assert.deepEqual(revoked, ['rt1']);
  assert.equal((await post('/refresh', null, sid)).status, 401);
});
