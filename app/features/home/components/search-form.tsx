import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";

import { filterHref, type HomeQuery } from "~/features/prompts/list-query";
import { SEARCH_MAX } from "~/features/prompts/prompt-rules";

const SEARCH_DEBOUNCE_MS = 350;

// Há dois campos de busca (desktop e celular, um deles escondido pelo CSS): o atalho "/"
// foca o que está visível.
export function focusVisibleSearch(): boolean {
  const input = [...document.querySelectorAll<HTMLInputElement>("[data-search-input]")].find(
    (element) => element.offsetParent !== null,
  );

  if (input === undefined) {
    return false;
  }

  input.focus();
  input.select();

  return true;
}

// "⌘K" no Mac, "Ctrl K" no resto. Decidido depois de montar (o servidor não sabe o sistema).
function usePaletteShortcutLabel(): string {
  const [label, setLabel] = useState("Ctrl K");

  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.platform)) {
      setLabel("⌘K");
    }
  }, []);

  return label;
}

type SearchFormProps = { query: HomeQuery; className: string; onOpenPalette: () => void };

// Busca enquanto digita (com pequeno atraso); Enter busca na hora; ✕ limpa.
export function SearchForm({ query, className, onOpenPalette }: SearchFormProps) {
  const shortcutLabel = usePaletteShortcutLabel();
  const navigate = useNavigate();
  const [value, setValue] = useState(query.search ?? "");
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef(0);
  // Filtros atuais: o timer da busca lê daqui na hora de disparar, para não reaplicar
  // filtros antigos (ex.: a pessoa trocou de filtro enquanto o timer esperava).
  const queryRef = useRef(query);
  // Última busca pedida por este campo (pode ainda estar carregando): é com ela que se
  // compara, não com a URL atual, para limpar uma busca que ainda não terminou.
  const requestedRef = useRef(query.search);

  useEffect(() => {
    queryRef.current = query;
  }, [query]);

  // Se a busca mudou por fora (ex.: "Limpar filtros"), reflete no campo — mas nunca
  // enquanto a pessoa está digitando nele.
  useEffect(() => {
    if (document.activeElement === inputRef.current) {
      return;
    }

    // Mudou por fora: um timer pendente traria de volta o texto antigo.
    window.clearTimeout(timerRef.current);
    requestedRef.current = query.search;
    setValue(query.search ?? "");
  }, [query.search]);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  const go = (text: string) => {
    window.clearTimeout(timerRef.current);

    const current = queryRef.current;
    const trimmed = text.trim();
    const search = trimmed === "" ? null : trimmed;

    if (search === requestedRef.current) {
      return;
    }

    requestedRef.current = search;

    void navigate(filterHref(current, { search }), { replace: true, preventScrollReset: true });
  };

  const schedule = (text: string) => {
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => go(text), SEARCH_DEBOUNCE_MS);
  };

  return (
    <form
      role="search"
      className={className}
      onSubmit={(event) => {
        event.preventDefault();
        go(value);
      }}
    >
      <label className="relative block">
        <span className="sr-only">Buscar prompts</span>
        <Search className="pointer-events-none absolute top-1/2 left-4 z-10 size-4 -translate-y-1/2 text-brand" aria-hidden />
        <input
          ref={inputRef}
          data-search-input
          type="text"
          inputMode="search"
          enterKeyHint="search"
          name="q"
          value={value}
          maxLength={SEARCH_MAX}
          autoComplete="off"
          placeholder="Buscar prompts, tags…"
          onChange={(event) => {
            setValue(event.target.value);
            schedule(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.currentTarget.blur();
            }
          }}
          className="h-10 w-full rounded-full border border-line bg-surface/60 pr-16 pl-10 text-base outline-none backdrop-blur transition placeholder:text-muted focus:border-ink/30 focus:ring-4 focus:ring-ink/5"
        />
        {value === "" ? (
          <button
            type="button"
            onClick={onOpenPalette}
            title="Busca rápida e comandos"
            className="absolute top-1/2 right-2.5 z-10 hidden -translate-y-1/2 rounded-md border border-line px-1.5 font-mono text-xs text-muted transition hover:border-ink/30 hover:text-ink sm:block"
          >
            <kbd>{shortcutLabel}</kbd>
          </button>
        ) : (
          <button
            type="button"
            aria-label="Limpar busca"
            onClick={() => {
              setValue("");
              go("");
              inputRef.current?.focus();
            }}
            className="absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-muted transition hover:bg-ink/5 hover:text-ink"
          >
            <X className="size-4" aria-hidden />
          </button>
        )}
      </label>
    </form>
  );
}
