"""Bounded qualification of the original Youkai navigator on three first-row cells."""

import argparse
import hashlib
import importlib.util
import json
import time
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

from youkai_capture import capture_once


class ProbeStopped(RuntimeError):
    pass


def save_report(path, report):
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


class InputGuard:
    def __init__(self, check_window, stopped, targets, max_presses, *, timeout=60, clock=time.monotonic):
        self.check_window = check_window
        self.stopped = stopped
        self.targets = targets
        self.max_presses = max_presses
        self.clock = clock
        self.deadline = clock() + timeout
        self.presses = 0
        self.moves = 0
        self.events = []

    def check(self):
        if self.stopped():
            raise ProbeStopped("stop-requested-or-listener-unavailable")
        if self.clock() >= self.deadline:
            raise ProbeStopped("qualification-time-limit")
        self.check_window()

    def press(self, point):
        self.check()
        if not any(abs(point[0] - x) <= 3 and abs(point[1] - y) <= 3 for x, y in self.targets):
            raise ProbeStopped("click-outside-approved-first-row-targets")
        if self.presses >= self.max_presses:
            raise ProbeStopped("click-budget-exhausted")
        self.presses += 1
        self.events.append({"event": "press-requested", "number": self.presses, "position": list(point),
                            "at": self.clock()})


class GuardedMouse:
    """Public pynput controller protocol with guarded moves/presses and cleanup."""

    def __init__(self, mouse, guard):
        self.mouse = mouse
        self.guard = guard
        self.held = set()

    @property
    def position(self):
        self.guard.check()
        return self.mouse.position

    @position.setter
    def position(self, value):
        self.guard.check()
        self.mouse.position = value
        self.guard.moves += 1

    def press(self, button):
        if getattr(button, "name", "") != "left":
            raise ProbeStopped("only-left-selection-is-allowed")
        self.guard.press(self.mouse.position)
        self.held.add(button)
        self.mouse.press(button)

    def release(self, button):
        # Release only our held button even if focus/stop changed after mouse-down.
        if button in self.held:
            self.mouse.release(button)
            self.held.remove(button)
            self.guard.events.append({"event": "release", "at": self.guard.clock()})

    def scroll(self, dx, dy):
        self.guard.check()
        raise ProbeStopped("scroll-blocked: prepare the viewport at the top manually")

    def close(self):
        for button in tuple(self.held):
            self.release(button)


def collect_prefix(navigator, limit, consume, observations):
    for index, row, frame in navigator.scan(limit):
        if not 0 <= index < limit or row != 0:
            raise ProbeStopped("navigator-left-approved-prefix")
        observation = observations[index]
        if observation["status"] != "not-visited":
            raise ProbeStopped("navigator-repeated-position")
        observation["status"] = "captured"
        try:
            consume(index, frame, observation)
        except Exception as exc:
            observation.update({"status": "failed", "reason": str(exc)})
            raise
    for index in getattr(navigator, "stuck_cells", ()):
        if 0 <= index < limit:
            observations[index].update({"status": "failed", "reason": "upstream-stuck-panel"})
    return getattr(navigator, "incomplete", None)


def integrity_level(pid=None):
    import win32api
    import win32con
    import win32security

    process = win32api.GetCurrentProcess() if pid is None else win32api.OpenProcess(0x1000, False, pid)
    try:
        token = win32security.OpenProcessToken(process, win32con.TOKEN_QUERY)
        try:
            sid = win32security.GetTokenInformation(token, win32security.TokenIntegrityLevel)[0]
            return sid.GetSubAuthority(sid.GetSubAuthorityCount() - 1)
        finally:
            token.Close()
    finally:
        if pid is not None:
            process.Close()


