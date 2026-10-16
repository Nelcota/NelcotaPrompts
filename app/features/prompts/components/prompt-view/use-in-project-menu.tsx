import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Bot, FileDown, FolderInput, Terminal } from "lucide-react";
import { toast } from "sonner";

import { aiPullRequest, promptFileName, toClaudeCommand } from "~/features/prompts/export-prompt";
import type { Prompt } from "~/features/prompts/types";
import { copyText } from "~/shared/lib/copy-text";
import { downloadText } from "~/shared/lib/download-text";
import { cn } from "~/shared/ui/cn";
import { iconButtonClass, menuContentClass, menuIconClass, menuItemClass } from "~/shared/ui/styles";

// Itens com uma linha de explicação: o ícone alinha com a primeira linha.
const menuItem = cn(menuItemClass, "items-start");
const menuIcon = cn(menuIconClass, "mt-0.5");
const menuHint = "block text-xs text-muted";

// Levar o prompt para outro projeto: comando do Claude Code, arquivo .md ou um pedido
// pronto para a IA conectada (que busca o prompt pelo MCP).
export function UseInProjectMenu({ prompt, body, iconClassName }: { prompt: Prompt; body: string | null; iconClassName: string }) {
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger title="Usar em outro projeto" aria-label="Usar em outro projeto" disabled={body === null} className={iconButtonClass({ size: "lg" })}>
        <FolderInput className={iconClassName} aria-hidden />
      </DropdownMenu.Trigger>
      {/* Sem Portal: o prompt aberto é um <dialog> modal (camada do topo), e o menu num
          portal no <body> ficaria atrás dele. */}
      <DropdownMenu.Content
        align="start"
        sideOffset={8}
        className={cn(menuContentClass, "w-72")}
      >
        <DropdownMenu.Item
          className={menuItem}
          onSelect={() => {
            if (body !== null) {
              downloadText(promptFileName(prompt.title), toClaudeCommand(prompt.title, body));
              toast.success(`Salve em .claude/commands/ do projeto e use /${promptFileName(prompt.title).slice(0, -3)}.`);
            }
          }}
        >
          <Terminal className={menuIcon} aria-hidden />
          <span>
            Baixar comando do Claude Code
            <span className={menuHint}>Variáveis viram argumentos ($1, $2…)</span>
          </span>
        </DropdownMenu.Item>
        <DropdownMenu.Item
          className={menuItem}
          onSelect={() => {
            if (body !== null) {
              downloadText(promptFileName(prompt.title), body);
            }
          }}
        >
          <FileDown className={menuIcon} aria-hidden />
          <span>
            Baixar .md
            <span className={menuHint}>O texto original, com as {"{variáveis}"}</span>
          </span>
        </DropdownMenu.Item>
        <DropdownMenu.Item className={menuItem} onSelect={() => void copyText(aiPullRequest(prompt), "Pedido copiado. Cole no chat da IA conectada.")}>
          <Bot className={menuIcon} aria-hidden />
          <span>
            Copiar pedido para a IA
            <span className={menuHint}>Ela puxa o prompt pelo MCP e salva no projeto</span>
          </span>
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}
