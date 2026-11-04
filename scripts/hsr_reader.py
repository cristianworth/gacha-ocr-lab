"""Literal HSR Light Cone fields and selection evidence, without live inputs.

16:9 regions/advance reference: kel-z/HSR-Scanner (GPL-3.0), revision
cad008e2509b6b086fd892b140c8b277424fcb03, config/screenshot.py.
No upstream parser/defaults, catalog matching or UI dependencies are imported.
"""
import re

import cv2
import numpy as np
from PIL import Image, ImageOps

REFERENCE = {'project': 'kel-z/HSR-Scanner', 'revision': 'cad008e2509b6b086fd892b140c8b277424fcb03',
             'license': 'GPL-3.0', 'files': ['src/config/screenshot.py', 'src/config/light_cone_scan.py',
                                         'src/services/scanner/scanner.py']}
PANEL = (.72, .09, .97, .87)
REGIONS = {'name': (0, 0, 1, .09), 'level': (.13, .32, .35, .37),
           'superimposition': (.53, .495, .60, .55), 'path': (.10, .37, 1, .455)}
LEGACY_REGIONS = {'name': (5/345, 3/670, 340/345, 29/670),
                  'level': (5/345, 183/670, 135/345, 213/670),
                  'superimposition': (32/345, 294/670, 262/345, 324/670),
                  'path': (32/345, 215/670, 332/345, 291/670)}


def crop_relative(image, box):
    width, height = image.size
    return image.crop(tuple(round(value * (width if index % 2 == 0 else height))
                            for index, value in enumerate(box)))


def parse_field(field, raw, *, legacy=False):
    text = ' '.join(raw.split()).strip()
    if field == 'name':
        return text if (2 <= len(text) <= 120 and re.search('[A-Za-z]', text)
                        and re.fullmatch(r"[A-Za-z0-9 '\".,!?:\-]+", text)) else None
    if field == 'path':
        suffix = r' [A-Za-z]+\.?' if legacy else ''
        return text if re.fullmatch(r'The following effects only work on characters of the Path of' + suffix, text, re.I) else None
    if field == 'level':
        match = re.fullmatch(r'(?:Lv[.]?\s*)?(\d{1,2})\s*/\s*(\d{1,2})', text, re.I)
        if match:
            current, maximum = map(int, match.groups())
            if 1 <= current <= maximum and maximum in (20, 30, 40, 50, 60, 70, 80):
                return {'current': current, 'max': maximum}
        return None
    pattern = r'Superimposition\s+([1-5])' if legacy else r'([1-5])'
    match = re.fullmatch(pattern, text, re.I)
    return int(match[1]) if match else None


def prepared_text(image, threshold, *, neutral_only=False):
    if neutral_only:
        pixels = np.array(image.convert('RGB'))
        # Gold Path text can share the second line with the fixed white sentence.
        # Remove its color before scaling, retaining antialiased neutral glyphs.
        pixels[(pixels.max(axis=2).astype(int) - pixels.min(axis=2)) > 40] = 0
        image = Image.fromarray(pixels)
    gray = image.convert('L').resize((image.width * 4, image.height * 4), Image.Resampling.LANCZOS)
    return ImageOps.invert(gray.point(lambda value: 255 if value >= threshold else 0))


def read_panel(frame, recognizer, *, legacy_panel=None, evidence=None):
    panel = frame.crop(legacy_panel) if legacy_panel else crop_relative(frame, PANEL)
    regions = LEGACY_REGIONS if legacy_panel else REGIONS
    reads = {}
    for field, box in regions.items():
        image = crop_relative(panel, box)
        if evidence is not None:
            image.save(evidence / f'{field}.png')
        raw = []
        # The fixed white sentence verifies the panel without reading the gold
        # Path name. Higher thresholds suppress the translucent moving background.
        thresholds = (170, 180) if field == 'path' and not legacy_panel else (130, 140)
        for threshold in thresholds:
            prepared = prepared_text(image, threshold, neutral_only=field == 'path' and not legacy_panel)
            method = recognizer.read_text if field in ('name', 'path') else recognizer.read_line
            if field == 'superimposition' and not legacy_panel and hasattr(recognizer, 'read_word'):
                # A tight single-glyph crop can make Tesseract invent punctuation.
                prepared = ImageOps.expand(prepared, border=4, fill=255)
                method = recognizer.read_word
            raw.append(method(prepared, 'raw'))
        values = [parse_field(field, text, legacy=bool(legacy_panel)) for text in raw]
        agreed = values[0] is not None and values[0] == values[1]
        reads[field] = {'state': 'recognized' if agreed else 'uncertain', 'value': values[0] if agreed else None,
                        'raw': raw, 'candidates': [value for value in values if value is not None],
                        'method': 'agreement-of-two-fixed-thresholds', 'humanApproved': False}
    verified = reads['path']['state'] == 'recognized'
    if not verified:
        for field in ('name', 'level', 'superimposition'):
            reads[field]['value'] = None
            reads[field]['state'] = 'uncertain'
    return {'profile': 'hsr-light-cone-legacy-panel-v1' if legacy_panel else 'hsr-light-cone-16x9-v1',
            'layoutVerified': verified, 'fields': {field: reads[field] for field in ('name','level','superimposition')},
            'pathAnchor': reads['path'], 'requiresManualReview': True, 'humanApproved': False}


