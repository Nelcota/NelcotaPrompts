import { createHash, randomBytes } from "node:crypto";

import { and, eq, gt, lt, notExists, sql } from "drizzle-orm";

import type { TokenAccess } from "~/features/api-tokens/api-token-rules";
import { issueClientToken } from "~/features/api-tokens/server/api-tokens.server";
import { publicUrl } from "~/shared/lib/public-url";
import { getDb } from "~/shared/server/db.server";
import { apiTokens, oauthClients, oauthCodes } from "~/shared/server/db/schema";

// OAuth 2.1 mínimo para o servidor MCP: registro dinâmico de cliente, autorização com
// PKCE (S256) e troca do código por um token de API. O cliente de IA faz tudo sozinho; a
// pessoa só entra e clica em "Permitir".

const CODE_TTL = sql`interval '10 minutes'`;
// Cliente registrado que nunca chegou a receber token é apagado depois deste prazo.
const UNUSED_CLIENT_TTL = sql`interval '1 day'`;
const CLIENT_NAME_MAX = 80;
const REDIRECT_URIS_MAX = 10;
const VERIFIER_PATTERN = /^[A-Za-z0-9._~-]{43,128}$/;
const CHALLENGE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
// Esquemas que nunca servem de retorno (rodariam código ou abririam arquivo local).
const BLOCKED_SCHEMES = new Set(["javascript:", "data:", "file:", "blob:", "vbscript:", "about:"]);

export const SCOPES = { read: "prompts:read", write: "prompts:write" } as const;

