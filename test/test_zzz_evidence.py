"""Persistence experiment: bounded memory, ownership, stop and write failures."""

import hashlib
import sys
from pathlib import Path
from threading import Event, get_ident

from PIL import Image
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from zzz_evidence import BufferedEvidenceWriter, EvidenceWriteError, InventoryEvidenceRecorder, write_evidence


def test_writer_owns_pixels_and_metadata_until_flush(tmp_path):
    gate = Event()
    entered = Event()
    threads = []
    def persist(*args):
        threads.append(get_ident())
        entered.set()
        assert gate.wait(3)
        return write_evidence(*args)
    writer = BufferedEvidenceWriter(persist=persist)
    frame = Image.new('RGB', (4, 4), 'red')
    metadata = {'check': {'settled': True}}
    writer.submit(tmp_path / 'one.png', frame, metadata)
    assert entered.wait(3)
    assert writer.receipts == []
    frame.paste('blue', (0, 0, 4, 4))
    metadata['check']['settled'] = False
    gate.set()
    writer.close()
    with Image.open(tmp_path / 'one.png') as saved:
        assert saved.getpixel((0, 0)) == (255, 0, 0)
    receipt = writer.receipts[0]
    assert receipt['check']['settled'] is True
    assert receipt['sha256'] == hashlib.sha256((tmp_path / 'one.png').read_bytes()).hexdigest()
    assert threads[0] != get_ident()


@pytest.mark.parametrize('reason', ['F8', 'game-focus-lost'])
def test_backpressure_observes_stop_without_accepting_another_image(tmp_path, reason):
    gate = Event()
    def persist(*args):
        assert gate.wait(3)
        return write_evidence(*args)
    writer = BufferedEvidenceWriter(capacity=1, persist=persist)
    frame = Image.new('RGB', (4, 4))
    writer.submit(tmp_path / 'one.png', frame, {})
    def stop():
        raise RuntimeError(reason)
    try:
        with pytest.raises(RuntimeError, match=reason):
            writer.submit(tmp_path / 'two.png', frame, {}, check=stop)
    finally:
        gate.set()
        writer.close()
    assert writer.submitted == writer.peak_pending == 1
    assert len(writer.receipts) == 1
    assert not (tmp_path / 'two.png').exists()


def test_full_queue_applies_backpressure_without_dropping_or_reordering(tmp_path):
    gate = Event()
    def persist(*args):
        assert gate.wait(3)
        return write_evidence(*args)
    writer = BufferedEvidenceWriter(capacity=4, persist=persist)
    frame = Image.new('RGB', (4, 4))
    for index in range(4):
        writer.submit(tmp_path / f'{index}.png', frame, {'index': index})
    checked = []
    def release():
        checked.append(True)
        gate.set()
    try:
        writer.submit(tmp_path / '4.png', frame, {'index': 4}, check=release)
    finally:
        gate.set()
        writer.close()
    assert checked and writer.peak_pending == 4
    assert [receipt['index'] for receipt in writer.receipts] == list(range(5))
    assert writer.backpressure_seconds > 0


def test_partial_file_and_writer_timeout_remain_failures_without_receipts(tmp_path):
    path = tmp_path / 'partial.png'
    def persist(path, *args):
        path.write_bytes(b'partial')
        raise TimeoutError('disk-timeout')
    writer = BufferedEvidenceWriter(persist=persist)
    writer.submit(path, Image.new('RGB', (4, 4)), {})
    with pytest.raises(EvidenceWriteError, match='disk-timeout'):
        writer.close()
    assert writer.receipts == [] and len(writer.errors) == 1
    assert path.read_bytes() == b'partial'


def test_write_failure_drains_other_accepted_images_but_never_succeeds(tmp_path):
    gate = Event()
    def persist(path, *args):
        assert gate.wait(3)
        if path.name == 'bad.png':
            raise OSError('disk-full')
        return write_evidence(path, *args)
    writer = BufferedEvidenceWriter(persist=persist)
    frame = Image.new('RGB', (4, 4))
    writer.submit(tmp_path / 'bad.png', frame, {})
    writer.submit(tmp_path / 'good.png', frame, {})
    gate.set()
    with pytest.raises(EvidenceWriteError, match='disk-full'):
        writer.close()
    assert len(writer.errors) == len(writer.receipts) == 1
    assert Path(writer.receipts[0]['path']).name == 'good.png'
    with pytest.raises(EvidenceWriteError):
        writer.check()


