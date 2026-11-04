"""HSR prepared-list traversal by D with selection delivery and literal level cutoff."""
import hashlib
import html
import json
import time
from pathlib import Path

from hsr_reader import (downward_viewport_shift, next_selection, panel_signature, read_header,
                        read_panel, selected_card, stable_panels)
from scan_runtime import ProbeStopped, write_manifest
from youkai_capture import save_evidence_image


def summarize(report):
    items = report['observations']
    report['inventorySummary'] = {
        'listTotal': report.get('preparedListTotal'), 'minimumLevel': 20,
        'visitedPositions': len(items), 'readPositions': sum(item.get('status') == 'read' for item in items),
        'eligiblePositions': sum(item.get('levelEligibility') == 'eligible-level' for item in items),
        'pendingLevel': sum(item.get('levelEligibility') == 'pending-level' for item in items),
        'failedPositions': [item['position'] for item in items if item.get('status') == 'failed'],
        'uncertainFields': [{'position': item['position'], 'fields': [name for name, field in item.get('reading', {}).get('fields', {}).items()
                            if field['state'] != 'recognized']} for item in items
                            if any(field['state'] != 'recognized' for field in item.get('reading', {}).get('fields', {}).values())]}


def save_session(output, report):
    summarize(report)
    write_manifest(output / 'session.json', report)
    if report.get('phase') != 'finished':
        return
    lines = ['# HSR — Cones de Luz 20+', '',
             'Coleta do escopo concluida; dados precisam de revisao.' if report.get('scopeComplete') else 'Coleta parcial/inconclusiva; confira o motivo e as pendencias.',
             f"Motivo: {report.get('reason') or 'desconhecido'}.", '',
             f"Observados: {len(report['observations'])}; elegiveis: {report['inventorySummary']['eligiblePositions']}; niveis pendentes: {report['inventorySummary']['pendingLevel']}.",
             '']
    if report.get('levelBoundary'):
        boundary = report['levelBoundary']
        lines += [f"Primeiro nivel abaixo de 20: posicao {boundary['position']+1}, nivel {boundary['level']} (fora do escopo).",
                  'Esse Cone foi selecionado para conferir o nivel e nao entra na tabela de elegiveis.', '']
    lines += ['| Posicao | Nome | Nivel | Sobreposicao |', '|---|---|---|---|']
    rows = []
    for key in ('beforeFrame','unconfirmedFrame','unconfirmedAdvance'):
        if key in report:
            relative = Path(report[key]['path']).relative_to(output).as_posix()
            rows.append(f"<p>{key}</p><img width='640' src='{html.escape(relative,quote=True)}'>")
    for item in report['observations']:
        fields = item.get('reading', {}).get('fields', {})
        level = fields.get('level', {}).get('value')
        if item.get('levelEligibility') != 'excluded-level':
            values = [str(item['position'] + 1), fields.get('name', {}).get('value') or 'PENDENTE',
                      f"{level['current']}/{level['max']}" if level else 'PENDENTE',
                      str(fields.get('superimposition', {}).get('value') or 'PENDENTE')]
            lines.append('| ' + ' | '.join(value.replace('|', '/') for value in values) + ' |')
        if item.get('frame'):
            relative = Path(item['frame']).relative_to(output).as_posix()
            rows.append(f"<article><h2>Posicao {item['position']+1}</h2><pre>{html.escape(json.dumps(item.get('reading'),ensure_ascii=False,indent=2))}</pre><img width='640' src='{html.escape(relative,quote=True)}'></article>")
    lines += ['', 'Corte 20+ com Lv decrescente declarado. Nivel ilegivel nunca autoriza parada.',
              'Contador nao comprova fundo fisico. Igualdade de imagem/nome nao identifica copia.',
              'Raridade e trava ainda nao sao extraidas neste primeiro perfil HSR.',
              'Nada aprovado ou aplicado ao Advisor. [Revisao visual](review.html) · [Bruto](session.json)']
    (output / 'summary.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')
    (output / 'review.html').write_text("<!doctype html><meta charset='utf-8'><title>HSR — revisao</title><style>body{font:16px sans-serif;margin:24px}article{border-top:1px solid #888}pre{white-space:pre-wrap}img{max-width:100%}</style><h1>HSR — evidencia original</h1><p>Dados sem aprovacao humana. Cada posicao pertence somente a esta sessao.</p>" + ''.join(rows), encoding='utf-8')


def settled_frame(grab, guard, *, previous=None, direction='d', previous_frame=None,
                  clock=time.monotonic, sleep=time.sleep, timeout=3):
    deadline = clock() + timeout
    anchor = last = None
    stable_since = None
    last_frame = None
    selection = None
    delivered = False
    while clock() < deadline:
        guard.check()
        frame = grab()
        guard.check()
        last_frame = frame
        selection = selected_card(frame)
        delivered = selection is not None and (previous is None or next_selection(previous, selection, frame.size, direction=direction))
        if not delivered and direction == 's' and previous is not None and selection is not None:
            same_outline = all(abs(a-b) <= 2 for a,b in zip(previous,selection))
            delivered = same_outline and downward_viewport_shift(previous_frame, frame, selection) is not None
        signature = panel_signature(frame)
        if not delivered or anchor is None or not stable_panels(anchor, signature) or selection != last:
            anchor, last, stable_since = signature, selection, clock() if delivered else None
        elif stable_since is not None and clock()-stable_since >= .30:
            return frame, selection
        sleep(.06)
    reason = ('selection-not-unique' if selection is None else
              'selection-advance-unconfirmed' if not delivered else 'panel-stability-unconfirmed')
    error = ProbeStopped(reason)
    error.frame = last_frame
    error.wait_evidence = {'previousSelection': previous, 'lastSelection': selection, 'direction': direction,
                           'deliveryConfirmed': delivered,
                           'stableWindowSeconds': .30, 'timeoutSeconds': timeout}
    raise error


