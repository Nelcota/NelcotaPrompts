import { createHash, randomBytes } from "node:crypto";

import { and, count, desc, eq, isNotNull, isNull, lt, or, sql } from "drizzle-orm";

import { findUserById, type PublicUser } from "~/features/auth/server/users.server";
import { getDb } from "~/shared/server/db.server";
import { apiTokens, users } from "~/shared/server/db/schema";
import { type ApiTokenSummary, type TokenAccess, TOKENS_MAX } from "../api-token-rules";

// Tokens de API pessoais: a IA usa o sistema (servidor MCP) em nome do dono do token. O
// token só existe na resposta de criação; no banco fica o hash.

// Prefixo fixo: deixa o token reconhecível (scanners de segredo, logs) e separa de outros.
const TOKEN_PREFIX = "nlc_";
const TOKEN_PATTERN = /^nlc_[A-Za-z0-9_-]{43}$/;
// last_used_at é gravado no máximo uma vez por este intervalo (não a cada requisição).
const TOUCH_INTERVAL = sql`interval '5 minutes'`;

export function hashApiToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function isApiTokenFormat(token: string): boolean {
  return TOKEN_PATTERN.test(token);
}

export async function listApiTokens(userId: string): Promise<ApiTokenSummary[]> {
  const rows = await getDb()
    .select({
      id: apiTokens.id,
      name: apiTokens.name,
      access: apiTokens.access,
      app: isNotNull(apiTokens.clientId).mapWith(Boolean),
      lastUsedAt: apiTokens.lastUsedAt,
      createdAt: apiTokens.createdAt,
    })
    .from(apiTokens)
    .where(eq(apiTokens.userId, userId))
    .orderBy(desc(apiTokens.createdAt));

  return rows.map((row) => ({ ...row, lastUsedAt: row.lastUsedAt?.toISOString() ?? null, createdAt: row.createdAt.toISOString() }));
}

type CreateTokenResult = { ok: true; token: string } | { ok: false; reason: "limit" };

function newToken(): string {
  return `${TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
}

// Token criado à mão (os de app conectado por OAuth não contam no limite). A transação
// trava a linha do usuário: dois pedidos ao mesmo tempo não passam do limite.
export async function createApiToken(userId: string, name: string, access: TokenAccess): Promise<CreateTokenResult> {
  const token = newToken();

  return getDb().transaction(async (tx): Promise<CreateTokenResult> => {
    await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for("update");

    const [existing] = await tx
      .select({ total: count() })
      .from(apiTokens)
      .where(and(eq(apiTokens.userId, userId), isNull(apiTokens.clientId)));

    if ((existing?.total ?? 0) >= TOKENS_MAX) {
      return { ok: false, reason: "limit" };
    }

    await tx.insert(apiTokens).values({ userId, name, access, tokenHash: hashApiToken(token) });

    return { ok: true, token };
  });
}

// Token de um app conectado por OAuth: um por pessoa e app (autorizar de novo troca o
// anterior). null = conta inexistente ou bloqueada.
export async function issueClientToken(userId: string, clientId: string, name: string, access: TokenAccess): Promise<string | null> {
  if ((await findUserById(userId)) === null) {
    return null;
  }

  const token = newToken();

  await getDb().transaction(async (tx) => {
    await tx.delete(apiTokens).where(and(eq(apiTokens.userId, userId), eq(apiTokens.clientId, clientId)));
    await tx.insert(apiTokens).values({ userId, clientId, name, access, tokenHash: hashApiToken(token) });
  });

  return token;
}

// false = o token não existe (ou é de outra pessoa).
export async function revokeApiToken(userId: string, tokenId: string): Promise<boolean> {
  const deleted = await getDb()
    .delete(apiTokens)
    .where(and(eq(apiTokens.id, tokenId), eq(apiTokens.userId, userId)))
    .returning({ id: apiTokens.id });

  return deleted.length > 0;
}

export type ApiCaller = { user: PublicUser; tokenId: string; access: TokenAccess };

// Quem chama a API: token válido de uma conta ativa (conta bloqueada = token sem efeito,
// como as sessões). null = não autenticado.
export async function authenticateApiToken(token: string): Promise<ApiCaller | null> {
  if (!isApiTokenFormat(token)) {
    return null;
  }

  const db = getDb();
  const [found] = await db
    .select({ id: apiTokens.id, userId: apiTokens.userId, access: apiTokens.access })
    .from(apiTokens)
    .where(eq(apiTokens.tokenHash, hashApiToken(token)));

  if (found === undefined) {
    return null;
  }

  const user = await findUserById(found.userId);

  if (user === null) {
    return null;
  }

  await db
    .update(apiTokens)
    .set({ lastUsedAt: sql`now()` })
    .where(and(eq(apiTokens.id, found.id), or(isNull(apiTokens.lastUsedAt), lt(apiTokens.lastUsedAt, sql`now() - ${TOUCH_INTERVAL}`))));

  return { user, tokenId: found.id, access: found.access };
}

// Token do cabeçalho "Authorization: Bearer nlc_…". null = ausente ou malformado.
export function readBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization")?.trim() ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(header);

  return match?.[1] ?? null;
}
