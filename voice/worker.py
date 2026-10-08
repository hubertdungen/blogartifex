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
VOICES = {'pt_PT-tugao': 'pt-pt', 'af_heart': 'en-us'}
kokoro = None
piper = None

def synthesize(payload):
    global kokoro, piper
    voice = payload['voice']
    text = payload['text']
    rate = float(payload.get('rate', 1))
    if voice not in VOICES or not isinstance(text, str) or not 0 < len(text) <= 1800 or not 0.5 <= rate <= 2:
        raise ValueError('Invalid synthesis request')
    output = io.BytesIO()
    if voice == 'pt_PT-tugao':
        from piper import PiperVoice, SynthesisConfig
        if piper is None:
            piper = PiperVoice.load(str(MODELS / 'pt_PT-tugao-medium.onnx'))
        with wave.open(output, 'wb') as wav:
            piper.synthesize_wav(text, wav, syn_config=SynthesisConfig(length_scale=1 / rate))
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
