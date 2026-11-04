"""HSR real app routing and its guarded output contract, using a child stub."""
import json
import base64
import os
import shutil
import subprocess
import importlib.util
import sys
from pathlib import Path

import pytest

from test_desktop_launcher import ROOT, MESSAGE_LOOP, run_driver
from test_zzz_launcher import installation


@pytest.mark.parametrize('with_image',[False,True])
def test_packaged_self_check_dispatch_stays_offline(monkeypatch,with_image):
    spec=importlib.util.spec_from_file_location('hsr_worker_check',ROOT/'packaging/zzz_worker.py')
    worker=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(worker)
    calls=[]
    monkeypatch.setattr(worker,'self_check',lambda cache,image:calls.append((cache,image)) or 0)
    arguments=['worker.exe','--self-check','cache path']+(['image path.png'] if with_image else [])
    monkeypatch.setattr(sys,'argv',arguments)
    assert worker.main()==0
    assert calls==[(Path('cache path'),Path('image path.png') if with_image else None)]


def test_hsr_game_routes_to_its_own_child_and_cannot_accept_a_zzz_manifest(tmp_path):
    root = installation(tmp_path)
    for name in ('scan-hsr.ps1','hsr_scan.py','hsr_inventory.py','hsr_reader.py','scan_runtime.py'):
        (root/'scripts'/name).write_text('# HSR fixture only')
    (root/'scripts/scan-hsr.ps1').write_text(r'''
param([string]$RunDirectory,[switch]$Prepared,[int]$MaxPositions)
$ErrorActionPreference='Stop'
if (Test-Path -LiteralPath $RunDirectory) { throw 'UI pre-created HSR run' }
New-Item -ItemType Directory -Path $RunDirectory -Force | Out-Null
@{RunDirectory=$RunDirectory;Prepared=[bool]$Prepared;MaxPositions=$MaxPositions} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path (Split-Path -Parent $PSScriptRoot) 'hsr-call.json') -Encoding UTF8
@{mode='zzz-inventory';status='scope-captured';scopeComplete=$true;coverageConfirmed=$true} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $RunDirectory 'session.json') -Encoding UTF8
Set-Content -LiteralPath (Join-Path $RunDirectory 'exit-code.txt') -Value 0 -Encoding ASCII
''',encoding='utf-8-sig')
    # The existing message-loop driver must inspect HSR's exact runs folder.
    body = MESSAGE_LOOP.replace('New-DesktopForm -Simulation','New-DesktopForm')
    body = body.replace('__OUTCOME__','Complete').replace('__ACTION__','')
    body = body.replace('$ui.Form.Add_Shown({',
                        "$ui.Game.SelectedIndex=1\n$ui.Prepared.Checked=$true\n$ui.RunsRoot=Join-Path $testRoot '.cache\\hsr\\runs'\n$ui.Form.Add_Shown({")
    result = run_driver(tmp_path,body,installation_root=root)
    invocation=json.loads((root/'hsr-call.json').read_text(encoding='utf-8-sig'))
    assert invocation['Prepared'] and invocation['RunDirectory']==result['Run']
    assert invocation['MaxPositions']==2000
    assert Path(result['Run']).parent==root/'.cache/hsr/runs'
    assert result['Result']=='error', 'Wrong game manifest is not a usable result'


def test_hsr_script_rejects_existing_or_external_output_before_starting_worker(tmp_path):
    import shutil
    root=installation(tmp_path)
    script=root/'scripts/scan-hsr.ps1'
    shutil.copyfile(ROOT/'scripts/scan-hsr.ps1',script)
    destination=root/'.cache/hsr/runs/existing'
    destination.mkdir(parents=True)
    (destination/'preserved.md').write_text('Keep this evidence')
    result=subprocess.run(['powershell.exe','-NoProfile','-ExecutionPolicy','Bypass','-File',str(script),
                           '-RunDirectory',str(destination),'-Prepared'],capture_output=True,timeout=15)
    assert result.returncode!=0
    assert list(destination.iterdir())==[destination/'preserved.md']
    assert (destination/'preserved.md').read_text()=='Keep this evidence'


