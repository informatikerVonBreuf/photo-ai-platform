param(
    [string]$ApiBase = ""
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$frontend = Join-Path $root "frontend"
$previousApiBase = $env:VITE_API_BASE
$previousUseMock = $env:VITE_USE_MOCK

try {
    $env:VITE_API_BASE = $ApiBase
    $env:VITE_USE_MOCK = "false"

    Push-Location $frontend
    try {
        npm.cmd ci
        if ($LASTEXITCODE -ne 0) {
            throw "npm ci a echoue."
        }
        npm.cmd run lint
        if ($LASTEXITCODE -ne 0) {
            throw "Le lint frontend a echoue."
        }
        npm.cmd run build
        if ($LASTEXITCODE -ne 0) {
            throw "Le build frontend a echoue."
        }
    }
    finally {
        Pop-Location
    }
}
finally {
    $env:VITE_API_BASE = $previousApiBase
    $env:VITE_USE_MOCK = $previousUseMock
}

$displayApiBase = if ($ApiBase) { $ApiBase } else { "<same-origin>" }
Write-Host "Frontend de production construit avec API_BASE=$displayApiBase"
