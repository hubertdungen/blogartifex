import React, { useEffect, useRef, useState } from 'react';
import ReadAloudNavigation from './ReadAloudNavigation';
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
  const session = useRef({ generation: 0, controller: null, url: null, chunks: [], index: 0, cache: {}, prefetching: false });
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

  function clearCache() {
    const current = session.current;
    if (current.cache) {
      Object.keys(current.cache).forEach(key => {
        const entry = current.cache[key];
        if (entry.url) {
          URL.revokeObjectURL(entry.url);
        }
      });
      current.cache = {};
    }
    current.url = null;
  }

  useEffect(() => {
    const current = session.current;
    const audio = player.current;
    return () => {
      current.generation++;
      current.controller?.abort();
      if (audio) { audio.pause(); audio.removeAttribute('src'); audio.load(); }
      clearCache();
    };
  }, []);

  function stop() {
    const current = session.current;
    current.generation++;
    current.controller?.abort();
    current.controller = null;
    const audio = player.current;
    if (audio) { audio.pause(); audio.removeAttribute('src'); audio.load(); }
    current.url = null;
    setStatus('idle');
    setPosition(0);
  }

  async function generate(text, signal) {
    for (let attempt = 0; ; attempt++) {
      const response = await fetch('./api/voice', {
        method: 'POST', signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${AuthService.getAuthToken()}` },
        body: JSON.stringify({ text, voice: voice.id, rate })
      });
      if (response.ok) return response.blob();
      // The engine serves one passage at a time; wait for it rather than failing the whole reading.
      if (response.status === 429 && attempt < 30) {
        await new Promise((resolve, reject) => {
          const timer = setTimeout(resolve, 2000);
          signal?.addEventListener('abort', () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
        });
        continue;
      }
      throw new Error(response.status === 429 ? 'busy' : response.status === 401 ? 'auth' : 'neuralFailed');
    }
  }

  function fetchChunk(index, signal) {
    const current = session.current;
    if (!current.cache) current.cache = {};

    if (current.cache[index]) {
      return current.cache[index];
    }

    const promise = generate(current.chunks[index], signal).then(
      blob => {
        if (signal && signal.aborted) {
          delete current.cache[index];
          throw new Error('aborted');
        }
        const url = URL.createObjectURL(blob);
        const entry = { blob, url, promise: null };
        current.cache[index] = entry;
        return entry;
      },
      error => {
        delete current.cache[index];
        throw error;
      }
    );

    const entry = { blob: null, url: null, promise };
    current.cache[index] = entry;
    return entry;
  }

  async function processPrefetchQueue(generation) {
    const current = session.current;
    if (generation !== current.generation) return;
    if (current.prefetching === generation) return;

    current.prefetching = generation;
    try {
      while (generation === current.generation) {
        // First, check if the current playing index is still fetching.
        // If it is, wait for it to finish so we do not run concurrent backend synthesis.
        const curIndex = current.index;
        if (curIndex < current.chunks.length) {
          const curEntry = current.cache && current.cache[curIndex];
          if (curEntry && curEntry.promise) {
            try {
              await curEntry.promise;
            } catch {
              // Ignore, passage will handle it
            }
            continue;
          }
        }

        // Find the first index in prefetch window [current.index + 1, current.index + 3] that needs prefetching
        let targetIndex = -1;
        for (let i = 1; i <= 3; i++) {
          const idx = current.index + i;
          if (idx < current.chunks.length && (!current.cache || !current.cache[idx])) {
            targetIndex = idx;
            break;
          }
        }

        if (targetIndex === -1) {
          break;
        }

        const entry = fetchChunk(targetIndex, current.controller.signal);
        if (entry.promise) {
          await entry.promise;
        }

        await new Promise(resolve => setTimeout(resolve, 50));
      }
    } catch {
      // background prefetching errors can be ignored
    } finally {
      if (current.prefetching === generation) current.prefetching = false;
    }
  }

  async function passage(index, generation) {
    const current = session.current;
    current.index = index;
    setPosition(index);
    setStatus('loading');
    try {
      // Trigger background sequential prefetching of the next 3 passages
      processPrefetchQueue(generation);

      // Clean up cache entries outside [index - 3, index + 3] window
      if (current.cache) {
        Object.keys(current.cache).forEach(key => {
          const k = parseInt(key, 10);
          if (k < index - 3 || k > index + 3) {
            const oldEntry = current.cache[k];
            if (oldEntry) {
              if (oldEntry.url) URL.revokeObjectURL(oldEntry.url);
              delete current.cache[k];
            }
          }
        });
      }

      const entry = fetchChunk(index, current.controller.signal);
      let chunkData;
      if (entry.promise) {
        try {
          chunkData = await entry.promise;
        } catch (err) {
          if (generation !== current.generation) return;
          throw err;
        }
      } else {
        chunkData = entry;
      }

      if (generation !== current.generation) return;
      const audio = player.current;
      current.url = chunkData.url;
      audio.src = chunkData.url;
      audio.onended = () => {
        if (generation !== current.generation) return;
        if (index + 1 < current.chunks.length) passage(index + 1, generation);
        else { setPosition(current.chunks.length); setStatus('idle'); }
      };

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
    const isSameChunks = current.chunks && current.chunks.length === chunks.length && current.chunks.every((val, idx) => val === chunks[idx]);
    if (!isSameChunks) {
      clearCache();
    }
    current.chunks = chunks;
    current.controller = new AbortController();
    setTotal(chunks.length);
    passage(0, current.generation);
  }

  function seek(index) {
    const current = session.current;
    const chunks = current.chunks;
    if (!chunks.length) return;
    stop();
    setError('');
    current.chunks = chunks;
    current.controller = new AbortController();
    passage(index, current.generation);
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
        stop(); clearCache(); setVoiceId(event.target.value); setStoredValue('blogartifex_neural_voice', event.target.value);
      }}>{voices?.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <ReadAloudVolume volume={volume} onChange={changeVolume} />
      <label>{t('speech.speed')} <select value={rate} onChange={event => {
        stop(); clearCache(); setRate(Number(event.target.value)); setStoredValue('blogartifex_speech_rate', event.target.value);
      }}>{[.5, .75, 1, 1.25, 1.5, 2].map(value => <option key={value} value={value}>{value}×</option>)}</select></label>
    </div>
    <audio ref={player} controls={total > 0} preload="auto"
      onPlay={() => { if (session.current.url) setStatus('playing'); }}
      onPause={() => { if (session.current.url && !player.current.ended) setStatus('paused'); }} onError={() => { if (session.current.url) { stop(); setError(t('speech.neuralFailed')); } }} />
    <p className="read-aloud-help">{t('speech.neuralHelp')}</p>
    {total > 0 && <ReadAloudNavigation chunks={session.current.chunks} position={position} onSeek={seek} />}
    <span role="status">{voices === null ? t('common.loading') : !voices.length ? t('speech.neuralUnavailable') : error || (status === 'loading' ? t('speech.generating') : '')}</span>
  </section>;
}
