$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path -LiteralPath $compiler)) {
    $compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe'
}
if (-not (Test-Path -LiteralPath $compiler)) {
    throw 'Compilador C# do .NET Framework nao encontrado neste Windows.'
}
$source = Join-Path $PSScriptRoot 'launcher\Launcher.cs'
$manifest = Join-Path $PSScriptRoot 'launcher\app.manifest'
$output = Join-Path $projectRoot 'gacha-ocr-lab.exe'
& $compiler /nologo /target:exe /platform:anycpu /optimize+ "/win32manifest:$manifest" "/out:$output" $source
if ($LASTEXITCODE -ne 0) { throw 'Falha ao compilar o lancador.' }
Write-Host "Executavel: $output"
Write-Host 'O Windows solicita Administrador ao abrir (UAC conforme a politica local).'
