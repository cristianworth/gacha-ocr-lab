"""Real WinForms -> PowerShell -> Node supervisor -> simulated pilot, never a game."""
import json
import shutil
from pathlib import Path

import pytest

from test_desktop_launcher import ROOT, run_driver
from test_zzz_launcher import installation


def prepare(tmp_path, mode='complete'):
    root = installation(tmp_path)
    for name in ('run-desktop-selection.ps1', 'desktop-selection-entry.js', 'selection-pilot-entry.js'):
        shutil.copyfile(ROOT / 'scripts' / name, root / 'scripts' / name)
    (root / 'package.json').write_text('{"type":"module"}', encoding='utf-8')
    for relative in ('scripts/windows-game.ps1', 'src/windows-game.js', 'src/ocr.js', 'src/wuwa-pilot.js',
                     'src/wuwa-selection.js', 'src/wuwa-offline.js', 'src/nte-pilot.js', 'src/nte-offline.js',
                     'src/image.js', 'src/regions.js', 'src/scan-control.js', '.cache/models/eng.traineddata'):
        path = root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text('fixture', encoding='utf-8')
    for dependency in ('sharp', 'tesseract.js'):
        path = root / 'node_modules' / dependency
        path.mkdir(parents=True)
        (path / 'package.json').write_text('{"main":"index.js"}', encoding='utf-8')
        (path / 'index.js').write_text('module.exports={};', encoding='utf-8')
    windows = [dict(name='FixtureGame', pid=42, title="Fixture game's window", handle='4200', started='123'),
               dict(name='OtherGame', pid=43, title='Another window', handle='4300', started='124')]
    (root / '.cache/windows.json').write_text(json.dumps(windows), encoding='utf-8')
    (root / 'scripts/selection-pilot-windows.ps1').write_text(
        "[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)\n"
        "Get-Content -LiteralPath (Join-Path (Split-Path -Parent $PSScriptRoot) '.cache/windows.json') -Raw -Encoding UTF8",
        encoding='utf-8-sig')
    (root / '.cache/fixture.json').write_text(json.dumps(dict(mode=mode)), encoding='utf-8')
    for game in ('wuwa', 'nte'):
        old = root / '.cache' / game / 'runs' / 'pilot-00000000-0000-0000-0000-000000000000'
        old.mkdir(parents=True)
        (old / 'session.json').write_text('{"reason":"pilot-limit"}')
        (old / 'summary.md').write_text('Old fixture; must never open')
    for game in ('wuwa', 'nte'):
        (root / 'scripts' / f'{game}-pilot.js').write_text(STUB.replace('__GAME__', game), encoding='utf-8')
    return root


STUB = r'''
import fs from 'node:fs'; import path from 'node:path'; import {randomUUID} from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..'),game='__GAME__';
const {mode}=JSON.parse(fs.readFileSync(path.join(root,'.cache','fixture.json'),'utf8'));
const args=process.argv.slice(2);
fs.writeFileSync(path.join(root,'.cache','invocation.json'),JSON.stringify(args));
if(mode==='startup-error'){console.error('fixture startup failed');process.exitCode=1}
else {
 const runs=path.join(root,'.cache',game,'runs');fs.mkdirSync(runs,{recursive:true});
 const dir=path.join(runs,'pilot-'+randomUUID());
 console.log('fixture before marker');
 setTimeout(()=>{
  if(fs.existsSync(dir))throw Error('UI precreated the exclusive session');
  const announced=mode==='old-marker'?path.join(runs,'pilot-00000000-0000-0000-0000-000000000000'):
    mode==='external-marker'?path.join(root,'outside','pilot-'+randomUUID()):dir;
  console.log('PILOT_SESSION_DIR='+announced);
  if(mode==='conflicting-marker')console.log('PILOT_SESSION_DIR='+path.join(runs,'pilot-'+randomUUID()));
  setTimeout(()=>{
   fs.mkdirSync(dir);fs.writeFileSync(path.join(dir,'session.json'),'INVALID WHILE ACTIVE');
   console.log('PROGRESS|fixture session created');
   const targets=[];for(let i=0;i<args.length;i++)if(args[i]==='--target')targets.push(Object.fromEntries(args[i+1].split(',').map((n,j)=>[['left','top','width','height'][j],Number(n)])));
   const save=()=>{
    const stopped=fs.existsSync(path.join(dir,'stop.request'));
    let report={...(game==='wuwa'?{schemaVersion:1,game,mode:'visible-pilot',inventoryAccepted:false}:{schema:'nte-arc-pilot-v1',humanApproved:false}),
      status:'partial',reason:stopped?'cancelled':'pilot-limit',coverageConfirmed:false,
      observations:[{status:'captured-pending-ocr',capture:{path:'pending.png'}}],
      scope:{targets,filter:'none',order:'declared-targets',scroll:false}};
    if(mode==='bad-manifest')report.coverageConfirmed=true;
    if(mode==='f8-stop')report.reason='emergency-f8';
    if(mode==='preparation-error' && game==='nte') {delete report.scope; report.observations=[]; report.reason='preflight';report.error={stage:'preparation'};}
    fs.writeFileSync(path.join(dir,'session.json'),JSON.stringify(report));
    fs.writeFileSync(path.join(dir,'summary.md'),'Own partial fixture result');
    fs.writeFileSync(path.join(dir,'child-closed.txt'),'closed');
    console.log('fixture cleanup complete');if(stopped || mode==='preparation-error')process.exitCode=1;
    if(mode==='shutdown-error'){console.error('fixture backend close failed');process.exitCode=1;}
    if(mode==='f8-stop')process.exitCode=1;
   };
   if(mode==='wait'){
    const timer=setInterval(()=>{console.log('fixture waiting');if(fs.existsSync(path.join(dir,'stop.request'))){clearInterval(timer);setTimeout(save,150)}},100);
   }else setTimeout(save,450);
  },160);
 },300);
}
'''


