"""Capture then process saved panels, preserving stop boundaries and partial data."""
import json
from dataclasses import replace
from unittest.mock import Mock

import pytest

from test_zzz_level_cutoff import level_fixture
from test_zzz_inventory import inventory_desktop, view
from youkai_selection import ProbeStopped, save_report
from zzz_inventory import run_inventory


def deferred_fixture(tmp_path, levels, *, grid_levels=None, detail_levels=None):
    args, kwargs, report, state, guard = level_fixture(tmp_path, levels, grid_levels=grid_levels)
    calls = []
    details = levels if detail_levels is None else detail_levels
    def reader(frame, calibration, output):
        position = int(output.name.rsplit('-', 1)[1])
        calls.append((position, len(state['clicks']), report['phase']))
        return {'scope': 'included', 'fields': {
            'name': {'state': 'uncertain', 'value': None, 'candidates': [{'key': 'NotApproved'}]},
            'level': {'state': 'recognized', 'value': {'current': details[position], 'max': 60}},
            'rarity': {'state': 'recognized', 'value': 'A'},
            'progression': {'state': 'recognized', 'value': 1},
            'lock': {'state': 'recognized', 'value': True}}}
    kwargs.update(reader=reader, defer_details=True)
    return args, kwargs, report, state, guard, calls


def test_details_wait_until_last_eligible_panel_is_saved_and_cutoff_is_observed(tmp_path):
    args, kwargs, report, state, guard, calls = deferred_fixture(tmp_path, [60, 20, 19])
    reader = kwargs['reader']
    state['processingStarted'] = False
    def processing(*args):
        assert report['scopeComplete'] is report['coverageConfirmed'] is False
        assert all((tmp_path / f'position-{i:04d}.png').exists() for i in (0, 1))
        state['processingStarted'] = True
        return reader(*args)
    original_check = guard.check
    def check():
        assert not state['processingStarted'], 'Offline OCR must not require focus or allow further inputs'
        original_check()
    guard.check = check
    kwargs['reader'] = processing
    run_inventory(*args, **kwargs)
    assert calls == [(0, 2, 'processing'), (1, 2, 'processing')]
    assert len(state['clicks']) == 2 and report['levelBoundary']['position'] == 2
    assert report['scopeComplete'] is report['coverageConfirmed'] is True
    assert report['performance']['deferredReadings'] == 2 and report['phase'] == 'finished'
    assert report['inventorySummary']['pendingProcessing'] == 0
    assert len(report['observations']) == 3 and report['inventoryAccepted'] is False
    assert all(o['reading']['fields']['name']['value'] is None for o in report['observations'][:2])


def test_unknown_grid_level_is_read_inline_to_avoid_scanning_past_its_boundary(tmp_path):
    args, kwargs, report, state, guard, calls = deferred_fixture(tmp_path, [60, 19, 0], grid_levels=[60, None, 0])
    run_inventory(*args, **kwargs)
    assert calls == [(1, 2, 'acquiring'), (0, 2, 'processing')]
    assert len(state['clicks']) == 2
    assert report['scopeComplete'] is True
    assert report['levelBoundary']['source'] == 'detail-level-after-detailed-OCR'


def test_focus_loss_stops_capture_but_already_saved_panel_is_still_processed(tmp_path):
    args, kwargs, report, state, guard, calls = deferred_fixture(tmp_path, [60, 20, 19])
    click = kwargs['click']
    def lose_focus(*args):
        if state['clicks']:
            raise ProbeStopped('game-focus-lost')
        return click(*args)
    kwargs['click'] = lose_focus
    args[2].close = Mock()
    reader = kwargs['reader']
    def processing(*args):
        args_mouse.close.assert_called_once()
        return reader(*args)
    args_mouse = args[2]
    kwargs['reader'] = processing
    with pytest.raises(ProbeStopped, match='game-focus-lost'):
        run_inventory(*args, **kwargs)
    assert len(state['clicks']) == 1 and calls == [(0, 1, 'processing')]
    assert report['observations'][0]['status'] == 'read'
    assert report['scopeComplete'] is report['coverageConfirmed'] is False
    assert report['reason'] == 'game-focus-lost'
    saved = json.loads((tmp_path / 'session.json').read_text())
    assert saved['observations'][0]['reading']['fields']['level']['value']['current'] == 60


