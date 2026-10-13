-- Quem mandou o prompt para a lixeira: o autor só pode restaurar o que ele mesmo apagou
-- (não desfaz a moderação do admin). Linhas antigas ficam null e valem como do autor.
alter table prompts add column if not exists deleted_by uuid references users (id) on delete set null;
