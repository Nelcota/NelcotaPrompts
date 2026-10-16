// Voltar para onde a pessoa estava depois de entrar (ex.: a tela de autorizar um app de
// IA). Só caminhos do próprio site: "//outro.com" ou "/\outro.com" virariam
// redirecionamento aberto.
const PARAM = "voltar";

export function safeRedirectPath(raw: string | null | undefined): string {
  const path = raw?.trim() ?? "";

  return path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/\\") ? path : "/";
}

export function loginHref(path: string): string {
  return `/login?${new URLSearchParams({ [PARAM]: path }).toString()}`;
}

export function readRedirectParam(url: URL): string {
  return safeRedirectPath(url.searchParams.get(PARAM));
}

export const REDIRECT_FIELD = PARAM;
