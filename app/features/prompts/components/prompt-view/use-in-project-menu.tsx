import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Bot, FileDown, FolderInput, Terminal } from "lucide-react";
import { toast } from "sonner";

import { aiPullRequest, promptFileName, toClaudeCommand } from "~/features/prompts/export-prompt";
import type { Prompt } from "~/features/prompts/types";
import { copyText } from "~/shared/lib/copy-text";
import { downloadText } from "~/shared/lib/download-text";
import { iconButtonClass } from "~/shared/ui/styles";

const menuItem =
  "flex w-full cursor-pointer items-start gap-2.5 rounded-xl px-3 py-2 text-left text-[15px] text-ink outline-none transition select-none data-[highlighted]:bg-ink/8";
const menuIcon = "mt-0.5 size-4 shrink-0 text-muted";
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
        className="menu-pop z-50 w-72 origin-(--radix-dropdown-menu-content-transform-origin) rounded-2xl border border-line bg-elevated p-1.5 text-ink shadow-2xl shadow-black/40"
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
