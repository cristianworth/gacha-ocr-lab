[CmdletBinding()]
param([Parameter(Mandatory)][ValidateSet('wuwa','nte')][string]$Game,
      [Parameter(Mandatory)][ValidateSet('list','run')][string]$Action,
      [Parameter(Mandatory)][string]$EntryDirectory)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$entry = [IO.Path]::GetFullPath($EntryDirectory)
if (![string]::Equals((Split-Path -Parent $entry), (Join-Path $root '.cache\desktop-pilot'), [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Controle deve ser filho direto de .cache\desktop-pilot desta instalacao.'
}
$stream = [IO.FileStream]::new((Join-Path $entry 'console.log'), [IO.FileMode]::CreateNew,
    [IO.FileAccess]::Write, ([IO.FileShare]::ReadWrite -bor [IO.FileShare]::Delete))
$writer = [IO.StreamWriter]::new($stream, [Text.Encoding]::Unicode)
$writer.AutoFlush = $true
$code = 1
$logFailed = $false
try {
    $node = Get-Command node.exe -ErrorAction SilentlyContinue
    if ($null -eq $node) { throw 'Node.js 22+ ausente. Prepare Node, npm ci e modelo local nesta instalacao; nada foi instalado.' }
    [Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
    $ErrorActionPreference = 'Continue'
    & $node.Source (Join-Path $PSScriptRoot 'desktop-selection-entry.js') --game $Game --action $Action --entry-directory $entry 2>&1 | ForEach-Object {
        # Keep draining the child even when the outer log fails. The Node supervisor
        # delivers pending cancellation only to its own validated session.
        if (!$logFailed) {
            try { $writer.WriteLine([string]$_) }
            catch {
                $logFailed = $true
                try { [IO.File]::WriteAllText((Join-Path $entry 'stop.request'), 'stop') } catch { }
            }
        }
    }
    $code = $LASTEXITCODE
} catch {
    try { $writer.WriteLine("Falha ao iniciar: $($_.Exception.Message)") } catch { }
} finally {
    try { $writer.Dispose() } catch { $logFailed = $true }
    if ($logFailed) {
        $code = 1
        [IO.File]::WriteAllText((Join-Path $entry 'monitor-error.txt'), 'Falha ao gravar log; filho encerrado antes desta notificacao.')
    }
    [IO.File]::WriteAllText((Join-Path $entry 'exit-code.txt'), [string]$code, [Text.Encoding]::ASCII)
}
exit $code
