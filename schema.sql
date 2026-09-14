-- ============================================================
--  APROVAÇÃO DE CAMPANHAS PROMOCIONAIS
--  Cole este arquivo inteiro no SQL Editor do Supabase e rode.
-- ============================================================

-- ---------- PERFIS (quem é quem) ----------
create table if not exists perfis (
  id          uuid primary key references auth.users on delete cascade,
  email       text unique not null,
  nome        text not null,
  papel       text not null default 'coordenador'
              check (papel in ('aprovador','coordenador')),
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now()
);

-- Cria o perfil automaticamente quando alguém faz o primeiro login.
-- Todo mundo entra como coordenador; você promove a aprovador na mão.
create or replace function public.criar_perfil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into perfis (id, email, nome)
  values (new.id, new.email, split_part(new.email,'@',1))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.criar_perfil();

-- ---------- CAMPANHAS ----------
create table if not exists campanhas (
  id                bigserial primary key,
  codigo            text unique not null default 'C'||to_char(now(),'YYMMDD')||lpad(floor(random()*10000)::text,4,'0'),

  cliente           text not null,
  laboratorio       text not null,
  campanha          text not null,
  tipo              text,
  mecanica          text,

  investimento_lynkz     numeric(14,2) not null default 0 check (investimento_lynkz >= 0),
  investimento_industria numeric(14,2) not null default 0 check (investimento_industria >= 0),
  forma_pagamento   text,

  data_inicio       date,
  data_fim          date,
  tipo_meta         text,
  meta              numeric(14,2) not null default 0 check (meta >= 0),

  rebate_pct        numeric(6,3)  not null default 0 check (rebate_pct >= 0),
  rebate_teto       numeric(14,2) not null default 0 check (rebate_teto >= 0),
  rebate_base       text,
  rebate_gatilho    text,

  observacoes       text,

  status            text not null default 'Pendente'
                    check (status in ('Pendente','Aprovada','Reprovada')),
  solicitante_id    uuid references perfis(id) on delete set null,
  solicitante_nome  text,
  aprovador_nome    text,
  data_decisao      date,
  motivo            text,

  criado_em         timestamptz not null default now(),

  constraint periodo_valido check (data_fim is null or data_inicio is null or data_fim >= data_inicio)
);

create index if not exists idx_campanhas_status on campanhas (status, criado_em);
create index if not exists idx_campanhas_solicitante on campanhas (solicitante_id);

-- Quem já tinha o banco criado com a coluna antiga "investimento" (só verba LYNKZ)
-- ganha as duas colunas novas sem perder dado: o valor antigo vira investimento_lynkz.
do $$
begin
  if exists (select 1 from information_schema.columns where table_name='campanhas' and column_name='investimento')
     and not exists (select 1 from information_schema.columns where table_name='campanhas' and column_name='investimento_lynkz') then
    alter table campanhas rename column investimento to investimento_lynkz;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='campanhas' and column_name='investimento_industria') then
    alter table campanhas add column investimento_industria numeric(14,2) not null default 0 check (investimento_industria >= 0);
  end if;
end $$;

-- ---------- SWILE: DADOS DE QUEM VAI RECEBER O VALOR ----------
-- Quando forma_pagamento = 'Swile', a campanha precisa registrar quem vai
-- receber o pagamento. CPF e telefone são gravados SÓ COM DÍGITOS (sem
-- ponto, traço, barra ou parênteses) — a máscara de digitação é só visual,
-- feita no app.js; o banco sempre recebe e guarda dígito puro.
alter table campanhas add column if not exists swile_nome_completo   text;
alter table campanhas add column if not exists swile_cpf             text;
alter table campanhas add column if not exists swile_data_nascimento date;
alter table campanhas add column if not exists swile_email           text;
alter table campanhas add column if not exists swile_telefone        text;

-- Valida CPF pelo algoritmo oficial dos dígitos verificadores (módulo 11)
-- e rejeita sequências repetidas (000.000.000-00, 111.111.111-11 etc.),
-- que passam na conta de dígitos mas não são CPFs reais.
create or replace function public.cpf_valido(cpf text)
returns boolean
language plpgsql
immutable
as $$
declare
  d    text := regexp_replace(coalesce(cpf,''), '\D', '', 'g');
  n    int[];
  soma int; resto int; dv1 int; dv2 int; k int; peso int;
begin
  if length(d) <> 11 then return false; end if;
  if d ~ '^(\d)\1{10}$' then return false; end if;

  -- "g" aqui é só o apelido da coluna do generate_series; "k" é a variável
  -- de loop mais abaixo. Nomes iguais aos das declarações do começo da
  -- função dão erro 42702 (column reference is ambiguous) — por isso os
  -- dois têm nome próprio, sem repetir "i".
  n := array(select substring(d from g for 1)::int from generate_series(1,11) g);

  soma := 0; peso := 10;
  for k in 1..9 loop
    soma := soma + n[k]*peso;
    peso := peso - 1;
  end loop;
  resto := soma % 11;
  dv1 := case when resto < 2 then 0 else 11 - resto end;
  if dv1 <> n[10] then return false; end if;

  soma := 0; peso := 11;
  for k in 1..10 loop
    soma := soma + n[k]*peso;
    peso := peso - 1;
  end loop;
  resto := soma % 11;
  dv2 := case when resto < 2 then 0 else 11 - resto end;
  if dv2 <> n[11] then return false; end if;

  return true;
