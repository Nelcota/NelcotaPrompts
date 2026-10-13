-- Histórico de edições: antes de cada UPDATE, a versão anterior (título, corpo e tags)
-- é guardada aqui. Restaurar uma versão é só mais uma edição, que também vira histórico.
create table if not exists prompt_versions (
  id uuid primary key default gen_random_uuid(),
  prompt_id uuid not null references prompts (id) on delete cascade,
  title text not null,
  body text not null,
  tags text[] not null default '{}',
  -- Quando essa versão passou a valer (o updated_at do prompt naquele momento).
  saved_at timestamptz not null,
  -- Quando foi substituída por outra.
  replaced_at timestamptz not null default now()
);

create index if not exists prompt_versions_prompt_idx on prompt_versions (prompt_id, replaced_at desc);
