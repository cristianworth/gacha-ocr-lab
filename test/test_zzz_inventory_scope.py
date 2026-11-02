"""Focused regression for missing scrollbars, grid-level scope and saved alignment references."""
import hashlib
import json
from dataclasses import replace
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from PIL import ImageDraw

from test_zzz_inventory import run_fixture, view
from youkai_ocr.capture import calibrate
from youkai_ocr.grid import DEFAULT_GRID
from zzz_inventory import (AlignedInventoryObserver, InventoryView, classify_grid, level_decision,
                           parse_storage_count, read_grid_level, run_inventory)
from zzz_transition import SCROLLBAR, scrollbar_evidence, selection_stillness


def remove_scrollbar(frame, calibration):
    ImageDraw.Draw(frame).rectangle(calibration.scale_bbox(SCROLLBAR), fill='black')


@pytest.mark.parametrize('absence_confirmed', [False, True])
def test_identical_short_list_without_thumb_needs_explicit_absence_evidence(tmp_path, absence_confirmed):
    candidate = replace(view(0, 1, first=True, last=True), scrollbar_state='absent' if absence_confirmed else 'unreadable')
    args, kwargs, report, state, guard = run_fixture(tmp_path, [candidate])
    frame = args[1]()
    remove_scrollbar(frame, args[0])
    reader = Mock(wraps=kwargs['reader'])
    kwargs['reader'] = reader
    run_inventory(*args, **kwargs)
    assert report['captureComplete'] is absence_confirmed
    assert report['observations'][0]['viewportCheck']['sameViewport'] is (True if absence_confirmed else None)
    assert reader.call_count == int(absence_confirmed)
    if not absence_confirmed:
        assert report['reason'] == 'selection-stillness-unconfirmed'
        assert report['observations'][0]['status'] == 'pending-selection'
        assert 'moved' not in report['reason']


def test_declared_absence_does_not_hide_a_broken_bright_scrollbar(tmp_path):
    args, kwargs, report, state, guard = run_fixture(tmp_path, [replace(view(0, 1, first=True, last=True), scrollbar_state='absent')])
    kwargs['reader'] = Mock()
    run_inventory(*args, **kwargs)
    assert report['reason'] == 'selection-stillness-unconfirmed'
    kwargs['reader'].assert_not_called()


@pytest.mark.parametrize('minimum,excluded,eligible', [(20, 2, 3), (40, 4, 1)])
def test_level_cut_skips_detail_before_click_and_never_stops_at_first_low_item(tmp_path, minimum, excluded, eligible):
    levels = [0, 19, 20, 39, 40, None]
    args, kwargs, report, state, guard = run_fixture(tmp_path, [view(0, len(levels), first=True, last=True)])
    report.update({'minLevel': minimum, 'preparedListTotal': len(levels)})
    def probe(frame, calibration, center):
        index = int((center[0] - 166) / 135)
        return {'state': 'recognized' if levels[index] is not None else 'uncertain', 'value': levels[index], 'raw': []}
    def reader(*args):
        current = levels[report['observations'][-1]['position']]
        return {'scope': 'included', 'fields': {'name': {'state': 'recognized', 'value': 'RepeatedCopy'},
                'level': {'state': 'recognized' if current is not None else 'uncertain',
                          'value': {'current': current, 'max': 60} if current is not None else None}}}
    kwargs.update(level_probe=probe, reader=Mock(side_effect=reader))
    run_inventory(*args, **kwargs)
    assert report['processedPositions'] == len(levels)
    assert report['inventorySummary']['listTotal'] == 6
    assert report['inventorySummary']['excludedByLevel'] == excluded
    assert report['inventorySummary']['eligiblePositions'] == eligible
    assert report['inventorySummary']['pendingLevel'] == 1
    assert len(state['clicks']) == kwargs['reader'].call_count == len(levels) - excluded
    assert [item['position'] for item in report['observations']] == list(range(6))
    assert report['observations'][0]['status'] == 'excluded-level'
    assert report['observations'][4]['levelEligibility'] == 'eligible-level'
    assert report['observations'][-1]['levelEligibility'] == 'pending-level'
    assert report['inventoryAccepted'] is False


