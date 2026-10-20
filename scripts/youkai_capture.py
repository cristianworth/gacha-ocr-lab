"""One guarded client capture using the unchanged Youkai public capture API."""

import argparse
import hashlib
import importlib.util
import json
import time
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path


class CaptureRejected(RuntimeError):
    pass


def _window(api):
    candidates = api.list_game_windows()
    if not candidates:
        raise CaptureRejected("game-window-not-found: open and restore ZZZ in windowed mode")
    if len(candidates) != 1:
        raise CaptureRejected("ambiguous-game-window: close other matching clients or launchers")
    window = candidates[0]
    if window["title"] != "ZenlessZoneZero":
        raise CaptureRejected("unexpected-window-title: this qualification targets ZenlessZoneZero")
    if (window["w"], window["h"]) != (1280, 720):
        raise CaptureRejected("unsupported-client-size: expected 1280x720")
    return window


def _identity(window):
    return tuple(window[key] for key in ("hwnd", "left", "top", "w", "h"))


def capture_once(api, foreground, dpi_for_window, *, focus=False):
    target = _window(api)
    if focus and not api.focus_game_window():
        raise CaptureRejected("focus-failed: bring ZZZ to foreground manually")
    before = _window(api)
    if _identity(before) != _identity(target):
        raise CaptureRejected("window-changed-before-capture")
    if foreground() != before["hwnd"]:
        raise CaptureRejected("game-not-foreground: focus ZZZ before the countdown ends")
    if dpi_for_window(before["hwnd"]) != 96:
        raise CaptureRejected("unsupported-dpi: expected Windows display scale 100 percent")
    calibration, grab = api.calibrate_window()
    actual = (calibration.window_left, calibration.window_top,
              calibration.frame_width, calibration.frame_height)
    expected = (before["left"], before["top"], before["w"], before["h"])
    if actual != expected:
        raise CaptureRejected("calibration-window-mismatch")
    frame = grab()
    after = _window(api)
    if _identity(after) != _identity(before):
        raise CaptureRejected("window-changed-during-capture")
    if foreground() != before["hwnd"]:
        raise CaptureRejected("focus-lost-during-capture")
    if frame.size != (1280, 720):
        raise CaptureRejected("unexpected-frame-size")
    return frame, calibration, before


def save_grid_preview(frame, calibration, output):
    from PIL import ImageDraw
    from youkai_ocr.grid import DEFAULT_GRID

    preview = frame.copy()
    draw = ImageDraw.Draw(preview)
    draw.rectangle(calibration.scale_bbox(DEFAULT_GRID.grid_bbox), outline="lime", width=2)
    for row in range(DEFAULT_GRID.rows_visible):
        for col in range(DEFAULT_GRID.columns):
            x, y = calibration.to_frame(*DEFAULT_GRID.cell_center(col, row))
            draw.ellipse((x - 3, y - 3, x + 3, y + 3), fill="lime", outline="black")
            draw.text((x + 5, y - 8), f"{row},{col}", fill="lime", stroke_width=1, stroke_fill="black")
    preview.save(output / "grid-preview.png")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("cache", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--delay", type=int, choices=range(0, 31), default=5)
    parser.add_argument("--focus", action="store_true")
    parser.add_argument("--check-window", action="store_true")
    args = parser.parse_args()
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    manifest = {"schemaVersion": 1, "startedAt": datetime.now(timezone.utc).isoformat(),
                "mode": "window-check" if args.check_window else "one-client-capture", "status": "preflight", "frameSaved": False,
                "liveCaptureTested": False, "liveInputTested": False,
                "inventoryAccepted": False, "focusRequested": args.focus}
    exit_code = 1
    try:
        import ctypes
        from ctypes import wintypes
        import win32gui
        from youkai_ocr import capture
        spec = importlib.util.spec_from_file_location("youkai_offline", Path(__file__).with_name("youkai-offline.py"))
        offline = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(offline)
        SHA, verify_source = offline.SHA, offline.verify_source

        source = args.cache / f"youkai-{SHA}"
        manifest["sourceSha"] = SHA
        manifest["unchangedSourceFiles"] = verify_source(args.cache, source)
        ctypes.windll.user32.SetProcessDPIAware()
        get_dpi = ctypes.windll.user32.GetDpiForWindow
        get_dpi.argtypes = [wintypes.HWND]
        get_dpi.restype = wintypes.UINT
        if args.check_window:
            window = _window(capture)
            manifest.update({"status": "window-checked", "window": window,
                             "foreground": win32gui.GetForegroundWindow() == window["hwnd"],
                             "dpi": get_dpi(window["hwnd"])})
            print(json.dumps({"windowSize": [window["w"], window["h"]],
                              "foreground": manifest["foreground"], "dpi": manifest["dpi"]}))
            return 0
        print(f"One capture in {args.delay}s; no clicks, keys, scroll or input listener.", flush=True)
        time.sleep(args.delay)
        frame, calibration, window = capture_once(capture, win32gui.GetForegroundWindow, get_dpi, focus=args.focus)
        frame_path = output / "client.png"
        frame.save(frame_path)
        manifest.update({"status": "captured", "frameSaved": True, "liveCaptureTested": True,
                         "window": window, "calibration": asdict(calibration),
                         "frameSha256": hashlib.sha256(frame_path.read_bytes()).hexdigest(),
                         "capturePath": "original calibrate_window() callback; dxcam/Pillow branch not instrumented",
                         "visualReviewPending": True})
        save_grid_preview(frame, calibration, output)
        print(f"Captured client: {frame_path}")
        print(f"Grid preview: {output / 'grid-preview.png'}")
        exit_code = 0
    except KeyboardInterrupt:
        manifest.update({"status": "cancelled", "reason": "interrupted"})
        print("Capture cancelled.")
    except Exception as exc:
        manifest.update({"status": "failed", "reason": str(exc)})
        print(f"Capture stopped: {exc}")
    finally:
        manifest["endedAt"] = datetime.now(timezone.utc).isoformat()
        (output / "capture.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
        print(f"Capture report: {output / 'capture.json'}")
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
