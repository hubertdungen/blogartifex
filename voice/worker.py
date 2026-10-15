"""Private stdin/stdout worker. Models stay in memory between passages."""
import base64
import io
import json
import os
from pathlib import Path
import sys
import wave

os.environ.setdefault('OMP_NUM_THREADS', '2')
os.environ.setdefault('OPENBLAS_NUM_THREADS', '2')
MODELS = Path(__file__).resolve().parent / 'models'
PIPER = {'pt_PT-tugao': 'pt_PT-tugao-medium.onnx', 'pt_PT-voice3': 'pt_PT-voice3.onnx', 'pt_PT-voice4': 'pt_PT-voice4.onnx'}  # Piper/VITS models (espeak pt-PT phonemes)
VOICES = {**{v: 'pt-pt' for v in PIPER}, **{v: 'en-us' for v in ['af_heart','af_bella','af_nicole','af_sarah','am_michael','am_fenrir']}, 'kokoro_eu_pt': 'pt-pt', 'phoonnx_miro': 'pt-pt', 'phoonnx_dii': 'pt-pt', 'sopro_pt_PT': 'pt-pt', 'sopro_en_US': 'en-us', **{'kitten_'+v: 'en-us' for v in ['Bella','Jasper','Luna','Bruno','Rosie','Hugo','Kiki','Leo']}}
# Own Sopro voices: drop a clean WAV of the speaker in models/sopro/ref as <Nome>.pt.wav (or .en.wav); it appears as sopro_ref_<Nome>.
REF_DIR = MODELS / 'sopro' / 'ref'
def sopro_ref(voice):
    if not voice.startswith('sopro_ref_') or not REF_DIR.is_dir(): return None
    for f in REF_DIR.iterdir():
        parts = f.name.split('.')
        if len(parts) == 3 and parts[2].lower() in ('wav', 'mp3', 'flac', 'ogg') and parts[1] in ('pt', 'en') and 'sopro_ref_' + parts[0] == voice:
            if parts[2].lower() != 'wav':  # decode once to WAV (libsndfile reads mp3/flac/ogg); Sopro gets the cached copy
                import soundfile as sf
                cache = REF_DIR / '.cache'; cache.mkdir(exist_ok=True); out = cache / (parts[0] + '.' + parts[1] + '.wav')
                if not out.exists() or out.stat().st_mtime < f.stat().st_mtime:
                    data, sr = sf.read(str(f), dtype='float32')
                    if getattr(data, 'ndim', 1) > 1: data = data.mean(axis=1)
                    sf.write(str(out), data, sr, subtype='PCM_16')
                return out, parts[1]
            return f, parts[1]
    return None
kokoro = None
piper = {}
advanced = {}
active_advanced = None

