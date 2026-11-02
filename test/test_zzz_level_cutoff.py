"""Level-scoped completion and useful summaries; all inputs are simulated."""
import copy
import hashlib
import json
import sys
from pathlib import Path
from unittest.mock import Mock

import pytest
from PIL import Image

from test_zzz_inventory import inventory_desktop, run_fixture, view
from youkai_ocr.grid import DEFAULT_GRID
from zzz_inventory import AlignedInventoryObserver, run_inventory, write_inventory_summary


def level_fixture(tmp_path, levels, *, grid_levels=None, prepared=True, strategy='level-cutoff'):
    args, kwargs, report, state, guard = run_fixture(tmp_path, [view(0, len(levels), first=True, last=True)])
    report.update(minLevel=20, preparedListTotal=len(levels), inventoryStrategy=strategy,
                  sortPreparation={'key': 'level', 'direction': 'descending', 'confirmed': prepared})
    grid_levels = levels if grid_levels is None else grid_levels
    def probe(*args):
        value = grid_levels[report['observations'][-1]['position']]
        return {'state': 'recognized' if value is not None else 'uncertain', 'value': value, 'raw': [str(value)] * 2}
    def reader(*args):
        current = levels[report['observations'][-1]['position']]
        return {'scope': 'included', 'fields': {
            'name': {'state': 'recognized', 'value': 'SameCopy'},
            'level': {'state': 'recognized' if current is not None else 'uncertain',
                      'value': {'current': current, 'max': 60} if current is not None else None},
            'rarity': {'state': 'recognized', 'value': 'A'},
            'progression': {'state': 'recognized', 'value': 1},
            'lock': {'state': 'recognized', 'value': True}}}
    kwargs.update(level_probe=Mock(side_effect=probe), reader=Mock(side_effect=reader))
    return args, kwargs, report, state, guard


def test_cutoff_includes_twenty_and_preserves_unvisited_separately(tmp_path):
    args, kwargs, report, state, guard = level_fixture(tmp_path, [21, 20, 19, 0])
    run_inventory(*args, **kwargs)
    assert [o['position'] for o in report['observations']] == [0, 1, 2]
    assert len(state['clicks']) == kwargs['reader'].call_count == 2
    assert kwargs['level_probe'].call_count == 3
    assert report['scopeComplete'] is report['coverageConfirmed'] is True
    assert report['captureComplete'] is report['inventoryAccepted'] is False
    assert report['reason'] == 'level-cutoff-reached'
    assert report['inventorySummary']['excludedByLevel'] == 1
    assert report['inventorySummary']['notReadByLevelOrder'] == 1
    assert report['inventorySummary']['eligiblePositions'] == 2
    assert [item['reading']['fields']['name']['value'] for item in report['observations'][:2]] == ['SameCopy', 'SameCopy']
    summary = (tmp_path / 'summary.md').read_text(encoding='utf-8')
    assert summary.count('SameCopy') == 2
    assert 'Restantes não lidos por ordenação: 1.' in summary
    assert 'Todas as posições processadas: não.' in summary
    assert 'Nada foi aplicado ao Advisor.' in summary


def test_first_item_below_cutoff_can_finish_without_any_click(tmp_path):
    args, kwargs, report, state, guard = level_fixture(tmp_path, [19, 0, 0])
    run_inventory(*args, **kwargs)
    assert report['processedPositions'] == 1 and report['notReadByLevelOrder'] == 2
    assert report['scopeComplete'] is True and report['captureComplete'] is False
    assert state['clicks'] == [] and state['wheels'] == 0
    kwargs['reader'].assert_not_called()


@pytest.mark.parametrize('levels', [[], [21, 20]])
def test_short_path_without_a_low_item_finishes_at_physical_end(tmp_path, levels):
    args, kwargs, report, state, guard = level_fixture(tmp_path, levels)
    run_inventory(*args, **kwargs)
    assert report['captureComplete'] is report['scopeComplete'] is report['coverageConfirmed'] is True
    assert report['notReadByLevelOrder'] == 0 and report.get('levelBoundary') is None
    assert report['endOfInventory'] is True
    assert len(state['clicks']) == len(levels)


@pytest.mark.parametrize('grid_value,detail_value,complete,clicks', [(None, 21, True, 1), (None, None, False, 1), (21, 20, False, 1)])
def test_unreadable_or_conflicting_level_cannot_claim_complete_scope(tmp_path, grid_value, detail_value, complete, clicks):
    args, kwargs, report, state, guard = level_fixture(tmp_path, [detail_value, 19, 0], grid_levels=[grid_value, 19, 0])
    run_inventory(*args, **kwargs)
    assert len(state['clicks']) == clicks
    assert report['scopeComplete'] is report['coverageConfirmed'] is complete
    assert report['inventorySummary']['pendingLevel'] == int(not complete)
    assert report['processedPositions'] == 2 and report['notReadByLevelOrder'] == 1
    if not complete:
        assert 'Elegibilidade ou leitura pendente' in (tmp_path / 'summary.md').read_text(encoding='utf-8')


