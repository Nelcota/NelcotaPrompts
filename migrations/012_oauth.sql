-- OAuth para o servidor MCP: o cliente (Claude Code, Cursor…) se registra sozinho, a
-- pessoa entra e clica em "Permitir", e o cliente recebe um token de API. Ninguém precisa
-- criar nem colar token.

-- Clientes registrados pelo próprio app de IA (registro dinâmico, RFC 7591). Públicos:
-- sem segredo, a troca do código é protegida por PKCE.
create table if not exists oauth_clients (
  id text primary key,
  name text not null,
  redirect_uris text[] not null,
  created_at timestamptz not null default now()
);

-- Códigos de autorização: uso único, 10 minutos. Só o hash fica no banco.
create table if not exists oauth_codes (
  code_hash text primary key,
  client_id text not null references oauth_clients (id) on delete cascade,
  user_id uuid not null references users (id) on delete cascade,
  redirect_uri text not null,
  code_challenge text not null,
  access text not null check (access in ('read', 'write')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- Token emitido por OAuth: um por pessoa e cliente (autorizar de novo troca o token).
alter table api_tokens add column if not exists client_id text references oauth_clients (id) on delete cascade;
create unique index if not exists api_tokens_user_client_idx on api_tokens (user_id, client_id) where client_id is not null;
