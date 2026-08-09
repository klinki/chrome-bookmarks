$count = 10
$results = @()

Write-Host "Running full test suite $count times..."

for ($i = 1; $i -le $count; $i++) {
    Write-Host "Attempt $i of $count..."
    $start = Get-Date
    # Using npm run test via cmd /c
    $process = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "npm", "run", "test" -NoNewWindow -PassThru -Wait
    $end = Get-Date
    $duration = $end - $start

    $status = if ($process.ExitCode -eq 0) { "PASS" } else { "FAIL" }
    $results += [PSCustomObject]@{
        Run = $i
        Status = $status
        Duration = $duration
    }

    Write-Host "Result: $status ($duration)"
}

Write-Host "`nSummary:"
$results | Format-Table -AutoSize

$failures = ($results | Where-Object { $_.Status -eq "FAIL" }).Count
Write-Host "Total Failures: $failures / $count"

if ($failures -gt 0) {
    exit 1
}
exit 0
