import { and, eq, isNull } from "drizzle-orm";

import type { SessionUser } from "~/features/auth/types";
import { avatarUrl } from "~/features/profile/server/avatars.server";
import { isUuid } from "~/shared/lib/ids";
import { getDb, isUniqueViolation } from "~/shared/server/db.server";
import { userAvatars, users } from "~/shared/server/db/schema";

export type PublicUser = SessionUser;

type UserIdentity = { id: string; email: string; name: string };

export async function findUserById(id: string): Promise<PublicUser | null> {
  if (!isUuid(id)) {
    return null;
  }

  // Conta bloqueada some daqui: requireUser derruba a sessão na próxima requisição.
  const [row] = await getDb()
    .select({ id: users.id, email: users.email, name: users.name, isAdmin: users.isAdmin, avatarVersion: userAvatars.updatedAt })
    .from(users)
    .leftJoin(userAvatars, eq(userAvatars.userId, users.id))
    .where(and(eq(users.id, id), isNull(users.disabledAt)));

  if (row === undefined) {
    return null;
  }

  return { id: row.id, email: row.email, name: row.name, isAdmin: row.isAdmin, avatarUrl: avatarUrl(row.id, row.avatarVersion) };
}

// Hash fixo usado quando o email não existe, para o tempo de resposta não revelar contas.
// Criado já ao carregar o módulo: se fosse no primeiro login com email desconhecido, essa
// resposta (hash + verify) sairia mais lenta que uma senha errada.
const dummyHash = Bun.password.hash("senha-que-nunca-confere");

// Só confere a senha: quem precisa dos dados completos (com foto) usa findUserById.
export async function verifyLogin(email: string, password: string): Promise<UserIdentity | null> {
  const [user] = await getDb()
    .select({ id: users.id, email: users.email, name: users.name, passwordHash: users.passwordHash, disabledAt: users.disabledAt })
    .from(users)
    .where(eq(users.email, email));

  if (user === undefined) {
    await Bun.password.verify(password, await dummyHash);

    return null;
  }

  const valid = await Bun.password.verify(password, user.passwordHash);

  // Bloqueada: mesma resposta de senha errada (não revela se a conta existe).
  if (!valid || user.disabledAt !== null) {
    return null;
  }

  return { id: user.id, email: user.email, name: user.name };
}

type CreateUserResult = { ok: true; user: PublicUser } | { ok: false; reason: "email_taken" };

export async function createUser(input: { email: string; name: string; password: string }): Promise<CreateUserResult> {
  const passwordHash = await Bun.password.hash(input.password);

  try {
    const [user] = await getDb()
      .insert(users)
      .values({ email: input.email, name: input.name, passwordHash })
      .returning({ id: users.id, email: users.email, name: users.name });

    if (user === undefined) {
      throw new Error("Insert de usuário não retornou linha.");
    }

    return { ok: true, user: { ...user, avatarUrl: null, isAdmin: false } };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, reason: "email_taken" };
    }

    throw error;
  }
}

export async function updateUserName(userId: string, name: string) {
  await getDb().update(users).set({ name }).where(eq(users.id, userId));
}

export async function verifyPasswordById(userId: string, password: string): Promise<boolean> {
  const [row] = await getDb().select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, userId));

  return row === undefined ? false : Bun.password.verify(password, row.passwordHash);
}

export async function updateUserPassword(userId: string, password: string) {
  const passwordHash = await Bun.password.hash(password);
  await getDb().update(users).set({ passwordHash }).where(eq(users.id, userId));
}

export async function findUserName(id: string): Promise<string | null> {
  const [row] = await getDb().select({ name: users.name }).from(users).where(eq(users.id, id));

  return row?.name ?? null;
}