function sha256(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

function hashCode(code: string): string {
  return sha256(code).toString("hex");
}

// Endereço do app: APP_URL manda (atrás do proxy é o que o cliente enxerga); sem ela, o da
// própria requisição.
export function appOrigin(request: Request): string {
  return publicUrl() ?? new URL(request.url).origin;
}

export function authorizationServerMetadata(origin: string) {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/autorizar`,
    token_endpoint: `${origin}/oauth/token`,
    registration_endpoint: `${origin}/oauth/registrar`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: Object.values(SCOPES),
  };
}

export function protectedResourceMetadata(origin: string) {
  return {
    resource: `${origin}/mcp`,
    authorization_servers: [origin],
    scopes_supported: Object.values(SCOPES),
    bearer_methods_supported: ["header"],
    resource_name: "Nelcota Prompts",
  };
}

// Retorno aceito: https, http só no próprio computador (loopback, RFC 8252) ou o esquema
// próprio de um app (cursor://, vscode://).
export function isAllowedRedirectUri(raw: string): boolean {
  let url: URL;

  try {
    url = new URL(raw);
  } catch {
    return false;
  }

  if (url.hash !== "" || BLOCKED_SCHEMES.has(url.protocol)) {
    return false;
  }

  if (url.protocol === "http:") {
    return LOOPBACK_HOSTS.has(url.hostname);
  }

  return true;
}

type RegisterInput = { name: unknown; redirectUris: unknown };
type RegisterResult = { ok: true; clientId: string; name: string; redirectUris: string[] } | { ok: false; message: string };

export async function registerClient(input: RegisterInput): Promise<RegisterResult> {
  const uris = Array.isArray(input.redirectUris) ? input.redirectUris.filter((uri): uri is string => typeof uri === "string") : [];

  if (uris.length === 0 || uris.length > REDIRECT_URIS_MAX || uris.length !== (input.redirectUris as unknown[]).length) {
    return { ok: false, message: "redirect_uris precisa ser uma lista de 1 a 10 endereços." };
  }

  const invalid = uris.find((uri) => !isAllowedRedirectUri(uri));

  if (invalid !== undefined) {
    return { ok: false, message: `redirect_uri não permitido: ${invalid}` };
  }

  const rawName = typeof input.name === "string" ? input.name.trim() : "";
  const name = (rawName === "" ? "App de IA" : rawName).slice(0, CLIENT_NAME_MAX);
  const clientId = randomBytes(18).toString("base64url");
  const db = getDb();

  // Aproveita para limpar códigos vencidos e clientes que nunca foram usados.
  await db.delete(oauthCodes).where(lt(oauthCodes.expiresAt, sql`now()`));
  await db
    .delete(oauthClients)
    .where(
      and(
        lt(oauthClients.createdAt, sql`now() - ${UNUSED_CLIENT_TTL}`),
        notExists(db.select({ id: apiTokens.id }).from(apiTokens).where(eq(apiTokens.clientId, oauthClients.id))),
      ),
    );
  await db.insert(oauthClients).values({ id: clientId, name, redirectUris: uris });

  return { ok: true, clientId, name, redirectUris: uris };
}

export async function findClient(clientId: string): Promise<{ id: string; name: string; redirectUris: string[] } | null> {
  if (clientId === "" || clientId.length > 100) {
    return null;
  }

  const [row] = await getDb()
    .select({ id: oauthClients.id, name: oauthClients.name, redirectUris: oauthClients.redirectUris })
    .from(oauthClients)
    .where(eq(oauthClients.id, clientId));

  return row ?? null;
}

// Pedido de autorização já conferido (cliente existe, retorno registrado, PKCE S256).
export type AuthorizeRequest = {
  clientId: string;
  clientName: string;
  redirectUri: string;
  codeChallenge: string;
  state: string | null;
  // O cliente pediu escrita (escopo prompts:write ou nenhum escopo).
  wantsWrite: boolean;
};

// Erro sem retorno confiável: mostrado na tela, nunca redirecionado (evita usar o app
// como redirecionador aberto).
export type AuthorizeCheck = { ok: true; request: AuthorizeRequest } | { ok: false; message: string; redirect?: string };

// Redireciona de volta ao cliente com o resultado (code ou error) e o state.
export function redirectBack(redirectUri: string, params: Record<string, string>, state: string | null): string {
  const url = new URL(redirectUri);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  if (state !== null) {
    url.searchParams.set("state", state);
  }

  return url.toString();
}

export async function checkAuthorizeRequest(params: URLSearchParams): Promise<AuthorizeCheck> {
  const client = await findClient(params.get("client_id") ?? "");

  if (client === null) {
    return { ok: false, message: "Esse app não está registrado. Tente conectar de novo pelo app de IA." };
  }

  const redirectUri = params.get("redirect_uri") ?? (client.redirectUris.length === 1 ? client.redirectUris[0] : undefined);

  if (redirectUri === undefined || !client.redirectUris.includes(redirectUri)) {
    return { ok: false, message: "O endereço de retorno não confere com o que o app registrou." };
  }

  const state = params.get("state");
  const fail = (error: string) => ({ ok: false as const, message: "Pedido de autorização inválido.", redirect: redirectBack(redirectUri, { error }, state) });

  if (params.get("response_type") !== "code") {
    return fail("unsupported_response_type");
  }

  const codeChallenge = params.get("code_challenge") ?? "";

  if (params.get("code_challenge_method") !== "S256" || !CHALLENGE_PATTERN.test(codeChallenge)) {
    return fail("invalid_request");
  }

  const scopes = (params.get("scope") ?? "").split(" ").filter((scope) => scope !== "");
  const wantsWrite = scopes.length === 0 || scopes.includes(SCOPES.write);

  return { ok: true, request: { clientId: client.id, clientName: client.name, redirectUri, codeChallenge, state, wantsWrite } };
}

export async function createAuthorizationCode(request: AuthorizeRequest, userId: string, access: TokenAccess): Promise<string> {
  const code = randomBytes(32).toString("base64url");

  await getDb()
    .insert(oauthCodes)
    .values({
      codeHash: hashCode(code),
      clientId: request.clientId,
      userId,
      redirectUri: request.redirectUri,
      codeChallenge: request.codeChallenge,
      access,
      expiresAt: sql`now() + ${CODE_TTL}`,
    });

  return code;
}

export function pkceMatches(verifier: string, challenge: string): boolean {
  return VERIFIER_PATTERN.test(verifier) && sha256(verifier).toString("base64url") === challenge;
}

type ExchangeInput = { code: string; clientId: string; redirectUri: string | null; codeVerifier: string };
type ExchangeResult = { ok: true; token: string; access: TokenAccess } | { ok: false };

// Troca o código pelo token. O DELETE … RETURNING gasta o código antes de conferir o
// resto: um código vazado ou repetido nunca vale duas vezes.
export async function exchangeCode(input: ExchangeInput): Promise<ExchangeResult> {
  const [row] = await getDb()
    .delete(oauthCodes)
    .where(and(eq(oauthCodes.codeHash, hashCode(input.code)), gt(oauthCodes.expiresAt, sql`now()`)))
    .returning({
      clientId: oauthCodes.clientId,
      userId: oauthCodes.userId,
      redirectUri: oauthCodes.redirectUri,
      codeChallenge: oauthCodes.codeChallenge,
      access: oauthCodes.access,
    });

  if (
    row === undefined ||
    row.clientId !== input.clientId ||
    (input.redirectUri !== null && row.redirectUri !== input.redirectUri) ||
    !pkceMatches(input.codeVerifier, row.codeChallenge)
  ) {
    return { ok: false };
  }

  const client = await findClient(row.clientId);

  if (client === null) {
    return { ok: false };
  }

  const token = await issueClientToken(row.userId, client.id, client.name, row.access);

  return token === null ? { ok: false } : { ok: true, token, access: row.access };
}
