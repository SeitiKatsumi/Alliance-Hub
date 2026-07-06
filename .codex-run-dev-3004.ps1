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
npx.cmd tsx server/index.ts
