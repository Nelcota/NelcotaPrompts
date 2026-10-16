import { useEffect } from "react";
import { redirect, useFetcher, useLocation } from "react-router";

import { AuthShell, FormError, SubmitButton } from "~/features/auth/components/auth-shell";
import { getOptionalUser } from "~/features/auth/server/session.server";
import { checkAuthorizeRequest, createAuthorizationCode, redirectBack } from "~/features/oauth/server/oauth.server";
import { loginHref } from "~/features/auth/login-redirect";
import { consumeAttempt, tooManyAttemptsMessage } from "~/shared/server/rate-limit.server";
import { readForm, readText } from "~/shared/server/validation.server";
import { buttonClass } from "~/shared/ui/styles";
import type { Route } from "./+types/oauth-authorize";

// Tela de "Permitir": o app de IA manda a pessoa para cá; ela entra (se ainda não entrou),
// escolhe o acesso e volta para o app com o código de autorização.

// Cada "Permitir" gera um código: um limite por pessoa segura scripts com a sessão dela.
const GRANTS_PER_WINDOW = 30;
const WINDOW_MS = 15 * 60 * 1000;

export function meta() {
  return [{ title: "Conectar app de IA · Nelcota Prompts" }, { name: "robots", content: "noindex" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);

  if ((await getOptionalUser(request)) === null) {
    throw redirect(loginHref(`${url.pathname}${url.search}`));
  }

  const check = await checkAuthorizeRequest(url.searchParams);

  if (!check.ok) {
    return { ok: false as const, message: check.message };
  }

  const { clientName, redirectUri, wantsWrite } = check.request;
  const target = new URL(redirectUri);

  return { ok: true as const, clientName, wantsWrite, returnTo: target.protocol === "http:" || target.protocol === "https:" ? target.host : target.protocol.slice(0, -1) };
}

// A resposta traz o endereço de volta; o navegador navega por script (o CSP form-action
// 'self' barraria um redirecionamento de formulário para fora do site).
export async function action({ request }: Route.ActionArgs) {
  const url = new URL(request.url);
  const user = await getOptionalUser(request);

  // Sessão que venceu com a tela aberta: entra de novo e volta para cá (não para o mural).
  if (user === null) {
    return { redirectTo: loginHref(`${url.pathname}${url.search}`), error: null };
  }

  const check = await checkAuthorizeRequest(url.searchParams);

  if (!check.ok) {
    return { redirectTo: null, error: check.message };
  }

  const limit = await consumeAttempt(`oauth-grant:${user.id}`, GRANTS_PER_WINDOW, WINDOW_MS);

  if (limit.limited) {
    return { redirectTo: null, error: tooManyAttemptsMessage(limit.retryAfterSeconds) };
  }

  const form = await readForm(request);
  const decision = form === null ? null : readText(form, "decision");
  const access = form === null ? null : readText(form, "access");
  const { redirectUri, state } = check.request;

  if (decision === "deny" || (access !== "read" && access !== "write")) {
    return { redirectTo: redirectBack(redirectUri, { error: "access_denied" }, state), error: null };
  }

  const code = await createAuthorizationCode(check.request, user.id, access);

  return { redirectTo: redirectBack(redirectUri, { code }, state), error: null };
}

export default function OAuthAuthorize({ loaderData }: Route.ComponentProps) {
  const fetcher = useFetcher<typeof action>();
  const location = useLocation();
  const redirectTo = fetcher.data?.redirectTo ?? null;
  const pending = fetcher.state !== "idle" || redirectTo !== null;

  useEffect(() => {
    if (redirectTo !== null) {
      window.location.assign(redirectTo);
    }
  }, [redirectTo]);

  if (!loaderData.ok) {
    return (
      <AuthShell title="Não deu para conectar" subtitle={loaderData.message}>
        <a href="/" className={buttonClass("outline")}>
          Voltar ao mural
        </a>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={`Conectar ${loaderData.clientName}`} subtitle="Esse app de IA quer usar o Nelcota Prompts em seu nome.">
      <fetcher.Form method="post" action={`${location.pathname}${location.search}`} className="space-y-5">
        <FormError message={fetcher.data?.error ?? undefined} />
        <fieldset className="space-y-2">
          <legend className="mb-2 text-base font-medium">O que o app pode fazer</legend>
          <label className="flex cursor-pointer gap-3 rounded-2xl border border-line p-4 has-checked:border-ink/40 has-checked:bg-ink/5">
            <input type="radio" name="access" value="write" defaultChecked={loaderData.wantsWrite} className="mt-1 accent-accent" />
            <span>
              <span className="block font-medium">Tudo</span>
              <span className="block text-sm text-muted">Buscar, ler e puxar prompts; criar, editar e apagar os seus.</span>
            </span>
          </label>
          <label className="flex cursor-pointer gap-3 rounded-2xl border border-line p-4 has-checked:border-ink/40 has-checked:bg-ink/5">
            <input type="radio" name="access" value="read" defaultChecked={!loaderData.wantsWrite} className="mt-1 accent-accent" />
            <span>
              <span className="block font-medium">Só leitura</span>
              <span className="block text-sm text-muted">Buscar, ler e puxar prompts. Não altera nada.</span>
            </span>
          </label>
        </fieldset>
        <p className="text-sm text-muted">
          Depois você volta para <span className="font-mono text-ink">{loaderData.returnTo}</span>. Dá para desconectar quando quiser em Conectar IA.
        </p>
        <SubmitButton pending={pending} label="Permitir" pendingLabel="Conectando…" />
        <button type="submit" name="decision" value="deny" disabled={pending} className={buttonClass("ghost", "md", "w-full")}>
          Cancelar
        </button>
      </fetcher.Form>
    </AuthShell>
  );
}
