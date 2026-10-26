#!/bin/sh
set -eu
cd "$(dirname "$0")"
task_python="${PYTHON:-}"
if [ -z "$task_python" ]; then
  for candidate in python3.12 python3.13 python3; do
    if command -v "$candidate" >/dev/null 2>&1 && "$candidate" -c 'import sys; assert (3, 10) <= sys.version_info[:2] < (3, 14)' 2>/dev/null; then task_python="$candidate"; break; fi
  done
fi
if [ -z "$task_python" ]; then
  candidate="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3"
  if [ -x "$candidate" ]; then task_python="$candidate"; else echo 'Se necesita Python 3.10–3.13. Usa PYTHON=/ruta/python3 sh setup-local.sh'; exit 1; fi
fi
if [ ! -x .venv/bin/python ]; then "$task_python" -m venv .venv; fi
.venv/bin/python -m pip install -r backend/requirements-macos.txt
.venv/bin/python backend/download_models.py
printf '\nMotor listo. Ejecuta npm start para abrir la app y el reconocimiento local.\n'
