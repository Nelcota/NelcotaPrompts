const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Ids do banco são UUID: validar antes de consultar evita erro de cast no Postgres.
export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

// Um id vindo de URL, parâmetro de rota ou formulário: com espaços nas pontas, vazio ou
// fora do formato vira null. Sai em minúsculas, a forma canônica: o Postgres ignora a
// caixa do uuid, mas comparações no código (=== , chaves de limite, jsonb) não.
export function parseUuid(value: string | null | undefined): string | null {
  const trimmed = value?.trim().toLowerCase() ?? "";

  return trimmed !== "" && isUuid(trimmed) ? trimmed : null;
}
