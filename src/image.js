import { open } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

export async function readImage(inputPath) {
  const path = resolve(inputPath);
  let handle;
  try {
    handle = await open(path, 'r');
    const info = await handle.stat();
    if (!info.isFile()) throw new Error('O caminho deve apontar para um arquivo.');
    if (info.size === 0) throw new Error('O arquivo esta vazio.');
    if (info.size > 30 * 1024 * 1024) throw new Error('Limite desta etapa: 30 MiB por imagem.');
    const buffer = await handle.readFile();
    const png = buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const jpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    if (!png && !jpeg) throw new Error('Formato nao aceito. Use uma imagem PNG ou JPEG.');
    return {
      buffer,
      source: { path, format: png ? 'png' : 'jpeg', bytes: buffer.length,
        sha256: createHash('sha256').update(buffer).digest('hex') },
    };
  } catch (error) {
    throw new Error(`Nao foi possivel ler a imagem "${path}": ${error.message}`, { cause: error });
  } finally {
    await handle?.close();
  }
}
