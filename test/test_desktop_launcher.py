"""WinForms message loop and real simulation child; no game, elevation or OCR."""
import json
import shutil
import subprocess
import sys
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]
POWERSHELL = shutil.which('powershell.exe')
pytestmark = pytest.mark.skipif(sys.platform != 'win32' or not POWERSHELL,
                                reason='Windows PowerShell and WinForms')


def ps_string(value):
    return "'" + str(value).replace("'", "''") + "'"


def run_driver(tmp_path, body, installation_root=None):
    # Exercise both the entry and worker from paths containing spaces and apostrophes.
    root = installation_root or tmp_path / "desktop lab's copy"
    scripts = root / 'scripts'
    scripts.mkdir(parents=True, exist_ok=True)
    for name in ('start-desktop.ps1', 'desktop-simulation.ps1', 'start-zzz.ps1', 'run-desktop-zzz.ps1'):
        shutil.copyfile(ROOT / 'scripts' / name, scripts / name)
    shutil.copyfile(ROOT / 'scan-desktop.cmd', root / 'scan-desktop.cmd')
    driver = tmp_path / 'desktop-driver.ps1'
    driver.write_text("$ErrorActionPreference = 'Stop'\n"
                      "[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)\n"
                      f". {ps_string(scripts / 'start-desktop.ps1')}\n"
                      f"$testRoot = {ps_string(root)}\n" + body, encoding='utf-8-sig')
    result = subprocess.run([POWERSHELL, '-NoLogo', '-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass',
                             '-File', str(driver)], cwd=tmp_path, capture_output=True, encoding='utf-8',
                            errors='replace', timeout=25)
    assert result.returncode == 0, result.stdout + '\n' + result.stderr
    payload = [line.split('__RESULT__', 1)[1] for line in result.stdout.splitlines() if '__RESULT__' in line]
    assert payload, result.stdout + '\n' + result.stderr
    observations = json.loads(payload[-1])
    (tmp_path / 'observations.json').write_text(json.dumps(observations, indent=2), encoding='utf-8')
    return observations


def test_log_incremental_missing_bom_split_character_and_final_line(tmp_path):
    result = run_driver(tmp_path, r'''
$path = Join-Path $testRoot 'incremental.log'
$reader = New-DesktopLogReader $path
$missing = Read-DesktopLog $reader
$stream = [IO.File]::Open($path, 'Create', 'Write', 'ReadWrite')
try {
    $bytes = [Text.Encoding]::Unicode.GetBytes("a$([char]0xe7)$([char]0xe3)o`r`nsegunda")
    $stream.WriteByte(255); $stream.Flush()
    $header = Read-DesktopLog $reader
    $stream.WriteByte(254)
    # One complete character plus half of the accented character.
    $stream.Write($bytes, 0, 3); $stream.Flush()
    $incomplete = Read-DesktopLog $reader
    $stream.Write($bytes, 3, 9); $stream.Flush()
    $first = Read-DesktopLog $reader
    $stream.Write($bytes, 12, $bytes.Length - 12); $stream.Flush()
    $tail = Read-DesktopLog $reader
} finally { $stream.Dispose() }
$final = Read-DesktopLog $reader -Final
$again = Read-DesktopLog $reader -Final
Write-Output ('__RESULT__' + (@{Missing=$missing.Lines; Header=$header.Lines; Incomplete=$incomplete.Lines;
    First=$first.Lines; Tail=$tail.Lines; Final=$final.Lines; Again=$again.Lines;
    Offset=$reader.Offset; Size=(Get-Item -LiteralPath $path).Length; Drained=$final.Drained} | ConvertTo-Json -Compress))
''')
    assert all(result[key] == [] for key in ('Missing', 'Header', 'Incomplete', 'Tail', 'Again'))
    assert result['First'] == ['ação']
    assert result['Final'] == ['segunda']
    assert result['Offset'] == result['Size'] and result['Drained']


