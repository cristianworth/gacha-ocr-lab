[CmdletBinding()]
param([switch]$Check, [switch]$Elevated)

function Get-ZzzInstallation {
    param([Parameter(Mandatory)][string]$Root, [switch]$Desktop)
    $rootPath = (Resolve-Path -LiteralPath $Root -ErrorAction Stop).Path
    $required = @(
        'scripts\scan-zzz.ps1', 'scripts\probe-youkai.ps1', 'scripts\youkai_selection.py',
        '.cache\youkai-p1\youkai-86a8b34511c86ec864d8f40c558789f7ccad4cc9\src\youkai_ocr\wengine_scanner.py',
        '.cache\youkai-p1\tesseract\tesseract.exe',
        '.cache\youkai-p1\tesseract\tessdata\eng.traineddata'
    )
    if ($Desktop) { $required += @('scan-desktop.cmd', 'scripts\start-desktop.ps1', 'scripts\run-desktop-zzz.ps1') }
    if (Test-Path -LiteralPath (Join-Path $rootPath 'portable-build.json') -PathType Leaf) {
        $required += 'runtime\zzz-worker\zzz-worker.exe'
    } else {
        $required += '.cache\youkai-p1\.venv\Scripts\python.exe'
    }
    foreach ($relative in $required) {
        if (!(Test-Path -LiteralPath (Join-Path $rootPath $relative) -PathType Leaf)) {
            throw "Ambiente ZZZ incompleto: $relative. Mantenha a entrada junto do laboratorio e conclua a preparacao do ambiente antes de coletar."
        }
    }
    [pscustomobject]@{
        Root = $rootPath
        RunsRoot = Join-Path $rootPath '.cache\youkai-p1\runs'
        ScanScript = Join-Path $rootPath 'scripts\scan-zzz.ps1'
    }
}

function Test-ZzzAdministrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    try {
        $principal = New-Object Security.Principal.WindowsPrincipal($identity)
        $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    } finally {
        $identity.Dispose()
    }
}

function Request-ZzzElevation {
    param([Parameter(Mandatory)][string]$ScriptPath, [switch]$Graphical)
    $powershell = Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'
    $arguments = @('-NoLogo', '-NoProfile', '-ExecutionPolicy', 'Bypass')
    if ($Graphical) { $arguments += @('-STA', '-WindowStyle', 'Hidden') }
    $arguments += @('-File', ('"{0}"' -f $ScriptPath), '-Elevated')
    $style = if ($Graphical) { 'Hidden' } else { 'Normal' }
    try {
        Start-Process -FilePath $powershell -ArgumentList $arguments -Verb RunAs -WindowStyle $style -ErrorAction Stop | Out-Null
        return $true
    } catch {
        $errorObject = $_.Exception
        while ($null -ne $errorObject) {
            if ($errorObject -is [ComponentModel.Win32Exception] -and $errorObject.NativeErrorCode -eq 1223) {
                return $false
            }
            $errorObject = $errorObject.InnerException
        }
        throw
    }
}

function Read-ZzzPreparation {
    Write-Host ''
    Write-Host 'Prepare o jogo em ingles, janela 1280x720 e escala Windows 100%.'
    Write-Host 'Abra W-Engine Storage: S e A selecionados; B e especialidades desmarcados.'
    Write-Host 'Ordene por Level, do maior para o menor. Feche o filtro e volte ao topo.'
    Write-Host 'Solte os controles e espere a lista parar. Nao precisa clicar em item.'
    Write-Host 'Ao iniciar, o scanner pedira F8: volte ao jogo e pressione/solte uma vez.'
    Write-Host 'Depois mantenha o jogo na frente e nao mexa no mouse/teclado. F8 interrompe; F9 nao e usado.'
    while ($true) {
        Write-Host 'Pressione Enter para confirmar essa preparacao e iniciar, ou 0 para sair: ' -NoNewline
        $answer = [Console]::ReadLine()
        if ($null -eq $answer -or $answer.Trim() -eq '0') { return $false }
        if ($answer.Trim() -eq '') { return $true }
        Write-Host 'Use Enter para iniciar ou 0 para sair.'
    }
}

function Get-ZzzResult {
    param([Parameter(Mandatory)][string]$RunDirectory, [switch]$Failed)
    $report = $null
    $manifest = Join-Path $RunDirectory 'session.json'
    if (Test-Path -LiteralPath $manifest -PathType Leaf) {
        try {
            # Read only after the scanner has finished replacing its manifest.
            $report = Get-Content -LiteralPath $manifest -Raw -ErrorAction Stop | ConvertFrom-Json -ErrorAction Stop
        } catch {
            Write-Host 'Nao foi possivel ler o manifesto; os arquivos da tentativa foram preservados.'
        }
    }
    $complete = !$Failed -and $null -ne $report -and $report.mode -eq 'zzz-inventory' -and
        $report.scopeComplete -eq $true -and $report.coverageConfirmed -eq $true -and
        $report.status -in @('scope-captured', 'inventory-captured')
    $message = if ($complete) { 'Coleta dos elegiveis concluida. Os dados ainda precisam de revisao.' }
               else { 'Coleta parcial ou interrompida. Confira o resumo e as mensagens; nenhum dado foi aprovado automaticamente.' }
    [pscustomobject]@{ Complete = [bool]$complete; Message = $message; Report = $report }
}