LOOP = r'''
$ui=New-DesktopForm -Root $testRoot
$ui.Game.SelectedIndex=__INDEX__
$script:phase='list'; $script:failure=$null; $script:pings=0; $script:unselected=$false
$script:deferred=$false; $script:actionSent=$false; $script:whileActive=$false
$script:opened=$null; $script:folder=$null; $script:entry=$null
$script:finalStatus='';$script:finalLog='';$script:preparedText=$ui.Prepared.Text;$script:notice=$ui.Notice.Text
function Open-ZzzResult { param($RunDirectory) $script:opened=$RunDirectory }
function Start-Process { param($FilePath,$ArgumentList,$ErrorAction) $script:folder=$ArgumentList }
$deadline=[DateTime]::UtcNow.AddSeconds(18)
$driver=[Windows.Forms.Timer]::new(); $driver.Interval=40
$ui.Form.Add_Shown({ $ui.RefreshWindows.PerformClick() })
$ui.Form.Add_FormClosing({if($null -eq $ui.Active){$script:finalStatus=$ui.Status.Text;$script:finalLog=$ui.Log.Text}})
$driver.Add_Tick({
 try {
  if([DateTime]::UtcNow -gt $deadline){throw 'Desktop selection timed out'}
  if($null -ne $ui.Active){
   $script:pings++
   if($ui.Active.Action -eq 'run'){
    $script:entry=$ui.Active.ControlDirectory
    if($null -ne $ui.LastRun -or $ui.ResultButton.Enabled){throw 'Result exposed before child close'}
    if($ui.Log.Text.Contains('PROGRESS|') -and !$script:whileActive){
     $script:whileActive=$true
     $bitmap=[Drawing.Bitmap]::new($ui.Form.Width,$ui.Form.Height)
     try{$ui.Form.DrawToBitmap($bitmap,[Drawing.Rectangle]::new(0,0,$bitmap.Width,$bitmap.Height));
      $bitmap.Save((Join-Path $testRoot 'pilot-window.png'),[Drawing.Imaging.ImageFormat]::Png)}finally{$bitmap.Dispose()}
    }
    __ACTION__
   }
  }elseif($script:phase -eq 'list'){
   $script:unselected=($ui.PilotWindow.SelectedIndex -eq -1 -and !$ui.StartButton.Enabled)
   __BEFORE_SELECT__
   $ui.PilotWindow.SelectedIndex=0
   $ui.Prepared.Checked=$true
   $script:phase='run';$ui.StartButton.PerformClick()
  }elseif($script:phase -eq 'run'){
   $ui.ResultButton.PerformClick();$ui.FolderButton.PerformClick();$ui.Form.Close()
  }
 }catch{$script:failure=$_.Exception.Message;Request-DesktopStop $ui;[Windows.Forms.Application]::ExitThread()}
})
$driver.Start()
try{[Windows.Forms.Application]::Run($ui.Form)}finally{$driver.Stop();$driver.Dispose();$ui.Form.Dispose()}
if($script:failure){throw $script:failure}
Write-Output ('__RESULT__'+(@{Result=$ui.LastResult;Run=$ui.LastRun;Entry=$script:entry;Starts=$ui.StartCount;
 Pings=$script:pings;Unselected=$script:unselected;Deferred=$script:deferred;WhileActive=$script:whileActive;
 ClosedAfterChild=($null -eq $ui.Active);Opened=$script:opened;Folder=$script:folder;Log=$script:finalLog;
 Status=$script:finalStatus;PreparedText=$script:preparedText;Notice=$script:notice}|ConvertTo-Json -Compress))
'''


