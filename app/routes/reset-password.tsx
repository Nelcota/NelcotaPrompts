import { data, Form, useNavigation } from "react-router";

import { AuthShell, Field, FormError, SubmitButton } from "~/features/auth/components/auth-shell";
import { PASSWORD_MAX, PASSWORD_MIN, resetPasswordSchema } from "~/features/auth/account-rules";
import { getClientIp } from "~/shared/server/client-ip.server";
import { findValidReset, resetPasswordWithToken } from "~/features/auth/server/password-reset.server";
import { consumeAttempt, retryAfterHeaders, tooManyAttemptsMessage } from "~/shared/server/rate-limit.server";
import { createUserSession } from "~/features/auth/server/session.server";
import { parseForm, readForm, UNREADABLE_FORM } from "~/shared/server/validation.server";
import type { Route } from "./+types/reset-password";

const ATTEMPTS_PER_HOUR = 20;
const HOUR_MS = 60 * 60 * 1000;

export function meta() {
  return [{ title: "Nova senha · Nelcota Prompts" }];
}

function readToken(url: URL): string {
  return url.searchParams.get("token")?.trim() ?? "";
}

export async function loader({ request }: Route.LoaderArgs) {
  const token = readToken(new URL(request.url));
  const reset = token === "" ? null : await findValidReset(token);

  if (reset === null) {
    return { valid: false as const, token: "", name: "" };
  }

  return { valid: true as const, token, name: reset.name };
}

export async function action({ request, context }: Route.ActionArgs) {
  const limitKey = `reset-ip:${getClientIp(request, context)}`;
  const limit = await consumeAttempt(limitKey, ATTEMPTS_PER_HOUR, HOUR_MS);

  if (limit.limited) {
    return data(
      { error: tooManyAttemptsMessage(limit.retryAfterSeconds) },
      { status: 429, headers: retryAfterHeaders(limit.retryAfterSeconds) },
    );
  }

  const form = await readForm(request);

  if (form === null) {
    return data({ error: UNREADABLE_FORM }, { status: 400 });
  }

  const parsed = parseForm(resetPasswordSchema, form);

  if (!parsed.ok) {
    return data({ error: parsed.errors.password ?? "Informe a nova senha." }, { status: 400 });
  }

  const { token, password } = parsed.data;

  try {
    const userId = await resetPasswordWithToken(token, password);

    if (userId === null) {
      return data({ error: "Esse link expirou ou já foi usado. Peça um novo." }, { status: 400 });
    }

    return await createUserSession(request, userId, "/");
  } catch (error) {
    console.error("Falha ao redefinir senha:", error);

    return data({ error: "Não foi possível salvar a senha agora. O link continua valendo; tente de novo." }, { status: 500 });
  }
}

export default function ResetPassword({ loaderData, actionData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const pending = navigation.state === "submitting";

  if (!loaderData.valid) {
    return (
      <AuthShell
        title="Link inválido."
        subtitle="Esse link expirou ou já foi usado. Peça um novo a um admin."
        footer={{ text: "Lembrou a senha?", linkLabel: "Entrar", to: "/login" }}
      >
        {null}
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Nova senha"
      subtitle={`Conta de ${loaderData.name}. Após salvar, você já entra.`}
      footer={{ text: "Lembrou a senha?", linkLabel: "Entrar", to: "/login" }}
    >
      <Form method="post" className="space-y-4">
        <FormError message={actionData?.error} />
        <input type="hidden" name="token" value={loaderData.token} />
        <Field
          label="Nova senha"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder={`Pelo menos ${PASSWORD_MIN} caracteres`}
          autoFocus
          minLength={PASSWORD_MIN}
          maxLength={PASSWORD_MAX}
        />
        <SubmitButton pending={pending} label="Salvar e entrar" pendingLabel="Salvando…" />
      </Form>
    </AuthShell>
  );
}
