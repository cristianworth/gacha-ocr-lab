[CmdletBinding()]
param([switch]$Run, [ValidateRange(1,180)][int]$Limit = 54)

$ErrorActionPreference = 'Stop'
$arguments = @{ Pilot = $true; Scan = $true; Limit = $Limit }
if ($Run) { $arguments.Run = $true }
& (Join-Path $PSScriptRoot 'probe-youkai.ps1') @arguments
