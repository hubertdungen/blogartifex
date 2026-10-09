const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const readline = require('readline');
const { timingSafeEqual } = require('crypto');
const { send, authorise, readBody } = require('./apiAuth');

// For packaged releases, runtime/model files live beside the executable.
const root = process.pkg ? path.dirname(process.execPath) : __dirname;
const python = process.env.BLOGARTIFEX_VOICE_PYTHON || path.join(root, '.voice-venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
const workerFile = path.join(root, 'voice/worker.py');
const modelDir = path.join(root, 'voice/models');
const VOICES = [
  { id: 'pt_PT-tugao', name: 'Tugão · Português de Portugal', lang: 'pt-PT' },
  { id: 'pt_PT-voice3', name: 'Voz 3 · OpenVoiceOS · tom médio · Português de Portugal', lang: 'pt-PT' },
  { id: 'pt_PT-voice4', name: 'Voz 4 · OpenVoiceOS · tom grave · Português de Portugal', lang: 'pt-PT' },
  { id: 'af_heart', name: 'Heart · Kokoro · English (USA)', lang: 'en-US' },
  ...[['af_bella','Bella'],['af_nicole','Nicole'],['af_sarah','Sarah'],['am_michael','Michael'],['am_fenrir','Fenrir']].map(([id,name]) => ({ id, name: name + ' · Kokoro · English (USA)', lang: 'en-US' })),
  ...['miro','dii'].map(name => ({ id: 'phoonnx_'+name, name: name[0].toUpperCase()+name.slice(1)+' · Portugal · uso não comercial', lang: 'pt-PT' })),
  { id: 'kokoro_eu_pt', name: 'Tuga · Kokoro · Português de Portugal', lang: 'pt-PT' },
  { id: 'sopro_pt_PT', name: 'Sopro · referência Tugão · Português de Portugal', lang: 'pt-PT' },
  { id: 'sopro_en_US', name: 'Sopro · referência Heart · English (USA)', lang: 'en-US' },
  ...['Bella','Jasper','Luna','Bruno','Rosie','Hugo','Kiki','Leo'].map(name => ({ id: 'kitten_'+name, name: name + ' · Kitten · English (USA)', lang: 'en-US' }))
];
const availableVoices = () => {
  if (!fs.existsSync(python) || !fs.existsSync(workerFile)) return [];
  const kokoro = ['kokoro-v1.0.int8.onnx', 'voices-v1.0.bin'].every(name => fs.existsSync(path.join(modelDir, name)));
  const piper = ['pt_PT-tugao-medium.onnx', 'pt_PT-tugao-medium.onnx.json'].every(name => fs.existsSync(path.join(modelDir, name)));
  return VOICES.filter(voice => {
    if (voice.id === 'pt_PT-tugao') return piper;
    if (voice.id.startsWith('phoonnx_')) return fs.existsSync(path.join(modelDir, 'phoonnx-'+voice.id.slice(8)+'/ready.json'));
    if (voice.id === 'kokoro_eu_pt') return fs.existsSync(path.join(modelDir, 'kokoro-eu-pt/ready.json'));
    if (voice.id.startsWith('sopro_')) return fs.existsSync(path.join(modelDir, 'sopro/ready.json'));
    if (voice.id.startsWith('kitten_')) return fs.existsSync(path.join(modelDir, 'kitten/ready.json'));
    return kokoro;
  });
};
let worker;
let pending;
let idleTimer;
let reserved = false;

function releaseWorker() {
  clearTimeout(idleTimer);
  const old = worker;
  worker = null;
  if (old) old.kill();
}

function generate(payload) {
  clearTimeout(idleTimer);
  return new Promise((resolve, reject) => {
    if (!worker) {
      const child = spawn(python, ['-u', workerFile], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
      worker = child;
      // Never log article text or Python diagnostics that may include it.
      child.stderr.on('data', () => {});
      const fail = () => {
        if (worker !== child) return;
        worker = null;
        if (pending) { const job = pending; pending = null; job.reject(new Error('worker-unavailable')); }
      };
      child.on('error', fail);
      child.on('exit', fail);
      child.stdin.on('error', fail);
      readline.createInterface({ input: child.stdout }).on('line', line => {
        if (worker !== child || !pending) return;
        const job = pending;
        pending = null;
        try {
          const result = JSON.parse(line);
          if (!result.audio) throw new Error('synthesis-failed');
          const wav = Buffer.from(result.audio, 'base64');
          if (wav.toString('ascii', 0, 4) !== 'RIFF') throw new Error('invalid-audio');
          job.resolve(wav);
        } catch (error) { job.reject(error); }
        idleTimer = setTimeout(releaseWorker, 5 * 60 * 1000);
        idleTimer.unref();
      });
    }
    pending = { resolve, reject };
    worker.stdin.write(JSON.stringify(payload) + '\n');
  });
}

async function handleVoice(req, res, url) {
  if (url.pathname === '/api/voice/status') {
    if (req.method !== 'GET') return send(res, 405, { error: 'method' }, { Allow: 'GET' });
    const voices = availableVoices();
    return send(res, 200, { available: voices.length > 0, voices });
  }
  if (req.method !== 'POST') return send(res, 405, { error: 'method' }, { Allow: 'POST' });
  // An optional server-to-server bridge lets the local reader reuse this worker.
  // The secret is never sent to a browser; external callers still use Google auth.
  let bridge = false;
  const remote = req.socket?.remoteAddress;
  if (['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote) && process.env.BLOGARTIFEX_VOICE_BRIDGE_KEY_FILE) {
    try {
      const expected = Buffer.from(fs.readFileSync(process.env.BLOGARTIFEX_VOICE_BRIDGE_KEY_FILE, 'utf8').trim());
      const supplied = Buffer.from(req.headers['x-voice-bridge'] || '');
      bridge = expected.length >= 32 && expected.length === supplied.length && timingSafeEqual(expected, supplied);
    } catch { /* A missing bridge key must never bypass normal authentication. */ }
  }
  if (!bridge && !await authorise(req, res)) return;
  let payload;
  try {
    payload = JSON.parse((await readBody(req, 16000)).toString('utf8'));
    if (!payload || typeof payload.text !== 'string' || !payload.text.trim() || payload.text.length > 1800
      || typeof payload.rate !== 'number' || !Number.isFinite(payload.rate) || payload.rate < 0.5 || payload.rate > 2
      || !VOICES.some(voice => voice.id === payload.voice)) throw new Error('invalid');
  } catch (error) { return send(res, error.status || 400, { error: 'invalid-request' }); }
  if (!availableVoices().some(voice => voice.id === payload.voice)) return send(res, 503, { error: 'voice-unavailable' });
  if (reserved) return send(res, 429, { error: 'busy' }, { 'Retry-After': '2' });
  reserved = true;
  let cancelled = false;
  const cancel = () => {
    if (res.writableEnded) return;
    cancelled = true;
    if (pending) { const job = pending; pending = null; job.reject(new Error('cancelled')); }
    releaseWorker();
  };
  res.on('close', cancel);
  const timeout = setTimeout(cancel, 120000);
  try {
    const wav = await generate({ text: payload.text, voice: payload.voice, rate: payload.rate });
    if (!cancelled) send(res, 200, wav, { 'Content-Type': 'audio/wav', 'X-Content-Type-Options': 'nosniff' });
  } catch {
    if (!res.destroyed) send(res, cancelled ? 504 : 502, { error: 'synthesis-failed' });
  } finally {
    clearTimeout(timeout);
    res.removeListener('close', cancel);
    reserved = false;
  }
}
process.once('exit', releaseWorker);
module.exports = { handleVoice, availableVoices, shutdownVoice: releaseWorker };
