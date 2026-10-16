import { appOrigin, authorizationServerMetadata } from "~/features/oauth/server/oauth.server";
import { corsJson, corsPreflight } from "~/features/oauth/server/cors.server";
import type { Route } from "./+types/oauth-metadata";

// /.well-known/oauth-authorization-server (RFC 8414): onde o app de IA descobre como
// registrar-se, pedir autorização e trocar o código.
export function loader({ request }: Route.LoaderArgs) {
  return corsJson(authorizationServerMetadata(appOrigin(request)));
}

export function action() {
  return corsPreflight();
}
