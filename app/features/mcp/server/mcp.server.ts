import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { GetPromptRequestSchema, ListPromptsRequestSchema, McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import type { ApiCaller } from "~/features/api-tokens/server/api-tokens.server";
import { promptInputSchema, SEARCH_MAX } from "~/features/prompts/prompt-rules";
import { countCopy } from "~/features/prompts/server/prompt-actions.server";
import {
  createPrompt,
  getPromptBody,
  findPromptsByIdPrefix,
  getPromptById,
  listPromptIndex,
  listPrompts,
  listTags,
  type OwnershipResult,
  purgeExpiredTrash,
  restorePrompt,
  trashPrompt,
  updatePrompt,
} from "~/features/prompts/server/prompts.server";
import type { Prompt } from "~/features/prompts/types";
import { extractVariableSpecs, fillVariables } from "~/features/prompts/variables";
import { slugify } from "~/shared/lib/slug";

// Servidor MCP: uma IA (Claude Code, Cursor, Claude Desktop…) usa o mural em nome do dono
// do token. Quatro ferramentas (buscar, ler, salvar, apagar); cada prompt do mural também
// aparece como "prompt" MCP (vira comando de barra no cliente), com as variáveis como
// argumentos. Um servidor novo por requisição (sem estado): o usuário vem do token.

const VERSION = "1.0.0";
const SEARCH_LIMIT_MAX = 50;
// Prompts expostos como comandos (os mais recentes).
const PROMPT_INDEX_MAX = 200;

const INSTRUCTIONS = `Nelcota Prompts é uma biblioteca de prompts compartilhada por uma equipe.
- Busque com search_prompts e leia o texto inteiro com get_prompt (a lista traz só um trecho).
- Variáveis no texto: {nome} ou {nome=padrão}. Passe "variables" no get_prompt para receber o texto preenchido; sem valor, vale o padrão.
- Para levar um prompt para outro projeto, leia com get_prompt e grave o texto onde o projeto pedir (ex.: .claude/commands/<nome>.md, AGENTS.md, CLAUDE.md, um arquivo de prompt do código).
- Ao criar ou editar: título até 120 caracteres, corpo em Markdown até 20.000, até 8 tags (letras, números e hífen).
- save_prompt cria (sem id) ou edita (com id, só o que muda). Só o autor edita ou apaga um prompt; apagar manda para a lixeira por 7 dias (delete_prompt com undo: true desfaz).`;

const OWNERSHIP_ERRORS: Record<Exclude<OwnershipResult, "ok">, string> = {
  not_found: "Prompt não encontrado (pode ter sido apagado).",
  forbidden: "Só o autor pode alterar esse prompt.",
};

type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };

function ok(value: unknown): ToolResult {
  return { content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }] };
}

function fail(message: string): ToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

function ownership(result: OwnershipResult, message: string, id: string): ToolResult {
  return result === "ok" ? ok({ id, message }) : fail(OWNERSHIP_ERRORS[result]);
}

// O que a lista mostra de cada prompt (sem foto, favorito do card etc.).
function summary(prompt: Prompt) {
  return {
    id: prompt.id,
    title: prompt.title,
    tags: prompt.tags,
    author: prompt.authorName,
    excerpt: prompt.truncated ? `${prompt.excerpt}…` : prompt.excerpt,
    hasVariables: prompt.hasVariables,
    copyCount: prompt.copyCount,
    isFavorite: prompt.isFavorite,
    updatedAt: prompt.updatedAt,
  };
}

// Mesmo schema do formulário (tags chegam como lista; o formulário usa "a, b").
function validateInput(input: { title: string; body: string; tags: string[] }) {
  const parsed = promptInputSchema.safeParse({ ...input, tags: input.tags.join(",") });

  return parsed.success ? { ok: true as const, data: parsed.data } : { ok: false as const, message: [...new Set(parsed.error.issues.map((issue) => issue.message))].join(" ") };
}

// Nome do prompt MCP: legível e único (o começo do id desempata títulos iguais).
export function mcpPromptName(prompt: { id: string; title: string }): string {
  return `${slugify(prompt.title)}-${prompt.id.slice(0, 8)}`;
}

