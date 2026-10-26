"""Download the project's pinned public checkpoints and verify before execution."""
import hashlib
import json
from pathlib import Path
from urllib.request import urlopen
ROOT = Path(__file__).resolve().parents[1]
def sha(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''): h.update(chunk)
    return h.hexdigest()
if __name__ == '__main__':
    for model in json.loads((ROOT / 'backend/model-manifest.json').read_text())['models']:
        target = ROOT / model['path']
        target.parent.mkdir(parents=True, exist_ok=True)
        if target.exists():
            if sha(target) != model['sha256']: raise SystemExit(f'Los pesos existentes no coinciden: {target}. Se conservan para revisión.')
            print(f'Verificado: {target.name}', flush=True)
            continue
        pending = target.with_suffix(target.suffix + '.part')
        with urlopen(model['downloadUrl'], timeout=180) as response, pending.open('wb') as f:
            for chunk in iter(lambda: response.read(1024 * 1024), b''): f.write(chunk)
        if sha(pending) != model['sha256']: raise SystemExit(f'Descarga no válida: {pending}. No se ejecutará.')
        pending.replace(target)
        print(f'Descargado y verificado: {target.name}', flush=True)
