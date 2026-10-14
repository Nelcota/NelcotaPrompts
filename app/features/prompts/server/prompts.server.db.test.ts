import { afterAll, beforeAll, describe, expect, test } from "bun:test";

// Testes com banco de verdade: só rodam com TEST_DATABASE_URL (um banco descartável, já
// migrado). Apagam e criam dados à vontade, então nunca aponte para o banco do app.
const url = process.env.TEST_DATABASE_URL?.trim() ?? "";

describe.skipIf(url === "")("prompts no banco", async () => {
  if (url !== "") {
    process.env.DATABASE_URL = url;
  }

  const { eq, sql } = await import("drizzle-orm");
  const { getDb, getSql } = await import("~/shared/server/db.server");
  const { prompts, users } = await import("~/shared/server/db/schema");
  const { restorePrompt, trashPrompt } = await import("./prompts.server");
  const { adminTrashPrompt, getAdminStats } = await import("~/features/admin/server/admin.server");

  let authorId = "";
  let adminId = "";

  async function createUser(name: string): Promise<string> {
    const [row] = await getDb()
      .insert(users)
      .values({ email: `${crypto.randomUUID()}@teste.local`, name, passwordHash: "x" })
      .returning({ id: users.id });

    if (row === undefined) {
      throw new Error("usuário não criado");
    }

    return row.id;
  }

  async function createPrompt(copyCount = 0): Promise<string> {
    const [row] = await getDb().insert(prompts).values({ authorId, title: "T", body: "B", copyCount }).returning({ id: prompts.id });

    if (row === undefined) {
      throw new Error("prompt não criado");
    }

    return row.id;
  }

  beforeAll(async () => {
    authorId = await createUser("Autor");
    adminId = await createUser("Admin");
  });

  afterAll(async () => {
    await getDb().delete(users).where(sql`${users.email} like '%@teste.local'`);
    await getSql().close();
  });

  test("o autor desfaz o que ele mesmo apagou", async () => {
    const id = await createPrompt();

    expect(await trashPrompt(id, authorId)).toBe("ok");
    expect(await restorePrompt(id, authorId)).toBe("ok");
  });

  test("o autor não desfaz a moderação do admin", async () => {
    const id = await createPrompt();

    expect(await adminTrashPrompt(id, adminId)).toBe(true);
    expect(await restorePrompt(id, authorId)).toBe("not_found");
  });

  test("deleted_by null (admin excluído ou linha antiga) não vale como do autor", async () => {
    const id = await createPrompt();

    expect(await adminTrashPrompt(id, adminId)).toBe(true);
    await getDb().update(prompts).set({ deletedBy: null }).where(eq(prompts.id, id));
    expect(await restorePrompt(id, authorId)).toBe("not_found");
  });

  test("total de cópias passa do limite de int sem erro e sai como número", async () => {
    await createPrompt(2_000_000_000);
    await createPrompt(2_000_000_000);

    const stats = await getAdminStats();

    expect(typeof stats.copies).toBe("number");
    expect(stats.copies).toBeGreaterThanOrEqual(4_000_000_000);
  });

  test("o banco recusa email com maiúsculas e nome invisível", async () => {
    // O builder do Drizzle é thenable, não Promise: Promise.resolve executa a consulta.
    const insert = (email: string, name: string) => Promise.resolve(getDb().insert(users).values({ email, name, passwordHash: "x" }));

    await expect(insert("MAIUSCULA@teste.local", "Ok")).rejects.toThrow();
    await expect(insert(`${crypto.randomUUID()}@teste.local`, " ​ ")).rejects.toThrow();
  });
});
