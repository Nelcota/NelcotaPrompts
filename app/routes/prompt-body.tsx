import { getPromptBody } from "~/features/prompts/server/prompts.server";
import { requireUser } from "~/features/auth/server/session.server";
import { parseUuid } from "~/shared/lib/ids";
import type { Route } from "./+types/prompt-body";

// Rota de recurso (só loader): devolve o corpo completo de um prompt para quem está logado.
export async function loader({ request, params }: Route.LoaderArgs) {
  await requireUser(request);

  const id = parseUuid(params.id);

  if (id === null) {
    return Response.json({ error: "Prompt inválido." }, { status: 400 });
  }

  const body = await getPromptBody(id);

  if (body === null) {
    return Response.json({ error: "Esse prompt não existe mais." }, { status: 404 });
  }

  return Response.json({ body }, { headers: { "Cache-Control": "private, no-store" } });
}
