import { readdir } from "node:fs/promises";
import { join } from "node:path";

import { openDb } from "./cli";

const MIGRATIONS_DIR = join(import.meta.dir, "..", "migrations");
const MIGRATION_FILE = /^\d{3}_[\w-]+\.sql$/;
// Chave arbitrária do advisory lock: só um processo aplica migrations por vez.
const LOCK_KEY = 7_340_211;

const { client: sql } = openDb();
// O advisory lock pertence à conexão, então tudo roda na mesma conexão reservada.
const connection = await sql.reserve();

async function finish(code: number): Promise<never> {
  await connection`select pg_advisory_unlock(${LOCK_KEY})`;
  connection.release();
  await sql.close();
  process.exit(code);
}

await connection`select pg_advisory_lock(${LOCK_KEY})`;

await connection`
  create table if not exists schema_migrations (
    name text primary key,
    applied_at timestamptz not null default now()
  )
`;

const appliedRows: { name: string }[] = await connection`select name from schema_migrations`;
const applied = new Set(appliedRows.map((row) => row.name));
const files = (await readdir(MIGRATIONS_DIR)).filter((file) => MIGRATION_FILE.test(file)).sort();
const pending = files.filter((file) => !applied.has(file));

if (pending.length === 0) {
  console.log("Nenhuma migration pendente.");
  await finish(0);
}

for (const file of pending) {
  const content = (await Bun.file(join(MIGRATIONS_DIR, file)).text()).trim();

  if (content === "") {
    console.error(`Migration ${file} está vazia.`);
    await finish(1);
  }

  try {
    await connection.unsafe("begin");
    await connection.unsafe(content);
    await connection`insert into schema_migrations (name) values (${file})`;
    await connection.unsafe("commit");
  } catch (error) {
    await connection.unsafe("rollback");
    console.error(`Falha ao aplicar ${file}:`, error);
    await finish(1);
  }

  console.log(`Aplicada: ${file}`);
}

await finish(0);
