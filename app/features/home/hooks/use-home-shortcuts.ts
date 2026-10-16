import { useEffect, useEffectEvent } from "react";

import { focusVisibleSearch } from "~/features/home/components/search-form";
import type { Prompt } from "~/features/prompts/types";

type Shortcuts = {
  paletteOpen: boolean;
  togglePalette: () => void;
  onNewPrompt: () => void;
  // Prompt em destaque no slider (ou null).
  getActive: () => Prompt | null;
  onCopy: (prompt: Prompt) => void;
  onOpen: (prompt: Prompt) => void;
};

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

// Menu suspenso aberto (ex.: o da conta): as letras navegam entre os itens dele (Radix não
// marca o evento como tratado), então não podem disparar os atalhos da página.
function insideMenu(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('[role="menu"]') !== null;
}

function dialogOpen(): boolean {
  return document.querySelector("dialog[open]") !== null;
}

// Atalhos da home: Ctrl/⌘+K palette (de qualquer lugar, menos por cima de outro diálogo);
// fora de campos, menus e diálogos: / busca, N novo prompt, C copia o prompt em destaque, Enter abre.
export function useHomeShortcuts(shortcuts: Shortcuts) {
  const handle = useEffectEvent((event: KeyboardEvent) => {
    const key = event.key.toLowerCase();

    if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && key === "k") {
      if (shortcuts.paletteOpen || !dialogOpen()) {
        event.preventDefault();
        shortcuts.togglePalette();
      }

      return;
    }

    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }

    if (shortcuts.paletteOpen || isTypingTarget(event.target) || insideMenu(event.target) || dialogOpen()) {
      return;
    }

    if (key === "/") {
      if (focusVisibleSearch()) {
        event.preventDefault();
      }

      return;
    }

    if (key === "n") {
      event.preventDefault();
      shortcuts.onNewPrompt();

      return;
    }

    const active = shortcuts.getActive();

    if (active === null) {
      return;
    }

    if (key === "c") {
      event.preventDefault();
      shortcuts.onCopy(active);

      return;
    }

    if (key === "enter" && event.target === document.body) {
      event.preventDefault();
      shortcuts.onOpen(active);
    }
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => handle(event);
    document.addEventListener("keydown", listener);

    return () => document.removeEventListener("keydown", listener);
  }, []);
}
