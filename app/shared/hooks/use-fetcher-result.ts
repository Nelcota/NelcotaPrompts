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

// fetcher.data continua lá depois da resposta (e a cada render): aqui cada resultado é
// tratado uma vez só, quando o fetcher volta a ficar ocioso.
export function useFetcherResult<T extends ResultLike>(fetcher: FetcherLike<T>, options: Options<T> = {}) {
  const handled = useRef<T | undefined>(undefined);
  const settle = useEffectEvent((result: T) => {
    const show = options.toast ?? true;

    if (show !== false && result.message !== "") {
      if (result.ok && show === true) {
        toast.success(result.message);
      } else if (!result.ok) {
        toast.error(result.message);
      }
    }

    if (result.ok) {
      options.onSuccess?.(result);
    } else {
      options.onError?.(result);
    }
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
