import { ArrowLeft, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useFetcher } from "react-router";

import { useFetcherResult } from "~/shared/hooks/use-fetcher-result";
import { type DiffLine, diffLines } from "~/features/prompts/diff";
import { formatDateTime, plural } from "~/shared/lib/format";
import { HOME_ACTION } from "~/features/prompts/list-query";
import type { PromptIntent } from "~/features/prompts/prompt-rules";
import type { Prompt, PromptActionData, PromptVersion } from "~/features/prompts/types";
import { cn } from "~/shared/ui/cn";

type PromptHistoryProps = {
  prompt: Prompt;
  currentBody: string;
  isOwner: boolean;
  onBack: () => void;
  onRestored: () => void;
};

type LoadState = { status: "loading" } | { status: "failed" } | { status: "ready"; versions: PromptVersion[] };

// Linhas iguais em volta de cada mudança; o resto vira "⋯ N linhas iguais".
const CONTEXT = 2;

const RESTORE_VERSION: PromptIntent = "restoreVersion";

function isVersionList(value: unknown): value is { versions: PromptVersion[] } {
  return typeof value === "object" && value !== null && "versions" in value && Array.isArray(value.versions);
}

type DiffRow = DiffLine | { kind: "skip"; count: number };

function collapse(lines: DiffLine[]): DiffRow[] {
  const keep = lines.map((line) => line.kind !== "same");

  lines.forEach((line, index) => {
    if (line.kind === "same") {
      return;
    }

    for (let offset = -CONTEXT; offset <= CONTEXT; offset += 1) {
      const target = index + offset;

      if (target >= 0 && target < lines.length) {
        keep[target] = true;
      }
    }
  });

  const rows: DiffRow[] = [];
  let skipped = 0;

  lines.forEach((line, index) => {
    if (keep[index]) {
      if (skipped > 0) {
        rows.push({ kind: "skip", count: skipped });
        skipped = 0;
      }

      rows.push(line);

      return;
    }

    skipped += 1;
  });

  if (skipped > 0) {
    rows.push({ kind: "skip", count: skipped });
  }

  return rows;
}

const ROW_CLASS: Record<DiffLine["kind"], string> = {
  same: "text-muted",
  added: "bg-emerald-500/15 text-ink",
  removed: "bg-rose-500/15 text-ink",
};

// Palavras alteradas dentro da linha ganham um fundo mais forte.
const CHANGED_WORD: Record<"added" | "removed", string> = {
  added: "rounded-sm bg-emerald-500/35",
  removed: "rounded-sm bg-rose-500/35",
};

function LineText({ line }: { line: DiffLine }) {
  if (line.text === "") {
    return " ";
  }

  if (line.segments === undefined || line.kind === "same") {
    return line.text;
  }

  const changedClass = CHANGED_WORD[line.kind];

  return (
    <>
      {line.segments.map((segment, index) =>
        segment.changed ? (
          <span key={index} className={changedClass}>
            {segment.text}
          </span>
        ) : (
          segment.text
        ),
      )}
    </>
  );
}

const ROW_SIGN: Record<DiffLine["kind"], string> = { same: " ", added: "+", removed: "-" };

function DiffView({ before, after }: { before: string; after: string }) {
  const rows = useMemo(() => collapse(diffLines(before, after)), [before, after]);
  const changed = rows.some((row) => row.kind === "added" || row.kind === "removed");

  if (!changed) {
    return <p className="px-4 py-3 text-sm text-muted">O texto é igual ao atual.</p>;
  }

  return (
    <div role="list" aria-label="Diferenças" className="overflow-x-auto py-2 font-mono text-[13px] leading-relaxed">
      {rows.map((row, index) =>
        row.kind === "skip" ? (
          <div key={index} role="listitem" className="px-4 py-0.5 text-xs text-muted/70 select-none">
            ⋯ {plural(row.count, "linha igual", "linhas iguais")}
          </div>
        ) : (
          <div key={index} role="listitem" className={cn("flex gap-3 px-4", ROW_CLASS[row.kind])}>
            <span aria-hidden className="w-2 shrink-0 select-none opacity-70">
              {ROW_SIGN[row.kind]}
            </span>
            <span className="sr-only">{row.kind === "added" ? "adicionado: " : row.kind === "removed" ? "removido: " : ""}</span>
            <span className="min-w-0 whitespace-pre-wrap">
              <LineText line={row} />
            </span>
          </div>
        ),
      )}
    </div>
  );
}

