"""P3.2: one bounded ZZZ viewport transition, without inventory end inference."""

import hashlib
import numpy as np

from zzz_pilot import PanelNotReady, crop, read_frame, wait_for_panel

# Same measured scrollbar geometry as pinned Youkai; no private API calls.
SCROLLBAR = (1358, 232, 1373, 872)
SOURCE_CELL = (0, 2)
RESULT_CELL = (0, 1)
SCROLL_CELL = (4, 1)


class TransitionRejected(RuntimeError):
    pass


def scrollbar_top(frame, calibration):
    strip = np.array(crop(frame, calibration, SCROLLBAR).convert("L"), dtype=float)
    bright = np.flatnonzero(strip.mean(axis=1) > 18)
    if not len(bright):
        return None
    top = calibration.scale_bbox(SCROLLBAR)[1] + int(bright[0])
    return top / calibration.scale_y


def grid_patches(frame, calibration, grid):
    patches = []
    for row in range(grid.rows_visible):
        cells = []
        for column in range(grid.columns):
            x, y = grid.cell_center(column, row)
            # Interior art avoids selection border, level text and equipped portrait.
            image = crop(frame, calibration, (x - 44, y + 5, x + 44, y + 66)).convert("L")
            cells.append(np.array(image.resize((40, 28)), dtype=float))
        patches.append(cells)
    return patches


def compare_viewports(before, after, calibration, grid):
    first, second = grid_patches(before, calibration, grid), grid_patches(after, calibration, grid)
    scores = []
    for shift in range(3):
        errors = [float(np.abs(first[row + shift][column] - second[row][column]).mean())
                  for row in range(grid.rows_visible - shift) for column in range(grid.columns)]
        scores.append({"rows": shift, "medianError": float(np.median(errors)),
                       "matchingFraction": sum(error <= 12 for error in errors) / len(errors),
                       "cellsCompared": len(errors)})
    ranked = sorted(scores, key=lambda score: score["medianError"])
    best, other = ranked[:2]
    accepted = (best["rows"] == 1 and best["medianError"] <= 12 and best["matchingFraction"] >= .70
                and other["medianError"] - best["medianError"] >= 3)
    return {"verified": accepted, "relativeRowsAdvanced": 1 if accepted else None,
            "candidates": scores, "method": "overlap of thumbnail interiors; not item identity"}


def run_transition(calibration, grab, mouse, guard, record, report, output, save, grid, *,
                   click=None, reader=None):
    from youkai_ocr.input_utils import natural_click
    click = click or natural_click
    reader = reader or read_frame
    report["transition"] = {"status": "preparing", "verified": False,
                            "method": "one middle-row selection plus one downward wheel step",
                            "sourceViewportCell": {"row": SOURCE_CELL[1], "column": SOURCE_CELL[0]},
                            "resultViewportCell": {"row": RESULT_CELL[1], "column": RESULT_CELL[0]},
                            "absoluteInventoryPositionConfirmed": False}
    save()
    if report["globalCountCandidate"] <= grid.columns * grid.rows_visible:
        raise TransitionRejected("transition-needs-more-than-one-viewport; header-is-only-a-global-candidate")
    before = wait_for_panel(grab, calibration, grid, 36, None, guard.check,
                            lambda frame, evidence: record(frame, {"stage": "before", **evidence}))
    top_before = scrollbar_top(before, calibration)
    report["transition"]["scrollbarBefore"] = top_before
    if top_before is None or top_before > 250:
        raise TransitionRejected("prepare-viewport-at-top; no automatic rewind")
    if any(float(patch.std()) < 12 for patch in grid_patches(before, calibration, grid)[3]):
        raise TransitionRejected("last-visible-row-not-confirmed-full")
    before_path = output / "transition-before.png"
    before.save(before_path)
    report["transition"].update({"status": "click-requested", "beforeFrame": str(before_path),
        "beforeFrameSha256": hashlib.sha256(before_path.read_bytes()).hexdigest()})
    save()
    guard.check()
    # The real 1280x720 trial selected the bottom card without scrolling.
    # Select an interior row, then measure exactly one explicit wheel request.
    click(mouse, *calibration.to_screen(*grid.cell_center(*SOURCE_CELL)))
    source_index = SOURCE_CELL[1] * grid.columns + SOURCE_CELL[0]
    wait_for_panel(grab, calibration, grid, 36, source_index, guard.check,
                   lambda frame, evidence: record(frame, {"stage": "selected-before-wheel", **evidence}))
    guard.check()
    mouse.position = calibration.to_screen(*grid.cell_center(*SCROLL_CELL))
    report["transition"]["status"] = "wheel-requested"
    save()
    mouse.scroll(0, -1)
    latest = [None]
    def record_after(frame, evidence):
        latest[0] = frame
        record(frame, {"stage": "after", **evidence})

    def persist_after(frame, *, selection_settled):
        evidence = compare_viewports(before, frame, calibration, grid)
        top_after = scrollbar_top(frame, calibration)
        moved = top_after is not None and top_after - top_before >= 1.5
        verified = bool(selection_settled and evidence["verified"] and moved)
        report["transition"].update({"status": "verified" if verified else "unverified",
                                    "verified": verified, "overlap": evidence,
                                    "scrollbarAfter": top_after, "scrollbarMovedDown": moved,
                                    "selectionSettled": selection_settled})
        path = output / "position-00.png"
        frame.save(path)
        report["observations"][0].update({"status": "captured", "frame": str(path),
            "frameSha256": hashlib.sha256(path.read_bytes()).hexdigest(),
            "positionMeaning": "expected selected cell in post-transition viewport; not an absolute inventory index"})
        save()

    result_index = RESULT_CELL[1] * grid.columns + RESULT_CELL[0]
    try:
        after = wait_for_panel(grab, calibration, grid, 36, result_index, guard.check, record_after)
    except PanelNotReady as exc:
        if latest[0] is not None:
            persist_after(latest[0], selection_settled=False)
        raise TransitionRejected("post-wheel-selection-or-panel-not-stable; inspect saved motion evidence") from exc
    persist_after(after, selection_settled=True)
    observation = report["observations"][0]
    if not report["transition"]["verified"]:
        raise TransitionRejected("one-row-transition-not-confirmed; inspect overlap and scrollbar evidence")
    guard.check()
    observation.update({"status": "read", "selectionVerified": True,
                        "reading": reader(after, calibration, output / "reading-00"), "humanApproved": False})
    report.update({"status": "transition-read", "processedPositions": 1,
                   "coverageConfirmed": False, "endOfInventory": None})
    save()
