"""HSR literals, selection delivery, cutoff and cooperative cleanup without game inputs."""
import json
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from PIL import Image, ImageDraw

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from hsr_reader import downward_viewport_shift, next_selection, parse_field, prepared_text, selected_card
from hsr_inventory import run_inventory, save_session, settled_frame
from scan_runtime import GuardedAdvance, InputGuard, ProbeStopped, check_external_stop


@pytest.mark.parametrize('raw,expected', [('80/80',{'current':80,'max':80}),('Lv.20/30',{'current':20,'max':30}),
    ('0/20',None),('1/2',None),('8S/80',None),('',None),('80/60',None)])
def test_literal_levels_never_supply_a_default(raw,expected):
    assert parse_field('level',raw)==expected


@pytest.mark.parametrize('raw,expected', [('1',1),('5',5),('S',None),('I',None),('',None),('6',None)])
def test_superimposition_has_no_guessed_one(raw,expected):
    assert parse_field('superimposition',raw)==expected


def test_panel_anchor_requires_the_complete_fixed_sentence():
    sentence = 'The following effects only work on characters of the Path of'
    assert parse_field('path', sentence) == sentence
    assert parse_field('path', sentence + ' Destruction.', legacy=True) == sentence + ' Destruction.'
    assert parse_field('path', sentence, legacy=True) is None
    assert parse_field('path', 'The following effects only work') is None
    assert parse_field('path', 'noise ' + sentence) is None


def test_anchor_preprocessing_separates_gold_from_neutral_white_text():
    image = Image.new('RGB', (30, 10), (0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 0, 9, 9), fill=(220, 220, 220))
    draw.rectangle((20, 0, 29, 9), fill=(255, 210, 100))
    for threshold in (170, 180):
        prepared = prepared_text(image, threshold, neutral_only=True)
        assert prepared.getpixel((20, 20)) == 0
        assert prepared.getpixel((100, 20)) == 255
        assert prepared_text(image, threshold).getpixel((100, 20)) == 0


def frame_at(x=50,y=150):
    frame=Image.new('RGB',(1280,720),(20,20,20))
    ImageDraw.Draw(frame).rectangle((x,y,x+80,y+110),outline='white',width=3)
    return frame


def test_selection_moves_even_when_panels_and_item_art_are_identical():
    first,second=frame_at(),frame_at(140)
    a,b=selected_card(first),selected_card(second)
    assert a and b and next_selection(a,b,first.size)
    assert not next_selection(a,a,first.size)
    assert not next_selection(a,selected_card(frame_at(230)),first.size)


def test_ambiguous_selection_cannot_authorize_an_advance():
    frame=frame_at()
    ImageDraw.Draw(frame).rectangle((140,150,220,260),outline='white',width=3)
    assert selected_card(frame) is None


def test_top_row_outline_is_not_cut_off_by_the_header_mask():
    frame=Image.new('RGB',(1280,720),(20,20,20))
    ImageDraw.Draw(frame).rectangle((91,90,181,197),outline='white',width=3)
    assert selected_card(frame)==[91,90,91,108]
    # Header decoration cannot be mistaken for a second selected card.
    ImageDraw.Draw(frame).rectangle((350,20,430,70),outline='white',width=3)
    assert selected_card(frame)==[91,90,91,108]


@pytest.mark.parametrize('case,reason',[('missing','selection-not-unique'),('stale','selection-advance-unconfirmed'),
                                      ('unstable','panel-stability-unconfirmed')])
def test_wait_failure_reports_which_evidence_is_missing(case,reason):
    clock=[0.0]
    calls=[0]
    def grab():
        image=Image.new('RGB',(1280,720),(20,20,20)) if case=='missing' else frame_at()
        if case=='unstable':
            calls[0]+=1
            ImageDraw.Draw(image).rectangle((922,65,1241,115),fill='white' if calls[0]%2 else 'black')
        return image
    guard=InputGuard(lambda:None,lambda:False,[],0,clock=lambda:clock[0])
    with pytest.raises(ProbeStopped,match=reason) as caught:
        settled_frame(grab,guard,previous=selected_card(frame_at()) if case=='stale' else None,
                      clock=lambda:clock[0],sleep=lambda seconds:clock.__setitem__(0,clock[0]+seconds),timeout=.5)
    assert caught.value.frame is not None
    assert caught.value.wait_evidence['deliveryConfirmed'] is (case=='unstable')


