"""Portable selection fails closed; archives cannot escape their destination."""
import importlib.util
import json
import zipfile
from pathlib import Path

import pytest

from test_zzz_launcher import installation, invoke_driver, run_powershell


def test_portable_installation_does_not_require_development_python(tmp_path):
    root = installation(tmp_path)
    (root / '.cache/youkai-p1/.venv/Scripts/python.exe').unlink()
    worker = root / 'runtime/zzz-worker/zzz-worker.exe'
    worker.parent.mkdir(parents=True)
    worker.write_bytes(b'worker fixture, not executed')
    (root / 'portable-build.json').write_text('{}', encoding='utf-8')
    result = run_powershell(tmp_path, invoke_driver(root, check=True))
    assert result['Code'] == 0
    assert result['Opened'] == []


def test_broken_portable_installation_does_not_fall_back_to_development_python(tmp_path):
    root = installation(tmp_path)
    (root / 'portable-build.json').write_text('{}', encoding='utf-8')
    result = run_powershell(tmp_path, invoke_driver(root, check=True))
    assert result['Code'] == 1
    assert result['Opened'] == []


@pytest.fixture
def builder():
    path = Path(__file__).resolve().parents[1] / 'scripts/build_zzz_portable.py'
    spec = importlib.util.spec_from_file_location('zzz_portable_builder', path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_changed_upstream_archive_is_rejected_before_extraction(tmp_path, builder):
    archive = tmp_path / 'changed.zip'
    with zipfile.ZipFile(archive, 'w') as out:
        out.writestr('source/file.py', 'changed')
    destination = tmp_path / 'source'
    with pytest.raises(ValueError, match='SHA256'):
        builder.extract_pinned_source(archive, destination)
    assert not destination.exists()


def test_archive_cannot_write_outside_source_folder(tmp_path, builder, monkeypatch):
    archive = tmp_path / 'malicious.zip'
    with zipfile.ZipFile(archive, 'w') as out:
        out.writestr('source/../outside.py', 'escape')
    monkeypatch.setattr(builder, 'ARCHIVE_SHA256', builder.digest(archive))
    with pytest.raises(ValueError, match='leaves source'):
        builder.extract_pinned_source(archive, tmp_path / 'source')
    assert not (tmp_path / 'outside.py').exists()
