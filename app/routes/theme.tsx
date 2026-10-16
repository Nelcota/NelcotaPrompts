import { data, redirect } from "react-router";

import { safeRedirectPath } from "~/features/auth/login-redirect";

import { serializeTheme } from "~/features/theme/server/theme.server";
import { readForm } from "~/shared/server/validation.server";
import type { Route } from "./+types/theme";

// Clique antes de o JavaScript carregar é um envio de formulário comum (o navegador espera
// uma página, não JSON): volta para a página de onde veio, já com o tema novo.
function backToPage(request: Request): string {
  const referer = request.headers.get("referer");

  try {
    const url = new URL(referer ?? "/", request.url);

    return url.host === new URL(request.url).host ? safeRedirectPath(`${url.pathname}${url.search}`) : "/";
  } catch {
    return "/";
  }
}

export async function action({ request }: Route.ActionArgs) {
  const isDocument = request.headers.get("sec-fetch-dest") === "document";

  const form = await readForm(request);

  if (form === null) {
    return data({ ok: false }, { status: 400 });
  }

  const theme = form.get("theme");

  if (theme !== "dark" && theme !== "light") {
    return data({ ok: false }, { status: 400 });
  }

  const headers = { "Set-Cookie": await serializeTheme(theme) };

  return isDocument ? redirect(backToPage(request), { headers }) : data({ ok: true }, { headers });
}
