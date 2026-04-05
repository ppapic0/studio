param(
  [string]$TargetRoot = "$env:LOCALAPPDATA\CodexBuilds\Playground-build-check"
)

$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $PSCommandPath
$sourceRoot = Split-Path -Parent $scriptRoot
$sourceNodeModules = Join-Path $sourceRoot 'node_modules'
$targetNodeModules = Join-Path $TargetRoot 'node_modules'
$buildLog = Join-Path $TargetRoot 'build-safe.log'

if (-not (Test-Path -LiteralPath $sourceNodeModules)) {
  throw "Source node_modules not found at $sourceNodeModules"
}

$excludedDirs = @(
  '.git',
  'node_modules',
  '.next',
  'test-results',
  'tmp_notion_demo_raw'
)

$excludedFiles = @(
  '.codex-dev.err.log',
  '.codex-dev.out.log',
  'build-run.log',
  'build-run-temp.log',
  'tmp_clipboard_image.png'
)

New-Item -ItemType Directory -Force -Path $TargetRoot | Out-Null

Write-Host "[build:safe] Syncing source into $TargetRoot"
& robocopy $sourceRoot $TargetRoot /MIR /XD @excludedDirs /XF @excludedFiles /NFL /NDL /NJH /NJS /NP | Out-Host

if ($LASTEXITCODE -gt 7) {
  throw "robocopy failed with exit code $LASTEXITCODE"
}

if (Test-Path -LiteralPath (Join-Path $TargetRoot '.next')) {
  Remove-Item -LiteralPath (Join-Path $TargetRoot '.next') -Recurse -Force
}

if (Test-Path -LiteralPath $targetNodeModules) {
  Remove-Item -LiteralPath $targetNodeModules -Recurse -Force
}

New-Item -ItemType Junction -Path $targetNodeModules -Target $sourceNodeModules | Out-Null

Set-Location $TargetRoot
$env:CI = '1'
$env:NEXT_TELEMETRY_DISABLED = '1'

Write-Host "[build:safe] Running production build in $TargetRoot"
& "$env:ProgramFiles\nodejs\npm.cmd" run build 2>&1 | Tee-Object -FilePath $buildLog
$buildExitCode = $LASTEXITCODE

if ($buildExitCode -ne 0) {
  Write-Host "[build:safe] Build failed. See $buildLog"
  exit $buildExitCode
}

Write-Host "[build:safe] Build succeeded. Log: $buildLog"
