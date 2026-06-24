<#
.SYNOPSIS
    One-shot local dev launcher for mygarmindash.

    Fires up the full offline stack against your local garmin.db:
      1. turso dev   — libSQL HTTP gateway   -> http://127.0.0.1:8080
      2. wrangler dev — Worker (API)         -> http://127.0.0.1:8787
      3. vite        — PWA (proxies /api)    -> http://127.0.0.1:5173

    Each runs in its own window so you can watch (and Ctrl+C) logs
    independently. See README.md "Local development".
    
    If a turso run dies uncleanly, a stray `turso dev` can hog port 8080 
    Clear it with `wsl -d Ubuntu -- pkill -f 'turso dev'`

.EXAMPLE
    .\dev.ps1
    # uses the default db at ../garmin-givemydata/garmin.db

.EXAMPLE
    .\dev.ps1 -DbFile "C:\path\to\some.db"
#>
param(
    [string]$DbFile = "$PSScriptRoot\..\garmin-givemydata\garmin.db"
)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

# --- Sanity: db file exists -------------------------------------------------
$DbFile = [System.IO.Path]::GetFullPath($DbFile)
if (-not (Test-Path $DbFile)) {
    Write-Error "garmin.db not found at: $DbFile`nPass -DbFile <path> to override."
    exit 1
}

# --- Locate the turso CLI ---------------------------------------------------
# turso has no native Windows build; on Windows it lives inside WSL. Prefer a
# native binary if one is ever on PATH, otherwise drive it through WSL Ubuntu.
$tursoDistro = "Ubuntu"
if (Get-Command turso -ErrorAction SilentlyContinue) {
    $tursoCmd = "turso dev --db-file '$DbFile'"
}
elseif (Get-Command wsl -ErrorAction SilentlyContinue) {
    $wslHasTurso = wsl -d $tursoDistro -- bash -lic "command -v turso" 2>$null
    if (-not $wslHasTurso) {
        Write-Error "turso CLI not found in WSL ($tursoDistro). Install it inside WSL: https://docs.turso.tech/cli/installation"
        exit 1
    }
    # Translate the Windows db path to a /mnt/... path WSL can open.
    $wslDb = (wsl -d $tursoDistro wslpath -a ($DbFile -replace '\\', '/')).Trim()
    # WSL2 forwards localhost, so Windows reaches the gateway at 127.0.0.1:8080.
    $tursoCmd = "wsl -d $tursoDistro -- bash -lic 'turso dev --db-file `"$wslDb`"'"
}
else {
    Write-Error "Neither a native turso CLI nor WSL was found. Install turso: https://docs.turso.tech/cli/installation"
    exit 1
}

# --- Ensure worker/.dev.vars exists (git-ignored, points at turso dev) ------
$devVars = Join-Path $root "worker\.dev.vars"
if (-not (Test-Path $devVars)) {
    Write-Host "Creating worker\.dev.vars (dev defaults; APP_TOKEN=devtoken)..." -ForegroundColor Yellow
    @"
TURSO_URL=http://127.0.0.1:8080
TURSO_AUTH_TOKEN=
APP_TOKEN=devtoken
"@ | Out-File -FilePath $devVars -Encoding utf8
}

# --- Ensure deps installed (idempotent) -------------------------------------
foreach ($dir in @("worker", "pwa")) {
    $path = Join-Path $root $dir
    if (-not (Test-Path (Join-Path $path "node_modules"))) {
        Write-Host "Installing $dir dependencies..." -ForegroundColor Yellow
        Push-Location $path
        npm install
        Pop-Location
    }
}

# --- Clear any stale `turso dev` before launching a fresh one ---------------
# A turso dev left from a previous run keeps port 8080 but, once its /mnt/c
# DrvFs handle goes stale (e.g. after the laptop sleeps), answers every query
# with "unable to open database file". A fresh process reopens the file fine,
# so kill the old one first instead of letting it shadow the new gateway.
if (Get-Command wsl -ErrorAction SilentlyContinue) {
    wsl -d $tursoDistro -- bash -lic "pkill -f 'turso dev'" 2>$null
}

# --- Launch the three services ----------------------------------------------
Write-Host "Starting local dev stack..." -ForegroundColor Cyan
Write-Host "  turso dev  -> http://127.0.0.1:8080  (db: $DbFile)"
Write-Host "  worker     -> http://127.0.0.1:8787"
Write-Host "  pwa        -> http://127.0.0.1:5173"
Write-Host ""

if (Get-Command wt -ErrorAction SilentlyContinue) {
    # One Windows Terminal window, three tabs. wt uses a bare `;` to separate
    # tabs, so it must be its own unquoted argument (PowerShell leaves a
    # quote-free token alone). Each tab runs `powershell -NoExit -Command <cmd>`
    # in the right directory via wt's own `-d`.
    $tabSep = ";"
    $wtArgs = @(
        "new-tab", "--title", "turso-dev",  "-d", $root,           "powershell", "-NoExit", "-Command", $tursoCmd, $tabSep,
        "new-tab", "--title", "worker-dev", "-d", "$root\worker",  "powershell", "-NoExit", "-Command", "npx wrangler dev", $tabSep,
        "new-tab", "--title", "pwa-dev",    "-d", "$root\pwa",     "powershell", "-NoExit", "-Command", "npm run dev"
    )
    & wt @wtArgs
    Write-Host "Started in one Windows Terminal window with 3 tabs (turso-dev, worker-dev, pwa-dev)." -ForegroundColor Green
}
else {
    # Fallback: Windows Terminal not installed — one window per service.
    function Start-DevWindow($title, $workingDir, $command) {
        Start-Process powershell -ArgumentList @(
            "-NoExit", "-Command",
            "`$host.UI.RawUI.WindowTitle = '$title'; Set-Location '$workingDir'; $command"
        )
    }
    Start-DevWindow "turso-dev"  $root          $tursoCmd
    Start-DevWindow "worker-dev" "$root\worker" "npx wrangler dev"
    Start-DevWindow "pwa-dev"    "$root\pwa"    "npm run dev"
    Write-Host "Windows Terminal not found; started each service in its own window." -ForegroundColor Green
}

Write-Host "Open http://127.0.0.1:5173 -> Settings -> paste APP_TOKEN 'devtoken'."
Write-Host "Close a tab/window (or Ctrl+C in it) to stop that service."
