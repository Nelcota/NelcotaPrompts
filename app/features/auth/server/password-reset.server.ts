import { createHash, randomBytes } from "node:crypto";

import { and, eq, gt, isNotNull, isNull, lt, or, sql } from "drizzle-orm";

import { type Db, getDb } from "~/shared/server/db.server";
import { passwordResets, users } from "~/shared/server/db/schema";
import { deleteUserSessions } from "./session-store.server";

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
export const RESET_TTL_MINUTES = 60;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function isTokenFormat(token: string): boolean {
  return TOKEN_PATTERN.test(token);
}

// Caminho do link de redefinição; quem mostra o link completo põe o endereço na frente.
function resetPath(token: string): string {
  return `/redefinir-senha?token=${token}`;
}

// Gera um link de uso único para o usuário. O token só existe no link; no banco fica o
// hash. Um link novo invalida os anteriores: a transação trava a linha do usuário, então
// duas gerações ao mesmo tempo (painel e terminal) não deixam dois links valendo.
// null = usuário não existe ou está bloqueado.
export async function createResetLink(userId: string, db: Db = getDb()): Promise<string | null> {
  const token = randomBytes(32).toString("base64url");

  const created = await db.transaction(async (tx) => {
    // Conta bloqueada não recebe link (o bloqueio também apaga os pendentes).
    const locked = await tx.select({ id: users.id }).from(users).where(and(eq(users.id, userId), isNull(users.disabledAt))).for("update");

    if (locked.length === 0) {
      return false;
    }

    // Aproveita para limpar os links vencidos ou usados de todo mundo.
    await tx
      .delete(passwordResets)
      .where(or(eq(passwordResets.userId, userId), isNotNull(passwordResets.usedAt), lt(passwordResets.expiresAt, sql`now()`)));
    await tx.insert(passwordResets).values({
      tokenHash: hashToken(token),
      userId,
      expiresAt: sql`now() + ${`${RESET_TTL_MINUTES} minutes`}::interval`,
    });

    return true;
  });

  return created ? resetPath(token) : null;
}

// Link ainda válido: não usado, dentro do prazo e de uma conta que não está bloqueada.
const validToken = (token: string) =>
  and(
    eq(passwordResets.tokenHash, hashToken(token)),
    isNull(passwordResets.usedAt),
    gt(passwordResets.expiresAt, sql`now()`),
    sql`exists (select 1 from ${users} where ${users.id} = ${passwordResets.userId} and ${users.disabledAt} is null)`,
  );

export async function findValidReset(token: string): Promise<{ userId: string; name: string } | null> {
  if (!isTokenFormat(token)) {
    return null;
  }

  const [row] = await getDb()
    .select({ userId: passwordResets.userId, name: users.name })
    .from(passwordResets)
    .innerJoin(users, eq(users.id, passwordResets.userId))
    .where(validToken(token));

  return row ?? null;
}

// Troca a senha numa transação só: marcar o link como usado, gravar a senha nova e
// encerrar todas as sessões. Se algo falhar no meio, nada muda e o link continua valendo.
// O UPDATE condicional garante que dois envios do mesmo link não passem os dois.
export async function resetPasswordWithToken(token: string, password: string): Promise<string | null> {
  if (!isTokenFormat(token)) {
    return null;
  }

  const passwordHash = await Bun.password.hash(password);

  return getDb().transaction(async (tx) => {
    const [row] = await tx
      .update(passwordResets)
      .set({ usedAt: sql`now()` })
      .where(validToken(token))
      .returning({ userId: passwordResets.userId });

    if (row === undefined) {
      return null;
    }

    await tx.update(users).set({ passwordHash }).where(eq(users.id, row.userId));
    await deleteUserSessions(tx, row.userId);

    return row.userId;
  });
}
