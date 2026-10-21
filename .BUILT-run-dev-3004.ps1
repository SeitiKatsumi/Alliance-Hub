Get-Content .env | ForEach-Object {
  $line = $_.Trim()
  if (-not $line -or $line.StartsWith('#') -or -not $line.Contains('=')) { return }
  $parts = $line.Split('=', 2)
  $name = $parts[0].Trim()
  $value = $parts[1].Trim().Trim('"').Trim("'")
  [Environment]::SetEnvironmentVariable($name, $value, 'Process')
}
$env:NODE_ENV = 'development'
$env:PORT = '3004'
$env:ASAAS_CONTRIBUTIONS_ENABLED = 'true'
$env:ASAAS_TRANSFERS_ENABLED = 'true'
. "$PSScriptRoot\scripts\ensure-local-db-tunnel.ps1"
. "$PSScriptRoot\scripts\ensure-local-directus-tunnel.ps1"
npx.cmd tsx server/index.ts
