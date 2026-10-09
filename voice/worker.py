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
        if len(parts) == 3 and parts[2].lower() == 'wav' and parts[1] in ('pt', 'en') and 'sopro_ref_' + parts[0] == voice: return f, parts[1]
    return None
kokoro = None
piper = {}
advanced = {}
active_advanced = None

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
        if voice not in piper:
            piper[voice] = PiperVoice.load(str(MODELS / PIPER[voice]))
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
