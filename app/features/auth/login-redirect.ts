// Voltar para onde a pessoa estava depois de entrar ou criar conta (ex.: a tela de
// autorizar um app de IA). Só caminhos do próprio site.
const PARAM = "voltar";
const BASE = "http://nelcota.invalid";
// O navegador ignora TAB/quebra de linha e trata "\" como "/" ao ler o Location: "/\t/x" ou
// "/\x" viraria "//x" (outro site). Esses caracteres nunca aparecem num caminho legítimo
// (na query vão codificados).
function hasUnsafeChar(path: string): boolean {
  for (const char of path) {
    const code = char.codePointAt(0) ?? 0;

    if (code <= 0x20 || code === 0x7f || char === "\\") {
      return true;
    }
  }

  return false;
}

export function safeRedirectPath(raw: string | null | undefined): string {
  const path = raw ?? "";

  if (!path.startsWith("/") || path.startsWith("//") || hasUnsafeChar(path)) {
    return "/";
  }

  // Confere com o mesmo parser do navegador: tem que continuar no próprio site.
  try {
    return new URL(path, BASE).origin === BASE ? path : "/";
  } catch {
    return "/";
  }
}

// /login ou /cadastro levando o caminho de volta ("/" não precisa ir na URL).
export function withRedirect(page: string, path: string): string {
  return path === "/" ? page : `${page}?${new URLSearchParams({ [PARAM]: path }).toString()}`;
}

export function loginHref(path: string): string {
  return withRedirect("/login", path);
}

export function readRedirectParam(url: URL): string {
  return safeRedirectPath(url.searchParams.get(PARAM));
}

export const REDIRECT_FIELD = PARAM;
