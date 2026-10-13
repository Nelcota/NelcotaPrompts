import { data, Form, useNavigation } from "react-router";

import { AuthShell, Field, FormError, SubmitButton } from "~/features/auth/components/auth-shell";
import { forgotPasswordSchema } from "~/features/auth/account-rules";
import { createResetLink } from "~/features/auth/server/password-reset.server";
import { resetPasswordEmail } from "~/features/auth/server/reset-email.server";
import { findActiveUserByEmail } from "~/features/auth/server/users.server";
import { getClientIp } from "~/shared/server/client-ip.server";
import { emailBaseUrl, isEmailEnabled, sendEmail } from "~/shared/server/email.server";
import { consumeAttempt, retryAfterHeaders, tooManyAttemptsMessage } from "~/shared/server/rate-limit.server";
import { parseForm, readForm, readText, UNREADABLE_FORM } from "~/shared/server/validation.server";
import type { Route } from "./+types/forgot-password";

const HOUR_MS = 60 * 60 * 1000;
const ATTEMPTS_PER_IP = 10;
// Por email: segura quem tenta lotar a caixa de alguém com links.
const EMAILS_PER_ADDRESS = 3;

export function meta() {
  return [{ title: "Esqueci minha senha · Nelcota Prompts" }];
}

export function loader() {
  return { emailEnabled: isEmailEnabled() };
}

// Gera o link e envia por email. Roda sem a requisição esperar: a resposta sai igual
// (e no mesmo tempo) exista a conta ou não.
async function sendResetEmail(email: string) {
  const user = await findActiveUserByEmail(email);
  const baseUrl = emailBaseUrl();

  if (user === null || baseUrl === null) {
    return;
  }

  const path = await createResetLink(user.id);

  if (path !== null) {
    await sendEmail(resetPasswordEmail({ to: user.email, name: user.name, link: `${baseUrl}${path}` }));
  }
}

export async function action({ request, context }: Route.ActionArgs) {
  if (!isEmailEnabled()) {
    return data({ error: "O envio de email não está configurado.", sent: false, email: "" }, { status: 404 });
  }

  const ipLimit = await consumeAttempt(`forgot-ip:${getClientIp(request, context)}`, ATTEMPTS_PER_IP, HOUR_MS);

  if (ipLimit.limited) {
    return data(
      { error: tooManyAttemptsMessage(ipLimit.retryAfterSeconds), sent: false, email: "" },
      { status: 429, headers: retryAfterHeaders(ipLimit.retryAfterSeconds) },
    );
  }

  const form = await readForm(request);

  if (form === null) {
    return data({ error: UNREADABLE_FORM, sent: false, email: "" }, { status: 400 });
  }

  const parsed = parseForm(forgotPasswordSchema, form);

  if (!parsed.ok) {
    return data({ error: parsed.errors.email ?? "Informe um email válido.", sent: false, email: readText(form, "email") ?? "" }, { status: 400 });
  }

  const { email } = parsed.data;
  const addressLimit = await consumeAttempt(`forgot-email:${email}`, EMAILS_PER_ADDRESS, HOUR_MS);

  // Passou do limite do endereço: responde igual, só não envia de novo.
  if (!addressLimit.limited) {
    void sendResetEmail(email).catch((error: unknown) => console.error("Falha no esqueci minha senha:", error));
  }

  return { error: undefined, sent: true, email };
}

function SentNotice({ email }: { email: string }) {
  return (
    <div className="space-y-3 rounded-3xl border border-line bg-surface/70 p-5 text-base">
      <p>
        Se existir uma conta com <strong className="font-semibold break-all">{email}</strong>, o link para criar uma nova senha chega em
        instantes.
      </p>
      <p className="text-sm text-muted">Confira também o spam. O link vale por 1 hora e funciona uma única vez.</p>
    </div>
  );
}

// Sem envio de email configurado: quem administra o Nelcota Prompts gera o link.
function AdminNotice() {
  return (
    <div className="space-y-4 rounded-3xl border border-line bg-surface/70 p-5 text-base">
      <p>Peça a um admin: ele gera um link de uso único no painel (Usuários) ou no servidor com</p>
      <pre className="overflow-x-auto rounded-2xl bg-canvas px-4 py-3 font-mono text-sm">bun run reset-link seu@email.com</pre>
      <p className="text-sm text-muted">O link vale por 1 hora e funciona uma única vez.</p>
    </div>
  );
}

export default function ForgotPassword({ loaderData, actionData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const pending = navigation.state === "submitting";

  return (
    <AuthShell
      title="Redefinir senha"
      subtitle={loaderData.emailEnabled ? "Enviamos um link para o seu email." : "Um admin gera um link de uso único."}
      footer={{ text: "Lembrou?", linkLabel: "Entrar", to: "/login" }}
    >
      {!loaderData.emailEnabled ? (
        <AdminNotice />
      ) : actionData?.sent === true ? (
        <SentNotice email={actionData.email} />
      ) : (
        <Form method="post" className="space-y-4">
          <FormError message={actionData?.error} />
          <Field
            label="Email"
            name="email"
            type="email"
            autoComplete="username"
            placeholder="voce@exemplo.com"
            defaultValue={actionData?.email}
            autoFocus
          />
          <SubmitButton pending={pending} label="Enviar link" pendingLabel="Enviando…" />
        </Form>
      )}
    </AuthShell>
  );
}