@pytest.fixture(scope='module')
def argument_worker(tmp_path_factory):
    directory=tmp_path_factory.mktemp('hsr-native-arguments')
    source=directory/'Arguments.cs'
    source.write_text(r'''
using System;
using System.Text;
class Arguments {
    static int Main(string[] args) {
        foreach (string arg in args) Console.WriteLine("ARG|"+Convert.ToBase64String(Encoding.UTF8.GetBytes(arg)));
        if (Environment.GetEnvironmentVariable("HSR_TEST_NATIVE_FAIL")=="1") {
            Console.Error.WriteLine("hsr-test-native-startup-error");
            return 2;
        }
        return 0;
    }
}
''',encoding='utf-8')
    compiler=Path(os.environ['WINDIR'])/'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
    if not compiler.exists():
        compiler=Path(os.environ['WINDIR'])/'Microsoft.NET/Framework/v4.0.30319/csc.exe'
    exe=directory/'arguments.exe'
    subprocess.run([str(compiler),'/nologo','/target:exe',f'/out:{exe}',str(source)],capture_output=True,check=True,timeout=20)
    return exe


@pytest.mark.parametrize('portable',[False,True])
def test_hsr_real_native_arguments_remain_separate_with_spaced_installation(tmp_path,argument_worker,portable):
    root=installation(tmp_path)
    script=root/'scripts/scan-hsr.ps1'
    shutil.copyfile(ROOT/'scripts/scan-hsr.ps1',script)
    (root/'scripts/hsr_scan.py').write_text('# Argument fixture; not executed')
    if portable:
        (root/'portable-build.json').write_text('{}')
        worker=root/'runtime/zzz-worker/zzz-worker.exe'
        worker.parent.mkdir(parents=True)
    else:
        worker=root/'.cache/youkai-p1/.venv/Scripts/python.exe'
    shutil.copyfile(argument_worker,worker)
    run=root/'.cache/hsr/runs/native-arguments'
    result=subprocess.run(['powershell.exe','-NoProfile','-ExecutionPolicy','Bypass','-File',str(script),
                           '-RunDirectory',str(run),'-Prepared','-MaxPositions','3'],capture_output=True,timeout=20)
    assert result.returncode==0, result.stdout+result.stderr
    lines=(run/'console.log').read_text(encoding='utf-16').splitlines()
    received=[base64.b64decode(line[4:]).decode('utf-8') for line in lines if line.startswith('ARG|')]
    expected=['--hsr' if portable else str(root/'scripts/hsr_scan.py'),str(root/'.cache/youkai-p1'),
              str(run),'--prepared','--max-positions','3']
    assert received==expected
    assert (run/'exit-code.txt').read_text().strip()=='0'


def test_hsr_native_startup_failure_keeps_stderr_and_exit_code(tmp_path,argument_worker):
    root=installation(tmp_path)
    script=root/'scripts/scan-hsr.ps1'
    shutil.copyfile(ROOT/'scripts/scan-hsr.ps1',script)
    shutil.copyfile(argument_worker,root/'.cache/youkai-p1/.venv/Scripts/python.exe')
    run=root/'.cache/hsr/runs/native-error'
    environment=dict(os.environ,HSR_TEST_NATIVE_FAIL='1')
    result=subprocess.run(['powershell.exe','-NoProfile','-ExecutionPolicy','Bypass','-File',str(script),
                           '-RunDirectory',str(run),'-Prepared'],env=environment,capture_output=True,timeout=20)
    assert result.returncode!=0
    assert (run/'exit-code.txt').read_text().strip()=='2'
    assert 'hsr-test-native-startup-error' in (run/'console.log').read_text(encoding='utf-16')
