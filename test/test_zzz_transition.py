"""Bounded transition and explicit stop-trial tests; no desktop inputs."""
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock

import numpy as np
import pytest
from PIL import Image,ImageDraw

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from test_zzz_pilot import make_frame
from youkai_ocr.capture import calibrate
from youkai_ocr.grid import DEFAULT_GRID
from youkai_selection import StopTrialFinished,await_stop_trial,collect_prefix
from zzz_transition import TransitionRejected,compare_viewports,run_transition,scrollbar_top


def viewport(offset=0,selected=2,thumb=159,identical=False):
    frame=make_frame(selected=selected)
    calibration=calibrate(frame)
    draw=ImageDraw.Draw(frame)
    draw.rectangle((905,153,916,583),fill='black')
    draw.rectangle((907,thumb,913,thumb+7),fill='white')
    for row in range(4):
        for col in range(9):
            x,y=DEFAULT_GRID.cell_center(col,row)
            box=calibration.scale_bbox((x-44,y+5,x+44,y+66))
            seed=5 if identical else (row+offset)*9+col
            pixels=np.random.default_rng(seed).integers(30,230,(28,40),dtype=np.uint8)
            frame.paste(Image.fromarray(pixels).resize((box[2]-box[0],box[3]-box[1])),box[:2])
    return frame


@pytest.mark.parametrize('shift,verified',[(0,False),(1,True),(2,False)])
def test_only_one_row_overlap_is_accepted(shift,verified):
    before=viewport();after=viewport(offset=shift,selected=18,thumb=162)
    result=compare_viewports(before,after,calibrate(before),DEFAULT_GRID)
    assert result['verified'] is verified
    assert result['relativeRowsAdvanced']==(1 if verified else None)


def test_identical_grid_content_cannot_prove_relative_position():
    before=viewport(identical=True);after=viewport(1,18,162,identical=True)
    assert compare_viewports(before,after,calibrate(before),DEFAULT_GRID)['verified'] is False


def test_scrollbar_geometry_matches_observed_top_and_direction():
    before=viewport();after=viewport(1,18,162)
    calibration=calibrate(before)
    assert scrollbar_top(before,calibration)==238.5
    assert scrollbar_top(after,calibration)>scrollbar_top(before,calibration)


def transition_fixture(tmp_path,monkeypatch,*,shift=1,thumb=162,count=100):
    import zzz_transition
    before=viewport();after=viewport(shift,18,thumb)
    clicked=[False];records=[]
    guard=SimpleNamespace(check=Mock())
    # Time is simulated; capture/selection checks still inspect synthetic frames.
    now=[0.0]
    from zzz_pilot import wait_for_panel as real_wait
    def wait(*args,**kwargs):
        return real_wait(*args,**kwargs,clock=lambda:now[0],sleep=lambda seconds:now.__setitem__(0,now[0]+seconds))
    monkeypatch.setattr(zzz_transition,'wait_for_panel',wait)
    report={'globalCountCandidate':count,'observations':[{'position':0,'status':'not-visited'}]}
    def click(mouse,x,y):
        assert (x,y)==calibrate(before).to_screen(*DEFAULT_GRID.cell_center(0,3))
        assert not clicked[0]
        clicked[0]=True
    reader=Mock(return_value={'scope':'included','fields':{}})
    args=(calibrate(before),lambda:after if clicked[0] else before,object(),guard,
          lambda frame,evidence:records.append(evidence),report,tmp_path,Mock(),DEFAULT_GRID)
    return args,dict(click=click,reader=reader),clicked,records,report,guard,reader


def test_single_bottom_click_reads_one_post_transition_item_and_keeps_coverage_unknown(tmp_path,monkeypatch):
    args,kwargs,clicked,records,report,guard,reader=transition_fixture(tmp_path,monkeypatch)
    run_transition(*args,**kwargs)
    assert clicked==[True] and reader.call_count==1
    assert report['transition']['verified'] is True
    assert report['status']=='transition-read'
    assert report['coverageConfirmed'] is False and report['endOfInventory'] is None
    assert report['observations'][0]['status']=='read'
    assert 'absolute inventory' in report['observations'][0]['positionMeaning']
    assert any(record['stage']=='before' for record in records) and any(record['stage']=='after' for record in records)


