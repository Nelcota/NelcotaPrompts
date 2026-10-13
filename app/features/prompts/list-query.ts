import { parseUuid } from "~/shared/lib/ids";
import { type PromptSort, SEARCH_MAX, TAG_MAX_LENGTH } from "./prompt-rules";

// Estado dos filtros da home, refletido na URL (dá para compartilhar e recarregar).
// Ler (parseHomeQuery) e escrever (homeHref) ficam lado a lado para não divergirem.

export const PAGE_SIZE = 60;
export const MAX_LIMIT = 600;

// Ações da home (criar, editar, copiar, favoritar…) vão para a rota index.
export const HOME_ACTION = "/?index";

export type HomeView = "grid" | null;

export type HomeQuery = {
  search: string | null;
  tag: string | null;
  authorId: string | null;
  favorites: boolean;
  sort: PromptSort;
  view: HomeView;
  // null = só a primeira página.
  limit: number | null;
};

export type ParsedHomeUrl = HomeQuery & {
  // Prompt aberto (?p=id), se houver.
  openId: string | null;
  // Tinha ?p na URL (válido ou não): para avisar quando o link não existe mais.
  hasOpenParam: boolean;
};

function readParam(url: URL, key: string, max: number): string | null {
  const value = url.searchParams.get(key)?.trim().slice(0, max) ?? "";

  return value === "" ? null : value;
}

// ?limite= vem da URL: qualquer coisa que não seja inteiro válido volta para uma página.
function readLimit(url: URL): number | null {
  const value = Number(readParam(url, "limite", 6) ?? Number.NaN);

  if (!Number.isInteger(value) || value <= PAGE_SIZE) {
    return null;
  }

  return Math.min(value, MAX_LIMIT);
}

export function parseHomeQuery(url: URL): ParsedHomeUrl {
  return {
    search: readParam(url, "q", SEARCH_MAX),
    tag: readParam(url, "tag", TAG_MAX_LENGTH)?.toLowerCase() ?? null,
    authorId: parseUuid(url.searchParams.get("autor")),
    favorites: url.searchParams.get("favoritos") === "1",
    sort: url.searchParams.get("ordem") === "populares" ? "popular" : "recent",
    view: url.searchParams.get("view") === "grid" ? "grid" : null,
    limit: readLimit(url),
    openId: parseUuid(url.searchParams.get("p")),
    hasOpenParam: url.searchParams.has("p"),
  };
}

export function homeHref(query: HomeQuery): string {
  const params = new URLSearchParams();

  if (query.search !== null) {
    params.set("q", query.search);
  }

  if (query.tag !== null) {
    params.set("tag", query.tag);
  }

  if (query.authorId !== null) {
    params.set("autor", query.authorId);
  }

  if (query.favorites) {
    params.set("favoritos", "1");
  }

  if (query.sort === "popular") {
    params.set("ordem", "populares");
  }

  if (query.view !== null) {
    params.set("view", query.view);
  }

  if (query.limit !== null) {
    params.set("limite", String(query.limit));
  }

  const text = params.toString();

  return text === "" ? "/" : `/?${text}`;
}

// Filtros mudam a lista: voltam para a primeira página.
export function filterHref(query: HomeQuery, changes: Partial<HomeQuery>): string {
  return homeHref({ ...query, limit: null, ...changes });
}

// Lista limpa (sem busca, tag, autor nem favoritos), mantendo ordem e visualização.
export function clearedHomeQuery(query: HomeQuery): HomeQuery {
  return { ...query, search: null, tag: null, authorId: null, favorites: false, limit: null };
}

// Atalhos (menu da conta, palette): partem da lista limpa e aplicam as mudanças.
export function shortcutHref(query: HomeQuery, changes: Partial<HomeQuery>): string {
  return homeHref({ ...clearedHomeQuery(query), ...changes });
}

// Parâmetros que só mudam a apresentação: trocar não precisa recarregar dados.
const PRESENTATION_PARAMS = ["view", "p"];

function withoutPresentation(url: URL): string {
  const params = new URLSearchParams(url.search);

  for (const key of PRESENTATION_PARAMS) {
    params.delete(key);
  }

  params.sort();

  return params.toString();
}

export function isPresentationOnlyChange(current: URL, next: URL): boolean {
  return current.pathname === next.pathname && withoutPresentation(current) === withoutPresentation(next);
}
