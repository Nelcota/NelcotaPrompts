import { z } from "zod";

import { requiredText } from "~/shared/lib/form-schema";

// Limites do prompt, compartilhados entre o formulário (dica no navegador) e a
// validação no servidor (que é quem decide).
export const TITLE_MAX = 120;
export const BODY_MAX = 20_000;
export const TAGS_MAX = 8;
export const TAG_MAX_LENGTH = 24;
// Busca (mural, palette e painel admin).
export const SEARCH_MAX = 100;

export type PromptInput = { title: string; body: string; tags: string[] };

export type PromptSort = "recent" | "popular";

// Ações da home (campo "intent" do formulário). O servidor tem um handler para cada uma.
export const PROMPT_INTENTS = ["create", "update", "delete", "restore", "restoreVersion", "favorite", "copied"] as const;

export type PromptIntent = (typeof PROMPT_INTENTS)[number];

const TAG_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N}-]*$/u;

// "código, #Review , review" → ["código", "review"]: minúsculas, sem #, sem repetição.
const tagsSchema = z
  .string()
  .optional()
  .transform((raw) => [...new Set((raw ?? "").split(",").map((piece) => piece.trim().toLowerCase().replace(/^#/, "")).filter((piece) => piece !== ""))])
  .superRefine((tags, context) => {
    const issue = (message: string) => context.addIssue({ code: "custom", message });

    if (tags.length > TAGS_MAX) {
      issue(`Use no máximo ${TAGS_MAX} tags.`);
    }

    const tooLong = tags.find((tag) => tag.length > TAG_MAX_LENGTH);

    if (tooLong !== undefined) {
      issue(`A tag "${tooLong}" passa de ${TAG_MAX_LENGTH} caracteres.`);
    }

    const invalid = tags.find((tag) => !TAG_PATTERN.test(tag));

    if (invalid !== undefined) {
      issue(`A tag "${invalid}" só pode ter letras, números e hífen.`);
    }
  });

// Formulário de prompt (criar e editar): navegador e servidor validam com o mesmo schema.
export const promptInputSchema = z.object({
  title: requiredText("Dê um título ao prompt.").max(TITLE_MAX, `O título pode ter até ${TITLE_MAX} caracteres.`),
  body: requiredText("O prompt não pode ficar vazio.").max(BODY_MAX, `O prompt pode ter até ${BODY_MAX.toLocaleString("pt-BR")} caracteres.`),
  tags: tagsSchema,
}) satisfies z.ZodType<PromptInput>;
