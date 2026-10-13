// Formatação em português, igual no servidor e no navegador. Fuso fixo: servidor (UTC) e
// navegador formatam igual, sem erro de hidratação perto da meia-noite. A turma é do Brasil.
const TIME_ZONE = "America/Sao_Paulo";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: TIME_ZONE });
const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TIME_ZONE,
});

// "" para data inválida.
export function formatDate(iso: string): string {
  const date = new Date(iso);

  return Number.isNaN(date.getTime()) ? "" : dateFormatter.format(date);
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);

  return Number.isNaN(date.getTime()) ? "" : dateTimeFormatter.format(date);
}

// "1 prompt" / "3 prompts", com separador de milhar.
export function plural(count: number, one: string, many: string): string {
  return `${count.toLocaleString("pt-BR")} ${count === 1 ? one : many}`;
}
