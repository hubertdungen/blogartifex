const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const auth = require('../apiAuth');
auth.authorise = async (req, res) => {
  if (req.headers.authorization === 'Bearer test') return true;
  auth.send(res, 401, { error: 'auth' });
  return false;
};
const { handleVoice, availableVoices, shutdownVoice } = require('../voiceService');
const server = http.createServer((req, res) => handleVoice(req, res, new URL(req.url, 'http://localhost')));
let base;
const ready = new Promise(resolve => server.listen(0, '127.0.0.1', () => {
  base = `http://127.0.0.1:${server.address().port}`;
  resolve();
}));
after(async () => { shutdownVoice(); await new Promise(resolve => server.close(resolve)); });
const request = async (body, token = 'test') => {
  await ready;
  return fetch(base + '/api/voice', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
};
test('status exposes only PT-PT and US English; method and auth checks', async () => {
  await ready;
  const status = await (await fetch(base + '/api/voice/status')).json();
  assert.ok(status.voices.every(voice => ['pt-PT', 'en-US'].includes(voice.lang)));
  assert.equal((await fetch(base + '/api/voice')).status, 405);
  assert.equal((await request({ text: 'Text', voice: 'pt_PT-tugao', rate: 1 }, 'invalid')).status, 401);
});
test('rejects invalid voices, speeds, empty or oversized input', async () => {
  for (const payload of [null, {}, { text: '', voice: 'pt_PT-tugao', rate: 1 }, { text: 'Text', voice: 'pf_dora', rate: 1 }, { text: 'Text', voice: 'pt_PT-tugao', rate: 8 }, { text: 'x'.repeat(1801), voice: 'pt_PT-tugao', rate: 1 }]) {
    assert.equal((await request(payload)).status, 400);
  }
});
test('real PT-PT synthesis returns playable PCM WAV and bounds concurrency', { skip: !availableVoices().some(voice => voice.lang === 'pt-PT') }, async () => {
  const audioRequest = request({ text: 'Este artigo está escrito em português de Portugal.', voice: 'pt_PT-tugao', rate: 1 });
  // Wait until the first request has reached the server.
  await new Promise(resolve => setTimeout(resolve, 100));
  const concurrent = await request({ text: 'Outro artigo.', voice: 'pt_PT-tugao', rate: 1 });
  assert.equal(concurrent.status, 429);
  const response = await audioRequest;
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'audio/wav');
  const wav = Buffer.from(await response.arrayBuffer());
  assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
  assert.equal(wav.toString('ascii', 8, 12), 'WAVE');
  assert.ok(wav.length > 1000);
});
