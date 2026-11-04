[CmdletBinding()]
param([Parameter(Mandatory)][string]$RunDirectory, [switch]$Prepared,
      [ValidateRange(1,2000)][int]$MaxPositions = 2000)

$ErrorActionPreference = 'Stop'
if (!$Prepared) { throw 'Confirme Light Cone, Lv decrescente, topo/primeiro item e controles livres.' }
$root = Split-Path -Parent $PSScriptRoot
$cache = Join-Path $root '.cache\youkai-p1'
$runs = [IO.Path]::GetFullPath((Join-Path $root '.cache\hsr\runs'))
$run = [IO.Path]::GetFullPath($RunDirectory)
if (![string]::Equals((Split-Path -Parent $run),$runs,[StringComparison]::OrdinalIgnoreCase) -or (Test-Path -LiteralPath $run)) {
    throw 'RunDirectory must be a new direct child of this laboratory HSR runs folder.'
}
$portable = Test-Path -LiteralPath (Join-Path $root 'portable-build.json') -PathType Leaf
$worker = if ($portable) { Join-Path $root 'runtime\zzz-worker\zzz-worker.exe' } else { Join-Path $cache '.venv\Scripts\python.exe' }
if (!(Test-Path -LiteralPath $worker -PathType Leaf)) { throw 'Runtime do scanner ausente.' }
New-Item -ItemType Directory -Path $run -Force | Out-Null
$environment = @{
    PYTHONPATH = (Join-Path $cache 'youkai-86a8b34511c86ec864d8f40c558789f7ccad4cc9\src')
    PYTHONDONTWRITEBYTECODE = '1'; PYTHONNOUSERSITE = '1'
    TESSDATA_PREFIX = (Join-Path $cache 'tesseract\tessdata')
    PATH = ((Join-Path $cache 'tesseract') + ';' + $env:PATH)
}
$previous = @{}
foreach ($name in $environment.Keys) {
    $previous[$name] = [Environment]::GetEnvironmentVariable($name,'Process')
    [Environment]::SetEnvironmentVariable($name,$environment[$name],'Process')
}
try {
    # An if-expression unwraps a one-element array into a string in Windows PowerShell.
    # Keep the outer array so += appends arguments rather than concatenating the script path.
    $arguments = @(if ($portable) { '--hsr' } else { Join-Path $PSScriptRoot 'hsr_scan.py' })
    $arguments += @($cache, $run, '--prepared', '--max-positions', $MaxPositions)
    $nativeErrorPreference = $ErrorActionPreference
    try {
        # In PowerShell 5.1 native stderr becomes ErrorRecord objects. Preserve those
        # in the log and decide failure from the native exit code after draining it.
        $ErrorActionPreference = 'Continue'
        & $worker @arguments 2>&1 | Tee-Object -FilePath (Join-Path $run 'console.log') -ErrorAction Stop
        $code = $LASTEXITCODE
    } finally { $ErrorActionPreference = $nativeErrorPreference }
    Set-Content -LiteralPath (Join-Path $run 'exit-code.txt') -Value $code -Encoding ASCII
    if ($code -ne 0) { throw "Coleta HSR parou. Confira $run" }
} finally {
    foreach ($name in $previous.Keys) { [Environment]::SetEnvironmentVariable($name,$previous[$name],'Process') }
}
