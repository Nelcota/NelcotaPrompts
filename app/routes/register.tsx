import { createHash, timingSafeEqual } from "node:crypto";
import { data, Form, redirect, useNavigation } from "react-router";

import { AuthShell, Field, FormError, SubmitButton } from "~/features/auth/components/auth-shell";
import { NAME_MAX, PASSWORD_MAX, PASSWORD_MIN, registerSchema } from "~/features/auth/account-rules";
import { getClientIp } from "~/shared/server/client-ip.server";
import { consumeAttempt, retryAfterHeaders, tooManyAttemptsMessage } from "~/shared/server/rate-limit.server";
import { createUserSession, getOptionalUser } from "~/features/auth/server/session.server";
import { getInviteCode, isInviteRequired } from "~/features/auth/server/invite.server";
import { createUser } from "~/features/auth/server/users.server";
import { type FieldErrors, parseForm, readForm, readText, UNREADABLE_FORM } from "~/shared/server/validation.server";
import type { Route } from "./+types/register";

const WINDOW_MS = 60 * 60 * 1000;
const MAX_ATTEMPTS_PER_IP = 10;

export function meta() {
  return [{ title: "Criar conta · Nelcota Prompts" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getOptionalUser(request);

  if (user !== null) {
    throw redirect("/");
  }

  return { inviteRequired: await isInviteRequired() };
}

// O código vem do painel admin (ou, sem ele, da variável INVITE_CODE). Com o convite
// ligado e nenhum código configurado, o cadastro fica fechado (nenhum convite confere).
async function sameInvite(received: string): Promise<boolean> {
  const { code } = await getInviteCode();

  if (code === null) {
    return false;
  }

  const expected = createHash("sha256").update(code).digest();
  const actual = createHash("sha256").update(received).digest();

  return timingSafeEqual(expected, actual);
}

export async function action({ request, context }: Route.ActionArgs) {
  // Limita o chute de códigos de convite (e contas em massa): poucas tentativas por IP por hora.
  const ipKey = `register-ip:${getClientIp(request, context)}`;
  const limit = await consumeAttempt(ipKey, MAX_ATTEMPTS_PER_IP, WINDOW_MS);

  if (limit.limited) {
    return data(
      {
        errors: { form: tooManyAttemptsMessage(limit.retryAfterSeconds) } satisfies FieldErrors,
        values: { name: "", email: "" },
      },
      { status: 429, headers: retryAfterHeaders(limit.retryAfterSeconds) },
    );
  }

  const form = await readForm(request);

  if (form === null) {
    return data({ errors: { form: UNREADABLE_FORM } satisfies FieldErrors, values: { name: "", email: "" } }, { status: 400 });
  }

  const parsed = parseForm(registerSchema, form);
  const values = { name: readText(form, "name") ?? "", email: readText(form, "email") ?? "" };
  const errors: FieldErrors = parsed.ok ? {} : { ...parsed.errors };

  // O convite (quando o painel exige) é conferido mesmo com outros erros, para a pessoa
  // ver tudo de uma vez. Se ele foi ligado com a página aberta, o loader recarrega e o
  // campo aparece junto com o erro.
  const invite = readText(form, "invite");

  if ((await isInviteRequired()) && (invite === null || !(await sameInvite(invite)))) {
    errors.invite = "Código de convite inválido.";
  }

  if (!parsed.ok || Object.keys(errors).length > 0) {
    return data({ errors, values }, { status: 400 });
  }

  const { name, email, password } = parsed.data;

  try {
    const result = await createUser({ name, email, password });

    if (!result.ok) {
      return data({ errors: { email: "Já existe uma conta com esse email." } satisfies FieldErrors, values }, { status: 409 });
    }

    return await createUserSession(request, result.user.id, "/");
  } catch (error) {
    console.error("Falha no cadastro:", error);

    return data(
      { errors: { form: "Não foi possível criar a conta agora. Tente de novo em instantes." } satisfies FieldErrors, values },
      { status: 500 },
    );
  }
}

function formMessage(errors: FieldErrors): string | undefined {
  if (errors.form !== undefined) {
    return errors.form;
  }

  if (Object.keys(errors).length > 0) {
    return "Revise os campos destacados.";
  }

  return undefined;
}

export default function Register({ loaderData, actionData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const pending = navigation.state === "submitting";
  const errors: FieldErrors = actionData?.errors ?? {};

  return (
    <AuthShell
      title="Criar conta"
      subtitle={loaderData.inviteRequired ? "Requer código de convite." : "Leva menos de um minuto."}
      footer={{ text: "Já tem conta?", linkLabel: "Entrar", to: "/login" }}
    >
      <Form method="post" className="space-y-4">
        <FormError message={formMessage(errors)} />
        <Field
          label="Nome"
          name="name"
          autoComplete="name"
          placeholder="Seu nome"
          maxLength={NAME_MAX}
          defaultValue={actionData?.values.name}
          error={errors.name}
          autoFocus
        />
        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="username"
          placeholder="voce@exemplo.com"
          defaultValue={actionData?.values.email}
          error={errors.email}
        />
        <Field
          label="Senha"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder={`Pelo menos ${PASSWORD_MIN} caracteres`}
          minLength={PASSWORD_MIN}
          maxLength={PASSWORD_MAX}
          error={errors.password}
        />
        {loaderData.inviteRequired ? (
          <Field label="Código de convite" name="invite" autoComplete="off" placeholder="O código que você recebeu" error={errors.invite} />
        ) : null}
        <SubmitButton pending={pending} label="Criar conta" pendingLabel="Criando…" />
      </Form>
    </AuthShell>
  );
}
