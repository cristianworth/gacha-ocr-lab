[CmdletBinding()]
param([switch]$Offline)

$ErrorActionPreference = 'Stop'
if ($env:OS -ne 'Windows_NT' -or $env:PROCESSOR_ARCHITECTURE -ne 'AMD64') {
    throw 'This qualification targets Windows x64.'
}
$repoRoot = Split-Path -Parent $PSScriptRoot
$cacheRoot = Join-Path $repoRoot '.cache\youkai-p1'
$sourceSha = '86a8b34511c86ec864d8f40c558789f7ccad4cc9'
$sourceRoot = Join-Path $cacheRoot "youkai-$sourceSha"
$runRoot = Join-Path $cacheRoot ('runs\' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0,8))
New-Item -ItemType Directory -Path $cacheRoot,$runRoot,(Join-Path $cacheRoot 'tmp') -Force | Out-Null

function Get-VerifiedAsset([string]$Url, [string]$Path, [string]$Hash) {
    if (!(Test-Path -LiteralPath $Path)) {
        if ($Offline) { throw "Missing cached asset: $Path" }
        Invoke-WebRequest -Uri $Url -OutFile $Path -UseBasicParsing -TimeoutSec 120
    }
    $actual = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actual -ne $Hash) { throw "SHA-256 mismatch: $Path. Preserve it for inspection." }
}
function Assert-NativeExit([string]$Operation) {
    if ($LASTEXITCODE -ne 0) { throw "$Operation failed with exit code $LASTEXITCODE" }
}

