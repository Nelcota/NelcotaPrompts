import { usePersistedState } from "~/shared/hooks/use-persisted-state";
import { plural } from "~/shared/lib/format";
import { extractVariableSpecs } from "~/features/prompts/variables";
import { HighlightedVariables } from "~/features/prompts/components/highlighted-variables";
import { MarkdownBody } from "~/features/prompts/components/markdown-body";

const FORMATS = ["markdown", "raw"] as const;

const FORMAT_BUTTON =
  "rounded-md px-1.5 py-0.5 transition hover:text-ink aria-pressed:bg-ink/10 aria-pressed:text-ink";

// Estimativa grosseira (~4 caracteres por token), só para ter noção do tamanho.
function sizeLabel(text: string): string {
  return `${text.length.toLocaleString("pt-BR")} chars · ≈${Math.ceil(text.length / 4).toLocaleString("pt-BR")} tokens`;
}

// Corpo do prompt como bloco de editor: barra com as variáveis e o tamanho, e leitura em
// Markdown ou texto cru (preferência guardada no navegador).
export function PromptBodyViewer({ body, excerpt }: { body: string | null; excerpt: string }) {
  const [format, setFormat] = usePersistedState("nelcota:body-format", "markdown", FORMATS);
  const variables = body === null ? [] : extractVariableSpecs(body);
  const text = body ?? `${excerpt}…`;

  return (
    <div className="mt-5 overflow-hidden rounded-2xl border border-line bg-canvas">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 border-b border-line px-4 py-2 font-mono text-xs text-muted">
        {variables.length > 0 ? (
          <div className="flex min-w-0 flex-wrap items-center gap-1.5" title="Ao copiar, você preenche cada variável.">
            <span>{plural(variables.length, "variável", "variáveis")}</span>
            {variables.map(({ name, defaultValue }) => (
              <span key={name} className="rounded bg-amber-300/20 px-1 text-ink">
                {`{${name}`}
                {defaultValue === null ? null : <span className="text-muted">={defaultValue}</span>}
                {"}"}
              </span>
            ))}
          </div>
        ) : (
          <span>sem variáveis</span>
        )}
        <div className="flex items-center gap-3">
          {body === null ? null : <span className="tabular-nums">{sizeLabel(body)}</span>}
          <div role="group" aria-label="Formato de leitura" className="flex gap-0.5">
            <button type="button" aria-pressed={format === "markdown"} onClick={() => setFormat("markdown")} className={FORMAT_BUTTON}>
              MD
            </button>
            <button type="button" aria-pressed={format === "raw"} onClick={() => setFormat("raw")} className={FORMAT_BUTTON}>
              Texto
            </button>
          </div>
        </div>
      </div>
      {format === "markdown" ? (
        <div className="max-h-[45dvh] overflow-auto p-4">
          <MarkdownBody text={text} />
        </div>
      ) : (
        <pre className="max-h-[45dvh] overflow-auto p-4 font-mono text-[15px] leading-relaxed whitespace-pre-wrap">
          <HighlightedVariables text={text} />
        </pre>
      )}
    </div>
  );
}
