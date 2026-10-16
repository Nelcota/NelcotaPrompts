import { Check, Copy } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { copyText } from "~/shared/lib/copy-text";
import type { Prompt } from "~/features/prompts/types";
import { fillVariables, ownValue, readRememberedValues, rememberValues, type VariableSpec } from "~/features/prompts/variables";
import { Dialog } from "~/shared/ui/dialog";
import { HighlightedVariables } from "./highlighted-variables";
import { buttonClass, inputClass, labelClass } from "~/shared/ui/styles";

export type VariablesTarget = { prompt: Prompt; body: string; specs: VariableSpec[] };

type VariablesDialogProps = {
  target: VariablesTarget | null;
  onClose: () => void;
  onCopied: (prompt: Prompt) => void;
};

// Começa com o último valor usado em cada variável (neste navegador) ou o padrão do prompt.
function initialValues(specs: VariableSpec[]): Record<string, string> {
  const remembered = readRememberedValues();

  return Object.fromEntries(specs.map((spec) => [spec.name, ownValue(remembered, spec.name) ?? spec.defaultValue ?? ""]));
}

// Preenche as {variáveis} do prompt antes de copiar, com prévia ao vivo.
export function VariablesDialog({ target, onClose, onCopied }: VariablesDialogProps) {
  // O diálogo é remontado a cada prompt (key no pai), então o estado inicial basta.
  const [values, setValues] = useState<Record<string, string>>(() => (target === null ? {} : initialValues(target.specs)));
  const [copied, setCopied] = useState(false);
  const closeTimer = useRef(0);

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);
  const filled = useMemo(() => (target === null ? "" : fillVariables(target.body, values)), [target, values]);

  if (target === null) {
    return <Dialog open={false} onClose={onClose} label="Preencher variáveis" />;
  }

  const missing = target.specs.filter((spec) => spec.defaultValue === null && (ownValue(values, spec.name) ?? "").trim() === "");

  const copy = async () => {
    // Enter duas vezes (ou Enter + clique) não copia nem conta duas vezes.
    if (copied) {
      return;
    }

    const ok = await copyText(filled, `“${target.prompt.title}” copiado.`);

    if (!ok) {
      return;
    }

    setCopied(true);
    // Só o que a pessoa escolheu vira "último valor". O padrão deste prompt (ou o campo
    // vazio) não vira, para não passar por cima do padrão de outro prompt com a mesma
    // variável; e esquece o valor antigo, que senão voltaria na próxima cópia.
    rememberValues(
      Object.fromEntries(
        target.specs.map((spec) => {
          const value = ownValue(values, spec.name) ?? "";

          return [spec.name, value === spec.defaultValue ? "" : value];
        }),
      ),
    );
    onCopied(target.prompt);
    closeTimer.current = window.setTimeout(onClose, 700);
  };

  return (
    <Dialog open onClose={onClose} label="Preencher variáveis">
      <h2 className="font-display pr-8 text-3xl font-light tracking-tight">Preencher e copiar</h2>
      <p className="mt-1 text-base text-muted">{target.prompt.title}</p>
      <form
        className="mt-6 space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void copy();
        }}
      >
        {target.specs.map(({ name, defaultValue }, index) => (
          <label key={name} className="block">
            <span className="flex items-baseline justify-between gap-3 font-mono text-sm text-muted">
              {`{${name}}`}
              {defaultValue === null ? null : <span className="truncate text-xs">padrão: {defaultValue}</span>}
            </span>
            <input
              data-autofocus={index === 0 ? true : undefined}
              value={ownValue(values, name) ?? ""}
              maxLength={2000}
              placeholder={defaultValue ?? undefined}
              onChange={(event) => {
                const next = event.target.value;
                setValues((previous) => ({ ...previous, [name]: next }));
              }}
              onFocus={(event) => event.currentTarget.select()}
              className={inputClass("canvas", "mt-1.5")}
            />
          </label>
        ))}
        <div>
          <span className={labelClass}>Prévia</span>
          <pre className="mt-1.5 max-h-[30dvh] overflow-auto rounded-2xl border border-line bg-canvas p-4 font-mono text-[15px] leading-relaxed whitespace-pre-wrap">
            <HighlightedVariables text={filled} />
          </pre>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <span className="text-sm text-muted">
            {missing.length === 0 ? "Tudo preenchido." : `Faltam ${missing.length}. Os vazios ficam como estão.`}
          </span>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className={buttonClass("ghost")}>
              Cancelar
            </button>
            <button type="submit" className={buttonClass("primary")}>
              {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
              {copied ? "Copiado" : "Copiar preenchido"}
            </button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}
