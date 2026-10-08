import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReadAloudNavigation from './ReadAloudNavigation';
import ReadAloudVolume, { useReadAloudVolume } from './ReadAloudVolume';
import i18n, { t } from '../services/I18nService';
import { getStoredValue, setStoredValue } from '../utils/storage';
import { articleText, rankVoices, speechChunks } from '../utils/readAloud';
import '../styles/readAloud.css';

export default function BrowserReadAloud({ title, content, onClose }) {
  const supported = typeof window.speechSynthesis !== 'undefined' && typeof window.SpeechSynthesisUtterance !== 'undefined';
  const [voices, setVoices] = useState([]);
  const [language, setLanguage] = useState(() => (['pt-PT', 'en-US'].includes(getStoredValue('blogartifex_speech_language')) ? getStoredValue('blogartifex_speech_language') : 'pt-PT'));
  const [voiceURI, setVoiceURI] = useState(() => getStoredValue('blogartifex_speech_voice', ''));
  const [rate, setRate] = useState(() => {
    const saved = Number(getStoredValue('blogartifex_speech_rate', '1'));
    return saved >= 0.5 && saved <= 2 ? saved : 1;
  });
  const [, setLocale] = useState(i18n.getLocale());
  const [volume, changeVolume] = useReadAloudVolume();
  const volumeRef = useRef(volume);
  const [status, setStatus] = useState('idle');
  const [position, setPosition] = useState(0);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');
  const session = useRef({ generation: 0, chunks: [], index: 0, active: false, utterance: null });
  const sorted = useMemo(() => rankVoices(voices.filter(voice => voice.lang.replace('_', '-').toLowerCase() === language.toLowerCase()), language), [voices, language]);
  const voice = sorted.find(item => item.voiceURI === voiceURI) || sorted[0];

  useEffect(() => i18n.addListener(setLocale), []);
  useEffect(() => {
    if (!supported) return;
    const synth = window.speechSynthesis;
    const current = session.current;
    const update = () => setVoices(synth.getVoices());
    update();
    synth.addEventListener('voiceschanged', update);
    return () => {
      synth.removeEventListener('voiceschanged', update);
      current.generation++;
      if (current.active) synth.cancel();
    };
  }, [supported]);

  function stop() {
    const current = session.current;
    current.generation++;
    if (supported && current.active) window.speechSynthesis.cancel();
    current.active = false;
    current.utterance = null;
    setStatus('idle');
    setPosition(0);
  }

  function speak(index) {
    const current = session.current;
    const generation = ++current.generation;
    current.index = index;
    current.active = true;
    const utterance = new SpeechSynthesisUtterance(current.chunks[index]);
    current.utterance = utterance; // Retain until completion (some engines need this).
    utterance.voice = voice;
    utterance.lang = voice?.lang || language;
    utterance.rate = rate;
    utterance.volume = volumeRef.current;
    setPosition(index);
    setStatus('playing');
    utterance.onend = () => {
      if (generation !== current.generation) return;
      if (index + 1 < current.chunks.length) speak(index + 1);
      else {
        current.active = false;
        current.utterance = null;
        setPosition(current.chunks.length);
        setStatus('idle');
      }
    };
    utterance.onerror = () => {
      if (generation !== current.generation) return;
      current.active = false;
      setStatus('idle');
      setError(t('speech.failed'));
    };
    window.speechSynthesis.speak(utterance);
  }

  function play() {
    setError('');
    if (status === 'paused') { speak(session.current.index); return; }
    const chunks = speechChunks(articleText(title, content));
    if (!chunks.length) { setError(t('speech.empty')); return; }
    window.speechSynthesis.cancel();
    session.current.chunks = chunks;
    setTotal(chunks.length);
    speak(0);
  }

  function seek(index) {
    stop();
    setError('');
    speak(index);
  }

  function pause() {
    // Resume from the current short passage: reliable across mobile engines.
    session.current.generation++;
    window.speechSynthesis.cancel();
    setStatus('paused');
  }

  return <section className="read-aloud" aria-label={t('speech.title')}>
    <div className="read-aloud-heading"><strong>♫ {t('speech.title')}</strong>
      {onClose && <button type="button" onClick={() => { stop(); onClose(); }}>{t('speech.close')}</button>}
    </div>
    {onClose && <p className="read-aloud-article">{title}</p>}
    <div className="read-aloud-controls">
      <button type="button" disabled={!supported || !sorted.length || status === 'playing'} onClick={play}>
        <span aria-hidden="true">▶</span> {t(status === 'paused' ? 'speech.resume' : 'speech.play')}
      </button>
      <button type="button" disabled={status !== 'playing'} onClick={pause}>
        <span aria-hidden="true">⏸</span> {t('speech.pause')}
      </button>
      <button type="button" disabled={status === 'idle'} onClick={stop}><span aria-hidden="true">⏹</span> {t('speech.stop')}</button>
      <label>{t('speech.language')} <select value={language} onChange={event => {
        stop(); setLanguage(event.target.value); setVoiceURI('');
        setStoredValue('blogartifex_speech_language', event.target.value);
        setStoredValue('blogartifex_speech_voice', '');
      }}><option value="pt-PT">Português (Portugal)</option><option value="en-US">English (US)</option></select></label>
      <label>{t('speech.voice')} <select value={voice?.voiceURI || ''} disabled={!sorted.length} onChange={event => {
        stop(); setVoiceURI(event.target.value); setStoredValue('blogartifex_speech_voice', event.target.value);
      }}>{sorted.map(item => <option key={item.voiceURI} value={item.voiceURI}>{item.name} ({item.lang})</option>)}</select></label>
      <ReadAloudVolume volume={volume} onChange={value => {
        volumeRef.current = value;
        changeVolume(value);
        if (session.current.utterance) session.current.utterance.volume = value;
      }} />
      <label>{t('speech.speed')} <select value={rate} onChange={event => {
        stop(); setRate(Number(event.target.value)); setStoredValue('blogartifex_speech_rate', event.target.value);
      }}>{[0.5, 0.75, 1, 1.25, 1.5, 2].map(value => <option key={value} value={value}>{value}×</option>)}</select></label>
    </div>
    <p className="read-aloud-help">{t('speech.help')}</p>
    {total > 0 && <ReadAloudNavigation chunks={session.current.chunks} position={position} onSeek={seek} />}
    <span role="status">{!supported ? t('speech.unsupported') : !sorted.length ? t('speech.noVoices') : error}</span>
  </section>;
}
