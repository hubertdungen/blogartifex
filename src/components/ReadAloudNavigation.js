import React from 'react';
import { t } from '../services/I18nService';

export default function ReadAloudNavigation({ chunks, position, onSeek }) {
  const current = Math.min(position, chunks.length - 1);
  return <div className="read-aloud-navigation">
    <label>{t('speech.seek')} ({Math.min(position + 1, chunks.length)}/{chunks.length})
      <input type="range" min="0" max={chunks.length - 1} step="1" value={current}
        disabled={chunks.length < 2} onChange={event => onSeek(Number(event.target.value))} />
    </label>
    <details><summary>{t('speech.passages')}</summary>
      <div className="read-aloud-passages">{chunks.map((text, index) =>
        <button type="button" key={index} aria-current={position === index ? 'true' : undefined}
          onClick={() => onSeek(index)}>{index + 1}. {text}</button>
      )}</div>
    </details>
    <p className="read-aloud-help">{t('speech.seekHelp')}</p>
  </div>;
}
