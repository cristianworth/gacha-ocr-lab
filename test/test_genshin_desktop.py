"""Genshin routing and cooperative stop through the real WinForms message loop."""
import json
import shutil
from pathlib import Path

from test_desktop_launcher import MESSAGE_LOOP, ROOT, run_driver
from test_zzz_launcher import installation


def test_genshin_pilot_uses_own_folder_and_stop_request(tmp_path):
    root = installation(tmp_path)
    for relative in ('scripts/genshin-pilot.js', 'src/genshin-pilot-1280.js', 'src/genshin-1280.js',
                     'node_modules/sharp/package.json', 'node_modules/tesseract.js/package.json',
                     '.cache/models/eng.traineddata'):
        path = root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text('fixture', encoding='utf-8')
    shutil.copyfile(ROOT / 'scripts/run-desktop-genshin.ps1', root / 'scripts/run-desktop-genshin.ps1')
    (root / 'scripts/genshin-pilot.js').write_text(r'''
const fs=require('fs'),path=require('path');
const run=process.argv[process.argv.indexOf('--run-directory')+1];
console.log('PROGRESS|piloto');
const timer=setInterval(()=>{
  if(!fs.existsSync(path.join(run,'stop.request'))) return;
  clearInterval(timer);
  fs.writeFileSync(path.join(run,'session.json'),JSON.stringify({game:'genshin',mode:'pilot-1280x720',status:'partial',reason:'cancelled'}));
  fs.writeFileSync(path.join(run,'summary.md'),'Piloto parcial');
  console.log('parada recebida'); process.exitCode=1;
},50);
''', encoding='utf-8')
    body = MESSAGE_LOOP.replace('New-DesktopForm -Simulation', 'New-DesktopForm')
    body = body.replace('__OUTCOME__', 'Complete').replace('__ACTION__', '''
if (!$script:actionSent -and $ui.Log.Text.Contains('PROGRESS|')) {
    $script:actionSent=$true; Request-DesktopStop $ui
}''')
    body = body.replace('$ui.Form.Add_Shown({',
                        "$ui.Game.SelectedIndex=2\n$ui.Prepared.Checked=$true\n$ui.RunsRoot=Join-Path $testRoot '.cache\\genshin\\runs'\n$ui.Form.Add_Shown({")
    result = run_driver(tmp_path, body, installation_root=root)
    assert result['Result'] == 'partial'
    assert result['Starts'] == 1 and result['Stop'] and result['ClosedAfterChild']
    assert Path(result['Run']).parent == root / '.cache/genshin/runs'
    manifest = json.loads((Path(result['Run']) / 'session.json').read_text(encoding='utf-8-sig'))
    assert manifest['reason'] == 'cancelled'
    assert 'parada recebida' in result['Log']
