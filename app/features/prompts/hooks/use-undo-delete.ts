import { useFetcher } from "react-router";
import { toast } from "sonner";

import { HOME_ACTION } from "~/features/prompts/list-query";
import type { PromptIntent } from "~/features/prompts/prompt-rules";
import type { PromptActionData } from "~/features/prompts/types";
import { useFetcherResult } from "~/shared/hooks/use-fetcher-result";

const UNDO_TOAST_MS = 8000;
const RESTORE: PromptIntent = "restore";

// Fetcher de apagar compartilhado pela chave: o botão (dentro do diálogo) envia e a página
// trata a resposta. O diálogo some quando a lista recarrega sem o prompt, então quem
// trata não pode morar nele.
export const DELETE_FETCHER_KEY = "delete-prompt";

// Apagar não pede confirmação: o prompt vai para a lixeira e o toast oferece "Desfazer".
export function useUndoDelete(onDeleted: (promptId: string) => void) {
  const deleteFetcher = useFetcher<PromptActionData>({ key: DELETE_FETCHER_KEY });
  const restoreFetcher = useFetcher<PromptActionData>({ key: "restore" });

  useFetcherResult(restoreFetcher);
  useFetcherResult(deleteFetcher, {
    toast: "errors",
    onSuccess: (result) => {
      const promptId = result.promptId;

      if (promptId === undefined) {
        return;
      }

      onDeleted(promptId);

      toast.success(result.message, {
        duration: UNDO_TOAST_MS,
        action: {
          label: "Desfazer",
          onClick: () => void restoreFetcher.submit({ intent: RESTORE, id: promptId }, { method: "post", action: HOME_ACTION }),
        },
      });
    },
  });
}
