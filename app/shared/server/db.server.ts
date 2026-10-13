import { drizzle } from "drizzle-orm/bun-sql";

import * as schema from "./db/schema";
import { readEnv } from "./env.server";

declare global {
  // Pool compartilhada entre recargas do Vite em desenvolvimento.
  var __nelcotaSql: Bun.SQL | undefined;
}

// Pool do Bun.SQL (também usada direto pelo migrate e pelos scripts).
export function getSql(): Bun.SQL {
  if (globalThis.__nelcotaSql !== undefined) {
    return globalThis.__nelcotaSql;
  }

  const sql = new Bun.SQL(readEnv("DATABASE_URL"));
  globalThis.__nelcotaSql = sql;

  return sql;
}

function createDb(client: Bun.SQL) {
  return drizzle({ client, schema });
}

export type Db = ReturnType<typeof createDb>;
// Transação do Drizzle: quem recebe "Database" funciona dentro ou fora de uma.
export type Database = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];

let db: Db | undefined;

// Consultas tipadas (Drizzle) sobre a mesma pool.
export function getDb(): Db {
  db ??= createDb(getSql());

  return db;
}

// Banco próprio de um script (conexão fora da pool do app).
export function dbFrom(client: Bun.SQL): Db {
  return createDb(client);
}

const UNIQUE_VIOLATION = "23505";

// O Drizzle embrulha o erro do driver (DrizzleQueryError.cause).
export function isUniqueViolation(error: unknown): boolean {
  const cause = error instanceof Error && error.cause !== undefined ? error.cause : error;

  return cause instanceof Bun.SQL.PostgresError && cause.errno === UNIQUE_VIOLATION;
}

// Busca por "contém" com ILIKE: escapa % e _ digitados pela pessoa. null = sem filtro.
export function likePattern(search: string | null): string | null {
  return search === null ? null : `%${search.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}
