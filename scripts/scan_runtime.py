"""Shared stop, input guards and atomic manifests for guarded scanners."""
import json
import time


class ProbeStopped(RuntimeError):
    pass


def check_external_stop(path):
    if path.is_file():
        raise ProbeStopped('external-stop-requested')


def wait_for_f8(event, listener, stop_path, *, timeout=30, clock=time.monotonic):
    deadline = clock() + timeout
    while True:
        check_external_stop(stop_path)
        if not listener.is_alive():
            raise ProbeStopped('stop-listener-unavailable')
        remaining = deadline - clock()
        if remaining <= 0:
            return False
        if event.wait(min(.05, remaining)):
            check_external_stop(stop_path)
            return True


def wait_for_preparation(event, listener, stop_path):
    # Preserve the five seconds for focus while observing external stop and F8.
    for _ in range(100):
        check_external_stop(stop_path)
        if event.is_set():
            raise ProbeStopped('stopped-before-focus')
        if not listener.is_alive():
            raise ProbeStopped('stop-listener-unavailable')
        time.sleep(.05)
    check_external_stop(stop_path)
    if event.is_set():
        raise ProbeStopped('stopped-before-focus')


class InputGuard:
    def __init__(self, check_window, stopped, targets, max_presses, *, timeout=60, clock=time.monotonic,
                 scroll_target=None, max_scrolls=0):
        self.check_window = check_window
        self.stopped = stopped
        self.targets = targets
        self.max_presses = max_presses
        self.clock = clock
        self.deadline = clock() + timeout
        self.presses = 0
        self.moves = 0
        self.scrolls = 0
        self.scroll_target = scroll_target
        self.max_scrolls = max_scrolls
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
                                "mouseMoves": self.moves, "scrollRequests": self.scrolls}
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

    def scroll(self, point, dx, dy):
        self.check()
        if not self.max_scrolls or self.scroll_target is None:
            raise ProbeStopped("scroll-blocked: prepare the viewport at the top manually")
        if (dx, dy) != (0, -1):
            raise ProbeStopped("only-one-downward-wheel-step-is-allowed")
        if any(abs(value - target) > 3 for value, target in zip(point, self.scroll_target)):
            raise ProbeStopped("scroll-outside-approved-target")
        if self.scrolls >= self.max_scrolls:
            raise ProbeStopped("scroll-budget-exhausted")
        self.scrolls += 1
        self.events.append({"event": "scroll-requested", "number": self.scrolls, "position": list(point),
                            "dx": dx, "dy": dy, "at": self.clock()})


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
        self.guard.scroll(self.mouse.position, dx, dy)
        self.mouse.scroll(dx, dy)

    def close(self):
        for button in tuple(self.held):
            self.release(button)


class GuardedAdvance:
    """Bounded HSR grid keys; release our held key even after a stop."""
    def __init__(self, keyboard, guard, maximum):
        self.keyboard, self.guard, self.maximum = keyboard, guard, maximum
        self.requests = 0
        self.held = False
        self.held_key = None

    def next(self, key='d'):
        if key not in ('a', 's', 'd'):
            raise ProbeStopped('only-HSR-grid-navigation-keys-allowed')
        self.guard.check()
        if self.requests >= self.maximum:
            raise ProbeStopped('advance-budget-exhausted')
        self.requests += 1
        self.guard.events.append({'event': 'advance-requested', 'key': key, 'number': self.requests,
                                  'at': self.guard.clock()})
        self.held = True
        self.held_key = key
        try:
            self.keyboard.press(key)
        finally:
            self.close()

    def close(self):
        if self.held:
            key = self.held_key
            self.keyboard.release(key)
            self.held = False
            self.held_key = None
            self.guard.events.append({'event': 'key-release', 'key': key, 'at': self.guard.clock()})


def write_manifest(path, report):
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    # Windows readers can briefly deny replacement without denying file writes.
    # Keep the last complete JSON intact and fail if the lock does not clear.
    delays = (0, .025, .05, .1, .2)
    for attempt, delay in enumerate(delays):
        if delay:
            time.sleep(delay)
        try:
            temporary.replace(path)
            break
        except PermissionError as exc:
            if getattr(exc, 'winerror', None) not in (5, 32, 33) or attempt == len(delays) - 1:
                raise


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
