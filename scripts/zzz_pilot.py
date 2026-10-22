"""Minimal ZZZ W-Engine reader and capture checks for the ten-position pilot."""

import html
import json
import re
import time
from pathlib import Path

import numpy as np

# Coordinates belong to the measured 1920x1080 Youkai layout, scaled by its API.
NAME = (1421, 270, 1655, 333)
NAME_LINE = (1421, 270, 1655, 306)
NAME_WIDE = (1421, 270, 1760, 333)
NAME_SECOND_LINE = (1421, 303, 1760, 333)
LEVEL = (1464, 398, 1637, 440)
RARITY = (1421, 402, 1452, 436)
STARS = (1652, 399, 1810, 440)
LOCK_ACTION = (1630, 1015, 1905, 1058)
PROFILE = "zzz-wengine-1280x720-v2"


class PanelNotReady(RuntimeError):
    pass


def field(value=None, *, state=None, candidates=None, evidence=None):
    return {"value": value, "state": state or ("recognized" if value is not None else "uncertain"),
            "candidates": candidates or [], "evidence": evidence or {}}


def crop(frame, calibration, box):
    return frame.crop(calibration.scale_bbox(box))


def progression(frame, calibration):
    slots = []
    states = []
    for index in range(5):
        center = 1675 + 29 * index
        pixels = np.array(crop(frame, calibration, (center - 9, 409, center + 10, 430)).convert("RGB"))
        light = pixels.min(axis=2)
        p85 = float(np.percentile(light, 85))
        bright = float((light >= 205).mean())
        shape = float((light >= 80).mean())
        if p85 >= 205 and .25 <= bright <= .85:
            state = "filled"
        elif 85 <= p85 <= 165 and .25 <= shape <= .85 and bright < .05:
            state = "empty"
        else:
            state = "unknown"
        states.append(state)
        slots.append({"slot": index + 1, "state": state, "p85": round(p85, 2),
                      "brightFraction": round(bright, 4), "shapeFraction": round(shape, 4)})
    count = states.count("filled")
    valid = 1 <= count <= 5 and states == ["filled"] * count + ["empty"] * (5 - count)
    return field(count if valid else None, evidence={"slots": slots, "bbox": STARS})


def lock_from_action(text):
    match = re.fullmatch(r"\s*T\s+(Unlock|Lock)\s*", text, re.IGNORECASE)
    return field(match.group(1).lower() == "unlock" if match else None,
                 evidence={"raw": text, "meaning": "Unlock action means currently locked"})


def level_from_text(text):
    match = re.fullmatch(r"\s*Lv\.?\s*(\d+)\s*/\s*(\d+)\s*", text, re.IGNORECASE)
    value = None
    if match:
        current, maximum = map(int, match.groups())
        if maximum in (10, 20, 30, 40, 50, 60) and 1 <= current <= maximum:
            value = {"current": current, "max": maximum}
    return field(value, evidence={"raw": text})


def scope_for(rank):
    if rank["state"] != "recognized":
        return "pending-rarity"
    return "included" if rank["value"] in ("S", "A") else "excluded-B" if rank["value"] == "B" else "pending-rarity"


def title_mask(image):
    from PIL import Image
    pixels = np.array(image.convert("RGB"), dtype=int)
    white = (pixels.min(axis=2) >= 205) & (pixels.max(axis=2) - pixels.min(axis=2) <= 25)
    return Image.fromarray((white * 255).astype("uint8"))


def exact_name(text, normalizer, candidate=None):
    key, score = normalizer(text.replace("\n", " ").strip())
    identity = lambda value: re.sub(r"[^a-z0-9]", "", value.lower())
    if candidate and candidate[0] and identity(text) == identity(candidate[0]):
        # Literal agreement with a catalog key is stronger evidence than the
        # case-sensitive fuzzy scorer, which can prefer a different item for WINGS.
        return candidate[0], candidate[1], True
    return key, score, bool(key) and score == 100 and identity(text) == identity(key)


