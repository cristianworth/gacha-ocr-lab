"""Bounded image persistence with main-thread inventory checkpoints.

The caller owns the session JSON and only acknowledges receipts after flush.
The worker never checks focus, emits inputs, or mutates a session report.
"""

from collections import deque
from concurrent.futures import ThreadPoolExecutor, wait as wait_futures
from copy import deepcopy
import hashlib
from pathlib import Path
import time

from youkai_capture import save_evidence_image


class EvidenceWriteError(OSError):
    pass


def write_evidence(path, frame, metadata):
    started = time.perf_counter()
    # A repeated destination is an error, never an overwrite of old evidence.
    with path.open('xb') as stream:
        save_evidence_image(frame, stream)
    return {**metadata, 'path': str(path),
            'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
            'writeSeconds': time.perf_counter() - started}


class BufferedEvidenceWriter:
    def __init__(self, *, capacity=4, persist=write_evidence):
        if capacity < 1:
            raise ValueError('capacity must be positive')
        self.capacity = capacity
        self.persist = persist
        self.receipts = []
        self.errors = []
        self.submitted = 0
        self.peak_pending = 0
        self.backpressure_seconds = 0.0
        self._pending = deque()
        self._paths = set()
        self._closed = False
        self._executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix='zzz-evidence')

    def _collect(self, *, wait=False, check=None):
        while self._pending:
            path, future = self._pending[0]
            if not wait and not future.done():
                return
            if wait and check:
                while not future.done():
                    wait_futures((future,), timeout=.02)
                    if not future.done():
                        check()
            try:
                receipt = future.result()
            except Exception as exc:
                self.errors.append({'path': str(path), 'error': str(exc)})
            else:
                self.receipts.append(receipt)
            self._pending.popleft()
            if not wait:
                continue

    def check(self):
        self._collect()
        if self.errors:
            first = self.errors[0]
            raise EvidenceWriteError(f"evidence-write-failed: {first['path']}: {first['error']}")

    def submit(self, path, frame, metadata, *, check=lambda: None):
        if self._closed:
            raise RuntimeError('evidence-writer-closed')
        self.check()
        path = Path(path)
        if path in self._paths:
            raise ValueError('duplicate-evidence-path')
        if len(self._pending) >= self.capacity:
            started = time.perf_counter()
            try:
                # Keep stop/focus checks responsive while a slow disk applies backpressure.
                self._collect(wait=True, check=check)
            finally:
                self.backpressure_seconds += time.perf_counter() - started
            self.check()
        check()
        owned_frame = frame.copy()
        owned_metadata = deepcopy(metadata)
        future = self._executor.submit(self.persist, path, owned_frame, owned_metadata)
        self._paths.add(path)
        self._pending.append((path, future))
        self.submitted += 1
        self.peak_pending = max(self.peak_pending, len(self._pending))

    def flush(self):
        # Drain already accepted images even after F8/focus loss or a failed write.
        self._collect(wait=True)
        self.check()

    def close(self):
        if not self._closed:
            self._closed = True
            try:
                self.flush()
            finally:
                self._executor.shutdown(wait=True)
        else:
            self.check()


class InventoryEvidenceRecorder:
    """Publish only completed writes; checkpoint all accepted images before acknowledgment."""

    def __init__(self, report, directory, guard, save, *, writer=None):
        self.report, self.directory, self.guard, self.save = report, Path(directory), guard, save
        self.writer = writer if writer is not None else BufferedEvidenceWriter(capacity=4)
        self._published = 0
        self._submitting = False
        self._publish()

    def _publish(self):
        for receipt in self.writer.receipts[self._published:]:
            entry = dict(receipt)
            seconds = entry.pop('writeSeconds')
            self.report['frames'].append(entry)
            if 'performance' in self.report:
                self.report['performance']['frameEvidenceSeconds'] += seconds
        self._published = len(self.writer.receipts)
        self.report['evidenceWriting'] = {
            'mode': 'background', 'capacity': self.writer.capacity,
            'submitted': self.writer.submitted, 'written': self._published,
            'pending': self.writer.submitted - self._published - len(self.writer.errors),
            'peakPending': self.writer.peak_pending,
            'backpressureSeconds': self.writer.backpressure_seconds,
            'errors': list(self.writer.errors), 'checkpoint': 'confirmed-selection',
            'frameTimeMeaning': 'capture before enqueue'}
        if self.writer.errors:
            self.report.update(scopeComplete=False, coverageConfirmed=False, captureComplete=False)

    def check(self):
        if self._submitting:
            # A backpressure callback still checks focus/F8, without draining the same queue twice.
            return
        try:
            self.writer.check()
        finally:
            self._publish()

    def record(self, frame, evidence):
        self.guard.check()
        if self.writer.submitted >= self.report['frameBudget']:
            raise RuntimeError('capture-budget-exhausted')
        if frame.size != (1280, 720):
            raise RuntimeError('unexpected-frame-size')
        path = self.directory / f'{self.writer.submitted:04d}.png'
        metadata = {'pressCount': self.guard.presses, 'scrollCount': self.guard.scrolls,
                    'at': self.guard.clock(), 'inventoryCheck': evidence}
        self._submitting = True
        try:
            self.writer.submit(path, frame, metadata, check=self.guard.check)
        finally:
            self._submitting = False
        self.check()
        if evidence.get('settled'):
            self.checkpoint()

    def checkpoint(self):
        try:
            self.writer.flush()
        finally:
            self._publish()
            self.save()

    def close(self):
        try:
            self.writer.close()
        finally:
            self._publish()
