"""Assemble a new ZZZ folder/ZIP from the qualified local assets; never copy runs."""
import hashlib
import importlib.metadata
import importlib.util
import json
import os
import shutil
import subprocess
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[1]
SHA = '86a8b34511c86ec864d8f40c558789f7ccad4cc9'
ARCHIVE_SHA256 = '399fd104152b1b7867af103c09580f62d4314d4c77f45cfa995461f26992b50f'
READER_FILES = ('youkai_selection.py', 'youkai_capture.py', 'youkai-offline.py',
                'zzz_pilot.py', 'zzz_transition.py', 'zzz_scan.py', 'zzz_inventory.py', 'zzz_ocr.py', 'zzz_evidence.py',
                'scan_runtime.py', 'hsr_scan.py', 'hsr_inventory.py', 'hsr_reader.py')


def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def extract_pinned_source(archive, destination):
    if digest(archive) != ARCHIVE_SHA256:
        raise ValueError('Pinned Youkai archive SHA256 differs; preserve it for inspection.')
    with zipfile.ZipFile(archive) as source:
        for entry in source.infolist():
            relative = Path(*Path(entry.filename).parts[1:])
            target = (destination / relative).resolve()
            if not target.is_relative_to(destination.resolve()):
                raise ValueError('Archive entry leaves source folder.')
            if entry.is_dir():
                target.mkdir(parents=True, exist_ok=True)
            else:
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(source.read(entry))


def copy_licenses(destination):
    destination.mkdir(parents=True)
    shutil.copy2(Path(sys.base_prefix) / 'LICENSE.txt', destination / 'Python-LICENSE.txt')
    distributions = []
    for dist in importlib.metadata.distributions():
        name = dist.metadata['Name']
        if not name or any(d['name'].lower() == name.lower() for d in distributions):
            continue
        distributions.append({'name': name, 'version': dist.version})
        for item in dist.files or ():
            if any(token in item.name.lower() for token in ('license', 'copying', 'notice')) or 'licenses' in item.parts:
                origin = Path(dist.locate_file(item))
                if not origin.is_file():
                    continue
                target = destination / name / Path(*[part for part in item.parts if part not in ('..', '.')])
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(origin, target)
    return sorted(distributions, key=lambda item: item['name'].lower())