const id = z.string().uuid().describe("Id do prompt (uuid).");
// Tags mostradas junto da busca, para a IA saber como o mural se organiza.
const TAGS_SHOWN = 30;

function registerReadTools(server: McpServer, caller: ApiCaller) {
  const viewerId = caller.userId;

  server.registerTool(
    "search_prompts",
    {
      title: "Buscar prompts",
      description:
        "Busca no mural (sem acento, tolera erro de digitação). Sem filtros, lista os mais recentes e as tags em uso. Devolve um trecho de cada prompt; use get_prompt para o texto inteiro.",
      inputSchema: {
        query: z.string().max(SEARCH_MAX).optional().describe("Texto a buscar no título, tags e corpo."),
        tag: z.string().optional().describe("Só prompts com esta tag."),
        mine: z.boolean().optional().describe("Só os prompts criados por mim."),
        favorites: z.boolean().optional().describe("Só os meus favoritos."),
        popular: z.boolean().optional().describe("Ordena pelos mais copiados."),
        limit: z.number().int().min(1).max(SEARCH_LIMIT_MAX).optional().describe(`Quantos resultados (padrão 20, até ${SEARCH_LIMIT_MAX}).`),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) => {
      const search = args.query?.trim() ?? "";
      const tag = args.tag?.trim().toLowerCase().replace(/^#/, "") ?? "";
      const filters = {
        search: search === "" ? null : search,
        tag: tag === "" ? null : tag,
        authorId: args.mine === true ? viewerId : null,
        favoritesOnly: args.favorites === true,
        sort: args.popular === true ? ("popular" as const) : ("recent" as const),
      };
      // As tags (varrem o mural todo) vão só na primeira olhada, sem filtro: é quando a IA
      // ainda não sabe como o mural se organiza.
      const exploring = filters.search === null && filters.tag === null && filters.authorId === null && !filters.favoritesOnly;
      const [{ prompts, total }, tags] = await Promise.all([listPrompts(viewerId, filters, args.limit ?? 20), exploring ? listTags() : null]);

      return ok({ total, prompts: prompts.map(summary), ...(tags === null ? {} : { tags: tags.slice(0, TAGS_SHOWN).map((entry) => entry.tag) }) });
    },
  );

  server.registerTool(
    "get_prompt",
    {
      title: "Ler prompt",
      description:
        "Texto inteiro de um prompt (Markdown), com as variáveis e seus padrões. Com \"variables\", devolve o texto já preenchido. Use para levar o prompt a outro projeto.",
      inputSchema: {
        id,
        variables: z.record(z.string(), z.string()).optional().describe("Valores das variáveis, ex.: {\"linguagem\": \"Go\"}. Vazio usa o padrão."),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) => {
      const [prompt, body] = await Promise.all([getPromptById(viewerId, args.id), getPromptBody(args.id)]);

      if (prompt === null || body === null) {
        return fail(OWNERSHIP_ERRORS.not_found);
      }

      // Ler não conta como cópia: a IA lê vários para comparar ou antes de editar, e isso
      // inflaria o "Mais copiados". Conta o uso de fato (o comando de barra, em prompts/get).
      const { excerpt: _excerpt, ...meta } = summary(prompt);

      return ok({
        ...meta,
        variables: extractVariableSpecs(body),
        body: args.variables === undefined ? body : fillVariables(body, args.variables),
      });
    },
  );
}

function registerWriteTools(server: McpServer, caller: ApiCaller) {
  const userId = caller.userId;

  server.registerTool(
    "save_prompt",
    {
      title: "Salvar prompt",
      description:
        "Sem id, publica um prompt novo. Com id, edita um prompt seu: mande só o que muda (a versão anterior vai para o histórico).",
      inputSchema: {
        id: id.optional().describe("Id do prompt a editar. Omita para criar."),
        title: z.string().optional().describe("Título (até 120 caracteres). Obrigatório ao criar."),
        body: z.string().optional().describe("Texto em Markdown (até 20.000). Variáveis: {nome} ou {nome=padrão}. Obrigatório ao criar."),
        tags: z.array(z.string()).optional().describe("Tags, ex.: [\"review\", \"typescript\"]. Ao editar, substitui todas."),
      },
    },
    async (args) => {
      if (args.id === undefined) {
        const input = validateInput({ title: args.title ?? "", body: args.body ?? "", tags: args.tags ?? [] });

        if (!input.ok) {
          return fail(input.message);
        }

        const created = await createPrompt(userId, input.data);

        return created === null ? fail("Não foi possível salvar agora.") : ok({ id: created.id, message: "Prompt publicado." });
      }

      const [current, body] = await Promise.all([getPromptById(userId, args.id), getPromptBody(args.id)]);

      if (current === null || body === null) {
        return fail(OWNERSHIP_ERRORS.not_found);
      }

      const input = validateInput({ title: args.title ?? current.title, body: args.body ?? body, tags: args.tags ?? current.tags });

      if (!input.ok) {
        return fail(input.message);
      }

      return ownership(await updatePrompt(args.id, userId, input.data), "Prompt atualizado.", args.id);
    },
  );

  server.registerTool(
    "delete_prompt",
    {
      title: "Apagar prompt",
      description: "Manda um prompt seu para a lixeira (fica 7 dias). Com undo: true, desfaz: tira da lixeira.",
      inputSchema: { id, undo: z.boolean().optional().describe("true restaura um prompt que você apagou.") },
      annotations: { destructiveHint: true },
    },
    async (args) => {
      if (args.undo === true) {
        return ownership(await restorePrompt(args.id, userId), "Prompt restaurado.", args.id);
      }

      const result = await trashPrompt(args.id, userId);

      if (result === "ok") {
        await purgeExpiredTrash().catch((error: unknown) => console.error("Falha ao limpar a lixeira:", error));
      }

      return ownership(result, "Prompt apagado (delete_prompt com undo: true desfaz por 7 dias).", args.id);
    },
  );
}

// Cada prompt do mural como prompt MCP. Fica no servidor de baixo nível porque a lista
// muda a cada requisição (o McpServer registra prompts fixos).
function registerLibraryPrompts(server: McpServer, caller: ApiCaller) {
  server.server.registerCapabilities({ prompts: {} });

  server.server.setRequestHandler(ListPromptsRequestSchema, async () => {
    const index = await listPromptIndex(PROMPT_INDEX_MAX);

    return {
      prompts: index.map((prompt) => ({
        name: mcpPromptName(prompt),
        title: prompt.title,
        description: prompt.title,
        arguments: extractVariableSpecs(prompt.body).map((spec) => ({
          name: spec.name,
          description: spec.defaultValue === null ? undefined : `Padrão: ${spec.defaultValue}`,
          required: false,
        })),
      })),
    };
  });

  // O nome termina no começo do id: busca direto por ele (vale também para prompts que já
  // saíram dos 200 mais recentes da lista, se o cliente guardou o nome).
  server.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const prefix = request.params.name.slice(-8);
    const candidates = await findPromptsByIdPrefix(prefix);
    // Título trocado depois que o cliente guardou o nome: vale o id, se só um bate.
    const prompt = candidates.find((candidate) => mcpPromptName(candidate) === request.params.name) ?? (candidates.length === 1 ? candidates[0] : undefined);

    if (prompt === undefined) {
      throw new McpError(ErrorCode.InvalidParams, `Prompt não encontrado: ${request.params.name}`);
    }

    await countCopy(caller.userId, prompt.id);

    return {
      description: prompt.title,
      messages: [{ role: "user", content: { type: "text", text: fillVariables(prompt.body, request.params.arguments ?? {}) } }],
    };
  });
}

export function createMcpServer(caller: ApiCaller): McpServer {
  const server = new McpServer({ name: "nelcota-prompts", title: "Nelcota Prompts", version: VERSION }, { instructions: INSTRUCTIONS });

  registerReadTools(server, caller);

  if (caller.access === "write") {
    registerWriteTools(server, caller);
  }

  registerLibraryPrompts(server, caller);

  return server;
}
