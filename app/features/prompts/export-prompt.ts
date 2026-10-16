import { slugify } from "~/shared/lib/slug";
import { extractVariableSpecs, fillVariables } from "./variables";

// Levar um prompt para outro projeto: como arquivo .md ou como comando de barra do
// Claude Code (.claude/commands/<nome>.md).

export function promptFileName(title: string): string {
  return `${slugify(title)}.md`;
}

// Comando do Claude Code: cada {variável} vira um argumento posicional ($1, $2…, na ordem
// em que aparecem) e o argument-hint mostra os nomes (com o padrão, quando há). Textos do
// frontmatter vão entre aspas (JSON é YAML válido): título com ":" não quebra o arquivo.
export function toClaudeCommand(title: string, body: string): string {
  const specs = extractVariableSpecs(body);
  const positions = Object.fromEntries(specs.map((spec, index) => [spec.name, `$${index + 1}`]));
  const hint = specs.map((spec) => `[${spec.defaultValue === null ? spec.name : `${spec.name}=${spec.defaultValue}`}]`).join(" ");
  const frontmatter = [`description: ${JSON.stringify(title)}`, ...(hint === "" ? [] : [`argument-hint: ${JSON.stringify(hint)}`])];

  return `---\n${frontmatter.join("\n")}\n---\n\n${fillVariables(body, positions)}\n`;
}

// Pedido para colar no chat de uma IA conectada ao servidor MCP.
export function aiPullRequest(prompt: { id: string; title: string }): string {
  return `Use o servidor MCP nelcota: pegue o prompt "${prompt.title}" (id ${prompt.id}) com get_prompt e salve neste projeto como comando em .claude/commands/${promptFileName(prompt.title)} (ou onde o projeto guardar prompts, ex.: AGENTS.md).`;
}
