/**
 * POST /api/convert — turns .doc / .rtf / .odt into .docx with LibreOffice
 * (free, runs locally), so the browser can import them the same way as .docx.
 *
 * Browsers can't read the binary Word 97-2003 format with its formatting, and
 * no free library does it well; LibreOffice does. The endpoint only exists
 * where LibreOffice is installed (the server copy); elsewhere it answers 501
 * and the page asks the user to save the file as .docx instead.
 *
 * It sits on a public domain, so: callers must present a Google access token
 * issued to this app's client ID with the Blogger scope, files are capped at
 * 20 MB, one conversion runs at a time, each gets a throw-away LibreOffice
 * profile and is killed after 60 s.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const MAX_BYTES = 20 * 1024 * 1024;
const TIMEOUT_MS = 60 * 1000;
const TOKEN_CACHE_MS = 5 * 60 * 1000;
const BLOGGER_SCOPE = 'https://www.googleapis.com/auth/blogger';
const SOFFICE = process.env.SOFFICE_PATH || 'soffice';
const ALLOWED = new Set(['doc', 'rtf', 'odt']);

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
let busy = false;

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

const readBody = (req) => new Promise((resolve, reject) => {
  const chunks = [];
  let size = 0;
  req.on('data', chunk => {
    size += chunk.length;
    if (size > MAX_BYTES) {
      reject(Object.assign(new Error('too large'), { status: 413 }));
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });
  req.on('end', () => resolve(Buffer.concat(chunks)));
  req.on('error', reject);
});

const runLibreOffice = (dir, inputFile) => new Promise((resolve, reject) => {
  const child = spawn(SOFFICE, [
    '--headless', '--norestore', '--nolockcheck',
    `-env:UserInstallation=file://${path.join(dir, 'profile')}`,
    '--convert-to', 'docx:MS Word 2007 XML',
    '--outdir', dir,
    inputFile
  ], { stdio: 'ignore' });

  const timer = setTimeout(() => {
    child.kill('SIGKILL');
    reject(Object.assign(new Error('timeout'), { status: 504 }));
  }, TIMEOUT_MS);

  child.on('error', error => {
    clearTimeout(timer);
    reject(error.code === 'ENOENT' ? Object.assign(new Error('unavailable'), { status: 501 }) : error);
  });
  child.on('exit', code => {
    clearTimeout(timer);
    if (code === 0) resolve();
    else reject(new Error(`LibreOffice exited with ${code}`));
  });
});

const handleConvert = async (req, res, url) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'method' });

  const format = (url.searchParams.get('from') || '').toLowerCase();
  if (!ALLOWED.has(format)) return send(res, 400, { error: 'format' });

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  let authorised = false;
  try {
    authorised = !!token && await verifyToken(token);
  } catch {
    return send(res, 502, { error: 'auth-check' });
  }
  if (!authorised) return send(res, 401, { error: 'auth' });

  if (busy) return send(res, 429, { error: 'busy' });
  busy = true;

  let dir;
  try {
    const body = await readBody(req);
    if (!body.length) return send(res, 400, { error: 'empty' });

    dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'blogartifex-convert-'));
    const inputFile = path.join(dir, `document.${format}`);
    await fs.promises.writeFile(inputFile, body);
    await runLibreOffice(dir, inputFile);

    const docx = await fs.promises.readFile(path.join(dir, 'document.docx'));
    return send(res, 200, docx, {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });
  } catch (error) {
    return send(res, error.status || 500, { error: error.status === 501 ? 'unavailable' : error.message });
  } finally {
    busy = false;
    if (dir) fs.promises.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
};

module.exports = { handleConvert };
