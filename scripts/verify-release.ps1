$ErrorActionPreference = 'Stop'
$logPath = Join-Path (Get-Location) 'release-verification.log'
$transcriptStarted = $false

function Invoke-Checked {
  param([string]$Command, [string[]]$Arguments)
  Write-Host "`n> $Command $($Arguments -join ' ')" -ForegroundColor Cyan
  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed with exit code ${LASTEXITCODE}: $Command $($Arguments -join ' ')"
  }
}

try {
  Start-Transcript -Path $logPath -Append | Out-Null
  $transcriptStarted = $true
  Write-Host 'TAINA Knowledge Map — release verification' -ForegroundColor Yellow
  $nodeText = (& node --version).Trim().TrimStart('v')
  $nodeVersion = [version]$nodeText
  Write-Host "Node: v$nodeText"
  Write-Host "npm:  $(& npm --version)"
  if ($nodeVersion -lt [version]'22.6.0') {
    throw "Node.js 22.6.0 or newer is required; detected v$nodeText. Install a current LTS release and rerun this script."
  }

  # Resolve registry tags once, and write exact versions (not the floating word "latest")
  # into package.json. The generated lockfile is then tested with a clean npm ci.
  Invoke-Checked 'npm' @('ping', '--fetch-retries=0', '--fetch-timeout=15000')
  Invoke-Checked 'npm' @(
    'install', '--save-exact', '--no-audit', '--no-fund',
    'idb@latest', 'react@latest', 'react-dom@latest'
  )
  Invoke-Checked 'npm' @(
    'install', '--save-dev', '--save-exact', '--no-audit', '--no-fund',
    '@playwright/test@latest', '@types/node@latest', '@vitejs/plugin-react@latest',
    'typescript@latest', 'vite@latest'
  )

  $manifest = Get-Content 'package.json' -Raw | ConvertFrom-Json
  $allDependencies = @{}
  if ($manifest.dependencies) { $manifest.dependencies.PSObject.Properties | ForEach-Object { $allDependencies[$_.Name] = $_.Value } }
  if ($manifest.devDependencies) { $manifest.devDependencies.PSObject.Properties | ForEach-Object { $allDependencies[$_.Name] = $_.Value } }
  $floating = @($allDependencies.GetEnumerator() | Where-Object { $_.Value -notmatch '^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$' })
  if ($floating.Count -gt 0) {
    $details = ($floating | ForEach-Object { '{0}={1}' -f $_.Key, $_.Value }) -join ', '
    throw "Non-exact dependency versions remain: $details"
  }
  if (-not (Test-Path 'package-lock.json')) {
    throw 'package-lock.json was not created.'
  }

  Invoke-Checked 'npm' @('ci', '--no-audit', '--no-fund')
  Invoke-Checked 'npx' @('playwright', 'install', 'chromium')
  Invoke-Checked 'npm' @('audit')
  Invoke-Checked 'npm' @('run', 'build')
  Invoke-Checked 'npm' @('run', 'test:unit')
  Invoke-Checked 'npm' @('test')

  Write-Host "`nPASS: exact dependency versions, lockfile clean install, audit, production build, unit tests, and Chromium E2E completed." -ForegroundColor Green
  Write-Host 'Keep package.json and package-lock.json together. Use npm ci for future reproducible installs.'
}
catch {
  Write-Host "`nFAILED: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "See full log: $logPath" -ForegroundColor Yellow
  exit 1
}
finally {
  if ($transcriptStarted) { Stop-Transcript | Out-Null }
}
