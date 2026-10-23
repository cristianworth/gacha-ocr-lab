"""ZZZ P3.3: bounded multi-row traversal with one verified wheel per new row."""

import hashlib
import math

from zzz_pilot import PanelNotReady, read_frame, selected_positions, wait_for_panel
from zzz_transition import SCROLL_CELL, TransitionRejected, compare_viewports, grid_patches, scrollbar_top


def scroll_budget(limit, columns=9):
    return max(0, math.ceil(limit / columns) - 3)


def summarize_scan(report):
    observations = report["observations"]
    read = [item for item in observations if item["status"] == "read"]
    report["prefixTraversalComplete"] = len(read) == report["requestedPositions"]
    report["scanSummary"] = {
        "requestedPositions": report["requestedPositions"], "processedPositions": len(read),
        "verifiedTransitions": sum(item.get("verified", False) for item in report.get("transitions", [])),
        "scopeCounts": {scope: sum(item.get("reading", {}).get("scope") == scope for item in read)
                        for scope in ("included", "excluded-B", "pending-rarity")},
        "uncertainFields": [{"position": item["position"], "fields": [name for name, value in item["reading"]["fields"].items()
                            if value["state"] != "recognized"]} for item in read
                            if any(value["state"] != "recognized" for value in item["reading"]["fields"].values())],
        "failedPositions": [item["position"] for item in observations if item["status"] == "failed"],
    }


