import { Search, Trash2, Undo2 } from "lucide-react";
import { useState } from "react";
import { Form, Link } from "react-router";

import type { AdminPrompt } from "~/features/admin/admin-rules";
import { formatDate, plural } from "~/shared/lib/format";
import { SEARCH_MAX } from "~/features/prompts/prompt-rules";
import { buttonClass } from "~/shared/ui/styles";
import { adminInputClass, Section } from "./admin-ui";
import { useAdminAction } from "~/features/admin/hooks/use-admin-action";
import { cn } from "~/shared/ui/cn";

const OUTLINE = buttonClass("outline", "sm");
const DANGER = buttonClass("danger", "sm");

function PromptMeta({ prompt }: { prompt: AdminPrompt }) {
  const when = prompt.deletedAt === null ? formatDate(prompt.createdAt) : `apagado em ${formatDate(prompt.deletedAt)}`;
  const tags = prompt.tags.length > 0 ? ` · ${prompt.tags.map((tag) => `#${tag}`).join(" ")}` : "";

  return (
    <p className="mt-0.5 truncate text-xs text-muted">
      {prompt.authorName} · {when} · {plural(prompt.copyCount, "cópia", "cópias")}
      {tags}
    </p>
  );
}

// As ações das linhas usam o fetcher da aba (Actions): a linha some da lista quando a ação
// dá certo, e o aviso de resultado precisa de quem continua na tela.
type Actions = { busy: boolean; submit: ReturnType<typeof useAdminAction>["submit"] };

function PromptRow({ prompt, actions: { busy, submit } }: { prompt: AdminPrompt; actions: Actions }) {
  return (
    <li className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1">
        <Link to={`/?p=${prompt.id}`} className="font-medium underline-offset-4 hover:underline">
          {prompt.title}
        </Link>
        <PromptMeta prompt={prompt} />
      </div>
      <button type="button" disabled={busy} onClick={() => submit("prompt-trash", { promptId: prompt.id })} className={DANGER}>
        <Trash2 className="size-3.5" aria-hidden />
        Apagar
      </button>
    </li>
  );
}

function TrashRow({ prompt, actions: { busy, submit } }: { prompt: AdminPrompt; actions: Actions }) {
  return (
    <li className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1">
        <p className="font-medium text-muted line-through decoration-muted/50">{prompt.title}</p>
        <PromptMeta prompt={prompt} />
      </div>
      <div className="flex gap-2">
        <button type="button" disabled={busy} onClick={() => submit("prompt-restore", { promptId: prompt.id })} className={OUTLINE}>
          <Undo2 className="size-3.5" aria-hidden />
          Restaurar
        </button>
        <button type="button" disabled={busy} onClick={() => submit("prompt-purge", { promptId: prompt.id })} className={DANGER}>
          Excluir de vez
        </button>
      </div>
    </li>
  );
}

function EmptyTrashButton({ count, actions: { busy, submit } }: { count: number; actions: Actions }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button type="button" disabled={busy} onClick={() => setConfirming(true)} className={DANGER}>
        Esvaziar lixeira
      </button>
    );
  }

  return (
    <div className="flex gap-2">
      <button type="button" onClick={() => setConfirming(false)} className={OUTLINE}>
        Cancelar
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setConfirming(false);
          submit("trash-empty");
        }}
        className={DANGER}
      >
        Confirmar: excluir {count}
      </button>
    </div>
  );
}

// trashTotal: a lixeira inteira (a lista mostra no máximo as mais recentes; esvaziar apaga tudo).
export function PromptsTab({ prompts, trash, trashTotal, search }: { prompts: AdminPrompt[]; trash: AdminPrompt[]; trashTotal: number; search: string | null }) {
  const { busy, submit } = useAdminAction();
  const actions = { busy, submit };

  return (
    <div className="space-y-5">
      <Section title="Prompts" description="Apagar manda para a lixeira; dá para restaurar abaixo.">
        <Form method="get" className="flex gap-2">
          <input type="hidden" name="aba" value="prompts" />
          <label className="relative block flex-1">
            <span className="sr-only">Buscar prompts</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-brand" aria-hidden />
            <input key={search ?? ""} name="q" defaultValue={search ?? ""} maxLength={SEARCH_MAX} placeholder="Título, autor, email ou tag…" className={cn(adminInputClass, "pl-9")} />
          </label>
          <button type="submit" className={OUTLINE}>
            Buscar
          </button>
        </Form>
        {prompts.length === 0 ? (
          <p className="mt-4 text-sm text-muted">{search === null ? "Nenhum prompt ainda." : "Nada encontrado."}</p>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {prompts.map((prompt) => (
              <PromptRow key={prompt.id} prompt={prompt} actions={actions} />
            ))}
          </ul>
        )}
      </Section>

      <Section
        title="Lixeira"
        description="Itens apagados há mais de 7 dias são removidos de vez automaticamente."
        aside={trash.length === 0 ? null : <EmptyTrashButton count={trashTotal} actions={actions} />}
      >
        {trash.length === 0 ? (
          <p className="text-sm text-muted">A lixeira está vazia.</p>
        ) : (
          <ul className="divide-y divide-line">
            {trash.map((prompt) => (
              <TrashRow key={prompt.id} prompt={prompt} actions={actions} />
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
