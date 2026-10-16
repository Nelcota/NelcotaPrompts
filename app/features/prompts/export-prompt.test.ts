import { describe, expect, test } from "bun:test";

import { aiPullRequest, promptFileName, toClaudeCommand } from "./export-prompt";

describe("exportar prompt", () => {
  test("nome do arquivo sem acento", () => {
    expect(promptFileName("Revisão: código")).toBe("revisao-codigo.md");
  });

  test("variáveis viram argumentos posicionais, repetidas com o mesmo número", () => {
    const command = toClaudeCommand("Debug: stack", "Erro em {linguagem=Go}.\n\n{trace}\n\nDe novo {linguagem}.");

    expect(command).toBe(
      '---\ndescription: "Debug: stack"\nargument-hint: "[linguagem=Go] [trace]"\n---\n\nErro em $1.\n\n$2\n\nDe novo $1.\n',
    );
  });

  test("sem variáveis não tem argument-hint", () => {
    expect(toClaudeCommand("Commit", "Escreva o commit.")).toBe('---\ndescription: "Commit"\n---\n\nEscreva o commit.\n');
  });

  test("pedido para a IA cita id e arquivo", () => {
    const text = aiPullRequest({ id: "abc", title: "Code review" });

    expect(text).toContain("abc");
    expect(text).toContain(".claude/commands/code-review.md");
  });
});
