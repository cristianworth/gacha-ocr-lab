[CmdletBinding()]
param([switch]$InstallBuildTools)
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$pythonExe = Join-Path $repoRoot '.cache\youkai-p1\.venv\Scripts\python.exe'
$tools = Join-Path $repoRoot '.cache\zzz-portable-builder\tools'
if (!(Test-Path -LiteralPath $pythonExe)) { throw 'Prepare o ambiente do laboratorio antes de empacotar.' }
if ($InstallBuildTools) {
    $previousCache = $env:UV_CACHE_DIR
    try {
        $env:UV_CACHE_DIR = Join-Path $repoRoot '.cache\uv-build'
        & (Join-Path $repoRoot '.cache\youkai-p1\uv\uv.exe') pip install --python $pythonExe --target $tools -r (Join-Path $repoRoot 'packaging\requirements-build.in')
        if ($LASTEXITCODE -ne 0) { throw 'Falha ao instalar ferramentas de build.' }
    } finally { $env:UV_CACHE_DIR = $previousCache }
}
if (!(Test-Path -LiteralPath (Join-Path $tools 'PyInstaller\__init__.py'))) {
    throw 'Ferramentas ausentes. Use -InstallBuildTools para baixar as versoes fixadas.'
}
$previousPath = $env:PYTHONPATH
$previousConfig = $env:PYINSTALLER_CONFIG_DIR
try {
    $env:PYTHONPATH = $tools
    $env:PYINSTALLER_CONFIG_DIR = Join-Path $repoRoot '.cache\zzz-portable-builder\pyinstaller'
    & $pythonExe (Join-Path $PSScriptRoot 'build_zzz_portable.py')
    if ($LASTEXITCODE -ne 0) { throw 'Empacotamento falhou; consulte a pasta preservada no cache.' }
} finally {
    $env:PYTHONPATH = $previousPath
    $env:PYINSTALLER_CONFIG_DIR = $previousConfig
}
