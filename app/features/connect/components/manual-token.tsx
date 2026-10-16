import { Copy } from "lucide-react";
import { useRef, useState } from "react";
import { useFetcher } from "react-router";

import { type ApiTokenResult, TOKEN_NAME_MAX } from "~/features/api-tokens/api-token-rules";
import { useFetcherResult } from "~/shared/hooks/use-fetcher-result";
import { copyText } from "~/shared/lib/copy-text";
import { Field } from "~/shared/ui/field";
import { buttonClass, labelClass } from "~/shared/ui/styles";

// Para apps que não entram pelo navegador: um token que vai no cabeçalho Authorization.
// Fica recolhido: a maioria das pessoas não precisa.
export function ManualToken() {
  const fetcher = useFetcher<ApiTokenResult>();
  const form = useRef<HTMLFormElement>(null);
  const [revealed, setRevealed] = useState<string | null>(null);
  const errors = fetcher.data?.errors ?? {};

  useFetcherResult(fetcher, {
    onSuccess: (result) => {
      setRevealed(result.token ?? null);
      form.current?.reset();
    },
  });

  return (
    <details className="rounded-3xl border border-line p-5 sm:p-6">
      <summary className="cursor-pointer text-base font-medium">Avançado: criar um token à mão</summary>
      <div className="mt-4 space-y-4">
        <p className="text-sm text-muted">
          Só para apps que não fazem login pelo navegador. Mande o token no cabeçalho <code className="font-mono text-ink">Authorization: Bearer …</code>.
        </p>

        {revealed === null ? null : (
          <div className="space-y-2 rounded-2xl border border-accent/40 bg-accent/5 p-4">
            <p className="text-sm font-medium">Copie agora: o token não aparece de novo.</p>
            <code className="block font-mono text-sm break-all">{revealed}</code>
            <button type="button" className={buttonClass("outline", "sm")} onClick={() => void copyText(revealed, "Token copiado.")}>
              <Copy className="size-4" aria-hidden /> Copiar token
            </button>
          </div>
        )}

        <fetcher.Form ref={form} method="post" action="/conectar" className="space-y-3">
          <input type="hidden" name="intent" value="createToken" />
          <Field label="Nome do token" name="name" maxLength={TOKEN_NAME_MAX} placeholder="Script do servidor de CI" error={errors.name} />
          <fieldset>
            <legend className={labelClass}>Acesso</legend>
            <div className="mt-2 flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="access" value="read" defaultChecked className="accent-accent" />
                Só leitura
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="access" value="write" className="accent-accent" />
                Tudo
              </label>
            </div>
            {errors.access === undefined ? null : <p className="mt-1 text-sm text-danger">{errors.access}</p>}
          </fieldset>
          <div className="flex justify-end">
            <button type="submit" disabled={fetcher.state !== "idle"} className={buttonClass("primary")}>
              {fetcher.state !== "idle" ? "Criando…" : "Criar token"}
            </button>
          </div>
        </fetcher.Form>
      </div>
    </details>
  );
}
