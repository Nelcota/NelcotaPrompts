import { isbot } from "isbot";
import { renderToReadableStream } from "react-dom/server";
import type { EntryContext } from "react-router";
import { ServerRouter } from "react-router";

// Entry de servidor com Web Streams (suportado nativamente pelo Bun), sem @react-router/node.
export const streamTimeout = 5_000;

function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    // style inline: atributos style do React e o <style> que o sonner injeta.
    "style-src 'self' 'unsafe-inline'",
    // blob: são as artes dos cards, rasterizadas no navegador.
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
) {
  if (request.method.toUpperCase() === "HEAD") {
    return new Response(null, { status: responseStatusCode, headers: responseHeaders });
  }

  let status = responseStatusCode;
  let shellRendered = false;
  // Nonce por requisição: só os <script> inline do React Router recebem permissão no CSP.
  // Só em produção, onde o CSP existe: em dev o atributo nonce só gera aviso de hidratação.
  const nonce = import.meta.env.PROD ? crypto.randomUUID().replace(/-/g, "") : undefined;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), streamTimeout + 1000);
  const clear = () => clearTimeout(timeoutId);
  const body = await renderToReadableStream(<ServerRouter context={routerContext} url={request.url} nonce={nonce} />, {
    nonce,
    signal: controller.signal,
    onError(error: unknown) {
      status = 500;

      if (shellRendered) {
        console.error(error);
      }
    },
  }).catch((error: unknown) => {
    clear();

    throw error;
  });
  shellRendered = true;

  const userAgent = request.headers.get("user-agent");
  const waitForAll = (userAgent !== null && isbot(userAgent)) || routerContext.isSpaMode;

  if (waitForAll) {
    await body.allReady;
  }

  // then(clear, clear) em vez de finally: finally repassaria a rejeição sem handler.
  body.allReady.then(clear, clear);
  responseHeaders.set("Content-Type", "text/html");

  // Em dev o Vite injeta scripts inline e usa websocket de HMR, então o CSP fica só em produção.
  if (nonce !== undefined) {
    responseHeaders.set("Content-Security-Policy", buildCsp(nonce));
  }

  return new Response(body, { headers: responseHeaders, status });
}
