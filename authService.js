/**
 * Long-lived sign-in for the web app.
 *
 * The browser-only (implicit) Google flow hands out access tokens that die after
 * one hour and cannot be renewed silently. With GOOGLE_CLIENT_SECRET set, the
 * page uses the authorization-code flow instead: the code is exchanged here,
 * the refresh token stays on the server (never in the browser), and the page
 * asks for a fresh access token whenever the old one is about to expire.
 * Without the secret every route answers 501 and the page keeps the old flow.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { send, readBody } = require('./apiAuth');

const root = process.pkg ? path.dirname(process.execPath) : __dirname;
const readEnv = (key) => {
  if (process.env[key]) return process.env[key].trim();
  try {
    return fs.readFileSync(path.join(__dirname, '.env'), 'utf8').match(new RegExp(`^${key}=(.+)$`, 'm'))?.[1].trim() || null;
  } catch {
    return null;
  }
};
const CLIENT_ID = readEnv('REACT_APP_GOOGLE_CLIENT_ID');
const SECRET = readEnv('GOOGLE_CLIENT_SECRET');
const TOKEN_URL = process.env.BLOGARTIFEX_GOOGLE_TOKEN_URL || 'https://oauth2.googleapis.com/token';
const REVOKE_URL = process.env.BLOGARTIFEX_GOOGLE_REVOKE_URL || 'https://oauth2.googleapis.com/revoke';
const DIR = process.env.BLOGARTIFEX_AUTH_DIR || path.join(root, '.auth');
const COOKIE = 'blogartifex_auth';
const MAX_AGE = 180 * 24 * 3600; // the cookie; Google decides how long the refresh token itself lives
const available = () => Boolean(CLIENT_ID && SECRET);

const sessionFile = (sid) => path.join(DIR, sid + '.json');
const readSession = (req) => {
  const sid = (req.headers.cookie || '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=([a-f0-9]{64})(?:;|$)`))?.[1];
  if (!sid) return null;
  try { return { sid, ...JSON.parse(fs.readFileSync(sessionFile(sid), 'utf8')) }; } catch { return null; }
};
const cookie = (sid, maxAge, req) => {
  const secure = req.headers['x-forwarded-proto'] === 'https' || req.socket.encrypted;
  return `${COOKIE}=${sid}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
};
const sameOrigin = (req) => {
  if (!req.headers.origin) return true;
  try { return new URL(req.headers.origin).host === req.headers.host; } catch { return false; }
};

async function google(params) {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: SECRET, ...params }),
    signal: AbortSignal.timeout(15000)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.error || 'google'), { status: response.status, detail: data.error });
  return data;
}

async function handleAuth(req, res, url) {
  const route = url.pathname.replace(/^\/api\/auth/, '');
  if (route === '/status' && req.method === 'GET') return send(res, 200, { available: available() });
  if (req.method !== 'POST') return send(res, 405, { error: 'method' }, { Allow: 'POST' });
  if (!sameOrigin(req)) return send(res, 403, { error: 'origin' });
  if (!available()) return send(res, 501, { error: 'unavailable' });
  try {
    if (route === '/exchange') {
      let code;
      try { code = JSON.parse((await readBody(req, 4000)).toString('utf8')).code; } catch { /* handled below */ }
      if (typeof code !== 'string' || !code.trim() || code.length > 2000) return send(res, 400, { error: 'invalid-request' });
      const data = await google({ code, redirect_uri: 'postmessage', grant_type: 'authorization_code' });
      if (!data.access_token) return send(res, 502, { error: 'exchange-failed' });
      const sid = crypto.randomBytes(32).toString('hex');
      fs.mkdirSync(DIR, { recursive: true, mode: 0o700 });
      // Google only returns a refresh token on consent; keep the previous one when it re-signs the same browser.
      const previous = readSession(req);
      const refresh = data.refresh_token || previous?.refresh_token || null;
      if (previous) fs.rmSync(sessionFile(previous.sid), { force: true });
      fs.writeFileSync(sessionFile(sid), JSON.stringify({ refresh_token: refresh, created: new Date().toISOString() }), { mode: 0o600 });
      return send(res, 200, { access_token: data.access_token, expires_in: data.expires_in, scope: data.scope, renewable: Boolean(refresh) }, { 'Set-Cookie': cookie(sid, MAX_AGE, req) });
    }
    if (route === '/refresh') {
      const session = readSession(req);
      if (!session?.refresh_token) return send(res, 401, { error: 'no-session' });
      try {
        const data = await google({ refresh_token: session.refresh_token, grant_type: 'refresh_token' });
        return send(res, 200, { access_token: data.access_token, expires_in: data.expires_in, scope: data.scope, renewable: true });
      } catch (error) {
        if (error.detail === 'invalid_grant') { // revoked or expired on Google's side: the sign-in is over
          fs.rmSync(sessionFile(session.sid), { force: true });
          return send(res, 401, { error: 'expired' }, { 'Set-Cookie': cookie('', 0, req) });
        }
        throw error;
      }
    }
    if (route === '/logout') {
      const session = readSession(req);
      if (session) {
        fs.rmSync(sessionFile(session.sid), { force: true });
        if (session.refresh_token) fetch(REVOKE_URL + '?token=' + encodeURIComponent(session.refresh_token), { method: 'POST', signal: AbortSignal.timeout(10000) }).catch(() => {});
      }
      return send(res, 200, { ok: true }, { 'Set-Cookie': cookie('', 0, req) });
    }
    return send(res, 404, { error: 'not-found' });
  } catch (error) {
    return send(res, 502, { error: 'google-unavailable' });
  }
}

module.exports = { handleAuth, authAvailable: available };
