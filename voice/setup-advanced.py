"""Optional extra local neural voices. Run baseline setup.py first."""
import json, subprocess, sys, wave, time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
PYTHON=ROOT/'.voice-venv'/('Scripts/python.exe' if sys.platform=='win32' else 'bin/python')
if Path(sys.executable).resolve()!=PYTHON.resolve():
 if not PYTHON.exists(): subprocess.run([sys.executable,str(ROOT/'voice/setup.py')],check=True)
 subprocess.run([str(PYTHON),str(Path(__file__).resolve())],check=True);sys.exit()
subprocess.run([sys.executable,'-m','pip','install','--no-cache-dir','torch==2.8.0','torchaudio==2.8.0','--index-url','https://download.pytorch.org/whl/cpu'],check=True)
subprocess.run([sys.executable,'-m','pip','install','--no-cache-dir','tts_eu_pt==0.1.1','sopro==2.2.0'],check=True)
# ONNX Kitten needs no Kitten TTS 2 / diffusion dependencies.
subprocess.run([sys.executable,'-m','pip','install','--no-cache-dir','--no-deps','kittenml==0.9.4'],check=True)
from huggingface_hub import hf_hub_download
models=ROOT/'voice/models'
repos=[('logus2k/kokoro_tts_eu_pt',['tuga_kokoro.pth','tuga_voicepack.pt'],'kokoro-eu-pt'),('KittenML/kitten-tts-nano-0.8-int8',['config.json','kitten_tts_nano_v0_8.onnx','voices.npz'],'kitten'),('samuel-vitorino/sopro-v2-turbo',['config.json','model.safetensors','semantic_encoder.safetensors','speaker_encoder.safetensors','tokenizer.model','vocoder.safetensors'],'sopro')]
for repo,names,folder in repos:
 for name in names: print('Downloading',repo,name,flush=True);hf_hub_download(repo,name,local_dir=models/folder)
import worker
for voice,text,filename in [('pt_PT-tugao','A leitura abre portas para novas ideias. Hoje vamos ouvir um livro em português de Portugal, com calma e clareza.','reference-pt.wav'),('af_heart','Reading opens the door to new ideas. Today we will listen to a book in American English, with a clear and natural voice.','reference-en.wav')]:
 (models/'sopro'/filename).write_bytes(worker.synthesize({'text':text,'voice':voice,'rate':1}))
for folder,voices in [('kokoro-eu-pt',['kokoro_eu_pt']),('kitten',['kitten_Bella']),('sopro',['sopro_pt_PT','sopro_en_US'])]:
 for voice in voices:
  data=worker.synthesize({'text':'Uma leitura em português de Portugal.' if voice.endswith('pt') or voice.endswith('PT') else 'A clear voice for reading in American English.','voice':voice,'rate':1})
  if not data.startswith(b'RIFF'): raise RuntimeError('Voice validation failed: '+voice)
 (models/folder/'ready.json').write_text(json.dumps({'tested':True}))
print('Additional voices installed. Restart BlogArtifex.',flush=True)
