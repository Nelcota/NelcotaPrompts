import { Copy, Dices, RotateCcw } from "lucide-react";
import { useState } from "react";

import { useOrigin } from "~/shared/hooks/use-origin";
import { INVITE_MAX, INVITE_MIN, type InviteCode } from "~/features/admin/admin-rules";
import { copyText } from "~/shared/lib/copy-text";
import { buttonClass } from "~/shared/ui/styles";
import { adminInputClass, Section } from "./admin-ui";
import { useAdminAction } from "~/features/admin/hooks/use-admin-action";
import { cn } from "~/shared/ui/cn";

const OUTLINE = buttonClass("outline", "sm");

// Liga/desliga a exigência do convite. Mostra o valor enviado enquanto o servidor responde.
function InviteSwitch({ required }: { required: boolean }) {
  const { fetcher, busy, submit } = useAdminAction();
  const pending = fetcher.formData?.get("required");
  const on = pending === undefined || pending === null ? required : pending === "true";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label="Exigir código de convite"
      disabled={busy}
      onClick={() => submit("invite-toggle", { required: String(!on) })}
      className="flex shrink-0 items-center gap-2.5 rounded-full text-sm font-medium disabled:opacity-60"
    >
      {on ? "Ligado" : "Desligado"}
      <span className={cn("relative h-6 w-11 rounded-full transition-colors", on ? "bg-brand" : "bg-ink/15")}>
        <span className={cn("absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform", on ? "translate-x-5" : "")} />
      </span>
    </button>
  );
}

export function InviteTab({ invite, required }: { invite: InviteCode; required: boolean }) {
  // O campo só é limpo depois de salvar; gerar ou voltar ao padrão não apaga o que se digitou.
  const [formKey, setFormKey] = useState(0);
  const { fetcher, busy, submit } = useAdminAction((result) => {
    if (result.intent === "invite-save") {
      setFormKey((key) => key + 1);
    }
  });
  const [revealed, setRevealed] = useState(false);
  const signupUrl = `${useOrigin()}/cadastro`;

  return (
    <Section
      title="Código de convite"
      description={
        required
          ? "Quem cria conta precisa dele. Trocar o código não afeta quem já tem conta."
          : "Desligado: qualquer pessoa com o link cria conta, sem código. O código abaixo passa a valer quando você ligar."
      }
      aside={<InviteSwitch required={required} />}
    >
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-canvas p-3">
        <code className="min-w-0 flex-1 truncate px-1 font-mono text-base">
          {invite.code === null ? "nenhum código definido" : revealed ? invite.code : "•".repeat(Math.min(invite.code.length, 16))}
        </code>
        <button type="button" onClick={() => setRevealed((value) => !value)} aria-pressed={revealed} className={OUTLINE}>
          {revealed ? "Ocultar" : "Mostrar"}
        </button>
        <button type="button" disabled={invite.code === null}
          onClick={() => {
            if (invite.code !== null) {
              void copyText(invite.code, "Código copiado.");
            }
          }} className={OUTLINE}>
          <Copy className="size-3.5" aria-hidden />
          Copiar
        </button>
      </div>
      <p className="mt-2 font-mono text-xs text-muted">
        {invite.source === "painel"
          ? "definido aqui no painel"
          : invite.source === "env"
            ? "vindo da variável INVITE_CODE"
            : required
              ? "cadastro fechado até definir um código"
              : "nenhum código definido"}{" "}
        · cadastro em {signupUrl}
      </p>

      <fetcher.Form method="post" className="mt-5 flex flex-wrap items-end gap-2" key={formKey}>
        <input type="hidden" name="intent" value="invite-save" />
        <label className="block min-w-48 flex-1 text-sm text-muted">
          Novo código
          <input
            name="code"
            required
            minLength={INVITE_MIN}
            maxLength={INVITE_MAX}
            pattern="\S+"
            autoComplete="off"
            className={cn(adminInputClass, "mt-1.5 font-mono")}
          />
        </label>
        <button type="submit" disabled={busy} className={buttonClass("primary", "sm")}>
          Salvar
        </button>
      </fetcher.Form>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => submit("invite-random")} className={OUTLINE}>
          <Dices className="size-3.5" aria-hidden />
          Gerar código aleatório
        </button>
        {invite.source === "painel" ? (
          <button type="button" disabled={busy} onClick={() => submit("invite-reset")} className={OUTLINE}>
            <RotateCcw className="size-3.5" aria-hidden />
            Voltar ao INVITE_CODE
          </button>
        ) : null}
      </div>
    </Section>
  );
}
