import type { ActionResult, FieldErrors } from "~/shared/lib/action-result";

// Na listagem vai só um trecho do prompt; o corpo completo é carregado sob demanda
// (rota /prompt/:id) ao abrir ou copiar, para a página não carregar todos os textos inteiros.
export const EXCERPT_LENGTH = 280;

export type Prompt = {
  id: string;
  title: string;
  excerpt: string;
  truncated: boolean;
  hasVariables: boolean;
  tags: string[];
  authorId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  copyCount: number;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PromptVersion = {
  id: string;
  title: string;
  body: string;
  tags: string[];
  savedAt: string;
  replacedAt: string;
};

export type PromptActionData = ActionResult<{ promptId: string; errors: FieldErrors }>;
