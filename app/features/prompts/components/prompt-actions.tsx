import { createContext, type ReactNode, useContext } from "react";

import type { HomeQuery } from "~/features/prompts/list-query";
import type { Prompt } from "~/features/prompts/types";

// "dialog": o prompt tem variáveis e abriu o formulário de preenchimento.
export type CopyOutcome = "copied" | "dialog" | "failed";

export type RequestCopy = (prompt: Prompt) => Promise<CopyOutcome>;

// Dois contextos: copiar é estável; os filtros mudam a cada busca. Separados, trocar de
// filtro não re-renderiza todos os botões de copiar.
const CopyContext = createContext<RequestCopy | null>(null);
const QueryContext = createContext<HomeQuery | null>(null);

export function PromptActionsProvider({ requestCopy, query, children }: { requestCopy: RequestCopy; query: HomeQuery; children: ReactNode }) {
  return (
    <CopyContext.Provider value={requestCopy}>
      <QueryContext.Provider value={query}>{children}</QueryContext.Provider>
    </CopyContext.Provider>
  );
}

function required<T>(value: T | null, name: string): T {
  if (value === null) {
    throw new Error(`${name} precisa estar dentro de PromptActionsProvider.`);
  }

  return value;
}

export function useRequestCopy(): RequestCopy {
  return required(useContext(CopyContext), "useRequestCopy");
}

export function useHomeQuery(): HomeQuery {
  return required(useContext(QueryContext), "useHomeQuery");
}
