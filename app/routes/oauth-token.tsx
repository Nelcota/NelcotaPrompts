import { corsJson, postOnlyLoader } from "~/features/oauth/server/cors.server";
import { exchangeCode, SCOPES } from "~/features/oauth/server/oauth.server";
import { getClientIp } from "~/shared/server/client-ip.server";
import { consumeAttempt, retryAfterHeaders } from "~/shared/server/rate-limit.server";
import type { Route } from "./+types/oauth-token";

// Troca do código de autorização (com PKCE) pelo token de API. Erros no formato do
// OAuth (RFC 6749 §5.2), que os apps de IA entendem.
const ATTEMPTS_PER_WINDOW = 30;
const WINDOW_MS = 15 * 60 * 1000;

const invalidGrant = () => corsJson({ error: "invalid_grant", error_description: "Código inválido, vencido ou já usado." }, 400);

export function loader({ request }: Route.LoaderArgs) {
  return postOnlyLoader(request);
}

export async function action({ request, context }: Route.ActionArgs) {
  const limit = await consumeAttempt(`oauth-token:${getClientIp(request, context)}`, ATTEMPTS_PER_WINDOW, WINDOW_MS);

  if (limit.limited) {
    return corsJson({ error: "slow_down" }, 429, retryAfterHeaders(limit.retryAfterSeconds));
  }

  const form = await request.formData().catch(() => null);

  if (form === null) {
    return corsJson({ error: "invalid_request", error_description: "Envie o corpo como application/x-www-form-urlencoded." }, 400);
  }

  const field = (name: string) => {
    const value = form.get(name);

    return typeof value === "string" ? value : null;
  };

  if (field("grant_type") !== "authorization_code") {
    return corsJson({ error: "unsupported_grant_type" }, 400);
  }

  const code = field("code");
  const clientId = field("client_id");
  const codeVerifier = field("code_verifier");

  if (code === null || clientId === null || codeVerifier === null) {
    return corsJson({ error: "invalid_request", error_description: "Faltam code, client_id ou code_verifier." }, 400);
  }

  const result = await exchangeCode({ code, clientId, redirectUri: field("redirect_uri"), codeVerifier });

  if (!result.ok) {
    return invalidGrant();
  }

  // Sem expires_in: o token vale até ser revogado em "Conectar IA" (ou a conta ser bloqueada).
  return corsJson({
    access_token: result.token,
    token_type: "Bearer",
    scope: result.access === "write" ? `${SCOPES.read} ${SCOPES.write}` : SCOPES.read,
  });
}
