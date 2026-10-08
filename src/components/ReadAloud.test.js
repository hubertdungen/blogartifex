import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import ReadAloud from './BrowserReadAloud';
import i18n from '../services/I18nService';
import { articleText, speechChunks, rankVoices } from '../utils/readAloud';

const natural = { name: 'Portuguese Natural', lang: 'pt-PT', voiceURI: 'natural' };
let synth;
beforeEach(() => {
  localStorage.clear();
  i18n.setLocale('pt-PT');
  synth = { getVoices: jest.fn(() => [natural]), speak: jest.fn(), cancel: jest.fn(), addEventListener: jest.fn(), removeEventListener: jest.fn() };
  window.speechSynthesis = synth;
  window.SpeechSynthesisUtterance = function(text) { this.text = text; };
});

test('extracts readable HTML without scripts and preserves paragraph boundaries', () => {
  expect(articleText('Title', '<p>A &amp; B</p><script>bad()</script><p>Next<br>line</p>')).toBe('Title\nA & B\nNext\nline');
  const text = 'Long article with several sentences. '.repeat(100);
  const chunks = speechChunks(text);
  expect(chunks.every(chunk => chunk.length <= 220)).toBe(true);
  expect(chunks.join(' ')).toBe(text.trim());
  expect(rankVoices([{ name: 'English Natural', lang: 'en-US' }, natural, { name: 'Portuguese', lang: 'pt-PT' }], 'pt-PT')[0]).toBe(natural);
});

test('reads all passages, ignores cancelled callbacks, resumes and stops on unmount', () => {
  const { unmount } = render(<ReadAloud title="Title" content={`<p>${'Sentence with words. '.repeat(40)}</p>`} />);
  fireEvent.click(screen.getByText('Ouvir artigo'));
  const first = synth.speak.mock.calls[0][0];
  expect(first.voice).toBe(natural);
  act(() => first.onend());
  expect(synth.speak).toHaveBeenCalledTimes(2);
  const second = synth.speak.mock.calls[1][0];
  fireEvent.click(screen.getByText('Pausar'));
  act(() => second.onend());
  expect(synth.speak).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByText('Retomar'));
  expect(synth.speak.mock.calls[2][0].text).toBe(second.text);
  unmount();
  expect(synth.cancel).toHaveBeenCalledTimes(3);
  act(() => synth.speak.mock.calls[2][0].onend());
  expect(synth.speak).toHaveBeenCalledTimes(3);
});

test('shows speech errors', () => {
  render(<ReadAloud title="Title" content="<p>Text</p>" />);
  fireEvent.click(screen.getByText('Ouvir artigo'));
  act(() => synth.speak.mock.calls[0][0].onerror());
  expect(screen.getByRole('status')).toHaveTextContent('Não foi possível');
  expect(screen.getByText('Parar')).toBeDisabled();
});

test('disables playback when the browser has no installed voices', () => {
  synth.getVoices.mockReturnValue([]);
  render(<ReadAloud title="Title" content="Text" />);
  expect(screen.getByText('Ouvir artigo')).toBeDisabled();
  expect(screen.getByRole('status')).toHaveTextContent('Sem vozes disponíveis');
});
