param(
    [string]$PythonPath = "c:\Users\choun\miniconda3\envs\env\python.exe"
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$requirements = Join-Path $root "backend\requirements.txt"
$wheelDir = Join-Path $root "backend\wheels"

if (-not (Test-Path -LiteralPath $PythonPath)) {
    throw "Python introuvable: $PythonPath"
}

New-Item -ItemType Directory -Force -Path $wheelDir | Out-Null

& $PythonPath -m pip download `
    --requirement $requirements `
    --dest $wheelDir `
    --only-binary=:all: `
    --platform manylinux_2_17_x86_64 `
    --implementation cp `
    --python-version 3.12 `
    --abi cp312

if ($LASTEXITCODE -ne 0) {
    throw "Le telechargement des wheels Linux a echoue."
}

$wheels = Get-ChildItem -LiteralPath $wheelDir -Filter *.whl
if (-not $wheels) {
    throw "Aucun wheel n'a ete telecharge."
}

Write-Host "Wheels Linux prepares: $($wheels.Count)"
Write-Host "Docker peut maintenant construire l'API sans acces a PyPI."
