-- Lixeira: apagar marca deleted_at e permite "Desfazer"; itens antigos são purgados.
alter table prompts add column if not exists deleted_at timestamptz;
create index if not exists prompts_live_created_idx on prompts (created_at desc) where deleted_at is null;

-- Quantas vezes o prompt foi copiado (ordenação "Mais copiados").
alter table prompts add column if not exists copy_count integer not null default 0;

create table if not exists prompt_favorites (
  user_id uuid not null references users (id) on delete cascade,
  prompt_id uuid not null references prompts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, prompt_id)
);

create index if not exists prompt_favorites_prompt_idx on prompt_favorites (prompt_id);

-- Links de redefinição de senha gerados pelo admin (bun run reset-link). Só o hash
-- do token fica no banco; o link vale uma vez e expira.
create table if not exists password_resets (
  token_hash text primary key,
  user_id uuid not null references users (id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