// Histórico de edições: escolhe uma versão e vê o que mudou dela para a atual. O autor
// pode restaurar (a versão atual também vai para o histórico, nada se perde).
export function PromptHistory({ prompt, currentBody, isOwner, onBack, onRestored }: PromptHistoryProps) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const fetcher = useFetcher<PromptActionData>();
  const restoring = fetcher.state !== "idle";
  useFetcherResult(fetcher, { onSuccess: onRestored });

  useEffect(() => {
    let cancelled = false;

    void fetch(`/prompt/${encodeURIComponent(prompt.id)}/versoes`, { headers: { Accept: "application/json" } })
      .then(async (response) => {
        const payload: unknown = response.ok ? await response.json() : null;

        if (cancelled) {
          return;
        }

        if (!isVersionList(payload)) {
          setState({ status: "failed" });

          return;
        }

        setState({ status: "ready", versions: payload.versions });
        setSelectedId(payload.versions[0]?.id ?? null);
      })
      .catch(() => {
        if (!cancelled) {
          setState({ status: "failed" });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [prompt.id]);

  const versions = state.status === "ready" ? state.versions : [];
  const selected = versions.find((version) => version.id === selectedId) ?? null;

  return (
    <div className="mt-5">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-full py-1 pr-2 text-sm font-medium text-muted transition hover:text-ink"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Voltar ao prompt
        </button>
        <span className="font-mono text-xs text-muted">
          {state.status === "ready" ? plural(versions.length, "versão anterior", "versões anteriores") : null}
        </span>
      </div>

      {state.status === "loading" ? <p className="mt-4 text-sm text-muted">Carregando o histórico…</p> : null}
      {state.status === "failed" ? <p className="mt-4 text-sm text-danger">Não consegui carregar o histórico. Tente de novo.</p> : null}
      {state.status === "ready" && versions.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-line bg-canvas px-4 py-6 text-center text-sm text-muted">
          Este prompt ainda não foi editado. Cada edição salva a versão anterior aqui.
        </p>
      ) : null}

      {versions.length > 0 ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-[11rem_minmax(0,1fr)]">
          <ol aria-label="Versões" className="no-scrollbar flex max-h-[40dvh] gap-1.5 overflow-auto sm:flex-col">
            {versions.map((version, index) => (
              <li key={version.id} className="shrink-0">
                <button
                  type="button"
                  aria-pressed={version.id === selectedId}
                  onClick={() => setSelectedId(version.id)}
                  className="w-full rounded-xl border border-line px-3 py-2 text-left transition hover:bg-ink/5 aria-pressed:border-ink/40 aria-pressed:bg-ink/5"
                >
                  <span className="block font-mono text-xs text-muted">v{versions.length - index}</span>
                  <span className="block text-sm whitespace-nowrap">{formatDateTime(version.savedAt)}</span>
                </button>
              </li>
            ))}
          </ol>

          {selected === null ? null : (
            <div className="min-w-0 overflow-hidden rounded-2xl border border-line bg-canvas">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2">
                <span className="font-mono text-xs text-muted">versão → atual</span>
                {isOwner ? (
                  <fetcher.Form method="post" action={HOME_ACTION}>
                    <input type="hidden" name="intent" value={RESTORE_VERSION} />
                    <input type="hidden" name="id" value={prompt.id} />
                    <input type="hidden" name="versionId" value={selected.id} />
                    <button
                      type="submit"
                      disabled={restoring}
                      className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-sm font-medium transition hover:bg-ink/5 disabled:opacity-60"
                    >
                      <RotateCcw className="size-3.5" aria-hidden />
                      {restoring ? "Restaurando…" : "Restaurar esta versão"}
                    </button>
                  </fetcher.Form>
                ) : null}
              </div>
              {selected.title === prompt.title ? null : (
                <p className="border-b border-line px-4 py-2 text-sm">
                  <span className="text-muted">Título: </span>
                  <del className="text-rose-500/90">{selected.title}</del>
                  <span className="text-muted"> → </span>
                  <ins className="text-emerald-600 no-underline dark:text-emerald-400">{prompt.title}</ins>
                </p>
              )}
              <div className="max-h-[40dvh] overflow-auto">
                <DiffView before={selected.body} after={currentBody} />
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
