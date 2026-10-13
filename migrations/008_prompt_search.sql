-- Busca textual em português: ignora acentos ("codigo" acha "código"), entende variações
-- ("testes" acha "teste") e aceita prefixo enquanto se digita; o trigrama do título tolera
-- erros de digitação ("refator" acha "Refactor"). unaccent e pg_trgm são extensões
-- "confiáveis": o dono do banco pode criá-las sem superusuário.
create extension if not exists unaccent;
create extension if not exists pg_trgm;

-- Coluna gerada e índice exigem funções imutáveis. unaccent() e array_to_string() não são
-- (dependem de configuração); estas versões fixam o dicionário e o tipo e podem ser.
create or replace function immutable_unaccent(text) returns text
  language sql immutable parallel safe strict
  as $$ select public.unaccent('public.unaccent'::regdictionary, $1) $$;

create or replace function tags_text(text[]) returns text
  language sql immutable parallel safe strict
  as $$ select array_to_string($1, ' ') $$;

-- Título pesa mais que tags, que pesam mais que o corpo.
alter table prompts add column if not exists search tsvector generated always as (
  setweight(to_tsvector('portuguese', immutable_unaccent(title)), 'A')
  || setweight(to_tsvector('portuguese', immutable_unaccent(coalesce(tags_text(tags), ''))), 'B')
  || setweight(to_tsvector('portuguese', immutable_unaccent(body)), 'C')
) stored;

create index if not exists prompts_search_idx on prompts using gin (search);
create index if not exists prompts_title_trgm_idx on prompts using gin (immutable_unaccent(title) gin_trgm_ops);
