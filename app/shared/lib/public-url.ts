// Endereço público do app (https://prompts.seudominio.com), para logs e links gerados no
// terminal. APP_URL manda; sem ela, vale o domínio que o Coolify injeta no container
// (COOLIFY_URL, que pode trazer vários separados por vírgula). null = nenhum configurado.

// Só a origem (protocolo + host) de uma URL http(s); null se não for uma.
export function toOrigin(raw: string | undefined): string | null {
  const trimmed = raw?.trim() ?? "";

  if (trimmed === "") {
    return null;
  }

  try {
    const url = new URL(trimmed);

    return url.protocol === "http:" || url.protocol === "https:" ? url.origin : null;
  } catch {
    return null;
  }
}

export function publicUrl(env: Record<string, string | undefined> = process.env): string | null {
  return toOrigin(env.APP_URL) ?? toOrigin(env.COOLIFY_URL?.split(",")[0]);
}
