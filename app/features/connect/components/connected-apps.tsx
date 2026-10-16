import { Trash2 } from "lucide-react";
import { useFetcher } from "react-router";

import type { ApiTokenResult, ApiTokenSummary } from "~/features/api-tokens/api-token-rules";
import { useFetcherResult } from "~/shared/hooks/use-fetcher-result";
import { formatDateTime } from "~/shared/lib/format";
import { iconButtonClass } from "~/shared/ui/styles";

const ACCESS_LABEL = { read: "só leitura", write: "tudo" } as const;

function RevokeButton({ token }: { token: ApiTokenSummary }) {
  const fetcher = useFetcher<ApiTokenResult>();

  useFetcherResult(fetcher);

  return (
    <fetcher.Form method="post" action="/conectar">
      <input type="hidden" name="intent" value="revokeToken" />
      <input type="hidden" name="id" value={token.id} />
      <button
        type="submit"
        disabled={fetcher.state !== "idle"}
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
export function ConnectedApps({ tokens }: { tokens: ApiTokenSummary[] }) {
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
              <RevokeButton token={token} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
