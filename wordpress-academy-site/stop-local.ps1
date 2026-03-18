$ErrorActionPreference = "Stop"
$dockerBin = 'C:\Program Files\Docker\Docker\resources\bin'
$env:Path = "$dockerBin;$env:Path"

docker compose down
Write-Host "Stopped WordPress containers."
