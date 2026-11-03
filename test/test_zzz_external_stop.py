"""Per-session external stop in the real CLI with synthetic desktop inputs."""
import json
import sys
from dataclasses import replace
from pathlib import Path
from types import SimpleNamespace

import pytest

from test_zzz_inventory import inventory_desktop, view
from youkai_selection import ProbeStopped, check_external_stop, wait_for_f8, wait_for_preparation


def test_external_stop_wait_timeout_and_listener_failure(tmp_path):
    now = [0]
    event = SimpleNamespace(wait=lambda seconds: now.__setitem__(0, now[0] + seconds) or False)
    listener = SimpleNamespace(is_alive=lambda: True)
    assert wait_for_f8(event, listener, tmp_path / 'stop.request', timeout=.1, clock=lambda: now[0]) is False
    listener.is_alive = lambda: False
    with pytest.raises(ProbeStopped, match='listener-unavailable'):
        wait_for_f8(event, listener, tmp_path / 'stop.request')


def test_f8_still_interrupts_preparation(tmp_path):
    with pytest.raises(ProbeStopped, match='stopped-before-focus'):
        wait_for_preparation(SimpleNamespace(is_set=lambda: True), SimpleNamespace(is_alive=lambda: True),
                             tmp_path / 'stop.request')


@pytest.mark.parametrize('stage', ['startup', 'waiting', 'preparing', 'acquiring'])
def test_cli_external_stop_preserves_partial_and_cleans_up(tmp_path, monkeypatch, inventory_desktop, stage):
    selection, inventory, controller, event, panel = inventory_desktop
    from youkai_ocr import recognize
    from PIL import ImageDraw
    from zzz_transition import SCROLLBAR
    import zzz_pilot

    stop = tmp_path / 'stop.request'
    frame, calibration, _ = selection.capture_once(None, None, None)
    ImageDraw.Draw(frame).rectangle(calibration.scale_bbox(SCROLLBAR), fill=(0, 0, 0))
    monkeypatch.setattr(recognize, 'make_recognizer', lambda *a: SimpleNamespace(
        read_line=lambda *a: 'W-Engine Storage [2/2000]'))
    monkeypatch.setattr(inventory, 'AlignedInventoryObserver', lambda *a: lambda *a:
                        replace(view(0, 2, first=True, last=True), scrollbar_state='absent'))
    if stage == 'startup':
        stop.write_text('stop')
    elif stage == 'waiting':
        event.wait = lambda timeout: stop.write_text('stop') and False
    elif stage == 'preparing':
        monkeypatch.setattr(selection.time, 'sleep', lambda seconds: stop.write_text('stop'))

    def grid_level(frame, calib, center, reader):
        if stage == 'acquiring' and center[0] != 166:
            stop.write_text('stop')
        return {'state': 'recognized', 'value': 20}

    def settled(grab, calib, grid, limit, expected, check, record, **kwargs):
        frame = grab()
        record(frame, {'expectedPosition': expected, 'settled': False})
        record(frame, {'expectedPosition': expected, 'settled': True})
        return frame

    readings = []

    def reader(*args, **kwargs):
        readings.append(controller.press.call_count)
        return {'scope': 'included', 'fields': {
            'name': {'state': 'uncertain', 'value': None},
            'level': {'state': 'recognized', 'value': {'current': 20, 'max': 20}},
            'rarity': {'state': 'recognized', 'value': 'A'}}}

    monkeypatch.setattr(inventory, 'read_grid_level', grid_level)
    monkeypatch.setattr(inventory, 'wait_for_panel', settled)
    monkeypatch.setattr(zzz_pilot, 'read_frame', reader)
    flags = ['--pilot', '--scan', '--inventory', '--run', '--sa-filter-prepared', '--level-descending-prepared']
    root = Path(__file__).resolve().parents[1]
    monkeypatch.setattr(sys, 'argv', ['youkai_selection.py', str(root / '.cache/youkai-p1'), str(tmp_path), *flags])
    assert selection.main() == 1
    report = json.loads((tmp_path / 'session.json').read_text())
    assert report['reason'] == 'external-stop-requested'
    assert report['externalStop']['observed'] is True
    assert report['scopeComplete'] is report['coverageConfirmed'] is report['inventoryAccepted'] is False
    assert (tmp_path / 'summary.md').exists() and (tmp_path / 'review.html').exists()
    assert controller.press.call_count == (1 if stage == 'acquiring' else 0)
    assert controller.scroll.call_count == 0
    if stage != 'startup':
        from youkai_ocr import grid
        _, listener = grid.make_kill_listener()
        listener.stop.assert_called_once()
        listener.join.assert_called_once()
    if stage == 'acquiring':
        assert readings == [1]
        assert report['observations'][0]['status'] == 'read'
        assert report['evidenceWriting']['pending'] == 0
        assert report['evidenceWriting']['written'] == report['evidenceWriting']['submitted']
        assert report['guardStop']['noPressesAfterObservation']
        assert all(Path(entry['path']).exists() for entry in report['frames'])


def test_stop_file_is_local_to_the_session(tmp_path):
    (tmp_path / 'older').mkdir()
    (tmp_path / 'older/stop.request').write_text('stop')
    check_external_stop(tmp_path / 'new/stop.request')
