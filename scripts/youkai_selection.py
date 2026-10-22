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


class TrialFinished(ProbeStopped):
    def __init__(self, passed, reason):
        self.passed = passed
        super().__init__(reason)


class StopTrialFinished(TrialFinished):
    def __init__(self, passed):
        super().__init__(passed, "F8" if passed else "stop-test-no-second-F8-within-30-seconds")


def await_stop_trial(event, guard, report, save, *, timeout=30, notify=None):
    report["stopTest"].update({"checkpointReached": True, "pressRequestsAtCheckpoint": guard.presses})
    save()
    print("STOP TEST PAUSED after first reading. Press and release F8 AGAIN now (30 seconds). No more clicks while waiting.", flush=True)
    if notify is not None:
        try:
            report["stopTest"]["audibleCueSucceeded"] = bool(notify())
        except Exception as exc:
            report["stopTest"]["audibleCueError"] = str(exc)
        save()
    observed = event.wait(timeout)
    report["stopTest"].update({"signalObservedAtCheckpoint": observed, "passed": observed,
                              "pressRequestsAtSignalObservation": guard.presses if observed else None})
    save()
    raise StopTrialFinished(observed)


def await_geometry_trial(guard, report, save, *, timeout=30, notify=None, clock=time.monotonic, sleep=time.sleep):
    trial = report["geometryTest"]
    trial.update({"checkpointReached": True, "pressRequestsAtCheckpoint": guard.presses})
    save()
    print("GEOMETRY TEST PAUSED after first reading. Move the GAME WINDOW using its title bar now (30 seconds). Keep the game focused. No more scanner clicks.", flush=True)
    if notify is not None:
        try:
            trial["audibleCueSucceeded"] = bool(notify())
        except Exception as exc:
            trial["audibleCueError"] = str(exc)
        save()
    deadline = clock() + timeout
    while True:
        try:
            guard.check()
        except ProbeStopped as exc:
            passed = str(exc) == "game-geometry-or-DPI-changed"
            trial.update({"passed": passed, "observedReason": str(exc),
                          "pressRequestsAtObservation": guard.presses})
            save()
            raise TrialFinished(passed, str(exc)) from exc
        if clock() >= deadline:
            trial.update({"passed": False, "observedReason": "geometry-test-no-change-within-30-seconds"})
            save()
            raise TrialFinished(False, trial["observedReason"])
        sleep(.05)


def save_report(path, report):
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)
    if report.get("mode", "").startswith("zzz-"):
        from zzz_pilot import render_review
        render_review(path.with_name("review.html"), report)


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
        self.failure = None

    def check(self):
        try:
            if self.stopped():
                raise ProbeStopped("stop-requested-or-listener-unavailable")
            if self.clock() >= self.deadline:
                raise ProbeStopped("qualification-time-limit")
            self.check_window()
        except ProbeStopped as exc:
            if self.failure is None:
                self.failure = {"reason": str(exc), "at": self.clock(), "pressRequests": self.presses,
                                "mouseMoves": self.moves}
            raise

    def press(self, point):
        self.check()
        if not any(abs(point[0] - x) <= 3 and abs(point[1] - y) <= 3 for x, y in self.targets):
            raise ProbeStopped("click-outside-approved-targets")
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


