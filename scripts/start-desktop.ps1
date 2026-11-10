[CmdletBinding()]
param(
    [switch]$Simulation, [switch]$Elevated, [switch]$Check,
    [ValidateSet('Complete', 'Partial', 'Error', 'Quick')][string]$Outcome = 'Complete',
    [ValidateRange(50, 10000)][int]$StepMilliseconds = 800
)

$script:DesktopSimulationWorker = Join-Path $PSScriptRoot 'desktop-simulation.ps1'
. (Join-Path $PSScriptRoot 'start-zzz.ps1') -Elevated:$Elevated -Check:$Check

function New-DesktopLogReader {
    param([Parameter(Mandatory)][string]$Path)
    [pscustomobject]@{
        Path = $Path; Offset = [long]0; HeaderRead = $false; Pending = ''; Finished = $false
        Decoder = [Text.UnicodeEncoding]::new($false, $true, $true).GetDecoder()
        SharingWait = $null; SharingTimeoutMilliseconds = 5000
    }
}

function Read-DesktopLog {
    param([Parameter(Mandatory)]$Reader, [switch]$Final)
    $lines = [Collections.Generic.List[string]]::new()
    if ($Reader.Finished) { return [pscustomobject]@{ Lines = @(); Drained = $true } }
    if (!(Test-Path -LiteralPath $Reader.Path -PathType Leaf)) {
        return [pscustomobject]@{ Lines = @(); Drained = [bool]$Final }
    }
    try {
        $stream = [IO.File]::Open($Reader.Path, [IO.FileMode]::Open, [IO.FileAccess]::Read,
                                  ([IO.FileShare]::ReadWrite -bor [IO.FileShare]::Delete))
    } catch {
        $failure = $_.Exception
        while ($null -ne $failure.InnerException) { $failure = $failure.InnerException }
        $nativeCode = $failure.HResult -band 0xffff
        if ($failure -is [IO.IOException] -and $nativeCode -in @(32,33)) {
            if ($null -eq $Reader.SharingWait) { $Reader.SharingWait = [Diagnostics.Stopwatch]::StartNew() }
            if ($Reader.SharingWait.ElapsedMilliseconds -lt $Reader.SharingTimeoutMilliseconds) {
                # Retry on the next UI timer tick without changing decoder/offset
                # or stopping the child for a writer's brief exclusive open.
                return [pscustomobject]@{ Lines = @(); Drained = $false }
            }
        }
        throw
    }
    $Reader.SharingWait = $null
    try {
        if ($stream.Length -lt $Reader.Offset) { throw 'O log foi truncado durante a execucao.' }
        if (!$Reader.HeaderRead) {
            if ($stream.Length -lt 2) {
                if ($Final -and $stream.Length -ne 0) { throw 'Cabecalho UTF-16 LE incompleto.' }
                return [pscustomobject]@{ Lines = @(); Drained = [bool]$Final }
            }
            if ($stream.ReadByte() -ne 255 -or $stream.ReadByte() -ne 254) { throw 'O log deve usar UTF-16 LE com BOM.' }
            $Reader.HeaderRead = $true
            $Reader.Offset = [long]2
        }
        [void]$stream.Seek($Reader.Offset, [IO.SeekOrigin]::Begin)
        # Bound work per timer tick, retaining decoder state even across odd byte boundaries.
        $bytes = [byte[]]::new(65536)
        $count = $stream.Read($bytes, 0, $bytes.Length)
        $Reader.Offset += $count
        $drained = $Final -and $Reader.Offset -eq $stream.Length
        $chars = [char[]]::new(65538)
        $length = $Reader.Decoder.GetChars($bytes, 0, $count, $chars, 0, $drained)
        $Reader.Pending += [string]::new($chars, 0, $length)
        $newline = $Reader.Pending.IndexOf("`n")
        while ($newline -ge 0) {
            $lines.Add($Reader.Pending.Substring(0, $newline).TrimEnd([char]13))
            $Reader.Pending = $Reader.Pending.Substring($newline + 1)
            $newline = $Reader.Pending.IndexOf("`n")
        }
        if ($drained) {
            if ($Reader.Pending.Length) { $lines.Add($Reader.Pending) }
            $Reader.Pending = ''
            $Reader.Finished = $true
        }
        [pscustomobject]@{ Lines = $lines.ToArray(); Drained = [bool]$drained }
    } finally { $stream.Dispose() }
}

