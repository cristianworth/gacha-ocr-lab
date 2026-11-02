"""Native OCR owns buffers/engine state; lossless evidence keeps decoded pixels."""
import ctypes
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import zzz_ocr
from youkai_capture import save_evidence_image


@pytest.fixture
def library(monkeypatch, tmp_path):
    model = tmp_path / 'tesseract/tessdata/eng.traineddata'
    model.parent.mkdir(parents=True)
    model.write_bytes(b'fake model for C API stubs')
    text = ctypes.create_string_buffer('  raw text café\n'.encode('utf-8'))
    names = ['TessBaseAPICreate', 'TessBaseAPIInit5', 'TessBaseAPIDelete', 'TessBaseAPISetPageSegMode',
             'TessBaseAPISetImage', 'TessBaseAPIGetUTF8Text', 'TessDeleteText',
             'TessBaseAPIClear', 'TessBaseAPIClearAdaptiveClassifier']
    functions = SimpleNamespace(**{name: Mock() for name in names})
    functions.TessBaseAPICreate.return_value = 123
    functions.TessBaseAPIInit5.return_value = 0
    functions.TessBaseAPIGetUTF8Text.return_value = ctypes.addressof(text)
    directory = Mock()
    monkeypatch.setattr(zzz_ocr.os, 'add_dll_directory', Mock(return_value=directory))
    monkeypatch.setattr(zzz_ocr.ctypes, 'CDLL', Mock(return_value=functions))
    return functions, directory, text


def test_one_engine_reused_but_each_image_and_adaptation_are_cleared(tmp_path, library):
    dll, directory, _ = library
    image = Image.new('RGB', (90, 30), 'white')
    with zzz_ocr.NativeTesseract(tmp_path) as engine:
        assert engine.read_line(image, 'white_text_on_dark') == 'raw text café'
        assert engine.read_text(image, 'white_text_on_dark_dim') == 'raw text café'
        assert dll.TessBaseAPICreate.call_count == dll.TessBaseAPIInit5.call_count == 1
        initialized = dll.TessBaseAPIInit5.call_args.args
        assert ctypes.string_at(initialized[1], initialized[2]) == b'fake model for C API stubs'
        assert [c.args[1] for c in dll.TessBaseAPISetPageSegMode.call_args_list] == [7, 6]
        assert dll.TessBaseAPIClear.call_count == dll.TessBaseAPIClearAdaptiveClassifier.call_count == 2
        assert dll.TessDeleteText.call_count == 2
    engine.close()
    dll.TessBaseAPIDelete.assert_called_once_with(123)
    directory.close.assert_called_once()
    with pytest.raises(RuntimeError, match='closed'):
        engine.read_line(image, 'white_text_on_dark')


def test_failed_model_initialization_frees_engine_and_search_directory(tmp_path, library):
    dll, directory, _ = library
    dll.TessBaseAPIInit5.return_value = -1
    with pytest.raises(RuntimeError, match='initialization'):
        zzz_ocr.NativeTesseract(tmp_path)
    dll.TessBaseAPIDelete.assert_called_once_with(123)
    directory.close.assert_called_once()


def test_failed_read_clears_state_without_freeing_a_null_text_pointer(tmp_path, library):
    dll, directory, _ = library
    dll.TessBaseAPIGetUTF8Text.return_value = None
    with zzz_ocr.NativeTesseract(tmp_path) as engine:
        with pytest.raises(RuntimeError, match='text buffer'):
            engine.read_line(Image.new('RGB', (90, 30)), 'white_text_on_dark')
        dll.TessDeleteText.assert_not_called()
        dll.TessBaseAPIClear.assert_called_once()
        dll.TessBaseAPIClearAdaptiveClassifier.assert_called_once()


def test_missing_dll_uses_explicit_legacy_fallback(tmp_path, monkeypatch):
    monkeypatch.setattr(zzz_ocr, 'NativeTesseract', Mock(side_effect=OSError('DLL unavailable')))
    original = Mock()
    factory = Mock(return_value=original)
    reader, metadata = zzz_ocr.make_session_recognizer(tmp_path, factory)
    assert reader is original and metadata['engine'] == 'pytesseract'
    assert metadata['fallbackReason'] == 'DLL unavailable'
    factory.assert_called_once_with('tesseract')


def test_lossless_fast_png_preserves_mode_size_and_every_pixel(tmp_path):
    image = Image.frombytes('RGB', (90, 30), bytes(range(256)) * 31 + bytes(range(164)))
    target = tmp_path / 'evidence.png'
    save_evidence_image(image, target)
    with Image.open(target) as saved:
        assert saved.format == 'PNG' and saved.mode == image.mode and saved.size == image.size
        assert saved.tobytes() == image.tobytes()