HOP = 256  # VITS: one duration unit = 256 samples
SENTENCE_END = __import__('re').compile(r'[.!?…]+[»”"\')\]]*$')
def piper_timed(voice, text, rate):
    """Piper synthesis plus the real start/end of every word, from the model's own phoneme durations.
    The timings travel inside the WAV as a 'lect' RIFF chunk: [[char offset in text, start s, end s], ...]."""
    import re
    import numpy as np
    from piper.const import BOS, EOS, PAD
    cfg, idmap = voice.config, voice.config.phoneme_id_map
    sr = cfg.sample_rate
    tokens = [(m.start(), m.group()) for m in re.finditer(r'\S+', text)]
    # Text sentences the way espeak splits them: a token ending in . ! ? … (closing quotes allowed).
    text_sentences, current = [], []
    for t in tokens:
        current.append(t)
        if SENTENCE_END.search(t[1]): text_sentences.append(current); current = []
    if current: text_sentences.append(current)
    audio_parts, engine_sentences, offset = [], [], 0
    for phonemes in voice.phonemize(text):
        ids, owner = list(idmap[BOS]) + list(idmap[PAD]), [-1, -1]
        for k, ph in enumerate(phonemes):
            if ph not in idmap: continue
            ids += list(idmap[ph]) + list(idmap[PAD]); owner += [k] * (len(idmap[ph]) + 1)
        ids += list(idmap[EOS]); owner.append(-1)
        scales = np.array([cfg.noise_scale, cfg.length_scale / rate, cfg.noise_w_scale], dtype=np.float32)
        args = {'input': np.array([ids], dtype=np.int64), 'input_lengths': np.array([len(ids)], dtype=np.int64), 'scales': scales}
        if cfg.num_speakers > 1: args['sid'] = np.array([0], dtype=np.int64)
        audio, dur = voice.session.run(None, args)
        audio, dur = audio.reshape(-1), dur.reshape(-1)
        peak = float(np.max(np.abs(audio))) if audio.size else 0
        audio_parts.append(audio / peak if peak > 1e-8 else audio)
        # Engine words: phonemes between spaces; a word ends where its punctuation (the pause) begins.
        words, t, word = [], offset, None
        for pos, d in enumerate(dur.astype(int).tolist()):
            k = owner[pos]; ph = phonemes[k] if k >= 0 else None
            if ph is not None and ph != ' ' and ph not in ',.;:!?…' and word is None: word = [t, t, 0]
            if ph == ' ' or (ph is not None and ph in ',.;:!?…'):
                if word: words.append(word); word = None
            elif ph is not None and word is not None:
                word[1] = t + d * HOP; word[2] += 1
            t += d * HOP
        if word: words.append(word)
        engine_sentences.append(words)
        offset += audio.shape[0]
    pairs = text_sentences if len(text_sentences) == len(engine_sentences) else [tokens]
    engines = engine_sentences if len(text_sentences) == len(engine_sentences) else [sum(engine_sentences, [])]
    timings = []
    for toks, words in zip(pairs, engines):
        spoken = [t for t in toks if re.search(r'\w', t[1])]
        if not spoken or not words: continue
        if len(spoken) == len(words):
            timings += [[t[0], w[0] / sr, w[1] / sr] for t, w in zip(spoken, words)]; continue
        # Different word counts (numbers read out, abbreviations): place each text word by its share of the
        # sentence, snapped to the nearest engine word start that keeps the order.
        tw = [max(1, len(re.sub(r'\W', '', t[1])) * (4 if t[1][:1].isdigit() else 1)) for t in spoken]
        span0, span1, total, acc, last, starts = words[0][0], words[-1][1], sum(tw), 0, -1, []
        for x in tw:
            guess = span0 + (span1 - span0) * acc / total; acc += x
            options = [w[0] for w in words if w[0] > last]
            near = min(options, key=lambda v: abs(v - guess)) if options else guess
            starts.append(near if abs(near - guess) < (span1 - span0) / max(1, len(tw)) else max(guess, last + 1))
            last = starts[-1]
        for i, t in enumerate(spoken):
            end = starts[i + 1] if i + 1 < len(spoken) else span1
            timings.append([t[0], starts[i] / sr, max(starts[i], end) / sr])
    samples = np.clip(np.concatenate(audio_parts) * 32767, -32767, 32767).astype('<i2') if audio_parts else np.zeros(0, '<i2')
    out = io.BytesIO()
    with wave.open(out, 'wb') as wav:
        wav.setnchannels(1); wav.setsampwidth(2); wav.setframerate(sr); wav.writeframes(samples.tobytes())
    return with_timings(out.getvalue(), timings)

def with_timings(data, timings):
    import struct
    body = json.dumps({'v': 1, 'words': [[o, round(a, 3), round(b, 3)] for o, a, b in timings]}, separators=(',', ':')).encode()
    if len(body) % 2: body += b' '
    data = data + b'lect' + struct.pack('<I', len(body)) + body
    return data[:4] + struct.pack('<I', len(data) - 8) + data[8:]

