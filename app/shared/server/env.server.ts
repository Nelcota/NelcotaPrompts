type EnvKey = "DATABASE_URL" | "SESSION_SECRET" | "INVITE_CODE";

export function readEnv(key: EnvKey): string {
  const value = process.env[key];

  if (value === undefined) {
    throw new Error(`Variável de ambiente ${key} não definida.`);
  }

  const trimmed = value.trim();

  if (trimmed === "") {
    throw new Error(`Variável de ambiente ${key} está vazia.`);
  }

  return trimmed;
}
