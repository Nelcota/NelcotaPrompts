import { useEffect, useState } from "react";

import { cachedBody, loadBody } from "~/features/prompts/prompt-body";
import type { Prompt } from "~/features/prompts/types";

// Corpo completo do prompt: na lista só vem um trecho; o resto é buscado ao abrir.
// body null = ainda carregando (ou falhou, ver failed).
export function usePromptBody(prompt: Prompt | null) {
  // Mesma chave do cache do corpo (id + updatedAt): se o prompt foi editado (por outra
  // pessoa, numa revalidação), o texto mostrado é recarregado e bate com o que se copia.
  const key = prompt === null ? null : `${prompt.id}:${prompt.updatedAt}`;
  const [state, setState] = useState(() => ({ key, body: prompt === null ? null : cachedBody(prompt), failed: false }));
  const current = state.key === key ? state : { key, body: prompt === null ? null : cachedBody(prompt), failed: false };

  useEffect(() => {
    if (prompt === null || current.body !== null) {
      return;
    }

    let cancelled = false;

    void loadBody(prompt).then((loaded) => {
      if (!cancelled) {
        setState({ key: `${prompt.id}:${prompt.updatedAt}`, body: loaded, failed: loaded === null });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [prompt, current.body]);

  return { body: current.body, failed: current.failed };
}
