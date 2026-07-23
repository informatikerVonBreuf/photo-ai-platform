param(
    [string]$Python = "c:\Users\choun\miniconda3\envs\env\python.exe",
    [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $Python)) {
    throw "Python executable not found: $Python"
}

$env:KMP_DUPLICATE_LIB_OK = "TRUE"
$env:OMP_NUM_THREADS = "1"
$env:MKL_NUM_THREADS = "1"

Write-Host "Using Python: $Python"
& $Python --version

if (-not $SkipInstall) {
    & $Python -m pip install --upgrade pip
    & $Python -m pip install -r requirements-ml.txt
    & $Python -m pip check
}

& $Python -m ipykernel install --user --name photo-ai-platform --display-name "Python (photo-ai-platform)"

Write-Host "ML environment is ready."
Write-Host "In Jupyter, select kernel: Python (photo-ai-platform)"
