param(
    [string]$PythonPath = "c:\Users\choun\miniconda3\envs\env\python.exe",
    [ValidateSet("transformers_clip", "open_clip")]
    [string]$Runtime = "transformers_clip",
    [string]$ModelName = "wkcn/TinyCLIP-ViT-8M-16-Text-3M-YFCC15M",
    [string]$ModelPath = "models\tinyclip",
    [string]$ModelRevision = "a2a8c6eaa2549ad66eb7c31b85022bf58273a26c",
    [int]$Port = 8001
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")

if (-not (Test-Path -LiteralPath $PythonPath)) {
    throw "Python introuvable: $PythonPath"
}

$resolvedModel = Resolve-Path -LiteralPath $ModelPath
$env:EMBEDDING_RUNTIME = $Runtime
$env:EMBEDDING_MODEL_NAME = $ModelName
$env:EMBEDDING_MODEL_PATH = $resolvedModel.Path
$env:EMBEDDING_MODEL_REVISION = $ModelRevision

$env:HF_HUB_OFFLINE = "1"
$env:HF_HUB_DISABLE_TELEMETRY = "1"
$env:HF_HUB_DISABLE_IMPLICIT_TOKEN = "1"
$env:TRANSFORMERS_OFFLINE = "1"
$env:DO_NOT_TRACK = "1"

Push-Location $root
try {
    & $PythonPath -m uvicorn ml.services.embedding_service:app `
        --host 127.0.0.1 `
        --port $Port
} finally {
    Pop-Location
}
