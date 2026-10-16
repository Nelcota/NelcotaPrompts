import { ArrowLeft } from "lucide-react";
import { Link } from "react-router";

import type { AdminTab, AdminTabData } from "~/features/admin/admin-rules";
import type { SessionUser } from "~/features/auth/types";
import { Avatar } from "~/shared/ui/avatar";
import { BrandWordmark } from "~/features/brand/components/brand-logo";
import { BrandTab } from "./brand-tab";
import { InviteTab } from "./invite-tab";
import { OverviewTab } from "./overview-tab";
import { PromptsTab } from "./prompts-tab";
import { UsersTab } from "./users-tab";

// short: rótulo no celular, para as cinco abas caberem numa linha de 360px.
const TAB_LABELS: Record<AdminTab, { full: string; short?: string }> = {
  visao: { full: "Visão geral", short: "Geral" },
  usuarios: { full: "Usuários" },
  prompts: { full: "Prompts" },
  convite: { full: "Convite" },
  marca: { full: "Marca" },
};

function TabLabel({ full, short }: { full: string; short?: string }) {
  if (short === undefined) {
    return full;
  }

  return (
    <>
      <span className="sm:hidden">{short}</span>
      <span className="hidden sm:inline">{full}</span>
    </>
  );
}

function TabContent({ data, adminId }: { data: AdminTabData; adminId: string }) {
  switch (data.tab) {
    case "visao":
      return <OverviewTab stats={data.stats} />;
    case "usuarios":
      return <UsersTab users={data.users} adminId={adminId} />;
    case "prompts":
      return <PromptsTab prompts={data.prompts} trash={data.trash} trashTotal={data.trashTotal} search={data.search} />;
    case "convite":
      return <InviteTab invite={data.invite} required={data.inviteRequired} />;
    case "marca":
      return <BrandTab />;
  }
}

// Página do painel: cabeçalho, abas (links ?aba=) e o conteúdo da aba atual.
export function AdminPanel({ admin, data }: { admin: SessionUser; data: AdminTabData }) {
  return (
    <div className="min-h-dvh">
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-4 sm:px-6">
          <Link to="/" className="font-display inline-flex shrink-0 items-center gap-2.5 text-2xl font-light tracking-tight whitespace-nowrap">
            <BrandWordmark logoClassName="h-8" hideTextOnMobile />
          </Link>
          <span className="rounded-md border border-line px-1.5 py-0.5 font-mono text-xs text-muted">admin</span>
          <Link
            to="/"
            className="ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-muted transition hover:bg-ink/5 hover:text-ink"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Voltar ao mural
          </Link>
          <Avatar name={admin.name} url={admin.avatarUrl} sizeClassName="size-8" fallbackClassName="bg-ink text-sm text-canvas" />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <h1 className="font-display text-4xl font-light tracking-tight">Painel admin</h1>
        <nav aria-label="Seções do painel" className="no-scrollbar mt-5 flex gap-0.5 overflow-x-auto border-b border-line sm:gap-1">
          {(Object.keys(TAB_LABELS) as AdminTab[]).map((key) => (
            <Link
              key={key}
              to={key === "visao" ? "/admin" : `/admin?aba=${key}`}
              aria-current={key === data.tab ? "page" : undefined}
              // Se a tela for estreita demais e a barra rolar, a aba aberta fica à vista.
              ref={key === data.tab ? (link) => link?.scrollIntoView({ block: "nearest", inline: "nearest" }) : undefined}
              className="-mb-px shrink-0 border-b-2 border-transparent px-2 py-2 sm:px-3 text-sm font-medium text-muted transition hover:text-ink aria-[current=page]:border-ink aria-[current=page]:text-ink"
            >
              <TabLabel {...TAB_LABELS[key]} />
            </Link>
          ))}
        </nav>

        <div className="mt-6">
          <TabContent data={data} adminId={admin.id} />
        </div>
      </main>
    </div>
  );
}