def test_log_limits_each_tick_and_rejects_truncated_encoding(tmp_path):
    result = run_driver(tmp_path, r'''
$path = Join-Path $testRoot 'large.log'
[IO.File]::WriteAllText($path, ('x' * 40000) + "`n", [Text.Encoding]::Unicode)
$reader = New-DesktopLogReader $path
$first = Read-DesktopLog $reader -Final
$firstOffset = $reader.Offset
$last = Read-DesktopLog $reader -Final
$bad = Join-Path $testRoot 'bad.log'
[IO.File]::WriteAllBytes($bad, [byte[]]@(255,254,97))
$rejected=$false
try { Read-DesktopLog (New-DesktopLogReader $bad) -Final | Out-Null } catch { $rejected=$true }
Write-Output ('__RESULT__' + (@{FirstDrained=$first.Drained; Offset=$firstOffset;
    FinalDrained=$last.Drained; Length=$last.Lines[0].Length; Rejected=$rejected} | ConvertTo-Json -Compress))
''')
    assert not result['FirstDrained'] and result['Offset'] == 65538
    assert result['FinalDrained'] and result['Length'] == 40000
    assert result['Rejected']


def test_log_retries_real_exclusive_lock_preserving_partial_character_and_final_drain(tmp_path):
    result=run_driver(tmp_path,r'''
$path=Join-Path $testRoot 'locked.log'
$reader=New-DesktopLogReader $path
$bytes=[Text.Encoding]::Unicode.GetBytes("a$([char]0xe7)`n")
$writer=[IO.File]::Open($path,'Create','Write','None')
try {
    $writer.WriteByte(255); $writer.WriteByte(254); $writer.Write($bytes,0,1); $writer.Flush()
    $locked=Read-DesktopLog $reader
    $initialOffset=$reader.Offset
} finally { $writer.Dispose() }
$partial=Read-DesktopLog $reader
$partialOffset=$reader.Offset
$writer=[IO.File]::Open($path,'Append','Write','None')
try {
    $writer.Write($bytes,1,$bytes.Length-1); $writer.Flush()
    $lockedFinal=Read-DesktopLog $reader -Final
    $lockedOffset=$reader.Offset
    $reader.SharingTimeoutMilliseconds=0
    $rejected=$false
    try { Read-DesktopLog $reader -Final | Out-Null } catch { $rejected=$true }
} finally { $writer.Dispose() }
$reader.SharingTimeoutMilliseconds=5000
$final=Read-DesktopLog $reader -Final
Write-Output ('__RESULT__'+(@{Locked=$locked.Lines;LockedDrained=$locked.Drained;InitialOffset=$initialOffset;
    Partial=$partial.Lines;PartialOffset=$partialOffset;LockedFinalDrained=$lockedFinal.Drained;
    LockedOffset=$lockedOffset;Rejected=$rejected;Final=$final.Lines;FinalDrained=$final.Drained;
    Finished=$reader.Finished;SharingWaitReset=($null -eq $reader.SharingWait)}|ConvertTo-Json -Compress))
''')
    assert result['Locked']==[] and not result['LockedDrained'] and result['InitialOffset']==0
    assert result['Partial']==[] and result['PartialOffset']==result['LockedOffset']==3
    assert not result['LockedFinalDrained'] and result['Rejected']
    assert result['Final']==['aç'] and result['FinalDrained'] and result['Finished'] and result['SharingWaitReset']


