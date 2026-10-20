"""Guard regressions for the one-shot capture; all desktop APIs are simulated."""

import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from youkai_capture import CaptureRejected, capture_once


def setup_capture():
    window = dict(hwnd=1, title="ZenlessZoneZero", left=100, top=80, w=1280, h=720)
    calibration = SimpleNamespace(window_left=100, window_top=80, frame_width=1280, frame_height=720)
    frame = Image.new("RGB", (1280, 720))
    grab = Mock(return_value=frame)
    api = SimpleNamespace(list_game_windows=Mock(side_effect=lambda: [window.copy()]),
                          focus_game_window=Mock(return_value=True),
                          calibrate_window=Mock(return_value=(calibration, grab)))
    return window, calibration, frame, grab, api


def test_one_capture_uses_original_callback_once_without_focus():
    window, calibration, frame, grab, api = setup_capture()
    assert capture_once(api, lambda: 1, lambda hwnd: 96) == (frame, calibration, window)
    grab.assert_called_once_with()
    api.focus_game_window.assert_not_called()


@pytest.mark.parametrize("windows,reason", [([], "game-window-not-found"),
    ([dict(hwnd=1), dict(hwnd=2)], "ambiguous-game-window")])
def test_missing_or_ambiguous_target_never_captures(windows, reason):
    _, _, _, grab, api = setup_capture()
    api.list_game_windows.side_effect = lambda: windows
    with pytest.raises(CaptureRejected, match=reason):
        capture_once(api, lambda: 1, lambda hwnd: 96, focus=True)
    grab.assert_not_called()
    api.focus_game_window.assert_not_called()


@pytest.mark.parametrize("field,value,reason", [
    ("title", "chiaki-ng", "unexpected-window-title"),
    ("w", 1920, "unsupported-client-size"),
    ("h", 900, "unsupported-client-size")])
def test_wrong_target_or_geometry_never_captures(field, value, reason):
    window, _, _, grab, api = setup_capture()
    window[field] = value
    with pytest.raises(CaptureRejected, match=reason):
        capture_once(api, lambda: 1, lambda hwnd: 96)
    grab.assert_not_called()


@pytest.mark.parametrize("foreground,dpi,reason", [
    (2, 96, "game-not-foreground"), (1, 120, "unsupported-dpi")])
def test_focus_and_dpi_are_required(foreground, dpi, reason):
    _, _, _, grab, api = setup_capture()
    with pytest.raises(CaptureRejected, match=reason):
        capture_once(api, lambda: foreground, lambda hwnd: dpi)
    grab.assert_not_called()


def test_explicit_focus_request_must_succeed():
    _, _, _, grab, api = setup_capture()
    api.focus_game_window.return_value = False
    with pytest.raises(CaptureRejected, match="focus-failed"):
        capture_once(api, lambda: 1, lambda hwnd: 96, focus=True)
    grab.assert_not_called()


def test_explicit_focus_calls_original_focus_function():
    _, _, _, grab, api = setup_capture()
    capture_once(api, lambda: 1, lambda hwnd: 96, focus=True)
    api.focus_game_window.assert_called_once_with()
    grab.assert_called_once_with()


def test_bound_calibration_must_match_selected_window():
    _, calibration, _, grab, api = setup_capture()
    calibration.window_left += 20
    with pytest.raises(CaptureRejected, match="calibration-window-mismatch"):
        capture_once(api, lambda: 1, lambda hwnd: 96)
    grab.assert_not_called()


def test_moving_window_during_capture_rejects_the_frame():
    window, _, frame, grab, api = setup_capture()
    def moved():
        window["left"] += 100
        return frame
    grab.side_effect = moved
    with pytest.raises(CaptureRejected, match="window-changed-during-capture"):
        capture_once(api, lambda: 1, lambda hwnd: 96)


def test_losing_focus_during_capture_rejects_the_frame():
    _, _, _, _, api = setup_capture()
    foreground = Mock(side_effect=[1, 2])
    with pytest.raises(CaptureRejected, match="focus-lost-during-capture"):
        capture_once(api, foreground, lambda hwnd: 96)


def test_wrong_frame_size_is_rejected():
    _, _, _, grab, api = setup_capture()
    grab.return_value = Image.new("RGB", (640, 360))
    with pytest.raises(CaptureRejected, match="unexpected-frame-size"):
        capture_once(api, lambda: 1, lambda hwnd: 96)