@pytest.mark.parametrize('grid_level,detail_level,expected', [(20, 0, 'pending-level'), (None, 0, 'excluded-level'), (None, 20, 'eligible-level')])
def test_grid_detail_conflicts_and_unreadable_grid_are_preserved(tmp_path, grid_level, detail_level, expected):
    args, kwargs, report, state, guard = run_fixture(tmp_path, [view(0, 1, first=True, last=True)])
    report['minLevel'] = 20
    kwargs['level_probe'] = lambda *args: {'state': 'recognized' if grid_level is not None else 'uncertain', 'value': grid_level}
    kwargs['reader'] = lambda *args: {'scope': 'included', 'fields': {'level': {'state': 'recognized', 'value': {'current': detail_level, 'max': 60}}}}
    run_inventory(*args, **kwargs)
    assert report['observations'][0]['levelEligibility'] == expected
    assert report['observations'][0]['reading']['fields']['level']['value']['current'] == detail_level
    assert len(state['clicks']) == 1


@pytest.mark.parametrize('raw,expected', [(['Lv. 20','Lv.20'],20), (['Lv.40','Lv. 40'],40),
                                        (['Lv.0','Lv. 0'],0), (['Lv.20','Lv.40'],None),
                                        (['Lv.O','Lv.0'],None), (['20','20'],None), (['Lv.61','Lv.61'],None)])
def test_grid_level_requires_literal_prefix_valid_range_and_two_agreeing_reads(raw, expected):
    from test_zzz_transition import viewport
    frame = viewport()
    reader = SimpleNamespace(read_line=Mock(side_effect=raw))
    result = read_grid_level(frame, calibrate(frame), (166, 242), reader)
    assert result['value'] == expected
    assert result['state'] == ('recognized' if expected is not None else 'uncertain')
    assert result['raw'] == raw


@pytest.mark.parametrize('raw,expected', [(['W-Engine Storage [118/2000]'],118), (['W-Engine Storage [0/2000]'],0),
                                        (['W-Engine Storage [1999/2000]'],1999), (['118/2000'],None),
                                        (['W-Engine Storage [2001/2000]'],None)])
def test_list_count_is_not_an_eligible_level_count_or_near_capacity_guess(raw, expected):
    assert parse_storage_count(raw) == expected


@pytest.fixture
def saved_references():
    root = Path(__file__).resolve().parents[1] / '.cache/youkai-p1/runs/20261024-guided-tail-2e081b07'
    path = root / 'session.json'
    if not path.exists():
        pytest.skip('personal calibration references are not in Git')
    assert hashlib.sha256(path.read_bytes()).hexdigest() == '44c90633d2368af6fc19f0d14e3bc14d741f78e3fbbe8907b392322dee6b6014'
    report = json.loads(path.read_text(encoding='utf-8'))
    from PIL import Image
    frames = {}
    for item in report['references']:
        frame_path = Path(item['frame'])
        assert hashlib.sha256(frame_path.read_bytes()).hexdigest() == item['frameSha256']
        frames[item['stage']] = Image.open(frame_path).convert('RGB')
    return frames


def test_saved_normal_bottom_and_held_control_have_different_acceptance(saved_references):
    f = saved_references
    c = calibrate(f['prepared-top'])
    observer = AlignedInventoryObserver(118)
    first = observer(f['prepared-top'], c, DEFAULT_GRID)
    assert len(first.cards) == 36 and first.at_start is True and first.at_end is False
    for stage in ('after-final-wheel', 'last-card'):
        # This seeds a known local pair only; it does not simulate the missing full traversal.
        observer.previous_frame = f['before-final-wheel']
        observer.offset = 81
        last = observer(f[stage], c, DEFAULT_GRID)
        assert last.at_end is True and len(last.cards) == 28
        assert [item.ordinal for item in last.cards[-2:]] == [116,117]
        assert sum(item['state'] == 'empty' for item in last.evidence['cells']) == 8
    observer.previous_frame = f['before-final-wheel']
    observer.offset = 81
    held = observer(f['bottom-no-progress'], c, DEFAULT_GRID)
    assert held.cards is None and held.at_end is None
    assert selection_stillness(f['after-final-wheel'], f['last-card'], c, DEFAULT_GRID)['sameViewport'] is True


def test_saved_filter_dialog_is_not_an_accepted_inventory_screen(saved_references):
    frame = saved_references['filter-options']
    result = AlignedInventoryObserver(118)(frame, calibrate(frame), DEFAULT_GRID)
    assert result.cards is None


def test_count_change_or_missing_count_cannot_produce_complete_coverage(saved_references):
    frame = saved_references['prepared-top']
    for total, current in ((None, None), (118, 117), (118, None)):
        result = AlignedInventoryObserver(total, lambda frame: current)(frame, calibrate(frame), DEFAULT_GRID)
        assert result.cards is None and result.at_end is None


