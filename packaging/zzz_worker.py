"""Frozen entry point for the existing guarded scanner, with an input-free check."""
import importlib.util
import json
import os
import subprocess
import sys
from pathlib import Path


def self_check(cache):
    cache = cache.resolve(strict=True)
    os.environ['TESSDATA_PREFIX'] = str(cache / 'tesseract/tessdata')
    os.environ['PATH'] = str(cache / 'tesseract') + os.pathsep + os.environ.get('PATH', '')
    import cv2
    import dxcam
    import pynput.keyboard._win32
    import pynput.mouse._win32
    import win32gui
    import win32process
    from youkai_ocr import capture, grid, normalizer, recognize, wengine_scanner
    import youkai_selection
    import zzz_inventory
    import zzz_evidence
    import hsr_scan
    import hsr_inventory
    import hsr_reader

    offline_path = Path(youkai_selection.__file__).with_name('youkai-offline.py')
    spec = importlib.util.spec_from_file_location('youkai_offline', offline_path)
    offline = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(offline)
    checked = offline.verify_source(cache, cache / f'youkai-{offline.SHA}')
    from PIL import Image
    from zzz_ocr import NativeTesseract
    with NativeTesseract(cache) as native:
        native.read_line(Image.new('RGB', (120, 40), 'black'), 'white_text_on_dark')
    # Tesseract must come from this package even if another copy is installed.
    version = subprocess.run([str(cache / 'tesseract/tesseract.exe'), '--version'],
                             capture_output=True, text=True, check=True).stdout.splitlines()[0]
    result = {'status': 'ready', 'frozen': bool(getattr(sys, 'frozen', False)),
              'sourceFilesChecked': checked, 'tesseract': version,
              'nativeOCRChecked': True, 'backgroundWriterAvailable': True,
              'capturePerformed': False, 'inputPerformed': False}
    print(json.dumps(result))
    return 0


def main():
    if len(sys.argv) == 3 and sys.argv[1] == '--self-check':
        return self_check(Path(sys.argv[2]))
    if len(sys.argv) > 1 and sys.argv[1] == '--hsr':
        sys.argv.pop(1)
        from hsr_scan import main as hsr
        return hsr()
    from youkai_selection import main as scan
    return scan()


if __name__ == '__main__':
    raise SystemExit(main())