@pytest.mark.parametrize('shift,thumb',[(0,159),(1,159),(2,162)])
def test_no_motion_static_scrollbar_or_double_shift_keeps_evidence_but_never_reads_item(tmp_path,monkeypatch,shift,thumb):
    args,kwargs,clicked,records,report,guard,reader=transition_fixture(tmp_path,monkeypatch,shift=shift,thumb=thumb)
    with pytest.raises(TransitionRejected,match='not-confirmed'):
        run_transition(*args,**kwargs)
    assert clicked==[True] and reader.call_count==0
    assert report['transition']['verified'] is False
    assert report['observations'][0]['status']=='captured'
    assert Path(report['observations'][0]['frame']).exists()


def test_fitting_inventory_does_not_trigger_scroll(tmp_path,monkeypatch):
    args,kwargs,clicked,records,report,guard,reader=transition_fixture(tmp_path,monkeypatch,count=30)
    with pytest.raises(TransitionRejected,match='more-than-one-viewport'):
        run_transition(*args,**kwargs)
    assert clicked==[False] and reader.call_count==0


def test_focus_or_stop_after_click_prevents_followup_capture_and_read(tmp_path,monkeypatch):
    args,kwargs,clicked,records,report,guard,reader=transition_fixture(tmp_path,monkeypatch)
    def check():
        if clicked[0]:raise RuntimeError('focus-lost')
    guard.check.side_effect=check
    with pytest.raises(RuntimeError,match='focus-lost'):
        run_transition(*args,**kwargs)
    assert clicked==[True] and reader.call_count==0
    assert all(record['stage']=='before' for record in records)


@pytest.mark.parametrize('observed',[True,False])
def test_explicit_stop_trial_requires_a_second_signal_at_checkpoint(observed):
    event=SimpleNamespace(wait=Mock(return_value=observed))
    guard=SimpleNamespace(presses=2);report={'stopTest':{'passed':False}}
    save=Mock();notify=Mock(return_value=1)
    with pytest.raises(StopTrialFinished) as caught:
        await_stop_trial(event,guard,report,save,timeout=0,notify=notify)
    assert caught.value.passed is observed
    assert report['stopTest']['passed'] is observed
    assert report['stopTest']['checkpointReached'] is True
    assert report['stopTest']['pressRequestsAtCheckpoint']==2
    event.wait.assert_called_once_with(0)
    notify.assert_called_once()


def test_successful_read_is_preserved_when_stop_trial_aborts_the_iterator():
    navigator=SimpleNamespace(scan=lambda limit:iter([(0,0,object()),(1,0,object())]))
    observations=[{'status':'not-visited'} for _ in range(3)]
    def consume(index,frame,observation):
        observation['status']='read'
        raise StopTrialFinished(True)
    with pytest.raises(StopTrialFinished):
        collect_prefix(navigator,3,consume,observations)
    assert [entry['status'] for entry in observations]==['read','not-visited','not-visited']