function Invoke-LoggedNative([string]$Executable, [string[]]$Arguments, [string]$LogPath, [int]$MaxExitCode = 0, [switch]$AllowFailure) {
    # Windows PowerShell 5.1 represents redirected native stderr as error records,
    # even when a tool succeeds. Decide success using its exit code.
    $previousPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        & $Executable @Arguments *> $LogPath
        $nativeExit = $LASTEXITCODE
    } finally { $ErrorActionPreference = $previousPreference }
    if (!$AllowFailure -and ($nativeExit -lt 0 -or $nativeExit -gt $MaxExitCode)) {
        throw "Native command failed ($nativeExit): $Executable. See $LogPath"
    }
    return $nativeExit
}
$assets = @(
    @("https://codeload.github.com/AJTDaedalus/youkai/zip/$sourceSha", "youkai-$sourceSha.zip", '399fd104152b1b7867af103c09580f62d4314d4c77f45cfa995461f26992b50f'),
    @('https://github.com/astral-sh/uv/releases/download/0.13.4/uv-x86_64-pc-windows-msvc.zip', 'uv-0.13.4-windows-x64.zip', 'ccec7508a07d9933d7cb1261880633efcf1f30d6e6eddab21823f1dae6f23225'),
    @('https://github.com/astral-sh/python-build-standalone/releases/download/20261013/cpython-3.12.15%2B20261013-x86_64-pc-windows-msvc-install_only_stripped.tar.gz', 'python-3.12.15-20261013.tar.gz', '7a2aef48e5ee569e310b29b32681debbc5d888e92790d85331a47736c6b06aad'),
    @('https://github.com/ip7z/7zip/releases/download/26.04/7zr.exe', '7zip\7zr.exe', '256feca8e274e5da655e2a284fabafd9f554365eb164862089dacd4e8276d282'),
    @('https://github.com/ip7z/7zip/releases/download/26.04/7z2604-x64.exe', '7zip\7z2604-x64.exe', 'd54bf805f9f3704d1e8db2fa3498ae7ef2df0312b40b558e7c71c734430a665d'),
    @('https://github.com/UB-Mannheim/tesseract/releases/download/v5.4.0.20240606/tesseract-ocr-w64-setup-5.4.0.20240606.exe', 'tesseract-ocr-w64-setup-5.4.0.20240606.exe', 'c885fff6998e0608ba4bb8ab51436e1c6775c2bafc2559a19b423e18678b60c9')
)
New-Item -ItemType Directory -Path (Join-Path $cacheRoot '7zip') -Force | Out-Null
foreach ($asset in $assets) { Get-VerifiedAsset $asset[0] (Join-Path $cacheRoot $asset[1]) $asset[2] }
if (!(Test-Path -LiteralPath $sourceRoot)) {
    Expand-Archive -LiteralPath (Join-Path $cacheRoot "youkai-$sourceSha.zip") -DestinationPath $cacheRoot
}
$uvExe = Join-Path $cacheRoot 'uv\uv.exe'
if (!(Test-Path -LiteralPath $uvExe)) {
    Expand-Archive -LiteralPath (Join-Path $cacheRoot 'uv-0.13.4-windows-x64.zip') -DestinationPath (Join-Path $cacheRoot 'uv')
}
$pythonRoot = Join-Path $cacheRoot 'python\cpython-3.12.15-windows-x86_64-none'
$basePython = Join-Path $pythonRoot 'python.exe'
if (!(Test-Path -LiteralPath $basePython)) {
    New-Item -ItemType Directory -Path $pythonRoot -Force | Out-Null
    & tar.exe -xzf (Join-Path $cacheRoot 'python-3.12.15-20261013.tar.gz') --strip-components 1 -C $pythonRoot
    Assert-NativeExit 'Extract Python'
}
if ((Get-FileHash -LiteralPath $basePython -Algorithm SHA256).Hash.ToLowerInvariant() -ne '407de1f8feb303d3249bb835e5ff7f543daada4e229c2c496d24a5b99fdba9ec') {
    throw 'Unexpected Python executable; preserve the runtime for inspection.'
}
$sevenZip = Join-Path $cacheRoot '7zip\full\7z.exe'
if (!(Test-Path -LiteralPath $sevenZip)) {
    [void](Invoke-LoggedNative (Join-Path $cacheRoot '7zip\7zr.exe') @('x', (Join-Path $cacheRoot '7zip\7z2604-x64.exe'), ('-o' + (Join-Path $cacheRoot '7zip\full')), '-y') (Join-Path $runRoot '7zip-extract.log'))
}
$tesseractRoot = Join-Path $cacheRoot 'tesseract'
$tesseractExe = Join-Path $tesseractRoot 'tesseract.exe'
if (!(Test-Path -LiteralPath $tesseractExe)) {
    # Extract the native OCR files; never execute either installer.
    [void](Invoke-LoggedNative $sevenZip @('x', (Join-Path $cacheRoot 'tesseract-ocr-w64-setup-5.4.0.20240606.exe'), ('-o' + $tesseractRoot), '-y') (Join-Path $runRoot 'tesseract-extract.log') -MaxExitCode 1)
}
$expectedOcr = @{
    'tesseract.exe' = 'babb405f4366b480d02cd8ff2bac8d497170f6c1711ce6f3d5d8bf0fb7fa6ed9'
    'tessdata\eng.traineddata' = '7d4322bd2a7749724879683fc3912cb542f19906c83bcc1a52132556427170b2'
}
foreach ($relative in $expectedOcr.Keys) {
    if ((Get-FileHash -LiteralPath (Join-Path $tesseractRoot $relative) -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expectedOcr[$relative]) { throw "Unexpected OCR file: $relative" }
}

$environment = @{
    'UV_CACHE_DIR' = (Join-Path $cacheRoot 'uv-cache')
    'UV_PYTHON_INSTALL_DIR' = (Join-Path $cacheRoot 'python')
    'PYTHONPATH' = (Join-Path $sourceRoot 'src')
    'PYTHONDONTWRITEBYTECODE' = '1'
    'PYTHONNOUSERSITE' = '1'
    'PYTEST_DISABLE_PLUGIN_AUTOLOAD' = '1'
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
Push-Location $sourceRoot
try {
    $venvRoot = Join-Path $cacheRoot '.venv'
    $pythonExe = Join-Path $venvRoot 'Scripts\python.exe'
    if (!(Test-Path -LiteralPath $pythonExe)) {
        [void](Invoke-LoggedNative $uvExe @('--no-config', 'venv', $venvRoot, '--python', $basePython) (Join-Path $runRoot 'venv.log'))
    }
    $syncArgs = @('--no-config', 'pip', 'sync', '--python', $pythonExe, '--require-hashes', '--only-binary', ':all:', (Join-Path $PSScriptRoot 'youkai-requirements.lock'))
    if ($Offline) { $syncArgs += '--offline' }
    [void](Invoke-LoggedNative $uvExe $syncArgs (Join-Path $runRoot 'install.log'))
    & $pythonExe -c 'import sys; assert sys.version_info[:3] == (3,12,15), sys.version'
    Assert-NativeExit 'Check venv Python'
    [void](Invoke-LoggedNative $tesseractExe @('--version') (Join-Path $runRoot 'tesseract-version.log'))
    & $pythonExe (Join-Path $PSScriptRoot 'youkai-offline.py') $cacheRoot $runRoot verify
    Assert-NativeExit 'Verify upstream files'
    $testArgs = @('-m', 'pytest', 'tests/test_capture.py', 'tests/test_grid.py', 'tests/test_grid_incomplete.py', 'tests/test_recognize.py', 'tests/test_wengine_scanner.py', 'tests/test_matchers.py', 'tests/test_normalizer.py', 'tests/test_tesseract_resolve.py', '-q', '-ra', '--tb=short', ('--junitxml=' + (Join-Path $runRoot 'upstream.xml')), '-o', ('cache_dir=' + (Join-Path $cacheRoot 'pytest-cache')))
    $testExit = Invoke-LoggedNative $pythonExe $testArgs (Join-Path $runRoot 'upstream.log') -AllowFailure
    Get-Content -LiteralPath (Join-Path $runRoot 'upstream.log') -Tail 16
    # This public static-image path never creates a navigator or listener.
    & $pythonExe (Join-Path $PSScriptRoot 'youkai-offline.py') $cacheRoot $runRoot report
    Assert-NativeExit 'Build offline report'
    if ($testExit -ne 0) { throw "Upstream tests failed ($testExit). Evidence: $runRoot" }
    Write-Output "Qualification evidence: $runRoot"
} finally {
    Pop-Location
    foreach ($name in $previous.Keys) { [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process') }
}
