"""Inventory contracts with explicit synthetic evidence; no live detector calibration."""
import ctypes
import json
import sys
from dataclasses import replace
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from youkai_ocr.capture import calibrate
from youkai_ocr.grid import DEFAULT_GRID
from youkai_selection import InputGuard, ProbeStopped, save_report
from zzz_inventory import (InventoryView, MappedGrid, REFERENCE_STAGES, VisibleCard,
                           collect_inventory_references, run_inventory, uncalibrated_view, validate_view)
from zzz_pilot import PanelNotReady, wait_for_panel
from zzz_transition import ViewportNotReady, wait_for_viewport
from test_zzz_transition import viewport


def wait_with_fake_time(wait, *args, **kwargs):
    now = [0.0]
    return wait(*args, **kwargs, clock=lambda: now[0], sleep=lambda seconds: now.__setitem__(0, now[0] + seconds))


def view(start, count, *, first=False, last=False, safe=36, y=242, advance=None, verified=True):
    cards = tuple(VisibleCard(index, (166 + (slot % 9) * 135, y + (slot // 9) * 175), slot < safe)
                  for slot, index in enumerate(range(start, start + count)))
    return InventoryView(cards, first, last, verified, advance, {'source': 'synthetic-contract-fixture'})


def run_fixture(tmp_path, views, *, cap=2000, scope=True, max_scrolls=230, fail=None):
    state = {'view': 0, 'clicks': [], 'wheels': 0}
    frame = viewport()
    calibration = calibrate(frame)
    report = {'status': 'running', 'mode': 'zzz-inventory', 'maxPositions': cap, 'maxScrolls': max_scrolls,
              'scopePreparation': {'confirmed': scope}, 'observations': []}
    def check():
        if fail == 'focus' and state['wheels']:
            raise ProbeStopped('game-focus-lost')
    guard = InputGuard(check, lambda: False, [], cap, timeout=9999,
                       scroll_target=calibration.to_screen(*DEFAULT_GRID.cell_center(4, 1)), max_scrolls=max_scrolls)
    def wheel(dx, dy):
        guard.scroll(mouse.position, dx, dy)
        state['wheels'] += 1
        if fail != 'stall':
            state['view'] += 1
    mouse = SimpleNamespace(position=(0, 0), scroll=wheel)
    def click(mouse, x, y):
        mouse.position = (x, y)
        guard.press((x, y))
        state['clicks'].append((x, y))
    def panel(grab, calibration, grid, count, expected, check, record):
        check()
        if fail == 'panel':
            raise PanelNotReady('selected-panel-not-ready')
        return grab()
    def reader(frame, calibration, output):
        index = len(state['clicks']) - 1
        return {'scope': 'excluded-B' if index == 2 else 'pending-rarity' if index == 3 else 'included',
                'fields': {'name': {'state': 'uncertain' if index == 1 else 'recognized',
                                    'value': None if index == 1 else 'IdenticalCopy'},
                           'level': {'state': 'recognized', 'value': {'current': 0, 'max': 10}}}}
    def save():
        save_report(tmp_path / 'session.json', report)
    def viewport_wait(grab, calibration, check, record):
        check()
        return grab()
    args = (calibration, lambda: frame, mouse, guard, Mock(), report, tmp_path, save, DEFAULT_GRID)
    kwargs = dict(observe=lambda *args: views[state['view']], click=click, reader=reader,
                  panel_wait=panel, viewport_wait=viewport_wait)
    return args, kwargs, report, state, guard


@pytest.mark.parametrize('count', [0, 1, 9, 14, 36])
def test_short_or_empty_list_finishes_only_with_explicit_start_occupancy_and_end(tmp_path, count):
    args, kwargs, report, state, guard = run_fixture(tmp_path, [view(0, count, first=True, last=True)])
    panel = Mock(wraps=kwargs['panel_wait'])
    kwargs['panel_wait'] = panel
    run_inventory(*args, **kwargs)
    assert report['captureComplete'] is report['coverageConfirmed'] is True
    assert report['inventoryAccepted'] is False and report['endOfInventory'] is True
    assert report['processedPositions'] == count and state['wheels'] == 0
    assert len(state['clicks']) == count and panel.call_count == count
    assert [item['position'] for item in report['observations']] == list(range(count))
    if not count:
        panel.assert_not_called()
        assert report['status'] == 'inventory-captured'


@pytest.mark.parametrize('total', [41, 45])
def test_fractional_tail_maps_new_positions_and_reads_last_row_without_content_identity(tmp_path, total):
    views = [view(0, 36, first=True, safe=27), view(9, 36, safe=27, advance=175),
             view(18, total - 18, last=True, y=329.5, advance=87.5)]
    args, kwargs, report, state, guard = run_fixture(tmp_path, views)
    run_inventory(*args, **kwargs)
    assert report['captureComplete'] is report['coverageConfirmed'] is True
    assert state['wheels'] == 2 and len(state['clicks']) == total
    assert [item['position'] for item in report['observations']] == list(range(total))
    assert report['transitions'][-1]['advancedPixels'] == 87.5
    assert all(step['verified'] for step in report['transitions'])
    assert report['observations'][-1]['center'][1] == 679.5
    assert report['inventorySummary']['scopeCounts'] == {'included': total - 2, 'excluded-B': 1, 'pending-rarity': 1}
    assert report['inventorySummary']['uncertainFields'] == [{'position': 1, 'fields': ['name']}]
    assert all(item['humanApproved'] is False for item in report['observations'])


@pytest.mark.parametrize('kind,reason', [('unknown', 'occupancy-unconfirmed'), ('empty-end-unknown', 'empty-list-end-unconfirmed'),
                                       ('start-unknown', 'inventory-start-unconfirmed')])
def test_missing_empty_or_start_evidence_never_uses_a_panel_or_click(tmp_path, kind, reason):
    candidate = InventoryView() if kind == 'unknown' else view(0, 0, first=True)
    if kind == 'start-unknown':
        candidate = replace(view(0, 9, last=True), at_start=None)
    args, kwargs, report, state, guard = run_fixture(tmp_path, [candidate])
    kwargs['panel_wait'] = Mock(side_effect=AssertionError('must not consult an item panel'))
    run_inventory(*args, **kwargs)
    assert report['reason'] == reason and report['status'] == 'inventory-inconclusive'
    assert not state['clicks'] and not state['wheels']
    assert report['captureComplete'] is report['coverageConfirmed'] is False


@pytest.mark.parametrize('issue', ['stall', 'ambiguous', 'gap', 'no-overlap'])
def test_unverified_transition_preserves_prefix_and_never_claims_end(tmp_path, issue):
    second = view(0, 36, advance=0)
    if issue == 'ambiguous':
        second = view(9, 36, advance=175, verified=False)
    elif issue == 'gap':
        second = replace(view(9, 36, advance=175), cards=(VisibleCard(9, (166, 242)), VisibleCard(28, (301, 242))))
    elif issue == 'no-overlap':
        second = view(36, 36, advance=700)
    args, kwargs, report, state, guard = run_fixture(tmp_path, [view(0, 36, first=True, safe=27), second])
    run_inventory(*args, **kwargs)
    assert report['processedPositions'] == 27 and len(state['clicks']) == 27
    assert state['wheels'] == 1 and report['transitions'][0]['verified'] is False
    assert report['coverageConfirmed'] is report['captureComplete'] is False
    assert report['endOfInventory'] is None


@pytest.mark.parametrize('cap,scrolls,reason,count', [(10, 230, 'position-safety-limit', 10), (2000, 0, 'scroll-safety-limit', 27)])
def test_safety_limits_are_incomplete_results(tmp_path, cap, scrolls, reason, count):
    args, kwargs, report, state, guard = run_fixture(tmp_path, [view(0, 36, first=True, safe=27)], cap=cap, max_scrolls=scrolls)
    run_inventory(*args, **kwargs)
    assert report['reason'] == reason and report['processedPositions'] == count
    assert report['captureComplete'] is report['coverageConfirmed'] is False
    assert state['wheels'] == 0


@pytest.mark.parametrize('failure', ['focus', 'panel'])
def test_interruptions_preserve_read_or_failed_positions_without_more_inputs(tmp_path, failure):
    args, kwargs, report, state, guard = run_fixture(tmp_path, [view(0, 36, first=True, safe=27)], fail=failure)
    with pytest.raises((ProbeStopped, PanelNotReady)):
        run_inventory(*args, **kwargs)
    assert len(state['clicks']) == (27 if failure == 'focus' else 1)
    assert report['captureComplete'] is report['coverageConfirmed'] is False
    if failure == 'panel':
        assert report['observations'][0]['status'] == 'failed'
    else:
        assert all(item['status'] == 'read' for item in report['observations'])


def test_complete_path_with_unconfirmed_scope_is_not_target_coverage(tmp_path):
    args, kwargs, report, state, guard = run_fixture(tmp_path, [view(0, 1, first=True, last=True)], scope=False)
    run_inventory(*args, **kwargs)
    assert report['captureComplete'] is True and report['endOfInventory'] is True
    assert report['coverageConfirmed'] is report['inventoryAccepted'] is False
    assert report['reason'] == 'scope-preparation-unconfirmed'


def test_nonselectable_final_card_does_not_disappear_or_complete(tmp_path):
    args, kwargs, report, state, guard = run_fixture(tmp_path, [view(0, 9, first=True, last=True, safe=8)])
    run_inventory(*args, **kwargs)
    assert report['processedPositions'] == 8 and report['reason'] == 'final-position-not-selectable'
    assert report['captureComplete'] is False


def test_viewport_can_settle_with_empty_list_no_selection_and_no_progression():
    frame = Image.new('RGB', (1280, 720), (20, 20, 20))
    evidence = []
    settled = wait_with_fake_time(wait_for_viewport, lambda: frame, calibrate(frame), lambda: None,
                                  lambda frame, item: evidence.append(item))
    assert settled is frame and evidence[-1]['settled'] is True
    assert evidence[-1]['panelRequired'] is evidence[-1]['selectionRequired'] is False
    assert uncalibrated_view(frame, calibrate(frame), DEFAULT_GRID).cards is None
    with pytest.raises(PanelNotReady):
        wait_with_fake_time(wait_for_panel, lambda: frame, calibrate(frame), DEFAULT_GRID, 36, 0, lambda: None, lambda *args: None)


def test_stable_panel_cannot_hide_moving_viewport():
    frames = [Image.new('RGB', (1280, 720), (20, 20, 20)) for _ in range(2)]
    for frame, color in zip(frames, ('black', 'white')):
        ImageDraw.Draw(frame).rectangle((40, 114, 920, 600), fill=color)
    state = [0]
    def grab():
        state[0] += 1
        return frames[state[0] % 2]
    with pytest.raises(ViewportNotReady):
        wait_with_fake_time(wait_for_viewport, grab, calibrate(frames[0]), lambda: None, lambda *args: None)


def test_panel_changes_do_not_prevent_list_stabilization():
    frames = [viewport(), viewport()]
    ImageDraw.Draw(frames[1]).rectangle((940, 175, 1270, 540), fill='black')
    state = [0]
    def grab():
        state[0] += 1
        return frames[state[0] % 2]
    evidence = []
    wait_with_fake_time(wait_for_viewport, grab, calibrate(frames[0]), lambda: None, lambda frame, item: evidence.append(item))
    assert evidence[-1]['settled'] is True


def test_animated_scenery_above_storage_label_does_not_block_list_stabilization():
    frames = [viewport(), viewport()]
    calibration = calibrate(frames[0])
    ImageDraw.Draw(frames[1]).rectangle(calibration.scale_bbox((20, 95, 560, 118)), fill='white')
    state = [0]
    def grab():
        state[0] += 1
        return frames[state[0] % 2]
    evidence = []
    wait_with_fake_time(wait_for_viewport, grab, calibration, lambda: None,
                       lambda frame, item: evidence.append(item))
    assert evidence[-1]['settled'] is True


@pytest.mark.parametrize('box', [(20, 120, 560, 155), (1358, 232, 1373, 872)])
def test_changing_storage_label_or_scrollbar_still_blocks_list_stabilization(box):
    frames = [viewport(), viewport()]
    calibration = calibrate(frames[0])
    for frame, color in zip(frames, ('black', 'white')):
        ImageDraw.Draw(frame).rectangle(calibration.scale_bbox(box), fill=color)
    state = [0]
    def grab():
        state[0] += 1
        return frames[state[0] % 2]
    with pytest.raises(ViewportNotReady):
        wait_with_fake_time(wait_for_viewport, grab, calibration, lambda: None, lambda *args: None)


def test_mapped_panel_selection_uses_fractional_card_center():
    from test_zzz_pilot import make_frame
    frame = make_frame()
    # Erase the fixed-grid selection and draw the same validated contour at the measured tail center.
    draw = ImageDraw.Draw(frame)
    draw.rectangle((65, 135, 160, 210), fill=(20, 20, 20))
    x, y = (166, 329.5)
    draw.rectangle((round((x-63)*2/3), round((y-31)*2/3), round((x+63)*2/3), round((y-23)*2/3)), fill=(220, 240, 10))
    draw.rectangle((round((x-64)*2/3), round((y-18)*2/3), round((x-56)*2/3), round((y+65)*2/3)), fill=(220, 240, 10))
    mapped = MappedGrid((VisibleCard(18, (x, y)),))
    result = wait_with_fake_time(wait_for_panel, lambda: frame, calibrate(frame), mapped, 1, 0, lambda: None, lambda *args: None)
    assert result is frame


def test_grouped_references_keep_all_stages_and_unknown_facts_in_one_session(tmp_path):
    frame = viewport()
    calibration = calibrate(frame)
    report = {'mode': 'zzz-inventory', 'status': 'running', 'observations': []}
    stages = []
    save = lambda: save_report(tmp_path / 'session.json', report)
    collect_inventory_references(calibration, lambda: frame, SimpleNamespace(check=lambda: None), Mock(), report,
                                 tmp_path, save, DEFAULT_GRID, lambda name, text: stages.append(name),
                                 viewport_wait=lambda grab, *args: grab(), read_header=lambda frame: {'raw': ['1567/2000'], 'meaning': 'unconfirmed'})
    assert stages == [stage for stage, _ in REFERENCE_STAGES]
    assert report['referenceCollectionComplete'] is True
    assert all(item['viewCandidates']['cards'] is None for item in report['references'])
    assert all(item['header']['meaning'] == 'unconfirmed' for item in report['references'])
    assert all(Path(item['frame']).exists() for item in report['references'])
    assert 'Grouped references' in (tmp_path / 'review.html').read_text(encoding='utf-8')


def test_reference_failure_preserves_captured_and_pending_stages(tmp_path):
    frame = viewport()
    report = {'mode': 'zzz-inventory', 'status': 'running', 'observations': []}
    def stage(name, text):
        if name == 'prepared-top':
            raise ProbeStopped('stop-requested-or-listener-unavailable')
    with pytest.raises(ProbeStopped):
        collect_inventory_references(calibrate(frame), lambda: frame, SimpleNamespace(check=lambda: None), Mock(), report,
                                     tmp_path, lambda: save_report(tmp_path / 'session.json', report), DEFAULT_GRID, stage,
                                     viewport_wait=lambda grab, *args: grab())
    saved = json.loads((tmp_path / 'session.json').read_text())
    assert len(saved['references']) == 2 and saved['referencePlan'][2]['status'] == 'waiting'
    assert saved.get('referenceCollectionComplete', False) is False


@pytest.mark.parametrize('flags', [ ['--inventory'], ['--pilot', '--scan', '--inventory', '--selected-row'],
                                  ['--pilot', '--scan', '--collect-references', '--run'],
                                  ['--pilot', '--scan', '--inventory', '--max-positions', '2001'] ])
def test_invalid_inventory_cli_stops_before_session_creation(tmp_path, monkeypatch, flags):
    import youkai_selection
    output = tmp_path / 'not-created'
    monkeypatch.setattr(sys, 'argv', ['youkai_selection.py', str(tmp_path), str(output), *flags])
    with pytest.raises(SystemExit):
        youkai_selection.main()
    assert not output.exists()

@pytest.fixture
def inventory_desktop(monkeypatch):
    """Only public capture/controller interfaces are replaced; the CLI saves real reports."""
    import pynput.mouse
    import win32gui
    import win32process
    import youkai_selection as selection
    import zzz_inventory as inventory
    from youkai_ocr import capture, grid, recognize, wengine_scanner
    import zzz_ocr
    monkeypatch.setattr(zzz_ocr, 'make_session_recognizer', lambda cache, factory:
                        (factory('tesseract'), {'engine': 'simulated-pytesseract'}))
    frame = Image.new('RGB', (1280, 720), (20, 20, 20))
    calibration = calibrate(frame)
    window = {'hwnd': 1, 'title': 'ZenlessZoneZero', 'left': 0, 'top': 0, 'w': 1280, 'h': 720}
    monkeypatch.setattr(ctypes.windll.user32, 'SetProcessDPIAware', Mock())
    monkeypatch.setattr(ctypes.windll.user32, 'GetDpiForWindow', Mock(return_value=96))
    monkeypatch.setattr(win32gui, 'IsWindow', lambda hwnd: True)
    monkeypatch.setattr(win32gui, 'IsWindowVisible', lambda hwnd: True)
    monkeypatch.setattr(win32gui, 'IsIconic', lambda hwnd: False)
    monkeypatch.setattr(win32gui, 'GetForegroundWindow', lambda: 1)
    monkeypatch.setattr(win32gui, 'GetClientRect', lambda hwnd: (0, 0, 1280, 720))
    monkeypatch.setattr(win32gui, 'ClientToScreen', lambda hwnd, point: (0, 0))
    monkeypatch.setattr(win32process, 'GetWindowThreadProcessId', lambda hwnd: (1, 42))
    monkeypatch.setattr(selection, 'integrity_level', lambda *args: 12288)
    monkeypatch.setattr(capture, 'list_game_windows', lambda: [window])
    monkeypatch.setattr(selection, 'capture_once', lambda *args, **kwargs: (frame, calibration, window))
    monkeypatch.setattr(capture, 'calibrate_window', lambda: (calibration, lambda: frame))
    monkeypatch.setattr(selection.time, 'sleep', lambda seconds: None)
    class Event:
        flag = False
        def wait(self, timeout): self.flag = True; return True
        def clear(self): self.flag = False
        def is_set(self): return self.flag
    event = Event()
    listener = Mock()
    listener.is_alive.return_value = True
    monkeypatch.setattr(grid, 'make_kill_listener', lambda **kwargs: (event, listener))
    controller = Mock()
    controller.position = (0, 0)
    monkeypatch.setattr(pynput.mouse, 'Controller', lambda: controller)
    monkeypatch.setattr(recognize, 'make_recognizer', lambda *args: SimpleNamespace(read_line=lambda *args: 'W-Engine Storage [0/2000]'))
    def header(frame, calibration, reader):
        reader.read_line(frame, 'white_text_on_dark')
        return None
    monkeypatch.setattr(wengine_scanner, 'read_engine_count', header)
    real_wait = inventory.wait_for_viewport
    monkeypatch.setattr(inventory, 'wait_for_viewport', lambda *args, **kwargs: wait_with_fake_time(real_wait, *args, **kwargs))
    panel = Mock(side_effect=AssertionError('empty or unknown list must not query an item panel'))
    monkeypatch.setattr(inventory, 'wait_for_panel', panel)
    return selection, inventory, controller, event, panel


@pytest.mark.parametrize('confirmed_empty', [False, True])
def test_inventory_cli_does_not_require_a_count_selection_or_item_panel(tmp_path, monkeypatch, inventory_desktop, confirmed_empty):
    selection, inventory, controller, event, panel = inventory_desktop
    if confirmed_empty:
        monkeypatch.setattr(inventory, 'AlignedInventoryObserver', lambda *args: lambda *args: view(0, 0, first=True, last=True))
    repo = Path(__file__).resolve().parents[1]
    monkeypatch.setattr(sys, 'argv', ['youkai_selection.py', str(repo / '.cache/youkai-p1'), str(tmp_path),
                                    '--pilot', '--scan', '--inventory', '--run', '--full-inventory'])
    assert selection.main() == 0
    report = json.loads((tmp_path / 'session.json').read_text())
    assert report['mode'] == 'zzz-inventory'
    assert report['globalCountCandidate'] is None
    assert report['processedPositions'] == report['pressRequests'] == report['scrollRequests'] == 0
    assert report['inventoryAccepted'] is report['coverageConfirmed'] is False
    assert report['captureComplete'] is confirmed_empty
    assert report['reason'] == ('scope-preparation-unconfirmed' if confirmed_empty else 'cell-occupancy-or-alignment-unconfirmed')
    panel.assert_not_called()
    controller.press.assert_not_called()
    controller.scroll.assert_not_called()
    assert all(not entry['inventoryCheck']['panelRequired'] for entry in report['frames'])
    assert 'zzz_inventory.py' in report['readerSourceSha256']


def test_grouped_references_cli_preserves_contract_and_zero_input_budgets(tmp_path, monkeypatch, inventory_desktop):
    import pynput.keyboard
    selection, inventory, controller, event, panel = inventory_desktop
    listener = Mock()
    monkeypatch.setattr(pynput.keyboard, 'Listener', lambda **kwargs: listener)
    real_collect = inventory.collect_inventory_references
    def collect(*args, **kwargs):
        # Human checkpoint signals are simulated, capture/stabilization/reporting stay integrated.
        args = list(args)
        args[8] = lambda *args: None
        return real_collect(*args, **kwargs)
    monkeypatch.setattr(inventory, 'collect_inventory_references', collect)
    repo = Path(__file__).resolve().parents[1]
    monkeypatch.setattr(sys, 'argv', ['youkai_selection.py', str(repo / '.cache/youkai-p1'), str(tmp_path),
                                    '--pilot', '--scan', '--inventory', '--run', '--collect-references'])
    assert selection.main() == 0
    report = json.loads((tmp_path / 'session.json').read_text())
    assert report['referenceCollectionComplete'] is True and len(report['references']) == 7
    assert report['pressBudget'] == report['scrollBudget'] == 0 and report['scrollAllowed'] is False
    assert report['pressRequests'] == report['scrollRequests'] == report['mouseMoves'] == 0
    assert report['status'] == 'references-collected' and report['reason'] == 'grouped-references-complete'
    assert report['captureComplete'] is report['coverageConfirmed'] is report['inventoryAccepted'] is False
    assert report.get('inventoryViews', []) == []
    assert report['references'][2]['header']['raw'] == ['W-Engine Storage [0/2000]']
    assert any(entry['inventoryCheck'].get('phase') == 'last-card' for entry in report['frames'])
    controller.press.assert_not_called()
    controller.scroll.assert_not_called()
    panel.assert_not_called()
    listener.stop.assert_called_once()


def test_inventory_cli_stop_during_viewport_wait_saves_partial_without_inputs(tmp_path, monkeypatch, inventory_desktop):
    selection, inventory, controller, event, panel = inventory_desktop
    def stop(grab, calibration, check, record):
        event.flag = True
        check()
    monkeypatch.setattr(inventory, 'wait_for_viewport', stop)
    repo = Path(__file__).resolve().parents[1]
    monkeypatch.setattr(sys, 'argv', ['youkai_selection.py', str(repo / '.cache/youkai-p1'), str(tmp_path),
                                    '--pilot', '--scan', '--inventory', '--run', '--level-descending-prepared'])
    assert selection.main() == 1
    report = json.loads((tmp_path / 'session.json').read_text())
    assert report['status'] == 'stopped' and report['reason'] == 'stop-requested-or-listener-unavailable'
    assert report['pressRequests'] == report['scrollRequests'] == 0 and report['observations'] == []
    assert report['guardStop']['noPressesAfterObservation'] is True
    controller.press.assert_not_called()
    controller.scroll.assert_not_called()


def test_selection_that_moves_viewport_is_not_read(tmp_path):
    args, kwargs, report, state, guard = run_fixture(tmp_path, [view(0, 1, first=True, last=True)])
    kwargs['panel_wait'] = lambda *args: viewport(offset=1, thumb=162)
    kwargs['reader'] = Mock()
    with pytest.raises(RuntimeError, match='viewport-moved-during-selection'):
        run_inventory(*args, **kwargs)
    kwargs['reader'].assert_not_called()
    assert report['observations'][0]['status'] == 'failed' and report['processedPositions'] == 0


def test_position_map_cannot_claim_movement_while_reusing_same_centers():
    before = view(0, 36, first=True)
    after = view(0, 36, advance=175, last=True)
    assert validate_view(after, before, 27) == 'position-map-motion-conflict'

@pytest.mark.parametrize('first_capture_without_focus', [False, True])
def test_passive_preparation_allows_chat_but_each_capture_requires_game_focus(tmp_path, monkeypatch, inventory_desktop, first_capture_without_focus):
    import pynput.keyboard
    import win32gui
    selection, inventory, controller, event, panel = inventory_desktop
    state = {'focus': 1, 'signals': 0, 'callback': None}
    monkeypatch.setattr(win32gui, 'GetForegroundWindow', lambda: state['focus'])
    monkeypatch.setattr(ctypes.windll.kernel32, 'Beep', Mock(return_value=True))
    listener = Mock()
    listener.is_alive.return_value = True
    def make_listener(**kwargs):
        state['callback'] = kwargs['on_release']
        return listener
    monkeypatch.setattr(pynput.keyboard, 'Listener', make_listener)
    def sleep(seconds):
        if seconds == .05:
            state['signals'] += 1
            state['focus'] = 2 if first_capture_without_focus and state['signals'] == 1 else 1
            state['callback'](pynput.keyboard.Key.f9)
    monkeypatch.setattr(selection.time, 'sleep', sleep)
    real_collect = inventory.collect_inventory_references
    def collect(*args, **kwargs):
        args = list(args)
        original_await = args[8]
        def await_with_chat(*args):
            state['focus'] = 2
            return original_await(*args)
        args[8] = await_with_chat
        return real_collect(*args, **kwargs)
    monkeypatch.setattr(inventory, 'collect_inventory_references', collect)
    repo = Path(__file__).resolve().parents[1]
    monkeypatch.setattr(sys, 'argv', ['youkai_selection.py', str(repo / '.cache/youkai-p1'), str(tmp_path),
                                    '--pilot', '--scan', '--inventory', '--run', '--collect-references'])
    assert selection.main() == 0
    report = json.loads((tmp_path / 'session.json').read_text())
    assert report['referenceCollectionComplete'] is True and len(report['references']) == 7
    assert report['preparationMayLoseFocus'] is True and report['captureRequiresGameFocus'] is True
    assert report['pressRequests'] == report['scrollRequests'] == report['mouseMoves'] == 0
    assert len(report.get('captureAttempts', [])) == int(first_capture_without_focus)
    if first_capture_without_focus:
        assert report['captureAttempts'][0]['reason'] == 'game-focus-lost'
    controller.press.assert_not_called()
    controller.scroll.assert_not_called()


def test_inventory_cli_applies_default_level_cut_without_clicking_low_items(tmp_path, monkeypatch, inventory_desktop):
    from youkai_ocr import recognize
    selection, inventory, controller, event, panel = inventory_desktop
    monkeypatch.setattr(recognize, 'make_recognizer', lambda *args: SimpleNamespace(read_line=lambda *args: 'W-Engine Storage [1/2000]'))
    monkeypatch.setattr(inventory, 'AlignedInventoryObserver', lambda *args: lambda *args: view(0, 1, first=True, last=True))
    monkeypatch.setattr(inventory, 'read_grid_level', lambda *args: {'state': 'recognized', 'value': 0, 'raw': ['Lv.0','Lv. 0']})
    repo = Path(__file__).resolve().parents[1]
    monkeypatch.setattr(sys, 'argv', ['youkai_selection.py', str(repo / '.cache/youkai-p1'), str(tmp_path),
                                    '--pilot', '--scan', '--inventory', '--run', '--sa-filter-prepared', '--level-descending-prepared'])
    assert selection.main() == 0
    report = json.loads((tmp_path / 'session.json').read_text())
    assert report['minLevel'] == 20 and report['preparedListTotal'] == 1
    assert report['processedPositions'] == 1 and report['inventorySummary']['readPositions'] == 0
    assert report['inventorySummary']['excludedByLevel'] == 1 and report['inventorySummary']['eligiblePositions'] == 0
    assert report['captureComplete'] is report['coverageConfirmed'] is True
    assert report['inventoryAccepted'] is False
    assert report['pressRequests'] == report['scrollRequests'] == 0
    assert 'gridLevel' in (tmp_path / 'review.html').read_text(encoding='utf-8')
    panel.assert_not_called()
    controller.press.assert_not_called()