def test_deferred_detail_conflict_keeps_both_values_and_cannot_complete_scope(tmp_path):
    args, kwargs, report, state, guard, calls = deferred_fixture(tmp_path, [60, 20, 19], detail_levels=[60, 18, 19])
    run_inventory(*args, **kwargs)
    second = report['observations'][1]
    assert second['gridLevel']['value'] == 20
    assert second['reading']['fields']['level']['value']['current'] == 18
    assert second['levelEligibility'] == 'pending-level'
    assert report['reason'] == 'detail-processing-unresolved'
    assert report['scopeComplete'] is report['coverageConfirmed'] is False


def test_inline_ocr_raw_result_survives_stop_before_another_input(tmp_path):
    args, kwargs, report, state, guard, calls = deferred_fixture(tmp_path, [20, 0], grid_levels=[None, 0])
    reader = kwargs['reader']
    stopped = [False]
    original_check = guard.check
    def check():
        if stopped[0]:
            raise ProbeStopped('stop-requested-or-listener-unavailable')
        original_check()
    def reading(*args):
        value = reader(*args)
        stopped[0] = True
        return value
    guard.check = check
    kwargs['reader'] = reading
    with pytest.raises(ProbeStopped, match='stop-requested'):
        run_inventory(*args, **kwargs)
    assert len(state['clicks']) == 1
    assert report['observations'][0]['reading']['fields']['level']['value']['current'] == 20
    assert report['scopeComplete'] is report['coverageConfirmed'] is False


def test_failed_detail_does_not_discard_other_saved_copies(tmp_path):
    args, kwargs, report, state, guard, calls = deferred_fixture(tmp_path, [60, 20, 19])
    reader = kwargs['reader']
    def fail_one(frame, calibration, output):
        if output.name == 'reading-0000':
            raise RuntimeError('OCR failure')
        return reader(frame, calibration, output)
    kwargs['reader'] = fail_one
    run_inventory(*args, **kwargs)
    assert report['inventorySummary']['failedPositions'] == [0]
    assert report['observations'][1]['status'] == 'read'
    assert report['scopeComplete'] is False and len(state['clicks']) == 2


def test_changed_saved_image_is_not_read_or_approved(tmp_path):
    args, kwargs, report, state, guard, calls = deferred_fixture(tmp_path, [60, 19])
    save = args[7]
    def change_before_processing():
        if report.get('phase') == 'processing' and (tmp_path / 'position-0000.png').exists():
            (tmp_path / 'position-0000.png').write_bytes(b'changed image')
        save()
    args = (*args[:7], change_before_processing, *args[8:])
    run_inventory(*args, **kwargs)
    assert calls == [] and report['scopeComplete'] is False
    assert report['observations'][0]['reason'] == 'captured-image-hash-mismatch'


def test_unconfirmed_selection_keeps_specific_acquisition_reason(tmp_path, monkeypatch):
    import zzz_inventory
    args, kwargs, report, state, guard, calls = deferred_fixture(tmp_path, [20, 0])
    monkeypatch.setattr(zzz_inventory, 'selection_stillness', lambda *a, **k: {'sameViewport': None})
    run_inventory(*args, **kwargs)
    assert calls == [] and report['scopeComplete'] is False
    assert report['reason'] == 'selection-stillness-unconfirmed'


def test_deferred_empty_list_requires_neither_panel_nor_reader(tmp_path):
    args, kwargs, report, state, guard, calls = deferred_fixture(tmp_path, [])
    kwargs['reader'] = Mock(side_effect=AssertionError('no item'))
    kwargs['panel_wait'] = Mock(side_effect=AssertionError('no panel'))
    run_inventory(*args, **kwargs)
    assert report['scopeComplete'] is True and report['captureComplete'] is True
    assert report['performance']['deferredReadings'] == 0


