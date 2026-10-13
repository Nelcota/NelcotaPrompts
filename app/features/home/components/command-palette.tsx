import { Command } from "cmdk";
import { CornerDownLeft, FileText, Search } from "lucide-react";
import { type ComponentType, useEffect, useState } from "react";

import { SEARCH_MAX } from "~/features/prompts/prompt-rules";
import type { Prompt } from "~/features/prompts/types";

export type PaletteCommand = {
  id: string;
  label: string;
  hint?: string;
  icon: ComponentType<{ className?: string }>;
  run: () => void;
};

type CommandPaletteProps = {
  open: boolean;
  recent: Prompt[];
  commands: PaletteCommand[];
  onClose: () => void;
  onOpenPrompt: (prompt: Prompt) => void;
  onCopyPrompt: (prompt: Prompt) => void;
};

const SEARCH_DEBOUNCE_MS = 120;
const RECENT_COUNT = 5;

function isPromptList(value: unknown): value is { prompts: Prompt[] } {
  return typeof value === "object" && value !== null && "prompts" in value && Array.isArray(value.prompts);
}

function normalize(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

// Prompts do servidor para a busca atual (busca textual no mural inteiro). null = sem busca.
function usePromptSearch(open: boolean, query: string) {
  const [results, setResults] = useState<Prompt[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || query === "") {
      setResults(null);
      setLoading(false);

      return;
    }

    const controller = new AbortController();
    setLoading(true);

    const timer = window.setTimeout(() => {
      void fetch(`/busca?q=${encodeURIComponent(query)}`, { headers: { Accept: "application/json" }, signal: controller.signal })
        .then(async (response) => {
          const payload: unknown = response.ok ? await response.json() : null;
          setResults(isPromptList(payload) ? payload.prompts : []);
          setLoading(false);
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setResults([]);
            setLoading(false);
          }
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, query]);

  return { results, loading };
}

const ITEM =
  "flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 data-[selected=true]:bg-ink/8 [&[data-selected=true]_.enter-hint]:opacity-100";
const GROUP_HEADING =
  "[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted [&_[cmdk-group-heading]]:uppercase";

function EnterHint() {
  return <CornerDownLeft className="enter-hint size-3.5 shrink-0 text-muted opacity-0" aria-hidden />;
}

// Ctrl+K (cmdk): busca no mural inteiro enquanto digita. Enter abre o prompt (ou roda o
// comando); Ctrl+Enter copia sem abrir. Comandos (novo prompt, favoritos, tema…) junto.
export function CommandPalette({ open, recent, commands, onClose, onOpenPrompt, onCopyPrompt }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("");
  const trimmed = query.trim();
  const { results, loading } = usePromptSearch(open, trimmed);

  // Cada abertura começa do zero (busca e seleção): o cmdk só seleciona o primeiro item
  // quando não há seleção, e uma seleção antiga faria o Enter rodar o comando anterior.
  useEffect(() => {
    if (!open) {
      setQuery("");
      setSelected("");
    }
  }, [open]);

  const prompts = trimmed === "" ? recent.slice(0, RECENT_COUNT) : (results ?? []);
  const needle = normalize(trimmed);
  const matchingCommands = commands.filter((command) => needle === "" || normalize(command.label).includes(needle));

  const close = (then: () => void) => {
    onClose();
    then();
  };

  return (
    <Command.Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          onClose();
        }
      }}
      label="Busca rápida"
      // A busca de prompts já vem filtrada (e ordenada por relevância) do servidor.
      shouldFilter={false}
      value={selected}
      onValueChange={setSelected}
      onKeyDown={(event) => {
        // Ctrl/⌘+Enter num prompt: copia em vez de abrir.
        if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
          const prompt = prompts.find((item) => `prompt-${item.id}` === selected);

          if (prompt !== undefined) {
            event.preventDefault();
            close(() => onCopyPrompt(prompt));
          }
        }
      }}
      overlayClassName="fixed inset-0 z-50 bg-black/50"
      contentClassName="fixed top-[12dvh] left-1/2 z-50 w-[min(100%-2rem,36rem)] -translate-x-1/2 overflow-hidden rounded-2xl border border-line bg-elevated text-ink shadow-2xl"
    >
      <div className="flex items-center gap-3 border-b border-line px-4">
        <Search className="size-4 shrink-0 text-brand" aria-hidden />
        <Command.Input
          value={query}
          onValueChange={(value) => setQuery(value.slice(0, SEARCH_MAX))}
          placeholder="Buscar prompts ou comandos…"
          className="h-14 w-full bg-transparent text-base outline-none placeholder:text-muted"
        />
        <kbd className="hidden shrink-0 rounded-md border border-line px-1.5 font-mono text-xs text-muted sm:block">Esc</kbd>
      </div>

      <Command.List className={`max-h-[min(60dvh,26rem)] overflow-y-auto p-1.5 ${GROUP_HEADING}`}>
        <Command.Empty className="px-3 py-8 text-center text-sm text-muted">{loading ? "Buscando…" : "Nada encontrado."}</Command.Empty>

        {prompts.length > 0 ? (
          <Command.Group heading={trimmed === "" ? "Recentes" : "Prompts"}>
            {prompts.map((prompt) => (
              <Command.Item key={prompt.id} value={`prompt-${prompt.id}`} onSelect={() => close(() => onOpenPrompt(prompt))} className={ITEM}>
                <FileText className="size-4 shrink-0 text-muted" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px]">{prompt.title}</span>
                  <span className="block truncate font-mono text-xs text-muted">
                    {prompt.authorName}
                    {prompt.tags.length > 0 ? ` · ${prompt.tags.map((tag) => `#${tag}`).join(" ")}` : ""}
                  </span>
                </span>
                <EnterHint />
              </Command.Item>
            ))}
          </Command.Group>
        ) : null}

        {matchingCommands.length > 0 ? (
          <Command.Group heading="Comandos">
            {matchingCommands.map((command) => (
              <Command.Item key={command.id} value={`command-${command.id}`} onSelect={() => close(command.run)} className={ITEM}>
                <command.icon className="size-4 shrink-0 text-muted" />
                <span className="min-w-0 flex-1 truncate text-[15px]">{command.label}</span>
                {command.hint === undefined ? null : (
                  <kbd className="shrink-0 rounded-md border border-line px-1.5 font-mono text-xs text-muted">{command.hint}</kbd>
                )}
                <EnterHint />
              </Command.Item>
            ))}
          </Command.Group>
        ) : null}
      </Command.List>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line px-4 py-2 font-mono text-[11px] text-muted">
        <span>↑↓ navegar</span>
        <span>↵ abrir</span>
        <span>Ctrl+↵ copiar</span>
        {loading && prompts.length > 0 ? <span className="ml-auto">buscando…</span> : null}
      </div>
    </Command.Dialog>
  );
}
