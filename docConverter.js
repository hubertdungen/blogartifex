/**
 * POST /api/convert — turns .doc / .rtf / .odt into .docx with LibreOffice
 * (free, runs locally), so the browser can import them the same way as .docx.
 *
 * Browsers can't read the binary Word 97-2003 format with its formatting, and
 * no free library does it well; LibreOffice does. The endpoint only exists
 * where LibreOffice is installed (the server copy); elsewhere it answers 501
 * and the page asks the user to save the file as .docx instead.
 *
 * Only signed-in users (apiAuth.js); files are capped at 20 MB, one
 * conversion runs at a time, each gets a throw-away LibreOffice profile and
 * is killed after 60 s.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const { send, authorise, readBody } = require('./apiAuth');

const MAX_BYTES = 20 * 1024 * 1024;
const TIMEOUT_MS = 60 * 1000;
const SOFFICE = process.env.SOFFICE_PATH || 'soffice';
const ALLOWED = new Set(['doc', 'rtf', 'odt']);

let busy = false;

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

  if (!await authorise(req, res)) return undefined;

  if (busy) return send(res, 429, { error: 'busy' });
  busy = true;

  let dir;
  try {
    const body = await readBody(req, MAX_BYTES);
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
