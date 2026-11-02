"""One-folder worker: the console/UAC/result flow stays in start-zzz.ps1.

Adapted from AJTDaedalus/youkai packaging/youkai.spec at the pinned revision.
Upstream MIT notice is included with the assembled package.
"""
import sys
from pathlib import Path
from PyInstaller.utils.hooks import collect_all, collect_submodules

ROOT = Path(SPECPATH).parent
SOURCE = ROOT / '.cache/youkai-p1/youkai-86a8b34511c86ec864d8f40c558789f7ccad4cc9'
SCRIPTS = ROOT / 'scripts'
sys.path[:0] = [str(SOURCE / 'src'), str(SCRIPTS)]
cv_data, cv_binaries, cv_imports = collect_all('cv2')
reader_names = ['youkai_selection.py', 'youkai_capture.py', 'youkai-offline.py',
                'zzz_pilot.py', 'zzz_transition.py', 'zzz_scan.py', 'zzz_inventory.py']
a = Analysis(
    [str(ROOT / 'packaging/zzz_worker.py')],
    pathex=[str(SOURCE / 'src'), str(SCRIPTS)],
    binaries=cv_binaries,
    datas=cv_data + [(str(SOURCE / 'data'), 'data')] +
          [(str(SCRIPTS / name), '.') for name in reader_names],
    hiddenimports=cv_imports + collect_submodules('comtypes') + [
        'youkai_selection', 'youkai_capture', 'zzz_pilot', 'zzz_transition',
        'zzz_scan', 'zzz_inventory', 'pynput.keyboard._win32', 'pynput.mouse._win32',
        'win32gui', 'win32process', 'win32api', 'win32con', 'pywintypes', 'dxcam',
    ],
    excludes=['pytest', 'pytest_cov', 'tkinter', 'matplotlib', 'IPython'],
    noarchive=False,
)
pyz = PYZ(a.pure)
exe = EXE(pyz, a.scripts, [], exclude_binaries=True, name='zzz-worker',
          console=True, strip=False, upx=False)
coll = COLLECT(exe, a.binaries, a.datas, name='zzz-worker', strip=False, upx=False)
