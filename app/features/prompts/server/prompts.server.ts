import { and, desc, eq, gt, gte, ilike, isNotNull, isNull, lt, lte, notInArray, or, type SQL, sql } from "drizzle-orm";

import { avatarUrl } from "~/features/profile/server/avatars.server";
import { getDb, likePattern } from "~/shared/server/db.server";
import { promptFavorites, prompts, promptVersions, userAvatars, users } from "~/shared/server/db/schema";
import type { PromptInput, PromptSort } from "../prompt-rules";
import { EXCERPT_LENGTH, type Prompt, type PromptVersion } from "../types";
import { hasVariables } from "../variables";

// Repositório de prompts: leitura, busca, escrita, lixeira, histórico, favoritos e cópias.

// Prompts apagados ficam na lixeira por este tempo (para o "Desfazer") e depois são purgados.
const TRASH_RETENTION = sql`interval '7 days'`;
// Versões guardadas por prompt (as mais antigas saem a cada edição).
const VERSIONS_KEPT = 50;
// Semelhança mínima do título com o que foi digitado para aceitar erro de digitação.
const TYPO_SIMILARITY = 0.45;

// Ciclo de vida, compartilhado com o painel admin.
export const isLive = isNull(prompts.deletedAt);
export const isRestorable = gt(prompts.deletedAt, sql`now() - ${TRASH_RETENTION}`);

export type PromptFilters = {
  search: string | null;
  tag: string | null;
  authorId: string | null;
  favoritesOnly: boolean;
  sort: PromptSort;
};

const NO_FILTERS: PromptFilters = { search: null, tag: null, authorId: null, favoritesOnly: false, sort: "recent" };

// Busca textual (migration 008): cada palavra vira prefixo ("refac" acha "Refactor"), sem
// acento e com radical em português; o trigrama do título tolera erro de digitação e o
// ILIKE cobre trechos que não são palavras (ex.: "{diff}"). Devolve a condição e a nota
// de relevância para ordenar.
function searchCondition(text: string): { match: SQL; rank: SQL<number> } {
  const terms = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  const similarity = sql<number>`word_similarity(immutable_unaccent(${text}), immutable_unaccent(${prompts.title}))`;
  const substring = ilike(prompts.title, likePattern(text) ?? "");

  if (terms.length === 0) {
    return { match: or(substring, gte(similarity, TYPO_SIMILARITY)) ?? substring, rank: similarity };
  }

  const query = sql`to_tsquery('portuguese', immutable_unaccent(${terms.map((term) => `${term}:*`).join(" & ")}))`;
  const match = or(sql`${prompts.search} @@ ${query}`, gte(similarity, TYPO_SIMILARITY), substring) ?? substring;

  return { match, rank: sql<number>`ts_rank(${prompts.search}, ${query}) + ${similarity}` };
}

// Critério que vem antes da data na ordenação: mais copiados, relevância da busca ou nenhum.
function leadingOrder(sort: PromptSort, search: { rank: SQL<number> } | null): SQL[] {
  if (sort === "popular") {
    return [desc(prompts.copyCount)];
  }

  return search === null ? [] : [desc(search.rank)];
}

// A única consulta de leitura de prompts (lista e prompt avulso), com o que o card mostra:
// trecho do corpo, autor, foto e se quem vê favoritou. id restringe a um prompt só.
async function queryPrompts(viewerId: string, filters: PromptFilters, limit: number, id: string | null = null) {
  const search = filters.search === null ? null : searchCondition(filters.search);
  const order = leadingOrder(filters.sort, search);

  const rows = await getDb()
    .select({
      id: prompts.id,
      title: prompts.title,
      excerpt: sql<string>`left(${prompts.body}, ${EXCERPT_LENGTH})`,
      truncated: sql<boolean>`char_length(${prompts.body}) > ${EXCERPT_LENGTH}`,
      hasVariables: prompts.hasVariables,
      tags: prompts.tags,
      authorId: prompts.authorId,
      authorName: users.name,
      authorAvatarVersion: userAvatars.updatedAt,
      copyCount: prompts.copyCount,
      isFavorite: sql<boolean>`${promptFavorites.userId} is not null`,
      createdAt: prompts.createdAt,
      updatedAt: prompts.updatedAt,
      total: sql<number>`(count(*) over ())::int`,
    })
    .from(prompts)
    .innerJoin(users, eq(users.id, prompts.authorId))
    .leftJoin(userAvatars, eq(userAvatars.userId, users.id))
    .leftJoin(promptFavorites, and(eq(promptFavorites.promptId, prompts.id), eq(promptFavorites.userId, viewerId)))
    .where(
      and(
        isLive,
        id === null ? undefined : eq(prompts.id, id),
        search?.match,
        filters.tag === null ? undefined : sql`${filters.tag} = any (${prompts.tags})`,
        filters.authorId === null ? undefined : eq(prompts.authorId, filters.authorId),
        filters.favoritesOnly ? isNotNull(promptFavorites.userId) : undefined,
      ),
    )
    .orderBy(...order, desc(prompts.createdAt), desc(prompts.id))
    .limit(limit);

  const list: Prompt[] = rows.map(({ total: _total, authorAvatarVersion, createdAt, updatedAt, ...row }) => ({
    ...row,
    authorAvatarUrl: avatarUrl(row.authorId, authorAvatarVersion),
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  }));

  return { prompts: list, total: rows[0]?.total ?? 0 };
}