function Open-ZzzResult {
    param([Parameter(Mandatory)][string]$RunDirectory)
    $summary = Join-Path $RunDirectory 'summary.md'
    $review = Join-Path $RunDirectory 'review.html'
    if (Test-Path -LiteralPath $summary -PathType Leaf) {
        try {
            $notepad = Join-Path $env:WINDIR 'System32\notepad.exe'
            Start-Process -FilePath $notepad -ArgumentList ('"{0}"' -f $summary) -ErrorAction Stop | Out-Null
            return
        } catch { Write-Host 'Nao foi possivel abrir o resumo em texto; tentando o relatorio visual.' }
    }
    if (Test-Path -LiteralPath $review -PathType Leaf) {
        try {
            Start-Process -FilePath $review -ErrorAction Stop | Out-Null
            return
        } catch { Write-Host 'Nao foi possivel abrir o relatorio visual; tentando a pasta da tentativa.' }
    }
    if (Test-Path -LiteralPath $RunDirectory -PathType Container) {
        $explorer = Join-Path $env:WINDIR 'explorer.exe'
        Start-Process -FilePath $explorer -ArgumentList ('"{0}"' -f $RunDirectory) -ErrorAction Stop | Out-Null
    }
}

function Invoke-ZzzLauncher {
    param([Parameter(Mandatory)][string]$Root, [switch]$Check, [switch]$Elevated)
    $ErrorActionPreference = 'Stop'
    try {
        $installation = Get-ZzzInstallation -Root $Root
        Write-Host 'Gacha OCR Lab - ZZZ / W-Engines S/A 20+'
        Write-Host "Laboratorio: $($installation.Root)"
        if ($Check) {
            Write-Host 'Ambiente encontrado. Nenhuma elevacao, captura ou input executado.'
            return 0
        }
        if (!(Test-ZzzAdministrator)) {
            if ($Elevated) { throw 'A abertura como Administrador nao foi concluida.' }
            Write-Host 'O Windows vai solicitar permissao de Administrador para controlar o jogo.'
            if (!(Request-ZzzElevation -ScriptPath (Join-Path $installation.Root 'scripts\start-zzz.ps1'))) {
                Write-Host 'Abertura cancelada. Nenhuma coleta foi iniciada.'
                [void][Console]::ReadLine()
            }
            return 0
        }
        if (!(Read-ZzzPreparation)) {
            Write-Host 'Cancelado. Nenhuma coleta foi iniciada.'
            return 0
        }
        $runDirectory = Join-Path $installation.RunsRoot ((Get-Date -Format 'yyyyMMdd-HHmmss') + '-' +
            [guid]::NewGuid().ToString('N').Substring(0,8) + '-selection')
        Write-Host "Esta execucao: $runDirectory"
        $scanFailed = $false
        try {
            & $installation.ScanScript -Inventory -SAFilterPrepared -LevelDescendingPrepared -Run -RunDirectory $runDirectory | Out-Host
        } catch {
            $scanFailed = $true
            Write-Host "A coleta parou: $($_.Exception.Message)"
        }
        $result = Get-ZzzResult -RunDirectory $runDirectory -Failed:$scanFailed
        Write-Host ''
        Write-Host $result.Message
        if ($null -ne $result.Report -and $null -ne $result.Report.inventorySummary) {
            $counts = $result.Report.inventorySummary
            Write-Host "Elegiveis: $($counts.eligiblePositions); niveis pendentes: $($counts.pendingLevel)."
        }
        Write-Host "Arquivos desta execucao: $runDirectory"
        if (Test-Path -LiteralPath $runDirectory -PathType Container) {
            try { Open-ZzzResult -RunDirectory $runDirectory }
            catch { Write-Host "Nao foi possivel abrir o resultado. Use o caminho acima: $($_.Exception.Message)" }
        }
        Write-Host 'Pressione Enter para fechar este console.'
        [void][Console]::ReadLine()
        if ($result.Complete) { return 0 }
        return 1
    } catch {
        Write-Host "Nao foi possivel iniciar: $($_.Exception.Message)"
        if (!$Check) {
            Write-Host 'Pressione Enter para fechar este console.'
            [void][Console]::ReadLine()
        }
        return 1
    }
}

if ($MyInvocation.InvocationName -ne '.') {
    exit (Invoke-ZzzLauncher -Root (Split-Path -Parent $PSScriptRoot) -Check:$Check -Elevated:$Elevated)
}