def test_stable_equal_panels_are_allowed_after_visible_selection_advance():
    clock=[0.0]
    second=frame_at(140)
    guard=InputGuard(lambda:None,lambda:False,[],0,clock=lambda:clock[0])
    frame,selection=settled_frame(lambda:second,guard,previous=selected_card(frame_at()),
                                clock=lambda:clock[0],sleep=lambda seconds:clock.__setitem__(0,clock[0]+seconds))
    assert selection==selected_card(second) and clock[0]>=.30


@pytest.mark.parametrize('key',['a','s','d'])
def test_keyboard_releases_our_key_and_stops_before_another_native_press(tmp_path,key):
    stopped=[False]
    guard=InputGuard(lambda:None,lambda:stopped[0],[],0)
    keyboard=Mock()
    def press(key):
        stopped[0]=True
    keyboard.press.side_effect=press
    advance=GuardedAdvance(keyboard,guard,3)
    advance.next(key)
    keyboard.release.assert_called_once_with(key)
    with pytest.raises(ProbeStopped):
        advance.next(key)
    assert keyboard.press.call_count==1 and not advance.held


def fixture_inventory(tmp_path,monkeypatch,levels, *, total=99):
    import hsr_inventory as inventory
    report={'observations':[],'maxPositions':20}
    state={'current':0}
    guard=InputGuard(lambda:None,lambda:False,[],0)
    def settle(grab, guard, previous=None):
        return frame_at(92+93*state['current'],90),[92+93*state['current'],90,81,111]
    def next_item():
        state['current']+=1
    advance=SimpleNamespace(next=next_item)
    monkeypatch.setattr(inventory,'read_header',lambda *a:{'categoryConfirmed':True,'sortConfirmed':True,'quantity':{'value':total}})
    def read(*args,**kwargs):
        level=levels[state['current']]
        return {'layoutVerified':True,'fields':{
            'name':{'state':'recognized','value':'IdenticalCopy'},
            'level':{'state':'recognized' if level is not None else 'uncertain',
                     'value':{'current':level,'max':80} if level is not None else None},
            'superimposition':{'state':'uncertain','value':None}}}
    monkeypatch.setattr(inventory,'read_panel',read)
    return (lambda:frame_at(),advance,guard,object(),tmp_path,report),{'settle':settle},state,report


def test_cutoff_preserves_copies_and_includes_exact_twenty(tmp_path,monkeypatch):
    args,kwargs,state,report=fixture_inventory(tmp_path,monkeypatch,[80,80,20,1])
    run_inventory(*args,**kwargs)
    assert len(report['observations'])==4 and state['current']==3
    assert report['scopeComplete'] and report['levelBoundary']['position']==3
    assert report['inventorySummary']['eligiblePositions']==3
    assert report['inventoryAccepted'] is False
    assert [item['position'] for item in report['observations']]==[0,1,2,3]


