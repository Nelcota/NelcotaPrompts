import { randomBytes } from "node:crypto";

import { and, count, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";

import { getDb } from "~/shared/server/db.server";
import { apiTokens, users } from "~/shared/server/db/schema";
import { hashSecret } from "~/shared/server/secret-hash.server";
import { type ApiTokenSummary, type TokenAccess, TOKENS_MAX } from "../api-token-rules";

// Tokens de API pessoais: a IA usa o sistema (servidor MCP) em nome do dono do token. O
// token só existe na resposta de criação; no banco fica o hash.

// Prefixo fixo: deixa o token reconhecível (scanners de segredo, logs) e separa de outros.
const TOKEN_PREFIX = "nlc_";
const TOKEN_PATTERN = /^nlc_[A-Za-z0-9_-]{43}$/;
// last_used_at é gravado no máximo uma vez por este intervalo (não a cada requisição).
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

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

function newToken(): string {
  return `${TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
}

type CreateTokenResult = { ok: true; token: string } | { ok: false; reason: "limit" };

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

    await tx.insert(apiTokens).values({ userId, name, access, tokenHash: hashSecret(token) });

    return { ok: true, token };
  });
}

// Token de um app conectado por OAuth: um por pessoa e app (autorizar de novo troca o
// anterior). Upsert num comando só: duas trocas ao mesmo tempo não colidem no índice
// único, a última vence. null = conta inexistente ou bloqueada.
export async function issueClientToken(userId: string, clientId: string, name: string, access: TokenAccess): Promise<string | null> {
  const db = getDb();
  const [active] = await db.select({ id: users.id }).from(users).where(and(eq(users.id, userId), isNull(users.disabledAt)));

  if (active === undefined) {
    return null;
  }

  const token = newToken();
  const tokenHash = hashSecret(token);

  await db
    .insert(apiTokens)
    .values({ userId, clientId, name, access, tokenHash })
    .onConflictDoUpdate({
      target: [apiTokens.userId, apiTokens.clientId],
      targetWhere: isNotNull(apiTokens.clientId),
      set: { tokenHash, name, access, lastUsedAt: null, createdAt: sql`now()` },
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

export type ApiCaller = { userId: string; tokenId: string; access: TokenAccess };

// Quem chama a API: token válido de uma conta ativa (conta bloqueada = token sem efeito,
// como as sessões), numa consulta só. null = não autenticado.
export async function authenticateApiToken(token: string): Promise<ApiCaller | null> {
  if (!isApiTokenFormat(token)) {
    return null;
  }

  const db = getDb();
  const [found] = await db
    .select({ id: apiTokens.id, userId: apiTokens.userId, access: apiTokens.access, lastUsedAt: apiTokens.lastUsedAt })
    .from(apiTokens)
    .innerJoin(users, and(eq(users.id, apiTokens.userId), isNull(users.disabledAt)))
    .where(eq(apiTokens.tokenHash, hashSecret(token)));

  if (found === undefined) {
    return null;
  }

  // "Usado em" é só informativo: grava em segundo plano e raramente.
  if (found.lastUsedAt === null || Date.now() - found.lastUsedAt.getTime() > TOUCH_INTERVAL_MS) {
    void db
      .update(apiTokens)
      .set({ lastUsedAt: sql`now()` })
      .where(eq(apiTokens.id, found.id))
      .catch((error: unknown) => console.error("Falha ao marcar uso do token:", error));
  }

  return { userId: found.userId, tokenId: found.id, access: found.access };
}

// Token do cabeçalho "Authorization: Bearer nlc_…". null = ausente ou malformado.
export function readBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization")?.trim() ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(header);

  return match?.[1] ?? null;
}
