/**
 * Shared by the server's API endpoints (docConverter.js, mediaStore.js).
 *
 * They sit on a public domain, so callers must present a Google access token
 * issued to this app's OAuth client with the Blogger scope — i.e. someone
 * signed in to BlogArtifex. Tokens are checked with Google's tokeninfo and
 * cached for 5 minutes.
 */
const fs = require('fs');
const path = require('path');

const TOKEN_CACHE_MS = 5 * 60 * 1000;
const BLOGGER_SCOPE = 'https://www.googleapis.com/auth/blogger';

// The same OAuth client the page uses (from .env at build time).
const readClientId = () => {
  if (process.env.REACT_APP_GOOGLE_CLIENT_ID) return process.env.REACT_APP_GOOGLE_CLIENT_ID;
  try {
    const env = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
    const match = env.match(/^REACT_APP_GOOGLE_CLIENT_ID=(.+)$/m);
    return match ? match[1].trim() : null;
  } catch {
    return null;
  }
};
const CLIENT_ID = readClientId();

const verifiedTokens = new Map(); // token -> expiry timestamp

const send = (res, status, body, headers = {}) => {
  const isBuffer = Buffer.isBuffer(body);
  res.writeHead(status, {
    'Content-Type': isBuffer ? headers['Content-Type'] : 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers
  });
  res.end(isBuffer ? body : JSON.stringify(body));
};

const verifyToken = async (token) => {
  const cached = verifiedTokens.get(token);
  if (cached && cached > Date.now()) return true;

  const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token)}`);
  if (!response.ok) return false;
  const info = await response.json();
  const scopes = (info.scope || '').split(' ');
  const rightClient = !CLIENT_ID || info.aud === CLIENT_ID || info.azp === CLIENT_ID;
  if (!rightClient || !scopes.includes(BLOGGER_SCOPE)) return false;

  verifiedTokens.set(token, Date.now() + Math.min(TOKEN_CACHE_MS, Number(info.expires_in || 0) * 1000));
  return true;
};

/**
 * Sends 401/502 itself and returns false when the caller isn't signed in.
 */
const authorise = async (req, res) => {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  try {
    if (token && await verifyToken(token)) return true;
    send(res, 401, { error: 'auth' });
  } catch {
    send(res, 502, { error: 'auth-check' });
  }
  return false;
};

const readBody = (req, maxBytes) => new Promise((resolve, reject) => {
  const chunks = [];
  let size = 0;
  req.on('data', chunk => {
    size += chunk.length;
    if (size > maxBytes) {
      reject(Object.assign(new Error('too large'), { status: 413 }));
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });
  req.on('end', () => resolve(Buffer.concat(chunks)));
  req.on('error', reject);
});

module.exports = { send, authorise, readBody };
