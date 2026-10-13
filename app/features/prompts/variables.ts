import { readStorage, writeStorage } from "~/shared/lib/storage";

// Variáveis no corpo do prompt: {tema}, {idioma de saída}, {nome_do_cliente}...
// Até 40 caracteres, começando por letra/número, sem chaves ou quebra de linha dentro.
// Valor padrão opcional depois de "=": {linguagem=TypeScript} (até 200 caracteres).
const VARIABLE_PATTERN = /\{([\p{L}\p{N}_][\p{L}\p{N}_ -]{0,39})(?:=([^{}\n]{0,200}))?\}/gu;

export type VariableSpec = { name: string; defaultValue: string | null };

// Uma entrada por nome, na ordem em que aparecem. Se o mesmo nome aparece com padrões
// diferentes, vale o primeiro padrão encontrado.
export function extractVariableSpecs(body: string): VariableSpec[] {
  const specs = new Map<string, VariableSpec>();

  for (const match of body.matchAll(VARIABLE_PATTERN)) {
    const name = match[1]?.trim() ?? "";

    if (name === "") {
      continue;
    }

    const rawDefault = match[2]?.trim();
    const defaultValue = rawDefault === undefined || rawDefault === "" ? null : rawDefault;
    const existing = specs.get(name);

    if (existing === undefined) {
      specs.set(name, { name, defaultValue });
    } else if (existing.defaultValue === null && defaultValue !== null) {
      existing.defaultValue = defaultValue;
    }
  }

  return [...specs.values()];
}

export function extractVariables(body: string): string[] {
  return extractVariableSpecs(body).map((spec) => spec.name);
}

// Mesma regra no navegador e na coluna has_variables do banco.
export function hasVariables(body: string): boolean {
  return extractVariableSpecs(body).length > 0;
}

// Valor vazio usa o padrão da variável (de qualquer ocorrência dela); sem padrão, o
// {trecho} fica como está.
export function fillVariables(body: string, values: Record<string, string>): string {
  const defaults = new Map(extractVariableSpecs(body).map((spec) => [spec.name, spec.defaultValue]));

  return body.replace(VARIABLE_PATTERN, (whole, rawName: string) => {
    const name = rawName.trim();
    const value = values[name];

    if (value !== undefined && value.trim() !== "") {
      return value;
    }

    return defaults.get(name) ?? whole;
  });
}

export type BodyPart = { kind: "text" | "variable"; value: string };

// Quebra o texto em partes para destacar as variáveis na leitura.
export function splitVariables(body: string): BodyPart[] {
  const parts: BodyPart[] = [];
  let cursor = 0;

  for (const match of body.matchAll(VARIABLE_PATTERN)) {
    const start = match.index;

    if (start > cursor) {
      parts.push({ kind: "text", value: body.slice(cursor, start) });
    }

    parts.push({ kind: "variable", value: match[0] });
    cursor = start + match[0].length;
  }

  if (cursor < body.length) {
    parts.push({ kind: "text", value: body.slice(cursor) });
  }

  return parts;
}

const REMEMBERED_KEY = "nelcota:variables";
const REMEMBERED_MAX = 200;

// Último valor usado em cada variável (por nome, em qualquer prompt), só neste navegador.
export function readRememberedValues(): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(readStorage(REMEMBERED_KEY) ?? "null");

    if (typeof parsed !== "object" || parsed === null) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
    );
  } catch {
    return {};
  }
}

export function rememberValues(values: Record<string, string>) {
  const filled = Object.entries(values).filter(([, value]) => value.trim() !== "");

  if (filled.length === 0) {
    return;
  }

  // Os usados agora vão para o fim; os mais antigos saem quando passa do limite.
  const previous = Object.entries(readRememberedValues()).filter(([name]) => !(name in values));
  const merged = [...previous, ...filled].slice(-REMEMBERED_MAX);
  writeStorage(REMEMBERED_KEY, JSON.stringify(Object.fromEntries(merged)));
}
