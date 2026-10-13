import { data, Form, Link, redirect, useNavigation } from "react-router";

import { AuthShell, Field, FormError, SubmitButton } from "~/features/auth/components/auth-shell";
import { getClientIp } from "~/shared/server/client-ip.server";
import { clearAttempts, consumeAttempt, releaseAttempt, retryAfterHeaders, tooManyAttemptsMessage } from "~/shared/server/rate-limit.server";
import { loginSchema } from "~/features/auth/account-rules";
import { createUserSession, getOptionalUser } from "~/features/auth/server/session.server";
import { verifyLogin } from "~/features/auth/server/users.server";
import { parseForm, readForm, readText, UNREADABLE_FORM } from "~/shared/server/validation.server";
import type { Route } from "./+types/login";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES_PER_EMAIL = 5;
const MAX_ATTEMPTS_PER_IP = 30;

export function meta() {
  return [{ title: "Entrar · Nelcota Prompts" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getOptionalUser(request);

  if (user !== null) {
    throw redirect("/");
  }

  return null;
}

function tooMany(retryAfterSeconds: number, email: string) {
  return data(
    { error: tooManyAttemptsMessage(retryAfterSeconds), email },
    { status: 429, headers: retryAfterHeaders(retryAfterSeconds) },
  );
}

const GENERIC_ERROR = "Não foi possível entrar agora. Tente de novo em instantes.";

export async function action({ request, context }: Route.ActionArgs) {
  const clientIp = getClientIp(request, context);
  const ipKey = `login-ip:${clientIp}`;
  const ipStatus = await consumeAttempt(ipKey, MAX_ATTEMPTS_PER_IP, WINDOW_MS);

  if (ipStatus.limited) {
    return tooMany(ipStatus.retryAfterSeconds, "");
  }

  const form = await readForm(request);

  if (form === null) {
    return data({ error: UNREADABLE_FORM, email: "" }, { status: 400 });
  }

  const parsed = parseForm(loginSchema, form);

  if (!parsed.ok) {
    return data({ error: "Informe um email válido e sua senha.", email: readText(form, "email") ?? "" }, { status: 400 });
  }

  const { email, password } = parsed.data;

  // Por email + IP: quem erra a senha de outra pessoa não consegue bloquear o acesso dela
  // de outro lugar. A tentativa conta ANTES de conferir a senha, então requisições em
  // paralelo não passam todas pelo limite; um acerto zera o contador.
  const emailKey = `login-email:${email}:${clientIp}`;
  const emailStatus = await consumeAttempt(emailKey, MAX_FAILURES_PER_EMAIL, WINDOW_MS);

  if (emailStatus.limited) {
    return tooMany(emailStatus.retryAfterSeconds, email);
  }

  try {
    const user = await verifyLogin(email, password);

    if (user === null) {
      return data({ error: "Email ou senha incorretos.", email }, { status: 401 });
    }

    // Acerto: zera o limite do email e devolve a tentativa do IP (só erros gastam o limite
    // do IP, senão um escritório inteiro atrás do mesmo NAT se bloquearia logando).
    await clearAttempts(emailKey, { max: MAX_FAILURES_PER_EMAIL, windowMs: WINDOW_MS });
    await releaseAttempt(ipKey, { max: MAX_ATTEMPTS_PER_IP, windowMs: WINDOW_MS });

    return await createUserSession(request, user.id, "/");
  } catch (error) {
    console.error("Falha no login:", error);

    return data({ error: GENERIC_ERROR, email }, { status: 500 });
  }
}

export default function Login({ actionData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const pending = navigation.state === "submitting";

  return (
    <AuthShell
      title="Entrar"
      subtitle="Acesse a biblioteca de prompts."
      footer={{ text: "Recebeu um convite?", linkLabel: "Criar conta", to: "/cadastro" }}
    >
      <Form method="post" className="space-y-4">
        <FormError message={actionData?.error} />
        {/* "username" (e não "email"): é o que os gerenciadores de senha procuram para
            preencher email e senha juntos. */}
        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="username"
          placeholder="voce@exemplo.com"
          defaultValue={actionData?.email}
          autoFocus
        />
        <Field
          label="Senha"
          name="password"
          type="password"
          autoComplete="current-password"
          aside={
            <Link
              to="/esqueci-senha"
              className="text-sm font-medium text-ink/80 underline-offset-4 hover:text-ink hover:underline focus-visible:underline focus-visible:outline-none"
            >
              Esqueci a senha
            </Link>
          }
        />
        <SubmitButton pending={pending} label="Entrar" pendingLabel="Entrando…" />
      </Form>
    </AuthShell>
  );
}