def verify_receipt(path, source_sha, now):
    receipt = json.loads(path.read_text(encoding="utf-8"))
    if receipt.get("mode") != "stop-check" or receipt.get("status") != "verified":
        raise ProbeStopped("unverified-stop-receipt")
    if receipt.get("sourceSha") != source_sha or receipt.get("key") != "F8":
        raise ProbeStopped("incompatible-stop-receipt")
    age = (now - datetime.fromisoformat(receipt["verifiedAt"])).total_seconds()
    if not 0 <= age <= 1800:
        raise ProbeStopped("expired-stop-receipt: verify F8 again")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("cache", type=Path)
    parser.add_argument("output", type=Path)
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument("--check-stop", action="store_true")
    modes.add_argument("--run", action="store_true")
    parser.add_argument("--stop-receipt", type=Path)
    parser.add_argument("--limit", type=int, choices=(2, 3), default=3)
    args = parser.parse_args()
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    report_path = output / "session.json"
    report = {"schemaVersion": 1, "mode": "stop-check" if args.check_stop else "selection" if args.run else "preflight",
              "status": "preflight", "startedAt": datetime.now(timezone.utc).isoformat(),
              "liveInputTested": False, "captureComplete": False, "inventoryAccepted": False,
              "observations": [{"position": i, "row": 0, "column": i, "status": "not-visited"} for i in range(args.limit)]}
    listener = None
    guarded_mouse = None
    guard = None
    result_code = 1
    try:
        import ctypes
        from ctypes import wintypes
        import win32gui
        import win32process
        from youkai_ocr import capture, grid

        spec = importlib.util.spec_from_file_location("youkai_offline", Path(__file__).with_name("youkai-offline.py"))
        offline = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(offline)
        report["sourceSha"] = offline.SHA
        report["unchangedSourceFiles"] = offline.verify_source(args.cache, args.cache / f"youkai-{offline.SHA}")
        ctypes.windll.user32.SetProcessDPIAware()
        get_dpi = ctypes.windll.user32.GetDpiForWindow
        get_dpi.argtypes = [wintypes.HWND]
        get_dpi.restype = wintypes.UINT

        if args.check_stop:
            from pynput.keyboard import Key
            event, listener = grid.make_kill_listener(kill_key=Key.f8)
            print("Stop check only: press and release F8 within 30 seconds. No mouse input.", flush=True)
            if not event.wait(30):
                raise ProbeStopped("F8-not-observed-within-30-seconds")
            report.update({"status": "verified", "key": "F8", "verifiedAt": datetime.now(timezone.utc).isoformat()})
            print(f"F8 verified. Receipt: {report_path}")
            return 0

        candidates = capture.list_game_windows()
        if len(candidates) != 1 or candidates[0]["title"] != "ZenlessZoneZero":
            raise ProbeStopped("unique-ZZZ-window-required")
        window = candidates[0]
        if (window["w"], window["h"]) != (1280, 720) or get_dpi(window["hwnd"]) != 96:
            raise ProbeStopped("1280x720-at-100-percent-required")
        pid = win32process.GetWindowThreadProcessId(window["hwnd"])[1]
        helper_level, target_level = integrity_level(), integrity_level(pid)
        report["inputAccess"] = {"helperIntegrity": helper_level, "targetIntegrity": target_level,
                                 "allowed": helper_level >= target_level}
        report["window"] = window
        if helper_level < target_level:
            raise ProbeStopped("input-integrity-mismatch: run the command at the same integrity as the game")
        if not args.run:
            report["status"] = "preflight-ok"
            print(json.dumps({"inputAccess": report["inputAccess"], "client": [1280, 720],
                              "limit": args.limit, "scrollAllowed": False}))
            return 0
        from pynput.keyboard import Key
        import pynput.mouse
        from youkai_ocr.recognize import make_recognizer
        from youkai_ocr.wengine_scanner import read_engine_count, scan_single_frame_engine
        if args.stop_receipt is not None:
            verify_receipt(args.stop_receipt, offline.SHA, datetime.now(timezone.utc))
            report["stopReceipt"] = str(args.stop_receipt.resolve())
        event, listener = grid.make_kill_listener(kill_key=Key.f8)
        if args.stop_receipt is None:
            print("Before any mouse input: press and release F8 within 30 seconds to verify the stop hook.", flush=True)
            if not event.wait(30):
                raise ProbeStopped("F8-not-observed-within-30-seconds")
            receipt = {"mode": "stop-check", "status": "verified", "key": "F8",
                       "sourceSha": offline.SHA, "verifiedAt": datetime.now(timezone.utc).isoformat()}
            receipt_path = output / "stop-check.json"
            save_report(receipt_path, receipt)
            report["stopReceipt"] = str(receipt_path)
            event.clear()
        print("F8 verified. Release it. Selection proof in 5 seconds; F8/Ctrl+C now stops. Exclusive controls.", flush=True)
        time.sleep(5)
        if event.is_set():
            raise ProbeStopped("stopped-before-focus")
        baseline, calibration, window = capture_once(capture, win32gui.GetForegroundWindow, get_dpi, focus=True)
        baseline.save(output / "before.png")
        report["window"] = window
        initial_identity = (window["left"], window["top"], window["w"], window["h"])
        report["limit"] = args.limit
        report["scrollAllowed"] = False
        report["upstreamCountArgumentMeaning"] = "qualification-prefix-only; not the inventory total"
        header_reads = []
        recognizer = make_recognizer("tesseract")
        class HeaderRecorder:
            def read_line(self, image, profile):
                text = recognizer.read_line(image, profile)
                header_reads.append(text)
                return text
        count = read_engine_count(baseline, calibration, HeaderRecorder())
        report["headerReads"] = header_reads
        report["globalCountCandidate"] = count
        normalized = "".join(ch for ch in " ".join(header_reads).lower() if ch.isalnum())
        if "wenginestorage" not in normalized or count is None or count < args.limit:
            raise ProbeStopped("W-Engine-storage-header-not-confirmed")

        def check_window():
            hwnd = window["hwnd"]
            if not win32gui.IsWindow(hwnd) or not win32gui.IsWindowVisible(hwnd) or win32gui.IsIconic(hwnd):
                raise ProbeStopped("game-window-unavailable")
            if win32gui.GetForegroundWindow() != hwnd:
                raise ProbeStopped("game-focus-lost")
            if win32process.GetWindowThreadProcessId(hwnd)[1] != pid:
                raise ProbeStopped("game-process-changed")
            _, _, w, h = win32gui.GetClientRect(hwnd)
            left, top = win32gui.ClientToScreen(hwnd, (0, 0))
            if (left, top, w, h) != initial_identity or get_dpi(hwnd) != 96:
                raise ProbeStopped("game-geometry-or-DPI-changed")

        targets = [calibration.to_screen(*grid.DEFAULT_GRID.cell_center(col, 0)) for col in range(args.limit)]
        guard = InputGuard(check_window, lambda: event.is_set() or not listener.is_alive(), targets,
                           1 + args.limit * (1 + grid.PANEL_STUCK_RECLICKS))
        report["targets"] = targets
        report["pressBudget"] = guard.max_presses
        report["frames"] = []
        frame_dir = output / "frames"
        frame_dir.mkdir()
        bound_calibration, original_grab = capture.calibrate_window()
        if (bound_calibration.window_left, bound_calibration.window_top,
            bound_calibration.frame_width, bound_calibration.frame_height) != initial_identity:
            raise ProbeStopped("bound-capture-window-mismatch")
        def guarded_capture():
            guard.check()
            if len(report["frames"]) >= 80:
                raise ProbeStopped("capture-budget-exhausted")
            frame = original_grab()
            guard.check()
            if frame.size != (1280, 720):
                raise ProbeStopped("unexpected-frame-size")
            path = frame_dir / f"{len(report['frames']):04d}.png"
            frame.save(path)
            report["frames"].append({"path": str(path), "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                                      "pressCount": guard.presses, "at": guard.clock()})
            save_report(report_path, report)
            return frame

        raw_mouse = pynput.mouse.Controller()
        guarded_mouse = GuardedMouse(raw_mouse, guard)
        navigator = grid.GridNavigator(guarded_capture, calibration, kill_event=event, debug_dir=output / "upstream-debug")
        def consume(index, frame, observation):
            guard.check()
            path = output / f"position-{index:02d}.png"
            frame.save(path)
            observation.update({"frame": str(path), "frameSha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                                "captureSequenceAtYield": len(report["frames"]), "pressCount": guard.presses})
            save_report(report_path, report)
            item, confidence = scan_single_frame_engine(frame, calibration, archive_dir=output / f"ocr-{index:02d}")
            observation.update({"status": "read" if item else "ocr-failed", "originalOutput": item.to_dict() if item else None,
                                "upstreamConfidence": confidence, "humanApproved": False,
                                "lockSelectedCellVerified": False})
            save_report(report_path, report)
        report["status"] = "running"
        save_report(report_path, report)
        # Inject a guard at pynput's public controller factory; source files and
        # the original GridNavigator.scan() algorithm stay unchanged.
        with patch.object(pynput.mouse, "Controller", return_value=guarded_mouse):
            report["upstreamIncomplete"] = collect_prefix(navigator, args.limit, consume, report["observations"])
        report["status"] = "stopped" if event.is_set() else "prefix-read" if all(o["status"] == "read" for o in report["observations"]) else "partial"
        result_code = 0
    except KeyboardInterrupt:
        report.update({"status": "stopped", "reason": "Ctrl+C"})
    except Exception as exc:
        report.update({"status": "stopped", "reason": str(exc)})
        print(f"Probe stopped: {exc}")
    finally:
        cleanup_errors = []
        if guarded_mouse is not None:
            try:
                guarded_mouse.close()
            except Exception as exc:
                cleanup_errors.append(f"mouse release: {exc}")
        if listener is not None:
            try:
                listener.stop()
                listener.join(timeout=2)
            except Exception as exc:
                cleanup_errors.append(f"listener cleanup: {exc}")
        if guard is not None:
            report.update({"pressRequests": guard.presses, "mouseMoves": guard.moves,
                           "inputEvents": guard.events, "liveInputTested": guard.presses > 0,
                           "selectionDeliveryVerified": False})
        if cleanup_errors:
            report["cleanupErrors"] = cleanup_errors
        report["endedAt"] = datetime.now(timezone.utc).isoformat()
        save_report(report_path, report)
        print(f"Qualification report: {report_path}")
    return result_code


if __name__ == "__main__":
    raise SystemExit(main())
