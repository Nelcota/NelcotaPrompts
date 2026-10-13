import { useCallback, useRef, useState } from "react";
import { useSubmit } from "react-router";
import { toast } from "sonner";

import type { CopyOutcome } from "~/features/prompts/components/prompt-actions";
import type { VariablesTarget } from "~/features/prompts/components/variables-dialog";
import { copyPrompt } from "~/features/prompts/copy-prompt";
import { HOME_ACTION } from "~/features/prompts/list-query";
import { loadBody } from "~/features/prompts/prompt-body";
import type { PromptIntent } from "~/features/prompts/prompt-rules";
import type { Prompt } from "~/features/prompts/types";
import { extractVariableSpecs } from "~/features/prompts/variables";

const COPIED: PromptIntent = "copied";

// Copiar um prompt: com {variáveis}, abre o formulário de preenchimento antes; sem, copia
// direto. Toda cópia concluída é contada no servidor (ordenação "Mais copiados").
export function useCopyFlow() {
  const submit = useSubmit();
  const [variablesFor, setVariablesFor] = useState<VariablesTarget | null>(null);
  // Cópias que se sobrepõem (C num prompt e logo depois noutro): só a última pedida abre
  // o formulário de variáveis, mesmo que o corpo da anterior chegue depois.
  const latestRequest = useRef(0);

  const countCopy = useCallback(
    (prompt: Prompt) => {
      const form = new FormData();
      form.set("intent", COPIED);
      form.set("id", prompt.id);
      void submit(form, { method: "post", action: HOME_ACTION, navigate: false, fetcherKey: `copy-${prompt.id}` });
    },
    [submit],
  );

  const requestCopy = useCallback(
    async (prompt: Prompt): Promise<CopyOutcome> => {
      const request = ++latestRequest.current;

      if (prompt.hasVariables) {
        const body = await loadBody(prompt);

        if (request !== latestRequest.current) {
          return "failed";
        }


        if (body === null) {
          toast.error("Não consegui carregar o prompt completo. Tente de novo.");

          return "failed";
        }

        const specs = extractVariableSpecs(body);

        if (specs.length > 0) {
          setVariablesFor({ prompt, body, specs });

          return "dialog";
        }
      }

      if (!(await copyPrompt(prompt))) {
        return "failed";
      }

      countCopy(prompt);

      return "copied";
    },
    [countCopy],
  );

  const closeVariables = useCallback(() => setVariablesFor(null), []);

  return { requestCopy, countCopy, variablesFor, closeVariables };
}
