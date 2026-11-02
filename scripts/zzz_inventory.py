"""ZZZ aligned inventory observation, guarded traversal and level-scoped acquisition."""

from dataclasses import asdict, dataclass
import hashlib
import math
import re

import numpy as np

from youkai_ocr.grid import DEFAULT_GRID
from zzz_pilot import crop, read_frame, wait_for_panel
from zzz_transition import (SCROLL_CELL, compare_viewports, grid_patches, scrollbar_evidence,
                            scrollbar_top, selection_stillness, wait_for_viewport)


@dataclass(frozen=True)
class VisibleCard:
    # Ordinals identify positions in the prepared list, never item content.
    ordinal: int
    center: tuple[float, float]
    safe_to_select: bool = True


@dataclass(frozen=True)
class InventoryView:
    # None means unknown occupancy; () is an explicitly confirmed empty list.
    cards: tuple[VisibleCard, ...] | None = None
    at_start: bool | None = None
    at_end: bool | None = None
    mapping_verified: bool = False
    advanced_pixels: float | None = None
    evidence: dict | None = None
    scrollbar_state: str = "unknown"


REFERENCE_STAGES = (
    ("unfiltered-top", "Retire os filtros de raridade. Role para cima ate aparecer a primeira linha. A lista deve parar. Nao precisa clicar em item. Solte F9 e nao mexa ate o proximo aviso."),
    ("filter-options", "Abra o botao de filtro no canto inferior esquerdo. Marque S e A e desmarque B. Deixe as opcoes abertas e paradas; nao clique em item. Solte F9 e aguarde."),
    ("prepared-top", "Feche o filtro e role para cima ate a primeira linha. Solte o controle e espere a lista parar. Nao clique em item. Solte F9 e aguarde."),
    ("before-final-wheel", "Role para baixo ate aparecerem os espacos EMPTY no fim. Solte o controle, espere voltar ao alinhamento normal e suba UM passo da rodinha. Espere parar; nao clique em item. Solte F9 e aguarde."),
    ("after-final-wheel", "Desca UM passo da rodinha dentro da lista. Solte o controle e espere a lista parar no alinhamento normal. Nao clique em item. Solte F9 e aguarde."),
    ("bottom-no-progress", "Desca mais UM passo da rodinha. Solte completamente o controle e espere a lista voltar e parar. Nao clique em item. Solte F9 e aguarde."),
    ("last-card", "Clique no ultimo item ocupado antes dos espacos EMPTY. Solte o mouse e espere a lista e o painel pararem. Nao role. Solte F9 e aguarde o aviso de termino."),
)


def uncalibrated_view(frame, calibration, grid):
    """Keep measured candidates without promoting texture or a static wheel to facts."""
    return InventoryView(evidence={
        "source": "unqualified-live-candidates", "occupancy": "unknown", "termination": "unknown",
        "scrollbarTopCandidate": scrollbar_top(frame, calibration),
        "thumbnailTextureStd": [[round(float(patch.std()), 3) for patch in row]
                                for row in grid_patches(frame, calibration, grid)],
        "missing": ["filter-and-count-semantics", "occupied-empty-cell-reference", "tail-geometry-and-end"],
    })



# Calibrated on guided-tail-2e081b07, aligned stages 3/4/5/7, 2026-10-24.
# Stage 6 is a held-control counterexample and must remain rejected.
CALIBRATION = "zzz-aligned-grid-20261024-v1"
MINIMUM_LEVEL = 20


def parse_storage_count(raw):
    text = " ".join(raw)
    match = re.search(r"W[- ]?Engine\s+Storage\s*\[\s*(\d+)\s*/\s*(\d+)", text, re.I)
    if not match:
        return None
    count, capacity = map(int, match.groups())
    return count if 0 <= count <= capacity == 2000 else None


