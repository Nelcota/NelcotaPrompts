import { useFetcher, useRouteLoaderData } from "react-router";

export type Theme = "dark" | "light";

export const THEME_FETCHER_KEY = "theme";

// Rota que grava o cookie de tema.
export const THEME_ACTION = "/tema";

type RootData = { theme: Theme };

function isRootData(value: unknown): value is RootData {
  if (typeof value !== "object" || value === null || !("theme" in value)) {
    return false;
  }

  return value.theme === "dark" || value.theme === "light";
}

// Tema atual, já considerando a troca otimista enquanto o cookie é salvo.
export function useTheme(): Theme {
  const rootData: unknown = useRouteLoaderData("root");
  const fetcher = useFetcher({ key: THEME_FETCHER_KEY });
  const pending = fetcher.formData?.get("theme");

  if (pending === "light" || pending === "dark") {
    return pending;
  }

  if (!isRootData(rootData)) {
    return "dark";
  }

  return rootData.theme;
}

// Alternar entre claro e escuro (navbar, palette): troca otimista via fetcher compartilhado.
export function useThemeToggle() {
  const theme = useTheme();
  const fetcher = useFetcher({ key: THEME_FETCHER_KEY });
  const next: Theme = theme === "dark" ? "light" : "dark";

  return { theme, next, toggle: () => void fetcher.submit({ theme: next }, { method: "post", action: THEME_ACTION }) };
}