export function listPrompts(viewerId: string, filters: PromptFilters, limit: number) {
  return queryPrompts(viewerId, filters, limit);
}

// Um prompt específico (link direto ?p=), mesmo que esteja fora da página/filtro atual.
export async function getPromptById(viewerId: string, id: string): Promise<Prompt | null> {
  const { prompts: found } = await queryPrompts(viewerId, NO_FILTERS, 1, id);

  return found[0] ?? null;
}

export async function getPromptBody(id: string): Promise<string | null> {
  const [row] = await getDb()
    .select({ body: prompts.body })
    .from(prompts)
    .where(and(eq(prompts.id, id), isLive));

  return row?.body ?? null;
}

// Tags em uso, das mais usadas para as menos (para a IA descobrir como o mural se organiza).
export async function listTags(): Promise<{ tag: string; count: number }[]> {
  const tag = sql<string>`unnest(${prompts.tags})`.as("tag");
  const tagged = getDb().select({ tag }).from(prompts).where(isLive).as("tagged");

  return getDb()
    .select({ tag: tagged.tag, count: sql<number>`count(*)::int` })
    .from(tagged)
    .groupBy(tagged.tag)
    .orderBy(desc(sql`count(*)`), tagged.tag);
}

// Prompts vivos com o corpo inteiro, do mais recente ao mais antigo (cada um vira um
// "prompt" do servidor MCP, com as variáveis como argumentos).
export function listPromptIndex(limit: number): Promise<{ id: string; title: string; body: string }[]> {
  return getDb()
    .select({ id: prompts.id, title: prompts.title, body: prompts.body })
    .from(prompts)
    .where(isLive)
    .orderBy(desc(prompts.createdAt), desc(prompts.id))
    .limit(limit);
}

// Prompts vivos cujo id começa com estes 8 dígitos hex (nome dos comandos MCP). Faixa de
// uuid em vez de LIKE: usa o índice da chave primária.
export function findPromptsByIdPrefix(prefix: string): Promise<{ id: string; title: string; body: string }[]> {
  if (!/^[0-9a-f]{8}$/.test(prefix)) {
    return Promise.resolve([]);
  }

  return getDb()
    .select({ id: prompts.id, title: prompts.title, body: prompts.body })
    .from(prompts)
    .where(and(isLive, gte(prompts.id, `${prefix}-0000-0000-0000-000000000000`), lte(prompts.id, `${prefix}-ffff-ffff-ffff-ffffffffffff`)));
}

async function promptIsLive(id: string): Promise<boolean> {
  const [row] = await getDb()
    .select({ id: prompts.id })
    .from(prompts)
    .where(and(eq(prompts.id, id), isLive));

  return row !== undefined;
}

export async function createPrompt(authorId: string, input: PromptInput) {
  const [created] = await getDb()
    .insert(prompts)
    .values({ authorId, ...input, hasVariables: hasVariables(input.body) })
    .returning({ id: prompts.id });

  return created ?? null;
}

// --- Mudanças do autor -----------------------------------------------------------
// A escrita já filtra por author_id (vale mesmo em corrida). Só quando ela não altera
// nada é que se descobre o porquê, para responder 404 ou 403.

export type OwnershipResult = "ok" | "not_found" | "forbidden";

async function explainMiss(promptId: string, userId: string, scope: "live" | "trash"): Promise<Exclude<OwnershipResult, "ok">> {
  const [row] = await getDb().select({ authorId: prompts.authorId, deletedAt: prompts.deletedAt }).from(prompts).where(eq(prompts.id, promptId));
  const inScope = row !== undefined && (scope === "live" ? row.deletedAt === null : row.deletedAt !== null);

  return inScope && row.authorId !== userId ? "forbidden" : "not_found";
}

function sameTags(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((tag, index) => tag === b[index]);
}

// A versão anterior vai para prompt_versions na mesma transação (salvar sem mudar nada
// não cria versão) e o histórico fica nas VERSIONS_KEPT mais recentes.
export async function updatePrompt(promptId: string, userId: string, input: PromptInput): Promise<OwnershipResult> {
  return getDb().transaction(async (tx): Promise<OwnershipResult> => {
    const [row] = await tx
      .select({ authorId: prompts.authorId, title: prompts.title, body: prompts.body, tags: prompts.tags, updatedAt: prompts.updatedAt })
      .from(prompts)
      .where(and(eq(prompts.id, promptId), isLive))
      .for("update");

    if (row === undefined) {
      return "not_found";
    }

    if (row.authorId !== userId) {
      return "forbidden";
    }

    if (row.title === input.title && row.body === input.body && sameTags(row.tags, input.tags)) {
      return "ok";
    }

    await tx.insert(promptVersions).values({ promptId, title: row.title, body: row.body, tags: row.tags, savedAt: row.updatedAt });

    const kept = tx
      .select({ id: promptVersions.id })
      .from(promptVersions)
      .where(eq(promptVersions.promptId, promptId))
      .orderBy(desc(promptVersions.replacedAt), desc(promptVersions.id))
      .limit(VERSIONS_KEPT);
    await tx.delete(promptVersions).where(and(eq(promptVersions.promptId, promptId), notInArray(promptVersions.id, kept)));

    await tx
      .update(prompts)
      .set({ ...input, hasVariables: hasVariables(input.body), updatedAt: sql`now()` })
      .where(eq(prompts.id, promptId));

    return "ok";
  });
}