def collect_prefix(navigator, limit, consume, observations, *, columns=None):
    for index, row, frame in navigator.scan(limit):
        if not 0 <= index < limit or row != (index // columns if columns else 0):
            raise ProbeStopped("navigator-left-approved-prefix")
        observation = observations[index]
        if observation["status"] not in ("not-visited", "captured-pending"):
            raise ProbeStopped("navigator-repeated-position")
        observation["status"] = "captured"
        try:
            consume(index, frame, observation)
        except TrialFinished:
            raise
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
    parser.add_argument("--limit", type=int, choices=(2, 3, 10), default=3)
    parser.add_argument("--pilot", action="store_true")
    trials = parser.add_mutually_exclusive_group()
    trials.add_argument("--test-stop", action="store_true")
    trials.add_argument("--test-geometry", action="store_true")
    parser.add_argument("--transition", action="store_true")
    parser.add_argument("--image", type=Path)
    parser.add_argument("--client")
    args = parser.parse_args()
    if args.limit == 10 and not args.pilot:
        parser.error("ten positions require --pilot")
    if args.image is not None and (not args.pilot or args.run or args.check_stop or not args.client):
        parser.error("--image requires --pilot --client and cannot emit live inputs")
    if args.test_stop and (not args.run or not args.pilot or args.transition or args.image):
        parser.error("--test-stop requires a live pilot, without image/transition")
    if args.test_geometry and (not args.run or not args.pilot or args.transition or args.image):
        parser.error("--test-geometry requires a live pilot, without image/transition")
    if args.test_stop or args.test_geometry:
        args.limit = 3
    if args.transition:
        if not args.pilot or args.image or args.check_stop:
            parser.error("--transition requires --pilot, without image/check-stop")
        args.limit = 1
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    report_path = output / "session.json"
    report = {"schemaVersion": 1, "mode": "stop-check" if args.check_stop else "selection" if args.run else "preflight",
              "status": "preflight", "startedAt": datetime.now(timezone.utc).isoformat(),
              "liveInputTested": False, "captureComplete": False, "inventoryAccepted": False,
              "observations": [{"position": i, "row": 0, "column": i, "status": "not-visited"} for i in range(args.limit)]}
    if args.pilot:
        from zzz_pilot import PROFILE
        report.update({"mode": "zzz-pilot-image" if args.image else "zzz-pilot", "game": "zzz", "itemType": "w-engine",
                       "readerVersion": PROFILE, "requestedPositions": 1 if args.image else args.limit,
                       "requiresManualReview": True})
        report["observations"] = [{"position": i, "row": i // 9, "column": i % 9, "status": "not-visited"}
                                  for i in range(1 if args.image else args.limit)]
    if args.test_stop:
        report["stopTest"] = {"requested": True, "checkpointReached": False, "passed": False}
    if args.test_geometry:
        report["geometryTest"] = {"requested": True, "checkpointReached": False, "passed": False}
    if args.transition:
        report.update({"mode": "zzz-transition", "coverageConfirmed": False, "endOfInventory": None})
        report["observations"] = [{"position": 0, "row": 2, "column": 0, "status": "not-visited"}]
    listener = None
    event = None
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
        if args.pilot:
            report["readerSourceSha256"] = {name: hashlib.sha256(Path(__file__).with_name(name).read_bytes()).hexdigest()
                                             for name in (("zzz_pilot.py", "youkai_selection.py", "zzz_transition.py") if args.transition else ("zzz_pilot.py", "youkai_selection.py"))}
        if args.image is not None:
            from PIL import Image
            from zzz_pilot import read_frame
            source = args.image.resolve(strict=True)
            client = [int(value) for value in args.client.split(",")]
            if len(client) != 4:
                raise ValueError("client must be left,top,width,height")
            x, y, w, h = client
            if (w, h) != (1280, 720) or min(x, y) < 0:
                raise ValueError("pilot requires a 1280x720 client crop without resizing")
            with Image.open(source) as image:
                if x + w > image.width or y + h > image.height:
                    raise ValueError("client crop outside source image")
                frame = image.convert("RGB").crop((x, y, x + w, y + h))
            path = output / "position-00.png"
            frame.save(path)
            report.update({"image": str(source), "imageSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
                           "clientArea": client, "status": "processed-image"})
            observation = report["observations"][0]
            observation.update({"status": "captured", "frame": str(path),
                                "frameSha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                                "positionMeaning": "image-observation-index", "selectionVerified": False})
            save_report(report_path, report)
            try:
                observation["reading"] = read_frame(frame, capture.calibrate(frame), output / "reading-00")
                observation["status"] = "read"
            except Exception as exc:
                observation.update({"status": "failed", "reason": str(exc)})
                raise
            return 0
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
        if args.test_stop:
            print("This is a STOP TEST: after the first reading, wait for the pause and press F8 a second time.", flush=True)
        if args.test_geometry:
            print("This is a GEOMETRY TEST: after the first reading, wait for the pause, then move the game window using its title bar.", flush=True)
        purpose = "One-transition test" if args.transition else f"{args.limit}-position proof"
        print(f"F8 verified. Release it. {purpose} in 5 seconds; F8/Ctrl+C now stops. Exclusive controls.", flush=True)
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
            dpi = get_dpi(hwnd)
            if (left, top, w, h) != initial_identity or dpi != 96:
                report["windowChange"] = {"expectedClient": list(initial_identity), "observedClient": [left, top, w, h],
                                          "expectedDpi": 96, "observedDpi": dpi}
                raise ProbeStopped("game-geometry-or-DPI-changed")

        targets = [calibration.to_screen(*grid.DEFAULT_GRID.cell_center(i % grid.DEFAULT_GRID.columns,
                   i // grid.DEFAULT_GRID.columns if args.pilot else 0)) for i in range(args.limit)]
        if args.transition:
            targets = [calibration.to_screen(*grid.DEFAULT_GRID.cell_center(0, 3))]
        guard = InputGuard(check_window, lambda: event.is_set() or not listener.is_alive(), targets,
                           (1 if args.transition else 1 + args.limit * (1 + grid.PANEL_STUCK_RECLICKS)),
                           timeout=30 if args.transition else 180 if args.pilot else 60)
        report["targets"] = targets
        report["pressBudget"] = guard.max_presses
        report["frames"] = []
        frame_dir = output / "frames"
        frame_dir.mkdir()
        bound_calibration, original_grab = capture.calibrate_window()
        if (bound_calibration.window_left, bound_calibration.window_top,
            bound_calibration.frame_width, bound_calibration.frame_height) != initial_identity:
            raise ProbeStopped("bound-capture-window-mismatch")
        selected_frames = {}
        def capture_and_record(evidence=None, frame=None):
            guard.check()
            if len(report["frames"]) >= (600 if args.pilot else 80):
                raise ProbeStopped("capture-budget-exhausted")
            frame = frame if frame is not None else original_grab()
            guard.check()
            if frame.size != (1280, 720):
                raise ProbeStopped("unexpected-frame-size")
            path = frame_dir / f"{len(report['frames']):04d}.png"
            frame.save(path)
            entry = {"path": str(path), "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                     "pressCount": guard.presses, "at": guard.clock()}
            if evidence is not None:
                entry["panelCheck"] = evidence
                expected = evidence["expectedPosition"]
                if evidence["settled"] and expected is not None:
                    selected_frames[expected] = (frame, entry)
                    observation = report["observations"][expected]
                    observation["latestCaptureEvidence"] = str(path)
                    if observation["status"] == "not-visited":
                        observation["status"] = "captured-pending"
            report["frames"].append(entry)
            save_report(report_path, report)
            return frame

        def guarded_capture():
            if not args.pilot:
                return capture_and_record()
            from zzz_pilot import wait_for_panel
            presses = [event for event in guard.events if event["event"] == "press-requested"]
            expected = None
            if presses:
                point = presses[-1]["position"]
                expected = next(i for i, (x, y) in enumerate(targets)
                                if abs(point[0] - x) <= 3 and abs(point[1] - y) <= 3)
            return wait_for_panel(original_grab, calibration, grid.DEFAULT_GRID, args.limit, expected,
                                  guard.check, lambda frame, evidence: capture_and_record(evidence, frame))

        raw_mouse = pynput.mouse.Controller()
        guarded_mouse = GuardedMouse(raw_mouse, guard)
        if args.transition:
            from zzz_transition import run_transition
            report["status"] = "running"
            save_report(report_path, report)
            def record_transition(frame, evidence):
                capture_and_record(frame=frame)
                report["frames"][-1]["transitionCheck"] = evidence
                save_report(report_path, report)
            run_transition(calibration, original_grab, guarded_mouse, guard, record_transition,
                           report, output, lambda: save_report(report_path, report), grid.DEFAULT_GRID)
            return 0
        navigator = grid.GridNavigator(guarded_capture, calibration, kill_event=event, debug_dir=output / "upstream-debug")
        def consume(index, frame, observation):
            guard.check()
            path = output / f"position-{index:02d}.png"
            frame.save(path)
            observation.update({"frame": str(path), "frameSha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                                "captureSequenceAtYield": len(report["frames"]), "pressCount": guard.presses})
            save_report(report_path, report)
            if args.pilot:
                from zzz_pilot import read_frame, selected_positions
                selected = selected_positions(frame, calibration, grid.DEFAULT_GRID, args.limit)
                if selected != [index]:
                    raise ProbeStopped("yielded-frame-selection-mismatch")
                matches = [entry for entry in report["frames"] if entry["sha256"] == observation["frameSha256"]]
                if not matches or not matches[-1].get("panelCheck", {}).get("settled"):
                    raise ProbeStopped("yielded-frame-without-settling-evidence")
                observation.update({"captureEvidence": matches[-1]["path"], "pressCount": matches[-1]["pressCount"]})
                observation.update({"reading": read_frame(frame, calibration, output / f"reading-{index:02d}"),
                                    "status": "read", "selectionVerified": True, "humanApproved": False})
                save_report(report_path, report)
                if args.test_stop and index == 0:
                    await_stop_trial(event, guard, report, lambda: save_report(report_path, report),
                                     notify=lambda: ctypes.windll.kernel32.Beep(880, 200))
                if args.test_geometry and index == 0:
                    await_geometry_trial(guard, report, lambda: save_report(report_path, report),
                                         notify=lambda: ctypes.windll.kernel32.Beep(880, 200))
                return
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
            report["upstreamIncomplete"] = collect_prefix(navigator, args.limit, consume, report["observations"],
                                                         columns=grid.DEFAULT_GRID.columns if args.pilot else None)
        if args.pilot:
            from zzz_pilot import recover_skipped
            # Recover equal panels from stable captures only when the expected
            # cell is visibly selected. Never use content equality as identity.
            recover_skipped(report["observations"], selected_frames, consume)
            report["processedPositions"] = sum(o["status"] == "read" for o in report["observations"])
            report["scopeCounts"] = {scope: sum(o.get("reading", {}).get("scope") == scope for o in report["observations"])
                                     for scope in ("included", "excluded-B", "pending-rarity")}
            report["pilotTraversalComplete"] = report["processedPositions"] == args.limit

        report["status"] = "stopped" if event.is_set() else "prefix-read" if all(o["status"] == "read" for o in report["observations"]) else "partial"
        if event.is_set():
            report["reason"] = "F8"
        result_code = 0
    except TrialFinished as exc:
        report.update({"status": "stopped", "reason": str(exc)})
        result_code = 0 if exc.passed else 1
    except KeyboardInterrupt:
        report.update({"status": "stopped", "reason": "Ctrl+C"})
    except Exception as exc:
        report.update({"status": "stopped", "reason": str(exc)})
        if args.transition and report["observations"][0]["status"] != "read":
            report["observations"][0].update({"status": "failed", "reason": str(exc)})
        if args.test_stop and event is not None and event.is_set() and guard is not None and guard.presses > 0:
            report["stopTest"].update({"passed": True, "signalObservedBeforeCheckpoint": True})
            report["reason"] = "F8"
            result_code = 0
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
        if guard is not None and guard.failure is not None:
            report["guardStop"] = {**guard.failure, "noPressesAfterObservation": guard.presses == guard.failure["pressRequests"],
                                   "noMouseMovesAfterObservation": guard.moves == guard.failure["mouseMoves"]}
        if cleanup_errors:
            report["cleanupErrors"] = cleanup_errors
            if args.test_stop:
                report["stopTest"]["passed"] = False
                result_code = 1
        if args.test_geometry:
            trial = report["geometryTest"]
            if trial.get("pressRequestsAtObservation") is not None:
                trial["noPressesAfterObservation"] = guard.presses == trial["pressRequestsAtObservation"]
                trial["passed"] = trial["passed"] and trial["noPressesAfterObservation"]
            if cleanup_errors:
                trial["passed"] = False
            result_code = 0 if trial["passed"] else 1
        if args.test_stop and report["stopTest"].get("pressRequestsAtSignalObservation") is not None:
            unchanged = guard.presses == report["stopTest"]["pressRequestsAtSignalObservation"]
            report["stopTest"]["noPressesAfterSignalObservation"] = unchanged
            report["stopTest"]["passed"] = report["stopTest"]["passed"] and unchanged
        if event is not None and args.run:
            report["stopObservedDuringRun"] = event.is_set()
        if args.pilot:
            report["processedPositions"] = sum(o["status"] == "read" for o in report["observations"])
            report["scopeCounts"] = {scope: sum(o.get("reading", {}).get("scope") == scope for o in report["observations"])
                                     for scope in ("included", "excluded-B", "pending-rarity")}
            if not args.transition and args.image is None:
                report["pilotTraversalComplete"] = report["processedPositions"] == args.limit and not (args.test_stop or args.test_geometry)
        report["endedAt"] = datetime.now(timezone.utc).isoformat()
        save_report(report_path, report)
        if args.test_stop:
            print("STOP TEST PASSED" if report["stopTest"]["passed"] else "STOP TEST NOT PASSED")
        if args.test_geometry:
            print("GEOMETRY TEST PASSED" if report["geometryTest"]["passed"] else "GEOMETRY TEST NOT PASSED")
        print(f"Qualification report: {report_path}")
    return result_code


if __name__ == "__main__":
    raise SystemExit(main())