def advance_inventory(grab, advance, guard, settle, frame, selection, position, output, report):
    # D stops at the right edge. Return over the already-read row before S so
    # a shorter final row still starts at its first item, preserving level order.
    keys = ('a',)*7 + ('s',) if (position+1) % 8 == 0 else ('d',)
    if len(keys) > 1:
        print(f'Trocando de linha apos a posicao HSR {position+1}: A ate a primeira coluna, depois S.', flush=True)
    for key in keys:
        previous, previous_frame = selection, frame
        if key == 'd':
            advance.next()
        else:
            advance.next(key)
        arguments = {'previous': previous}
        if key != 'd':
            arguments.update(direction=key, previous_frame=previous_frame)
        frame, selection = settle(grab, guard, **arguments)
        step = {'afterPosition': position, 'key': key, 'from': previous, 'to': selection, 'verified': True}
        if key == 's' and not next_selection(previous,selection,frame.size,direction='s'):
            step['viewportShift'] = downward_viewport_shift(previous_frame,frame,selection)
        report.setdefault('navigationSteps',[]).append(step)
        save_session(output,report)
    return frame, selection


def run_inventory(grab, advance, guard, reader, output, report, *, settle=settled_frame):
    """A boundary is complete only with readable levels and monotonic observed order."""
    report.update(phase='acquiring', status='running', scopeComplete=False, coverageConfirmed=False,
                  captureComplete=False, inventoryAccepted=False, observations=[], endOfInventory=None)
    pending = False
    last_level = None
    frame, selection = settle(grab, guard)
    save_evidence_image(frame, output / 'before.png')
    report['beforeFrame'] = {'path': str(output/'before.png'), 'sha256': hashlib.sha256((output/'before.png').read_bytes()).hexdigest()}
    report['header'] = header = read_header(frame, reader)
    report['preparedListTotal'] = total = header['quantity']['value']
    if not header['categoryConfirmed'] or not header['sortConfirmed']:
        raise ProbeStopped('prepare-Light-Cone-tab-and-Lv-sort')
    if not (selection[0] < frame.width*.105 and selection[1] < frame.height*.26):
        raise ProbeStopped('select-first-light-cone-at-prepared-top')
    report['scopePreparation'] = {'minLevel': 20, 'rarityFilter': 'optional-manual-not-verified',
                                  'method': 'manual-user-declaration', 'confirmed': True}
    report['sortPreparation'] = {'key': 'level', 'direction': 'descending', 'confirmed': True,
                                 'method': 'manual-declaration-and-Lv-label-OCR'}
    for position in range(report['maxPositions']):
        guard.check()
        item = {'position': position, 'status': 'captured-pending', 'selection': selection,
                'selectionVerified': True, 'humanApproved': False, 'levelEligibility': 'pending-level'}
        report['observations'].append(item)
        file = output / f'position-{position:04d}.png'
        save_evidence_image(frame, file)
        item.update(frame=str(file), frameSha256=hashlib.sha256(file.read_bytes()).hexdigest())
        save_session(output, report)
        evidence = output / f'reading-{position:04d}'
        evidence.mkdir()
        item['reading'] = reading = read_panel(frame, reader, evidence=evidence)
        item['status'] = 'read'
        if not reading['layoutVerified']:
            save_session(output, report)
            raise ProbeStopped('light-cone-panel-anchor-unconfirmed')
        level = reading['fields']['level']['value']
        if level is None:
            pending = True
        else:
            current = level['current']
            item['levelEligibility'] = 'eligible-level' if current >= 20 else 'excluded-level'
            if last_level is not None and current > last_level:
                report['levelOrderContradiction'] = {'previous': last_level, 'current': current, 'position': position}
                save_session(output, report)
                raise ProbeStopped('level-order-contradiction')
            last_level = current
        save_session(output, report)
        print(f"Posicao HSR {position+1}: {item['levelEligibility']}; imagem e OCR salvos.", flush=True)
        guard.check()
        if level is not None and level['current'] < 20:
            report.update(scopeComplete=not pending, coverageConfirmed=not pending,
                          reason='level-cutoff-reached' if not pending else 'level-cutoff-with-unresolved-levels',
                          status='scope-captured' if not pending else 'inventory-inconclusive',
                          levelBoundary={'position': position, 'level': level['current'], 'source': 'selected-panel-OCR'},
                          notReadByLevelOrder=max(0,total-position-1) if total is not None else None)
            return
        if total is not None and position+1 >= total:
            report['reason'] = 'prepared-count-reached-physical-end-unverified'
            return
        if position+1 >= report['maxPositions']:
            break
        try:
            frame, selection = advance_inventory(grab, advance, guard, settle, frame, selection, position, output, report)
        except ProbeStopped as exc:
            if getattr(exc, 'frame', None) is not None:
                failed_frame = output / 'unconfirmed-advance.png'
                save_evidence_image(exc.frame, failed_frame)
                report['unconfirmedAdvance'] = {'path': str(failed_frame), 'sha256': hashlib.sha256(failed_frame.read_bytes()).hexdigest()}
            raise
    report['reason'] = 'position-safety-limit'
