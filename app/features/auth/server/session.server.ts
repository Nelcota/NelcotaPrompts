import { and, eq, gt, isNull, lt, or, sql } from "drizzle-orm";
import { createCookie, createSessionStorage, redirect } from "react-router";

import { getDb } from "~/shared/server/db.server";
import { sessions } from "~/shared/server/db/schema";
import { readEnv } from "~/shared/server/env.server";
import { isUuid } from "~/shared/lib/ids";
import { loginHref } from "../login-redirect";
import { deleteUserSessions } from "./session-store.server";
import { findUserById, type PublicUser } from "./users.server";

type SessionData = {
  userId: string;
};

const isProduction = process.env.NODE_ENV === "production";

function parseSessionData(value: unknown): Partial<SessionData> | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  if (!("userId" in value)) {
    return {};
  }

  if (typeof value.userId !== "string" || value.userId === "") {
    return null;
  }

  return { userId: value.userId };
}

let storage: ReturnType<typeof createStorage> | undefined;

// Sessões guardadas no Postgres; o cookie assinado carrega só o id da linha.
function createStorage() {
  const cookie = createCookie("__nelcota_session", {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
    sameSite: "lax",
    secrets: [readEnv("SESSION_SECRET")],
    secure: isProduction,
  });

  // Sessões vencidas e a sessão atual: válida enquanto expires_at não passou.
  const live = (id: string) => and(eq(sessions.id, id), or(isNull(sessions.expiresAt), gt(sessions.expiresAt, sql`now()`)));

  return createSessionStorage<SessionData>({
    cookie,
    async createData(data, expires) {
      const db = getDb();
      await db.delete(sessions).where(lt(sessions.expiresAt, sql`now()`));

      const [row] = await db
        .insert(sessions)
        .values({ data, expiresAt: expires ?? null })
        .returning({ id: sessions.id });

      if (row === undefined) {
        throw new Error("Insert de sessão não retornou linha.");
      }

      return row.id;
    },
    async readData(id) {
      if (!isUuid(id)) {
        return null;
      }

      const [row] = await getDb().select({ data: sessions.data }).from(sessions).where(live(id));

      return row === undefined ? null : parseSessionData(row.data);
    },
    async updateData(id, data, expires) {
      if (isUuid(id)) {
        await getDb().update(sessions).set({ data, expiresAt: expires ?? null }).where(eq(sessions.id, id));
      }
    },
    async deleteData(id) {
      if (isUuid(id)) {
        await getDb().delete(sessions).where(eq(sessions.id, id));
      }
    },
  });
}

// Criado sob demanda para que o build não exija SESSION_SECRET.
function getStorage() {
  if (storage !== undefined) {
    return storage;
  }

  storage = createStorage();

  return storage;
}

export function getSession(request: Request) {
  return getStorage().getSession(request.headers.get("Cookie"));
}

export function commitSession(session: Awaited<ReturnType<typeof getSession>>) {
  return getStorage().commitSession(session);
}

export function destroySession(session: Awaited<ReturnType<typeof getSession>>) {
  return getStorage().destroySession(session);
}

export async function getOptionalUser(request: Request): Promise<PublicUser | null> {
  const session = await getSession(request);
  const userId = session.get("userId");

  if (userId === undefined) {
    return null;
  }

  return findUserById(userId);
}

type RequireOptions = {
  // Página (não rota de dados): o login volta para ela (ex.: um link /?p=… compartilhado).
  // Rotas que só devolvem JSON não usam, ou a pessoa cairia no JSON depois de entrar.
  returnHere?: boolean;
};

function loginUrl(request: Request, { returnHere = false }: RequireOptions): string {
  if (!returnHere) {
    return "/login";
  }

  const url = new URL(request.url);

  return loginHref(`${url.pathname}${url.search}`);
}

export async function requireUser(request: Request, options: RequireOptions = {}): Promise<PublicUser> {
  const session = await getSession(request);
  const userId = session.get("userId");

  if (userId === undefined) {
    throw redirect(loginUrl(request, options));
  }

  const user = await findUserById(userId);

  if (user === null) {
    throw redirect(loginUrl(request, options), {
      headers: { "Set-Cookie": await destroySession(session) },
    });
  }

  return user;
}

// Quem não é admin recebe 404: a rota nem parece existir.
export async function requireAdmin(request: Request, options: RequireOptions = {}): Promise<PublicUser> {
  const user = await requireUser(request, options);

  if (!user.isAdmin) {
    throw new Response("Página não encontrada.", { status: 404 });
  }

  return user;
}

export async function createUserSession(request: Request, userId: string, redirectTo: string) {
  const previous = await getSession(request);

  if (previous.id !== "") {
    await destroySession(previous);
  }

  // Sessão nova a cada login: um id anterior ao login nunca é reaproveitado.
  const session = await getStorage().getSession();
  session.set("userId", userId);

  return redirect(redirectTo, {
    headers: { "Set-Cookie": await commitSession(session) },
  });
}

// Encerra todas as sessões do usuário, menos a atual (se informada). Usado ao trocar ou
// redefinir a senha: um cookie roubado deixa de valer na hora.
export async function destroyUserSessions(userId: string, keepSessionId: string | null) {
  await deleteUserSessions(getDb(), userId, keepSessionId);
}

export async function currentSessionId(request: Request): Promise<string | null> {
  const session = await getSession(request);

  if (session.id === "") {
    return null;
  }

  return session.id;
}
