import { and, asc, count, countDistinct, desc, eq, ilike, isNotNull, isNull, or, sql, sum } from "drizzle-orm";

import type { AdminPrompt, AdminStats, AdminUser } from "~/features/admin/admin-rules";
import { deleteUserSessions, liveSession, sessionUserId } from "~/features/auth/server/session-store.server";
import { avatarUrl } from "~/features/profile/server/avatars.server";
import { isLive, isRestorable } from "~/features/prompts/server/prompts.server";
import { type Database, getDb, likePattern } from "~/shared/server/db.server";
import { passwordResets, prompts, sessions, userAvatars, users } from "~/shared/server/db/schema";

// Consultas do painel admin (só dados; quem confere se é admin é requireAdmin).

const ADMIN_LIST_LIMIT = 500;

export async function getAdminStats(): Promise<AdminStats> {
  const db = getDb();
  const [userTotals, promptTotals, sessionTotals] = await Promise.all([
    db
      .select({
        users: count(),
        admins: count(sql`case when ${users.isAdmin} then 1 end`),
        disabledUsers: count(users.disabledAt),
      })
      .from(users),
    db
      .select({
        prompts: count(sql`case when ${prompts.deletedAt} is null then 1 end`),
        promptsLastWeek: count(sql`case when ${prompts.deletedAt} is null and ${prompts.createdAt} > now() - interval '7 days' then 1 end`),
        trashed: count(prompts.deletedAt),
        // bigint: somadas, as cópias de todos os prompts podem passar do limite de int.
        copies: sql<number>`coalesce(${sum(sql`case when ${prompts.deletedAt} is null then ${prompts.copyCount} end`)}, 0)::bigint`.mapWith(Number),
      })
      .from(prompts),
    db.select({ usersWithActiveSession: countDistinct(sessionUserId) }).from(sessions).where(liveSession),
  ]);

  return {
    users: userTotals[0]?.users ?? 0,
    admins: userTotals[0]?.admins ?? 0,
    disabledUsers: userTotals[0]?.disabledUsers ?? 0,
    prompts: promptTotals[0]?.prompts ?? 0,
    promptsLastWeek: promptTotals[0]?.promptsLastWeek ?? 0,
    trashed: promptTotals[0]?.trashed ?? 0,
    copies: promptTotals[0]?.copies ?? 0,
    usersWithActiveSession: sessionTotals[0]?.usersWithActiveSession ?? 0,
  };
}

export async function listAdminUsers(): Promise<AdminUser[]> {
  const db = getDb();
  // Contagens agrupadas uma vez (em vez de uma subconsulta por usuário).
  const promptCounts = db
    .select({ authorId: prompts.authorId, total: count().as("prompt_total") })
    .from(prompts)
    .where(isLive)
    .groupBy(prompts.authorId)
    .as("prompt_counts");
  const sessionCounts = db
    .select({ userId: sessionUserId.as("session_user_id"), total: count().as("session_total") })
    .from(sessions)
    .where(liveSession)
    .groupBy(sessionUserId)
    .as("session_counts");

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      avatarVersion: userAvatars.updatedAt,
      isAdmin: users.isAdmin,
      disabledAt: users.disabledAt,
      createdAt: users.createdAt,
      prompts: sql<number>`coalesce(${promptCounts.total}, 0)::int`,
      sessions: sql<number>`coalesce(${sessionCounts.total}, 0)::int`,
    })
    .from(users)
    .leftJoin(userAvatars, eq(userAvatars.userId, users.id))
    .leftJoin(promptCounts, eq(promptCounts.authorId, users.id))
    .leftJoin(sessionCounts, eq(sessionCounts.userId, sql`${users.id}::text`))
    .orderBy(desc(users.isAdmin), asc(users.createdAt))
    .limit(ADMIN_LIST_LIMIT);

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    avatarUrl: avatarUrl(row.id, row.avatarVersion),
    isAdmin: row.isAdmin,
    disabled: row.disabledAt !== null,
    createdAt: row.createdAt.toISOString(),
    prompts: row.prompts,
    sessions: row.sessions,
  }));
}

export type AdminChange = "ok" | "not_found" | "last_admin";

// Tirar o admin de alguém ou bloquear um admin não pode deixar o painel sem nenhum admin
// ativo. A transação trava as linhas dos admins ativos: dois admins tirando o acesso um do
// outro ao mesmo tempo não passam os dois.
async function wouldLeaveNoAdmin(tx: Database, userId: string): Promise<boolean> {
  const active = await tx
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.isAdmin, true), isNull(users.disabledAt)))
    .for("update");

  return active.length <= 1 && active.some((admin) => admin.id === userId);
}

