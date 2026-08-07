param(
    [string]$PythonPath = "c:\Users\choun\miniconda3\envs\env\python.exe"
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$requirements = Join-Path $root "ml\requirements-service.txt"
$wheelDir = Join-Path $root "ml\wheels"

if (-not (Test-Path -LiteralPath $PythonPath)) {
    throw "Python introuvable: $PythonPath"
}

New-Item -ItemType Directory -Force -Path $wheelDir | Out-Null

& $PythonPath -m pip download `
    --requirement $requirements `
    --dest $wheelDir `
    --only-binary=:all: `
    --platform manylinux_2_28_x86_64 `
    --platform manylinux_2_17_x86_64 `
    --platform manylinux2014_x86_64 `
    --implementation cp `
    --python-version 3.12 `
    --abi cp312 `
    --extra-index-url https://download.pytorch.org/whl/cpu

if ($LASTEXITCODE -ne 0) {
    throw "Le telechargement des wheels Linux du service ML a echoue."
}

$wheels = Get-ChildItem -LiteralPath $wheelDir -Filter *.whl
if (-not $wheels) {
    throw "Aucun wheel ML n'a ete telecharge."
}

Write-Host "Wheels Linux ML prepares: $($wheels.Count)"
Write-Host "Docker peut construire le service d'embedding sans acces reseau."