def classify_grid(frame, calibration, grid):
    cells = []
    for row in range(grid.rows_visible):
        for column in range(grid.columns):
            x, y = grid.cell_center(column, row)
            band = np.asarray(crop(frame, calibration, (x-55, y+78, x+55, y+85)), dtype=float)
            colored = float(((band.max(axis=2) - band.min(axis=2)) > 40).mean())
            art = np.asarray(crop(frame, calibration, (x-50, y-10, x+50, y+83)), dtype=float)
            gray = art.mean(axis=2)
            chroma = float((art.max(axis=2) - art.min(axis=2)).mean())
            h, w = gray.shape
            yy, xx = np.mgrid[-1:1:complex(h), -1:1:complex(w)]
            interior = (abs(xx) < .85) & (abs(yy) < .85)
            diagonals = abs(abs(xx) - abs(yy)) < .18
            cross_contrast = float(gray[interior & diagonals].mean() - gray[interior & ~diagonals].mean())
            # EMPTY has a gray X with no rarity band. Texture alone never proves an empty cell.
            empty = cross_contrast >= 9 and chroma <= 2 and colored < .01
            occupied = colored >= .4 and chroma >= 8 and float(gray.std()) >= 25
            cells.append({"state": "empty" if empty else "occupied" if occupied else "unknown",
                          "row": row, "column": column, "rarityBandFraction": round(colored, 4),
                          "artChroma": round(chroma, 3), "emptyCrossContrast": round(cross_contrast, 3)})
    return cells


