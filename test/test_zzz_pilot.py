"""ZZZ pilot contracts: synthetic pixels/input only; no game is controlled."""
import json
import math
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

import pytest
from PIL import Image, ImageDraw, ImageEnhance

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from youkai_ocr.capture import calibrate
from youkai_ocr.grid import DEFAULT_GRID
from youkai_selection import collect_prefix, save_report
from zzz_pilot import (PanelNotReady, field, level_from_text, lock_from_action, progression,
                       read_frame, recover_skipped, scope_for, selected_positions, wait_for_panel)


def make_frame(count=1, selected=0):
    image = Image.new('RGB', (1280,720), (20,20,20))
    draw = ImageDraw.Draw(image)
    # A title region and scrollbar at the top, separate from the changing art.
    draw.rectangle((950,180,1120,205),fill=(180,180,180))
    draw.rectangle((907,158,913,165),fill='white')
    for index in range(5):
        x=(1675+29*index)*2/3
        y=420*2/3
        points=[]
        for j in range(10):
            angle=-math.pi/2+j*math.pi/5
            radius=(10 if j%2==0 else 5)*2/3
            points.append((x+math.cos(angle)*radius,y+math.sin(angle)*radius))
        draw.polygon(points,fill='white' if index<count else (126,126,126))
    x,y=DEFAULT_GRID.cell_center(selected%9,selected//9)
    draw.rectangle((round((x-63)*2/3),round((y-31)*2/3),round((x+63)*2/3),round((y-23)*2/3)),fill=(220,240,10))
    return image


@pytest.mark.parametrize('count',[1,2,3,4,5])
def test_five_star_slots_preserve_each_progression(count):
    frame=make_frame(count)
    assert progression(frame,calibrate(frame))['value']==count


@pytest.mark.parametrize('color', ['black','white'])
def test_missing_or_uniform_strip_does_not_default_to_one(color):
    frame=Image.new('RGB',(1280,720),color)
    assert progression(frame,calibrate(frame))['value'] is None


def test_dim_panel_is_uncertain_even_if_first_star_is_brighter_than_rest():
    frame=ImageEnhance.Brightness(make_frame(1)).enhance(.55)
    assert progression(frame,calibrate(frame))['value'] is None


@pytest.mark.parametrize('raw,expected',[('T Unlock',True),('T Lock',False),('unlock',None),('T Lock Unlock',None),('',None)])
def test_lock_is_derived_from_exact_action_not_missing_text(raw,expected):
    assert lock_from_action(raw)['value'] is expected


@pytest.mark.parametrize('raw,expected',[('Lv. 1/10',{'current':1,'max':10}),('Lv. 37/40',{'current':37,'max':40}),
    ('Lv. 60/60',{'current':60,'max':60}),('Lv. 60',None),('Lv. 61/60',None),('Lv. 0/60',None),('junk 60/60',None)])
def test_level_keeps_cap_and_rejects_missing_or_invalid_values(raw,expected):
    assert level_from_text(raw)['value']==expected


@pytest.mark.parametrize('rank,scope',[('S','included'),('A','included'),('B','excluded-B'),(None,'pending-rarity'),('C','pending-rarity')])
def test_scope_uses_explicit_rank(rank,scope):
    assert scope_for(field(rank))==scope


@pytest.mark.parametrize('selected',[0,1,8,9])
def test_highlight_identifies_the_expected_cell_on_both_rows(selected):
    frame=make_frame(selected=selected)
    assert selected_positions(frame,calibrate(frame),DEFAULT_GRID,10)==[selected]


def clock_fixture():
    now=[0.0]
    return lambda:now[0],lambda seconds:now.__setitem__(0,now[0]+seconds)


def test_settling_rejects_dim_transition_then_accepts_stable_selected_panel():
    bright=make_frame(selected=1)
    dim=ImageEnhance.Brightness(bright).enhance(.55)
    frames=iter([dim,dim,bright,bright,bright,bright,bright,bright])
    clock,sleep=clock_fixture(); records=[]
    result=wait_for_panel(lambda:next(frames),calibrate(bright),DEFAULT_GRID,10,1,lambda:None,
                          lambda frame,evidence:records.append(evidence),clock=clock,sleep=sleep)
    assert result is bright
    assert not records[0]['ready'] and records[-1]['settled']


def test_stable_previous_selection_never_counts_as_successful_click():
    frame=make_frame(selected=0);clock,sleep=clock_fixture()
    with pytest.raises(PanelNotReady):
        wait_for_panel(lambda:frame,calibrate(frame),DEFAULT_GRID,10,1,lambda:None,
                       lambda *args:None,clock=clock,sleep=sleep)


def test_stop_during_settling_prevents_more_captures():
    frame=make_frame();grab=Mock(return_value=frame);checks=[0]
    def check():
        checks[0]+=1
        if checks[0]>=3: raise RuntimeError('stop')
    clock,sleep=clock_fixture()
    with pytest.raises(RuntimeError,match='stop'):
        wait_for_panel(grab,calibrate(frame),DEFAULT_GRID,10,0,check,lambda *args:None,clock=clock,sleep=sleep)
    assert grab.call_count==1


def test_ten_position_prefix_keeps_second_row_and_equal_items():
    navigator=SimpleNamespace(scan=lambda limit:iter((i,i//9,'same item') for i in range(10)),stuck_cells=[],incomplete=None)
    observations=[{'status':'not-visited'} for _ in range(10)]
    collect_prefix(navigator,10,lambda index,frame,observation:observation.update(status='read'),observations,columns=9)
    assert len(observations)==10 and all(o['status']=='read' for o in observations)


def test_identical_panels_recover_as_separate_positions_only_with_selected_cell_evidence():
    observations=[{'status':'failed','reason':'upstream-stuck-panel'} for _ in range(3)]
    frames={i:('identical panel',{'path':str(i),'pressCount':i+1,
             'panelCheck':{'settled':True,'selectedPositions':[i if i!=2 else 1]}}) for i in range(3)}
    recovered=[]
    def consume(index,frame,observation):
        recovered.append(index);observation['status']='read'
    recover_skipped(observations,frames,consume)
    assert recovered==[0,1]
    assert observations[2]['status']=='failed'


def test_read_frame_keeps_raw_uncertain_name_and_excludes_b(tmp_path,monkeypatch):
    import youkai_ocr.normalizer as normalizer
    import youkai_ocr.wengine_scanner as scanner
    frame=make_frame(3);draw=ImageDraw.Draw(frame)
    draw.rectangle(calibrate(frame).scale_bbox((1421,402,1452,436)),fill=(80,140,200))
    recognizer=SimpleNamespace(read_text=lambda *args:'unlisted raw name',
                               read_line=Mock(side_effect=['Lv. 37/40','T Lock']))
    monkeypatch.setattr(normalizer,'normalize_engine',lambda text:('NearMatch',84))
    monkeypatch.setattr(scanner,'scan_single_frame_engine',lambda *args,**kwargs:(None,{}))
    result=read_frame(frame,calibrate(frame),tmp_path,recognizer=recognizer)
    assert result['fields']['name']['value'] is None
    assert result['fields']['name']['evidence']['raw']=='unlisted raw name'
    assert result['fields']['name']['candidates'][0]['key']=='NearMatch'
    assert result['scope']=='excluded-B'
    assert result['fields']['lock']['value'] is False


def test_partial_session_and_html_are_saved_with_unvisited_positions(tmp_path):
    path=tmp_path/'session.json'
    report={'mode':'zzz-pilot','status':'stopped','observations':[{'position':0,'status':'failed','reason':'<stop>'},
        {'position':1,'status':'not-visited'}]}
    save_report(path,report)
    assert len(json.loads(path.read_text())['observations'])==2
    html=(tmp_path/'review.html').read_text()
    assert '&lt;stop&gt;' in html and '<stop>' not in html


def test_original_ten_cell_navigator_preserves_equal_copies_with_visible_selection(monkeypatch):
    import pynput.mouse
    from youkai_ocr import grid
    from youkai_selection import GuardedMouse, InputGuard
    monkeypatch.setattr(grid.time,'sleep',lambda seconds:None)
    selected=[0]; clicks=[];saved={}
    calibration=calibrate(make_frame())
    targets=[calibration.to_screen(*DEFAULT_GRID.cell_center(i%9,i//9)) for i in range(10)]
    class Mouse:
        position=(0,0)
        def press(self,button):pass
        def release(self,button):
            x,y=self.position
            selected[0]=min(range(10),key=lambda i:abs(targets[i][0]-x)+abs(targets[i][1]-y))
            clicks.append(selected[0])
        def scroll(self,*args):raise AssertionError('native scroll forbidden')
    guard=InputGuard(lambda:None,lambda:False,targets,41)
    mouse=GuardedMouse(Mouse(),guard)
    def capture():
        frame=make_frame(selected=selected[0])
        index=selected[0]
        saved[index]=(frame,{'path':str(index),'pressCount':guard.presses,
                             'panelCheck':{'settled':True,'selectedPositions':selected_positions(frame,calibration,DEFAULT_GRID,10)}})
        return frame
    navigator=grid.GridNavigator(capture,calibration)
    observations=[{'status':'not-visited'} for i in range(10)]
    def consume(index,frame,observation):
        assert selected_positions(frame,calibration,DEFAULT_GRID,10)==[index]
        observation.update(status='read',key='identical item')
    with patch.object(pynput.mouse,'Controller',return_value=mouse):
        collect_prefix(navigator,10,consume,observations,columns=9)
    assert navigator.stuck_cells==list(range(1,10))
    recover_skipped(observations,saved,consume)
    assert len(observations)==10 and all(o['status']=='read' for o in observations)
    assert clicks[0:2]==[1,0] and clicks[-1]==9
    assert guard.presses<=41 and not mouse.held


def test_normalizer_score_100_with_extra_raw_text_is_still_uncertain(tmp_path,monkeypatch):
    import youkai_ocr.normalizer as normalizer
    import youkai_ocr.wengine_scanner as scanner
    frame=make_frame()
    recognizer=SimpleNamespace(read_text=lambda *args:'Cannon Rotor junk',read_line=Mock(side_effect=['Lv. 60/60','T Unlock']))
    monkeypatch.setattr(normalizer,'normalize_engine',lambda text:('CannonRotor',100))
    monkeypatch.setattr(scanner,'scan_single_frame_engine',lambda *args,**kwargs:(None,{}))
    result=read_frame(frame,calibrate(frame),tmp_path,recognizer=recognizer)
    assert result['fields']['name']['value'] is None
    assert result['fields']['name']['candidates'][0]['score']==100


def test_single_line_title_requires_a_literal_independent_line_read(tmp_path,monkeypatch):
    import youkai_ocr.normalizer as normalizer
    import youkai_ocr.wengine_scanner as scanner
    frame=make_frame()
    recognizer=SimpleNamespace(read_text=lambda *args:'Steel Cushion\na An ere',
                               read_line=Mock(side_effect=['Lv. 60/60','T Unlock','Steel Cushion']))
    monkeypatch.setattr(normalizer,'normalize_engine',lambda text:('SteelCushion',100 if text == 'Steel Cushion' else 95))
    monkeypatch.setattr(scanner,'scan_single_frame_engine',lambda *args,**kwargs:(None,{}))
    result=read_frame(frame,calibrate(frame),tmp_path,recognizer=recognizer)
    assert result['fields']['name']['value']=='SteelCushion'
    assert result['fields']['name']['evidence']['raw']=='Steel Cushion\na An ere'
    assert result['fields']['name']['evidence']['fullCropScore']==95
    assert (tmp_path/'name-line.png').exists()


def test_uncertain_truncated_title_uses_wide_white_read_without_fuzzy_acceptance(tmp_path,monkeypatch):
    import youkai_ocr.normalizer as normalizer
    import youkai_ocr.wengine_scanner as scanner
    frame=make_frame()
    recognizer=SimpleNamespace(read_text=Mock(side_effect=['The Restrainec','The Restrained .']),
                               read_line=Mock(side_effect=['Lv. 60/60','T Unlock']))
    monkeypatch.setattr(normalizer,'normalize_engine',lambda text:('TheRestrained',100 if 'Restrained' in text else 92))
    monkeypatch.setattr(scanner,'scan_single_frame_engine',lambda *args,**kwargs:(None,{}))
    result=read_frame(frame,calibrate(frame),tmp_path,recognizer=recognizer)
    name=result['fields']['name']
    assert name['value']=='TheRestrained' and name['evidence']['raw']=='The Restrainec'
    assert name['evidence']['additionalReads'][0]['exact'] is True
    assert (tmp_path/'name-wide-mask.png').exists()


def test_wrapped_title_expands_second_line_without_discarding_letters_as_noise(tmp_path,monkeypatch):
    import youkai_ocr.normalizer as normalizer
    import youkai_ocr.wengine_scanner as scanner
    from zzz_pilot import exact_name
    frame=make_frame()
    recognizer=SimpleNamespace(read_text=Mock(side_effect=['Ode of\nResurrected Win:',
                   'Ode of cee\nResurrected Wings','Resurrected Wings']),
                   read_line=Mock(side_effect=['Lv. 60/60','T Unlock']))
    def normalize(text):
        return ('OdeOfResurrectedWings',100 if text=='Ode of Resurrected Wings' else 95)
    monkeypatch.setattr(normalizer,'normalize_engine',normalize)
    monkeypatch.setattr(scanner,'scan_single_frame_engine',lambda *args,**kwargs:(None,{}))
    result=read_frame(frame,calibrate(frame),tmp_path,recognizer=recognizer)
    assert result['fields']['name']['value']=='OdeOfResurrectedWings'
    assert result['fields']['name']['evidence']['additionalReads'][0]['exact'] is False
    assert result['fields']['name']['evidence']['additionalReads'][1]['exact'] is True
    assert exact_name('Ode of extra Resurrected Wings',normalize)[2] is False


def test_literal_catalog_candidate_beats_case_sensitive_fuzzy_mismatch():
    from zzz_pilot import exact_name
    normalizer=lambda text:('FlightOfFancy',85.5)
    candidate=('OdeOfResurrectedWings',95.65)
    key,score,exact=exact_name('Ode of Resurrected WINGS � .',normalizer,candidate)
    assert (key,score,exact)==('OdeOfResurrectedWings',95.65,True)
    assert exact_name('Ode of extra Resurrected WINGS',normalizer,candidate)[2] is False
