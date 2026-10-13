// Gera .br e .gz de cada arquivo comprimível do build (build/client). O servidor de
// produção (Hono serveStatic com precompressed) entrega a versão que o navegador aceita,
// sem comprimir nada em tempo de requisição. Roda no fim do "bun run build".
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { brotliCompressSync, constants as zlib } from "node:zlib";

const CLIENT_DIR = join(import.meta.dir, "..", "build", "client");
const COMPRESSIBLE = /\.(js|mjs|css|html|json|svg|txt|xml|webmanifest)$/;
const MIN_BYTES = 1024;

async function* files(dir: string): AsyncGenerator<string> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);

    if (entry.isDirectory()) {
      yield* files(path);
    } else if (COMPRESSIBLE.test(entry.name)) {
      yield path;
    }
  }
}

let count = 0;

for await (const path of files(CLIENT_DIR)) {
  if ((await stat(path)).size < MIN_BYTES) {
    continue;
  }

  const raw = new Uint8Array(await Bun.file(path).arrayBuffer());
  await Bun.write(`${path}.br`, brotliCompressSync(raw, { params: { [zlib.BROTLI_PARAM_QUALITY]: 11 } }));
  await Bun.write(`${path}.gz`, Bun.gzipSync(raw, { level: 9 }));
  count += 1;
}

console.log(`Pré-compressão: ${count} arquivos (.br e .gz).`);