def drive(tmp_path, root, game, action='', before=''):
    body = LOOP.replace('__INDEX__', '3' if game == 'wuwa' else '4')
    body = body.replace('__ACTION__', action).replace('__BEFORE_SELECT__', before)
    return run_driver(tmp_path, body, installation_root=root)


@pytest.mark.parametrize('game', ['wuwa', 'nte'])
def test_graphical_selection_owns_result_and_preserves_pending_ocr(tmp_path, game):
    root = prepare(tmp_path)
    result = drive(tmp_path, root, game)
    assert result['Result'] == 'partial' and result['Starts'] == 1
    assert result['Unselected'] and result['Pings'] > 5 and result['WhileActive'] and result['ClosedAfterChild']
    run = Path(result['Run'])
    assert run.parent == root / '.cache' / game / 'runs'
    assert result['Opened'] == result['Run'] and result['Folder'] == f'"{result["Run"]}"'
    report = json.loads((run / 'session.json').read_text())
    assert report['observations'][0]['status'] == 'captured-pending-ocr'
    assert report['coverageConfirmed'] is False and 'OCR pendente: 1' in result['Status']
    args = json.loads((root / '.cache/invocation.json').read_text())
    assert args[:5] == ['--prepared', '--process', 'FixtureGame', '--pid', '42']
    assert len([v for v in args if v == '--target']) == (2 if game == 'wuwa' else 3)
    assert 'filtros' not in result['PreparedText'] and 'ordenacao' not in result['PreparedText']
    assert 'Sem filtro, corte ou rolagem' in result['Notice']
    assert run != Path(result['Entry']) and not (run / 'console.log').exists()


@pytest.mark.parametrize('game', ['wuwa', 'nte'])
@pytest.mark.parametrize('mode,expected,code', [('complete', 'partial', 0), ('shutdown-error', 'error', 1), ('f8-stop', 'partial', 1)])
def test_shutdown_exit_status_preserves_own_partial_result_and_diagnostics(tmp_path, game, mode, expected, code):
    root = prepare(tmp_path, mode)
    result = drive(tmp_path, root, game)
    assert result['Result'] == expected and result['ClosedAfterChild'] and result['WhileActive']
    assert result['Opened'] == result['Run'] and result['Folder'] == f'"{result["Run"]}"'
    run, entry = Path(result['Run']), Path(result['Entry'])
    receipt = json.loads((entry / 'result.json').read_text(encoding='utf-8'))
    manifest = json.loads((run / 'session.json').read_text(encoding='utf-8'))
    assert receipt['childExitCode'] == code and receipt['failed'] is (mode == 'shutdown-error')
    assert (entry / 'exit-code.txt').read_text().strip() == ('1' if expected == 'error' else '0')
    assert manifest['status'] == 'partial' and manifest['coverageConfirmed'] is False and 'failed' not in manifest
    assert manifest['observations'][0]['status'] == 'captured-pending-ocr'
    assert (run / 'summary.md').read_text() == 'Own partial fixture result'
    if mode == 'shutdown-error':
        assert manifest['reason'] == 'pilot-limit' and 'codigo 1' in receipt['error']
        assert 'Falha no encerramento' in result['Status'] and 'filho 1; supervisor 1' in result['Status']
        assert 'Parcial preservado' in result['Status'] and 'fixture backend close failed' in result['Log']
        assert 'filho=1; supervisor=1' in result['Log'] and str(entry / 'console.log') in result['Log']
    else:
        assert 'Piloto parcial encerrado:' in result['Status'] and 'Falha no encerramento' not in result['Status']


