param(
  [int]$Port = 3004,
  [string]$DirectusUrl = 'http://127.0.0.1:8055'
)

$projectRoot = Split-Path -Parent $PSScriptRoot
$dbTunnelScript = Join-Path $PSScriptRoot 'ensure-local-db-tunnel.ps1'
$directusTunnelScript = Join-Path $PSScriptRoot 'ensure-local-directus-tunnel.ps1'

if (-not (Get-NetTCPConnection -State Listen -LocalPort 5433 -ErrorAction SilentlyContinue)) {
  & $dbTunnelScript
}

if (-not (Get-NetTCPConnection -State Listen -LocalPort 8055 -ErrorAction SilentlyContinue)) {
  & $directusTunnelScript
}

if (Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue) {
  return
}

$env:PORT = [string]$Port
$env:DIRECTUS_URL = $DirectusUrl
$env:NODE_ENV = 'development'

$stdoutLog = Join-Path $projectRoot "app-server-$Port-live.out.log"
$stderrLog = Join-Path $projectRoot "app-server-$Port-live.err.log"

Start-Process -FilePath 'node.exe' `
  -ArgumentList @('--env-file=.env', '--import', 'tsx', 'server/index.ts') `
  -WorkingDirectory $projectRoot `
  -RedirectStandardOutput $stdoutLog `
  -RedirectStandardError $stderrLog `
  -WindowStyle Hidden | Out-Null

for ($attempt = 0; $attempt -lt 30; $attempt++) {
  Start-Sleep -Milliseconds 500
  if (Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue) {
    return
  }
}

if (Test-Path -LiteralPath $stderrLog) {
  Get-Content -LiteralPath $stderrLog -Tail 30 | Write-Error
}

throw "Nao foi possivel iniciar a aplicacao local na porta $Port."