@pytest.mark.parametrize('trial,outcome', [('stop','signal'),('stop','timeout'),('geometry','position'),('geometry','size'),('geometry','dpi'),('geometry','focus'),('geometry','f8')])
def test_paused_trial_cli_preserves_reading_and_distinguishes_stop_causes(tmp_path,monkeypatch,capsys,trial,outcome):
    import ctypes
    import json
    import pynput.mouse
    import win32gui
    import win32process
    import youkai_selection as selection
    import zzz_pilot
    from youkai_ocr import capture,grid,recognize,wengine_scanner
    repo=Path(__file__).resolve().parents[1]
    frame=make_frame(selected=0);calibration=calibrate(frame)
    window={'hwnd':1,'title':'ZenlessZoneZero','left':0,'top':0,'w':1280,'h':720}
    monkeypatch.setattr(ctypes.windll.user32,'SetProcessDPIAware',Mock())
    current={'position':(0,0),'size':(1280,720),'dpi':96,'foreground':1}
    monkeypatch.setattr(ctypes.windll.user32,'GetDpiForWindow',Mock(side_effect=lambda hwnd:current['dpi']))
    def notify(*args):
        if trial=='geometry':
            if outcome=='position':current['position']=(20,10)
            elif outcome=='size':current['size']=(1200,720)
            elif outcome=='dpi':current['dpi']=120
            elif outcome=='focus':current['foreground']=2
            elif outcome=='f8':event.flag=True
        return 1
    monkeypatch.setattr(ctypes.windll.kernel32,'Beep',Mock(side_effect=notify))
    monkeypatch.setattr(win32gui,'IsWindow',lambda hwnd:True)
    monkeypatch.setattr(win32gui,'IsWindowVisible',lambda hwnd:True)
    monkeypatch.setattr(win32gui,'IsIconic',lambda hwnd:False)
    monkeypatch.setattr(win32gui,'GetForegroundWindow',lambda:current['foreground'])
    monkeypatch.setattr(win32gui,'GetClientRect',lambda hwnd:(0,0,*current['size']))
    monkeypatch.setattr(win32gui,'ClientToScreen',lambda hwnd,point:current['position'])
    monkeypatch.setattr(win32process,'GetWindowThreadProcessId',lambda hwnd:(1,42))
    monkeypatch.setattr(selection,'integrity_level',lambda *args:12288)
    monkeypatch.setattr(capture,'list_game_windows',lambda:[window])
    monkeypatch.setattr(capture,'calibrate_window',lambda:(calibration,lambda:frame))
    monkeypatch.setattr(selection,'capture_once',lambda *args,**kwargs:(frame,calibration,window))
    monkeypatch.setattr(selection.time,'sleep',lambda seconds:None)
    class Event:
        flag=False
        calls=0
        def wait(self,timeout):
            self.calls+=1
            self.flag=True if self.calls==1 else outcome=='signal'
            return self.flag
        def is_set(self):return self.flag
        def clear(self):self.flag=False
    event=Event();listener=Mock();listener.is_alive.return_value=True
    monkeypatch.setattr(grid,'make_kill_listener',lambda **kwargs:(event,listener))
    native_events=[]
    class Mouse:
        position=(0,0)
        def press(self,button):native_events.append('press')
        def release(self,button):native_events.append('release')
        def scroll(self,*args):raise AssertionError('native scroll forbidden')
    monkeypatch.setattr(pynput.mouse,'Controller',Mouse)
    class Navigator:
        incomplete=None
        stuck_cells=[]
        def __init__(self,capture_fn,calibration,**kwargs):self.capture=capture_fn
        def scan(self,total):
            mouse=pynput.mouse.Controller()
            mouse.position=calibration.to_screen(*DEFAULT_GRID.cell_center(0,0))
            mouse.press(pynput.mouse.Button.left);mouse.release(pynput.mouse.Button.left)
            yield 0,0,self.capture()
            raise AssertionError('stop trial must not request another position')
    monkeypatch.setattr(grid,'GridNavigator',Navigator)
    monkeypatch.setattr(recognize,'make_recognizer',lambda *args:SimpleNamespace(read_line=lambda *args:'W-Engine Storage [1567/2000]'))
    def header(frame,calib,reader):
        reader.read_line(frame,'white_text_on_dark');return 1567
    monkeypatch.setattr(wengine_scanner,'read_engine_count',header)
    def wait(grab,calib,grid,limit,expected,check,record):
        check();image=grab();record(image,{'expectedPosition':expected,'selectedPositions':[expected],'settled':True});return image
    monkeypatch.setattr(zzz_pilot,'wait_for_panel',wait)
    monkeypatch.setattr(zzz_pilot,'read_frame',lambda *args:{'scope':'included','fields':{}})
    monkeypatch.setattr(sys,'argv',['youkai_selection.py',str(repo/'.cache/youkai-p1'),str(tmp_path),
                                   '--pilot','--run','--limit','3',f'--test-{trial}'])
    result=selection.main()
    report=json.loads((tmp_path/'session.json').read_text())
    passed=outcome in ('signal','position','size','dpi')
    assert result==(0 if passed else 1)
    assert report['status']=='stopped' and report[f'{trial}Test']['passed'] is passed
    assert report['stopObservedDuringRun'] is (outcome in ('signal','f8'))
    if trial=='geometry':
        assert report['guardStop']['noPressesAfterObservation'] is True
        assert report['guardStop']['noMouseMovesAfterObservation'] is True
        assert report['geometryTest']['noPressesAfterObservation'] is True
        if passed:
            assert report['reason']=='game-geometry-or-DPI-changed'
            assert report['windowChange']['expectedClient']==[0,0,1280,720]
            assert (report['windowChange']['observedClient']!=report['windowChange']['expectedClient']
                    or report['windowChange']['observedDpi']!=96)
        elif outcome=='focus':assert report['reason']=='game-focus-lost'
    assert report['processedPositions']==1 and report['pilotTraversalComplete'] is False
    assert [item['status'] for item in report['observations']]==['read','not-visited','not-visited']
    assert native_events==['press','release']
    label='STOP' if trial=='stop' else 'GEOMETRY'
    expected=f'{label} TEST '+('PASSED' if passed else 'NOT PASSED')
    assert expected in capsys.readouterr().out
    html_label='Stop' if trial=='stop' else 'Geometry'
    assert f'{html_label} test: '+('PASSED' if passed else 'NOT PASSED') in (tmp_path/'review.html').read_text()


