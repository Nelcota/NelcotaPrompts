import { AdminPanel } from "~/features/admin/components/admin-panel";
import { ADMIN_HANDLERS, ADMIN_MAX_REQUEST_BYTES } from "~/features/admin/server/admin-actions.server";
import { getAdminStats, listAdminPrompts, listAdminUsers } from "~/features/admin/server/admin.server";
import { ADMIN_TABS, type AdminTab, type AdminTabData } from "~/features/admin/admin-rules";
import { dispatchIntent } from "~/shared/server/intent-dispatch.server";
import { purgeExpiredTrash } from "~/features/prompts/server/prompts.server";
import { requireAdmin } from "~/features/auth/server/session.server";
import { getInviteCode } from "~/features/auth/server/invite.server";
import { SEARCH_MAX } from "~/features/prompts/prompt-rules";
import { readSearch } from "~/shared/server/validation.server";
import type { Route } from "./+types/admin";

export function meta() {
  return [{ title: "Painel admin · Nelcota Prompts" }, { name: "robots", content: "noindex" }];
}

function readTab(url: URL): AdminTab {
  const raw = url.searchParams.get("aba");

  return ADMIN_TABS.find((tab) => tab === raw) ?? "visao";
}

// Cada aba carrega só o que mostra.
async function loadTab(tab: AdminTab, url: URL): Promise<AdminTabData> {
  switch (tab) {
    case "visao":
      return { tab, stats: await getAdminStats() };
    case "usuarios":
      return { tab, users: await listAdminUsers() };
    case "prompts": {
      // A lixeira mostrada já sem o que passou do prazo.
      await purgeExpiredTrash();
      const search = readSearch(url, SEARCH_MAX);
      const [prompts, trash] = await Promise.all([listAdminPrompts(search, false), listAdminPrompts(null, true)]);

      return { tab, search, prompts, trash };
    }
    case "convite":
      return { tab, invite: await getInviteCode() };
    case "marca":
      return { tab };
  }
}

export async function loader({ request }: Route.LoaderArgs) {
  const admin = await requireAdmin(request);
  const url = new URL(request.url);

  return { admin, data: await loadTab(readTab(url), url) };
}

export async function action({ request }: Route.ActionArgs) {
  const admin = await requireAdmin(request);

  return dispatchIntent({
    request,
    handlers: ADMIN_HANDLERS,
    context: { admin, request },
    label: "admin",
    maxBytes: ADMIN_MAX_REQUEST_BYTES,
  });
}

export default function Admin({ loaderData }: Route.ComponentProps) {
  return <AdminPanel admin={loaderData.admin} data={loaderData.data} />;
}
