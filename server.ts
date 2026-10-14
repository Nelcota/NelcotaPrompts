// Servidor de produção: Hono sobre Bun.serve. Arquivos do build, compressão, CSRF,
// headers de segurança e limite de corpo são middlewares do Hono; o resto vai para o
// React Router.
import { join } from "node:path";

import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { getConnInfo, serveStatic } from "hono/bun";
import { HTTPException } from "hono/http-exception";
import { compress } from "hono/compress";
import { csrf } from "hono/csrf";
import { secureHeaders } from "hono/secure-headers";
import { isbot } from "isbot";
import { createRequestHandler, type ServerBuild } from "react-router";

import { publicUrl } from "./app/shared/lib/public-url";
import { readEnv } from "./app/shared/server/env.server";

const SERVER_BUILD = join(import.meta.dir, "build", "server", "index.js");
const DEFAULT_PORT = 3000;
// Teto do corpo das requisições: o maior caso é a logo (até 1 MB); a foto de perfil, 512 KB.
const MAX_BODY_BYTES = 4 * 1024 * 1024;
const ONE_YEAR = 60 * 60 * 24 * 365;

function readPort(): number {
  const raw = process.env.PORT?.trim();

  if (raw === undefined || raw === "") {
    return DEFAULT_PORT;
  }

  const port = Number(raw);

  // PORT definida com valor inválido é erro de configuração: subir na porta padrão deixaria
  // o app "no ar" numa porta onde o proxy não procura.
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    console.error(`PORT inválida (${raw}). Use um número de 1 a 65535 ou deixe vazia (padrão ${DEFAULT_PORT}).`);
    process.exit(1);
  }

  return port;
}

// Valor de exemplo do .env.example: copiado sem trocar, assinaria as sessões com um
// segredo público.
const EXAMPLE_SECRET = "troque-por-um-valor-longo-e-aleatorio";

// Obrigatórias conferidas na subida: sem elas o servidor subiria "no ar" e só falharia na
// primeira requisição que usasse o banco ou a sessão (o healthcheck nem pegaria o segredo).
function checkRequiredEnv() {
  try {
    readEnv("DATABASE_URL");

    if (readEnv("SESSION_SECRET") === EXAMPLE_SECRET) {
      throw new Error("SESSION_SECRET ainda é o valor de exemplo do .env.example. Gere um valor aleatório.");
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

checkRequiredEnv();

function isServerBuild(value: unknown): value is ServerBuild {
  return typeof value === "object" && value !== null && "routes" in value && "entry" in value && "assets" in value;
}

const serverModule: unknown = await import(SERVER_BUILD);

if (!isServerBuild(serverModule)) {
  console.error(`Build inválido em ${SERVER_BUILD}. Rode "bun run build" antes de "bun run start".`);
  process.exit(1);
}

const handleRequest = createRequestHandler(serverModule, "production");
const app = new Hono();

// O CSP (com nonce) vem do entry.server do React Router; aqui ficam os demais headers.
app.use(
  secureHeaders({
    contentSecurityPolicy: undefined,
    xFrameOptions: "DENY",
    referrerPolicy: "strict-origin-when-cross-origin",
    // Sem includeSubDomains: não força HTTPS em outros subdomínios do mesmo domínio.
    strictTransportSecurity: "max-age=31536000",
    permissionsPolicy: { camera: [], microphone: [], geolocation: [] },
  }),
);

// Arquivos do build. Os de /assets/ têm hash no nome (nunca mudam): cache de um ano. As
// versões .br/.gz são geradas no build (scripts/precompress.ts).
app.use(
  "*",
  serveStatic({
    // Relativo ao server.ts (não ao diretório de onde o processo foi iniciado).
    root: join(import.meta.dir, "build", "client"),
    precompressed: true,
    onFound: (path, c) => {
      c.header("Cache-Control", path.includes("/assets/") ? `public, max-age=${ONE_YEAR}, immutable` : "public, max-age=3600");
    },
  }),
);

// CSRF (inclusive "login CSRF"): envios de formulário só do próprio site. A Origin é
// comparada com o Host, e não com a URL interna: o proxy termina o HTTPS antes daqui.
app.use(
  csrf({
    secFetchSite: "same-origin",
    origin: (origin, c) => {
      try {
        return new URL(origin).host === c.req.header("host");
      } catch {
        return false;
      }
    },
  }),
);

app.use(bodyLimit({ maxSize: MAX_BODY_BYTES, onError: (c) => c.text("Arquivo grande demais.", 413) }));

// HTML e dados (.data) saem em streaming; o compress mantém o streaming.
app.use(compress());

// O HTTPS termina no proxy (Traefik do Coolify, Cloudflare): aqui a requisição chega como
// http://. O React Router compara a origem inteira (com o protocolo) do cabeçalho Origin
// com request.url e recusaria todo formulário com 400; por isso a URL volta a ser https
// quando o proxy avisa. Forjar o cabeçalho só troca o protocolo da própria requisição.
function withForwardedProto(request: Request, forwardedProto: string | undefined): Request {
  const proto = forwardedProto?.split(",")[0]?.trim().toLowerCase();
  const url = new URL(request.url);

  if (proto !== "https" || url.protocol === "https:") {
    return request;
  }

  url.protocol = "https:";

  return new Request(url, request);
}

// Robôs de cartão de link (WhatsApp, Telegram…) não seguem o redirecionamento de quem não
// está logado para /login: o cartão saía só com o domínio. Para eles, o login é servido
// direto (200) no endereço pedido, com as tags de compartilhamento do layout.
function isLoginRedirect(response: Response): boolean {
  return response.status >= 300 && response.status < 400 && response.headers.get("location") === "/login";
}

app.all("*", async (c) => {
  const clientIp = getConnInfo(c).remote.address;
  const context = clientIp === undefined ? {} : { clientIp };
  const request = withForwardedProto(c.req.raw, c.req.header("x-forwarded-proto"));
  const response = await handleRequest(request, context);
  const userAgent = c.req.header("user-agent");

  if (request.method !== "GET" || userAgent === undefined || !isbot(userAgent) || !isLoginRedirect(response)) {
    return response;
  }

  return handleRequest(new Request(new URL("/login", request.url), { headers: request.headers }), context);
});

// Recusas dos middlewares (CSRF 403, corpo grande demais 413) chegam como HTTPException.
app.onError((error, c) => {
  if (error instanceof HTTPException) {
    return error.getResponse();
  }

  console.error(error);

  return c.text("Erro interno do servidor.", 500);
});

const server = Bun.serve({ port: readPort(), maxRequestBodySize: MAX_BODY_BYTES, fetch: app.fetch });

// Atrás do proxy, o endereço que importa é o público; a porta interna fica entre parênteses.
const address = publicUrl();

console.log(address === null ? `Nelcota Prompts rodando em ${server.url}` : `Nelcota Prompts no ar em ${address} (porta ${server.port})`);

// No container o Bun é o PID 1, e o Linux ignora SIGTERM no PID 1 sem um handler
// explícito: sem isto o Coolify esperaria o timeout e mataria o processo à força.
let shuttingDown = false;

async function shutdown(signal: string) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  console.log(`${signal} recebido, encerrando…`);
  await server.stop();
  await globalThis.__nelcotaSql?.close({ timeout: 5 });
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
