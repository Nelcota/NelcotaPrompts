import { z } from "zod";

import type { ActionResult, FieldErrors } from "~/shared/lib/action-result";
import { requiredText } from "~/shared/lib/form-schema";

// Tokens de API (acesso de IAs pelo servidor MCP): regras compartilhadas entre o
// formulário de "Minha conta" e o servidor.
export const TOKEN_NAME_MAX = 60;
export const TOKENS_MAX = 10;
export const TOKEN_ACCESS = ["read", "write"] as const;

export type TokenAccess = (typeof TOKEN_ACCESS)[number];

export type ApiTokenSummary = {
  id: string;
  name: string;
  access: TokenAccess;
  // Conectado pelo próprio app (OAuth), e não criado à mão.
  app: boolean;
  lastUsedAt: string | null;
  createdAt: string;
};

// O token em texto só volta na resposta de "criar" (depois só o hash existe).
export type ApiTokenResult = ActionResult<{ errors: FieldErrors; token: string }>;

export const createTokenSchema = z.object({
  name: requiredText("Dê um nome ao token (ex.: Claude Code no notebook).").max(TOKEN_NAME_MAX, `O nome pode ter até ${TOKEN_NAME_MAX} caracteres.`),
  access: z.enum(TOKEN_ACCESS, { error: "Escolha o tipo de acesso." }),
});
