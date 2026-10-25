@echo off
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  echo Ejecuta primero setup-local.ps1 desde PowerShell.
  pause
  exit /b 1
)
set "YOLO_CONFIG_DIR=%~dp0models\runtime"
echo Abre http://127.0.0.1:4173 para usar la inferencia local.
".venv\Scripts\python.exe" backend\server.py
pause