def test_unreadable_grid_can_reach_boundary_after_verified_panel_read(tmp_path):
    args, kwargs, report, state, guard = level_fixture(tmp_path, [21, 19, 0], grid_levels=[21, None, 0])
    run_inventory(*args, **kwargs)
    assert report['scopeComplete'] is True and len(state['clicks']) == 2
    assert report['levelBoundary'] == {'position': 1, 'level': 19, 'source': 'detail-level-after-detailed-OCR'}
    assert report['notReadByLevelOrder'] == 1


def test_order_contradiction_stops_without_excluding_unread_tail(tmp_path):
    args, kwargs, report, state, guard = level_fixture(tmp_path, [20, 21, 19])
    run_inventory(*args, **kwargs)
    assert report['reason'] == 'level-order-contradiction'
    assert report['scopeComplete'] is report['coverageConfirmed'] is False
    assert report['levelOrder']['observedContradiction'] is True
    assert report['notReadByLevelOrder'] == 0
    assert len(state['clicks']) == 2 and kwargs['level_probe'].call_count == 2


@pytest.mark.parametrize('preparation', [None, {'confirmed': True, 'key': 'rarity', 'direction': 'descending'},
                                       {'confirmed': True, 'key': 'level', 'direction': 'ascending'}])
def test_order_must_be_declared_before_acquisition(tmp_path, preparation):
    args, kwargs, report, state, guard = level_fixture(tmp_path, [19, 0], prepared=False)
    report['sortPreparation'] = preparation or {}
    kwargs['viewport_wait'] = Mock(side_effect=AssertionError('must reject before capture'))
    run_inventory(*args, **kwargs)
    assert report['reason'] == 'level-order-preparation-unconfirmed'
    assert report['observations'] == [] and not state['clicks']
    assert report['scopeComplete'] is False


def test_full_list_diagnostic_keeps_scanning_beyond_low_levels(tmp_path):
    args, kwargs, report, state, guard = level_fixture(tmp_path, [21, 19, 0], strategy='full-list', prepared=False)
    run_inventory(*args, **kwargs)
    assert report['processedPositions'] == 3 and report['captureComplete'] is True
    assert report['reason'] == 'inventory-end-confirmed'
    assert report.get('levelBoundary') is None and report['notReadByLevelOrder'] == 0


def test_uncertain_names_are_visible_without_blocking_level_completion(tmp_path):
    args, kwargs, report, state, guard = level_fixture(tmp_path, [21, 19, 0])
    reader = kwargs['reader']
    def uncertain(*args):
        reading = reader(*args)
        reading['fields']['name'] = {'state': 'uncertain', 'value': None, 'candidates': [{'key': 'DoNotPromote'}]}
        return reading
    kwargs['reader'] = uncertain
    run_inventory(*args, **kwargs)
    assert report['scopeComplete'] is True
    summary = (tmp_path / 'summary.md').read_text(encoding='utf-8')
    assert 'PENDENTE' in summary and 'Campos para conferir' in summary
    assert 'DoNotPromote' not in summary


def test_guard_still_runs_after_detail_ocr_before_early_completion(tmp_path):
    from youkai_selection import ProbeStopped
    args, kwargs, report, state, guard = level_fixture(tmp_path, [19, 0], grid_levels=[None, 0])
    reader = kwargs['reader']
    def lose_focus(*args):
        result = reader(*args)
        guard.check_window = Mock(side_effect=ProbeStopped('game-focus-lost'))
        return result
    kwargs['reader'] = lose_focus
    with pytest.raises(ProbeStopped, match='game-focus-lost'):
        run_inventory(*args, **kwargs)
    assert report['scopeComplete'] is report['coverageConfirmed'] is False
    assert report.get('levelBoundary') is None
    assert report['observations'][0]['status'] == 'failed'
    assert len(state['clicks']) == 1


@pytest.mark.parametrize('flags', [['--pilot', '--scan', '--inventory', '--run'],
                                  ['--pilot', '--scan', '--inventory', '--min-level', '40'],
                                  ['--full-inventory'], ['--level-descending-prepared'],
                                  ['--pilot', '--scan', '--inventory', '--run', '--collect-references', '--full-inventory']])
