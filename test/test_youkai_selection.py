"""Selection guard and upstream-prefix tests; no live desktop input is emitted."""

import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

import pytest
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from youkai_selection import GuardedMouse, InputGuard, ProbeStopped, collect_prefix, verify_receipt


# pynput buttons are hashable; this fake has the same name contract.
class Button:
    name = "left"
LEFT = Button()


def guard_fixture(*, stopped=False, check=None, budget=4, clock=None):
    check = check or Mock()
    guard = InputGuard(check, lambda: stopped, [(100, 200)], budget,
                       clock=clock or (lambda: 0))
    raw = Mock()
    raw.position = (100, 200)
    return guard, raw, GuardedMouse(raw, guard)


@pytest.mark.parametrize("operation", ["move", "press", "scroll"])
def test_stop_prevents_new_native_events(operation):
    guard, raw, mouse = guard_fixture(stopped=True)
    with pytest.raises(ProbeStopped, match="stop-requested"):
        if operation == "move":
            mouse.position = (101, 201)
        elif operation == "press":
            mouse.press(LEFT)
        else:
            mouse.scroll(0, 1)
    raw.press.assert_not_called()
    raw.scroll.assert_not_called()
    assert raw.position == (100, 200)


def test_focus_or_geometry_failure_blocks_press():
    check = Mock(side_effect=ProbeStopped("focus-lost"))
    _, raw, mouse = guard_fixture(check=check)
    with pytest.raises(ProbeStopped, match="focus-lost"):
        mouse.press(LEFT)
    raw.press.assert_not_called()


def test_release_cleans_up_our_button_after_stop():
    guard, raw, mouse = guard_fixture()
    mouse.press(LEFT)
    guard.stopped = lambda: True
    mouse.close()
    raw.release.assert_called_once_with(LEFT)
    assert not mouse.held
    with pytest.raises(ProbeStopped):
        mouse.press(LEFT)
    assert raw.press.call_count == 1


def test_release_never_releases_a_button_we_did_not_press():
    _, raw, mouse = guard_fixture()
    mouse.release(LEFT)
    raw.release.assert_not_called()


def test_scroll_is_rejected_even_when_the_window_is_safe():
    _, raw, mouse = guard_fixture()
    with pytest.raises(ProbeStopped, match="scroll-blocked"):
        mouse.scroll(0, 1)
    raw.scroll.assert_not_called()


def test_click_must_stay_within_the_three_pixel_jitter_of_an_approved_target():
    _, raw, mouse = guard_fixture()
    raw.position = (104, 200)
    with pytest.raises(ProbeStopped, match="outside-approved"):
        mouse.press(LEFT)
    raw.press.assert_not_called()


def test_click_budget_prevents_additional_press():
    _, raw, mouse = guard_fixture(budget=1)
    mouse.press(LEFT)
    mouse.release(LEFT)
    with pytest.raises(ProbeStopped, match="budget-exhausted"):
        mouse.press(LEFT)
    assert raw.press.call_count == 1


def test_deadline_blocks_mouse_input():
    now = [0]
    _, raw, mouse = guard_fixture(clock=lambda: now[0])
    now[0] = 60
    with pytest.raises(ProbeStopped, match="time-limit"):
        mouse.press(LEFT)
    raw.press.assert_not_called()


def test_positions_are_not_deduplicated_by_equal_content():
    frame = object()
    navigator = SimpleNamespace(scan=lambda limit: iter([(0, 0, frame), (1, 0, frame)]),
                                stuck_cells=[], incomplete=None)
    observations = [{"status": "not-visited"} for _ in range(2)]
    def consume(index, frame, observation):
        observation["status"] = "read"
    collect_prefix(navigator, 2, consume, observations)
    assert [o["status"] for o in observations] == ["read", "read"]


def test_upstream_skipped_position_stays_as_an_explicit_failure():
    navigator = SimpleNamespace(scan=lambda limit: iter(()), stuck_cells=[1], incomplete=None)
    observations = [{"status": "not-visited"} for _ in range(3)]
    collect_prefix(navigator, 3, Mock(), observations)
    assert observations[1] == {"status": "failed", "reason": "upstream-stuck-panel"}
    assert len(observations) == 3


def test_processing_failure_preserves_the_affected_position():
    navigator = SimpleNamespace(scan=lambda limit: iter([(0, 0, object())]))
    observations = [{"status": "not-visited"}]
    with pytest.raises(ValueError, match="OCR failed"):
        collect_prefix(navigator, 1, Mock(side_effect=ValueError("OCR failed")), observations)
    assert observations[0] == {"status": "failed", "reason": "OCR failed"}


