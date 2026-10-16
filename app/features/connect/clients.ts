// Como conectar cada app de IA ao servidor MCP. Todos fazem o login pelo navegador
// (OAuth): basta o endereço, sem token.

export const SERVER_NAME = "nelcota";

export type ClientId = "claude-code" | "claude" | "cursor" | "vscode" | "codex" | "gemini" | "other";

export type ClientGuide = {
  id: ClientId;
  label: string;
  // Botão que instala com um clique (abre o app).
  install?: { label: string; href: string };
  // Comando para colar no terminal.
  command?: string;
  steps: string[];
};

export function mcpUrl(origin: string): string {
  return `${origin}/mcp`;
}

// Deeplinks oficiais de instalação de servidor MCP.
export function cursorInstallUrl(url: string): string {
  const config = btoa(JSON.stringify({ url }));

  return `cursor://anysphere.cursor-deeplink/mcp/install?${new URLSearchParams({ name: SERVER_NAME, config }).toString()}`;
}

export function vscodeInstallUrl(url: string): string {
  return `vscode:mcp/install?${encodeURIComponent(JSON.stringify({ name: SERVER_NAME, type: "http", url }))}`;
}

export function clientGuides(origin: string): ClientGuide[] {
  const url = mcpUrl(origin);

  return [
    {
      id: "claude-code",
      label: "Claude Code",
      command: `claude mcp add --scope user --transport http ${SERVER_NAME} ${url}`,
      steps: [
        "Rode o comando acima no terminal (vale para todos os seus projetos).",
        "Abra o Claude Code, digite /mcp, escolha nelcota e entre pelo navegador.",
        "Pronto: peça “busca no Nelcota um prompt de code review”, ou use os prompts como comandos (/mcp__nelcota__…).",
      ],
    },
    {
      id: "claude",
      label: "Claude (app e site)",
      steps: [
        "No Claude, abra Configurações → Conectores → Adicionar conector personalizado.",
        `Nome: Nelcota Prompts. URL: ${url}`,
        "Clique em Conectar e entre pelo navegador.",
      ],
    },
    {
      id: "cursor",
      label: "Cursor",
      install: { label: "Adicionar ao Cursor", href: cursorInstallUrl(url) },
      steps: ["Clique no botão acima e confirme no Cursor.", "Em Settings → MCP, clique em Connect ao lado de nelcota e entre pelo navegador."],
    },
    {
      id: "vscode",
      label: "VS Code",
      install: { label: "Adicionar ao VS Code", href: vscodeInstallUrl(url) },
      steps: ["Clique no botão acima e confirme a instalação no VS Code.", "Quando o VS Code pedir, entre pelo navegador. Use no chat do Copilot, no modo Agent."],
    },
    {
      id: "codex",
      label: "Codex",
      command: `codex mcp add ${SERVER_NAME} --url ${url}`,
      steps: ["Rode o comando acima no terminal.", `O navegador abre para você entrar (se não abrir, rode codex mcp login ${SERVER_NAME}). Depois é só usar no Codex.`],
    },
    {
      id: "gemini",
      label: "Gemini CLI",
      command: `gemini mcp add --scope user --transport http ${SERVER_NAME} ${url}`,
      steps: ["Rode o comando acima no terminal.", "No Gemini CLI, digite /mcp auth nelcota e entre pelo navegador."],
    },
    {
      id: "other",
      label: "Outro",
      steps: [
        `Adicione um servidor MCP do tipo HTTP (Streamable HTTP) com a URL ${url}.`,
        "Se o app entra pelo navegador (OAuth), é só isso.",
        "Se ele só aceita cabeçalho, crie um token abaixo e mande Authorization: Bearer <token>.",
      ],
    },
  ];
}
