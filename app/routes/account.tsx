import type { FieldErrors } from "~/shared/lib/action-result";
import { actionReply } from "~/shared/server/action-result.server";
import { changeNameSchema, changePasswordSchema } from "~/features/auth/account-rules";
import { dispatchIntent, type IntentHandler } from "~/shared/server/intent-dispatch.server";
import { clearAttempts, consumeAttempt, tooManyAttemptsMessage } from "~/shared/server/rate-limit.server";
import { currentSessionId, destroyUserSessions, requireUser } from "~/features/auth/server/session.server";
import { type PublicUser, updateUserName, updateUserPassword, verifyPasswordById } from "~/features/auth/server/users.server";
import { parseForm } from "~/shared/server/validation.server";
import type { Route } from "./+types/account";

const WRONG_PASSWORD_LIMIT = 5;
const WINDOW_MS = 15 * 60 * 1000;

type Context = { user: PublicUser; request: Request };
type Extra = { errors: FieldErrors };

const reply = (intent: string, status: number, message: string, errors?: FieldErrors) =>
  actionReply<Extra>(intent, status, message, errors === undefined ? undefined : { errors });

const HANDLERS: Record<"name" | "password", IntentHandler<Context, Extra>> = {
  async name(form, { user }) {
    const parsed = parseForm(changeNameSchema, form);

    if (!parsed.ok) {
      return reply("name", 400, "Revise o nome.", parsed.errors);
    }

    const { name } = parsed.data;

    if (name === user.name) {
      return reply("name", 200, "Nada mudou no nome.");
    }

    await updateUserName(user.id, name);

    return reply("name", 200, "Nome atualizado.");
  },

  async password(form, { user, request }) {
    const parsed = parseForm(changePasswordSchema, form);

    if (!parsed.ok) {
      return reply("password", 400, "Revise os campos.", parsed.errors);
    }

    const { current, next } = parsed.data;
    const limitKey = `account-password:${user.id}`;
    // Conta antes de verificar: pedidos em paralelo não escapam do limite.
    const limit = await consumeAttempt(limitKey, WRONG_PASSWORD_LIMIT, WINDOW_MS);

    if (limit.limited) {
      return reply("password", 429, tooManyAttemptsMessage(limit.retryAfterSeconds));
    }

    if (!(await verifyPasswordById(user.id, current))) {
      return reply("password", 400, "Revise os campos.", { current: "Senha atual incorreta." });
    }

    await clearAttempts(limitKey, { max: WRONG_PASSWORD_LIMIT, windowMs: WINDOW_MS });
    await updateUserPassword(user.id, next);
    await destroyUserSessions(user.id, await currentSessionId(request));

    return reply("password", 200, "Senha alterada. Outros dispositivos foram desconectados.");
  },
};

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);

  return dispatchIntent({ request, handlers: HANDLERS, context: { user, request }, label: "conta" });
}
