-- Foto de perfil em tabela própria: a tabela users continua leve e o binário só é lido
-- pela rota /avatar/:userId.
create table if not exists user_avatars (
  user_id uuid primary key references users (id) on delete cascade,
  content_type text not null check (content_type in ('image/jpeg', 'image/png', 'image/webp')),
  data bytea not null,
  byte_size integer not null,
  updated_at timestamptz not null default now()
);
