[CmdletBinding()]
param([switch]$CheckStop, [switch]$Run, [string]$StopReceipt, [ValidateRange(1,180)][int]$Limit = 3,
      [switch]$Pilot, [string]$ImagePath, [string]$ClientArea, [switch]$TestStop, [switch]$TestGeometry, [switch]$Transition, [switch]$Scan, [switch]$SelectedRow,
      [switch]$Inventory, [switch]$CollectReferences, [ValidateRange(1,2000)][int]$MaxPositions = 2000,
      [ValidateSet(20)][int]$MinLevel = 20, [switch]$SAFilterPrepared,
      [switch]$LevelDescendingPrepared, [switch]$FullInventory, [string]$RunDirectory)

$ErrorActionPreference = 'Stop'
if ($CheckStop -and $Run) { throw 'Choose CheckStop or Run.' }
if ($TestStop -and $TestGeometry) { throw 'Choose TestStop or TestGeometry.' }
if (($TestStop -or $TestGeometry) -and (!$Run -or !$Pilot -or $ImagePath -or $Transition)) { throw 'Trials require Run and Pilot, without ImagePath/Transition.' }
if ($SAFilterPrepared -and !$Inventory) { throw 'SAFilterPrepared requires Inventory.' }
if (($LevelDescendingPrepared -or $FullInventory) -and !$Inventory) { throw 'LevelDescendingPrepared/FullInventory require Inventory.' }
if ($FullInventory -and $CollectReferences) { throw 'FullInventory cannot use CollectReferences.' }
if ($Inventory -and $Run -and !$CollectReferences -and !$FullInventory -and !$LevelDescendingPrepared) { throw 'Prepare Level descending and use LevelDescendingPrepared, or FullInventory for diagnostics.' }
if ($Inventory -and (!$Scan -or $SelectedRow)) { throw 'Inventory requires Scan without SelectedRow.' }
if ($CollectReferences -and (!$Inventory -or !$Run)) { throw 'CollectReferences requires Inventory and Run.' }
if ($SelectedRow -and !$Scan) { throw 'SelectedRow requires Scan.' }
if ($Scan -and (!$Pilot -or $ImagePath -or $CheckStop -or $Transition -or $TestStop -or $TestGeometry)) { throw 'Scan requires Pilot without other modes/trials/image.' }
if (!$Scan -and $Limit -notin @(2,3,10)) { throw 'Qualification/pilot limit must be 2, 3 or 10.' }
if ($Limit -eq 10 -and !$Pilot) { throw 'Ten positions require Pilot.' }
if ($ImagePath -and (!$Pilot -or $Run -or $CheckStop -or !$ClientArea)) { throw 'ImagePath requires Pilot and ClientArea, without Run/CheckStop.' }
$repoRoot = Split-Path -Parent $PSScriptRoot
$cacheRoot = Join-Path $repoRoot '.cache\youkai-p1'
$sourceRoot = Join-Path $cacheRoot 'youkai-86a8b34511c86ec864d8f40c558789f7ccad4cc9'
$pythonExe = Join-Path $cacheRoot '.venv\Scripts\python.exe'
$portable = Test-Path -LiteralPath (Join-Path $repoRoot 'portable-build.json') -PathType Leaf
if ($portable) { $pythonExe = Join-Path $repoRoot 'runtime\zzz-worker\zzz-worker.exe' }
if (!(Test-Path -LiteralPath $pythonExe)) { throw 'Runtime ZZZ ausente. Prepare o ambiente ou extraia novamente o pacote completo.' }
$runsRoot = [IO.Path]::GetFullPath((Join-Path $cacheRoot 'runs'))
if ($RunDirectory) {
    $runRoot = [IO.Path]::GetFullPath($RunDirectory)
    if (![string]::Equals((Split-Path -Parent $runRoot), $runsRoot, [StringComparison]::OrdinalIgnoreCase) -or
        (Test-Path -LiteralPath $runRoot)) {
        throw 'RunDirectory must be a new direct child of this laboratory runs folder.'
    }
} else {
    $runRoot = Join-Path $runsRoot ((Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0,8) + '-selection')
}
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
    if ($portable) { $probeArgs = @($cacheRoot, $runRoot, '--limit', $Limit) }
    if ($Pilot) { $probeArgs += '--pilot' }
    if ($TestStop) { $probeArgs += '--test-stop' }
    if ($TestGeometry) { $probeArgs += '--test-geometry' }
    if ($Transition) { $probeArgs += '--transition' }
    if ($Scan) { $probeArgs += '--scan' }
    if ($SelectedRow) { $probeArgs += '--selected-row' }
    if ($Inventory) { $probeArgs += @('--inventory', '--max-positions', $MaxPositions, '--min-level', $MinLevel) }
    if ($SAFilterPrepared) { $probeArgs += '--sa-filter-prepared' }
    if ($LevelDescendingPrepared) { $probeArgs += '--level-descending-prepared' }
    if ($FullInventory) { $probeArgs += '--full-inventory' }
    if ($CollectReferences) { $probeArgs += '--collect-references' }
    if ($ImagePath) { $probeArgs += @('--image', (Resolve-Path -LiteralPath $ImagePath).Path, '--client', $ClientArea) }
    if ($CheckStop) { $probeArgs += '--check-stop' }
    if ($Run) {
        $probeArgs += '--run'
        if ($StopReceipt) { $probeArgs += @('--stop-receipt', (Resolve-Path -LiteralPath $StopReceipt).Path) }
    }
    & $pythonExe @probeArgs | Tee-Object -FilePath (Join-Path $runRoot 'console.log')
    $probeExitCode = $LASTEXITCODE
    Set-Content -LiteralPath (Join-Path $runRoot 'exit-code.txt') -Value $probeExitCode -Encoding ASCII
    if ($probeExitCode -ne 0) { throw "Qualification stopped. See $runRoot\session.json" }
} finally {
    foreach ($name in $previous.Keys) { [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process') }
}
