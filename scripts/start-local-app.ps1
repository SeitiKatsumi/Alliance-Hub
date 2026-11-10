param(
  [int]$Port = 3004,
  [string]$DirectusUrl = 'http://127.0.0.1:8055'
)

$projectRoot = Split-Path -Parent $PSScriptRoot
$dbTunnelScript = Join-Path $PSScriptRoot 'ensure-local-db-tunnel.ps1'
$directusTunnelScript = Join-Path $PSScriptRoot 'ensure-local-directus-tunnel.ps1'

# Resolve the port from the same environment that will launch the application.
$projectEnv = Join-Path $projectRoot '.env'
$dbPort = & node.exe "--env-file=$projectEnv" -e "try { const u=new URL(process.env.DATABASE_URL); console.log(['localhost','127.0.0.1'].includes(u.hostname) ? u.port || '5432' : 'remote'); } catch { process.exit(1); }"
if ($LASTEXITCODE -ne 0 -or -not $dbPort) { throw 'DATABASE_URL local inválida.' }
if ($dbPort -ne 'remote') {
  & $dbTunnelScript -LocalPort ([int]$dbPort)
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

$appProcess = Start-Process -FilePath 'node.exe' `
  -ArgumentList @('--env-file=.env', '--import', 'tsx', 'scripts/start-local-app.ts') `
  -WorkingDirectory $projectRoot `
  -RedirectStandardOutput $stdoutLog `
  -RedirectStandardError $stderrLog `
  -WindowStyle Hidden -PassThru

$deadline = [DateTime]::UtcNow.AddSeconds(90)
while ([DateTime]::UtcNow -lt $deadline -and -not $appProcess.HasExited) {
  Start-Sleep -Milliseconds 500
  if (Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue) {
    return
  }
}

throw "A aplicação ainda não está disponível na porta $Port. Consulte $stderrLog."
