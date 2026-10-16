import { Trash2 } from "lucide-react";
import { useFetcher } from "react-router";

import type { ApiTokenResult, ApiTokenSummary } from "~/features/api-tokens/api-token-rules";
import { useFetcherResult } from "~/shared/hooks/use-fetcher-result";
import { formatDateTime } from "~/shared/lib/format";
import { iconButtonClass } from "~/shared/ui/styles";

const ACCESS_LABEL = { read: "só leitura", write: "tudo" } as const;

type Revoker = ReturnType<typeof useFetcher<ApiTokenResult>>;

function RevokeButton({ token, fetcher }: { token: ApiTokenSummary; fetcher: Revoker }) {
  const busy = fetcher.state !== "idle" && fetcher.formData?.get("id") === token.id;

  return (
    <fetcher.Form method="post" action="/conectar">
      <input type="hidden" name="intent" value="revokeToken" />
      <input type="hidden" name="id" value={token.id} />
      <button
        type="submit"
        disabled={busy}
        title="Desconectar"
        aria-label={`Desconectar “${token.name}”`}
        className={iconButtonClass({ size: "sm", tone: "danger" })}
      >
        <Trash2 className="size-4" aria-hidden />
      </button>
    </fetcher.Form>
  );
}

// Apps conectados pelo navegador e tokens criados à mão, com o botão de desconectar.
// Um fetcher só, na lista: a linha some quando a lista recarrega, no mesmo instante em que
// o resultado chega, e um fetcher dentro dela levaria junto o toast ("Acesso removido.").
export function ConnectedApps({ tokens }: { tokens: ApiTokenSummary[] }) {
  const revoker = useFetcher<ApiTokenResult>();

  useFetcherResult(revoker);

  return (
    <section aria-labelledby="connected-title" className="space-y-4">
      <h2 id="connected-title" className="font-display text-2xl font-light tracking-tight">
        Conectados
      </h2>
      {tokens.length === 0 ? (
        <p className="text-base text-muted">Nenhum app conectado ainda.</p>
      ) : (
        <ul className="divide-y divide-line rounded-3xl border border-line">
          {tokens.map((token) => (
            <li key={token.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
              <div className="min-w-0">
                <p className="truncate font-medium">{token.name}</p>
                <p className="text-sm text-muted">
                  {token.app ? "App" : "Token"} · {ACCESS_LABEL[token.access]} ·{" "}
                  {token.lastUsedAt === null ? "nunca usado" : `usado em ${formatDateTime(token.lastUsedAt)}`}
                </p>
              </div>
              <RevokeButton token={token} fetcher={revoker} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
