import { corsJson, postOnlyLoader } from "~/features/oauth/server/cors.server";
import { registerClient } from "~/features/oauth/server/oauth.server";
import { getClientIp } from "~/shared/server/client-ip.server";
import { consumeAttempt, retryAfterHeaders } from "~/shared/server/rate-limit.server";
import type { Route } from "./+types/oauth-register";

// Registro dinâmico de cliente (RFC 7591): o app de IA se cadastra sozinho antes de pedir
// autorização. Não dá acesso a nada; quem decide é a pessoa, na tela de autorizar.
const REGISTRATIONS_PER_HOUR = 20;
const HOUR_MS = 60 * 60 * 1000;

export function loader({ request }: Route.LoaderArgs) {
  return postOnlyLoader(request);
}

export async function action({ request, context }: Route.ActionArgs) {
  const limit = await consumeAttempt(`oauth-register:${getClientIp(request, context)}`, REGISTRATIONS_PER_HOUR, HOUR_MS);

  if (limit.limited) {
    return corsJson({ error: "slow_down", error_description: "Muitos registros. Tente mais tarde." }, 429, retryAfterHeaders(limit.retryAfterSeconds));
  }

  const body: unknown = await request.json().catch(() => null);

  if (typeof body !== "object" || body === null) {
    return corsJson({ error: "invalid_client_metadata", error_description: "Envie os dados do cliente em JSON." }, 400);
  }

  const input = body as Record<string, unknown>;
  const result = await registerClient({ name: input.client_name, redirectUris: input.redirect_uris });

  if (!result.ok) {
    return corsJson({ error: "invalid_redirect_uri", error_description: result.message }, 400);
  }

  return corsJson(
    {
      client_id: result.clientId,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_name: result.name,
      redirect_uris: result.redirectUris,
      grant_types: ["authorization_code"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    },
    201,
  );
}
