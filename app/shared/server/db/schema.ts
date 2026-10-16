import { sql } from "drizzle-orm";
import { boolean, check, customType, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

// Schema do banco para o Drizzle tipar as consultas. A fonte de verdade continua sendo
// migrations/*.sql (aplicadas por scripts/migrate.ts): ao mudar o banco, escreva a
// migration e espelhe a mudança aqui.

const bytea = customType<{ data: Uint8Array; driverData: Uint8Array }>({ dataType: () => "bytea" });
const tsvector = customType<{ data: string }>({ dataType: () => "tsvector" });

// Algo visível (migration 010): espaços e caracteres de formatação invisíveis não contam.
const hasVisibleText = (column: string) => sql.raw(`${column} ~ '[^[:space:]\\u00AD\\u200B-\\u200F\\u202A-\\u202E\\u2060-\\u2064\\uFEFF]'`);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
};

export const users = pgTable(
  "users",
  {
    id: uuid().defaultRandom().primaryKey(),
    // Sempre em minúsculas (migration 010): o unique vale sem diferenciar caixa.
    email: text().notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    name: text().notNull(),
    isAdmin: boolean("is_admin").default(false).notNull(),
    // Conta bloqueada: não entra e as sessões existentes deixam de valer.
    disabledAt: timestamp("disabled_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [check("users_email_lowercase", sql`${table.email} = lower(${table.email})`), check("users_name_visible", hasVisibleText("name"))],
);

// Sessões no servidor: o cookie guarda só o id assinado; o usuário fica em data.userId.
export const sessions = pgTable(
  "sessions",
  {
    id: uuid().defaultRandom().primaryKey(),
    data: jsonb().$type<{ userId?: string }>().default({}).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [index("sessions_expires_at_idx").on(table.expiresAt), index("sessions_user_id_idx").using("btree", sql`(${table.data} ->> 'userId')`)],
);

export const userAvatars = pgTable("user_avatars", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  contentType: text("content_type").notNull(),
  data: bytea().notNull(),
  byteSize: integer("byte_size").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const prompts = pgTable(
  "prompts",
  {
    id: uuid().defaultRandom().primaryKey(),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text().notNull(),
    body: text().notNull(),
    tags: text().array().default(sql`'{}'`).notNull(),
    hasVariables: boolean("has_variables").default(false).notNull(),
    copyCount: integer("copy_count").default(0).notNull(),
    // Lixeira: apagar marca a data; depois de 7 dias o prompt é removido de vez.
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    // Quem apagou (migration 009): o autor só restaura o que ele mesmo mandou para a lixeira.
    // null (linha antiga ou admin excluído) = só o admin restaura.
    deletedBy: uuid("deleted_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    // Busca textual (migration 008): gerada pelo banco a partir de título, tags e corpo.
    search: tsvector().generatedAlwaysAs(
      sql`setweight(to_tsvector('portuguese', immutable_unaccent(title)), 'A') || setweight(to_tsvector('portuguese', immutable_unaccent(coalesce(tags_text(tags), ''))), 'B') || setweight(to_tsvector('portuguese', immutable_unaccent(body)), 'C')`,
    ),
  },
  (table) => [
    index("prompts_author_id_idx").on(table.authorId),
    index("prompts_search_idx").using("gin", table.search),
    index("prompts_created_at_idx").on(table.createdAt.desc()),
    index("prompts_live_created_idx").on(table.createdAt.desc()).where(sql`deleted_at is null`),
    index("prompts_tags_idx").using("gin", table.tags),
    check("prompts_title_visible", hasVisibleText("title")),
    check("prompts_body_visible", hasVisibleText("body")),
  ],
);

export const promptFavorites = pgTable(
  "prompt_favorites",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    promptId: uuid("prompt_id")
      .notNull()
      .references(() => prompts.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (table) => [primaryKey({ columns: [table.userId, table.promptId] }), index("prompt_favorites_prompt_idx").on(table.promptId)],
);

export const promptVersions = pgTable(
  "prompt_versions",
  {
    id: uuid().defaultRandom().primaryKey(),
    promptId: uuid("prompt_id")
      .notNull()
      .references(() => prompts.id, { onDelete: "cascade" }),
    title: text().notNull(),
    body: text().notNull(),
    tags: text().array().default(sql`'{}'`).notNull(),
    // Quando essa versão passou a valer e quando foi substituída.
    savedAt: timestamp("saved_at", { withTimezone: true }).notNull(),
    replacedAt: timestamp("replaced_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("prompt_versions_prompt_idx").on(table.promptId, table.replacedAt.desc())],
);

export const passwordResets = pgTable("password_resets", {
  // Só o hash do token fica no banco; o link vale uma vez e expira.
  tokenHash: text("token_hash").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  ...timestamps,
});

// Configurações editáveis pelo painel (ex.: código de convite).
export const siteSettings = pgTable("site_settings", {
  key: text().primaryKey(),
  value: text().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Arquivos da marca (logo), no mesmo formato das fotos de perfil.
export const siteAssets = pgTable("site_assets", {
  key: text().primaryKey(),
  contentType: text("content_type").notNull(),
  data: bytea().notNull(),
  byteSize: integer("byte_size").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Tokens de API pessoais (migration 011), usados pelo servidor MCP. Só o hash fica no banco.
export const apiTokens = pgTable(
  "api_tokens",
  {
    id: uuid().defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text().notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    access: text().$type<"read" | "write">().notNull(),
    // Preenchido quando o token veio de OAuth (migration 012); null = criado à mão.
    clientId: text("client_id").references(() => oauthClients.id, { onDelete: "cascade" }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("api_tokens_user_id_idx").on(table.userId),
    uniqueIndex("api_tokens_user_client_idx").on(table.userId, table.clientId).where(sql`client_id is not null`),
  ],
);

// Clientes OAuth (migration 012), registrados pelo próprio app de IA. Públicos (PKCE).
export const oauthClients = pgTable("oauth_clients", {
  id: text().primaryKey(),
  name: text().notNull(),
  redirectUris: text("redirect_uris").array().notNull(),
  ...timestamps,
});

// Códigos de autorização: uso único e curtos. Só o hash fica no banco.
export const oauthCodes = pgTable("oauth_codes", {
  codeHash: text("code_hash").primaryKey(),
  clientId: text("client_id")
    .notNull()
    .references(() => oauthClients.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  redirectUri: text("redirect_uri").notNull(),
  codeChallenge: text("code_challenge").notNull(),
  access: text().$type<"read" | "write">().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ...timestamps,
});
