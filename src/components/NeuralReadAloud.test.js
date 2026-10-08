import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NeuralReadAloud } from './ReadAloud';
import i18n from '../services/I18nService';

let play, pause;
beforeEach(() => {
  localStorage.clear(); i18n.setLocale('pt-PT');
  play = jest.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  pause = jest.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  jest.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  URL.createObjectURL = jest.fn(() => 'blob:audio');
  URL.revokeObjectURL = jest.fn();
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ voices: [{ id: 'pt_PT-tugao', name: 'Tugão', lang: 'pt-PT' }, { id: 'af_heart', name: 'Heart', lang: 'en-US' }, { id: 'pf_dora', name: 'Dora', lang: 'pt-BR' }] }) });
});
afterEach(() => { jest.restoreAllMocks(); delete global.fetch; });

test('offers only PT-PT and US English, reads latest edits and pauses without restarting', async () => {
  const view = render(<NeuralReadAloud title="Title" content="<p>Draft</p>" />);
  await waitFor(() => expect(screen.getByText('Ouvir artigo')).toBeEnabled());
  expect(screen.queryByText('Dora')).not.toBeInTheDocument();
  view.rerender(<NeuralReadAloud title="New title" content="<p>Edited article</p>" />);
  fetch.mockResolvedValue({ ok: true, blob: async () => new Blob(['wav']) });
  fireEvent.click(screen.getByText('Ouvir artigo'));
  await waitFor(() => expect(screen.getByText('Pausar')).toBeEnabled());
  const payload = JSON.parse(fetch.mock.calls[1][1].body);
  expect(payload).toEqual({ text: 'New title\nEdited article', voice: 'pt_PT-tugao', rate: 1 });
  fireEvent.click(screen.getByText('Pausar'));
  fireEvent.click(screen.getByText('Retomar'));
  await waitFor(() => expect(play).toHaveBeenCalledTimes(2));
  expect(fetch).toHaveBeenCalledTimes(2);
  view.unmount();
  expect(pause).toHaveBeenCalled();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:audio');
});

test('ignores generation completing after Stop', async () => {
  render(<NeuralReadAloud title="Title" content="Text" />);
  await waitFor(() => expect(screen.getByText('Ouvir artigo')).toBeEnabled());
  let resolve;
  fetch.mockReturnValue(new Promise(done => { resolve = done; }));
  fireEvent.click(screen.getByText('Ouvir artigo'));
  const signal = fetch.mock.calls[1][1].signal;
  fireEvent.click(screen.getByText('Parar'));
  expect(signal.aborted).toBe(true);
  await act(async () => resolve({ ok: true, blob: async () => new Blob(['wav']) }));
  expect(play).not.toHaveBeenCalled();
  expect(URL.createObjectURL).not.toHaveBeenCalled();
});

test('prefetches next passage and continues automatically', async () => {
  const view = render(<NeuralReadAloud title="Title" content={'Sentence with words. '.repeat(45)} />);
  await waitFor(() => expect(screen.getByText('Ouvir artigo')).toBeEnabled());
  fetch.mockResolvedValue({ ok: true, blob: async () => new Blob(['wav']) });
  fireEvent.click(screen.getByText('Ouvir artigo'));
  await waitFor(() => expect(play).toHaveBeenCalledTimes(1));
  expect(fetch).toHaveBeenCalledTimes(3); // status, current, next
  await act(async () => { view.container.querySelector('audio').onended(); });
  await waitFor(() => expect(play).toHaveBeenCalledTimes(2));
  expect(fetch).toHaveBeenCalledTimes(3);
});

test('adjusts volume during playback without regenerating audio and restores the preference', async () => {
  const view = render(<NeuralReadAloud title="Title" content="Text" />);
  await waitFor(() => expect(screen.getByText('Ouvir artigo')).toBeEnabled());
  fetch.mockResolvedValue({ ok: true, blob: async () => new Blob(['wav']) });
  fireEvent.click(screen.getByText('Ouvir artigo'));
  await waitFor(() => expect(play).toHaveBeenCalledTimes(1));
  fireEvent.change(screen.getByRole('slider', { name: /Volume/ }), { target: { value: '35' } });
  expect(view.container.querySelector('audio').volume).toBe(.35);
  expect(localStorage.getItem('blogartifex_speech_volume')).toBe('0.35');
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(play).toHaveBeenCalledTimes(1);
  fireEvent.change(screen.getByRole('slider'), { target: { value: '0' } });
  expect(view.container.querySelector('audio').volume).toBe(0);
  view.unmount();
  const restored = render(<NeuralReadAloud title="Title" content="Text" />);
  expect(screen.getByRole('slider')).toHaveValue('0');
  expect(restored.container.querySelector('audio').volume).toBe(0);
  await act(async () => {});
});
