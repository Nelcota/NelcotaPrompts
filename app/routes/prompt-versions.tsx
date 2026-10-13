import { listPromptVersions } from "~/features/prompts/server/prompts.server";
import { requireUser } from "~/features/auth/server/session.server";
import { parseUuid } from "~/shared/lib/ids";
import type { Route } from "./+types/prompt-versions";

// Rota de recurso (só loader): histórico de versões de um prompt. Quem está logado lê
// tudo, então também lê o histórico; restaurar passa pela action da home (só o autor).
export async function loader({ request, params }: Route.LoaderArgs) {
  await requireUser(request);

  const id = parseUuid(params.id);

  if (id === null) {
    return Response.json({ error: "Prompt inválido." }, { status: 400 });
  }

  const versions = await listPromptVersions(id);

  if (versions === null) {
    return Response.json({ error: "Esse prompt não existe mais." }, { status: 404 });
  }

  return Response.json({ versions }, { headers: { "Cache-Control": "private, no-store" } });
}