@pytest.mark.parametrize("status,key,age,reason", [("timeout", "F8", 0, "unverified"),
    ("verified", "esc", 0, "incompatible"), ("verified", "F8", 1801, "expired")])
def test_unverified_wrong_key_or_old_stop_receipt_is_rejected(tmp_path, status, key, age, reason):
    now = datetime.now(timezone.utc)
    path = tmp_path / "receipt.json"
    path.write_text(json.dumps({"mode": "stop-check", "status": status, "key": key,
                               "sourceSha": "sha", "verifiedAt": (now - timedelta(seconds=age)).isoformat()}))
    with pytest.raises(ProbeStopped, match=reason):
        verify_receipt(path, "sha", now)


def test_original_navigator_reads_three_cells_using_only_guarded_public_mouse_api(monkeypatch):
    import pynput.mouse
    from youkai_ocr import grid
    from youkai_ocr.capture import calibrate

    monkeypatch.setattr(grid.time, "sleep", lambda seconds: None)
    selected = [0]
    def frame():
        image = Image.new("RGB", (1280, 720))
        draw = ImageDraw.Draw(image)
        value = 60 + 50 * selected[0]
        draw.rectangle((947, 173, 1240, 527), fill=(value, value, value))
        draw.rectangle((907, 158, 913, 165), fill="white")
        return image
    calibration = calibrate(frame())
    click_columns = []
    class Mouse:
        position = (0, 0)
        def press(self, button):
            pass
        def release(self, button):
            x, y = self.position
            col = round((x / calibration.scale_x - grid.DEFAULT_GRID.cell_center(0, 0)[0]) / grid.DEFAULT_GRID.col_pitch)
            selected[0] = col
            click_columns.append(col)
        def scroll(self, dx, dy):
            raise AssertionError("native scroll must never happen")
    targets = [calibration.to_screen(*grid.DEFAULT_GRID.cell_center(col, 0)) for col in range(3)]
    guard = InputGuard(lambda: None, lambda: False, targets, 13)
    mouse = GuardedMouse(Mouse(), guard)
    navigator = grid.GridNavigator(frame, calibration)
    with patch.object(pynput.mouse, "Controller", return_value=mouse):
        got = list(navigator.scan(3))
    assert [index for index, row, image in got] == [0, 1, 2]
    assert click_columns == [1, 0, 1, 2]  # upstream prime, then the three positions
    assert guard.presses == 4
    assert not mouse.held


@pytest.mark.parametrize('failure', ['stopped','window','wrong-target','up','horizontal','two-steps','budget'])
def test_transition_wheel_guard_blocks_unapproved_native_scroll(failure):
    check=Mock(side_effect=ProbeStopped('game-focus-lost')) if failure=='window' else Mock()
    guard=InputGuard(check,lambda:failure=='stopped',[],0,clock=lambda:0,scroll_target=(100,200),max_scrolls=1)
    raw=Mock();raw.position=(104,200) if failure=='wrong-target' else (100,200)
    mouse=GuardedMouse(raw,guard)
    delta={'up':(0,1),'horizontal':(1,-1),'two-steps':(0,-2)}.get(failure,(0,-1))
    if failure=='budget':
        mouse.scroll(0,-1)
        raw.scroll.reset_mock()
    with pytest.raises(ProbeStopped):mouse.scroll(*delta)
    raw.scroll.assert_not_called()


def test_transition_allows_one_downward_wheel_request_at_approved_point():
    guard=InputGuard(Mock(),lambda:False,[],0,clock=lambda:0,scroll_target=(100,200),max_scrolls=1)
    raw=Mock();raw.position=(100,200);mouse=GuardedMouse(raw,guard)
    mouse.scroll(0,-1)
    raw.scroll.assert_called_once_with(0,-1)
    assert guard.scrolls==1 and guard.events[0]['event']=='scroll-requested'


def test_stop_after_wheel_prevents_further_native_scroll():
    guard=InputGuard(Mock(),lambda:False,[],0,clock=lambda:0,scroll_target=(100,200),max_scrolls=2)
    raw=Mock();raw.position=(100,200);mouse=GuardedMouse(raw,guard)
    mouse.scroll(0,-1);guard.stopped=lambda:True
    with pytest.raises(ProbeStopped):mouse.scroll(0,-1)
    assert raw.scroll.call_count==1 and guard.scrolls==1
    assert guard.failure['scrollRequests']==1
