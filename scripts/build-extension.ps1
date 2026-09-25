param(
  [ValidateSet('development', 'production')]
  [string]$Configuration = 'production',
  [string]$OutputDirectory = '.temp/chrome-extension',
  [string]$ArchiveName = 'chrome-bookmarks.zip'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$extensionRoot = Join-Path $repoRoot 'dist/bookmarks/browser'
$outputPath = Join-Path $repoRoot $OutputDirectory
$archivePath = Join-Path $outputPath $ArchiveName

Push-Location $repoRoot
try {
  if ($Configuration -eq 'production') {
    & npm run build
  } else {
    & npm run build:dev
  }

  if ($LASTEXITCODE -ne 0) {
    throw "Extension build failed with exit code $LASTEXITCODE"
  }
} finally {
  Pop-Location
}

if (-not (Test-Path (Join-Path $extensionRoot 'manifest.json'))) {
  throw "Extension output is missing its manifest: $extensionRoot"
}

New-Item -ItemType Directory -Path $outputPath -Force | Out-Null
if (Test-Path $archivePath) {
  Remove-Item -Path $archivePath -Force
}

Compress-Archive -Path (Join-Path $extensionRoot '*') -DestinationPath $archivePath

$archive = [System.IO.Compression.ZipFile]::OpenRead($archivePath)
try {
  $entryNames = @($archive.Entries | ForEach-Object { $_.FullName })
  foreach ($requiredFile in @('manifest.json', 'index.html', 'background.js')) {
    if ($requiredFile -notin $entryNames) {
      throw "Extension archive is missing $requiredFile at its root"
    }
  }
} finally {
  $archive.Dispose()
}

Write-Host "Extension archive created: $archivePath"
