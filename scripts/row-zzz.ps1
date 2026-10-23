[CmdletBinding()]
param([switch]$Run)

$ErrorActionPreference = 'Stop'
$arguments = @{ Pilot = $true; Scan = $true; SelectedRow = $true; Limit = 9 }
if ($Run) { $arguments.Run = $true }
& (Join-Path $PSScriptRoot 'probe-youkai.ps1') @arguments