# The driver runs Application.Run, a displayed Form and its production timer/handlers.
# A second timer injects button events while the real child advances independently.
MESSAGE_LOOP = r'''
$ui = New-DesktopForm -Simulation -Root $testRoot -Outcome '__OUTCOME__' -StepMilliseconds 120
$script:pingsWhileRunning=0; $script:progressWhileRunning=$false; $script:closeWasDeferred=$false
$script:actionSent=$false; $script:driverFailure=$null; $script:shown=$false
$script:deadline=[DateTime]::UtcNow.AddSeconds(15)
$driverTimer=[Windows.Forms.Timer]::new()
$driverTimer.Interval=40
$ui.Form.Add_Shown({ $script:shown=$ui.Form.Visible; $ui.StartButton.PerformClick() })
$driverTimer.Add_Tick({
    try {
        if ([DateTime]::UtcNow -gt $script:deadline) { throw 'Message-loop test timed out' }
        if ($null -ne $ui.Active) {
            if (!$ui.Active.Process.HasExited) {
                $before=$ui.ResponseCount
                $ui.ResponseButton.PerformClick()
                if ($ui.ResponseCount -eq $before + 1) { $script:pingsWhileRunning++ }
                # Test the guard as well as the disabled button.
                $ui.StartButton.PerformClick()
                Start-DesktopRun $ui
                if ($ui.Log.Text.Contains('PROGRESS|') -and !$script:progressWhileRunning) {
                    $script:progressWhileRunning=$true
                    # A render artifact from the running Form, not a desktop screenshot.
                    $bitmap=[Drawing.Bitmap]::new($ui.Form.Width, $ui.Form.Height)
                    try {
                        $ui.Form.DrawToBitmap($bitmap, [Drawing.Rectangle]::new(0,0,$bitmap.Width,$bitmap.Height))
                        $bitmap.Save((Join-Path $testRoot 'window-running.png'), [Drawing.Imaging.ImageFormat]::Png)
                    } finally { $bitmap.Dispose() }
                }
            }
            __ACTION__
        } elseif ($ui.StartCount -gt 0) {
            $ui.Form.Close()
        }
    } catch {
        $script:driverFailure=$_.Exception.Message
        Request-DesktopStop $ui
        [Windows.Forms.Application]::ExitThread()
    }
})
$driverTimer.Start()
try { [Windows.Forms.Application]::Run($ui.Form) }
finally { $driverTimer.Stop(); $driverTimer.Dispose(); $ui.Form.Dispose() }
if ($script:driverFailure) { throw $script:driverFailure }
$dirs=@(Get-ChildItem -LiteralPath $ui.RunsRoot -Directory)
Write-Output ('__RESULT__' + (@{Result=$ui.LastResult; Starts=$ui.StartCount; Pings=$script:pingsWhileRunning;
    Progress=$script:progressWhileRunning; Run=$ui.LastRun; Directories=$dirs.Count;
    Shown=$script:shown;
    Receipt=$(if (Test-Path -LiteralPath (Join-Path $ui.LastRun 'exit-code.txt')) {
        [IO.File]::ReadAllText((Join-Path $ui.LastRun 'exit-code.txt')).Trim() } else { '' });
    Stop=(Test-Path -LiteralPath (Join-Path $ui.LastRun 'stop.request'));
    ClosedAfterChild=($null -eq $ui.Active); CloseDeferred=$script:closeWasDeferred;
    Log=$(if (Test-Path -LiteralPath (Join-Path $ui.LastRun 'console.log')) {
        [IO.File]::ReadAllText((Join-Path $ui.LastRun 'console.log')) } else { '' })} | ConvertTo-Json -Compress))
'''


@pytest.mark.parametrize('outcome,expected,receipt', [
    ('Complete', 'complete', '0'), ('Partial', 'partial', '0'),
    ('Error', 'error', '1'), ('Quick', 'complete', '0'),
])
def test_displayed_message_loop_stays_responsive_and_classifies_child(tmp_path, outcome, expected, receipt):
    body = MESSAGE_LOOP.replace('__OUTCOME__', outcome).replace('__ACTION__', '')
    result = run_driver(tmp_path, body)
    assert result['Result'] == expected and result['Receipt'] == receipt
    assert result['Starts'] == result['Directories'] == 1
    assert result['Pings'] >= 3 and result['ClosedAfterChild']
    assert result['Shown']
    assert not result['Stop']
    if outcome != 'Quick':
        assert result['Progress']


