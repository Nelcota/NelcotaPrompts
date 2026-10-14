-- Email único sem diferenciar maiúsculas. O login e o cadastro já gravam em minúsculas,
-- mas o unique de email diferencia caixa: uma linha antiga "Ana@x.com" não entra (o login
-- procura "ana@x.com") e poderia coexistir com "ana@x.com". Contas duplicadas param a
-- migration com a lista: alguém precisa decidir qual fica (bun run make-admin não resolve).
do $$
declare
  duplicated text;
begin
  select string_agg(email_lower, ', ') into duplicated
  from (select lower(email) as email_lower from users group by lower(email) having count(*) > 1) as dup;

  if duplicated is not null then
    raise exception 'Emails repetidos (sem diferenciar maiúsculas): %. Exclua ou renomeie as contas sobrando e rode a migration de novo.', duplicated;
  end if;
end
$$;

update users set email = lower(email) where email <> lower(email);

alter table users add constraint users_email_lowercase check (email = lower(email));

-- Nome, título e corpo precisam de algo visível: espaços e caracteres de formatação
-- invisíveis (zero-width, marcas de direção, BOM) não contam. Mesma regra do formulário
-- (requiredText). Sem NOT VALID de propósito: o Postgres confere a constraint em todo
-- UPDATE, e uma linha antiga inválida faria falhar até a contagem de cópias ou o bloqueio
-- da conta. Linhas assim param a migration com os ids, para alguém corrigir o texto.
do $$
declare
  visible constant text := '[^[:space:]­​-‏‪-‮⁠-⁤﻿]';
  bad_users text;
  bad_prompts text;
begin
  select string_agg(id::text, ', ') into bad_users from users where name !~ visible;
  select string_agg(id::text, ', ') into bad_prompts from prompts where title !~ visible or body !~ visible;

  if bad_users is not null or bad_prompts is not null then
    raise exception 'Texto em branco (só espaços ou invisíveis). Usuários sem nome: %. Prompts sem título ou corpo: %. Corrija e rode a migration de novo.',
      coalesce(bad_users, 'nenhum'), coalesce(bad_prompts, 'nenhum');
  end if;
end
$$;

alter table users add constraint users_name_visible
  check (name ~ '[^[:space:]­​-‏‪-‮⁠-⁤﻿]');
alter table prompts add constraint prompts_title_visible
  check (title ~ '[^[:space:]­​-‏‪-‮⁠-⁤﻿]');
alter table prompts add constraint prompts_body_visible
  check (body ~ '[^[:space:]­​-‏‪-‮⁠-⁤﻿]');
