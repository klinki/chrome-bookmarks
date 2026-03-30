param(
  [ValidateSet('development', 'production')]
  [string]$Configuration = 'production',
  [string]$OutputDirectory = '.temp/chrome-extension',
  [string]$DistributionDirectory = 'dist/bookmarks',
  [string]$ArchiveName = 'bookmarks-chrome-extension.zip'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

function Resolve-RepoPath {
  param([string]$Path)

  if ([System.IO.Path]::IsPathRooted($Path)) {
    return $Path
  }

  return [System.IO.Path]::GetFullPath((Join-Path $repoRoot $Path))
}

$outputPath = Resolve-RepoPath $OutputDirectory
$distPath = Resolve-RepoPath $DistributionDirectory
$archivePath = Join-Path $outputPath $ArchiveName

if (Test-Path $outputPath) {
  Remove-Item -Recurse -Force $outputPath
}

New-Item -ItemType Directory -Path $outputPath | Out-Null

if (Test-Path $distPath) {
  Remove-Item -Recurse -Force $distPath
}

Push-Location $repoRoot
try {
  Write-Host "Building Chrome extension bundle in $Configuration mode..."

  if ($Configuration -eq 'production') {
    & npm run build:prod
  } else {
    & npm run build:dev
  }

  if ($LASTEXITCODE -ne 0) {
    throw "Build failed with exit code $LASTEXITCODE"
  }
}
finally {
  Pop-Location
}

if (-not (Test-Path $distPath)) {
  throw "Distribution directory not found: $distPath"
}

Write-Host "Packing $distPath into $archivePath"
Compress-Archive -Path (Join-Path $distPath '*') -DestinationPath $archivePath -Force

Write-Host "Chrome extension archive created at $archivePath"