def test_saved_true_final_selection_and_previous_copy_are_distinct(saved_references):
    from zzz_pilot import selected_positions
    f = saved_references
    c = calibrate(f['after-final-wheel'])
    assert selected_positions(f['after-final-wheel'], c, DEFAULT_GRID, 36) == [27]
    assert selected_positions(f['last-card'], c, DEFAULT_GRID, 36) == [26]


def test_focus_loss_during_grid_level_read_stops_before_exclusion_or_click(tmp_path):
    from youkai_selection import ProbeStopped
    args, kwargs, report, state, guard = run_fixture(tmp_path, [view(0, 1, first=True, last=True)])
    report['minLevel'] = 20
    def probe(*args):
        guard.check_window = Mock(side_effect=ProbeStopped('game-focus-lost'))
        return {'state': 'recognized', 'value': 0}
    kwargs.update(level_probe=probe, reader=Mock())
    with pytest.raises(ProbeStopped, match='game-focus-lost'):
        run_inventory(*args, **kwargs)
    assert state['clicks'] == [] and state['wheels'] == 0
    assert report['observations'][0]['status'] == 'failed'
    assert report['captureComplete'] is False
    kwargs['reader'].assert_not_called()


def test_uniform_bright_strip_is_unreadable_not_a_stationary_scrollbar(tmp_path):
    args, kwargs, report, state, guard = run_fixture(tmp_path, [view(0, 1, first=True, last=True)])
    frame = args[1]()
    ImageDraw.Draw(frame).rectangle(args[0].scale_bbox(SCROLLBAR), fill=(22,22,22))
    assert scrollbar_evidence(frame, args[0])['state'] == 'unreadable'
    assert selection_stillness(frame, frame.copy(), args[0], DEFAULT_GRID)['sameViewport'] is None


@pytest.fixture
def saved_interrupted_scan():
    root = Path(__file__).resolve().parents[1] / '.cache/youkai-p1/runs/20261026-213337-5baaf3b0-selection'
    path = root / 'session.json'
    if not path.exists():
        pytest.skip('personal interrupted scan is not in Git')
    assert hashlib.sha256(path.read_bytes()).hexdigest() == '330b67e9d0c744a2383411298a5d06bff6d2bf485a7468cf447a6b0e52446f38'
    report = json.loads(path.read_text(encoding='utf-8'))
    from PIL import Image
    def load(item, path_key, hash_key):
        image_path = Path(item[path_key])
        assert hashlib.sha256(image_path.read_bytes()).hexdigest() == item[hash_key]
        with Image.open(image_path) as image:
            return image.convert('RGB')
    frames = [load(item, 'path', 'sha256') for item in report['frames'][-9:]]
    views = [load(item, 'frame', 'frameSha256') for item in report['inventoryViews']]
    return report, frames, views


def test_saved_final_wheel_settles_despite_animated_scenery(saved_interrupted_scan):
    from zzz_transition import wait_for_viewport
    report, frames, _ = saved_interrupted_scan
    assert report['reason'] == 'viewport-not-stable-within-4-seconds'
    assert all(item['inventoryCheck']['differences'][1] > 2.5 for item in report['frames'][-7:-1])
    now, index, evidence = [0.0], [0], []
    def grab():
        frame = frames[index[0]]
        index[0] += 1
        return frame
    settled = wait_for_viewport(grab, calibrate(frames[0]), lambda: None,
                               lambda frame, item: evidence.append(item), clock=lambda: now[0],
                               sleep=lambda seconds: now.__setitem__(0, now[0] + .48))
    assert settled is frames[index[0] - 1]
    assert now[0] < 4 and evidence[-1]['settled'] is True


def test_saved_interrupted_path_maps_ten_remaining_positions_at_normal_bottom(saved_interrupted_scan):
    report, frames, views = saved_interrupted_scan
    calibration = calibrate(frames[0])
    observer = AlignedInventoryObserver(report['preparedListTotal'])
    for frame in views:
        view = observer(frame, calibration, DEFAULT_GRID)
        assert view.mapping_verified is True and view.at_end is False
    final = observer(frames[-1], calibration, DEFAULT_GRID)
    assert final.at_end is True and final.mapping_verified is True
    assert len(final.cards) == 28
    assert sum(cell['state'] == 'empty' for cell in final.evidence['cells']) == 8
    remaining = [card for card in final.cards if card.ordinal >= report['processedPositions']]
    assert [card.ordinal for card in remaining] == list(range(108, 118))
    assert all(card.safe_to_select for card in remaining)
    assert report['captureComplete'] is report['inventoryAccepted'] is False