@pytest.mark.parametrize('game', ['wuwa', 'nte'])
def test_supervisor_exit_failure_overrides_valid_partial_receipt(tmp_path, game):
    root = prepare(tmp_path)
    adapter = root / 'scripts/run-desktop-selection.ps1'
    script = adapter.read_text(encoding='utf-8-sig').replace('$code = $LASTEXITCODE',
        "$code = $LASTEXITCODE\n    if ($Action -eq 'run') { $writer.WriteLine('fixture supervisor failure'); $code = 7 }")
    adapter.write_text(script, encoding='utf-8-sig')
    result = drive(tmp_path, root, game)
    entry = Path(result['Entry'])
    receipt = json.loads((entry / 'result.json').read_text(encoding='utf-8'))
    assert receipt['result'] == 'partial' and receipt['failed'] is False and receipt['childExitCode'] == 0
    assert result['Result'] == 'error' and result['ClosedAfterChild'] and result['Opened'] == result['Run']
    assert result['Folder'] == f'"{result["Run"]}"' and (entry / 'exit-code.txt').read_text().strip() == '7'
    assert 'filho 0; supervisor 7' in result['Status'] and 'fixture supervisor failure' in result['Log']


@pytest.mark.parametrize('game', ['wuwa', 'nte'])
@pytest.mark.parametrize('when,close', [('before-marker', False), ('after-session', False), ('before-marker', True), ('after-session', True)])
def test_stop_and_close_remain_pending_until_own_session_and_wait_for_child(tmp_path, game, when, close):
    root = prepare(tmp_path, 'wait')
    condition = "$ui.Log.Text.Contains('PROGRESS|')" if when == 'after-session' else '$true'
    action = '$ui.Form.Close();$script:deferred=(!$ui.Form.IsDisposed -and $null -ne $ui.Active)' if close else '$ui.StopButton.PerformClick()'
    result = drive(tmp_path, root, game, f'if(!$script:actionSent -and ({condition})){{$script:actionSent=$true;{action}}}')
    run = Path(result['Run'])
    assert result['Result'] == 'partial' and result['ClosedAfterChild'] and result['Starts'] == 1
    assert result['Deferred'] is close
    assert (run / 'stop.request').exists() and (run / 'child-closed.txt').read_text() == 'closed'
    assert json.loads((run / 'session.json').read_text())['reason'] == 'cancelled'


@pytest.mark.parametrize('field,value', [('name', 'ChangedGame'), ('pid', 99), ('handle', '99'), ('started', '99')])
def test_graphical_choice_revalidated_after_confirmation(tmp_path, field, value):
    root = prepare(tmp_path)
    before = (f"$changed=Get-Content (Join-Path $testRoot '.cache/windows.json') -Raw|ConvertFrom-Json\n"
              f"$changed[0].{field}='{value}'\n"
              "$changed|ConvertTo-Json|Set-Content (Join-Path $testRoot '.cache/windows.json') -Encoding UTF8")
    result = drive(tmp_path, root, 'wuwa', before=before)
    assert result['Result'] == 'error' and result['Run'] is None and result['Opened'] is None
    assert 'Janela fechada, alterada ou ambigua' in result['Log']
    assert not (root / '.cache/invocation.json').exists()


@pytest.mark.parametrize('game', ['wuwa', 'nte'])
@pytest.mark.parametrize('mode', ['startup-error', 'bad-manifest', 'preparation-error', 'old-marker', 'external-marker', 'conflicting-marker'])
def test_startup_and_manifest_errors_never_reopen_old_success(tmp_path, game, mode):
    root = prepare(tmp_path, mode)
    old = root / '.cache' / game / 'runs' / 'older-success'
    old.mkdir(parents=True)
    (old / 'summary.md').write_text('Old success')
    result = drive(tmp_path, root, game)
    assert result['Run'] != str(old) and result['Opened'] != str(old) and result['ClosedAfterChild']
    expected = 'error'
    assert result['Result'] == expected
    if mode in ('startup-error', 'old-marker', 'external-marker', 'conflicting-marker'):
        assert result['Run'] is None and result['Opened'] is None


@pytest.mark.parametrize('when', ['before-marker', 'after-session'])
def test_ui_log_failure_requests_stop_and_waits_for_full_close(tmp_path, when):
    root = prepare(tmp_path, 'wait')
    condition = "$ui.Log.Text.Contains('PROGRESS|')" if when == 'after-session' else '$true'
    body = LOOP.replace('__INDEX__', '3').replace('__BEFORE_SELECT__', '')
    body = body.replace('__ACTION__', f"if(!$script:actionSent -and ({condition})){{$script:actionSent=$true;$script:failLog=$true}}")
    body = (r'''
$script:failLog=$false
$script:originalLog=${function:Read-DesktopLog}
function Read-DesktopLog {param($Reader,[switch]$Final)
 if($script:failLog){$script:failLog=$false;throw 'fixture log failure'}
 & $script:originalLog -Reader $Reader -Final:$Final
}
''' + body)
    result = run_driver(tmp_path, body, installation_root=root)
    assert result['Result'] == 'error' and result['ClosedAfterChild']
    run = Path(result['Run'])
    assert (run / 'stop.request').exists() and (run / 'child-closed.txt').read_text() == 'closed'
    assert 'fixture log failure' in result['Log']


