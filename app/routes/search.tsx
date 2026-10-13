import { requireUser } from "~/features/auth/server/session.server";
import { SEARCH_MAX } from "~/features/prompts/prompt-rules";
import { listPrompts } from "~/features/prompts/server/prompts.server";
import { readSearch } from "~/shared/server/validation.server";
import type { Route } from "./+types/search";

const RESULTS = 8;

// Rota de recurso (só loader): resultados da command palette (Ctrl+K). Busca no mural
// inteiro, não só nos prompts que já estão na página.
export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const search = readSearch(new URL(request.url), SEARCH_MAX);
  const { prompts } = await listPrompts(user.id, { search, tag: null, authorId: null, favoritesOnly: false, sort: "recent" }, RESULTS);

  return Response.json({ prompts }, { headers: { "Cache-Control": "private, no-store" } });
}
