"""Guarded HSR Light Cone 20+ entry. No menu automation, mouse or catalog guesses."""
import argparse
import hashlib
import json
import time
from datetime import datetime, timezone
from pathlib import Path

from hsr_inventory import run_inventory, save_session
from hsr_reader import REFERENCE
from scan_runtime import (GuardedAdvance, InputGuard, ProbeStopped, check_external_stop,
                          integrity_level, wait_for_f8, wait_for_preparation)


class HsrWindow:
    def __init__(self):
        import ctypes
        import win32gui
        import win32process
        self.gui = win32gui
        self.process = win32process
        self.dpi = ctypes.windll.user32.GetDpiForWindow
        self.dpi.argtypes = [ctypes.c_void_p]
        self.dpi.restype = ctypes.c_uint
        ctypes.windll.user32.SetProcessDPIAware()
        windows = []
        win32gui.EnumWindows(lambda hwnd, _: windows.append(hwnd) if win32gui.IsWindowVisible(hwnd) and
                             win32gui.GetWindowText(hwnd) == 'Honkai: Star Rail' else None, None)
        if len(windows) != 1:
            raise ProbeStopped('unique-Honkai-Star-Rail-window-required')
        self.hwnd = windows[0]
        self.pid = win32process.GetWindowThreadProcessId(self.hwnd)[1]
        self.identity = self.geometry()
        if self.identity[2:] != (1280, 720) or self.dpi(self.hwnd) != 96:
            raise ProbeStopped('HSR-requires-1280x720-client-and-100-percent-DPI')
        self.helper_level, self.target_level = integrity_level(), integrity_level(self.pid)
        if self.helper_level < self.target_level:
            raise ProbeStopped('input-integrity-mismatch')

    def geometry(self):
        width, height = self.gui.GetClientRect(self.hwnd)[2:]
        return (*self.gui.ClientToScreen(self.hwnd, (0,0)), width, height)

    def check(self):
        if not self.gui.IsWindow(self.hwnd) or not self.gui.IsWindowVisible(self.hwnd) or self.gui.IsIconic(self.hwnd):
            raise ProbeStopped('game-window-unavailable')
        if self.gui.GetForegroundWindow() != self.hwnd:
            raise ProbeStopped('game-focus-lost')
        if self.process.GetWindowThreadProcessId(self.hwnd)[1] != self.pid:
            raise ProbeStopped('game-process-changed')
        if self.geometry() != self.identity or self.dpi(self.hwnd) != 96:
            raise ProbeStopped('game-geometry-or-DPI-changed')

    def grab(self):
        from PIL import ImageGrab
        self.check()
        left, top, width, height = self.identity
        frame = ImageGrab.grab(bbox=(left,top,left+width,top+height), all_screens=True)
        self.check()
        if frame.size != (1280,720):
            raise ProbeStopped('unexpected-frame-size')
        return frame.convert('RGB')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('cache', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--prepared', action='store_true')
    parser.add_argument('--max-positions', type=int, default=2000)
    args = parser.parse_args()
    if not args.prepared or not 1 <= args.max_positions <= 2000:
        parser.error('Confirm manual Light Cone/Lv descending/top/first item; max positions 1..2000.')
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    stop = output / 'stop.request'
    report = {'schemaVersion': 1, 'mode': 'hsr-inventory', 'game': 'hsr', 'itemType': 'light-cone',
              'startedAt': datetime.now(timezone.utc).isoformat(), 'phase': 'starting', 'status': 'starting',
              'observations': [], 'scopeComplete': False, 'coverageConfirmed': False, 'captureComplete': False,
              'inventoryAccepted': False, 'maxPositions': args.max_positions, 'minLevel': 20,
              'sourceReference': REFERENCE, 'requiresManualReview': True,
              'externalStop': {'requestFile': str(stop), 'observed': False},
              'readerSourceSha256': {name: hashlib.sha256(Path(__file__).with_name(name).read_bytes()).hexdigest()
                                    for name in ('hsr_scan.py','hsr_reader.py','hsr_inventory.py','scan_runtime.py','zzz_ocr.py')}}
    listener = advance = reader = guard = None
    code = 1
    try:
        check_external_stop(stop)
        window = HsrWindow()
        report['window'] = {'title': 'Honkai: Star Rail', 'client': list(window.identity), 'pid': window.pid}
        report['inputAccess'] = {'helperIntegrity': window.helper_level, 'targetIntegrity': window.target_level}
        from pynput.keyboard import Controller, Key
        from youkai_ocr.grid import make_kill_listener
        from youkai_ocr.recognize import make_recognizer
        from zzz_ocr import make_session_recognizer
        event, listener = make_kill_listener(kill_key=Key.f8)
        print('Antes de comecar: volte ao HSR e pressione/solte F8 em ate 30 segundos. F8 interrompe.', flush=True)
        if not wait_for_f8(event, listener, stop):
            raise ProbeStopped('F8-not-observed-within-30-seconds')
        event.clear()
        print('F8 confirmado. Aguarde cinco segundos com HSR na frente e controles livres.', flush=True)
        wait_for_preparation(event, listener, stop)
        def stopped():
            check_external_stop(stop)
            return event.is_set() or not listener.is_alive()
        guard = InputGuard(window.check, stopped, [], 0, timeout=3600)
        moves = args.max_positions-1
        advance = GuardedAdvance(Controller(), guard, moves)
        reader, report['ocrBackend'] = make_session_recognizer(args.cache, make_recognizer)
        print('Capturando Cones de Luz 20+. D/A alternam por linha; S desce. F8 interrompe.', flush=True)
        run_inventory(window.grab, advance, guard, reader, output, report)
        code = 0
    except Exception as exc:
        report.update(status='stopped', reason=str(exc), scopeComplete=False, coverageConfirmed=False)
        report['externalStop']['observed'] = str(exc) == 'external-stop-requested'
        if hasattr(exc, 'wait_evidence'):
            report['selectionWait'] = exc.wait_evidence
        if getattr(exc, 'frame', None) is not None:
            from youkai_capture import save_evidence_image
            failed_frame = output / 'unconfirmed-start.png'
            save_evidence_image(exc.frame, failed_frame)
            report['unconfirmedFrame'] = {'path': str(failed_frame), 'sha256': hashlib.sha256(failed_frame.read_bytes()).hexdigest()}
        print(f'Coleta HSR parada: {exc}', flush=True)
    finally:
        errors = []
        for label, resource in (('keyboard',advance),('OCR',reader)):
            if resource is not None and hasattr(resource,'close'):
                try:
                    resource.close()
                except Exception as exc:
                    errors.append(f'{label}: {exc}')
        if listener is not None:
            try:
                listener.stop()
                listener.join(timeout=2)
            except Exception as exc:
                errors.append(f'listener: {exc}')
        if guard is not None:
            report['inputEvents'] = guard.events
            report['guardStop'] = guard.failure
        report['keyRequests'] = advance.requests if advance is not None else 0
        report['clickRequests'] = report['scrollRequests'] = 0
        report['liveInputTested'] = report['keyRequests'] > 0
        if errors:
            report.update(cleanupErrors=errors, scopeComplete=False, coverageConfirmed=False)
            code = 1
        report['phase'] = 'finished'
        if not report['scopeComplete'] and report['status'] == 'running':
            report['status'] = 'inventory-inconclusive'
        report['endedAt'] = datetime.now(timezone.utc).isoformat()
        save_session(output, report)
        print('Coleta HSR finalizada; confira o resumo.' if report['scopeComplete'] else 'Coleta HSR parcial; confira o resumo e as pendencias.', flush=True)
    return code


if __name__ == '__main__':
    raise SystemExit(main())