class AlignedInventoryObserver:
    """Use counted positions plus verified one-row overlap; no inference from a stalled wheel."""
    def __init__(self, total, read_count=None):
        self.total = total
        self.read_count = read_count
        self.previous_frame = None
        self.offset = 0

    def __call__(self, frame, calibration, grid):
        cells = classify_grid(frame, calibration, grid)
        states = [cell["state"] for cell in cells]
        bar = scrollbar_evidence(frame, calibration)
        evidence = {"source": CALIBRATION, "cells": cells, "scrollbar": bar, "listTotal": self.total}
        def unknown(reason):
            evidence["issue"] = reason
            return InventoryView(evidence=evidence, scrollbar_state=bar["state"])
        if self.total is None:
            return unknown("prepared-list-count-unconfirmed")
        if self.read_count:
            current = self.read_count(frame)
            evidence["currentListCount"] = current
            if current != self.total:
                return unknown("prepared-list-count-changed-or-unreadable")
        if "unknown" in states:
            return unknown("cell-occupancy-or-alignment-unconfirmed")
        occupied = states.count("occupied")
        if states != ["occupied"] * occupied + ["empty"] * (len(states) - occupied):
            return unknown("non-contiguous-occupancy")
        fitting = self.total <= len(states)
        if fitting and occupied == self.total and bar["state"] == "unreadable":
            # Absence is established by the complete counted list and explicit EMPTY cells,
            # plus a dark scrollbar strip; a missing thumb by itself remains unreadable.
            bar = scrollbar_evidence(frame, calibration, confirmed_absent=True)
            evidence["scrollbar"] = bar
        if self.previous_frame is None:
            top = bar["state"] == "present" and abs(bar["top"] - 238.5) <= 1.5
            if not top and not (fitting and bar["state"] == "absent"):
                return unknown("inventory-start-unconfirmed")
            advance = None
        else:
            overlap = compare_viewports(self.previous_frame, frame, calibration, grid)
            old_bar = scrollbar_evidence(self.previous_frame, calibration)
            evidence["overlap"] = overlap
            if not (overlap["verified"] and old_bar["state"] == bar["state"] == "present"
                    and bar["top"] - old_bar["top"] >= 1.5):
                return unknown("one-row-motion-unconfirmed")
            self.offset += grid.columns
            advance = grid.row_pitch
        remaining = self.total - self.offset
        expected = min(len(states), remaining)
        if remaining < 0 or occupied != expected:
            return unknown("header-occupancy-conflict")
        # Normal released bottom measured at reference Y=864 in aligned stages 5/7.
        bottom = bar["state"] == "present" and abs(bar["bottom"] - 864) <= 3
        if fitting and bar["state"] == "present" and not bottom:
            return unknown("short-list-scrollbar-conflict")
        terminal = fitting or (remaining <= len(states) and bottom)
        if not fitting and ((remaining <= len(states) and not bottom) or (remaining > len(states) and bottom)):
            return unknown("header-scrollbar-end-conflict")
        cards = tuple(VisibleCard(self.offset + index, grid.cell_center(index % grid.columns, index // grid.columns),
                                  terminal or index < grid.columns * (grid.rows_visible - 1))
                      for index in range(occupied))
        self.previous_frame = frame
        return InventoryView(cards, self.offset == 0, terminal, True, advance, evidence, bar["state"])


def read_grid_level(frame, calibration, center, recognizer):
    x, y = center
    box = (x-54, y+99, x+54, y+128)
    label = crop(frame, calibration, box)
    raw = [recognizer.read_line(label, profile) for profile in ("white_text_on_dark", "white_text_on_dark_dim")]
    values = []
    for text in raw:
        match = re.fullmatch(r"\s*Lv[.]?\s*(\d{1,2})\s*", text, re.I)
        values.append(int(match.group(1)) if match and 0 <= int(match.group(1)) <= 60 else None)
    agreed = values[0] is not None and values[0] == values[1]
    return {"state": "recognized" if agreed else "uncertain", "value": values[0] if agreed else None,
            "raw": raw, "box": list(box), "method": "agreement of two literal Lv readings"}


def level_decision(probe, minimum):
    value = probe.get("value") if probe and probe.get("state") == "recognized" else None
    return "pending-level" if value is None else "excluded-level" if value < minimum else "eligible-level"


def summarize_inventory(report):
    read = [item for item in report["observations"] if item["status"] == "read"]
    report["processedPositions"] = sum(item["status"] in ("read", "excluded-level") for item in report["observations"])
    report["inventorySummary"] = {
        "listTotal": report.get("preparedListTotal"), "minimumLevel": report.get("minLevel", 0),
        "visitedPositions": len(report["observations"]), "readPositions": len(read),
        "excludedByLevel": sum(item.get("levelEligibility") == "excluded-level" for item in report["observations"]),
        "eligiblePositions": sum(item['status'] == 'read' and item.get("levelEligibility") == "eligible-level" and item.get("reading", {}).get("scope") == "included"
                                 for item in report["observations"]),
        "pendingLevel": sum(item.get("levelEligibility") == "pending-level" for item in report["observations"]),
        "pendingSelection": sum(item["status"] == "pending-selection" for item in report["observations"]),
        "scopeCounts": {scope: sum(item["reading"]["scope"] == scope for item in read)
                        for scope in ("included", "excluded-B", "pending-rarity")},
        "uncertainFields": [{"position": item["position"], "fields": [name for name, value in item["reading"]["fields"].items()
                             if value["state"] != "recognized"]} for item in read
                            if any(value["state"] != "recognized" for value in item["reading"]["fields"].values())],
        "failedPositions": [item["position"] for item in report["observations"] if item["status"] == "failed"],
        "captureComplete": report.get("captureComplete", False),
        "scopeComplete": report.get("scopeComplete", False),
        "notReadByLevelOrder": report.get("notReadByLevelOrder", 0),
        "coverageConfirmed": report.get("coverageConfirmed", False),
        "endOfInventory": report.get("endOfInventory"), "reason": report.get("reason"),
    }


def write_inventory_summary(path, report):
    """Present useful observations without turning OCR candidates into accepted facts."""
    summarize_inventory(report)
    summary = report["inventorySummary"]
    def text(value):
        return str(value).replace('|', '\\|').replace('\n', ' ').replace('\r', ' ')
    def field(item, name):
        entry = item.get('reading', {}).get('fields', {}).get(name, {})
        if entry.get('state') != 'recognized' or entry.get('value') is None:
            return 'PENDENTE'
        value = entry['value']
        if name == 'level':
            current, maximum = value.get('current'), value.get('max')
            if current is None:
                return 'PENDENTE'
            return text(current) + ('/' + text(maximum) if maximum is not None else '')
        return ('Sim' if value else 'Não') if name == 'lock' else text(value)
    complete = report.get('scopeComplete', False) and report.get('coverageConfirmed', False)
    lines = ['# ZZZ — W-Engines S/A 20+', '',
             'Coleta do escopo concluída; dados aguardam revisão.' if complete else 'Coleta parcial ou preparação não confirmada; confira as pendências.', '',
             f"- Total da lista preparada: {summary['listTotal'] if summary['listTotal'] is not None else 'não confirmado'}.",
             f"- Posições observadas: {summary['visitedPositions']}; leituras detalhadas: {summary['readPositions']}.",
             f"- Elegíveis identificados: {summary['eligiblePositions']}; exclusões por nível observadas: {summary['excludedByLevel']}.",
             f"- Restantes não lidos por ordenação: {summary['notReadByLevelOrder'] if summary['notReadByLevelOrder'] is not None else 'quantidade não confirmada'}.",
             f"- Níveis pendentes: {summary['pendingLevel']}; seleções pendentes: {summary['pendingSelection']}.",
             f"- Todas as posições processadas: {'sim' if report.get('captureComplete') else 'não'}.", '']
    if report.get('executionMode') == 'saved-session-replay':
        lines[2:2] = ['**Replay de arquivos salvos; nenhuma coleta ou entrada real no jogo foi executada.**', '']
    if report.get('levelBoundary'):
        boundary = report['levelBoundary']
        lines += [f"Encerramento na posição {boundary['position'] + 1}: nível {boundary['level']} abaixo de 20, com Level decrescente declarado na preparação.", '']
    elif report.get('reason'):
        lines += [f"Motivo registrado: {text(report['reason'])}.", '']
    def table(items):
        rows = ['| Posição | Nome | Nível | Raridade | Progressão | Travado |',
                '|---|---|---|---|---|---|']
        rows += ['| ' + ' | '.join([str(item['position'] + 1)] +
                 [field(item, name) for name in ('name', 'level', 'rarity', 'progression', 'lock')]) + ' |' for item in items]
        return rows
    eligible = [item for item in report['observations'] if item.get('levelEligibility') == 'eligible-level'
                and item.get('reading', {}).get('scope') == 'included' and item['status'] == 'read']
    lines += ['## Elegíveis', ''] + (table(eligible) if eligible else ['Nenhum elegível identificado.']) + ['']
    pending = [item for item in report['observations'] if item.get('levelEligibility') == 'pending-level'
               or item.get('reading', {}).get('scope') == 'pending-rarity'
               or item['status'] in ('failed', 'pending-selection')]
    if pending:
        lines += ['## Elegibilidade ou leitura pendente', ''] + table(pending) + ['']
    uncertain = [item for item in eligible if any(value.get('state') != 'recognized'
                 for value in item['reading']['fields'].values())]
    if uncertain:
        lines += ['## Campos para conferir', '']
        for item in uncertain:
            labels = {'name': 'nome', 'level': 'nível', 'rarity': 'raridade', 'progression': 'progressão', 'lock': 'trava'}
            names = ', '.join(labels.get(name, name) for name, value in item['reading']['fields'].items() if value.get('state') != 'recognized')
            lines.append(f"- Posição {item['position'] + 1}: {names}. Consulte a imagem e o texto bruto no relatório visual.")
        lines += ['']
    lines += ['[Relatório visual e imagens](review.html) · [Sessão original](session.json)', '',
              'Dados não aprovados automaticamente. Nomes pendentes não foram substituídos por candidatos.',
              'Ausência nesta coleta filtrada não remove dados existentes do Advisor. Nada foi aplicado ao Advisor.', '']
    path.write_text('\n'.join(lines), encoding='utf-8')


def save_image(frame, output, name):
    path = output / name
    frame.save(path)
    return {"frame": str(path), "frameSha256": hashlib.sha256(path.read_bytes()).hexdigest()}


def validate_view(view, previous, next_position, grid=DEFAULT_GRID):
    if view.cards is None:
        return (view.evidence or {}).get("issue", "occupancy-unconfirmed")
    if not view.mapping_verified:
        return "position-mapping-unconfirmed"
    ids = [card.ordinal for card in view.cards]
    if len(ids) > 36 or len({tuple(card.center) for card in view.cards}) != len(ids):
        return "invalid-visible-card-map"
    if any(type(index) is not int or index < 0 for index in ids):
        return "invalid-position-map"
    if ids and ids != list(range(ids[0], ids[-1] + 1)):
        return "non-contiguous-position-map"
    left, top, right, bottom = grid.grid_bbox
    for card in view.cards:
        # Keep the existing selection contour inside the public measured grid.
        if (len(card.center) != 2 or any(not math.isfinite(value) for value in card.center)
                or not left + 64 <= card.center[0] <= right - 63
                or not top + 31 <= card.center[1] <= bottom - 65):
            return "card-center-outside-inventory"
    if list(view.cards) != sorted(view.cards, key=lambda card: (card.center[1], card.center[0])):
        return "position-order-conflicts-with-geometry"
    if previous is None:
        if view.at_start is not True or (ids and ids[0] != 0):
            return "inventory-start-unconfirmed"
    else:
        old = {card.ordinal for card in previous.cards}
        if not old.intersection(ids):
            return "viewport-overlap-unconfirmed"
        if ids and ids[0] > next_position:
            return "position-gap"
        if view.advanced_pixels is None or view.advanced_pixels < 0:
            return "viewport-motion-unconfirmed"
        old_centers = {card.ordinal: card.center for card in previous.cards}
        for card in view.cards:
            if card.ordinal in old_centers:
                x, y = old_centers[card.ordinal]
                if (not math.isclose(x, card.center[0], abs_tol=1e-6)
                        or not math.isclose(y - card.center[1], view.advanced_pixels, abs_tol=1e-6)):
                    return "position-map-motion-conflict"
        if view.at_end is not True and view.advanced_pixels == 0:
            return "wheel-without-confirmed-progress"
    if not ids and view.at_end is not True:
        return "empty-list-end-unconfirmed"
    return None


class MappedGrid:
    """Adapt measured card centers to the existing public selection/panel reader."""
    columns = 9

    def __init__(self, cards):
        self.cards = cards

    def cell_center(self, column, row):
        return self.cards[row * self.columns + column].center


def run_inventory(calibration, grab, mouse, guard, record, report, output, save, grid, *,
                  observe=None, click=None, reader=None, viewport_wait=None, panel_wait=None, level_probe=None):
    from youkai_ocr.input_utils import natural_click
    observe = observe or uncalibrated_view
    click, reader = click or natural_click, reader or read_frame
    viewport_wait, panel_wait = viewport_wait or wait_for_viewport, panel_wait or wait_for_panel
    stop_by_level = report.get("inventoryStrategy") == "level-cutoff"
    report.update({"observations": [], "inventoryViews": [], "transitions": [],
                   "captureComplete": False, "coverageConfirmed": False, "inventoryAccepted": False,
                   "scopeComplete": False, "notReadByLevelOrder": 0,
                   "endOfInventory": None, "absoluteInventoryPositionConfirmed": False})
    report.pop('levelBoundary', None)
    if stop_by_level:
        report["levelOrder"] = {"lastKnownLevel": None, "observedContradiction": False}
    previous = None
    next_position = 0
    def finish(reason, *, complete=False, scope_complete=False):
        scope_complete = complete or scope_complete
        if stop_by_level:
            scope_complete = scope_complete and not any(
                item.get('levelEligibility') == 'pending-level'
                or item.get('reading', {}).get('scope') == 'pending-rarity'
                or item['status'] in ('failed', 'pending-selection') for item in report['observations'])
        report.update({"reason": reason, "captureComplete": complete, "scopeComplete": scope_complete,
                       "coverageConfirmed": scope_complete and report.get("scopePreparation", {}).get("confirmed") is True})
        report["status"] = ("inventory-captured" if complete else "scope-captured") if report["coverageConfirmed"] else "inventory-inconclusive"
        summarize_inventory(report)
        report["summaryFile"] = str(output / "summary.md")
        write_inventory_summary(output / "summary.md", report)
        save()
        print("Coleta do escopo finalizada; resultado salvo para revisao." if report['coverageConfirmed'] else "Coleta parada; resultado parcial salvo para revisao.", flush=True)

    def check_level_order(observation):
        if not stop_by_level or observation['levelEligibility'] == 'pending-level':
            return True
        level = observation.get('reading', {}).get('fields', {}).get('level', {})
        value = level['value']['current'] if level.get('state') == 'recognized' else observation['gridLevel']['value']
        last = report['levelOrder']['lastKnownLevel']
        if last is not None and value > last:
            report['levelOrder'].update({'observedContradiction': True, 'position': observation['position'],
                                         'previousLevel': last, 'currentLevel': value})
            finish('level-order-contradiction')
            return False
        report['levelOrder']['lastKnownLevel'] = value
        return True

    def reached_cutoff(observation, view):
        if not stop_by_level or observation['levelEligibility'] != 'excluded-level':
            return False
        guard.check()
        value = (observation.get('reading', {}).get('fields', {}).get('level', {}).get('value') or {}).get('current')
        if value is None:
            value = observation['gridLevel']['value']
        report['levelBoundary'] = {'position': observation['position'], 'level': value,
                                   'source': observation['exclusionSource']}
        total = report.get('preparedListTotal')
        report['notReadByLevelOrder'] = max(0, total - next_position) if total is not None else None
        physical_complete = view.at_end is True and next_position == view.cards[-1].ordinal + 1
        finish('level-cutoff-reached', complete=physical_complete, scope_complete=True)
        return True

    if stop_by_level:
        preparation = report.get('sortPreparation', {})
        if preparation.get('confirmed') is not True or preparation.get('key') != 'level' or preparation.get('direction') != 'descending':
            finish('level-order-preparation-unconfirmed')
            return
        if report.get('minLevel') != MINIMUM_LEVEL:
            finish('unsupported-minimum-level')
            return

    while True:
        frame = viewport_wait(grab, calibration, guard.check, record)
        view = observe(frame, calibration, grid)
        evidence = {**asdict(view), **save_image(frame, output, f"inventory-view-{len(report['inventoryViews']):03d}.png")}
        report["inventoryViews"].append(evidence)
        issue = validate_view(view, previous, next_position, grid)
        if previous is not None:
            report["transitions"][-1].update({"after": evidence, "verified": issue is None,
                                               "status": "verified" if issue is None else "unverified",
                                               "reason": issue, "advancedPixels": view.advanced_pixels})
        save()
        if issue:
            finish(issue)
            return
        if view.at_end is True:
            report["endOfInventory"] = True
        report["absoluteInventoryPositionConfirmed"] = True
        mapped_grid = MappedGrid(view.cards)
        for visual_index, card in enumerate(view.cards):
            if card.ordinal < next_position:
                continue
            if card.ordinal != next_position:
                finish("position-gap")
                return
            if not card.safe_to_select:
                break
            if next_position >= report["maxPositions"]:
                finish("position-safety-limit")
                return
            observation = {"position": card.ordinal, "logicalRow": card.ordinal // grid.columns,
                           "column": card.ordinal % grid.columns, "center": list(card.center),
                           "view": len(report["inventoryViews"]) - 1, "status": "selecting",
                           "positionMeaning": "ordinal established by start and verified viewport mapping"}
            report["observations"].append(observation)
            save()
            try:
                guard.check()
                minimum = report.get("minLevel", 0)
                probe = level_probe(frame, calibration, card.center) if level_probe and minimum else None
                guard.check()
                observation["gridLevel"] = probe
                observation["levelEligibility"] = level_decision(probe, minimum) if minimum else "eligible-level"
                if observation["levelEligibility"] == "excluded-level":
                    observation.update({"status": "excluded-level", "humanApproved": False,
                                        "frame": evidence["frame"], "frameSha256": evidence["frameSha256"],
                                        "selectionVerified": False, "exclusionSource": "grid-level-before-detailed-OCR"})
                    next_position += 1
                    summarize_inventory(report)
                    save()
                    print(f"Posicao {next_position}/{report.get('preparedListTotal') or '?'}: excluida pelo nivel ({probe['value']} < {minimum}).", flush=True)
                    if not check_level_order(observation) or reached_cutoff(observation, view):
                        return
                    continue
                guard.targets = [calibration.to_screen(*card.center)]
                report["targets"] = guard.targets
                guard.check()
                click(mouse, *guard.targets[0])
                selected = panel_wait(grab, calibration, mapped_grid, len(view.cards), visual_index, guard.check, record)
                observation.update({"status": "captured", "selectionVerified": True,
                                    **save_image(selected, output, f"position-{card.ordinal:04d}.png")})
                stillness = selection_stillness(frame, selected, calibration, grid,
                                               confirmed_absent=view.scrollbar_state == "absent")
                observation["viewportCheck"] = stillness
                if stillness["sameViewport"] is False:
                    raise RuntimeError("viewport-moved-during-selection")
                if stillness["sameViewport"] is None:
                    observation.update({"status": "pending-selection", "reason": "selection-stillness-unconfirmed"})
                    finish("selection-stillness-unconfirmed")
                    return
                save()
                guard.check()
                observation["reading"] = reader(selected, calibration, output / f"reading-{card.ordinal:04d}")
                guard.check()
                if minimum:
                    level = observation["reading"]["fields"].get("level", {})
                    current = level.get("value", {}).get("current") if isinstance(level.get("value"), dict) else None
                    if observation["levelEligibility"] == "pending-level":
                        observation["levelEligibility"] = level_decision({"state": level.get("state"), "value": current}, minimum)
                        observation["levelDecisionSource"] = "detail-panel" if current is not None else "pending"
                    elif level.get("state") == "recognized" and current != probe["value"]:
                        observation.update({"levelEligibility": "pending-level", "levelDecisionSource": "grid-detail-conflict"})
                if observation["levelEligibility"] == "excluded-level":
                    observation["exclusionSource"] = "detail-level-after-detailed-OCR"
                observation.update({"status": "read", "humanApproved": False})
                next_position += 1
                summarize_inventory(report)
                save()
                print(f"Posicao {next_position}/{report.get('preparedListTotal') or '?'}: painel lido; {report['inventorySummary']['eligiblePositions']} elegiveis e {report['inventorySummary']['pendingLevel']} niveis pendentes.", flush=True)
                if not check_level_order(observation) or reached_cutoff(observation, view):
                    return
            except Exception as exc:
                observation.update({"status": "failed", "reason": str(exc)})
                summarize_inventory(report)
                save()
                raise
        guard.check()
        if view.at_end is True:
            if view.cards and next_position != view.cards[-1].ordinal + 1:
                finish("final-position-not-selectable")
            else:
                finish("inventory-end-confirmed" if report.get("scopePreparation", {}).get("confirmed") is True
                       else "scope-preparation-unconfirmed", complete=True)
            return
        if next_position >= report["maxPositions"]:
            finish("position-safety-limit")
            return
        if len(report["transitions"]) >= report["maxScrolls"]:
            finish("scroll-safety-limit")
            return
        transition = {"before": evidence, "verified": False, "status": "preparing"}
        report["transitions"].append(transition)
        save()
        try:
            guard.check()
            mouse.position = calibration.to_screen(*grid.cell_center(*SCROLL_CELL))
            transition["status"] = "wheel-requested"
            save()
            mouse.scroll(0, -1)
        except Exception as exc:
            transition.update({"status": "failed", "reason": str(exc)})
            save()
            raise
        previous = view


def collect_inventory_references(calibration, grab, guard, record, report, output, save, grid, await_stage, *,
                                 viewport_wait=None, read_header=None, on_prepared=None):
    """One manual preparation session; all automatic mouse inputs remain disabled."""
    viewport_wait = viewport_wait or wait_for_viewport
    report["referencePlan"] = [{"stage": name, "instruction": instruction, "status": "pending"}
                               for name, instruction in REFERENCE_STAGES]
    report["references"] = []
    save()
    for stage in report["referencePlan"]:
        stage["status"] = "waiting"
        save()
        await_stage(stage["stage"], stage["instruction"])
        while True:
            try:
                frame = viewport_wait(grab, calibration, guard.check,
                                      lambda image, evidence: record(image, {"phase": stage["stage"], **evidence}))
                break
            except RuntimeError as exc:
                if str(exc) not in ("game-focus-lost", "viewport-not-stable-within-4-seconds"):
                    raise
                report.setdefault("captureAttempts", []).append({"stage": stage["stage"], "reason": str(exc)})
                save()
                print("A imagem nao foi confirmada. Volte ao jogo, solte o controle, espere parar e solte F9 novamente nesta etapa.", flush=True)
                await_stage(stage["stage"], stage["instruction"])
        reference = {"stage": stage["stage"], "humanClaim": "requested preparation, not independently confirmed",
                     **save_image(frame, output, f"reference-{stage['stage']}.png"),
                     "viewCandidates": asdict(uncalibrated_view(frame, calibration, grid))}
        report["references"].append(reference)
        stage["status"] = "captured"
        # Record header OCR independently per checkpoint; it is never a traversal count.
        try:
            reference["header"] = read_header(frame) if read_header else None
        except Exception as exc:
            reference["header"] = {"meaning": "unconfirmed", "error": str(exc)}
        save()
        if stage["stage"] == "prepared-top" and on_prepared is not None:
            on_prepared()
    report.update({"referenceCollectionComplete": True, "status": "references-collected",
                   "reason": "grouped-references-complete"})
    save()