def synthesize(payload):
    global kokoro, piper, active_advanced
    voice = payload['voice']
    text = payload['text']
    rate = float(payload.get('rate', 1))
    ref = sopro_ref(voice)
    if (voice not in VOICES and not ref) or not isinstance(text, str) or not 0 < len(text) <= 1800 or not 0.5 <= rate <= 2:
        raise ValueError('Invalid synthesis request')
    output = io.BytesIO()
    if voice in PIPER:
        from piper import PiperVoice, SynthesisConfig
        timed = MODELS / PIPER[voice].replace('.onnx', '.timed.onnx')
        if voice not in piper:
            # The ".timed" copy also outputs the duration of every phoneme (same weights, one extra graph output).
            piper[voice] = PiperVoice.load(str(timed), config_path=str(MODELS / (PIPER[voice] + '.json'))) if timed.exists() else PiperVoice.load(str(MODELS / PIPER[voice]))
        if len(piper[voice].session.get_outputs()) > 1:
            return piper_timed(piper[voice], text, rate)
        with wave.open(output, 'wb') as wav:
            piper[voice].synthesize_wav(text, wav, syn_config=SynthesisConfig(length_scale=1 / rate))
    elif voice == 'kokoro_eu_pt' or voice.startswith(('sopro_', 'kitten_', 'phoonnx_')):
        import soundfile as sf
        family = ('phoonnx-' + voice.removeprefix('phoonnx_')) if voice.startswith('phoonnx_') else 'sopro' if voice.startswith('sopro_') else 'kitten' if voice.startswith('kitten_') else 'kokoro-eu-pt'
        # Keep at most one extra model resident on small CPU servers.
        if active_advanced != family:
            advanced.clear()
            import gc
            gc.collect()
            active_advanced = family
        if family.startswith('phoonnx-'):
            from phoonnx.voice import TTSVoice
            from phoonnx.config import SynthesisConfig
            name = voice.removeprefix('phoonnx_')
            if family not in advanced:
                advanced[family] = TTSVoice.load(str(MODELS / family / (name + '_pt-PT.onnx')), str(MODELS / family / (name + '_pt-PT.json')))
            with wave.open(output, 'wb') as wav:
                advanced[family].synthesize_wav(text, wav, syn_config=SynthesisConfig(length_scale=1 / rate))
            return output.getvalue()
        if family == 'kokoro-eu-pt':
            import torch
            torch.set_num_threads(2)
            from loguru import logger
            logger.disable('tts_eu_pt')
            from tts_eu_pt import TTS
            if family not in advanced:
                advanced[family] = TTS(device='cpu', model_path=str(MODELS / family / 'tuga_kokoro.pth'), voicepack_path=str(MODELS / family / 'tuga_voicepack.pt'))
            samples = advanced[family].say(text, speed=rate)
        elif family == 'kitten':
            from kittenml.kittentts_legacy import KittenTTSOnnx
            if family not in advanced:
                advanced[family] = KittenTTSOnnx(model_name=str(MODELS / family), backend='cpu')
                import onnxruntime as ort
                options = ort.SessionOptions()
                options.intra_op_num_threads = 2
                options.inter_op_num_threads = 1
                advanced[family].model.session = ort.InferenceSession(str(MODELS / family / 'kitten_tts_nano_v0_8.onnx'), sess_options=options, providers=['CPUExecutionProvider'])
            samples = advanced[family].generate(text, voice=voice.removeprefix('kitten_'), speed=rate)
        else:
            import torch
            torch.set_num_threads(2)
            from sopro import SoproTTS
            if family not in advanced:
                advanced[family] = SoproTTS.from_pretrained(str(MODELS / family), device='cpu', quantization='int8')
            language = ref[1] if ref else 'pt' if voice == 'sopro_pt_PT' else 'en'
            ref_key = 'ref_' + (voice if ref else language)
            if ref_key not in advanced:
                advanced[ref_key] = advanced[family].prepare_reference(ref_audio_path=str(ref[0] if ref else MODELS / family / ('reference-' + language + '.wav')))
            samples = advanced[family].synthesize(text, ref=advanced[ref_key], lang=language, steps=2).detach().cpu().numpy().reshape(-1)
            # Preserve pitch when changing Sopro's speaking speed.
            if rate != 1:
                import math
                from torchaudio.functional import phase_vocoder
                waveform = torch.from_numpy(samples.copy())
                window = torch.hann_window(1024)
                spectrum = torch.stft(waveform, n_fft=1024, hop_length=256, window=window, return_complex=True)
                phase = torch.linspace(0, math.pi * 256, spectrum.shape[-2])[..., None]
                stretched = phase_vocoder(spectrum, rate, phase)
                samples = torch.istft(stretched, n_fft=1024, hop_length=256, window=window, length=max(1, round(len(samples) / rate))).numpy()
        sf.write(output, samples, 24000, format='WAV', subtype='PCM_16')
    else:
        import onnxruntime as ort
        from kokoro_onnx import Kokoro
        import soundfile as sf
        if kokoro is None:
            options = ort.SessionOptions()
            options.intra_op_num_threads = 2
            options.inter_op_num_threads = 1
            session = ort.InferenceSession(str(MODELS / 'kokoro-v1.0.int8.onnx'), sess_options=options, providers=['CPUExecutionProvider'])
            kokoro = Kokoro.from_session(session, str(MODELS / 'voices-v1.0.bin'))
        samples, sample_rate = kokoro.create(text, voice=voice, speed=rate, lang=VOICES[voice])
        sf.write(output, samples, sample_rate, format='WAV', subtype='PCM_16')
    return output.getvalue()

if __name__ == '__main__':
    for line in sys.stdin:
        try:
            payload = json.loads(line)
            # Third-party diagnostics must not corrupt the JSON protocol.
            import contextlib
            with contextlib.redirect_stdout(sys.stderr):
                data = synthesize(payload)
            result = {'audio': base64.b64encode(data).decode('ascii')}
        except Exception as error:
            print(type(error).__name__ + ': ' + str(error), file=sys.stderr, flush=True)
            result = {'error': 'synthesis-failed'}
        print(json.dumps(result), flush=True)
