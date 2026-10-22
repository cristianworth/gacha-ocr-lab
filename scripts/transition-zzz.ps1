[CmdletBinding()]
param([switch]$Run)

$ErrorActionPreference = 'Stop'
$arguments = @{ Pilot = $true; Transition = $true }
if ($Run) { $arguments.Run = $true }
& (Join-Path $PSScriptRoot 'probe-youkai.ps1') @arguments
