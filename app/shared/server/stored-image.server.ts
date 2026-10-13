// Imagens guardadas no banco (fotos de perfil, logo): formato comum, URL com versão e a
// resposta HTTP que entrega o arquivo.

export type StoredImage = { contentType: string; data: Uint8Array; updatedAt: Date };

const ONE_YEAR = 60 * 60 * 24 * 365;

// A versão (updated_at em ms) entra na URL: com ela o navegador pode guardar a imagem
// por um ano, e uma imagem nova vira uma URL nova.
export function versionedUrl(path: string, version: Date | null): string | null {
  return version === null ? null : `${path}?v=${version.getTime()}`;
}

// scope "private": só o navegador de quem está logado guarda; "public": proxies também.
export function storedImageResponse(image: StoredImage, request: Request, scope: "private" | "public"): Response {
  const version = new URL(request.url).searchParams.get("v");
  const isCurrent = version !== null && version === String(image.updatedAt.getTime());
  // Cópia para um ArrayBuffer próprio: o Uint8Array do driver pode apontar para um buffer maior.
  const body = new Uint8Array(image.data.byteLength);
  body.set(image.data);

  return new Response(body, {
    headers: {
      "Content-Type": image.contentType,
      "Content-Length": String(body.byteLength),
      // Com a versão certa na URL a imagem nunca muda, então pode ficar em cache por um ano.
      "Cache-Control": isCurrent ? `${scope}, max-age=${ONE_YEAR}, immutable` : `${scope}, no-cache`,
      "Content-Disposition": "inline",
      // Defesa extra: mesmo aberta direto, a resposta não executa nada.
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
