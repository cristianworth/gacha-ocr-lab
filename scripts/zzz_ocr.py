"""Session-owned Tesseract C API using the already qualified Windows DLL/model."""
import ctypes
import os
import time
from pathlib import Path


class NativeTesseract:
    """Keep one engine loaded; clear image/adaptation state between sequential reads."""
    def __init__(self, cache):
        self._handle = None
        self._directory = None
        self._model_buffer = None
        root = Path(cache).resolve() / 'tesseract'
        try:
            self._directory = os.add_dll_directory(str(root))
            self._lib = ctypes.CDLL(str(root / 'libtesseract-5.dll'))
            pointer, integer, string = ctypes.c_void_p, ctypes.c_int, ctypes.c_char_p
            def bind(name, arguments, result):
                function = getattr(self._lib, name)
                function.argtypes, function.restype = arguments, result
                return function
            create = bind('TessBaseAPICreate', [], pointer)
            initialize = bind('TessBaseAPIInit5', [pointer, pointer, integer, string, integer,
                              pointer, integer, pointer, pointer, ctypes.c_size_t, integer], integer)
            self._delete = bind('TessBaseAPIDelete', [pointer], None)
            self._set_mode = bind('TessBaseAPISetPageSegMode', [pointer, integer], None)
            self._set_image = bind('TessBaseAPISetImage', [pointer, pointer, integer, integer, integer, integer], None)
            # Keep the pointer, rather than c_char_p's automatic copy, so it can be freed.
            self._get_text = bind('TessBaseAPIGetUTF8Text', [pointer], pointer)
            self._free_text = bind('TessDeleteText', [pointer], None)
            self._clear = bind('TessBaseAPIClear', [pointer], None)
            self._clear_adaptation = bind('TessBaseAPIClearAdaptiveClassifier', [pointer], None)
            # File-based C API initialization in this Windows DLL cannot resolve all
            # Unicode paths. Keep the exact model bytes alive for the engine lifetime.
            model = (root / 'tessdata/eng.traineddata').read_bytes()
            self._model_buffer = ctypes.create_string_buffer(model)
            self._handle = create()
            if not self._handle or initialize(self._handle, self._model_buffer, len(model), b'eng', 1,
                                              None, 0, None, None, 0, False) != 0:
                raise RuntimeError('Tesseract native engine initialization failed')
        except BaseException:
            self.close()
            raise

    def _read(self, image, profile, mode):
        from youkai_ocr.recognize import preprocess
        if not self._handle:
            raise RuntimeError('Tesseract native engine is closed')
        prepared = preprocess(image, profile).convert('L')
        if min(prepared.size) <= 0:
            raise ValueError('OCR image must not be empty')
        buffer = ctypes.create_string_buffer(prepared.tobytes())
        text = None
        try:
            self._set_mode(self._handle, mode)
            self._set_image(self._handle, buffer, prepared.width, prepared.height, 1, prepared.width)
            text = self._get_text(self._handle)
            if not text:
                raise RuntimeError('Tesseract native engine did not return a text buffer')
            return ctypes.string_at(text).decode('utf-8').strip()
        finally:
            if text:
                self._free_text(text)
            self._clear(self._handle)
            self._clear_adaptation(self._handle)

    def read_text(self, image, profile):
        return self._read(image, profile, 6)

    def read_line(self, image, profile):
        return self._read(image, profile, 7)

    def read_word(self, image, profile):
        return self._read(image, profile, 8)

    def close(self):
        if self._handle:
            handle, self._handle = self._handle, None
            self._delete(handle)
        self._model_buffer = None
        if self._directory is not None:
            directory, self._directory = self._directory, None
            directory.close()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()


def make_session_recognizer(cache, legacy_factory):
    started = time.perf_counter()
    try:
        recognizer = NativeTesseract(cache)
        metadata = {'engine': 'tesseract-native', 'model': 'eng', 'oem': 1}
    except (OSError, AttributeError, RuntimeError) as exc:
        recognizer = legacy_factory('tesseract')
        metadata = {'engine': 'pytesseract', 'fallbackReason': str(exc)}
    metadata['initializationSeconds'] = time.perf_counter() - started
    return recognizer, metadata