export async function setUserAdmin(userId: string, isAdmin: boolean): Promise<AdminChange> {
  return getDb().transaction(async (tx) => {
    if (!isAdmin && (await wouldLeaveNoAdmin(tx, userId))) {
      return "last_admin";
    }

    const updated = await tx.update(users).set({ isAdmin }).where(eq(users.id, userId)).returning({ id: users.id });

    return updated.length > 0 ? "ok" : "not_found";
  });
}

// Bloquear também encerra as sessões e invalida os links de senha pendentes; desbloquear
// não devolve nenhuma sessão (a pessoa entra de novo).
export async function setUserDisabled(userId: string, disabled: boolean): Promise<AdminChange> {
  return getDb().transaction(async (tx) => {
    if (disabled && (await wouldLeaveNoAdmin(tx, userId))) {
      return "last_admin";
    }

    const updated = await tx
      .update(users)
      .set({ disabledAt: disabled ? new Date() : null })
      .where(eq(users.id, userId))
      .returning({ id: users.id });

    if (updated.length === 0) {
      return "not_found";
    }

    if (disabled) {
      await deleteUserSessions(tx, userId);
      await tx.delete(passwordResets).where(eq(passwordResets.userId, userId));
    }

    return "ok";
  });
}

export function endUserSessions(userId: string): Promise<number> {
  return deleteUserSessions(getDb(), userId);
}

// Apaga a conta e, em cascata, os prompts, favoritos, foto e links de senha dela. A
// confirmação (o email digitado) é conferida aqui, contra o email real da conta.
// false = conta não existe ou o email não confere.
export async function deleteUser(userId: string, confirmEmail: string): Promise<boolean> {
  return getDb().transaction(async (tx) => {
    const deleted = await tx
      .delete(users)
      .where(and(eq(users.id, userId), eq(sql`lower(${users.email})`, confirmEmail.toLowerCase())))
      .returning({ id: users.id });

    if (deleted.length === 0) {
      return false;
    }

    await deleteUserSessions(tx, userId);

    return true;
  });
}

// Total da lixeira: a lista para em ADMIN_LIST_LIMIT, mas "Esvaziar" apaga tudo, e o botão
// tem que dizer quantos de verdade.
export async function countTrash(): Promise<number> {
  const [row] = await getDb().select({ total: count() }).from(prompts).where(isNotNull(prompts.deletedAt));

  return row?.total ?? 0;
}

// trashed = false: prompts ativos (com busca); true: a lixeira inteira.
export async function listAdminPrompts(search: string | null, trashed: boolean): Promise<AdminPrompt[]> {
  const pattern = likePattern(search);
  const matches =
    pattern === null
      ? undefined
      : or(ilike(prompts.title, pattern), ilike(users.name, pattern), ilike(users.email, pattern), sql`array_to_string(${prompts.tags}, ' ') ilike ${pattern}`);

  const rows = await getDb()
    .select({
      id: prompts.id,
      title: prompts.title,
      authorName: users.name,
      authorEmail: users.email,
      tags: prompts.tags,
      copyCount: prompts.copyCount,
      createdAt: prompts.createdAt,
      deletedAt: prompts.deletedAt,
    })
    .from(prompts)
    .innerJoin(users, eq(users.id, prompts.authorId))
    .where(and(trashed ? isNotNull(prompts.deletedAt) : isLive, matches))
    .orderBy(desc(sql`coalesce(${prompts.deletedAt}, ${prompts.createdAt})`))
    .limit(ADMIN_LIST_LIMIT);

  return rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
  }));
}

// Moderação: o admin manda qualquer prompt para a lixeira (dá para restaurar).
export async function adminTrashPrompt(promptId: string, adminId: string): Promise<boolean> {
  const updated = await getDb()
    .update(prompts)
    .set({ deletedAt: sql`now()`, deletedBy: adminId })
    .where(and(eq(prompts.id, promptId), isLive))
    .returning({ id: prompts.id });

  return updated.length > 0;
}

export async function adminRestorePrompt(promptId: string): Promise<boolean> {
  const updated = await getDb()
    .update(prompts)
    .set({ deletedAt: null, deletedBy: null })
    .where(and(eq(prompts.id, promptId), isRestorable))
    .returning({ id: prompts.id });

  return updated.length > 0;
}

// Excluir de vez: só da lixeira, e leva junto histórico e favoritos (cascata).
export async function purgePrompt(promptId: string): Promise<boolean> {
  const deleted = await getDb()
    .delete(prompts)
    .where(and(eq(prompts.id, promptId), isNotNull(prompts.deletedAt)))
    .returning({ id: prompts.id });

  return deleted.length > 0;
}

export async function emptyTrash(): Promise<number> {
  const deleted = await getDb().delete(prompts).where(isNotNull(prompts.deletedAt)).returning({ id: prompts.id });

  return deleted.length;
}
