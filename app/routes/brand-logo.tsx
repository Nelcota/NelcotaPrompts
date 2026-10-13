import { loadLogo } from "~/features/brand/server/brand.server";
import { storedImageResponse } from "~/shared/server/stored-image.server";
import type { Route } from "./+types/brand-logo";

// Rota de recurso pública: a logo aparece também na tela de login, antes de entrar.
export async function loader({ request }: Route.LoaderArgs) {
  const logo = await loadLogo();

  if (logo === null) {
    return new Response("Sem logo.", { status: 404 });
  }

  return storedImageResponse(logo, request, "public");
}
