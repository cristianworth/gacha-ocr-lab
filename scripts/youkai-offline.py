"""Qualify an unchanged Youkai checkout using upstream tests and public images."""

import hashlib
import importlib.metadata
import json
import sys
import xml.etree.ElementTree as ET
import zipfile
from datetime import datetime, timezone
from pathlib import Path

SHA = "86a8b34511c86ec864d8f40c558789f7ccad4cc9"


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def verify_source(cache, source):
    checked = 0
    with zipfile.ZipFile(cache / f"youkai-{SHA}.zip") as archive:
        for entry in archive.infolist():
            if entry.is_dir():
                continue
            relative = Path(*Path(entry.filename).parts[1:])
            target = source / relative
            if not target.is_file() or digest(target) != hashlib.sha256(archive.read(entry)).hexdigest():
                raise RuntimeError(f"Upstream file differs from pinned archive: {relative}")
            checked += 1
    return checked


def smoke(source, output):
    import yaml
    from PIL import Image
    from youkai_ocr.capture import calibrate
    from youkai_ocr.recognize import make_recognizer
    from youkai_ocr.wengine_scanner import scan_single_frame_engine

    meta = yaml.safe_load((source / "data/zzz_1.4/navigation.yaml").read_text(encoding="utf-8"))["meta"]
    x, y = meta["screenshot_offset"]
    width, height = meta["reference_resolution"]
    results = []
    for name in ("reference_2_wengine_inventory.png", "reference_6_unequipped_wengine.png"):
        path = source / "reference" / name
        with Image.open(path) as raw:
            if raw.size != (1922, 1112):
                raise ValueError(f"Unexpected public reference geometry: {raw.size}")
            frame = raw.convert("RGB").crop((x, y, x + width, y + height))
        archive = output / path.stem
        item, confidence = scan_single_frame_engine(frame, calibrate(frame), archive_dir=archive)
        # Re-read the archived name/level with the original OCR API for diagnosis.
        # These are separate reads, not a claimed trace of the extraction call.
        recognizer = make_recognizer("tesseract")
        with Image.open(archive / "engine_0000/name.png") as crop:
            raw_name = recognizer.read_text(crop, "white_text_on_dark")
        with Image.open(archive / "engine_0000/level.png") as crop:
            raw_level = recognizer.read_line(crop, "white_text_on_dark")
        results.append({
            "source": str(path), "sourceSha256": digest(path),
            "clientCrop": [x, y, width, height], "clientSize": list(frame.size),
            "originalOutput": item.to_dict() if item else None,
            "upstreamConfidence": confidence,
            "rawRecheck": {"name": raw_name, "level": raw_level},
            "archive": str(archive), "humanApproved": False,
        })
    return results


def report(cache, source, output, checked):
    suite = ET.parse(output / "upstream.xml").getroot().find("testsuite")
    skipped = [{"test": case.attrib["classname"] + "." + case.attrib["name"],
                "reason": case.find("skipped").attrib.get("message", "")}
               for case in suite.findall("testcase") if case.find("skipped") is not None]
    packages = []
    for dist in importlib.metadata.distributions():
        meta = dist.metadata
        license_text = meta.get("License-Expression") or meta.get("License", "")
        packages.append({"name": meta["Name"], "version": dist.version,
                         "declaredLicense": license_text.splitlines()[0][:160] if license_text else "",
                         "licenseClassifiers": [v for v in meta.get_all("Classifier", []) if v.startswith("License ::")]})
    tested = int(suite.attrib["tests"])
    failures = int(suite.attrib["failures"])
    errors = int(suite.attrib["errors"])
    hashes = {}
    for path in sorted(cache.glob("*.zip")) + sorted(cache.glob("*.exe")) + sorted(cache.glob("*.tar.gz")):
        hashes[path.name] = digest(path)
    hashes["eng.traineddata"] = digest(cache / "tesseract/tessdata/eng.traineddata")
    result = {
        "createdAt": datetime.now(timezone.utc).isoformat(), "sourceSha": SHA,
        "unchangedSourceFiles": checked, "python": sys.version,
        "packages": sorted(packages, key=lambda p: p["name"].lower()), "assetSha256": hashes,
        "tests": {"total": tested, "passed": tested - len(skipped) - failures - errors,
                  "failed": failures, "errors": errors, "skipped": skipped},
        "publicReferenceSmoke": smoke(source, output),
        "liveCaptureTested": False, "liveInputTested": False,
        "currentPersonalZzzImagesTested": False, "inventoryAccepted": False,
    }
    (output / "report.json").write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"passed": result["tests"]["passed"], "skipped": len(skipped),
                      "smoke": [r["originalOutput"] for r in result["publicReferenceSmoke"]]}, ensure_ascii=False))


if __name__ == "__main__":
    cache, output = map(lambda value: Path(value).resolve(), sys.argv[1:3])
    source = cache / f"youkai-{SHA}"
    checked = verify_source(cache, source)
    print(f"Unchanged upstream files: {checked}")
    if sys.argv[3] == "report":
        report(cache, source, output, checked)
