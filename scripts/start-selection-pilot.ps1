[CmdletBinding()]
param([Parameter(Mandatory)][ValidateSet('wuwa','nte')][string]$Game, [switch]$Check, [switch]$Elevated)
$ErrorActionPreference = 'Stop'
try {
    $node = Get-Command node.exe -CommandType Application -ErrorAction Stop | Select-Object -First 1
    $version = & $node.Source --version
    if ($LASTEXITCODE -ne 0 -or $version -notmatch '^v(\d+)\.' -or [int]$Matches[1] -lt 22) {
        throw 'Node.js 22 ou superior e necessario.'
    }
    $entry = Join-Path $PSScriptRoot 'selection-pilot-entry.js'
    if (!(Test-Path -LiteralPath $entry -PathType Leaf)) { throw "Arquivo ausente: $entry" }
    & $node.Source $entry --game $Game --check
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    if ($Check) { exit 0 }
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    try { $admin = (New-Object Security.Principal.WindowsPrincipal($identity)).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) }
    finally { $identity.Dispose() }
    if (!$admin) {
        if ($Elevated) { throw 'A abertura como Administrador nao foi concluida.' }
        Write-Host 'O Windows vai solicitar permissao de Administrador. Recuse para cancelar.'
        $ps = Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'
        $arguments = @('-NoLogo','-NoProfile','-ExecutionPolicy','Bypass','-File',('"{0}"' -f $PSCommandPath),'-Game',$Game,'-Elevated')
        try { $p = Start-Process -FilePath $ps -ArgumentList $arguments -Verb RunAs -WindowStyle Normal -Wait -PassThru -ErrorAction Stop; exit $p.ExitCode }
        catch { Write-Host "Elevacao cancelada ou indisponivel: $($_.Exception.Message)"; exit 1 }
    }
    & $node.Source $entry --game $Game
    $result = $LASTEXITCODE
    if (![Console]::IsInputRedirected) {
        Write-Host 'Pressione Enter para fechar este console.'
        [void][Console]::ReadLine()
    }
    exit $result
} catch {
    Write-Host "Nao foi possivel iniciar: $($_.Exception.Message). Instale Node.js 22 ou superior e prepare este repositorio."
    exit 1
}