def read_frame(frame, calibration, output, *, recognizer=None):
    from youkai_ocr.matchers import detect_rarity
    from youkai_ocr.normalizer import normalize_engine
    from youkai_ocr.recognize import make_recognizer
    from youkai_ocr.wengine_scanner import scan_single_frame_engine

    output = Path(output)
    output.mkdir(parents=True, exist_ok=True)
    recognizer = recognizer or make_recognizer("tesseract")
    regions = {"name": NAME, "level": LEVEL, "rarity": RARITY,
               "progression": STARS, "lockAction": LOCK_ACTION}
    crops = {name: crop(frame, calibration, box) for name, box in regions.items()}
    for name, image in crops.items():
        image.save(output / f"{name}.png")
    raw_name = recognizer.read_text(crops["name"], "white_text_on_dark")
    raw_level = recognizer.read_line(crops["level"], "white_text_on_dark")
    raw_lock = recognizer.read_line(crops["lockAction"], "white_text_on_dark")
    key, score = normalize_engine(raw_name.replace("\n", " ").strip())
    raw_identity = re.sub(r"[^a-z0-9]", "", raw_name.lower())
    key_identity = re.sub(r"[^a-z0-9]", "", key.lower())
    exact = bool(key) and score == 100 and raw_identity == key_identity
    title_line = None
    full_crop_score = score
    # Single-line titles put type/agent icons on the second visual line.
    # Re-read the isolated title only when its literal first line already agrees
    # with the candidate. Wrapped names continue using the full two-line crop.
    first_line = re.sub(r"[^a-z0-9]", "", raw_name.splitlines()[0].lower()) if raw_name.splitlines() else ""
    if not exact and key and "\n" in raw_name and first_line == key_identity:
        line_crop = crop(frame, calibration, NAME_LINE)
        line_crop.save(output / "name-line.png")
        title_line = recognizer.read_line(line_crop, "white_text_on_dark")
        line_key, line_score = normalize_engine(title_line)
        exact = line_key == key and line_score == 100 and re.sub(r"[^a-z0-9]", "", title_line.lower()) == key_identity
        if exact:
            score = line_score
    extra_attempts = []
    if not exact:
        # Widen only uncertain titles. White glyphs suppress coloured engine art;
        # exact literal agreement is still required after each independent read.
        wide = crop(frame, calibration, NAME_WIDE)
        wide.save(output / "name-wide.png")
        masked = title_mask(wide)
        masked.save(output / "name-wide-mask.png")
        wide_raw = recognizer.read_text(masked, "white_text_on_dark")
        wide_key, wide_score, wide_exact = exact_name(wide_raw, normalize_engine, (key, score))
        extra_attempts.append({"kind": "wide-white-title", "raw": wide_raw, "candidate": wide_key,
                               "score": wide_score, "exact": wide_exact, "bbox": NAME_WIDE})
        if wide_exact:
            key, score, exact = wide_key, wide_score, True
        elif len(raw_name.splitlines()) >= 2:
            # Wrapped titles can overlap art on the right of the first line.
            # Keep that line from the narrow read; expand only the second line.
            second = title_mask(crop(frame, calibration, NAME_SECOND_LINE))
            second.save(output / "name-second-line-mask.png")
            second_raw = recognizer.read_text(second, "white_text_on_dark")
            joined = raw_name.splitlines()[0] + " " + second_raw
            joined_key, joined_score, joined_exact = exact_name(joined, normalize_engine, (key, score))
            extra_attempts.append({"kind": "narrow-first-wide-second", "firstRaw": raw_name.splitlines()[0],
                                   "secondRaw": second_raw, "raw": joined, "candidate": joined_key,
                                   "score": joined_score, "exact": joined_exact, "bbox": NAME_SECOND_LINE})
            if joined_exact:
                key, score, exact = joined_key, joined_score, True
    name = field(key if exact else None,
                 candidates=[{"key": key, "score": score}] if key else [],
                 evidence={"raw": raw_name, "additionalReads": extra_attempts, "isolatedTitleLine": title_line, "fullCropScore": full_crop_score, "normalizerScore": score,
                           "scoreIsCalibratedProbability": False})
    pixels = np.array(crops["rarity"].convert("RGB")).reshape(-1, 3)
    color = np.percentile(pixels, 75, axis=0)
    rank = None
    code = None
    try:
        code = detect_rarity(crops["rarity"])
        # A grey/black patch is not a rank even if the upstream nearest centroid accepts it.
        if color.max() >= 90 and color.max() - color.min() >= 40:
            rank = {4: "S", 3: "A", 2: "B"}[code]
    except ValueError:
        pass
    rarity = field(rank, evidence={"upstreamCode": code, "p75RGB": color.tolist()})
    fields = {"name": name, "level": level_from_text(raw_level), "rarity": rarity,
              "progression": progression(frame, calibration), "lock": lock_from_action(raw_lock)}
    # Comparison uses the original reader, including its known wrong defaults.
    original = None
    scores = {}
    comparison_error = None
    try:
        original, scores = scan_single_frame_engine(frame, calibration, archive_dir=output / "upstream")
    except Exception as exc:
        comparison_error = str(exc)
    return {"profile": PROFILE, "fields": fields, "scope": scope_for(rarity),
            "requiresManualReview": True, "humanApproved": False,
            "originalOutput": original.to_dict() if original else None,
            "upstreamConfidence": scores, "originalComparisonError": comparison_error,
            "evidenceDirectory": str(output.resolve())}


