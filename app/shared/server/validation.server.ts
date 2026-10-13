import type { z } from "zod";

import { formToObject, parseWithSchema, type SchemaResult } from "~/shared/lib/form-schema";
import { parseUuid } from "~/shared/lib/ids";
import type { FieldErrors } from "~/shared/lib/action-result";

export type { FieldErrors };

// request.formData() lança erro com corpo malformado ou Content-Type inesperado;
// aqui isso vira null, para a action responder 400 em vez de estourar um 500.
export async function readForm(request: Request): Promise<FormData | null> {
  try {
    return await request.formData();
  } catch {
    return null;
  }
}

export const UNREADABLE_FORM = "Não foi possível ler o formulário. Recarregue a página e tente de novo.";

// formData.get pode devolver null, File ou string: só aceitamos string com conteúdo.
export function readText(form: FormData, key: string): string | null {
  const value = form.get(key);

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (trimmed === "") {
    return null;
  }

  return trimmed;
}

export function readUuid(form: FormData, key: string): string | null {
  const value = form.get(key);

  return typeof value === "string" ? parseUuid(value) : null;
}

// Texto de busca vindo da URL: sem espaços nas pontas, até max caracteres; vazio vira null.
export function readSearch(url: URL, max: number, key = "q"): string | null {
  const value = url.searchParams.get(key)?.trim().slice(0, max) ?? "";

  return value === "" ? null : value;
}

// Recusa antes de ler o corpo quando o próprio cabeçalho já mostra que é grande demais.
export function declaredTooLarge(request: Request, maxBytes: number): boolean {
  const length = Number(request.headers.get("content-length") ?? "");

  return Number.isFinite(length) && length > maxBytes;
}

// Valida o formulário inteiro com um schema zod (o mesmo que o navegador usa).
export function parseForm<T>(schema: z.ZodType<T>, form: FormData): SchemaResult<T> {
  return parseWithSchema(schema, formToObject(form));
}