def test_displayed_loop_survives_exclusive_child_log_without_requesting_stop(tmp_path):
    setup=r'''
$worker=Join-Path $testRoot 'exclusive-child.ps1'
[IO.File]::WriteAllText($worker,@'
param($RunDirectory,$Outcome,$StepMilliseconds)
$stream=[IO.File]::Open((Join-Path $RunDirectory 'console.log'),'Create','Write','None')
$writer=[IO.StreamWriter]::new($stream,[Text.Encoding]::Unicode)
try {
    $writer.WriteLine('STATE|capturing|Child holds log');$writer.Flush()
    for ($index=0;$index -lt 6;$index++) {
        $writer.WriteLine("PROGRESS|$index");$writer.Flush()
        Start-Sleep -Milliseconds 80
    }
    $writer.WriteLine('RESULT|complete');$writer.Flush()
} finally {$writer.Dispose()}
Start-Sleep -Milliseconds 250
Set-Content -LiteralPath (Join-Path $RunDirectory 'exit-code.txt') -Value 0 -Encoding ASCII
'@,[Text.Encoding]::UTF8)
$script:DesktopSimulationWorker=$worker
'''
    body=setup+MESSAGE_LOOP.replace('__OUTCOME__','Complete').replace('__ACTION__','')
    result=run_driver(tmp_path,body)
    assert result['Result']=='complete' and result['Receipt']=='0' and not result['Stop']
    assert result['Shown'] and result['Pings']>=3 and result['Progress'] and result['ClosedAfterChild']
    assert 'Falha ao acompanhar log' not in result['Log']
    assert result['Log'].count('PROGRESS|')==6


@pytest.mark.parametrize('when,close', [('before-log', False), ('capturing', False), ('capturing', True)])
def test_simulation_stop_and_close_wait_for_the_exact_child(tmp_path, when, close):
    condition = "!(Test-Path -LiteralPath $ui.Active.Reader.Path)" if when == 'before-log' else "$ui.Log.Text.Contains('PROGRESS|')"
    action = '$ui.Form.Close(); $script:closeWasDeferred=(!$ui.Form.IsDisposed -and $null -ne $ui.Active)' if close else '$ui.StopButton.PerformClick()'
    body = MESSAGE_LOOP.replace('__OUTCOME__', 'Complete').replace('__ACTION__', f'''
if (!$script:actionSent -and ({condition})) {{
    $script:actionSent=$true
    {action}
}}
''')
    result = run_driver(tmp_path, body)
    assert result['Result'] == 'partial' and result['Receipt'] == '0'
    assert result['Starts'] == result['Directories'] == 1
    assert result['Stop'] and result['ClosedAfterChild']
    assert 'RESULT|partial' in result['Log']
    assert result['CloseDeferred'] is close


def test_child_failure_before_creating_log_is_an_error(tmp_path):
    body = ("$script:DesktopSimulationWorker = Join-Path $testRoot 'missing-worker.ps1'\n"
            + MESSAGE_LOOP.replace('__OUTCOME__', 'Complete').replace('__ACTION__', ''))
    result = run_driver(tmp_path, body)
    assert result['Result'] == 'error' and result['Receipt'] == result['Log'] == ''
    assert result['ClosedAfterChild'] and result['Starts'] == 1


