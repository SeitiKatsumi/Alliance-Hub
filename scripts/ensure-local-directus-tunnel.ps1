param(
  [string]$LocalHost = '127.0.0.1',
  [int]$LocalPort = 8055,
  [string]$RemoteHost = '5.161.102.133',
  [int]$RemotePort = 18055,
  [string]$IdentityFile = "$HOME\.ssh\built_alliances_tunnel"
)

function Test-LocalPort {
  param([string]$HostName, [int]$Port)

  $client = [System.Net.Sockets.TcpClient]::new()
  try {
    $task = $client.ConnectAsync($HostName, $Port)
    return $task.Wait(1000) -and $client.Connected
  } catch {
    return $false
  } finally {
    $client.Dispose()
  }
}

if (Test-LocalPort -HostName $LocalHost -Port $LocalPort) {
  return
}

if (-not (Test-Path -LiteralPath $IdentityFile)) {
  throw "Chave SSH do Directus nao encontrada em $IdentityFile."
}

$logDirectory = Split-Path -Parent $PSScriptRoot
$stdoutLog = Join-Path $logDirectory 'directus-tunnel-8055.out.log'
$stderrLog = Join-Path $logDirectory 'directus-tunnel-8055.err.log'
$forward = "${LocalHost}:${LocalPort}:127.0.0.1:${RemotePort}"
$arguments = @(
  '-i', $IdentityFile,
  '-o', 'BatchMode=yes',
  '-o', 'ExitOnForwardFailure=yes',
  '-o', 'ServerAliveInterval=30',
  '-N',
  '-L', $forward,
  "root@$RemoteHost"
)

Start-Process -FilePath 'ssh.exe' -ArgumentList $arguments `
  -RedirectStandardOutput $stdoutLog `
  -RedirectStandardError $stderrLog `
  -WindowStyle Hidden | Out-Null

for ($attempt = 0; $attempt -lt 10; $attempt++) {
  Start-Sleep -Milliseconds 500
  if (Test-LocalPort -HostName $LocalHost -Port $LocalPort) {
    return
  }
}

throw "Nao foi possivel abrir o tunel local do Directus na porta $LocalPort."