def test_short_cli_rejects_missing_preparation_or_other_cut_before_output(tmp_path, monkeypatch, flags):
    import youkai_selection
    output = tmp_path / 'not-created'
    monkeypatch.setattr(sys, 'argv', ['youkai_selection.py', str(tmp_path), str(output), *flags])
    with pytest.raises(SystemExit):
        youkai_selection.main()
    assert not output.exists()


def test_short_cli_confirms_empty_list_without_panel_and_writes_summary(tmp_path, monkeypatch, inventory_desktop):
    selection, inventory, controller, event, panel = inventory_desktop
    monkeypatch.setattr(inventory, 'AlignedInventoryObserver', lambda *args: lambda *args: view(0, 0, first=True, last=True))
    repo = Path(__file__).resolve().parents[1]
    monkeypatch.setattr(sys, 'argv', ['youkai_selection.py', str(repo / '.cache/youkai-p1'), str(tmp_path),
                                    '--pilot', '--scan', '--inventory', '--run', '--sa-filter-prepared', '--level-descending-prepared'])
    assert selection.main() == 0
    report = json.loads((tmp_path / 'session.json').read_text())
    assert report['inventoryStrategy'] == 'level-cutoff' and report['scopeComplete'] is True
    assert report['sortPreparation']['confirmed'] is True
    assert report['captureComplete'] is True and report['inventoryAccepted'] is False
    assert 'Nenhum elegível identificado.' in (tmp_path / 'summary.md').read_text(encoding='utf-8')
    panel.assert_not_called()
    controller.press.assert_not_called()


def test_saved_full_session_replays_short_path_with_same_eligible_fields(tmp_path):
    root = Path(__file__).resolve().parents[1] / '.cache/youkai-p1/runs/20261028-185740-399e71f1-selection'
    manifest = root / 'session.json'
    if not manifest.exists():
        pytest.skip('personal complete session is not in Git')
    source_sha = hashlib.sha256(manifest.read_bytes()).hexdigest()
    assert source_sha == '049a883cbd399e21d6bbea70592c1d010d626dff7eea22feaa91e5bea261333c'
    source = json.loads(manifest.read_text())
    def load(item):
        path = Path(item['frame'])
        assert hashlib.sha256(path.read_bytes()).hexdigest() == item['frameSha256']
        with Image.open(path) as image:
            return image.convert('RGB')
    views = [load(item) for item in source['inventoryViews'][:2]]
    args, kwargs, report, state, guard = run_fixture(tmp_path, [])
    report.update(minLevel=20, preparedListTotal=118, inventoryStrategy='level-cutoff',
                  sortPreparation={'key': 'level', 'direction': 'descending', 'confirmed': True,
                                   'method': 'simulated-declaration-for-replay'},
                  executionMode='saved-session-replay', liveInputTested=False,
                  replaySourceManifest=str(manifest), replaySourceSha256=source_sha)
    report['schemaVersion'] = 1
    observer = AlignedInventoryObserver(118)
    args = list(args)
    args[1] = lambda: views[state['view']]
    kwargs.update(observe=observer,
                  level_probe=lambda *args: copy.deepcopy(source['observations'][report['observations'][-1]['position']]['gridLevel']),
                  panel_wait=lambda *args: load(source['observations'][report['observations'][-1]['position']]),
                  reader=lambda *args: copy.deepcopy(source['observations'][report['observations'][-1]['position']]['reading']))
    run_inventory(*args, **kwargs)
    assert report['scopeComplete'] is report['coverageConfirmed'] is True
    assert report['captureComplete'] is report['inventoryAccepted'] is False
    assert report['endOfInventory'] is None and report['notReadByLevelOrder'] == 83
    assert report['processedPositions'] == 35 and len(state['clicks']) == 34 and state['wheels'] == 1
    assert report['levelBoundary']['position'] == 34
    assert len(report['inventoryViews']) == 2 and report['transitions'][0]['verified'] is True
    assert report['inventorySummary']['eligiblePositions'] == 34
    assert [o['reading']['fields'] for o in report['observations'][:34]] == [o['reading']['fields'] for o in source['observations'][:34]]
    assert report['inventorySummary']['uncertainFields'] == source['inventorySummary']['uncertainFields']
    assert hashlib.sha256(manifest.read_bytes()).hexdigest() == source_sha
    from youkai_selection import save_report
    report.update(simulatedPressRequests=len(state['clicks']), simulatedScrollRequests=state['wheels'])
    save_report(tmp_path / 'session.json', report)
    summary = (tmp_path / 'summary.md').read_text(encoding='utf-8')
    assert 'Replay de arquivos salvos' in summary
    assert 'Restantes não lidos por ordenação: 83.' in summary
    assert 'Posição 14: nome.' in summary and 'Posição 25: nome.' in summary and 'Posição 34: nome.' in summary
