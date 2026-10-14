import { z } from "zod";

import type { FieldErrors } from "./action-result";

// Validação de formulários com zod: o mesmo schema roda no navegador (aviso antes de
// enviar) e no servidor (que é quem decide).

export type SchemaResult<T> = { ok: true; data: T } | { ok: false; errors: FieldErrors };

// Algo que aparece na tela. trim() já tira espaços, NBSP e BOM, mas não os caracteres de
// formatação invisíveis (zero-width space/joiner, marcas de direção): "\u200B" passaria
// como nome ou título preenchido e sairia em branco.
const VISIBLE = /[^\s\p{Cf}]/u;

export function hasVisibleText(value: string): boolean {
  return VISIBLE.test(value);
}

// Texto obrigatório: sem espaços nas pontas; vazio, ausente ou só invisível dá a mensagem.
export function requiredText(message: string) {
  return z.string({ error: message }).trim().min(1, message).refine(hasVisibleText, message);
}

// Senha não passa por trim (espaços nas pontas fazem parte dela), mas só espaços é vazio.
export function secret(message: string) {
  return z.string({ error: message }).refine((value) => value.trim() !== "", message);
}

// Campos do formulário como objeto (arquivos ficam de fora; quem recebe arquivo lê à parte).
export function formToObject(form: FormData): Record<string, string> {
  const entries: [string, string][] = [];

  form.forEach((value, key) => {
    if (typeof value === "string") {
      entries.push([key, value]);
    }
  });

  return Object.fromEntries(entries);
}

// Primeiro erro de cada campo, no formato que as telas mostram ({ campo: mensagem }).
export function parseWithSchema<T>(schema: z.ZodType<T>, input: unknown): SchemaResult<T> {
  const result = schema.safeParse(input);

  if (result.success) {
    return { ok: true, data: result.data };
  }

  const errors: FieldErrors = {};

  for (const issue of result.error.issues) {
    const field = String(issue.path[0] ?? "form");
    errors[field] ??= issue.message;
  }

  return { ok: false, errors };
}
