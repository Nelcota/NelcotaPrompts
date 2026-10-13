import { useFetcher } from "react-router";

import { useFetcherResult } from "~/shared/hooks/use-fetcher-result";
import type { AdminActionData, AdminIntent } from "~/features/admin/admin-rules";

// Fetcher de uma ação do painel: envia com intent tipado e mostra o resultado num toast.
export function useAdminAction(onSuccess?: (result: AdminActionData) => void) {
  const fetcher = useFetcher<AdminActionData>();
  useFetcherResult(fetcher, { onSuccess });

  return {
    fetcher,
    busy: fetcher.state !== "idle",
    submit: (intent: AdminIntent, fields: Record<string, string> = {}) =>
      void fetcher.submit({ intent, ...fields }, { method: "post" }),
  };
}
