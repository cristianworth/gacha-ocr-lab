[CmdletBinding()]
param([string]$OutputPath)

$ErrorActionPreference = 'Stop'
if (!$OutputPath) { $OutputPath = Join-Path (Split-Path -Parent $PSScriptRoot) 'gacha-ocr.exe' }
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (!(Test-Path -LiteralPath $compiler)) {
    $compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe'
}
if (!(Test-Path -LiteralPath $compiler)) { throw 'Compilador C# do .NET Framework nao encontrado.' }
if (Test-Path -LiteralPath $OutputPath) { throw 'O executavel de destino ja existe. Use um novo caminho para preservar o build anterior.' }
$source = Join-Path (Split-Path -Parent $PSScriptRoot) 'packaging\DesktopLauncher.cs'
& $compiler /nologo /target:winexe /platform:anycpu /optimize+ /reference:System.Windows.Forms.dll "/out:$OutputPath" $source
if ($LASTEXITCODE -ne 0) { throw 'Falha ao compilar a entrada desktop.' }
Write-Host "Entrada desktop: $OutputPath"
