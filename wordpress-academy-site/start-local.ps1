$ErrorActionPreference = "Stop"
$dockerBin = 'C:\Program Files\Docker\Docker\resources\bin'
$dockerDesktopExe = 'C:\Program Files\Docker\Docker\Docker Desktop.exe'

if (-not (Test-Path $dockerDesktopExe)) {
  throw "Docker Desktop not found at: $dockerDesktopExe"
}

$env:Path = "$dockerBin;$env:Path"

if (-not (Get-Process -Name 'Docker Desktop' -ErrorAction SilentlyContinue)) {
  Start-Process -FilePath $dockerDesktopExe | Out-Null
}

$ready = $false
for ($i = 0; $i -lt 60; $i++) {
  try {
    docker info *> $null
    if ($LASTEXITCODE -eq 0) {
      $ready = $true
      break
    }
  } catch {}
  Start-Sleep -Seconds 5
}

if (-not $ready) {
  throw "Docker engine is not ready. Open Docker Desktop and wait until status is Running."
}

if (-not (Test-Path '.env')) {
  Copy-Item '.env.example' '.env'
}

docker compose up -d

Write-Host ""
Write-Host "WordPress is running: http://localhost:8080"
Write-Host "Admin: http://localhost:8080/wp-admin"