def run_scan(calibration, grab, mouse, guard, record, report, output, save, grid, *, click=None, reader=None):
    from youkai_ocr.input_utils import natural_click
    click = click or natural_click
    reader = reader or read_frame
    limit = report["requestedPositions"]
    # Keep one full row below the last requested row. Inventory-end handling
    # is a separate contract; a blocked wheel must never imply completion.
    required = max(grid.columns * grid.rows_visible, (math.ceil(limit / grid.columns) + 1) * grid.columns)
    selected_row = report.get("startMode") == "selected-row"
    if not selected_row and report["globalCountCandidate"] < required:
        raise TransitionRejected("prefix-needs-room-below-requested-rows; inventory-end-is-not-implemented")
    report.update({"transitions": [], "coverageConfirmed": False, "endOfInventory": None,
                   "absoluteInventoryPositionConfirmed": False, "prefixTraversalComplete": False})
    latest_entry = [None]
    latest_frame = [None]
    def wait(expected, phase, **context):
        def observe(frame, evidence):
            latest_frame[0] = frame
            latest_entry[0] = record(frame, {"phase": phase, **context, **evidence})
        return wait_for_panel(grab, calibration, grid, grid.columns * grid.rows_visible, expected,
                              guard.check, observe)
    def save_frame(frame, name):
        path = output / name
        frame.save(path)
        return {"frame": str(path), "frameSha256": hashlib.sha256(path.read_bytes()).hexdigest()}

    initial = wait(None, "initial")
    top = scrollbar_top(initial, calibration)
    report["initialScrollbar"] = top
    if selected_row:
        selected = selected_positions(initial, calibration, grid, grid.columns * grid.rows_visible)
        if len(selected) != 1:
            raise TransitionRejected("select-exactly-one-visible-W-Engine-before-running")
        start_row, start_column = divmod(selected[0], grid.columns)
        limit = grid.columns - start_column
        report.update({"requestedPositions": limit, "limit": limit,
                       "rowStart": {"row": start_row, "column": start_column, "lastColumn": grid.columns - 1},
                       "observations": [{"position": i, "logicalRow": None, "row": start_row, "column": column,
                                         "positionMeaning": "ordinal from manually selected card; absolute inventory index unconfirmed",
                                         "status": "not-visited"} for i, column in enumerate(range(start_column, grid.columns))]})
        guard.targets = [calibration.to_screen(*grid.cell_center(column, start_row)) for column in range(start_column + 1, grid.columns)]
        guard.max_presses = limit - 1
        guard.max_scrolls = 0
        guard.scroll_target = None
        report.update({"targets": guard.targets, "pressBudget": guard.max_presses, "scrollBudget": 0,
                       "scrollAllowed": False, "scrollTarget": None})
    else:
        if top is None or top > 250:
            raise TransitionRejected("prepare-viewport-at-top; no automatic rewind")
        if any(float(patch.std()) < 12 for patch in grid_patches(initial, calibration, grid)[-1]):
            raise TransitionRejected("last-visible-row-not-confirmed-full")
    report["initialFrame"] = save_frame(initial, "scan-before.png")
    save()
    offset = 0
    for index, observation in enumerate(report["observations"]):
        logical_row, column = (start_row, start_column + index) if selected_row else divmod(index, grid.columns)
        if not selected_row and logical_row >= 3 and column == 0:
            anchor_column = grid.columns - 1
            before = wait(2 * grid.columns + anchor_column, "before-wheel", nextPosition=index, viewportOffsetRows=offset)
            transition = {"number": len(report["transitions"]) + 1, "beforePosition": index,
                          "fromViewportOffsetRows": offset, "verified": False, "status": "preparing",
                          "scrollbarBefore": scrollbar_top(before, calibration),
                          "before": save_frame(before, f"transition-{len(report['transitions']):02d}-before.png")}
            report["transitions"].append(transition)
            save()
            try:
                mouse.position = calibration.to_screen(*grid.cell_center(*SCROLL_CELL))
                guard.check()
                transition["status"] = "wheel-requested"
                save()
                mouse.scroll(0, -1)
                def persist_motion(after, settled):
                    overlap = compare_viewports(before, after, calibration, grid)
                    thumb = scrollbar_top(after, calibration)
                    moved = thumb is not None and transition["scrollbarBefore"] is not None and thumb - transition["scrollbarBefore"] >= 1.5
                    verified = bool(settled and overlap["verified"] and moved)
                    transition.update({"after": save_frame(after, f"transition-{transition['number'] - 1:02d}-after.png"),
                                       "overlap": overlap, "scrollbarAfter": thumb, "selectionSettled": settled,
                                       "verified": verified, "status": "verified" if verified else "unverified"})
                    save()
                latest_frame[0] = None
                try:
                    after = wait(grid.columns + anchor_column, "after-wheel", nextPosition=index, viewportOffsetRows=offset)
                except PanelNotReady:
                    if latest_frame[0] is not None:
                        persist_motion(latest_frame[0], False)
                    raise
                persist_motion(after, True)
                if not transition["verified"]:
                    raise TransitionRejected("one-row-transition-not-confirmed; no retry and no inventory-end inference")
                offset += 1
                transition["toViewportOffsetRows"] = offset
                save()
            except Exception as exc:
                transition.update({"status": "failed", "reason": str(exc)})
                save()
                raise
        visual_row = logical_row - offset
        if visual_row not in (range(grid.rows_visible) if selected_row else (0, 1, 2)):
            raise TransitionRejected("scan-left-approved-interior-rows")
        observation.update({"row": visual_row, "viewportOffsetRows": offset, "status": "selecting"})
        save()
        try:
            guard.check()
            if selected_row and index == 0:
                frame = initial
                observation["selectionAction"] = "already-selected"
            else:
                click(mouse, *calibration.to_screen(*grid.cell_center(column, visual_row)))
                frame = wait(visual_row * grid.columns + column, "item", position=index, viewportOffsetRows=offset)
                observation["selectionAction"] = "clicked"
            if selected_row:
                overlap = compare_viewports(initial, frame, calibration, grid)["candidates"][0]
                current_thumb = scrollbar_top(frame, calibration)
                same = (overlap["medianError"] <= 12 and overlap["matchingFraction"] >= .70
                        and top is not None and current_thumb is not None and abs(current_thumb - top) < 1.5)
                observation["viewportCheck"] = {"sameViewport": same, "zeroRowOverlap": overlap,
                                                "scrollbarBefore": top, "scrollbarAfter": current_thumb}
                if not same:
                    raise TransitionRejected("viewport-moved-during-selected-row; no further inputs")
            observation.update({"status": "captured", **save_frame(frame, f"position-{index:03d}.png"),
                                "captureEvidence": latest_entry[0]["path"], "selectionVerified": True})
            save()
            guard.check()
            observation["reading"] = reader(frame, calibration, output / f"reading-{index:03d}")
            observation.update({"status": "read", "humanApproved": False})
            summarize_scan(report)
            save()
            print(f"[scan] {index + 1}/{limit} row={logical_row + 1} col={column + 1} scope={observation['reading']['scope']}", flush=True)
        except Exception as exc:
            observation.update({"status": "failed", "reason": str(exc)})
            summarize_scan(report)
            save()
            raise
    report.update({"status": "row-read" if selected_row else "prefix-read",
                   "reason": "selected-row-end-reached" if selected_row else "requested-limit-reached",
                   "finalFrame": save_frame(latest_frame[0], "scan-final.png")})
    summarize_scan(report)
    save()