def test_new_run_does_not_inherit_previous_stop_request(tmp_path):
    result = run_driver(tmp_path, r'''
$ui=New-DesktopForm -Simulation -Root $testRoot -StepMilliseconds 50
$script:firstRun=$null; $script:firstResult=$null; $script:failure=$null
$deadline=[DateTime]::UtcNow.AddSeconds(15)
$driverTimer=[Windows.Forms.Timer]::new(); $driverTimer.Interval=40
$ui.Form.Add_Shown({ $ui.StartButton.PerformClick() })
$driverTimer.Add_Tick({
    try {
        if ([DateTime]::UtcNow -gt $deadline) { throw 'Restart test timed out' }
        if ($ui.StartCount -eq 1 -and $null -ne $ui.Active) { $ui.StopButton.PerformClick() }
        if ($null -eq $ui.Active -and $ui.StartCount -eq 1) {
            $script:firstRun=$ui.LastRun; $script:firstResult=$ui.LastResult
            $ui.StartButton.PerformClick()
        } elseif ($null -eq $ui.Active -and $ui.StartCount -eq 2) { $ui.Form.Close() }
    } catch { $script:failure=$_.Exception.Message; [Windows.Forms.Application]::ExitThread() }
})
$driverTimer.Start()
try { [Windows.Forms.Application]::Run($ui.Form) }
finally { $driverTimer.Stop(); $driverTimer.Dispose(); $ui.Form.Dispose() }
if ($script:failure) { throw $script:failure }
Write-Output ('__RESULT__' + (@{First=$script:firstRun; FirstResult=$script:firstResult;
    Last=$ui.LastRun; LastResult=$ui.LastResult; Starts=$ui.StartCount;
    FirstStopped=(Test-Path -LiteralPath (Join-Path $script:firstRun 'stop.request'));
    LastStopped=(Test-Path -LiteralPath (Join-Path $ui.LastRun 'stop.request'))} | ConvertTo-Json -Compress))
''')
    assert result['Starts'] == 2 and result['First'] != result['Last']
    assert result['FirstResult'] == 'partial' and result['LastResult'] == 'complete'
    assert result['FirstStopped'] and not result['LastStopped']


def test_stop_after_child_exit_does_not_turn_completion_into_error(tmp_path):
    body = MESSAGE_LOOP.replace('__OUTCOME__', 'Quick').replace('__ACTION__', r'''
if ($ui.Active.Process.HasExited) {
    Request-DesktopStop $ui
    Update-DesktopRun $ui
}
''').replace("$ui.Form.Add_Shown({ $script:shown=$ui.Form.Visible; $ui.StartButton.PerformClick() })",
             "$ui.Timer.Stop()\n$ui.Form.Add_Shown({ $script:shown=$ui.Form.Visible; $ui.StartButton.PerformClick() })")
    result = run_driver(tmp_path, body)
    assert result['Result'] == 'complete' and not result['Stop']


@pytest.mark.parametrize('complete,fail,expected', [(True, False, 'complete'), (False, False, 'partial'),
                                                 (False, True, 'partial')])
def test_real_entry_uses_public_scan_flags_and_reads_only_after_exit(tmp_path, complete, fail, expected):
    from test_zzz_launcher import installation, stub_scan
    root = installation(tmp_path)
    stub_scan(root, complete=complete, fail=fail)
    body = MESSAGE_LOOP.replace('New-DesktopForm -Simulation', 'New-DesktopForm')
    body = body.replace('__OUTCOME__', 'Complete').replace('__ACTION__', '')
    body = body.replace('$ui.Form.Add_Shown({', '$ui.Prepared.Checked=$true\n$ui.Form.Add_Shown({')
    body = (r'''
$script:readCount=0
$script:originalResult=${function:Get-ZzzResult}
function Get-ZzzResult {
    param($RunDirectory, [switch]$Failed)
    if (!$ui.Active.Process.HasExited) { throw 'Manifest was read while child was still active' }
    $script:readCount++
    & $script:originalResult -RunDirectory $RunDirectory -Failed:$Failed
}
''' + body)
    result = run_driver(tmp_path, body, installation_root=root)
    invocation = json.loads((root / 'invocation.json').read_text(encoding='utf-8-sig'))
    assert all(invocation[name] for name in ('Inventory', 'SAFilterPrepared', 'LevelDescendingPrepared', 'Run'))
    assert invocation['RunDirectory'] == result['Run']
    assert Path(result['Run']).parent == root / '.cache/youkai-p1/runs'
    assert result['Result'] == expected and result['ClosedAfterChild']
    assert not result['Stop']