def selected_positions(frame, calibration, grid, limit):
    found = []
    for index in range(limit):
        x, y = grid.cell_center(index % grid.columns, index // grid.columns)
        pixels = np.array(crop(frame, calibration, (x - 63, y - 31, x + 63, y - 23)).convert("RGB"), dtype=float)
        red, green, blue = pixels[:, :, 0], pixels[:, :, 1], pixels[:, :, 2]
        yellow = (red > 130) & (green > 130) & (blue < 100) & (green >= red * .6)
        if float(yellow.mean()) >= .16:
            found.append(index)
    return found


def panel_signature(frame, calibration):
    return [np.array(crop(frame, calibration, box).convert("L"), dtype=float)
            for box in (NAME, (1421, 399, 1810, 440))]


def wait_for_panel(grab, calibration, grid, limit, expected, check, record, *, timeout=4,
                   clock=time.monotonic, sleep=time.sleep):
    """Require selection evidence, visible stars and consecutive stable captures."""
    started = clock()
    stable_since = None
    previous = None
    consecutive = 0
    while clock() - started < timeout:
        check()
        frame = grab()
        check()
        if frame.size != (1280, 720):
            raise PanelNotReady("unexpected-frame-size")
        selected = selected_positions(frame, calibration, grid, limit)
        selected_ok = expected is None or selected == [expected]
        stars = progression(frame, calibration)
        ready = selected_ok and stars["state"] == "recognized"
        signature = panel_signature(frame, calibration)
        difference = max(float(np.abs(a - b).mean()) for a, b in zip(signature, previous)) if previous else None
        if ready and difference is not None and difference <= 2.5:
            stable_since = stable_since if stable_since is not None else clock()
            consecutive += 1
        else:
            stable_since = None
            consecutive = 0
        settled = stable_since is not None and consecutive >= 2 and clock() - stable_since >= .25
        evidence = {"expectedPosition": expected, "selectedPositions": selected,
                    "ready": ready, "difference": difference, "settled": settled}
        record(frame, evidence)
        if settled:
            return frame
        previous = signature
        sleep(.12)
    raise PanelNotReady("selection-or-panel-not-stable-within-4-seconds")


def render_review(path, report):
    summary = ""
    if "stopTest" in report:
        result = "PASSED" if report["stopTest"].get("passed") else "NOT PASSED" if report["status"] == "stopped" else "PENDING"
        summary += f"<p>Stop test: {result}. Full details are in session.json.</p>"
    if "geometryTest" in report:
        result = "PASSED" if report["geometryTest"].get("passed") else "NOT PASSED" if report["status"] == "stopped" else "PENDING"
        summary += f"<p>Geometry test: {result}. Full details are in session.json.</p>"
    if report.get("mode") == "zzz-transition":
        cell = report.get("transition", {}).get("resultViewportCell", {"row": 1, "column": 0})
        summary += f"<p>One viewport transition. Expected selected cell after movement: row {cell['row'] + 1}, column {cell['column'] + 1}. Absolute inventory position and inventory end remain unconfirmed.</p>"
    rows = []
    for observation in report.get("observations", []):
        reading = observation.get("reading", {})
        fields = {key: {"value": value["value"], "state": value["state"]}
                  for key, value in reading.get("fields", {}).items()}
        image = ""
        if observation.get("frame"):
            relative = Path(observation["frame"]).resolve().relative_to(path.parent.resolve()).as_posix()
            image = f'<a href="{html.escape(relative, quote=True)}"><img width="640" src="{html.escape(relative, quote=True)}"></a>'
        rows.append(f'<tr><td>{observation["position"] + 1}</td><td>{html.escape(observation["status"])}</td>'
                    f'<td>{html.escape(reading.get("scope", "pending"))}<pre>{html.escape(json.dumps(fields, ensure_ascii=False, indent=2))}</pre>'
                    f'{html.escape(observation.get("reason", ""))}'
                    f'<details><summary>Raw OCR / original comparison</summary><pre>{html.escape(json.dumps(reading, ensure_ascii=False, indent=2))}</pre></details></td><td>{image}</td></tr>')
    path.write_text('<!doctype html><meta charset="utf-8"><title>ZZZ session review</title>'
                    '<style>body{font:14px sans-serif;background:#202020;color:#eee}td{padding:12px;border:1px solid #666;vertical-align:top}img{max-width:55vw}</style>'
                    f'<h1>{html.escape(report.get("mode", "ZZZ"))} — {html.escape(report["status"])}</h1>{summary}'
                    '<p>Unreviewed diagnostic. A pilot is not a complete or approved inventory. B-rank observations are excluded; uncertain rank remains pending.</p>'
                    '<p><a href="session.json">Full session JSON</a></p><table><tr><th>Position</th><th>Status</th><th>Fields / scope</th><th>Original frame</th></tr>'
                    + ''.join(rows) + '</table>', encoding='utf-8')


def recover_skipped(observations, selected_frames, consume):
    for index, observation in enumerate(observations):
        if observation.get("reason") != "upstream-stuck-panel" or index not in selected_frames:
            continue
        frame, entry = selected_frames[index]
        check = entry.get("panelCheck", {})
        if not check.get("settled") or check.get("selectedPositions") != [index]:
            continue
        observation.update({"upstreamSkip": "stuck-panel", "recoveredUsingSelectionEvidence": True,
                            "recoveryFrame": entry["path"], "recoveryPressCount": entry["pressCount"]})
        try:
            consume(index, frame, observation)
            observation.pop("reason", None)
        except Exception as exc:
            observation.update({"status": "failed", "reason": str(exc)})
            raise
