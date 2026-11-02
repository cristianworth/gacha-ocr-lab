"""Atomic report replacement under real Windows reader locks, without desktop inputs."""
import json
import sys
from pathlib import Path
from unittest.mock import Mock

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import youkai_selection as selection


@pytest.mark.skipif(sys.platform != 'win32', reason='Windows replacement sharing semantics')
def test_transient_reader_lock_retries_and_keeps_previous_json_until_replacement(tmp_path, monkeypatch):
    path = tmp_path / 'session.json'
    path.write_text('{"status":"previous"}', encoding='utf-8')
    with path.open(encoding='utf-8') as reader:
        def release_reader(delay):
            assert json.loads(path.read_text()) == {'status': 'previous'}
            reader.close()
        sleep = Mock(side_effect=release_reader)
        monkeypatch.setattr(selection.time, 'sleep', sleep)
        selection.save_report(path, {'status': 'next'})
    assert json.loads(path.read_text()) == {'status': 'next'}
    assert not path.with_suffix('.tmp').exists()
    assert sleep.call_count == 1


@pytest.mark.skipif(sys.platform != 'win32', reason='Windows replacement sharing semantics')
def test_persistent_reader_lock_fails_with_previous_json_and_new_temporary_intact(tmp_path, monkeypatch):
    path = tmp_path / 'session.json'
    path.write_text('{"status":"previous"}', encoding='utf-8')
    sleep = Mock()
    monkeypatch.setattr(selection.time, 'sleep', sleep)
    with path.open(encoding='utf-8') as reader, pytest.raises(PermissionError):
        selection.save_report(path, {'status': 'next'})
    assert sleep.call_count == 4
    assert json.loads(path.read_text()) == {'status': 'previous'}
    assert json.loads(path.with_suffix('.tmp').read_text()) == {'status': 'next'}


def test_unrelated_filesystem_error_is_not_retried(tmp_path, monkeypatch):
    path = tmp_path / 'session.json'
    replace = Mock(side_effect=OSError('disk full'))
    sleep = Mock()
    monkeypatch.setattr(Path, 'replace', replace)
    monkeypatch.setattr(selection.time, 'sleep', sleep)
    with pytest.raises(OSError, match='disk full'):
        selection.save_report(path, {'status': 'next'})
    assert replace.call_count == 1
    sleep.assert_not_called()
