import { Moon, Sun } from "lucide-react";
import { useFetcher } from "react-router";

import { THEME_ACTION, THEME_FETCHER_KEY, useTheme } from "~/features/theme/theme";

// Formulário de verdade: troca o tema mesmo antes de o JavaScript carregar.
export function ThemeToggle() {
  const theme = useTheme();
  const fetcher = useFetcher({ key: THEME_FETCHER_KEY });
  const next = theme === "dark" ? "light" : "dark";

  return (
    <fetcher.Form method="post" action={THEME_ACTION} className="shrink-0">
      <input type="hidden" name="theme" value={next} />
      <button
        type="submit"
        aria-label={next === "light" ? "Usar tema claro" : "Usar tema escuro"}
        className="grid size-10 shrink-0 place-items-center rounded-full text-muted transition hover:bg-ink/5 hover:text-ink"
      >
        {theme === "dark" ? <Sun className="size-4" aria-hidden /> : <Moon className="size-4" aria-hidden />}
      </button>
    </fetcher.Form>
  );
}