@pytest.mark.parametrize('when', ['before-marker', 'after-session'])
def test_supervisor_log_write_failure_keeps_ui_and_child_until_close(tmp_path, when):
    root = prepare(tmp_path, 'wait')
    condition = "$ui.Log.Text.Contains('PROGRESS|')" if when == 'after-session' else "$ui.Log.Text.Contains('Log desta abertura: ')"
    action = r'''
if(!$script:actionSent -and (__CONDITION__)){
 $match=[regex]::Match($ui.Log.Text,'Log desta abertura: ([^\r\n]+)')
 if($match.Success){
  $script:actionSent=$true;$path=$match.Groups[1].Value
  Remove-Item -LiteralPath $path
  New-Item -ItemType Directory -Path $path|Out-Null
 }
}
'''.replace('__CONDITION__', condition)
    result = drive(tmp_path, root, 'wuwa', action)
    assert result['Result'] == 'error' and result['ClosedAfterChild'] and result['Starts'] == 1
    run = Path(result['Run'])
    assert (run / 'stop.request').exists() and (run / 'child-closed.txt').read_text() == 'closed'
    assert 'Falha ao gravar o log' in result['Log']
    assert 'Resultado parcial: pilot-limit' not in result['Log']


@pytest.mark.parametrize('after_session,stop_write_error', [(False, False), (True, False), (False, True)])
def test_outer_log_writer_failure_drains_child_even_when_stop_write_fails(tmp_path, after_session, stop_write_error):
    root = prepare(tmp_path, 'wait')
    adapter = root / 'scripts/run-desktop-selection.ps1'
    script = adapter.read_text(encoding='utf-8-sig')
    trigger = "([string]$_).StartsWith('PROGRESS|')" if after_session else '$true'
    script = script.replace('if (!$logFailed) {',
                            f"if ($Action -eq 'run' -and !$logFailed -and ({trigger})) {{ $writer.Dispose() }}\n        if (!$logFailed) {{")
    if stop_write_error:
        # A directory at the control path makes WriteAllText fail while the
        # supervisor can still observe the pending signal by its existence.
        script = script.replace("$ErrorActionPreference = 'Continue'",
                                "if ($Action -eq 'run') { New-Item -ItemType Directory -Path (Join-Path $entry 'stop.request') | Out-Null }\n"
                                "$ErrorActionPreference = 'Continue'")
    adapter.write_text(script, encoding='utf-8-sig')
    result = drive(tmp_path, root, 'nte')
    assert result['Result'] == 'error' and result['ClosedAfterChild'] and result['Starts'] == 1
    run = Path(result['Run'])
    assert (run / 'child-closed.txt').read_text() == 'closed'
    assert (run / 'stop.request').exists()
    assert json.loads((run / 'session.json').read_text())['reason'] == 'cancelled'
    assert (Path(result['Entry']) / 'monitor-error.txt').exists()


def test_missing_pilot_dependency_is_clear_and_preparation_stays_responsive(tmp_path):
    root = prepare(tmp_path)
    (root / '.cache/models/eng.traineddata').unlink()
    body = r'''
$ui=New-DesktopForm -Root $testRoot;$ui.Game.SelectedIndex=4
$script:pings=0
$script:finalLog=''
$driver=[Windows.Forms.Timer]::new();$driver.Interval=40
$deadline=[DateTime]::UtcNow.AddSeconds(12)
$ui.Form.Add_Shown({$ui.RefreshWindows.PerformClick()})
$ui.Form.Add_FormClosing({$script:finalLog=$ui.Log.Text})
$driver.Add_Tick({
 if([DateTime]::UtcNow -gt $deadline){throw 'Timeout'}
 if($ui.Active){$script:pings++}else{$ui.Form.Close()}
})
$driver.Start();try{[Windows.Forms.Application]::Run($ui.Form)}finally{$driver.Dispose();$ui.Form.Dispose()}
Write-Output ('__RESULT__'+(@{Pings=$script:pings;Log=$script:finalLog;Starts=$ui.StartCount;Run=$ui.LastRun;Windows=$ui.PilotWindow.Items.Count}|ConvertTo-Json -Compress))
'''
    result = run_driver(tmp_path, body, installation_root=root)
    assert result['Pings'] > 2 and result['Starts'] == result['Windows'] == 0 and result['Run'] is None
    assert 'eng.traineddata' in result['Log']
