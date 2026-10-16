import { createTokenSchema, TOKENS_MAX } from "~/features/api-tokens/api-token-rules";
import { createApiToken, listApiTokens, revokeApiToken } from "~/features/api-tokens/server/api-tokens.server";
import { requireUser } from "~/features/auth/server/session.server";
import type { PublicUser } from "~/features/auth/server/users.server";
import { ConnectPage } from "~/features/connect/components/connect-page";
import { appOrigin } from "~/features/oauth/server/oauth.server";
import type { FieldErrors } from "~/shared/lib/action-result";
import { actionReply } from "~/shared/server/action-result.server";
import { dispatchIntent, type IntentHandler } from "~/shared/server/intent-dispatch.server";
import { parseForm, readUuid } from "~/shared/server/validation.server";
import type { Route } from "./+types/connect";

// "Conectar IA": como ligar cada app de IA ao servidor MCP, os apps já conectados e,
// para quem precisa, tokens criados à mão.

export function meta() {
  return [{ title: "Conectar IA · Nelcota Prompts" }, { name: "robots", content: "noindex" }];
}

type Extra = { errors: FieldErrors; token: string };

const HANDLERS: Record<"createToken" | "revokeToken", IntentHandler<PublicUser, Extra>> = {
  // O token em texto sai só nesta resposta (no banco fica o hash).
  async createToken(form, user) {
    const parsed = parseForm(createTokenSchema, form);

    if (!parsed.ok) {
      return actionReply<Extra>("createToken", 400, "Revise os campos do token.", { errors: parsed.errors });
    }

    const created = await createApiToken(user.id, parsed.data.name, parsed.data.access);

    if (!created.ok) {
      return actionReply<Extra>("createToken", 400, `Você já tem ${TOKENS_MAX} tokens. Revogue um antes de criar outro.`);
    }

    return actionReply<Extra>("createToken", 200, "Token criado. Copie agora: ele não aparece de novo.", { token: created.token });
  },

  async revokeToken(form, user) {
    const id = readUuid(form, "id");

    if (id === null || !(await revokeApiToken(user.id, id))) {
      return actionReply<Extra>("revokeToken", 404, "Esse acesso não existe mais.");
    }

    return actionReply<Extra>("revokeToken", 200, "Acesso removido.");
  },
};

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request, { returnHere: true });

  return { user, tokens: await listApiTokens(user.id), origin: appOrigin(request) };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);

  return dispatchIntent({ request, handlers: HANDLERS, context: user, label: "conectar" });
}

export default function Connect({ loaderData }: Route.ComponentProps) {
  return <ConnectPage user={loaderData.user} tokens={loaderData.tokens} origin={loaderData.origin} />;
}
