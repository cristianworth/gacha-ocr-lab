[CmdletBinding()]
param([switch]$CheckStop, [switch]$Run, [string]$StopReceipt, [ValidateRange(2,3)][int]$Limit = 3)

$ErrorActionPreference = 'Stop'
if ($CheckStop -and $Run) { throw 'Choose CheckStop or Run.' }
$repoRoot = Split-Path -Parent $PSScriptRoot
$cacheRoot = Join-Path $repoRoot '.cache\youkai-p1'
$sourceRoot = Join-Path $cacheRoot 'youkai-86a8b34511c86ec864d8f40c558789f7ccad4cc9'
$pythonExe = Join-Path $cacheRoot '.venv\Scripts\python.exe'
if (!(Test-Path -LiteralPath $pythonExe)) { throw 'Run scripts/qualify-youkai.ps1 first.' }
$runRoot = Join-Path $cacheRoot ('runs\' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0,8) + '-selection')
New-Item -ItemType Directory -Path $runRoot,(Join-Path $cacheRoot 'tmp') -Force | Out-Null
$environment = @{
    'PYTHONPATH' = (Join-Path $sourceRoot 'src')
    'PYTHONDONTWRITEBYTECODE' = '1'
    'PYTHONNOUSERSITE' = '1'
    'TESSDATA_PREFIX' = (Join-Path $cacheRoot 'tesseract\tessdata')
    'PATH' = ((Join-Path $cacheRoot 'tesseract') + ';' + $env:PATH)
    'TMP' = (Join-Path $cacheRoot 'tmp')
    'TEMP' = (Join-Path $cacheRoot 'tmp')
}
$previous = @{}
foreach ($name in $environment.Keys) {
    $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
    [Environment]::SetEnvironmentVariable($name, $environment[$name], 'Process')
}
try {
    $probeArgs = @((Join-Path $PSScriptRoot 'youkai_selection.py'), $cacheRoot, $runRoot, '--limit', $Limit)
    if ($CheckStop) { $probeArgs += '--check-stop' }
    if ($Run) {
        $probeArgs += '--run'
        if ($StopReceipt) { $probeArgs += @('--stop-receipt', (Resolve-Path -LiteralPath $StopReceipt).Path) }
    }
    & $pythonExe @probeArgs
    if ($LASTEXITCODE -ne 0) { throw "Qualification stopped. See $runRoot\session.json" }
} finally {
    foreach ($name in $previous.Keys) { [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process') }
}
