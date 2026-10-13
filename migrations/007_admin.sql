-- Painel admin. O primeiro admin é definido pelo terminal (bun run make-admin email);
-- depois, admins promovem outros pelo painel.
alter table users add column if not exists is_admin boolean not null default false;
-- Conta bloqueada: não entra e as sessões existentes deixam de valer.
alter table users add column if not exists disabled_at timestamptz;

-- Configurações editáveis pelo painel (ex.: código de convite). Sem linha = vale o padrão
-- (para o convite, a variável INVITE_CODE).
create table if not exists site_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

-- Arquivos da marca (logo da navbar), no mesmo formato das fotos de perfil.
create table if not exists site_assets (
  key text primary key,
  content_type text not null check (content_type in ('image/jpeg', 'image/png', 'image/webp')),
  data bytea not null,
  byte_size integer not null,
  updated_at timestamptz not null default now()
);