def test_game_change_requires_new_preparation_and_result_opens_only_exact_run(tmp_path):
    from test_zzz_launcher import installation
    root = installation(tmp_path)
    result = run_driver(tmp_path, r'''
$ui=New-DesktopForm -Root $testRoot
$initial=$ui.StartButton.Enabled
Start-DesktopRun $ui
$withoutPreparation=$ui.StartCount
$ui.Prepared.Checked=$true
$confirmed=$ui.StartButton.Enabled
$ui.Game.SelectedIndex=1
Start-DesktopRun $ui
$hsr=$ui.StartCount
$hsrEnabled=$ui.StartButton.Enabled
$ui.Game.SelectedIndex=0
$cleared=(!$ui.Prepared.Checked)
$run=Join-Path $ui.RunsRoot 'own-completed-run'
New-Item -ItemType Directory -Path $run | Out-Null
$ui.LastRun=$run; $ui.LastResult='partial'
$script:opened=$null
function Open-ZzzResult { param($RunDirectory) $script:opened=$RunDirectory }
$ui.Form.Add_Shown({ Reset-DesktopControls $ui; $ui.ResultButton.PerformClick(); $ui.Form.Close() })
try { [Windows.Forms.Application]::Run($ui.Form) } finally { $ui.Form.Dispose() }
Write-Output ('__RESULT__' + (@{Initial=$initial; WithoutPreparation=$withoutPreparation; Confirmed=$confirmed;
    HsrStarts=$hsr; HsrEnabled=$hsrEnabled; Cleared=$cleared; Opened=$script:opened; Run=$run} | ConvertTo-Json -Compress))
''', installation_root=root)
    assert result['WithoutPreparation'] == result['HsrStarts'] == 0
    assert not result['Initial'] and not result['HsrEnabled']
    assert result['Confirmed'] and result['Cleared']
    assert result['Opened'] == result['Run']


@pytest.mark.parametrize('check,elevated,expected', [(False, False, 2), (True, False, 0), (False, True, 1)])
def test_desktop_elevation_cancellation_check_and_recursion_guard(tmp_path, check, elevated, expected):
    from test_zzz_launcher import installation
    root = installation(tmp_path)
    result = run_driver(tmp_path, r'''
$script:elevations=0; $script:graphical=$false
function Test-ZzzAdministrator { return $false }
function Request-ZzzElevation { param($ScriptPath,[switch]$Graphical)
    $script:elevations++; $script:graphical=[bool]$Graphical; return $false }
$code=1
try { $code=Invoke-DesktopLauncher -Root $testRoot __FLAGS__ } catch { $code=1 }
Write-Output ('__RESULT__' + (@{Code=$code; Elevations=$script:elevations; Graphical=$script:graphical} | ConvertTo-Json -Compress))
'''.replace('__FLAGS__', ('-Check' if check else '') + (' -Elevated' if elevated else '')), installation_root=root)
    assert result['Code'] == expected
    assert result['Elevations'] == (0 if check or elevated else 1)
    assert list((root / '.cache/youkai-p1/runs').iterdir()) == []


def test_graphical_elevation_quotes_path_and_preserves_sta(tmp_path):
    result = run_driver(tmp_path, r'''
$script:call=$null
function Start-Process { [CmdletBinding()] param($FilePath,$ArgumentList,$Verb,$WindowStyle)
    $script:call=@{Args=$ArgumentList; Verb=$Verb; Style=$WindowStyle} }
$path=Join-Path $testRoot 'scripts\start-desktop.ps1'
$started=Request-ZzzElevation -ScriptPath $path -Graphical
Write-Output ('__RESULT__' + (@{Started=$started; Call=$script:call; Path=$path} | ConvertTo-Json -Compress -Depth 4))
''')
    assert result['Started'] and result['Call']['Verb'] == 'RunAs'
    assert result['Call']['Style'] == 'Hidden'
    assert '-STA' in result['Call']['Args'] and '-Elevated' in result['Call']['Args']
    assert f'"{result["Path"]}"' in result['Call']['Args']