end;
$$;

-- Só permite gravar (inserir ou atualizar) uma campanha com forma_pagamento
-- 'Swile' (string exata — é o valor exato da opção em config.js PAGTO,
-- amarrada aqui) se os cinco campos do recebedor estiverem preenchidos e
-- válidos. Qualquer outra forma de pagamento passa livre, sem exigir nada.
--
-- NOT VALID: campanhas Swile antigas, cadastradas antes desta regra existir,
-- não são checadas retroativamente — mas qualquer INSERT ou UPDATE novo
-- (inclusive nelas) já é bloqueado se os dados não baterem. Veja a consulta
-- logo abaixo para achar as antigas incompletas.
alter table campanhas drop constraint if exists campanhas_swile_valido;
alter table campanhas
  add constraint campanhas_swile_valido
  check (
    forma_pagamento is distinct from 'Swile'
    or (
      swile_nome_completo is not null and trim(swile_nome_completo) ~ '\S+\s+\S+'
      and swile_cpf is not null and public.cpf_valido(swile_cpf)
      and swile_data_nascimento is not null
      and swile_email is not null and swile_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
      and swile_telefone is not null and swile_telefone ~ '^\d{10,11}$'
    )
  ) not valid;
  -- Data no futuro não é barrada aqui de propósito: essa regra fica só no
  -- app.js (validarSwile()). O banco só exige que a data exista.

-- Não precisa rodar agora — é só para você mapear se há campanhas Swile
-- antigas que ainda não atendem à regra nova:
--
-- select id, codigo, cliente, criado_em
-- from campanhas
-- where forma_pagamento = 'Swile'
--   and not (
--     swile_nome_completo is not null and trim(swile_nome_completo) ~ '\S+\s+\S+'
--     and swile_cpf is not null and public.cpf_valido(swile_cpf)
--     and swile_data_nascimento is not null
--     and swile_email is not null and swile_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
--     and swile_telefone is not null and swile_telefone ~ '^\d{10,11}$'
--   );
--
-- Depois de completar (ou decidir não completar) essas linhas, você pode
-- validar a constraint de vez com:
-- alter table campanhas validate constraint campanhas_swile_valido;

-- ---------- SEGURANÇA (quem pode fazer o quê) ----------
alter table perfis enable row level security;
alter table campanhas enable row level security;

-- Descobre se o usuário logado é o aprovador, sem consultar a tabela
-- de dentro da própria política (evita recursão).
create or replace function public.eh_aprovador()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfis where id = auth.uid() and papel = 'aprovador' and ativo);
$$;

drop policy if exists perfis_leitura on perfis;
create policy perfis_leitura on perfis
  for select to authenticated using (true);

drop policy if exists perfis_edita_proprio on perfis;
create policy perfis_edita_proprio on perfis
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid() and papel = 'coordenador');

-- Todo mundo logado enxerga todas as campanhas (o extrato é compartilhado).
drop policy if exists campanhas_leitura on campanhas;
create policy campanhas_leitura on campanhas
  for select to authenticated using (true);

-- Qualquer um logado pode solicitar, mas sempre em nome de si mesmo,
-- e sempre como Pendente. Ninguém nasce aprovado.
drop policy if exists campanhas_solicita on campanhas;
create policy campanhas_solicita on campanhas
  for insert to authenticated
  with check (solicitante_id = auth.uid() and status = 'Pendente');

-- Só o aprovador decide.
drop policy if exists campanhas_decide on campanhas;
create policy campanhas_decide on campanhas
  for update to authenticated
  using (public.eh_aprovador())
  with check (public.eh_aprovador());

-- Ninguém apaga nada: o registro é permanente (não existe policy de delete).

-- ---------- TRAVA DE INTEGRIDADE ----------
-- Impede que uma campanha já decidida seja alterada de novo, e carimba
-- quem decidiu e quando. Isso vale mesmo que alguém mexa direto no banco.
create or replace function public.registrar_decisao()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.status <> 'Pendente' and new.status <> old.status then
    raise exception 'Esta campanha já foi %. A decisão não pode ser alterada.', old.status;
  end if;
  if new.status <> old.status then
    new.data_decisao := current_date;
    new.aprovador_nome := coalesce((select nome from perfis where id = auth.uid()), 'Aprovador');
    if new.status = 'Reprovada' and coalesce(trim(new.motivo),'') = '' then
      raise exception 'Reprova exige motivo.';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists ao_decidir on campanhas;
create trigger ao_decidir
  before update on campanhas
  for each row execute function public.registrar_decisao();

-- ---------- ATUALIZAÇÃO EM TEMPO REAL ----------
alter publication supabase_realtime add table campanhas;

-- ============================================================
--  DEPOIS DE FAZER SEU PRIMEIRO LOGIN NO APP, rode a linha abaixo
--  trocando pelo seu e-mail, para virar o aprovador:
--
--  update perfis set papel = 'aprovador' where email = 'seu.email@empresa.com.br';
-- ============================================================