@pytest.mark.parametrize('scenario',['extended','stop-on-s','reverse-boundary','short-row','unreadable-reverse'])
def test_alternating_rows_preserve_order_scope_and_partial_viewport(tmp_path,monkeypatch,scenario):
    import hsr_inventory as inventory
    levels = ([80]*8+[60,50,40,30,20,10,1,1] if scenario in ('reverse-boundary','unreadable-reverse')
              else [80]*10 if scenario=='short-row' else [80]*39+[20,1])
    if scenario=='unreadable-reverse':
        levels[12]=None
    state = {'row': 0, 'column': 0, 'clock': 0.0, 'stopped':False}
    report = {'maxPositions': 2000}
    keyboard = Mock()
    def press(key):
        if key=='d':
            assert state['column']<7, 'D does not wrap at the right edge'
            state['column']+=1
        elif key=='a':
            assert state['column']>0
            state['column']-=1
        elif key=='s':
            state['row']+=1
            state['column']=min(state['column'],len(levels)-state['row']*8-1)
            if scenario=='stop-on-s':
                state['stopped']=True
    keyboard.press.side_effect=press
    guard = InputGuard(lambda:None,lambda:state['stopped'],[],0,clock=lambda:state['clock'])
    advance = GuardedAdvance(keyboard,guard,1999)
    def grab():
        frame=Image.new('RGB',(1280,720),(20,20,20))
        draw=ImageDraw.Draw(frame)
        scroll=max(0,90+state['row']*116-476)
        for row in range(8):
            for column in range(8):
                if row*8+column>=len(levels):
                    continue
                x,y=92+93*column,90+116*row-scroll
                draw.rectangle((x,y,x+90,y+107),fill=(30+(row*53)%140,40+column*12,50+(row*43)%140))
                if row==state['row'] and column==state['column']:
                    draw.rectangle((x,y,x+90,y+107),outline='white',width=3)
        draw.rectangle((0,0,1280,78),fill=(20,20,20))
        return frame
    def settle(grab,guard,**kwargs):
        return settled_frame(grab,guard,clock=lambda:state['clock'],
                             sleep=lambda seconds:state.__setitem__('clock',state['clock']+seconds),**kwargs)
    total=10 if scenario=='short-row' else 252
    monkeypatch.setattr(inventory,'read_header',lambda *a:{'categoryConfirmed':True,'sortConfirmed':True,'quantity':{'value':total}})
    def read(*args,**kwargs):
        current=levels[state['row']*8+state['column']]
        return {'layoutVerified':True,'fields':{
            'name':{'state':'recognized','value':'Same literal name'},
            'level':{'state':'recognized' if current is not None else 'uncertain',
                     'value':{'current':current,'max':80} if current is not None else None},
            'superimposition':{'state':'recognized','value':1}}}
    monkeypatch.setattr(inventory,'read_panel',read)
    if scenario=='stop-on-s':
        with pytest.raises(ProbeStopped):
            run_inventory(grab,advance,guard,object(),tmp_path,report,settle=settle)
        saved=json.loads((tmp_path/'session.json').read_text())
        assert len(saved['observations'])==8 and not saved['scopeComplete']
        assert [call.args[0] for call in keyboard.press.call_args_list]==['d']*7+['s']
        assert keyboard.release.call_count==8 and not advance.held
        return
    run_inventory(grab,advance,guard,object(),tmp_path,report,settle=settle)
    assert len({item['position'] for item in report['observations']})==len(levels)
    assert [item['position'] for item in report['observations']][:10]==list(range(8))+[min(15,len(levels)-1),min(15,len(levels)-1)-1]
    assert advance.requests==len(levels)-1==keyboard.release.call_count and not advance.held
    if scenario=='short-row':
        assert not report['scopeComplete'] and report['reason']=='prepared-count-reached-physical-end-unverified'
        return
    if scenario in ('reverse-boundary','unreadable-reverse'):
        assert report['levelBoundary']=={'position':13,'level':10,'source':'selected-panel-OCR'}
        assert report['scopeComplete'] is (scenario=='reverse-boundary')
        assert report['inventorySummary']['eligiblePositions']==(13 if scenario=='reverse-boundary' else 12)
        assert report['notReadByLevelOrder']==236
        assert all(item['levelEligibility']=='eligible-level' for item in report['observations'] if 8<=item['position']<=11)
        return
    assert report['scopeComplete'] and report['reason']=='level-cutoff-reached'
    assert len(report['observations'])==41 and advance.requests==40
    assert [call.args[0] for call in keyboard.press.call_args_list][:16]==['d']*7+['s']+['a']*7+['s']
    assert sum('viewportShift' in step for step in report['navigationSteps'])==2
    assert report['inventorySummary']['eligiblePositions']==40
    assert report['levelBoundary']=={'position':40,'level':1,'source':'selected-panel-OCR'}
    assert report['notReadByLevelOrder']==211 and not report['captureComplete']
    report['phase']='finished'
    save_session(tmp_path,report)
    summary=(tmp_path/'summary.md').read_text(encoding='utf-8')
    assert 'posicao 41, nivel 1 (fora do escopo)' in summary
    assert '| 40 | Same literal name | 20/80 | 1 |' in summary
    assert '| 41 | Same literal name |' not in summary


