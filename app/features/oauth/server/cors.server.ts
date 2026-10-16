// Endpoints que apps de IA chamam (metadados e registro do OAuth, troca do código e o
// próprio /mcp) também atendem apps que rodam no navegador. Nenhum deles usa cookie (a
// identidade vem do token ou do PKCE), então liberar qualquer origem não expõe sessão.
// O preflight (OPTIONS) chega ao loader da rota, não à action.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, MCP-Protocol-Version, Mcp-Session-Id, Last-Event-ID",
  "Access-Control-Expose-Headers": "WWW-Authenticate, Mcp-Session-Id",
};

export function corsJson(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return Response.json(body, { status, headers: { ...CORS_HEADERS, "Cache-Control": "no-store", ...headers } });
}

export function corsPreflight(): Response {
  return new Response(null, { status: 204, headers: { ...CORS_HEADERS, "Access-Control-Max-Age": "86400" } });
}

// Acrescenta os cabeçalhos de CORS numa resposta pronta (ex.: a do transporte MCP).
export function withCors(response: Response): Response {
  const headers = new Headers(response.headers);

  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    headers.set(key, value);
  }

  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

// Loader das rotas só de POST: responde o preflight e recusa o GET.
export function postOnlyLoader(request: Request): Response {
  return request.method === "OPTIONS" ? corsPreflight() : corsJson({ error: "invalid_request", error_description: "Use POST." }, 405, { Allow: "POST" });
}
