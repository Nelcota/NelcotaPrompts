import { useEffect, useEffectEvent, useRef } from "react";
import { toast } from "sonner";

type ResultLike = { ok: boolean; message: string };

type FetcherLike<T> = { state: "idle" | "loading" | "submitting"; data: T | undefined };

type Options<T> = {
  onSuccess?: (result: T) => void;
  onError?: (result: T) => void;
  // Mostra a mensagem do servidor num toast: true (sucesso e erro, o padrão), "errors"
  // (só erros: o sucesso tem toast próprio de quem chama) ou false.
  toast?: boolean | "errors";
};

// Erro sempre aparece (se o toast não estiver desligado); sucesso só com toast: true.
function showToast(result: ResultLike, show: boolean | "errors") {
  if (show === false || result.message === "") {
    return;
  }

  if (!result.ok) {
    toast.error(result.message);

    return;
  }

  if (show === true) {
    toast.success(result.message);
  }
}

// fetcher.data continua lá depois da resposta (e a cada render): aqui cada resultado é
// tratado uma vez só, quando o fetcher volta a ficar ocioso.
export function useFetcherResult<T extends ResultLike>(fetcher: FetcherLike<T>, options: Options<T> = {}) {
  const handled = useRef<T | undefined>(undefined);
  const settle = useEffectEvent((result: T) => {
    showToast(result, options.toast ?? true);

    if (result.ok) {
      options.onSuccess?.(result);

      return;
    }

    options.onError?.(result);
  });

  useEffect(() => {
    const result = fetcher.data;

    if (fetcher.state !== "idle" || result === undefined || handled.current === result) {
      return;
    }

    handled.current = result;
    settle(result);
  }, [fetcher.state, fetcher.data]);
}
