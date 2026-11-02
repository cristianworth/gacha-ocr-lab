[CmdletBinding()]
param([switch]$Run, [ValidateRange(1,180)][int]$Limit = 54,
      [switch]$Inventory, [switch]$CollectReferences, [ValidateRange(1,2000)][int]$MaxPositions = 2000,
      [ValidateSet(20)][int]$MinLevel = 20, [switch]$SAFilterPrepared,
      [switch]$LevelDescendingPrepared, [switch]$FullInventory, [string]$RunDirectory)

$ErrorActionPreference = 'Stop'
if ($Inventory -and $PSBoundParameters.ContainsKey('Limit')) { throw 'Inventory uses MaxPositions as a safety limit; omit Limit.' }
if ($CollectReferences -and (!$Inventory -or !$Run)) { throw 'CollectReferences requires Inventory and Run.' }
if (($LevelDescendingPrepared -or $FullInventory) -and !$Inventory) { throw 'LevelDescendingPrepared/FullInventory require Inventory.' }
if ($FullInventory -and $CollectReferences) { throw 'FullInventory cannot use CollectReferences.' }
if ($Inventory -and $Run -and !$CollectReferences -and !$FullInventory -and !$LevelDescendingPrepared) { throw 'Prepare Level descending and use LevelDescendingPrepared, or FullInventory for diagnostics.' }
$arguments = @{ Pilot = $true; Scan = $true; Limit = $Limit }
if ($SAFilterPrepared -and !$Inventory) { throw 'SAFilterPrepared requires Inventory.' }
if ($Inventory) { $arguments.Inventory = $true; $arguments.MaxPositions = $MaxPositions; $arguments.MinLevel = $MinLevel }
if ($SAFilterPrepared) { $arguments.SAFilterPrepared = $true }
if ($LevelDescendingPrepared) { $arguments.LevelDescendingPrepared = $true }
if ($FullInventory) { $arguments.FullInventory = $true }
if ($RunDirectory) { $arguments.RunDirectory = $RunDirectory }
if ($CollectReferences) { $arguments.CollectReferences = $true }
if ($Run) { $arguments.Run = $true }
& (Join-Path $PSScriptRoot 'probe-youkai.ps1') @arguments
