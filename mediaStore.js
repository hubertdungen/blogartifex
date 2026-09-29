/**
 * Image hosting for published posts.
 *
 * The Blogger API can't upload images, and images embedded as base64 break
 * Blogger (no featured image, a 1.6 MB post, and Blogger's own editor
 * re-uploads them the next time the post is opened). So the page sends each
 * image here before publishing and uses the returned public URL instead.
 *
 *   POST /api/media      signed-in users only (apiAuth.js); body = image bytes
 *                        → { url }
 *   GET  /media/<name>   public, cached for a year (names never change)
 *
 * Files are named by the SHA-256 of their content, so the same image is
 * stored once and a URL always means the same bytes.
 */
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { send, authorise, readBody } = require('./apiAuth');

const MAX_BYTES = 15 * 1024 * 1024;
const MEDIA_DIR = process.env.BLOGARTIFEX_MEDIA_DIR || path.join(os.homedir(), '.local', 'share', 'blogartifex', 'media');
const NAME = /^[a-f0-9]{40}\.(jpg|png|gif|webp)$/;

const TYPES = {
  jpg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp'
};

// Trust the bytes, not the Content-Type header.
const detectType = (buffer) => {
  if (buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  if (buffer.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buffer.slice(0, 4).toString('latin1') === 'GIF8') return 'gif';
  if (buffer.slice(0, 4).toString('latin1') === 'RIFF' && buffer.slice(8, 12).toString('latin1') === 'WEBP') return 'webp';
  return null;
};

// Public address of this server, as Blogger readers will reach it.
const publicBase = (req) => {
  if (process.env.BLOGARTIFEX_PUBLIC_URL) return process.env.BLOGARTIFEX_PUBLIC_URL.replace(/\/+$/, '');
  const proto = (req.headers['x-forwarded-proto'] || 'http').split(',')[0].trim();
  return `${proto}://${req.headers.host}`;
};

const handleUpload = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'method' });
  if (!await authorise(req, res)) return undefined;

  try {
    const body = await readBody(req, MAX_BYTES);
    const type = detectType(body);
    if (!type) return send(res, 415, { error: 'not-an-image' });

    const name = `${crypto.createHash('sha256').update(body).digest('hex').slice(0, 40)}.${type}`;
    const file = path.join(MEDIA_DIR, name);
    await fs.promises.mkdir(MEDIA_DIR, { recursive: true });
    if (!fs.existsSync(file)) {
      const temp = `${file}.${process.pid}.tmp`;
      await fs.promises.writeFile(temp, body);
      await fs.promises.rename(temp, file); // never serve a half-written file
    }
    return send(res, 200, { url: `${publicBase(req)}/media/${name}` });
  } catch (error) {
    return send(res, error.status || 500, { error: error.message });
  }
};

const serveMedia = (req, res, name) => {
  if (!NAME.test(name)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Not Found');
  }
  const file = path.join(MEDIA_DIR, name);
  fs.stat(file, (error, stats) => {
    if (error || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Not Found');
    }
    res.writeHead(200, {
      'Content-Type': TYPES[name.split('.').pop()],
      'Content-Length': stats.size,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff'
    });
    if (req.method === 'HEAD') return res.end();
    return fs.createReadStream(file).pipe(res);
  });
  return undefined;
};

module.exports = { handleUpload, serveMedia };
