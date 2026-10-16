-- Tokens de API pessoais (servidor MCP em /mcp): uma IA usa o sistema em nome do dono do
-- token. Só o hash fica no banco; o token aparece uma vez, ao ser criado.
create table if not exists api_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  name text not null,
  token_hash text not null unique,
  -- read: só busca e lê; write: também cria, edita, apaga e favorita.
  access text not null check (access in ('read', 'write')),
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists api_tokens_user_id_idx on api_tokens (user_id);
