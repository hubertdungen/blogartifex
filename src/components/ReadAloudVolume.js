import React, { useState } from 'react';
import { t } from '../services/I18nService';
import { getStoredValue, setStoredValue } from '../utils/storage';

export function useReadAloudVolume() {
  const [volume, setVolume] = useState(() => {
    const saved = Number(getStoredValue('blogartifex_speech_volume', '1'));
    return Number.isFinite(saved) && saved >= 0 && saved <= 1 ? saved : 1;
  });
  function changeVolume(value) {
    setVolume(value);
    setStoredValue('blogartifex_speech_volume', String(value));
  }
  return [volume, changeVolume];
}

export default function ReadAloudVolume({ volume, onChange }) {
  const percent = Math.round(volume * 100);
  return <label className="read-aloud-volume">
    {t('speech.volume')}
    <input type="range" min="0" max="100" step="1" value={percent}
      aria-valuetext={`${percent}%`} onChange={event => onChange(Number(event.target.value) / 100)} />
    <span className="read-aloud-volume-value">{percent}%</span>
  </label>;
}
