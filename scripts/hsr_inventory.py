"""HSR alternating-row traversal with visual delivery and literal level cutoff."""
import hashlib
import html
import json
import time
from pathlib import Path

from hsr_reader import (downward_viewport_shift, grid_column, next_selection, panel_signature, read_header,
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
    for item in sorted(report['observations'], key=lambda item: item['position']):
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
              'Linhas alternam o sentido da leitura; posicoes e tabela seguem a ordem visual da lista.',
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
            delivered = downward_viewport_shift(previous_frame, frame, selection, previous) is not None
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
    row, column = divmod(position,8)
    reverse = row % 2 == 1
    key = 's' if column == (0 if reverse else 7) else 'a' if reverse else 'd'
    previous, previous_frame = selection, frame
    # Keep the exact source frame for auditing partial viewport transitions.
    if key == 's':
        path = output / f'row-{row:04d}-before-down.png'
        save_evidence_image(frame,path)
        report.setdefault('rowTransitions',[]).append({'afterPosition':position,'beforeFrame':str(path),
                                                       'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
        save_session(output,report)
    if key == 'd':
        advance.next()
    else:
        advance.next(key)
    arguments = {'previous': previous}
    if key != 'd':
        arguments.update(direction=key, previous_frame=previous_frame)
    frame, selection = settle(grab, guard, **arguments)
    new_column = grid_column(selection,frame.size)
    expected_column = column + (-1 if reverse else 1)
    if new_column is None or (key != 's' and new_column != expected_column):
        error = ProbeStopped('inventory-column-unconfirmed')
        error.frame = frame
        raise error
    next_position = (row+1)*8+new_column if key == 's' else row*8+new_column
    step = {'afterPosition': position, 'nextPosition':next_position, 'key': key, 'from': previous, 'to': selection, 'verified': True}
    if key == 's' and not next_selection(previous,selection,frame.size,direction='s'):
        step['viewportShift'] = downward_viewport_shift(previous_frame,frame,selection,previous)
    report.setdefault('navigationSteps',[]).append(step)
    save_session(output,report)
    return frame, selection, next_position


def run_inventory(grab, advance, guard, reader, output, report, *, settle=settled_frame):
    """A boundary is complete only with readable levels and monotonic observed order."""
    report.update(phase='acquiring', status='running', scopeComplete=False, coverageConfirmed=False,
                  captureComplete=False, inventoryAccepted=False, observations=[], endOfInventory=None)
    pending = False
    known_levels = {}
    position = 0
    frame, selection = settle(grab, guard)
    save_evidence_image(frame, output / 'before.png')
    report['beforeFrame'] = {'path': str(output/'before.png'), 'sha256': hashlib.sha256((output/'before.png').read_bytes()).hexdigest()}
    report['header'] = header = read_header(frame, reader)
    report['preparedListTotal'] = total = header['quantity']['value']
    if not header['categoryConfirmed'] or not header['sortConfirmed']:
        raise ProbeStopped('prepare-Light-Cone-tab-and-Lv-sort')
    if not (selection[0] < frame.width*.105 and selection[1] < frame.height*.26):
        raise ProbeStopped('select-first-light-cone-at-prepared-top')
    report['scopePreparation'] = {'minLevel': 20, 'rarityFilter': 'all-rarities-manually-prepared-not-verified',
                                  'method': 'manual-user-declaration', 'confirmed': True}
    report['sortPreparation'] = {'key': 'level', 'direction': 'descending', 'confirmed': True,
                                 'method': 'manual-declaration-and-Lv-label-OCR'}
    report['navigationMode'] = 'alternating-rows'
    for acquisition_index in range(report['maxPositions']):
        guard.check()
        item = {'position': position, 'acquisitionIndex':acquisition_index, 'status': 'captured-pending', 'selection': selection,
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
            contradiction = next(((other, value) for other,value in known_levels.items()
                                  if (other < position and value < current) or (other > position and value > current)),None)
            if contradiction is not None:
                report['levelOrderContradiction'] = {'position':position,'level':current,
                                                     'otherPosition':contradiction[0],'otherLevel':contradiction[1]}
                save_session(output, report)
                raise ProbeStopped('level-order-contradiction')
            known_levels[position] = current
        save_session(output, report)
        print(f"Posicao HSR {position+1}: {item['levelEligibility']}; imagem e OCR salvos.", flush=True)
        guard.check()
        # Reverse rows must finish before cutoff: low items at the right edge
        # cannot exclude eligible items still unread on the left.
        row, column = divmod(position,8)
        low = [(index,value) for index,value in known_levels.items() if index//8 == row and value < 20]
        if low and (row % 2 == 0 or column == 0):
            boundary_position, boundary_level = min(low)
            report.update(scopeComplete=not pending, coverageConfirmed=not pending,
                          reason='level-cutoff-reached' if not pending else 'level-cutoff-with-unresolved-levels',
                          status='scope-captured' if not pending else 'inventory-inconclusive',
                          levelBoundary={'position': boundary_position, 'level': boundary_level, 'source': 'selected-panel-OCR'},
                          notReadByLevelOrder=max(0,total-len(report['observations'])) if total is not None else None)
            return
        if total is not None and len(report['observations']) >= total:
            report['reason'] = 'prepared-count-reached-physical-end-unverified'
            return
        if acquisition_index+1 >= report['maxPositions']:
            break
        try:
            frame, selection, position = advance_inventory(grab, advance, guard, settle, frame, selection, position, output, report)
        except ProbeStopped as exc:
            if getattr(exc, 'frame', None) is not None:
                failed_frame = output / 'unconfirmed-advance.png'
                save_evidence_image(exc.frame, failed_frame)
                report['unconfirmedAdvance'] = {'path': str(failed_frame), 'sha256': hashlib.sha256(failed_frame.read_bytes()).hexdigest()}
            raise
    report['reason'] = 'position-safety-limit'