function Reset-DesktopControls {
    param($Context)
    $idle = $null -eq $Context.Active -and !$Context.Closing
    $Context.StartButton.Enabled = $idle -and ($Context.Simulation -or
        ($Context.Game.SelectedIndex -in @(0,1,2) -and $Context.Prepared.Checked))
    $Context.Game.Enabled = $idle
    $Context.Prepared.Enabled = $idle
    $hasResult = $idle -and $null -ne $Context.LastResult -and $null -ne $Context.LastRun -and
        (Test-Path -LiteralPath $Context.LastRun -PathType Container)
    $Context.ResultButton.Enabled = $hasResult
    $Context.FolderButton.Enabled = $hasResult
}

function Start-DesktopRun {
    param([Parameter(Mandatory)]$Context)
    if ($null -ne $Context.Active -or $Context.Closing) { return }
    if (!$Context.Simulation -and (!$Context.Prepared.Checked -or $Context.Game.SelectedIndex -notin @(0,1,2))) { return }
    $selectedGame = if ($Context.Simulation) { 'zzz' } elseif ($Context.Game.SelectedIndex -eq 1) { 'hsr' } elseif ($Context.Game.SelectedIndex -eq 2) { 'genshin' } else { 'zzz' }
    $runs = if ($selectedGame -eq 'hsr') { Join-Path $Context.Root '.cache\hsr\runs' } elseif ($selectedGame -eq 'genshin') { Join-Path $Context.Root '.cache\genshin\runs' } else { $Context.RunsRoot }
    $run = Join-Path $runs ((Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0,8) + '-selection')
    $Context.LastRun = $run
    $Context.LastResult = $null
    $Context.Log.Clear()
    $Context.PathLabel.Text = "Arquivos desta execucao: $run"
    $process = $null
    try {
        if ($selectedGame -eq 'hsr') {
            foreach ($file in @('scan-hsr.ps1','hsr_scan.py','hsr_inventory.py','hsr_reader.py','scan_runtime.py')) {
                if (!(Test-Path -LiteralPath (Join-Path $Context.Root "scripts\$file") -PathType Leaf)) { throw "Ambiente HSR incompleto: $file" }
            }
        }
        if ($selectedGame -eq 'genshin') {
            foreach ($file in @('scripts\run-desktop-genshin.ps1','scripts\genshin-pilot.js','src\genshin-pilot-1280.js','src\genshin-1280.js', 'node_modules\sharp\package.json', 'node_modules\tesseract.js\package.json', '.cache\models\eng.traineddata')) {
                if (!(Test-Path -LiteralPath (Join-Path $Context.Root $file) -PathType Leaf)) { throw "Ambiente Genshin incompleto: $file. Use o repositorio preparado; pacotes anteriores nao incluem este piloto." }
            }
            if (!(Get-Command node.exe -ErrorAction SilentlyContinue)) { throw 'Node.js nao encontrado. O piloto Genshin requer o ambiente Node preparado no repositorio.' }
        }
        if ($Context.Simulation) { New-Item -ItemType Directory -Path $run -ErrorAction Stop | Out-Null }
        $info = [Diagnostics.ProcessStartInfo]::new()
        $info.FileName = Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'
        if ($Context.Simulation) {
            $info.Arguments = '-NoLogo -NoProfile -ExecutionPolicy Bypass -File "{0}" -RunDirectory "{1}" -Outcome {2} -StepMilliseconds {3}' -f `
                $script:DesktopSimulationWorker, $run, $Context.Outcome, $Context.StepMilliseconds
        } elseif ($selectedGame -eq 'genshin') {
            $info.Arguments = '-NoLogo -NoProfile -ExecutionPolicy Bypass -File "{0}" -RunDirectory "{1}"' -f `
                (Join-Path $Context.Root 'scripts\run-desktop-genshin.ps1'), $run
        } else {
            $info.Arguments = '-NoLogo -NoProfile -ExecutionPolicy Bypass -File "{0}" -RunDirectory "{1}" -Game {2}' -f `
                (Join-Path $Context.Root 'scripts\run-desktop-zzz.ps1'), $run, $selectedGame
            if ($selectedGame -eq 'hsr') { $info.Arguments += ' -MaxPositions 2000' }
        }
        $info.WorkingDirectory = $Context.Root
        $info.UseShellExecute = $false
        $info.CreateNoWindow = $true
        $info.WindowStyle = [Diagnostics.ProcessWindowStyle]::Hidden
        # No redirected pipes: progress is written to a file, so a full pipe cannot block the child.
        $process = [Diagnostics.Process]::new()
        $process.StartInfo = $info
        if (!$process.Start()) { throw 'O processo nao iniciou.' }
        $Context.Active = [pscustomobject]@{
            Process = $process; Directory = $run; Reader = New-DesktopLogReader (Join-Path $run 'console.log')
            StopRequested = $false; StopDelivered = $false; Result = $null; MonitorError = $null; Game = $selectedGame
        }
        $Context.StartCount++
        Reset-DesktopControls $Context
        $Context.StopButton.Enabled = $true
        $Context.Status.Text = if ($Context.Simulation) { 'Iniciando filho simulado...' }
                               elseif ($selectedGame -eq 'genshin') { 'Iniciando piloto Genshin. Acompanhe as instrucoes no log; F8 interrompe.' }
                               else { "Iniciando $($selectedGame.ToUpper()). Volte ao jogo e use F8 quando solicitado abaixo." }
    } catch {
        if ($null -ne $process) { $process.Dispose() }
        $Context.Status.Text = "Falha ao iniciar: $($_.Exception.Message)"
        $Context.LastResult = 'error'
        Reset-DesktopControls $Context
    }
}

function Request-DesktopStop {
    param([Parameter(Mandatory)]$Context)
    if ($null -eq $Context.Active -or $Context.Active.StopDelivered) { return }
    if ($Context.Active.Process.HasExited) { return }
    $Context.Active.StopRequested = $true
    $Context.StopButton.Enabled = $false
    $Context.Status.Text = 'Interrompendo inputs; aguarde a gravacao e leitura das imagens ja capturadas...'
    # The public probe creates the directory. Do not pre-create it and violate RunDirectory.
    if (!(Test-Path -LiteralPath $Context.Active.Directory -PathType Container)) { return }
    try {
        [IO.File]::WriteAllText((Join-Path $Context.Active.Directory 'stop.request'), 'stop')
        $Context.Active.StopDelivered = $true
    } catch {
        $Context.Status.Text = "Nao foi possivel solicitar parada: $($_.Exception.Message). O filho continua acompanhado."
    }
}

function Update-DesktopRun {
    param([Parameter(Mandatory)]$Context)
    if ($null -eq $Context.Active) { return }
    $active = $Context.Active
    $ended = $active.Process.HasExited
    if ($active.StopRequested -and !$ended -and !$active.StopDelivered) { Request-DesktopStop $Context }
    $drained = $true
    if ($null -eq $active.MonitorError) {
        try {
            $batch = Read-DesktopLog -Reader $active.Reader -Final:$ended
            $drained = $batch.Drained
            foreach ($line in $batch.Lines) {
                $Context.Log.AppendText($line + [Environment]::NewLine)
                $parts = $line.Split('|', 3)
                if ($parts[0] -eq 'RESULT' -and $parts.Length -ge 2) { $active.Result = $parts[1] }
                if (!$active.StopRequested -and $parts[0] -eq 'STATE' -and $parts.Length -eq 3) {
                    $Context.Status.Text = $parts[2]
                }
                if (!$Context.Simulation) {
                    if ($line -like 'Captura encerrada.*' -or $line -like 'Leitura *') {
                        $Context.Status.Text = if ($line -like 'Leitura *') { "Processando imagens salvas: $line" }
                                               else { 'Inputs encerrados. Processando imagens salvas; pode usar o computador.' }
                    } elseif (!$active.StopRequested -and ($line -like 'Antes de comecar:*' -or $line -like 'F8 confirmado.*' -or
                        $line -like 'Capturando *' -or $line -like 'Posicao *')) {
                        $Context.Status.Text = $line
                    }
                }
            }
        } catch {
            $active.MonitorError = $_.Exception.Message
            Request-DesktopStop $Context
            $Context.Log.AppendText("Falha ao acompanhar log: $($active.MonitorError)`r`n")
        }
    }
    if (!$ended -or !$drained) { return }
    try {
        $code = $active.Process.ExitCode
        $receipt = Join-Path $active.Directory 'exit-code.txt'
        $receiptCode = if (Test-Path -LiteralPath $receipt) { [IO.File]::ReadAllText($receipt).Trim() } else { '' }
        $result = if ($code -ne 0 -or $receiptCode -ne '0' -or $active.MonitorError) { 'error' }
                  elseif ($active.Result -eq 'partial') { 'partial' }
                  elseif ($active.Result -eq 'complete') { 'complete' }
                  else { 'error' }
        if ($Context.Simulation) {
            $Context.Status.Text = switch ($result) {
                'complete' { 'Simulacao finalizada. Nenhuma coleta ZZZ foi executada.' }
                'partial' { 'Simulacao parcial ou interrompida. Filho encerrado.' }
                default { 'Erro na simulacao. Confira o log e a pasta da tentativa.' }
            }
        } else {
            # This is the first manifest read, after the entire child process has exited.
            $failed = $code -ne 0 -or $receiptCode -ne '0' -or $null -ne $active.MonitorError
            if ($active.Game -eq 'genshin') {
                $report = $null
                $manifest = Join-Path $active.Directory 'session.json'
                if (Test-Path -LiteralPath $manifest -PathType Leaf) {
                    try { $report = Get-Content -LiteralPath $manifest -Raw -ErrorAction Stop | ConvertFrom-Json -ErrorAction Stop } catch { }
                }
                $result = if ($null -ne $report -and $report.game -eq 'genshin' -and $report.mode -eq 'pilot-1280x720' -and
                    (Test-Path -LiteralPath (Join-Path $active.Directory 'summary.md') -PathType Leaf)) { 'partial' } else { 'error' }
                $Context.Status.Text = if ($result -eq 'partial') { 'Piloto parcial encerrado. Abra o resultado para conferir as leituras.' }
                                       else { 'Falha sem resumo legivel. Confira o log e a pasta da tentativa.' }
                if ($null -ne $report) { $Context.Log.AppendText("Resultado: $($report.status); motivo: $($report.reason)`r`n") }
            } elseif ($active.Game -eq 'hsr') {
                $saved = Get-ZzzResult -RunDirectory $active.Directory -Failed:$failed -ExpectedMode 'hsr-inventory'
            } else { $saved = Get-ZzzResult -RunDirectory $active.Directory -Failed:$failed }
            if ($active.Game -ne 'genshin') {
                $expectedMode = $active.Game + '-inventory'
                $result = if ($null -eq $saved.Report -or $saved.Report.mode -ne $expectedMode) { 'error' }
                          elseif ($saved.Complete) { 'complete' } else { 'partial' }
                $Context.Status.Text = if ($result -eq 'error') { 'Falha sem resultado legivel. Confira o log e a pasta da tentativa.' }
                                       else { $saved.Message }
                if ($null -ne $saved.Report) { $Context.Log.AppendText("Resultado: $($saved.Report.status); motivo: $($saved.Report.reason)`r`n") }
            }
        }
        $Context.LastResult = $result
    } catch {
        $Context.LastResult = 'error'
        $Context.Status.Text = "Erro ao conferir termino: $($_.Exception.Message)"
    } finally {
        $active.Process.Dispose()
        $Context.Active = $null
        $Context.StopButton.Enabled = $false
        Reset-DesktopControls $Context
    }
    if ($Context.Closing) { $Context.Form.Close() }
}

function New-DesktopForm {
    param([Parameter(Mandatory)][string]$Root, [switch]$Simulation, $Installation,
          [ValidateSet('Complete', 'Partial', 'Error', 'Quick')][string]$Outcome = 'Complete',
          [ValidateRange(50, 10000)][int]$StepMilliseconds = 800)
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing
    [Windows.Forms.Application]::EnableVisualStyles()
    $rootPath = (Resolve-Path -LiteralPath $Root -ErrorAction Stop).Path
    if (!$Simulation -and $null -eq $Installation) { $Installation = Get-ZzzInstallation -Root $rootPath -Desktop }
    $form = [Windows.Forms.Form]::new()
    $form.Text = if ($Simulation) { 'Gacha OCR Lab - Simulacao P3.6' } else { 'Gacha OCR Lab' }
    $form.ClientSize = [Drawing.Size]::new(780, 620)
    $form.MinimumSize = $form.Size
    $form.StartPosition = 'CenterScreen'
    $form.Font = [Drawing.Font]::new('Segoe UI', 10)
    $game = [Windows.Forms.ComboBox]::new()
    $game.DropDownStyle = 'DropDownList'
    $game.SetBounds(16, 16, 300, 30)
    $game.Items.AddRange(@('ZZZ - W-Engines S/A 20+', 'HSR - Cones de Luz 20+ (validacao)', 'Genshin - Armas 20+ (piloto)'))
    $game.SelectedIndex = 0
    $notice = [Windows.Forms.Label]::new()
    $notice.Text = if ($Simulation) { 'Processo simulado. Nenhum jogo ou input real. F8 simulado avanca sozinho.' }
                  else { "Jogo em ingles, cliente 1280x720, escala Windows 100%.`r`nW-Engine Storage: S e A; B e especialidades desmarcados.`r`nLevel do maior para o menor. Feche o filtro e volte ao topo. Solte os controles.`r`nF8 inicia e interrompe no jogo. Clicar nesta janela durante a captura pode parar por foco." }
    $notice.SetBounds(16, 58, 744, 102)
    $prepared = [Windows.Forms.CheckBox]::new()
    $prepared.Text = 'Confirmo filtros, ordenacao, lista no topo e controles soltos.'
    $prepared.SetBounds(16, 164, 744, 32)
    $prepared.Visible = !$Simulation
    $status = [Windows.Forms.Label]::new()
    $status.Text = if ($Simulation) { 'Pronta para simular. Nao e necessario abrir o jogo ou usar F8.' }
                  else { 'Confira a preparacao acima e marque a confirmacao para iniciar.' }
    $status.SetBounds(16, 208, 744, 48)
    $start = [Windows.Forms.Button]::new()
    $start.Text = if ($Simulation) { 'Iniciar simulacao' } else { 'Iniciar coleta' }
    $start.SetBounds(16, 264, 160, 36)
    $stop = [Windows.Forms.Button]::new()
    $stop.Text = 'Interromper'
    $stop.SetBounds(188, 264, 140, 36)
    $stop.Enabled = $false
    $response = [Windows.Forms.Button]::new()
    $response.Text = 'Testar resposta: 0'
    $response.SetBounds(340, 264, 200, 36)
    $response.Visible = [bool]$Simulation
    $resultButton = [Windows.Forms.Button]::new()
    $resultButton.Text = 'Abrir resultado'
    $resultButton.SetBounds(340, 264, 140, 36)
    $resultButton.Visible = !$Simulation
    $folderButton = [Windows.Forms.Button]::new()
    $folderButton.Text = 'Abrir pasta'
    $folderButton.SetBounds(492, 264, 130, 36)
    $folderButton.Visible = !$Simulation
    $pathLabel = [Windows.Forms.Label]::new()
    $pathLabel.Text = 'Cada execucao usa uma pasta propria nesta instalacao.'
    $pathLabel.SetBounds(16, 310, 744, 48)
    $pathLabel.AutoEllipsis = $true
    $log = [Windows.Forms.TextBox]::new()
    $log.SetBounds(16, 366, 748, 238)
    $log.Multiline = $true
    $log.ReadOnly = $true
    $log.ScrollBars = 'Vertical'
    $log.Anchor = 'Top, Bottom, Left, Right'
    $form.Controls.AddRange(@($game, $notice, $prepared, $status, $start, $stop, $response, $resultButton, $folderButton, $pathLabel, $log))
    $timer = [Windows.Forms.Timer]::new()
    $timer.Interval = 100
    $context = [pscustomobject]@{
        Form = $form; Status = $status; StartButton = $start; StopButton = $stop
        ResponseButton = $response; PathLabel = $pathLabel; Log = $log; Timer = $timer
        Game = $game; Prepared = $prepared; Notice = $notice; ZzzNotice = $notice.Text
        ResultButton = $resultButton; FolderButton = $folderButton
        Root = $rootPath; Simulation = [bool]$Simulation; Installation = $Installation
        RunsRoot = if ($Simulation) { Join-Path $rootPath '.cache\desktop-simulation\runs' } else { $Installation.RunsRoot }
        Outcome = $Outcome; StepMilliseconds = $StepMilliseconds; Active = $null; Closing = $false
        ResponseCount = 0; StartCount = 0; LastRun = $null; LastResult = $null
    }
    $form.Tag = $context
    # Handlers keep their own context after this factory function returns.
    $start.Add_Click({ Start-DesktopRun $context }.GetNewClosure())
    $stop.Add_Click({ Request-DesktopStop $context }.GetNewClosure())
    $prepared.Add_CheckedChanged({ Reset-DesktopControls $context }.GetNewClosure())
    $game.Add_SelectedIndexChanged({
        $context.Prepared.Checked = $false
        if ($context.Game.SelectedIndex -eq 1) {
            $context.Notice.Text = "HSR em ingles, cliente 1280x720, escala Windows 100%. Fundo escuro no painel.`r`nInventory > Light Cone: Lv decrescente, lista no topo e primeiro Cone selecionado.`r`nSem filtro de estrelas: inclui Cones 3/4/5* nivel 20+. Solte mouse e teclado.`r`nD/A alternam o sentido por linha; S desce. F8 interrompe; mantenha HSR na frente."
            $context.Status.Text = 'HSR: percorre ate nivel abaixo de 20; limite de seguranca de 2000 posicoes. Confirme a preparacao.'
        } elseif ($context.Game.SelectedIndex -eq 2) {
            $context.Notice.Text = "Genshin em ingles, cliente 1280x720, escala Windows 100%.`r`nInventory > Weapons: Level decrescente, lista no topo e primeira arma selecionada.`r`nSem filtro que esconda 3/4/5 estrelas. Piloto de ate 10 posicoes, sem rolagem.`r`nO jogo sera ativado apos cinco segundos. F8 interrompe; mantenha os controles livres."
            $context.Status.Text = 'Piloto Genshin: confira e confirme a preparacao.'
        } else {
            $context.Notice.Text = $context.ZzzNotice
            $context.Status.Text = 'Confirme a preparacao para iniciar ZZZ.'
        }
        Reset-DesktopControls $context
    }.GetNewClosure())
    $resultButton.Add_Click({
        try { Open-ZzzResult -RunDirectory $context.LastRun }
        catch { $context.Status.Text = "Nao foi possivel abrir o resultado: $($_.Exception.Message)" }
    }.GetNewClosure())
    $folderButton.Add_Click({
        try {
            Start-Process -FilePath (Join-Path $env:WINDIR 'explorer.exe') -ArgumentList ('"{0}"' -f $context.LastRun) -ErrorAction Stop | Out-Null
        } catch { $context.Status.Text = "Nao foi possivel abrir a pasta: $($_.Exception.Message)" }
    }.GetNewClosure())
    $response.Add_Click({
        $context.ResponseCount++
        $context.ResponseButton.Text = "Testar resposta: $($context.ResponseCount)"
    }.GetNewClosure())
    $timer.Add_Tick({ Update-DesktopRun $context }.GetNewClosure())
    $form.Add_FormClosing({
        param($sender, $eventArgs)
        if ($null -ne $context.Active) {
            $eventArgs.Cancel = $true
            $context.Closing = $true
            Reset-DesktopControls $context
            Request-DesktopStop $context
        }
    }.GetNewClosure())
    $form.Add_FormClosed({ $context.Timer.Stop(); $context.Timer.Dispose() }.GetNewClosure())
    $timer.Start()
    Reset-DesktopControls $context
    return $context
}

function Invoke-DesktopLauncher {
    param([Parameter(Mandatory)][string]$Root, [switch]$Simulation, [switch]$Elevated, [switch]$Check,
          [string]$Outcome = 'Complete', [int]$StepMilliseconds = 800)
    $installation = $null
    if (!$Simulation) { $installation = Get-ZzzInstallation -Root $Root -Desktop }
    if ($Check) { return 0 }
    if (!$Simulation -and !(Test-ZzzAdministrator)) {
        if ($Elevated) { throw 'A abertura como Administrador nao foi concluida.' }
        if (!(Request-ZzzElevation -ScriptPath (Join-Path $Root 'scripts\start-desktop.ps1') -Graphical)) {
            return 2
        }
        return 0
    }
    if ([Threading.Thread]::CurrentThread.ApartmentState -ne 'STA') { throw 'Abra com powershell.exe -STA.' }
    $window = New-DesktopForm -Root $Root -Installation $installation -Simulation:$Simulation -Outcome $Outcome -StepMilliseconds $StepMilliseconds
    try { [Windows.Forms.Application]::Run($window.Form) }
    finally { $window.Form.Dispose() }
    return 0
}

if ($MyInvocation.InvocationName -ne '.') {
    try {
        $code = Invoke-DesktopLauncher -Root (Split-Path -Parent $PSScriptRoot) -Simulation:$Simulation -Elevated:$Elevated -Check:$Check -Outcome $Outcome -StepMilliseconds $StepMilliseconds
        if ($code -eq 2) {
            Add-Type -AssemblyName System.Windows.Forms
            [void][Windows.Forms.MessageBox]::Show('Abertura cancelada. Nenhuma coleta foi iniciada.', 'Gacha OCR Lab')
        }
        exit $code
    } catch {
        if ($Check) { Write-Error $_; exit 1 }
        Add-Type -AssemblyName System.Windows.Forms
        [void][Windows.Forms.MessageBox]::Show("Nao foi possivel abrir: $($_.Exception.Message)", 'Gacha OCR Lab')
        exit 1
    }
}
