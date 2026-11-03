[CmdletBinding()]
param([Parameter(Mandatory)][string]$RunDirectory)

# The public scanner owns validation, directory creation, evidence and exit-code.txt.
$ErrorActionPreference = 'Stop'
$directoryExisted = Test-Path -LiteralPath $RunDirectory
try {
    & (Join-Path $PSScriptRoot 'scan-zzz.ps1') -Inventory -SAFilterPrepared -LevelDescendingPrepared -Run -RunDirectory $RunDirectory | Out-Null
    exit 0
} catch {
    # Append only after the scanner has unwound. Never create/replace a rejected directory.
    $runs = [IO.Path]::GetFullPath((Join-Path (Split-Path -Parent $PSScriptRoot) '.cache\youkai-p1\runs'))
    $run = [IO.Path]::GetFullPath($RunDirectory)
    if (!$directoryExisted -and [string]::Equals((Split-Path -Parent $run), $runs, [StringComparison]::OrdinalIgnoreCase) -and
        (Test-Path -LiteralPath $run -PathType Container)) {
        Add-Content -LiteralPath (Join-Path $run 'console.log') -Value "A coleta parou: $($_.Exception.Message)" -Encoding Unicode
    }
    exit 1
}