def test_existing_evidence_and_duplicate_queue_paths_are_preserved(tmp_path):
    path = tmp_path / 'old.png'
    path.write_bytes(b'original')
    writer = BufferedEvidenceWriter()
    writer.submit(path, Image.new('RGB', (4, 4)), {})
    with pytest.raises((ValueError, EvidenceWriteError)):
        writer.submit(path, Image.new('RGB', (4, 4)), {})
    with pytest.raises(EvidenceWriteError):
        writer.close()
    assert path.read_bytes() == b'original'


def test_closed_writer_cannot_receive_more_work(tmp_path):
    writer = BufferedEvidenceWriter()
    writer.close()
    writer.close()
    with pytest.raises(RuntimeError, match='closed'):
        writer.submit(tmp_path / 'late.png', Image.new('RGB', (4, 4)), {})


@pytest.mark.parametrize('capacity', [0, -1])
def test_invalid_capacity_is_rejected(capacity):
    with pytest.raises(ValueError):
        BufferedEvidenceWriter(capacity=capacity)


def recorder_fixture(tmp_path, writer=None):
    from copy import deepcopy
    from types import SimpleNamespace
    report = {'frames': [], 'frameBudget': 50, 'scopeComplete': False,
              'performance': {'frameEvidenceSeconds': 0}}
    snapshots = []
    guard = SimpleNamespace(check=lambda: None, clock=lambda: 10, presses=1, scrolls=0)
    recorder = InventoryEvidenceRecorder(report, tmp_path, guard,
                                         lambda: snapshots.append(deepcopy(report)), writer=writer)
    return recorder, report, snapshots, guard


def test_checkpoint_only_publishes_written_images_and_preserves_order(tmp_path):
    gate = Event()
    def persist(*args):
        assert gate.wait(3)
        return write_evidence(*args)
    recorder, report, snapshots, guard = recorder_fixture(tmp_path, BufferedEvidenceWriter(persist=persist))
    frame = Image.new('RGB', (1280, 720))
    recorder.record(frame, {'settled': False})
    assert snapshots == [] and report['frames'] == []
    assert report['evidenceWriting']['pending'] == 1
    gate.set()
    recorder.record(frame, {'settled': True})
    recorder.close()
    assert len(snapshots) == 1 and len(snapshots[0]['frames']) == 2
    assert [Path(f['path']).name for f in report['frames']] == ['0000.png', '0001.png']
    assert report['evidenceWriting']['pending'] == 0


def test_failed_checkpoint_saves_successful_receipts_and_cannot_claim_coverage(tmp_path):
    gate = Event()
    def persist(path, *args):
        assert gate.wait(3)
        if path.name == '0000.png':
            raise OSError('disk-full')
        return write_evidence(path, *args)
    recorder, report, snapshots, guard = recorder_fixture(tmp_path, BufferedEvidenceWriter(persist=persist))
    frame = Image.new('RGB', (1280, 720))
    recorder.record(frame, {'settled': False})
    recorder.record(frame, {'settled': False})
    report.update(scopeComplete=True, coverageConfirmed=True, captureComplete=True)
    gate.set()
    with pytest.raises(EvidenceWriteError):
        recorder.checkpoint()
    with pytest.raises(EvidenceWriteError):
        recorder.close()
    assert snapshots[-1]['scopeComplete'] is snapshots[-1]['coverageConfirmed'] is False
    assert len(snapshots[-1]['frames']) == 1
    assert snapshots[-1]['evidenceWriting']['errors']


def test_cleanup_after_focus_loss_drains_without_rechecking_focus(tmp_path):
    recorder, report, snapshots, guard = recorder_fixture(tmp_path)
    recorder.record(Image.new('RGB', (1280, 720)), {'settled': False})
    def lost_focus():
        raise RuntimeError('game-focus-lost')
    guard.check = lost_focus
    recorder.close()
    recorder.checkpoint()
    assert len(snapshots[-1]['frames']) == 1 and report['evidenceWriting']['pending'] == 0


def test_focus_check_can_poll_recorder_during_backpressure_without_reentrancy(tmp_path):
    gate = Event()
    def persist(*args):
        assert gate.wait(3)
        return write_evidence(*args)
    recorder, report, snapshots, guard = recorder_fixture(tmp_path, BufferedEvidenceWriter(capacity=1, persist=persist))
    frame = Image.new('RGB', (1280, 720))
    recorder.record(frame, {'settled': False})
    def check():
        recorder.check()
        gate.set()
    guard.check = check
    try:
        recorder.record(frame, {'settled': True})
    finally:
        gate.set()
        recorder.close()
    assert len(report['frames']) == 2 and not report['evidenceWriting']['errors']
