const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const readline = require('readline');
const { send, authorise, readBody } = require('./apiAuth');

// For packaged releases, runtime/model files live beside the executable.
const root = process.pkg ? path.dirname(process.execPath) : __dirname;
const python = process.env.BLOGARTIFEX_VOICE_PYTHON || path.join(root, '.voice-venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
const workerFile = path.join(root, 'voice/worker.py');
const modelDir = path.join(root, 'voice/models');
const VOICES = [
  { id: 'pt_PT-tugao', name: 'Tugão · Português de Portugal', lang: 'pt-PT' },
  { id: 'af_heart', name: 'Heart · English (USA)', lang: 'en-US' }
];
const availableVoices = () => {
  if (!fs.existsSync(python) || !fs.existsSync(workerFile)) return [];
  const kokoro = ['kokoro-v1.0.int8.onnx', 'voices-v1.0.bin'].every(name => fs.existsSync(path.join(modelDir, name)));
  const piper = ['pt_PT-tugao-medium.onnx', 'pt_PT-tugao-medium.onnx.json'].every(name => fs.existsSync(path.join(modelDir, name)));
  return VOICES.filter(voice => voice.id === 'pt_PT-tugao' ? piper : kokoro);
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
  if (!await authorise(req, res)) return;
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
