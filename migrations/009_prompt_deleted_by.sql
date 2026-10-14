-- Quem mandou o prompt para a lixeira: o autor só pode restaurar o que ele mesmo apagou
-- (não desfaz a moderação do admin). null (linha antiga ou admin excluído) = só o admin
-- restaura (ver restorePrompt).
alter table prompts add column if not exists deleted_by uuid references users (id) on delete set null;
