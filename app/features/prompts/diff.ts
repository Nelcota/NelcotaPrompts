import { diffLines as jsDiffLines, diffWordsWithSpace } from "diff";

// Diff entre duas versões do prompt (jsdiff), por linha. Quando uma linha foi trocada por
// outra parecida, as partes alteradas dentro dela vêm marcadas (diff por palavra).

export type DiffSegment = { text: string; changed: boolean };

export type DiffLine = {
  kind: "same" | "added" | "removed";
  text: string;
  // Só em linhas alteradas que têm um par do outro lado.
  segments?: DiffSegment[];
};

function splitLines(value: string): string[] {
  const lines = value.split("\n");

  // jsdiff termina cada bloco com "\n": a última "linha" vazia não existe de verdade.
  if (lines.at(-1) === "") {
    lines.pop();
  }

  return lines;
}

// Marca palavras: no lado "removed" só o que saiu, no "added" só o que entrou.
function wordSegments(before: string, after: string): { removed: DiffSegment[]; added: DiffSegment[] } {
  const removed: DiffSegment[] = [];
  const added: DiffSegment[] = [];

  for (const part of diffWordsWithSpace(before, after)) {
    if (!part.added) {
      removed.push({ text: part.value, changed: part.removed });
    }

    if (!part.removed) {
      added.push({ text: part.value, changed: part.added });
    }
  }

  return { removed, added };
}

export function diffLines(before: string, after: string): DiffLine[] {
  // Os corpos são salvos sem quebra de linha no fim: sem isto, acrescentar uma linha
  // marcaria a última linha antiga como alterada.
  const changes = jsDiffLines(before, after, { ignoreNewlineAtEof: true });
  const lines: DiffLine[] = [];

  for (let index = 0; index < changes.length; index += 1) {
    const change = changes[index];

    if (change === undefined) {
      continue;
    }

    const next = changes[index + 1];

    // Bloco removido seguido de bloco adicionado: linha a linha, as que têm par ganham o
    // diff por palavra; as que sobram ficam inteiras.
    if (change.removed && next?.added) {
      const removedLines = splitLines(change.value);
      const addedLines = splitLines(next.value);
      const pairs = Math.min(removedLines.length, addedLines.length);
      const removed: DiffLine[] = [];
      const added: DiffLine[] = [];

      removedLines.forEach((text, line) => {
        const counterpart = addedLines[line];
        removed.push({ kind: "removed", text, segments: line < pairs && counterpart !== undefined ? wordSegments(text, counterpart).removed : undefined });
      });
      addedLines.forEach((text, line) => {
        const counterpart = removedLines[line];
        added.push({ kind: "added", text, segments: line < pairs && counterpart !== undefined ? wordSegments(counterpart, text).added : undefined });
      });

      lines.push(...removed, ...added);
      index += 1;
      continue;
    }

    const kind = change.added ? "added" : change.removed ? "removed" : "same";

    for (const text of splitLines(change.value)) {
      lines.push({ kind, text });
    }
  }

  return lines;
}
