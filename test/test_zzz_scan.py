"""Integrated traversal tests with simulated desktop, OCR and time; no native input."""
import ctypes
import json
import math
import sys
from pathlib import Path
from unittest.mock import Mock
from types import SimpleNamespace

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from test_zzz_transition import viewport
from youkai_ocr.capture import calibrate
from youkai_ocr.grid import DEFAULT_GRID


@pytest.mark.parametrize("limit,failure,start_selection", [
    pytest.param(54, None, None, id="prefix54"), pytest.param(50, None, None, id="prefix50"),
    pytest.param(54, "focus-second-wheel", None, id="focus"), pytest.param(54, "stall-second-wheel", None, id="stall"),
    pytest.param(9, None, 18, id="selected-row-first"), pytest.param(9, None, 21, id="selected-row-middle"),
    pytest.param(9, None, 27, id="selected-row-new-labels")])
def test_integrated_scan_cli_covers_rows_transitions_copies_and_partial_failures(tmp_path, monkeypatch, limit, failure, start_selection):
    import pynput.mouse
    import win32gui
    import win32process
    import youkai_selection as selection
    import zzz_scan as scan
    from youkai_ocr import capture, grid, recognize, wengine_scanner

    state = {"offset": 5 if start_selection is not None else 0, "selected": start_selection if start_selection is not None else 0, "foreground": 1, "wheels": 0, "clicks": []}
    frames = {}
    def grab():
        key = (state["offset"], state["selected"])
        if key not in frames:
            frames[key] = viewport(state["offset"], state["selected"], 159 + 3 * state["offset"])
            if start_selection == 27:
                from PIL import ImageDraw
                draw = ImageDraw.Draw(frames[key])
                for cell in (27,29,31,33,35):
                    x,y=DEFAULT_GRID.cell_center(cell%9,cell//9)
                    draw.rectangle((round((x-5)*2/3),round((y-31)*2/3),round((x+63)*2/3),round((y-23)*2/3)),fill=(220,240,10))
        return frames[key]
    first = grab()
    calibration = calibrate(first)
    window = {"hwnd": 1, "title": "ZenlessZoneZero", "left": 0, "top": 0, "w": 1280, "h": 720}
    monkeypatch.setattr(ctypes.windll.user32, "SetProcessDPIAware", Mock())
    monkeypatch.setattr(ctypes.windll.user32, "GetDpiForWindow", Mock(return_value=96))
    monkeypatch.setattr(win32gui, "IsWindow", lambda hwnd: True)
    monkeypatch.setattr(win32gui, "IsWindowVisible", lambda hwnd: True)
    monkeypatch.setattr(win32gui, "IsIconic", lambda hwnd: False)
    monkeypatch.setattr(win32gui, "GetForegroundWindow", lambda: state["foreground"])
    monkeypatch.setattr(win32gui, "GetClientRect", lambda hwnd: (0, 0, 1280, 720))
    monkeypatch.setattr(win32gui, "ClientToScreen", lambda hwnd, point: (0, 0))
    monkeypatch.setattr(win32process, "GetWindowThreadProcessId", lambda hwnd: (1, 42))
    monkeypatch.setattr(selection, "integrity_level", lambda *args: 12288)
    monkeypatch.setattr(capture, "list_game_windows", lambda: [window])
    monkeypatch.setattr(selection, "capture_once", lambda *args, **kwargs: (first, calibration, window))
    monkeypatch.setattr(capture, "calibrate_window", lambda: (calibration, grab))
    monkeypatch.setattr(selection.time, "sleep", lambda seconds: None)
    class Event:
        flag = False
        def wait(self, timeout): self.flag = True; return True
        def clear(self): self.flag = False
        def is_set(self): return self.flag
    event = Event()
    listener = Mock()
    listener.is_alive.return_value = True
    monkeypatch.setattr(grid, "make_kill_listener", lambda **kwargs: (event, listener))
    native = []
    class Mouse:
        position = (0, 0)
        def press(self, button):
            points = [(column, row, calibration.to_screen(*DEFAULT_GRID.cell_center(column, row)))
                      for row in range(4) for column in range(9)]
            column, row, target = min(points, key=lambda item: sum(abs(a-b) for a,b in zip(item[2], self.position)))
            assert all(abs(a-b) <= 3 for a,b in zip(target, self.position))
            state["selected"] = row * 9 + column
            state["clicks"].append((state["offset"] + row, column))
            native.append("press")
        def release(self, button): native.append("release")
        def scroll(self, dx, dy):
            assert (dx, dy) == (0, -1)
            state["wheels"] += 1
            native.append("wheel")
            if failure == "focus-second-wheel" and state["wheels"] == 2:
                state["foreground"] = 2
            elif failure == "stall-second-wheel" and state["wheels"] == 2:
                return
            else:
                state["offset"] += 1
                state["selected"] -= 9
    monkeypatch.setattr(pynput.mouse, "Controller", Mouse)
    monkeypatch.setattr(recognize, "make_recognizer", lambda *args: SimpleNamespace(read_line=lambda *args: "W-Engine Storage [1567/2000]"))
    def header(frame, calib, reader): reader.read_line(frame, "white_text_on_dark"); return 1567
    monkeypatch.setattr(wengine_scanner, "read_engine_count", header)
    original_wait = scan.wait_for_panel
    def wait(*args, **kwargs):
        now = [0.0]
        return original_wait(*args, **kwargs, clock=lambda: now[0], sleep=lambda seconds: now.__setitem__(0, now[0] + seconds))
    monkeypatch.setattr(scan, "wait_for_panel", wait)
    def read(frame, calib, output):
        index = len(state["clicks"]) - 1
        return {"scope": "excluded-B" if index == 48 else "included", "fields": {
            "name": {"state": "recognized", "value": "RepeatedEngine"},
            "level": {"state": "uncertain" if index == 40 else "recognized", "value": None if index == 40 else {"current": 60, "max": 60}}}}
    monkeypatch.setattr(scan, "read_frame", read)
    repo = Path(__file__).resolve().parents[1]
    monkeypatch.setattr(sys, "argv", ["youkai_selection.py", str(repo / ".cache/youkai-p1"), str(tmp_path), "--pilot", "--scan", "--run", "--limit", str(limit)])
    if start_selection is not None:
        sys.argv.append("--selected-row")
    result = selection.main()
    report = json.loads((tmp_path / "session.json").read_text())
    if start_selection is not None:
        row,column=divmod(start_selection,9)
        count=9-column
        assert result==0 and report["status"]=="row-read"
        assert report["reason"]=="selected-row-end-reached"
        assert report["requestedPositions"]==report["processedPositions"]==count
        assert report["pressRequests"]==count-1 and report["scrollRequests"]==0
        assert report["scrollBudget"]==0 and report["transitions"]==[]
        assert report["rowStart"]=={"row":row,"column":column,"lastColumn":8}
        assert state["clicks"]==[(5+row,col) for col in range(column+1,9)]
        assert [item["column"] for item in report["observations"]]==list(range(column,9))
        assert report["observations"][0]["selectionAction"]=="already-selected"
        assert all(item["viewportCheck"]["sameViewport"] for item in report["observations"])
        assert report["prefixTraversalComplete"] is True
        assert "wheel" not in native and report["absoluteInventoryPositionConfirmed"] is False
        return
    expected = 36 if failure else limit
    assert state["clicks"] == [divmod(index, 9) for index in range(expected)]
    assert report["pressRequests"] == expected and report["processedPositions"] == expected
    assert report["scrollRequests"] == (2 if failure else math.ceil(limit / 9) - 3)
    assert native.count("press") == native.count("release") == expected
    assert report["prefixTraversalComplete"] is (failure is None)
    assert report["coverageConfirmed"] is False and report["endOfInventory"] is None
    assert report["inventoryAccepted"] is False and report["captureComplete"] is False
    assert len(report["transitions"]) == report["scrollRequests"]
    assert all(item["status"] == "read" for item in report["observations"][:expected])
    assert all(item["status"] == "not-visited" for item in report["observations"][expected:])
    assert report["scanSummary"]["processedPositions"] == expected
    assert "Integrated bounded traversal" in (tmp_path / "review.html").read_text()
    if failure:
        assert result == 1 and report["status"] == "stopped"
        assert report["transitions"][-1]["verified"] is False
        if failure == "focus-second-wheel":
            assert report["reason"] == "game-focus-lost"
            assert report["guardStop"]["noScrollsAfterObservation"] is True
            assert not any(entry.get("scanCheck", {}).get("phase") == "after-wheel" and entry["scrollCount"] == 2 for entry in report["frames"])
        else:
            assert Path(report["transitions"][-1]["after"]["frame"]).exists()
            assert report["transitions"][-1]["selectionSettled"] is False
    else:
        assert result == 0 and report["status"] == "prefix-read"
        assert report["reason"] == "requested-limit-reached"
        assert all(item["verified"] for item in report["transitions"])
        assert report["scanSummary"]["scopeCounts"] == {"included": limit-1, "excluded-B": 1, "pending-rarity": 0}
        assert report["scanSummary"]["uncertainFields"] == [{"position": 40, "fields": ["level"]}]
        assert Path(report["finalFrame"]["frame"]).exists()
        assert [item["position"] for item in report["observations"]] == list(range(limit))
