Set-Location 'C:\Users\ESPC\Documents\New project 2'
if (Test-Path .env) {
  Get-Content .env | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
      $name = $matches[1].Trim()
      $value = $matches[2].Trim().Trim('"')
      [Environment]::SetEnvironmentVariable($name, $value, 'Process')
    }
  }
}
$env:NODE_ENV='development'
$env:PORT='3004'
. "$PSScriptRoot\scripts\ensure-local-db-tunnel.ps1"
& .\node_modules\.bin\tsx.cmd server/index.ts *> dev-server-3004.log