@pytest.mark.parametrize('current',[[92,322,91,108],[185,206,91,108],[742,90,91,108]])
def test_row_wrap_rejects_skipped_row_wrong_column_or_no_delivery(current):
    assert not next_selection([742,90,91,108],current,(1280,720))


def test_directional_navigation_rejects_wrong_key_delivery_and_unknown_keys():
    assert next_selection([742,90,91,108],[649,90,91,108],(1280,720),direction='a')
    assert next_selection([92,90,91,108],[92,206,91,108],(1280,720),direction='s')
    assert not next_selection([92,90,91,108],[92,90,91,108],(1280,720),direction='s')
    assert not next_selection([92,90,91,108],[185,90,91,108],(1280,720),direction='a')
    keyboard=Mock()
    advance=GuardedAdvance(keyboard,InputGuard(lambda:None,lambda:False,[],0),10)
    with pytest.raises(ProbeStopped,match='only-HSR-grid'):
        advance.next('e')
    assert advance.requests==0 and not keyboard.press.called


def test_identical_grid_cannot_prove_downward_viewport_delivery():
    frame=frame_at()
    assert downward_viewport_shift(frame,frame,[50,150,81,111]) is None


def test_partial_scroll_requires_the_correct_grid_translation_not_a_changed_panel():
    import numpy as np
    pixels=np.random.default_rng(71).integers(20,140,(720,1280),dtype=np.uint8)
    before=Image.fromarray(pixels).convert('RGB')
    previous=[92,437,90,107]
    current=[92,475,90,107]
    correct=Image.fromarray(np.roll(pixels,-77,axis=0)).convert('RGB')
    assert downward_viewport_shift(before,correct,current,previous)['upwardPixels']==77
    skipped=Image.fromarray(np.roll(pixels,-155,axis=0)).convert('RGB')
    assert downward_viewport_shift(before,skipped,current,previous) is None
    changed=before.copy()
    ImageDraw.Draw(changed).rectangle((922,65,1241,620),fill='white')
    assert downward_viewport_shift(before,changed,current,previous) is None


@pytest.mark.parametrize('box',[[188,90,91,108],[91,209,91,108]])
def test_initial_second_column_or_row_cannot_pass_as_the_first_item(tmp_path,monkeypatch,box):
    args,kwargs,state,report=fixture_inventory(tmp_path,monkeypatch,[80,80])
    kwargs['settle']=lambda *a,**kw:(frame_at(box[0],box[1]),box)
    with pytest.raises(ProbeStopped,match='select-first-light-cone'):
        run_inventory(*args,**kwargs)
    assert state['current']==0 and report['observations']==[]


def test_unknown_level_does_not_stop_and_prevents_complete_coverage(tmp_path,monkeypatch):
    args,kwargs,state,report=fixture_inventory(tmp_path,monkeypatch,[80,None,20,1])
    run_inventory(*args,**kwargs)
    assert state['current']==3 and not report['scopeComplete']
    assert report['reason']=='level-cutoff-with-unresolved-levels'


def test_contradictory_order_and_count_do_not_claim_end(tmp_path,monkeypatch):
    args,kwargs,state,report=fixture_inventory(tmp_path,monkeypatch,[20,80])
    with pytest.raises(ProbeStopped,match='order-contradiction'):
        run_inventory(*args,**kwargs)
    assert not report['scopeComplete']


