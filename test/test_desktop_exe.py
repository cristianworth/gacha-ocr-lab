"""The small GUI executable starts its adjacent CMD; no scanner or UAC is invoked."""
import shutil
import subprocess
import sys
import time
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
pytestmark = pytest.mark.skipif(sys.platform != 'win32', reason='Windows launcher')


@pytest.fixture(scope='module')
def launcher(tmp_path_factory):
    root = tmp_path_factory.mktemp('desktop-exe')
    target = root / 'gacha-ocr-zzz.exe'
    subprocess.run(['powershell.exe', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File',
                    str(ROOT / 'scripts/build-desktop-launcher.ps1'), '-OutputPath', str(target)],
                   capture_output=True, check=True, timeout=30)
    return target


def test_exe_calls_cmd_from_its_installation_with_spaced_path_and_other_cwd(tmp_path, launcher):
    root = tmp_path / "ZZZ launcher with apostrophe's"
    (root / 'scripts').mkdir(parents=True)
    exe = root / launcher.name
    shutil.copyfile(launcher, exe)
    (root / 'scripts/start-desktop.ps1').write_text('# Test installation only')
    (root / 'scan-desktop.cmd').write_text('@echo off\r\necho called> "%~dp0called.txt"\r\n', encoding='ascii')
    assert subprocess.run([str(exe), '--check'], cwd=tmp_path, timeout=5).returncode == 0
    assert not (root / 'called.txt').exists()
    assert subprocess.run([str(exe)], cwd=tmp_path, timeout=5).returncode == 0
    deadline = time.monotonic() + 5
    while not (root / 'called.txt').exists() and time.monotonic() < deadline:
        time.sleep(.05)
    assert (root / 'called.txt').read_text().strip() == 'called'


def test_exe_check_rejects_missing_entry_without_opening_ui(tmp_path, launcher):
    exe = tmp_path / launcher.name
    shutil.copyfile(launcher, exe)
    assert subprocess.run([str(exe), '--check'], timeout=5).returncode == 1
    assert subprocess.run([str(exe), '--unsupported'], timeout=5).returncode == 2
