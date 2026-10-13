import type { AdminStats } from "~/features/admin/admin-rules";
import { plural } from "~/shared/lib/format";
import { Section } from "./admin-ui";

function StatTile({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="rounded-2xl border border-line bg-canvas p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">{value.toLocaleString("pt-BR")}</p>
      <p className="mt-1 font-mono text-xs text-muted">{detail}</p>
    </div>
  );
}

export function OverviewTab({ stats }: { stats: AdminStats }) {
  return (
    <Section title="Visão geral" description="Números do mural agora.">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatTile
          label="Usuários"
          value={stats.users}
          detail={`${plural(stats.admins, "admin", "admins")} · ${plural(stats.disabledUsers, "bloqueado", "bloqueados")}`}
        />
        <StatTile label="Prompts" value={stats.prompts} detail={`+${stats.promptsLastWeek} nos últimos 7 dias`} />
        <StatTile label="Cópias" value={stats.copies} detail="somando todos os prompts" />
        <StatTile label="Com sessão ativa" value={stats.usersWithActiveSession} detail="pessoas logadas em algum aparelho" />
        <StatTile label="Na lixeira" value={stats.trashed} detail="purgados depois de 7 dias" />
      </div>
    </Section>
  );
}
