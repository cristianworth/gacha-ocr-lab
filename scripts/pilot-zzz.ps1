[CmdletBinding()]
param([switch]$Run, [switch]$TestStop, [string]$ImagePath, [string]$ClientArea, [ValidateSet(2,3,10)][int]$Limit = 10)

$ErrorActionPreference = 'Stop'
$arguments = @{ Pilot = $true; Limit = $Limit }
if ($Run) { $arguments.Run = $true }
if ($TestStop) { $arguments.TestStop = $true; $arguments.Limit = 3 }
if ($ImagePath) { $arguments.ImagePath = $ImagePath; $arguments.ClientArea = $ClientArea }
& (Join-Path $PSScriptRoot 'probe-youkai.ps1') @arguments
