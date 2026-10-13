import { loadAvatar } from "~/features/profile/server/avatars.server";
import { parseUuid } from "~/shared/lib/ids";
import { requireUser } from "~/features/auth/server/session.server";
import { storedImageResponse } from "~/shared/server/stored-image.server";
import type { Route } from "./+types/avatar";

// Rota de recurso: entrega a foto só para quem está logado (o Nelcota Prompts é privado).
export async function loader({ request, params }: Route.LoaderArgs) {
  await requireUser(request);

  const userId = parseUuid(params.userId);

  if (userId === null) {
    return new Response("Usuário inválido.", { status: 400 });
  }

  const avatar = await loadAvatar(userId);

  if (avatar === null) {
    return new Response("Sem foto.", { status: 404 });
  }

  return storedImageResponse(avatar, request, "private");
}
