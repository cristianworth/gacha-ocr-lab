$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class PilotWindows {
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr handle);
}
"@
$items = @(Get-Process | Where-Object { $_.MainWindowHandle -ne 0 -and [PilotWindows]::IsWindowVisible($_.MainWindowHandle) } | ForEach-Object {
    try {
        [pscustomobject]@{ name = $_.ProcessName; pid = $_.Id; title = $_.MainWindowTitle; handle = $_.MainWindowHandle.ToString(); started = $_.StartTime.ToUniversalTime().Ticks.ToString() }
    } catch { }
})
ConvertTo-Json -InputObject $items -Compress
