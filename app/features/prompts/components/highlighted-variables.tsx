import { splitVariables } from "~/features/prompts/variables";
import { variableMarkClass } from "~/shared/ui/styles";

// Texto com as {variáveis} destacadas (leitura do prompt, Markdown, prévia ao copiar).
export function HighlightedVariables({ text }: { text: string }) {
  return (
    <>
      {splitVariables(text).map((part, index) =>
        part.kind === "variable" ? (
          <mark key={index} className={variableMarkClass}>
            {part.value}
          </mark>
        ) : (
          part.value
        ),
      )}
    </>
  );
}
