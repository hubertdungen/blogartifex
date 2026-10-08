import React, { useEffect, useRef, useState } from 'react';
import BrowserReadAloud from './BrowserReadAloud';
import ReadAloudVolume, { useReadAloudVolume } from './ReadAloudVolume';
import AuthService from '../services/AuthService';
import i18n, { t } from '../services/I18nService';
import { getStoredValue, setStoredValue } from '../utils/storage';
import { articleText, speechChunks } from '../utils/readAloud';
import '../styles/readAloud.css';

export default function ReadAloud(props) {
  const [engine, setEngine] = useState('neural');
  const [, setLocale] = useState(i18n.getLocale());
  useEffect(() => i18n.addListener(setLocale), []);
  return <div>
    <label className="read-aloud-engine">{t('speech.engine')} <select value={engine} onChange={event => setEngine(event.target.value)}>
      <option value="neural">{t('speech.neural')}</option>
      <option value="browser">{t('speech.browser')}</option>
    </select></label>
    {engine === 'neural' ? <NeuralReadAloud {...props} /> : <BrowserReadAloud {...props} />}
  </div>;
}

export function NeuralReadAloud({ title, content, onClose }) {
  const [voices, setVoices] = useState(null);
  const [voiceId, setVoiceId] = useState(() => getStoredValue('blogartifex_neural_voice', 'pt_PT-tugao'));
  const [rate, setRate] = useState(() => {
    const saved = Number(getStoredValue('blogartifex_speech_rate', '1'));
    return saved >= .5 && saved <= 2 ? saved : 1;
  });
  const [volume, changeVolume] = useReadAloudVolume();
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [position, setPosition] = useState(0);
  const [total, setTotal] = useState(0);
  const player = useRef(null);
  const session = useRef({ generation: 0, controller: null, url: null, chunks: [], index: 0, prefetch: null });
  const voice = voices?.find(item => item.id === voiceId) || voices?.[0];

  useEffect(() => {
    if (player.current) player.current.volume = volume;
  }, [volume]);

  useEffect(() => {
    const controller = new AbortController();
    fetch('./api/voice/status', { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('unavailable');
      const result = await response.json();
      if (!Array.isArray(result.voices)) throw new Error('unavailable');
      if (!controller.signal.aborted) setVoices(result.voices.filter(item => ['pt-PT', 'en-US'].includes(item.lang)));
    }).catch(() => { if (!controller.signal.aborted) setVoices([]); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const current = session.current;
    const audio = player.current;
    return () => {
      current.generation++;
      current.controller?.abort();
      if (audio) { audio.pause(); audio.removeAttribute('src'); audio.load(); }
      if (current.url) URL.revokeObjectURL(current.url);
    };
  }, []);

  function stop() {
    const current = session.current;
    current.generation++;
    current.controller?.abort();
    current.controller = null;
    current.prefetch = null;
    const audio = player.current;
    if (audio) { audio.pause(); audio.removeAttribute('src'); audio.load(); }
    if (current.url) URL.revokeObjectURL(current.url);
    current.url = null;
    setStatus('idle');
    setPosition(0);
  }

  async function generate(text, signal) {
    const response = await fetch('./api/voice', {
      method: 'POST', signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${AuthService.getAuthToken()}` },
      body: JSON.stringify({ text, voice: voice.id, rate })
    });
    if (!response.ok) throw new Error(response.status === 429 ? 'busy' : response.status === 401 ? 'auth' : 'neuralFailed');
    return response.blob();
  }

  async function passage(index, generation) {
    const current = session.current;
    current.index = index;
    setPosition(index);
    setStatus('loading');
    try {
      const result = current.prefetch || generate(current.chunks[index], current.controller.signal).then(blob => ({ blob }), error => ({ error }));
      current.prefetch = null;
      const { blob, error: failure } = await result;
      if (generation !== current.generation) return;
      if (failure) throw failure;
      const audio = player.current;
      if (current.url) URL.revokeObjectURL(current.url);
      current.url = URL.createObjectURL(blob);
      audio.src = current.url;
      audio.onended = () => {
        if (generation !== current.generation) return;
        if (index + 1 < current.chunks.length) passage(index + 1, generation);
        else { setPosition(current.chunks.length); setStatus('idle'); }
      };
      // Keep just one passage ahead, so large articles don't fill memory.
      if (index + 1 < current.chunks.length) {
        current.prefetch = generate(current.chunks[index + 1], current.controller.signal).then(blob => ({ blob }), error => ({ error }));
      }
      try { await audio.play(); if (generation === current.generation) setStatus('playing'); }
      catch { if (generation === current.generation) { setStatus('paused'); setError(t('speech.tapResume')); } }
    } catch (failure) {
      if (generation !== current.generation) return;
      stop();
      setError(t(`speech.${['busy', 'auth'].includes(failure.message) ? failure.message : 'neuralFailed'}`));
    }
  }

  function play() {
    setError('');
    const current = session.current;
    if (status === 'paused') {
      const generation = current.generation;
      player.current.play().then(() => { if (generation === current.generation) setStatus('playing'); }).catch(() => setError(t('speech.tapResume')));
      return;
    }
    stop();
    const chunks = speechChunks(articleText(title, content), 600);
    if (!chunks.length) { setError(t('speech.empty')); return; }
    current.chunks = chunks;
    current.controller = new AbortController();
    setTotal(chunks.length);
    passage(0, current.generation);
  }

  function pause() { player.current.pause(); setStatus('paused'); }

  return <section className="read-aloud" aria-label={t('speech.title')}>
    <div className="read-aloud-heading"><strong>♫ {t('speech.title')}</strong>
      {onClose && <button type="button" onClick={() => { stop(); onClose(); }}>{t('speech.close')}</button>}
    </div>
    {onClose && <p className="read-aloud-article">{title}</p>}
    <div className="read-aloud-controls">
      <button type="button" disabled={!voice || status === 'loading' || status === 'playing'} onClick={play}>
        <span aria-hidden="true">▶</span> {t(status === 'loading' ? 'speech.generating' : status === 'paused' ? 'speech.resume' : 'speech.play')}
      </button>
      <button type="button" disabled={status !== 'playing'} onClick={pause}>
        <span aria-hidden="true">⏸</span> {t('speech.pause')}
      </button>
      <button type="button" disabled={status === 'idle'} onClick={stop}><span aria-hidden="true">⏹</span> {t('speech.stop')}</button>
      <label>{t('speech.voice')} <select value={voice?.id || ''} disabled={!voice} onChange={event => {
        stop(); setVoiceId(event.target.value); setStoredValue('blogartifex_neural_voice', event.target.value);
      }}>{voices?.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <ReadAloudVolume volume={volume} onChange={changeVolume} />
      <label>{t('speech.speed')} <select value={rate} onChange={event => {
        stop(); setRate(Number(event.target.value)); setStoredValue('blogartifex_speech_rate', event.target.value);
      }}>{[.5, .75, 1, 1.25, 1.5, 2].map(value => <option key={value} value={value}>{value}×</option>)}</select></label>
    </div>
    <audio ref={player} preload="auto" onError={() => { if (session.current.url) { stop(); setError(t('speech.neuralFailed')); } }} />
    <p className="read-aloud-help">{t('speech.neuralHelp')}</p>
    {total > 0 && <progress aria-label={t('speech.progress')} value={position} max={total} />}
    <span role="status">{voices === null ? t('common.loading') : !voices.length ? t('speech.neuralUnavailable') : error || (status === 'loading' ? t('speech.generating') : '')}</span>
  </section>;
}
