import { appOrigin, protectedResourceMetadata } from "~/features/oauth/server/oauth.server";
import { corsJson, corsPreflight } from "~/features/oauth/server/cors.server";
import type { Route } from "./+types/oauth-resource";

// /.well-known/oauth-protected-resource (RFC 9728): diz ao app de IA que o /mcp é
// protegido e quem emite os tokens (este mesmo site).
export function loader({ request }: Route.LoaderArgs) {
  if (request.method === "OPTIONS") {
    return corsPreflight();
  }

  return corsJson(protectedResourceMetadata(appOrigin(request)));
}
