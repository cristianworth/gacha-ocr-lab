[CmdletBinding()]
param([Parameter(Mandatory)][string]$RunDirectory)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$runs = [IO.Path]::GetFullPath((Join-Path $root '.cache\genshin\runs'))
$run = [IO.Path]::GetFullPath($RunDirectory)
if (![string]::Equals((Split-Path -Parent $run), $runs, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'A pasta do piloto deve ser filha direta de .cache\genshin\runs.'
}
if (Test-Path -LiteralPath $run) { throw 'A pasta do piloto ja existe; os dados foram preservados.' }
New-Item -ItemType Directory -Path $runs -Force | Out-Null
New-Item -ItemType Directory -Path $run -ErrorAction Stop | Out-Null
$stream = [IO.FileStream]::new((Join-Path $run 'console.log'), [IO.FileMode]::CreateNew,
    [IO.FileAccess]::Write, ([IO.FileShare]::ReadWrite -bor [IO.FileShare]::Delete))
$writer = [IO.StreamWriter]::new($stream, [Text.Encoding]::Unicode)
$writer.AutoFlush = $true
$code = 1
try {
    $node = (Get-Command node.exe -ErrorAction Stop).Source
    [Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
    $ErrorActionPreference = 'Continue'
    & $node (Join-Path $PSScriptRoot 'genshin-pilot.js') --prepared --run-directory $run 2>&1 | ForEach-Object {
        $writer.WriteLine([string]$_)
    }
    $code = $LASTEXITCODE
} catch {
    $writer.WriteLine("Falha ao iniciar piloto: $($_.Exception.Message)")
} finally {
    $writer.Dispose()
    [IO.File]::WriteAllText((Join-Path $run 'exit-code.txt'), [string]$code, [Text.Encoding]::ASCII)
}
exit $code
