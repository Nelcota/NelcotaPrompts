import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

import { authenticateApiToken, readBearerToken } from "~/features/api-tokens/server/api-tokens.server";
import { createMcpServer } from "~/features/mcp/server/mcp.server";
import { corsPreflight, withCors } from "~/features/oauth/server/cors.server";
import { appOrigin } from "~/features/oauth/server/oauth.server";
import { consumeAttempt, retryAfterHeaders } from "~/shared/server/rate-limit.server";
import type { Route } from "./+types/mcp";

// Rota de recurso: servidor MCP (Streamable HTTP, sem sessão) para IAs usarem o mural.
// Autentica pelo token de API ("Authorization: Bearer nlc_…"): o app de IA consegue um
// sozinho pelo OAuth (o 401 aponta onde), ou a pessoa cria um à mão em "Conectar IA".

const REQUESTS_PER_MINUTE = 240;

function jsonRpcError(status: number, message: string, headers?: HeadersInit): Response {
  return Response.json({ jsonrpc: "2.0", error: { code: -32001, message }, id: null }, { status, headers });
}

async function handle(request: Request): Promise<Response> {
  const token = readBearerToken(request);
  const caller = token === null ? null : await authenticateApiToken(token);

  if (caller === null) {
    const metadata = `${appOrigin(request)}/.well-known/oauth-protected-resource`;

    return jsonRpcError(401, "Conecte o app pelo navegador (OAuth) ou use um token criado em Conectar IA.", {
      "WWW-Authenticate": `Bearer resource_metadata="${metadata}"`,
    });
  }

  const limit = await consumeAttempt(`mcp:${caller.tokenId}`, REQUESTS_PER_MINUTE, 60_000);

  if (limit.limited) {
    return jsonRpcError(429, "Muitas requisições. Espere um pouco.", retryAfterHeaders(limit.retryAfterSeconds));
  }

  // Um servidor por requisição, fechado no fim. Com resposta em JSON (não em stream), o
  // corpo já está pronto quando handleRequest volta, então fechar não corta nada.
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  const server = createMcpServer(caller);

  try {
    await server.connect(transport);

    return await transport.handleRequest(request);
  } finally {
    await server.close().catch((error: unknown) => console.error("Falha ao fechar o servidor MCP:", error));
  }
}

// Sem sessão não há stream de eventos do servidor para abrir: GET responde 405, como a
// especificação prevê (o cliente segue só com POST).
export function loader({ request }: Route.LoaderArgs) {
  return request.method === "OPTIONS" ? corsPreflight() : withCors(new Response(null, { status: 405, headers: { Allow: "POST" } }));
}

// Qualquer falha (banco, limite, SDK) vira erro JSON-RPC com CORS: um app no navegador
// veria só um "erro de CORS" opaco num 500 sem esses cabeçalhos.
export async function action({ request }: Route.ActionArgs) {
  try {
    return withCors(await handle(request));
  } catch (error) {
    console.error("Falha no MCP:", error);

    return withCors(jsonRpcError(500, "Erro interno do servidor."));
  }
}
