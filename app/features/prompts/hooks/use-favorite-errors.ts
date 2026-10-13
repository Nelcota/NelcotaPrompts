import { useEffect, useRef } from "react";
import { useFetchers } from "react-router";
import { toast } from "sonner";

import type { PromptActionData } from "~/features/prompts/types";
import { FAVORITE_FETCHER_PREFIX } from "../components/favorite-button";

function isActionData(value: unknown): value is PromptActionData {
  return typeof value === "object" && value !== null && "ok" in value && "message" in value;
}

// Erros ao favoritar, avisados uma vez só: o mesmo fetcher (por prompt) aparece no card e
// no prompt aberto, então quem avisa é a página, não cada estrela.
export function useFavoriteErrors() {
  const fetchers = useFetchers();
  const handled = useRef(new WeakSet<object>());

  useEffect(() => {
    for (const fetcher of fetchers) {
      const data: unknown = fetcher.data;

      if (!fetcher.key.startsWith(FAVORITE_FETCHER_PREFIX) || fetcher.state !== "idle" || !isActionData(data) || handled.current.has(data)) {
        continue;
      }

      handled.current.add(data);

      if (!data.ok) {
        toast.error(data.message);
      }
    }
  }, [fetchers]);
}
