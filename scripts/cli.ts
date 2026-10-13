// Peças comuns dos scripts de terminal (migrate, seed, reset-link, make-admin).
import { eq } from "drizzle-orm";

import { type Db, dbFrom } from "../app/shared/server/db.server";
import { users } from "../app/shared/server/db/schema";

export function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

// Conexão própria do script (fora da pool do app): o cliente cru (SQL de migration) e o
// Drizzle sobre ele. Feche com client.close() no fim.
export function openDb(): { client: Bun.SQL; db: Db } {
  const url = process.env.DATABASE_URL?.trim();

  if (url === undefined || url === "") {
    fail("DATABASE_URL não definida.");
  }

  const client = new Bun.SQL(url);

  return { client, db: dbFrom(client) };
}

// Primeiro argumento que não é flag (--algo), em minúsculas. Vazio = mostra o uso e sai.
export function readEmailArg(usage: string): string {
  const email = process.argv.slice(2).find((arg) => !arg.startsWith("--"))?.trim().toLowerCase() ?? "";

  if (email === "") {
    fail(`Informe o email. ${usage}`);
  }

  return email;
}

export async function findUserByEmail(connection: { client: Bun.SQL; db: Db }, email: string): Promise<{ id: string; name: string }> {
  const [user] = await connection.db.select({ id: users.id, name: users.name }).from(users).where(eq(users.email, email));

  if (user === undefined) {
    await connection.client.close();
    fail(`Nenhuma conta com o email ${email}.`);
  }

  return user;
}
