import { History, Link2, Pencil, Trash } from "lucide-react";
import { useFetcher } from "react-router";

import { DELETE_FETCHER_KEY } from "~/features/prompts/hooks/use-undo-delete";
import { useOrigin } from "~/shared/hooks/use-origin";
import { copyText } from "~/shared/lib/copy-text";
import { HOME_ACTION } from "~/features/prompts/list-query";
import type { PromptIntent } from "~/features/prompts/prompt-rules";
import type { Prompt, PromptActionData } from "~/features/prompts/types";
import { CopyButton } from "~/features/prompts/components/copy-button";
import { FavoriteButton } from "~/features/prompts/components/favorite-button";
import { iconButtonClass } from "~/shared/ui/styles";
import { UseInProjectMenu } from "./use-in-project-menu";

const ICON = "size-[18px]";
const DELETE: PromptIntent = "delete";

// Apagar não pede confirmação: vai para a lixeira. A resposta (fechar e "Desfazer") é
// tratada pela página, no fetcher de mesma chave (useUndoDelete).
function DeletePromptButton({ promptId }: { promptId: string }) {
  const fetcher = useFetcher<PromptActionData>({ key: DELETE_FETCHER_KEY });
  const deleting = fetcher.state !== "idle";

  return (
    <fetcher.Form method="post" action={HOME_ACTION}>
      <input type="hidden" name="intent" value={DELETE} />
      <input type="hidden" name="id" value={promptId} />
      <button
        type="submit"
        title="Apagar (dá para desfazer)"
        aria-label={deleting ? "Apagando…" : "Apagar prompt"}
        disabled={deleting}
        className={iconButtonClass({ size: "lg", tone: "danger" })}
      >
        <Trash className={ICON} aria-hidden />
      </button>
    </fetcher.Form>
  );
}

type PromptToolbarProps = {
  prompt: Prompt;
  body: string | null;
  isOwner: boolean;
  onShowHistory: () => void;
  onEdit: (prompt: Prompt, body: string) => void;
};

// Copiar (principal), favoritar, link, histórico, usar em outro projeto; para o autor,
// editar e apagar.
export function PromptToolbar({ prompt, body, isOwner, onShowHistory, onEdit }: PromptToolbarProps) {
  const origin = useOrigin();

  return (
    <div className="mt-6 flex flex-wrap items-center gap-2">
      <CopyButton
        prompt={prompt}
        label="Copiar prompt"
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-accent px-5 text-base font-medium whitespace-nowrap text-accent-ink transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:outline-none sm:w-auto"
        iconClassName="size-4 shrink-0"
      />
      <FavoriteButton prompt={prompt} className={iconButtonClass({ size: "lg" }, "aria-pressed:text-amber-500 aria-pressed:hover:text-amber-500")} iconClassName={ICON} />
      <button
        type="button"
        title="Copiar link"
        aria-label="Copiar link do prompt"
        onClick={() => void copyText(`${origin}/?p=${prompt.id}`, "Link do prompt copiado.")}
        className={iconButtonClass({ size: "lg" })}
      >
        <Link2 className={ICON} aria-hidden />
      </button>
      <button
        type="button"
        title="Histórico de versões"
        aria-label="Histórico de versões"
        onClick={onShowHistory}
        disabled={body === null}
        className={iconButtonClass({ size: "lg" })}
      >
        <History className={ICON} aria-hidden />
      </button>
      <UseInProjectMenu prompt={prompt} body={body} iconClassName={ICON} />
      {isOwner ? (
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            title="Editar"
            aria-label="Editar prompt"
            onClick={() => {
              if (body !== null) {
                onEdit(prompt, body);
              }
            }}
            disabled={body === null}
            className={iconButtonClass({ size: "lg" })}
          >
            <Pencil className={ICON} aria-hidden />
          </button>
          <DeletePromptButton promptId={prompt.id} />
        </div>
      ) : null}
    </div>
  );
}
