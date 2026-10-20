[CmdletBinding()]
param([ValidateRange(0,30)][int]$DelaySeconds = 5, [switch]$FocusGame, [switch]$CheckWindow)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$cacheRoot = Join-Path $repoRoot '.cache\youkai-p1'
$sourceRoot = Join-Path $cacheRoot 'youkai-86a8b34511c86ec864d8f40c558789f7ccad4cc9'
$pythonExe = Join-Path $cacheRoot '.venv\Scripts\python.exe'
if (!(Test-Path -LiteralPath $pythonExe)) { throw 'Run scripts/qualify-youkai.ps1 first.' }
$runRoot = Join-Path $cacheRoot ('runs\' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0,8) + '-capture')
New-Item -ItemType Directory -Path $runRoot,(Join-Path $cacheRoot 'tmp') -Force | Out-Null
$environment = @{
    'PYTHONPATH' = (Join-Path $sourceRoot 'src')
    'PYTHONDONTWRITEBYTECODE' = '1'
    'PYTHONNOUSERSITE' = '1'
    'TMP' = (Join-Path $cacheRoot 'tmp')
    'TEMP' = (Join-Path $cacheRoot 'tmp')
}
$previous = @{}
foreach ($name in $environment.Keys) {
    $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
    [Environment]::SetEnvironmentVariable($name, $environment[$name], 'Process')
}
try {
    $captureArgs = @((Join-Path $PSScriptRoot 'youkai_capture.py'), $cacheRoot, $runRoot, '--delay', $DelaySeconds)
    if ($FocusGame -and $CheckWindow) { throw 'CheckWindow never changes focus; choose only one mode.' }
    if ($FocusGame) { $captureArgs += '--focus' }
    if ($CheckWindow) { $captureArgs += '--check-window' }
    & $pythonExe @captureArgs
    if ($LASTEXITCODE -ne 0) { throw "Capture stopped. See $runRoot\capture.json" }
} finally {
    foreach ($name in $previous.Keys) { [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process') }
}
