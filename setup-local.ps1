$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if (-not (Test-Path -LiteralPath '.venv\Scripts\python.exe')) {
    python -m venv .venv
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear el entorno Python.' }
}
& '.\.venv\Scripts\python.exe' -m pip install torch==2.14.1+cpu torchvision==0.29.1+cpu --index-url https://download.pytorch.org/whl/cpu
if ($LASTEXITCODE -ne 0) { throw 'No se pudo instalar PyTorch CPU.' }
& '.\.venv\Scripts\python.exe' -m pip install -r backend/requirements-local.txt
if ($LASTEXITCODE -ne 0) { throw 'No se pudieron instalar las bibliotecas.' }
New-Item -ItemType Directory -Path 'models\runtime\Ultralytics' -Force | Out-Null
$modelManifest = Get-Content -LiteralPath 'backend\model-manifest.json' -Raw | ConvertFrom-Json
foreach ($modelEntry in $modelManifest.models) {
    $modelTarget = Join-Path $PSScriptRoot $modelEntry.path
    if (-not (Test-Path -LiteralPath $modelTarget)) {
        Invoke-WebRequest -Uri $modelEntry.downloadUrl -OutFile $modelTarget
    }
    $modelHash = (Get-FileHash -LiteralPath $modelTarget -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($modelHash -ne $modelEntry.sha256) {
        throw "El archivo $($modelEntry.path) no coincide con los pesos evaluados. Se conserva para revisión; no se ejecutará."
    }
}
Write-Output 'Preparado. Ejecuta start-local.cmd y abre http://127.0.0.1:4173.'
