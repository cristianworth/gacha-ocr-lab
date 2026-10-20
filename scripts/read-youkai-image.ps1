[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$ImagePath,
    [Parameter(Mandatory = $true)][string]$ClientArea
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$cacheRoot = Join-Path $repoRoot '.cache\youkai-p1'
$sourceRoot = Join-Path $cacheRoot 'youkai-86a8b34511c86ec864d8f40c558789f7ccad4cc9'
$pythonExe = Join-Path $cacheRoot '.venv\Scripts\python.exe'
$tesseractRoot = Join-Path $cacheRoot 'tesseract'
if (!(Test-Path -LiteralPath $pythonExe) -or !(Test-Path -LiteralPath (Join-Path $tesseractRoot 'tesseract.exe'))) {
    throw 'Prepare the isolated environment with scripts/qualify-youkai.ps1 first.'
}
$imageFile = (Resolve-Path -LiteralPath $ImagePath).Path
$runRoot = Join-Path $cacheRoot ('runs\' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0,8) + '-image')
New-Item -ItemType Directory -Path $runRoot,(Join-Path $cacheRoot 'tmp') -Force | Out-Null
$environment = @{
    'PYTHONPATH' = (Join-Path $sourceRoot 'src')
    'PYTHONDONTWRITEBYTECODE' = '1'
    'PYTHONNOUSERSITE' = '1'
    'TESSDATA_PREFIX' = (Join-Path $tesseractRoot 'tessdata')
    'PATH' = ($tesseractRoot + ';' + $env:PATH)
    'TMP' = (Join-Path $cacheRoot 'tmp')
    'TEMP' = (Join-Path $cacheRoot 'tmp')
}
$previous = @{}
foreach ($name in $environment.Keys) {
    $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
    [Environment]::SetEnvironmentVariable($name, $environment[$name], 'Process')
}
try {
    # This entry point only processes the supplied file; it never opens the game.
    & $pythonExe (Join-Path $PSScriptRoot 'youkai-offline.py') $cacheRoot $runRoot image --image $imageFile --client $ClientArea
    if ($LASTEXITCODE -ne 0) { throw "Image read failed ($LASTEXITCODE). Evidence: $runRoot" }
} finally {
    foreach ($name in $previous.Keys) { [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process') }
}