def test_deferred_active_saves_keep_json_but_render_html_after_completion_or_error(tmp_path):
    report = {'mode': 'zzz-inventory', 'status': 'running', 'observations': [],
              'phase': 'acquiring', 'performance': {'mode': 'capture-then-read'}}
    path = tmp_path / 'session.json'
    save_report(path, report)
    assert json.loads(path.read_text())['phase'] == 'acquiring'
    assert not (tmp_path / 'review.html').exists()
    report.update(phase='processing', status='processing')
    save_report(path, report)
    assert not (tmp_path / 'review.html').exists()
    report['status'] = 'stopped'
    save_report(path, report)
    assert (tmp_path / 'review.html').exists()


def test_optional_original_comparison_does_not_change_any_of_the_five_fields(tmp_path, monkeypatch):
    from types import SimpleNamespace
    from test_zzz_pilot import make_frame
    from youkai_ocr.capture import calibrate
    from youkai_ocr import wengine_scanner
    from zzz_pilot import read_frame
    comparison = Mock(return_value=(None, {}))
    monkeypatch.setattr(wengine_scanner, 'scan_single_frame_engine', comparison)
    def recognizer():
        return SimpleNamespace(read_text=lambda *a: 'Starlight Engine',
                               read_line=Mock(side_effect=['Lv. 20/20', 'T Unlock']))
    frame = make_frame(1)
    slow = read_frame(frame, calibrate(frame), tmp_path / 'diagnostic', recognizer=recognizer())
    fast = read_frame(frame, calibrate(frame), tmp_path / 'normal', recognizer=recognizer(), compare_original=False)
    assert fast['fields'] == slow['fields']
    comparison.assert_called_once()
    assert slow['originalComparison']['state'] == 'completed'
    assert fast['originalComparison']['state'] == 'not-requested'
    assert fast['originalOutput'] is None and fast['originalComparisonError'] is None


@pytest.mark.parametrize('mode', ['background', 'synchronous', 'diagnostics'])
def test_cli_selects_normal_two_phase_or_explicit_legacy_diagnostics(tmp_path, monkeypatch, inventory_desktop, mode):
    diagnostics = mode == 'diagnostics'
    import sys
    from pathlib import Path
    from types import SimpleNamespace
    from youkai_ocr import recognize
    import zzz_pilot
    from PIL import ImageDraw
    from zzz_transition import SCROLLBAR
    selection, inventory, controller, event, panel = inventory_desktop
    frame, calibration, _ = selection.capture_once(None, None, None)
    ImageDraw.Draw(frame).rectangle(calibration.scale_bbox(SCROLLBAR), fill=(0, 0, 0))
    monkeypatch.setattr(recognize, 'make_recognizer', lambda *a: SimpleNamespace(read_line=lambda *a: 'W-Engine Storage [2/2000]'))
    monkeypatch.setattr(inventory, 'AlignedInventoryObserver', lambda *a: lambda *a:
                        replace(view(0, 2, first=True, last=True), scrollbar_state='absent'))
    monkeypatch.setattr(inventory, 'read_grid_level', lambda frame, calib, center, reader:
                        {'state': 'recognized', 'value': 20 if center[0] == 166 else 0, 'raw': ['literal']})
    def panel(grab, calibration, grid, limit, expected, check, record, **kwargs):
        frame = grab()
        record(frame, {'expectedPosition': expected, 'settled': False})
        record(frame, {'expectedPosition': expected, 'settled': True})
        return frame
    monkeypatch.setattr(inventory, 'wait_for_panel', panel)
    compared = []
    def reader(*args, compare_original=True, recognizer=None):
        compared.append(compare_original)
        assert controller.press.call_count == 1
        return {'scope': 'included', 'fields': {
            'name': {'state': 'recognized', 'value': 'SameCopy'},
            'level': {'state': 'recognized', 'value': {'current': 20, 'max': 20}},
            'rarity': {'state': 'recognized', 'value': 'A'},
            'progression': {'state': 'recognized', 'value': 1},
            'lock': {'state': 'recognized', 'value': True}}}
    monkeypatch.setattr(zzz_pilot, 'read_frame', reader)
    repo = Path(__file__).resolve().parents[1]
    flags = ['--pilot', '--scan', '--inventory', '--run', '--sa-filter-prepared', '--level-descending-prepared']
    if diagnostics:
        flags.append('--diagnostics')
    elif mode == 'synchronous':
        flags.append('--synchronous-evidence')
    monkeypatch.setattr(sys, 'argv', ['youkai_selection.py', str(repo / '.cache/youkai-p1'), str(tmp_path), *flags])
    assert selection.main() == 0
    report = json.loads((tmp_path / 'session.json').read_text())
    assert report['coverageConfirmed'] is True and report['inventorySummary']['eligiblePositions'] == 1
    assert compared == [diagnostics]
    assert ('performance' in report) is not diagnostics
    assert report['evidenceWriting']['mode'] == ('background' if mode == 'background' else 'synchronous')
    if mode == 'background':
        assert report['evidenceWriting']['pending'] == 0
        assert report['evidenceWriting']['written'] == report['evidenceWriting']['submitted']
        assert report['performance']['panelPolling']['stableSeconds'] == .25
    assert (tmp_path / 'review.html').exists() and (tmp_path / 'summary.md').exists()