def test_quantity_is_a_safety_boundary_not_proof_of_physical_end(tmp_path,monkeypatch):
    args,kwargs,state,report=fixture_inventory(tmp_path,monkeypatch,[80,80],total=2)
    run_inventory(*args,**kwargs)
    assert len(report['observations'])==2 and not report['scopeComplete'] and not report['captureComplete']
    assert report['reason']=='prepared-count-reached-physical-end-unverified'


def test_stop_during_acquisition_preserves_prior_raw_and_no_further_advance(tmp_path,monkeypatch):
    args,kwargs,state,report=fixture_inventory(tmp_path,monkeypatch,[80,80])
    def next_item():
        (tmp_path/'stop.request').write_text('stop')
        check_external_stop(tmp_path/'stop.request')
    args[1].next=next_item
    with pytest.raises(ProbeStopped,match='external-stop'):
        run_inventory(*args,**kwargs)
    saved=json.loads((tmp_path/'session.json').read_text())
    assert len(saved['observations'])==1 and saved['observations'][0]['status']=='read'


def test_cli_external_stop_before_window_detection_writes_partial_without_inputs(tmp_path,monkeypatch):
    import hsr_scan
    (tmp_path/'stop.request').write_text('stop')
    monkeypatch.setattr(hsr_scan,'HsrWindow',Mock(side_effect=AssertionError('must not inspect a window')))
    monkeypatch.setattr(sys,'argv',['hsr_scan.py',str(tmp_path),str(tmp_path),'--prepared'])
    assert hsr_scan.main()==1
    report=json.loads((tmp_path/'session.json').read_text())
    assert report['externalStop']['observed'] and report['keyRequests']==report['clickRequests']==0
    assert (tmp_path/'summary.md').exists() and (tmp_path/'review.html').exists()


@pytest.mark.parametrize('reason',['external-stop-requested','game-focus-lost'])
def test_cli_cleanup_after_stop_releases_key_closes_ocr_and_listener(tmp_path,monkeypatch,reason):
    import hsr_scan
    import pynput.keyboard
    from youkai_ocr import grid
    import zzz_ocr
    state={'focus':True}
    def check_window():
        if not state['focus']:
            raise ProbeStopped('game-focus-lost')
    window=SimpleNamespace(identity=(0,0,1280,720),pid=42,helper_level=12288,target_level=12288,
                           check=check_window,grab=Mock())
    monkeypatch.setattr(hsr_scan,'HsrWindow',lambda:window)
    event=SimpleNamespace(wait=lambda timeout:True,clear=lambda:None,is_set=lambda:False)
    listener=Mock()
    listener.is_alive.return_value=True
    monkeypatch.setattr(grid,'make_kill_listener',lambda **kw:(event,listener))
    monkeypatch.setattr(hsr_scan,'wait_for_preparation',lambda *a:None)
    keyboard=Mock()
    def native_press(key):
        if reason=='external-stop-requested':
            (tmp_path/'stop.request').write_text('stop')
        else:
            state['focus']=False
    keyboard.press.side_effect=native_press
    monkeypatch.setattr(pynput.keyboard,'Controller',lambda:keyboard)
    reader=Mock()
    monkeypatch.setattr(zzz_ocr,'make_session_recognizer',lambda *a:(reader,{'engine':'fake'}))
    def acquire(grab,advance,guard,reader,output,report):
        advance.next()
        guard.check()
    monkeypatch.setattr(hsr_scan,'run_inventory',acquire)
    monkeypatch.setattr(sys,'argv',['hsr_scan.py',str(tmp_path),str(tmp_path),'--prepared'])
    assert hsr_scan.main()==1
    report=json.loads((tmp_path/'session.json').read_text())
    assert report['reason']==reason and not report['scopeComplete']
    assert report['keyRequests']==1 and report['clickRequests']==0
    keyboard.release.assert_called_once_with('d')
    reader.close.assert_called_once()
    listener.stop.assert_called_once()
    listener.join.assert_called_once()
    assert report['guardStop']['reason']==reason
