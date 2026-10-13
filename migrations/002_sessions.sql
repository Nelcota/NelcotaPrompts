-- Sessões no servidor: o cookie guarda só o id assinado, então sair (ou apagar a linha)
-- invalida a sessão de verdade.
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  data jsonb not null default '{}',
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists sessions_expires_at_idx on sessions (expires_at);
