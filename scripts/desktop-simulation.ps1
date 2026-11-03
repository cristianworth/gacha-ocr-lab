[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$RunDirectory,
    [ValidateSet('Complete', 'Partial', 'Error', 'Quick')][string]$Outcome = 'Complete',
    [ValidateRange(50, 10000)][int]$StepMilliseconds = 800
)

# This child exercises orchestration only. It never imports or controls the scanner.
$ErrorActionPreference = 'Stop'
$stopPath = Join-Path $RunDirectory 'stop.request'
$writer = $null
$code = 1
function Wait-SimulationStep {
    $deadline = [DateTime]::UtcNow.AddMilliseconds($StepMilliseconds)
    do {
        if (Test-Path -LiteralPath $stopPath) { throw [OperationCanceledException]::new('simulation-stop') }
        Start-Sleep -Milliseconds 50
    } while ([DateTime]::UtcNow -lt $deadline)
}
try {
    # Delay creation too: the parent must tolerate a log that does not exist yet.
    if ($Outcome -ne 'Quick') { Wait-SimulationStep }
    $writer = [IO.StreamWriter]::new((Join-Path $RunDirectory 'console.log'), $false, [Text.Encoding]::Unicode)
    $writer.AutoFlush = $true
    if ($Outcome -ne 'Quick') {
        $writer.WriteLine('STATE|waiting|Aguardando F8 simulado; nenhuma tecla ou jogo e necessario.')
        Wait-SimulationStep
        $writer.Write('STATE|capturing|Captura simulada: ')
        Wait-SimulationStep
        $writer.WriteLine('preparacao concluida.')
        for ($index = 1; $index -le 3; $index++) {
            Wait-SimulationStep
            $writer.WriteLine("PROGRESS|Posicao simulada $index salva.")
        }
        $writer.WriteLine('STATE|processing|Processando imagens simuladas; nenhum input real.')
        Wait-SimulationStep
    }
    if ($Outcome -eq 'Error') { throw 'Falha simulada do processo filho.' }
    $writer.WriteLine("RESULT|$(if ($Outcome -eq 'Partial') { 'partial' } else { 'complete' })")
    $code = 0
} catch [OperationCanceledException] {
    if ($null -eq $writer) {
        $writer = [IO.StreamWriter]::new((Join-Path $RunDirectory 'console.log'), $false, [Text.Encoding]::Unicode)
        $writer.AutoFlush = $true
    }
    $writer.WriteLine('STATE|stopping|Parada simulada recebida; aguardando fechamento do filho.')
    Start-Sleep -Milliseconds 400
    $writer.WriteLine('RESULT|partial')
    $code = 0
} catch {
    if ($null -ne $writer) { $writer.WriteLine("ERROR|$($_.Exception.Message)") }
} finally {
    if ($null -ne $writer) { $writer.Dispose() }
    Set-Content -LiteralPath (Join-Path $RunDirectory 'exit-code.txt') -Value $code -Encoding ASCII
}
exit $code
