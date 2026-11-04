[CmdletBinding()]
param([Parameter(Mandatory)][string]$RunDirectory, [ValidateSet('zzz','hsr')][string]$Game = 'zzz',
      [ValidateRange(1,2000)][int]$MaxPositions = 2000)

# The public scanner owns validation, directory creation, evidence and exit-code.txt.
$ErrorActionPreference = 'Stop'
$directoryExisted = Test-Path -LiteralPath $RunDirectory
try {
    if ($Game -eq 'hsr') {
        & (Join-Path $PSScriptRoot 'scan-hsr.ps1') -Prepared -RunDirectory $RunDirectory -MaxPositions $MaxPositions | Out-Null
    } else {
        & (Join-Path $PSScriptRoot 'scan-zzz.ps1') -Inventory -SAFilterPrepared -LevelDescendingPrepared -Run -RunDirectory $RunDirectory | Out-Null
    }
    exit 0
} catch {
    # Append only after the scanner has unwound. Never create/replace a rejected directory.
    $relativeRuns = if ($Game -eq 'hsr') { '.cache\hsr\runs' } else { '.cache\youkai-p1\runs' }
    $runs = [IO.Path]::GetFullPath((Join-Path (Split-Path -Parent $PSScriptRoot) $relativeRuns))
    $run = [IO.Path]::GetFullPath($RunDirectory)
    if (!$directoryExisted -and [string]::Equals((Split-Path -Parent $run), $runs, [StringComparison]::OrdinalIgnoreCase) -and
        (Test-Path -LiteralPath $run -PathType Container)) {
        Add-Content -LiteralPath (Join-Path $run 'console.log') -Value "A coleta parou: $($_.Exception.Message)" -Encoding Unicode
    }
    exit 1
}
