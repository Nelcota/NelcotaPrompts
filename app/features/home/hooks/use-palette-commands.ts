import { FileText, GalleryHorizontalEnd, LayoutGrid, Library, Moon, Plus, Star, Sun, TrendingUp } from "lucide-react";
import { useMemo } from "react";
import { useNavigate } from "react-router";

import type { PaletteCommand } from "~/features/home/components/command-palette";
import { type HomeQuery, homeHref, shortcutHref } from "~/features/prompts/list-query";
import { useThemeToggle } from "~/features/theme/theme";

type Options = { query: HomeQuery; userId: string; onNewPrompt: () => void };

// Comandos da palette (Ctrl+K). Os de filtro partem da lista limpa, mantendo a visualização.
export function usePaletteCommands({ query, userId, onNewPrompt }: Options): PaletteCommand[] {
  const navigate = useNavigate();
  const { next, toggle } = useThemeToggle();

  return useMemo(() => {
    const go = (changes: Partial<HomeQuery>) => void navigate(shortcutHref(query, changes));
    const setView = (view: HomeQuery["view"]) => void navigate(homeHref({ ...query, view }), { preventScrollReset: true });

    return [
      { id: "new", label: "Novo prompt", hint: "N", icon: Plus, run: onNewPrompt },
      { id: "all", label: "Todos os prompts", icon: Library, run: () => go({}) },
      { id: "mine", label: "Meus prompts", icon: FileText, run: () => go({ authorId: userId }) },
      { id: "favorites", label: "Favoritos", icon: Star, run: () => go({ favorites: true }) },
      { id: "popular", label: "Mais copiados", icon: TrendingUp, run: () => go({ sort: "popular" }) },
      query.view === "grid"
        ? { id: "slider", label: "Ver como slider", icon: GalleryHorizontalEnd, run: () => setView(null) }
        : { id: "grid", label: "Ver como grade", icon: LayoutGrid, run: () => setView("grid") },
      { id: "theme", label: next === "light" ? "Usar tema claro" : "Usar tema escuro", icon: next === "light" ? Sun : Moon, run: toggle },
    ];
  }, [navigate, query, userId, onNewPrompt, next, toggle]);
}