@pytest.mark.parametrize('change', ['none', 'geometry', 'focus', 'stop'])
def test_geometry_pause_only_accepts_geometry_and_never_resumes_scanning(change):
    from youkai_selection import InputGuard, ProbeStopped, TrialFinished, await_geometry_trial
    now=[0.0]
    def check():
        if now[0]>=.1 and change in ('geometry','focus'):
            raise ProbeStopped('game-geometry-or-DPI-changed' if change=='geometry' else 'game-focus-lost')
    guard=InputGuard(check,lambda:now[0]>=.1 and change=='stop',[],0,clock=lambda:now[0])
    guard.presses=2
    report={'geometryTest':{'passed':False}}
    def sleep(seconds):now[0]+=seconds
    with pytest.raises(TrialFinished) as caught:
        await_geometry_trial(guard,report,Mock(),timeout=.2,clock=lambda:now[0],sleep=sleep)
    assert caught.value.passed is (change=='geometry')
    assert report['geometryTest']['passed'] is (change=='geometry')
    assert report['geometryTest']['checkpointReached'] is True
    assert guard.presses==2 and guard.moves==0
    if change=='none':assert 'no-change' in str(caught.value)
    else:assert guard.failure['pressRequests']==2


def test_guard_failure_records_first_observation_without_later_inputs():
    from youkai_selection import InputGuard, ProbeStopped
    now=[1.0]
    guard=InputGuard(Mock(side_effect=ProbeStopped('game-focus-lost')),lambda:False,[(1,1)],4,clock=lambda:now[0])
    with pytest.raises(ProbeStopped):guard.press((1,1))
    first=dict(guard.failure)
    now[0]=2.0
    with pytest.raises(ProbeStopped):guard.press((1,1))
    assert guard.failure==first
    assert first['at']==1.0 and first['pressRequests']==0
    assert guard.presses==0 and guard.events==[]


@pytest.mark.parametrize('flags', [['--test-geometry'], ['--pilot','--run','--test-geometry','--test-stop'], ['--pilot','--run','--test-geometry','--transition']])
def test_invalid_geometry_cli_combinations_fail_before_creating_session(tmp_path,monkeypatch,flags):
    import youkai_selection as selection
    monkeypatch.setattr(sys,'argv',['youkai_selection.py',str(tmp_path/'cache'),str(tmp_path/'output'),*flags])
    with pytest.raises(SystemExit) as caught:selection.main()
    assert caught.value.code==2 and not (tmp_path/'output').exists()
