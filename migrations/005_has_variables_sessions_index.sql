-- "Tem {variáveis}" passa a ser calculado em JavaScript ao salvar (mesma regra da tela),
-- em vez de depender da regex/locale do Postgres. Para os prompts que já existem, uma
-- regra mais ampla: um falso positivo só custa buscar o texto antes de copiar.
alter table prompts add column if not exists has_variables boolean not null default false;
update prompts set has_variables = body ~ '\{[^{}\n]{1,40}\}';

-- "Desconectar outros dispositivos" filtra sessões por usuário.
create index if not exists sessions_user_id_idx on sessions ((data ->> 'userId'));