// Restaurar = editar o prompt com o conteúdo da versão (a atual vira histórico).
export async function restorePromptVersion(promptId: string, versionId: string, userId: string): Promise<OwnershipResult> {
  const [version] = await getDb()
    .select({ title: promptVersions.title, body: promptVersions.body, tags: promptVersions.tags })
    .from(promptVersions)
    .where(and(eq(promptVersions.id, versionId), eq(promptVersions.promptId, promptId)));

  return version === undefined ? "not_found" : updatePrompt(promptId, userId, version);
}

// Apagar manda para a lixeira (dá para desfazer).
export async function trashPrompt(promptId: string, userId: string): Promise<OwnershipResult> {
  const updated = await getDb()
    .update(prompts)
    .set({ deletedAt: sql`now()`, deletedBy: userId })
    .where(and(eq(prompts.id, promptId), eq(prompts.authorId, userId), isLive))
    .returning({ id: prompts.id });

  return updated.length > 0 ? "ok" : explainMiss(promptId, userId, "live");
}

export async function restorePrompt(promptId: string, userId: string): Promise<OwnershipResult> {
  const updated = await getDb()
    .update(prompts)
    .set({ deletedAt: null, deletedBy: null })
    // Só o que o próprio autor apagou: o que o admin moderou fica na lixeira. deleted_by
    // null não conta como do autor: vira null também quando a conta do admin que apagou é
    // excluída (on delete set null), e aí o autor desfaria a moderação.
    .where(and(eq(prompts.id, promptId), eq(prompts.authorId, userId), isRestorable, eq(prompts.deletedBy, userId)))
    .returning({ id: prompts.id });

  return updated.length > 0 ? "ok" : explainMiss(promptId, userId, "trash");
}

// Remove de vez o que passou do prazo da lixeira. Chamado ao apagar e ao abrir a lixeira
// no painel (não há agendador; uma instância só).
export async function purgeExpiredTrash(): Promise<number> {
  const deleted = await getDb()
    .delete(prompts)
    .where(lt(prompts.deletedAt, sql`now() - ${TRASH_RETENTION}`))
    .returning({ id: prompts.id });

  return deleted.length;
}

// --- Histórico, favoritos e cópias ------------------------------------------------

// Versões anteriores, da mais recente para a mais antiga. null = prompt não existe (ou na lixeira).
export async function listPromptVersions(promptId: string): Promise<PromptVersion[] | null> {
  if (!(await promptIsLive(promptId))) {
    return null;
  }

  const rows = await getDb()
    .select({
      id: promptVersions.id,
      title: promptVersions.title,
      body: promptVersions.body,
      tags: promptVersions.tags,
      savedAt: promptVersions.savedAt,
      replacedAt: promptVersions.replacedAt,
    })
    .from(promptVersions)
    .where(eq(promptVersions.promptId, promptId))
    .orderBy(desc(promptVersions.replacedAt), desc(promptVersions.id))
    .limit(VERSIONS_KEPT);

  return rows.map((row) => ({ ...row, savedAt: row.savedAt.toISOString(), replacedAt: row.replacedAt.toISOString() }));
}

export async function recordCopy(promptId: string): Promise<boolean> {
  const updated = await getDb()
    .update(prompts)
    .set({ copyCount: sql`${prompts.copyCount} + 1` })
    .where(and(eq(prompts.id, promptId), isLive))
    .returning({ id: prompts.id });

  return updated.length > 0;
}

// false = prompt apagado (ou inexistente): a tela recarrega a lista.
export async function setFavorite(userId: string, promptId: string, favorite: boolean): Promise<boolean> {
  const db = getDb();

  if (!favorite) {
    await db.delete(promptFavorites).where(and(eq(promptFavorites.userId, userId), eq(promptFavorites.promptId, promptId)));

    return promptIsLive(promptId);
  }

  // Confere e insere no mesmo comando: um prompt apagado no meio não ganha favorito.
  const inserted = await db
    .insert(promptFavorites)
    .select(
      db
        .select({ userId: sql<string>`${userId}::uuid`.as("user_id"), promptId: prompts.id, createdAt: sql<Date>`now()`.as("created_at") })
        .from(prompts)
        .where(and(eq(prompts.id, promptId), isLive)),
    )
    .onConflictDoUpdate({ target: [promptFavorites.userId, promptFavorites.promptId], set: { userId } })
    .returning({ promptId: promptFavorites.promptId });

  return inserted.length > 0;
}