@pytest.mark.parametrize('reason', ['F8', 'game-focus-lost', 'disk-full'])
def test_cli_background_failure_drains_and_saves_partial_without_false_success(
        tmp_path, monkeypatch, inventory_desktop, reason):
    import sys
    from pathlib import Path
    from types import SimpleNamespace
    from PIL import ImageDraw
    from youkai_ocr import recognize
    from zzz_transition import SCROLLBAR
    import zzz_evidence
    selection, inventory, controller, event, _ = inventory_desktop
    frame, calibration, _ = selection.capture_once(None, None, None)
    ImageDraw.Draw(frame).rectangle(calibration.scale_bbox(SCROLLBAR), fill=(0, 0, 0))
    monkeypatch.setattr(recognize, 'make_recognizer', lambda *a: SimpleNamespace(
        read_line=lambda *a: 'W-Engine Storage [2/2000]'))
    monkeypatch.setattr(inventory, 'AlignedInventoryObserver', lambda *a: lambda *a:
                        replace(view(0, 2, first=True, last=True), scrollbar_state='absent'))
    monkeypatch.setattr(inventory, 'read_grid_level', lambda *a: {'state': 'recognized', 'value': 20})
    if reason == 'disk-full':
        def fail(*args):
            raise OSError('disk-full')
        factory = zzz_evidence.BufferedEvidenceWriter
        monkeypatch.setattr(zzz_evidence, 'BufferedEvidenceWriter', lambda **kw: factory(persist=fail, **kw))
    def panel(grab, calibration, grid, limit, expected, check, record, **kwargs):
        record(grab(), {'expectedPosition': expected, 'settled': False})
        if reason == 'disk-full':
            record(grab(), {'expectedPosition': expected, 'settled': True})
        raise ProbeStopped(reason)
    monkeypatch.setattr(inventory, 'wait_for_panel', panel)
    repo = Path(__file__).resolve().parents[1]
    flags = ['--pilot', '--scan', '--inventory', '--run', '--sa-filter-prepared', '--level-descending-prepared']
    monkeypatch.setattr(sys, 'argv', ['youkai_selection.py', str(repo / '.cache/youkai-p1'), str(tmp_path), *flags])
    assert selection.main() == 1
    report = json.loads((tmp_path / 'session.json').read_text())
    assert report['scopeComplete'] is report['coverageConfirmed'] is False
    assert report['evidenceWriting']['pending'] == 0
    assert report['pressRequests'] == (0 if reason == 'disk-full' else 1)
    assert report['scrollRequests'] == 0
    assert reason in report['reason']
    assert not any(o.get('reading') for o in report['observations'])
    if reason != 'disk-full':
        assert len(report['frames']) >= 1
        assert all(Path(f['path']).is_file() for f in report['frames'])
    else:
        assert report['evidenceWriting']['errors']
