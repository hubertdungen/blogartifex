"""One-time local installation. No API keys, accounts or paid service."""
import os
from pathlib import Path
import subprocess
import sys
import urllib.request
import venv

ROOT = Path(__file__).resolve().parent.parent
ENV = ROOT / '.voice-venv'
MODELS = ROOT / 'voice' / 'models'
PYTHON = ENV / ('Scripts/python.exe' if os.name == 'nt' else 'bin/python')

def download(url, destination):
    if destination.exists():
        return
    print('Downloading', destination.name, flush=True)
    temporary = destination.with_suffix(destination.suffix + '.part')
    with urllib.request.urlopen(url, timeout=120) as response, temporary.open('wb') as output:
        while chunk := response.read(1024 * 1024):
            output.write(chunk)
    temporary.replace(destination)

if not PYTHON.exists():
    venv.EnvBuilder(with_pip=False, symlinks=os.name != 'nt').create(ENV)
if subprocess.run([str(PYTHON), '-m', 'pip', '--version'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode:
    bootstrap = ENV / 'get-pip.py'
    download('https://bootstrap.pypa.io/get-pip.py', bootstrap)
    subprocess.run([str(PYTHON), str(bootstrap)], check=True)
subprocess.run([str(PYTHON), '-m', 'pip', 'install', '-r', str(ROOT / 'voice/requirements.txt')], check=True)
MODELS.mkdir(parents=True, exist_ok=True)
release = 'https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/'
for filename in ['kokoro-v1.0.int8.onnx', 'voices-v1.0.bin']:
    download(release + filename, MODELS / filename)
piper = 'https://huggingface.co/rhasspy/piper-voices/resolve/main/pt/pt_PT/tug%C3%A3o/medium/'
for suffix in ['.onnx', '.onnx.json']:
    download(piper + 'pt_PT-tug%C3%A3o-medium' + suffix, MODELS / ('pt_PT-tugao-medium' + suffix))
print('Neural voices installed. Start/restart BlogArtifex with npm run serve.', flush=True)
