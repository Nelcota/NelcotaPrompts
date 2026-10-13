import { Ban, Copy, KeyRound, LogOut, Shield, ShieldOff, Trash2, UserRoundCheck } from "lucide-react";
import { useState } from "react";

import { useOrigin } from "~/shared/hooks/use-origin";
import type { AdminUser } from "~/features/admin/admin-rules";
import { copyText } from "~/shared/lib/copy-text";
import { formatDate, plural } from "~/shared/lib/format";
import { Avatar } from "~/shared/ui/avatar";
import { buttonClass } from "~/shared/ui/styles";
import { adminInputClass, Badge, Section } from "./admin-ui";
import { useAdminAction } from "~/features/admin/hooks/use-admin-action";
import { cn } from "~/shared/ui/cn";

const OUTLINE = buttonClass("outline", "sm");
const DANGER = buttonClass("danger", "sm");

type Deletion = ReturnType<typeof useAdminAction>;

// Excluir pede o email da conta digitado; o servidor confere contra o email real. O envio
// usa o fetcher da aba: a linha some quando dá certo, e o aviso precisa de quem fica.
function DeleteUserConfirm({ user, deletion, onCancel }: { user: AdminUser; deletion: Deletion; onCancel: () => void }) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        deletion.submit("user-delete", { userId: user.id, confirm: String(new FormData(event.currentTarget).get("confirm") ?? "") });
      }}
      className="mt-3 rounded-xl border border-danger/30 bg-danger/5 p-3 sm:ml-13"
    >
      <label className="block text-sm">
        Isso apaga a conta e os {plural(user.prompts, "prompt", "prompts")} dela, sem volta. Digite{" "}
        <code className="font-mono">{user.email}</code> para confirmar:
        <input name="confirm" autoComplete="off" autoFocus className={cn(adminInputClass, "mt-2")} />
      </label>
      <div className="mt-2 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className={OUTLINE}>
          Cancelar
        </button>
        <button type="submit" disabled={deletion.busy} className={DANGER}>
          Excluir de vez
        </button>
      </div>
    </form>
  );
}

function ResetLink({ path }: { path: string }) {
  const origin = useOrigin();
  const url = `${origin}${path}`;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-canvas p-2 sm:ml-13">
      <code className="min-w-0 flex-1 truncate px-1 font-mono text-xs">{url}</code>
      <button type="button" onClick={() => void copyText(url, "Link copiado. Mande para a pessoa.")} className={OUTLINE}>
        <Copy className="size-3.5" aria-hidden />
        Copiar link
      </button>
    </div>
  );
}

function UserRow({ user, isSelf, deletion }: { user: AdminUser; isSelf: boolean; deletion: Deletion }) {
  const [resetPath, setResetPath] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const { busy, submit } = useAdminAction((result) => {
    if (result.resetPath !== undefined) {
      setResetPath(result.resetPath);
    }
  });
  const target = { userId: user.id };

  return (
    <li className="py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-3">
        <Avatar name={user.name} url={user.avatarUrl} sizeClassName="size-10" fallbackClassName="bg-ink/10 text-sm text-ink" />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5">
            <span className="font-medium">{user.name}</span>
            {isSelf ? <Badge>você</Badge> : null}
            {user.isAdmin ? <Badge>admin</Badge> : null}
            {user.disabled ? <Badge tone="danger">bloqueado</Badge> : null}
          </p>
          <p className="truncate font-mono text-xs text-muted">{user.email}</p>
          <p className="mt-0.5 text-xs text-muted">
            {plural(user.prompts, "prompt", "prompts")} · {plural(user.sessions, "sessão ativa", "sessões ativas")} · desde{" "}
            {formatDate(user.createdAt)}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 sm:pl-13">
        <button type="button" disabled={busy} onClick={() => submit("user-reset", target)} className={OUTLINE}>
          <KeyRound className="size-3.5" aria-hidden />
          Link de nova senha
        </button>
        {isSelf ? null : (
          <button type="button" disabled={busy} onClick={() => submit("user-admin", { ...target, value: user.isAdmin ? "0" : "1" })} className={OUTLINE}>
            {user.isAdmin ? <ShieldOff className="size-3.5" aria-hidden /> : <Shield className="size-3.5" aria-hidden />}
            {user.isAdmin ? "Remover admin" : "Tornar admin"}
          </button>
        )}
        <button type="button" disabled={busy || user.sessions === 0} onClick={() => submit("user-sessions", target)} className={OUTLINE}>
          <LogOut className="size-3.5" aria-hidden />
          {isSelf ? "Desconectar outros aparelhos" : "Encerrar sessões"}
        </button>
        {isSelf ? null : (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => submit("user-disable", { ...target, value: user.disabled ? "0" : "1" })}
              className={user.disabled ? OUTLINE : DANGER}
            >
              {user.disabled ? <UserRoundCheck className="size-3.5" aria-hidden /> : <Ban className="size-3.5" aria-hidden />}
              {user.disabled ? "Desbloquear" : "Bloquear"}
            </button>
            <button type="button" disabled={busy} onClick={() => setConfirmingDelete((value) => !value)} className={DANGER}>
              <Trash2 className="size-3.5" aria-hidden />
              Excluir conta
            </button>
          </>
        )}
      </div>

      {resetPath === null ? null : <ResetLink path={resetPath} />}
      {confirmingDelete ? <DeleteUserConfirm user={user} deletion={deletion} onCancel={() => setConfirmingDelete(false)} /> : null}
    </li>
  );
}

export function UsersTab({ users, adminId }: { users: AdminUser[]; adminId: string }) {
  const deletion = useAdminAction();

  return (
    <Section
      title="Usuários"
      description="Bloquear desconecta na hora e impede novos logins. Excluir apaga a conta e os prompts dela."
      aside={<span className="font-mono text-xs text-muted">{plural(users.length, "conta", "contas")}</span>}
    >
      <ul className="divide-y divide-line">
        {users.map((user) => (
          <UserRow key={user.id} user={user} isSelf={user.id === adminId} deletion={deletion} />
        ))}
      </ul>
    </Section>
  );
}
