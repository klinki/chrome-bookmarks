param(
  [ValidateRange(1, 1000)]
  [int]$Count = 10,
  [ValidateSet('test', 'test:unit', 'test:e2e')]
  [string]$Script = 'test'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$npmCommand = if ($IsWindows) { 'npm.cmd' } else { 'npm' }
$results = @()

Write-Host "Running npm run $Script $Count times..."

for ($attempt = 1; $attempt -le $Count; $attempt++) {
  Write-Host "Attempt $attempt of $Count..."
  $timer = [System.Diagnostics.Stopwatch]::StartNew()
  $exitCode = 1

  try {
    & $npmCommand run $Script
    $exitCode = $LASTEXITCODE
  } catch {
    Write-Host "Test command failed: $_"
  } finally {
    $timer.Stop()
  }

  $result = if ($exitCode -eq 0) { 'PASS' } else { 'FAIL' }
  $results += [PSCustomObject]@{
    Attempt = $attempt
    Result = $result
    Seconds = [math]::Round($timer.Elapsed.TotalSeconds, 1)
  }
  Write-Host "Result: $result ($($timer.Elapsed))"
}

Write-Host "`nSummary:"
$results | Format-Table -AutoSize

$failures = @($results | Where-Object { $_.Result -eq 'FAIL' }).Count
Write-Host "Total failures: $failures / $Count"
if ($failures -gt 0) {
  exit 1
}