def read_header(frame, recognizer):
    areas = {'category': (.02, .04, .25, .13), 'quantity': (.7883, .0324, .9283, .0924),
             'sort': (.114, .90, .204, .933)}
    result = {}
    for field, box in areas.items():
        image = crop_relative(frame, box)
        method = recognizer.read_text if field == 'category' else recognizer.read_line
        raw = [method(prepared_text(image, threshold), 'raw') for threshold in (130, 140)]
        result[field] = {'raw': raw}
        if field == 'quantity':
            values = [re.fullmatch(r'(?:Quantity\s*:?\s*)?(\d{1,4})\s*/\s*(\d{1,4})', text.strip(), re.I) for text in raw]
            numbers = [int(match[1]) if match and 0 <= int(match[1]) <= int(match[2]) <= 9999 else None for match in values]
            result[field]['value'] = numbers[0] if numbers[0] is not None and numbers[0] == numbers[1] else None
    result['categoryConfirmed'] = all('lightcone' in re.sub('[^a-z]', '', text.lower()) for text in result['category']['raw'])
    result['sortConfirmed'] = all(re.fullmatch(r'Lv[.]?', text.strip(), re.I) for text in result['sort']['raw'])
    return result


def selected_card(frame):
    """A unique white rectangular selection; equal item art never proves delivery."""
    pixels = np.array(frame.convert('RGB'))
    white = (pixels.min(axis=2) >= 180) & ((pixels.max(axis=2).astype(int)-pixels.min(axis=2)) <= 40)
    height, width = white.shape
    # On the 1280x720 client the first card starts near y=90, above 15%.
    # Retain its full outline while keeping the inventory header outside the search.
    white[:round(.11*height)] = False
    white[round(.87*height):] = False
    white[:, :round(.025*width)] = False
    white[:, round(.70*width):] = False
    mask = cv2.morphologyEx(white.astype('uint8')*255, cv2.MORPH_CLOSE, np.ones((3,3), 'uint8'))
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    candidates = []
    for contour in contours:
        x, y, w, h = cv2.boundingRect(contour)
        if not (.035*width <= w <= .10*width and .08*height <= h <= .22*height and .5 <= w/h <= 1.1):
            continue
        edge = mask[y:y+h, x:x+w] > 0
        fractions = [edge[:3,:].mean(),edge[-3:,:].mean(),edge[:,:3].mean(),edge[:,-3:].mean()]
        if min(fractions) >= .45:
            candidates.append([x,y,w,h])
    return candidates[0] if len(candidates) == 1 else None


def next_selection(previous, current, size, *, direction='d'):
    if previous is None or current is None:
        return False
    x, y, width, height = previous
    nx, ny, nw, nh = current
    if abs(nw-width) > width*.15 or abs(nh-height) > height*.15:
        return False
    same_row = abs(ny-y) <= height*.12
    if direction == 'd':
        return width*.8 <= nx-x <= width*1.6 and same_row
    if direction == 'a':
        return width*.8 <= x-nx <= width*1.6 and same_row
    if direction == 's':
        return abs(nx-x) <= width*.12 and height*.8 <= ny-y <= height*1.5
    return False


def downward_viewport_shift(before, after, selection):
    """Prove a one-row upward grid shift when S keeps the outline in place.

    Equal card art or a changed detail panel alone never proves this movement.
    Ambiguous/repeated grid patterns fail closed.
    """
    if before is None or before.size != after.size:
        return None
    width, height = after.size
    box = (round(width*.15), round(height*.15), round(width*.65), round(height*.78))
    old = np.array(before.crop(box).convert('L'), dtype=np.int16)
    new = np.array(after.crop(box).convert('L'), dtype=np.int16)
    unchanged = float(np.abs(old-new).mean())
    if unchanged < 5:
        return None
    scores = [(float(np.abs(old[offset:]-new[:-offset]).mean()), offset)
              for offset in range(round(selection[3]*.95), round(selection[3]*1.2)+1)]
    score, offset = min(scores)
    if score <= 3 and unchanged-score >= 5:
        return {'upwardPixels': offset, 'meanDifference': score, 'unshiftedMeanDifference': unchanged}
    return None


def panel_signature(frame):
    panel = crop_relative(frame, PANEL)
    return [np.array(crop_relative(panel, REGIONS[field]).convert('L'), dtype=np.int16)
            for field in ('name','level','superimposition')]


def stable_panels(first, second):
    return all(a.shape == b.shape and float(np.abs(a-b).mean()) <= 1.5 for a,b in zip(first,second))
