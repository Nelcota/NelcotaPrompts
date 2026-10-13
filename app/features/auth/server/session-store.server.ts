import { and, eq, gt, isNull, ne, or, sql } from "drizzle-orm";

import { isUuid } from "~/shared/lib/ids";
import type { Database } from "~/shared/server/db.server";
import { sessions } from "~/shared/server/db/schema";

// Sessões por usuário (o id do usuário fica no jsonb data.userId). Recebem o banco ou a
// transação de quem chama: assim entram na mesma transação de quem bloqueia, exclui ou
// redefine a senha.

export const sessionUserId = sql<string>`${sessions.data} ->> 'userId'`;

// Sessão ainda válida (sem prazo ou dentro dele) e de alguém logado.
export const liveSession = and(
  sql`${sessions.data} ? 'userId'`,
  or(isNull(sessions.expiresAt), gt(sessions.expiresAt, sql`now()`)),
);

// Encerra as sessões do usuário, menos a informada (a do próprio aparelho). Devolve quantas.
export async function deleteUserSessions(db: Database, userId: string, keepSessionId: string | null = null): Promise<number> {
  const keep = keepSessionId !== null && isUuid(keepSessionId) ? ne(sessions.id, keepSessionId) : undefined;
  const deleted = await db.delete(sessions).where(and(eq(sessionUserId, userId), keep)).returning({ id: sessions.id });

  return deleted.length;
}