def main():
    if os.name != 'nt':
        raise RuntimeError('Build on Windows x64 with the qualified Python environment.')
    if importlib.metadata.version('pyinstaller') != '6.22.3':
        raise RuntimeError('Use the pinned build tools.')
    cache = ROOT / '.cache/youkai-p1'
    source = cache / f'youkai-{SHA}'
    spec = importlib.util.spec_from_file_location('youkai_offline', ROOT / 'scripts/youkai-offline.py')
    offline = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(offline)
    checked = offline.verify_source(cache, source)
    build_id = datetime.now().strftime('%Y%m%d-%H%M%S') + '-' + uuid4().hex[:8]
    stage = ROOT / '.cache/zzz-portable' / build_id
    output = stage / 'gacha-ocr-zzz'
    output.mkdir(parents=True)
    print(f'Build preservado em: {stage}', flush=True)
    command = [sys.executable, '-m', 'PyInstaller', str(ROOT / 'packaging/zzz-worker.spec'),
               '--distpath', str(output / 'runtime'), '--workpath', str(stage / 'work'),
               '--log-level', 'WARN']
    print('Empacotando runtime e modulos (log em build.log)...', flush=True)
    with (stage / 'build.log').open('w', encoding='utf-8') as log:
        subprocess.run(command, cwd=ROOT, stdout=log, stderr=subprocess.STDOUT, check=True)
    (output / 'scripts').mkdir()
    for name in (*READER_FILES, 'start-zzz.ps1', 'scan-zzz.ps1', 'probe-youkai.ps1',
                 'start-desktop.ps1', 'run-desktop-zzz.ps1', 'scan-hsr.ps1'):
        shutil.copy2(ROOT / 'scripts' / name, output / 'scripts' / name)
    shutil.copy2(ROOT / 'scan-zzz.cmd', output / 'scan-zzz.cmd')
    shutil.copy2(ROOT / 'scan-desktop.cmd', output / 'scan-desktop.cmd')
    subprocess.run([str(Path(os.environ['WINDIR']) / 'System32/WindowsPowerShell/v1.0/powershell.exe'),
                    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File',
                    str(ROOT / 'scripts/build-desktop-launcher.ps1'), '-OutputPath',
                    str(output / 'gacha-ocr.exe')], check=True)
    shutil.copy2(ROOT / 'packaging/README-portable.md', output / 'README.md')
    package_cache = output / '.cache/youkai-p1'
    package_cache.mkdir(parents=True)
    archive = cache / f'youkai-{SHA}.zip'
    shutil.copy2(archive, package_cache / archive.name)
    extract_pinned_source(archive, package_cache / f'youkai-{SHA}')
    print('Incluindo OCR, fontes fixadas e avisos; nenhuma sessao pessoal...', flush=True)
    ocr = package_cache / 'tesseract'
    (ocr / 'tessdata').mkdir(parents=True)
    for path in (cache / 'tesseract').glob('*.dll'):
        shutil.copy2(path, ocr / path.name)
    shutil.copy2(cache / 'tesseract/tesseract.exe', ocr / 'tesseract.exe')
    shutil.copy2(cache / 'tesseract/tessdata/eng.traineddata', ocr / 'tessdata/eng.traineddata')
    shutil.copytree(cache / 'tesseract/doc', ocr / 'doc')
    versions = copy_licenses(output / 'THIRD-PARTY')
    shutil.copy2(source / 'LICENSE', output / 'THIRD-PARTY/Youkai-LICENSE')
    shutil.copy2(ROOT / 'packaging/THIRD-PARTY.md', output / 'THIRD-PARTY/README.md')
    hsr_license = ROOT / '.cache/hsr-reference/cad008e2509b6b086fd892b140c8b277424fcb03/LICENSE'
    if digest(hsr_license) != '3972dc9744f6499f0f9b2dbf76696f2ae7ad8af9b23dde66d6af86c9dfb36986':
        raise ValueError('HSR reference license differs; preserve the cache for inspection.')
    shutil.copy2(hsr_license, output / 'THIRD-PARTY/HSR-Scanner-LICENSE')
    metadata = {
        'schemaVersion': 1, 'version': json.loads((ROOT / 'package.json').read_text(encoding='utf-8'))['version'],
        'builtAt': datetime.now(timezone.utc).isoformat(), 'sourceSha': SHA,
        'sourceFilesChecked': checked, 'python': sys.version, 'buildId': build_id,
        'runtimeDistributionsAndBuildTools': versions,
        'readerSourceSha256': {name: digest(ROOT / 'scripts' / name) for name in READER_FILES},
        'filesSha256': {str(path.relative_to(output)).replace('\\', '/'): digest(path)
                        for path in sorted(output.rglob('*')) if path.is_file()},
        'liveInputTested': False, 'inventoryAccepted': False,
    }
    (output / 'portable-build.json').write_text(json.dumps(metadata, indent=2) + '\n', encoding='utf-8')
    print('Conferindo runtime/OCR sem captura ou inputs...', flush=True)
    env = dict(os.environ, PATH=str(Path(os.environ['WINDIR']) / 'System32'),
               PYTHONPATH='', PYTHONHOME='', PYTHONNOUSERSITE='1')
    with (stage / 'self-check.log').open('w', encoding='utf-8') as log:
        subprocess.run([str(output / 'runtime/zzz-worker/zzz-worker.exe'), '--self-check', str(package_cache)],
                       cwd=stage, env=env, stdout=log, stderr=subprocess.STDOUT, check=True)
    print('Compactando pasta portatil...', flush=True)
    zipped = Path(shutil.make_archive(str(stage / 'gacha-ocr-zzz'), 'zip', stage, output.name))
    receipt = {'package': str(output), 'zip': str(zipped), 'zipSha256': digest(zipped),
               'bytes': zipped.stat().st_size, 'selfCheckPassed': True}
    (stage / 'build-result.json').write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(receipt, indent=2), flush=True)


if __name__ == '__main__':
    main()