def test_close_before_probe_creates_directory_delivers_stop_without_precreating_it(tmp_path):
    from test_zzz_launcher import installation
    root = installation(tmp_path)
    (root / 'scripts/scan-zzz.ps1').write_text(r'''
param([switch]$Inventory,[switch]$SAFilterPrepared,[switch]$LevelDescendingPrepared,[switch]$Run,[string]$RunDirectory)
$ErrorActionPreference='Stop'
Start-Sleep -Milliseconds 500
if (Test-Path -LiteralPath $RunDirectory) { throw 'UI must not create the scanner directory' }
New-Item -ItemType Directory -Path $RunDirectory | Out-Null
$writer=[IO.StreamWriter]::new((Join-Path $RunDirectory 'console.log'),$false,[Text.Encoding]::Unicode)
$writer.AutoFlush=$true
$writer.WriteLine('Antes de comecar: F8 (stub).')
$deadline=[DateTime]::UtcNow.AddSeconds(5)
while (!(Test-Path -LiteralPath (Join-Path $RunDirectory 'stop.request'))) {
    if ([DateTime]::UtcNow -gt $deadline) { throw 'Stop was never delivered' }
    Start-Sleep -Milliseconds 50
}
$writer.WriteLine('Captura encerrada. Processando imagens salvas (stub).')
Start-Sleep -Milliseconds 200
$writer.Dispose()
@{mode='zzz-inventory';status='stopped';scopeComplete=$false;coverageConfirmed=$false;
    reason='external-stop-requested'} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $RunDirectory 'session.json') -Encoding UTF8
Set-Content -LiteralPath (Join-Path $RunDirectory 'exit-code.txt') -Value 0 -Encoding ASCII
''', encoding='utf-8-sig')
    body = MESSAGE_LOOP.replace('New-DesktopForm -Simulation', 'New-DesktopForm')
    body = body.replace('__OUTCOME__', 'Complete').replace('__ACTION__', r'''
if (!$script:actionSent -and !(Test-Path -LiteralPath $ui.Active.Directory)) {
    $script:actionSent=$true
    $ui.Form.Close()
    $script:closeWasDeferred=(!$ui.Form.IsDisposed -and $null -ne $ui.Active)
}
''')
    body = body.replace('$ui.Form.Add_Shown({', '$ui.Prepared.Checked=$true\n$ui.Form.Add_Shown({')
    result = run_driver(tmp_path, body, installation_root=root)
    assert result['Result'] == 'partial' and result['Stop']
    assert result['ClosedAfterChild'] and result['CloseDeferred']
    assert result['Starts'] == result['Directories'] == 1


def test_failed_new_start_never_reopens_a_previous_success(tmp_path):
    from test_zzz_launcher import installation
    root = installation(tmp_path)
    result = run_driver(tmp_path, r'''
$ui=New-DesktopForm -Root $testRoot
$old=Join-Path $ui.RunsRoot 'older-success'
New-Item -ItemType Directory -Path $old | Out-Null
Set-Content -LiteralPath (Join-Path $old 'summary.md') -Value 'Preserve this old session.'
$ui.LastRun=$old; $ui.LastResult='complete'; $ui.Prepared.Checked=$true
$ui.Root=Join-Path $testRoot 'missing-working-directory'
Start-DesktopRun $ui
$result=@{Old=$old; Run=$ui.LastRun; Result=$ui.LastResult; OpenEnabled=$ui.ResultButton.Enabled; Starts=$ui.StartCount}
$ui.Timer.Dispose(); $ui.Form.Dispose()
Write-Output ('__RESULT__' + ($result | ConvertTo-Json -Compress))
''', installation_root=root)
    assert result['Run'] != result['Old'] and result['Result'] == 'error'
    assert result['Starts'] == 0 and not result['OpenEnabled']
