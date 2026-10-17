import { mkdir, access } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { createWorker, PSM, OEM } from 'tesseract.js';

const require = createRequire(import.meta.url);
const { version } = require('tesseract.js/package.json');

export async function recognizeImage(buffer, { languages, cachePath, offline = false }) {
  await mkdir(cachePath, { recursive: true });
  if (offline) {
    for (const language of languages.split('+')) {
      try {
        await access(join(cachePath, `${language}.traineddata`));
      } catch {
        throw new Error(`Modelo ${language} ausente no cache. Execute uma vez sem --offline.`);
      }
    }
  }

  let timer;
  let rejectInitialization;
  const initializationFailure = new Promise((_, reject) => { rejectInitialization = reject; });
  const creatingWorker = createWorker(languages, OEM.LSTM_ONLY, {
    cachePath,
    ...(offline ? { langPath: cachePath, gzip: false, cacheMethod: 'readOnly' } : {}),
    // The library also reports rejected jobs here; never throw in its message callback.
    errorHandler: (error) => rejectInitialization(new Error(String(error))),
  });
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('Tempo limite de inicializacao do OCR (120 s).')), 120_000);
  });
  let worker;
  try {
    worker = await Promise.race([creatingWorker, initializationFailure, timeout]);
    clearTimeout(timer);
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
    const { data } = await worker.recognize(buffer, {}, { text: true, tsv: true });
    // TSV page records contain the decoded image dimensions, independent of its format.
    const page = data.tsv?.split(/\r?\n/u).find((line) => line.startsWith('1\t'))?.split('\t');
    const width = Number(page?.[8]);
    const height = Number(page?.[9]);
    return {
      imageSize: Number.isInteger(width) && width > 0 && Number.isInteger(height) && height > 0
        ? { width, height } : null,
      engine: 'tesseract.js', engineVersion: version, languages,
      pageSegmentationMode: 'SPARSE_TEXT',
      confidence: Number.isFinite(data.confidence) ? data.confidence : null,
      rawText: data.text ?? '',
      tsv: data.tsv ?? '',
    };
  } catch (error) {
    // A late successful initialization must not leave an extra worker alive.
    if (!worker) void creatingWorker.then((lateWorker) => lateWorker.terminate(), () => {});
    throw new Error(`Falha no OCR: ${error.message ?? error}`, { cause: error });
  } finally {
    clearTimeout(timer);
    await worker?.terminate();
  }
}
