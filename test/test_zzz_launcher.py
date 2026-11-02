"""Double-click launcher orchestration with PowerShell stubs; no game, UAC or app opening."""
import json
import shutil
import subprocess
import sys
from pathlib import Path

import pytest


LAUNCHER = Path(__file__).resolve().parents[1] / 'scripts/start-zzz.ps1'
SOURCE_SHA = '86a8b34511c86ec864d8f40c558789f7ccad4cc9'
pytestmark = pytest.mark.skipif(sys.platform != 'win32' or not shutil.which('powershell.exe'),
                                reason='Windows PowerShell launcher')


def ps_string(value):
    return "'" + str(value).replace("'", "''") + "'"


def run_powershell(tmp_path, body):
    assert LAUNCHER.exists(), 'Root must finish scripts/start-zzz.ps1 before these tests run'
    driver = tmp_path / 'launcher-driver.ps1'
    driver.write_text("$ErrorActionPreference = 'Stop'\n"
                      "[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)\n"
                      f". {ps_string(LAUNCHER)}\n" + body, encoding='utf-8-sig')
    result = subprocess.run(['powershell.exe', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', str(driver)],
                            input='', capture_output=True, encoding='utf-8', errors='replace', timeout=25)
    assert result.returncode == 0, result.stdout + '\n' + result.stderr
    payloads = [line.split('__RESULT__', 1)[1] for line in result.stdout.splitlines() if '__RESULT__' in line]
    assert payloads, result.stdout + '\n' + result.stderr
    return json.loads(payloads[-1])


def installation(tmp_path):
    root = tmp_path / "ZZZ lab with spaces and apostrophe's"
    paths = ['scripts/scan-zzz.ps1', 'scripts/probe-youkai.ps1', 'scripts/youkai_selection.py',
             'scripts/zzz_inventory.py', 'scripts/zzz_pilot.py', 'scripts/zzz_transition.py',
             '.cache/youkai-p1/.venv/Scripts/python.exe', '.cache/youkai-p1/tesseract/tesseract.exe',
             '.cache/youkai-p1/tesseract/tessdata/eng.traineddata',
             f'.cache/youkai-p1/youkai-{SOURCE_SHA}/src/youkai_ocr/wengine_scanner.py']
    for name in paths:
        path = root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text('# launcher fixture\n', encoding='utf-8')
    (root / '.cache/youkai-p1/runs').mkdir()
    return root


def stub_scan(root, *, complete=True, fail=False, artifacts=True):
    report = {'schemaVersion': 1, 'mode': 'zzz-inventory', 'status': 'scope-captured' if complete else 'stopped',
              'reason': 'level-cutoff-reached' if complete else 'game-focus-lost',
              'scopeComplete': complete, 'coverageConfirmed': complete, 'captureComplete': False,
              'inventoryAccepted': False, 'inventorySummary': {'eligiblePositions': 34 if complete else 2}}
    script = ("param([switch]$Inventory, [switch]$SAFilterPrepared, [switch]$LevelDescendingPrepared, "
              "[switch]$Run, [string]$RunDirectory)\n"
              "$ErrorActionPreference = 'Stop'\n"
              "$root = Split-Path -Parent $PSScriptRoot\n"
              "@{ Inventory = [bool]$Inventory; SAFilterPrepared = [bool]$SAFilterPrepared; "
              "LevelDescendingPrepared = [bool]$LevelDescendingPrepared; Run = [bool]$Run; "
              "RunDirectory = $RunDirectory } | ConvertTo-Json | Set-Content -LiteralPath "
              "(Join-Path $root 'invocation.json') -Encoding UTF8\n")
    script += "Write-Output 'Stub progress: no game inputs'\n"
    if artifacts:
        script += ("New-Item -ItemType Directory -Path $RunDirectory | Out-Null\n"
                   f"Set-Content -LiteralPath (Join-Path $RunDirectory 'session.json') -Value {ps_string(json.dumps(report))} -Encoding UTF8\n"
                   "Set-Content -LiteralPath (Join-Path $RunDirectory 'summary.md') -Value '# Stub summary' -Encoding UTF8\n"
                   f"Set-Content -LiteralPath (Join-Path $RunDirectory 'exit-code.txt') -Value {1 if fail else 0} -Encoding ASCII\n")
    if fail:
        script += "throw 'Stub scan failed after preserving partial artifacts'\n"
    (root / 'scripts/scan-zzz.ps1').write_text(script, encoding='utf-8-sig')


def invoke_driver(root, *, check=False, administrator=True, prepared=True, elevation=False):
    return (f"$root = {ps_string(root)}\n"
            "$global:opened = @()\n"
            f"function Test-ZzzAdministrator {{ return ${str(administrator).lower()} }}\n"
            f"function Read-ZzzPreparation {{ return ${str(prepared).lower()} }}\n"
            f"function Request-ZzzElevation {{ param([string]$ScriptPath) return ${str(elevation).lower()} }}\n"
            "function Open-ZzzResult { param([string]$RunDirectory) $global:opened += $RunDirectory }\n"
            f"$code = Invoke-ZzzLauncher -Root $root{' -Check' if check else ''}\n"
            "Write-Output ('__RESULT__' + (@{ Code = $code; Opened = @($global:opened) } | ConvertTo-Json -Compress))\n")


def test_launcher_invokes_exact_short_scan_and_opens_its_own_run_with_spaced_root(tmp_path):
    root = installation(tmp_path)
    stub_scan(root)
    result = run_powershell(tmp_path, invoke_driver(root))
    invocation = json.loads((root / 'invocation.json').read_text(encoding='utf-8-sig'))
    assert all(invocation[name] is True for name in ('Inventory', 'SAFilterPrepared', 'LevelDescendingPrepared', 'Run'))
    run = Path(invocation['RunDirectory'])
    assert run.parent == root / '.cache/youkai-p1/runs'
    assert result['Code'] == 0 and result['Opened'] == [str(run)]
    assert (run / 'summary.md').is_file()


def test_launcher_treats_incomplete_report_as_partial_even_when_scanner_exits_zero(tmp_path):
    root = installation(tmp_path)
    stub_scan(root, complete=False)
    result = run_powershell(tmp_path, invoke_driver(root))
    invocation = json.loads((root / 'invocation.json').read_text(encoding='utf-8-sig'))
    assert result['Code'] != 0
    assert result['Opened'] == [invocation['RunDirectory']]


def test_launcher_opens_preserved_partial_after_scanner_throws(tmp_path):
    root = installation(tmp_path)
    stub_scan(root, complete=False, fail=True)
    result = run_powershell(tmp_path, invoke_driver(root))
    invocation = json.loads((root / 'invocation.json').read_text(encoding='utf-8-sig'))
    assert result['Code'] != 0
    assert result['Opened'] == [invocation['RunDirectory']]


def test_missing_result_never_opens_an_unrelated_older_session(tmp_path):
    root = installation(tmp_path)
    stub_scan(root, artifacts=False)
    older = root / '.cache/youkai-p1/runs/older-success'
    older.mkdir()
    (older / 'summary.md').write_text('Do not open this unrelated result')
    (older / 'session.json').write_text('{"scopeComplete":true,"coverageConfirmed":true}')
    result = run_powershell(tmp_path, invoke_driver(root))
    assert result['Code'] != 0 and result['Opened'] == []


def test_check_validates_installation_without_elevation_preparation_scan_or_open(tmp_path):
    root = installation(tmp_path)
    body = (f"$root = {ps_string(root)}\n"
            "function Test-ZzzAdministrator { throw 'Check must not inspect elevation' }\n"
            "function Read-ZzzPreparation { throw 'Check must not ask preparation' }\n"
            "function Request-ZzzElevation { param($ScriptPath) throw 'Check must not elevate' }\n"
            "function Open-ZzzResult { param($RunDirectory) throw 'Check must not open apps' }\n"
            "$code = Invoke-ZzzLauncher -Root $root -Check\n"
            "Write-Output ('__RESULT__' + (@{Code=$code} | ConvertTo-Json -Compress))\n")
    result = run_powershell(tmp_path, body)
    assert result['Code'] == 0 and not (root / 'invocation.json').exists()
    assert list((root / '.cache/youkai-p1/runs').iterdir()) == []


def test_preparation_cancellation_starts_no_scan(tmp_path):
    root = installation(tmp_path)
    result = run_powershell(tmp_path, invoke_driver(root, prepared=False))
    assert result['Code'] == 0 and result['Opened'] == []
    assert not (root / 'invocation.json').exists()


def test_missing_dependency_is_reported_before_elevation_or_scan(tmp_path):
    root = installation(tmp_path)
    (root / '.cache/youkai-p1/tesseract/tessdata/eng.traineddata').unlink()
    result = run_powershell(tmp_path, invoke_driver(root, check=True, administrator=False))
    assert result['Code'] == 1 and result['Opened'] == []
    assert not (root / 'invocation.json').exists()


def test_elevation_uses_quoted_script_path_and_visible_powershell(tmp_path):
    script = tmp_path / "path with spaces and apostrophe's" / 'start-zzz.ps1'
    body = ("$global:call=$null\n"
            "function Start-Process { [CmdletBinding()] param($FilePath,$ArgumentList,$Verb,$WindowStyle) "
            "$global:call=@{FilePath=$FilePath;Arguments=$ArgumentList;Verb=$Verb;WindowStyle=$WindowStyle} }\n"
            f"$started=Request-ZzzElevation -ScriptPath {ps_string(script)}\n"
            "Write-Output ('__RESULT__' + (@{Started=$started;Call=$global:call} | ConvertTo-Json -Compress -Depth 4))\n")
    result = run_powershell(tmp_path, body)
    assert result['Started'] is True
    assert result['Call']['Verb'] == 'RunAs' and result['Call']['WindowStyle'] == 'Normal'
    assert f'"{script}"' in result['Call']['Arguments']
    assert '-File' in result['Call']['Arguments'] and '-Elevated' in result['Call']['Arguments']


@pytest.mark.parametrize('error_code,cancelled', [(1223, True), (5, False)])
def test_elevation_only_treats_windows_user_cancellation_as_cancel(tmp_path, error_code, cancelled):
    body = (f"function Start-Process {{ [CmdletBinding()] param($FilePath,$ArgumentList,$Verb,$WindowStyle) "
            f"throw [ComponentModel.Win32Exception]::new({error_code}) }}\n"
            "$raised=$false; $started=$null\n"
            "try { $started=Request-ZzzElevation -ScriptPath 'D:\\lab with spaces\\start-zzz.ps1' } catch { $raised=$true }\n"
            "Write-Output ('__RESULT__' + (@{Started=$started;Raised=$raised} | ConvertTo-Json -Compress))\n")
    result = run_powershell(tmp_path, body)
    assert result['Raised'] is (not cancelled)
    if cancelled:
        assert result['Started'] is False


def test_uac_cancellation_starts_no_scan(tmp_path):
    root = installation(tmp_path)
    result = run_powershell(tmp_path, invoke_driver(root, administrator=False, elevation=False))
    assert result['Code'] == 0 and result['Opened'] == []
    assert not (root / 'invocation.json').exists()


def test_preparation_eof_is_cancellation_instead_of_starting_scan(tmp_path):
    result = run_powershell(tmp_path, "$ready = Read-ZzzPreparation\nWrite-Output ('__RESULT__' + (@{Ready=$ready} | ConvertTo-Json -Compress))\n")
    assert result['Ready'] is False


def test_failed_invocation_cannot_be_reported_complete_by_saved_json(tmp_path):
    run = tmp_path / 'failed invocation with success-shaped JSON'
    run.mkdir()
    (run / 'session.json').write_text(json.dumps({'mode': 'zzz-inventory', 'status': 'scope-captured', 'scopeComplete': True,
                                                'coverageConfirmed': True, 'inventoryAccepted': False}))
    result = run_powershell(tmp_path,
                            f"$normal = Get-ZzzResult -RunDirectory {ps_string(run)}\n"
                            f"$result = Get-ZzzResult -RunDirectory {ps_string(run)} -Failed\n"
                            "Write-Output ('__RESULT__' + (@{Complete=$result.Complete; NormalComplete=$normal.Complete} | ConvertTo-Json -Compress))\n")
    assert result['NormalComplete'] is True and result['Complete'] is False


@pytest.mark.parametrize('available,expected', [('summary', 'notepad'), ('review', 'review'), ('folder', 'folder'), ('none', 'none')])
def test_result_opener_chooses_only_exact_session_artifacts(tmp_path, available, expected):
    run = tmp_path / "run with spaces and apostrophe's"
    if available != 'none':
        run.mkdir()
    if available == 'summary':
        (run / 'summary.md').write_text('# Summary')
    if available in ('summary', 'review'):
        (run / 'review.html').write_text('<p>Review</p>')
    body = ("$global:launches=@()\n"
            "function Start-Process { [CmdletBinding()] param([string]$FilePath, $ArgumentList) "
            "$global:launches += @{FilePath=$FilePath; Arguments=$ArgumentList} }\n"
            f"Open-ZzzResult -RunDirectory {ps_string(run)}\n"
            "Write-Output ('__RESULT__' + (@{Launches=@($global:launches)} | ConvertTo-Json -Compress))\n")
    calls = run_powershell(tmp_path, body)['Launches']
    if expected == 'none':
        assert calls == []
    else:
        assert len(calls) == 1
        if expected == 'notepad':
            assert Path(calls[0]['FilePath']).name.lower() == 'notepad.exe'
            assert calls[0]['Arguments'] == f'"{run / "summary.md"}"'
        elif expected == 'review':
            assert calls[0]['FilePath'] == str(run / 'review.html')
        else:
            assert Path(calls[0]['FilePath']).name.lower() == 'explorer.exe'
            assert calls[0]['Arguments'] == f'"{run}"'


def test_result_opener_falls_back_to_exact_directory_when_both_file_openers_fail(tmp_path):
    run = tmp_path / 'fallback run with spaces'
    run.mkdir()
    (run / 'summary.md').write_text('# Summary')
    (run / 'review.html').write_text('<p>Review</p>')
    body = ("$global:launches=@()\n"
            "function Start-Process { [CmdletBinding()] param([string]$FilePath, $ArgumentList) "
            "$global:launches += @{FilePath=$FilePath; Arguments=$ArgumentList}; "
            "if ($FilePath -notlike '*explorer.exe') { throw 'No file association or editor available' } }\n"
            f"Open-ZzzResult -RunDirectory {ps_string(run)}\n"
            "Write-Output ('__RESULT__' + (@{Launches=@($global:launches)} | ConvertTo-Json -Compress))\n")
    calls = run_powershell(tmp_path, body)['Launches']
    assert len(calls) == 3
    assert Path(calls[0]['FilePath']).name.lower() == 'notepad.exe'
    assert calls[1]['FilePath'] == str(run / 'review.html')
    assert Path(calls[2]['FilePath']).name.lower() == 'explorer.exe'
    assert calls[2]['Arguments'] == f'"{run}"'


@pytest.mark.parametrize('location', ['outside', 'nested', 'existing'])
def test_real_probe_rejects_output_outside_new_direct_child_before_native_invocation(tmp_path, location):
    root = installation(tmp_path)
    probe = root / 'scripts/probe-youkai.ps1'
    shutil.copyfile(LAUNCHER.parent / 'probe-youkai.ps1', probe)
    runs = root / '.cache/youkai-p1/runs'
    destination = root / 'outside run' if location == 'outside' else runs / 'parent' / 'nested run'
    marker = None
    if location == 'existing':
        destination = runs / 'existing run'
        destination.mkdir()
        marker = destination / 'preserved.md'
        marker.write_text('Keep existing evidence')
    result = run_powershell(tmp_path,
                            f"try {{ & {ps_string(probe)} -RunDirectory {ps_string(destination)}; "
                            "throw 'Expected output-path rejection' } catch { "
                            "Write-Output ('__RESULT__' + (@{Error=$_.Exception.Message} | ConvertTo-Json -Compress)) }\n")
    assert 'RunDirectory must be a new direct child' in result['Error']
    if marker is not None:
        assert marker.read_text() == 'Keep existing evidence'
        assert list(destination.iterdir()) == [marker]
    else:
        assert not destination.exists()
    assert not (root / '.cache/youkai-p1/tmp').exists()
