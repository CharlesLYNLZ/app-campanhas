# Privacidade dos dados do recebedor Swile — pendência conhecida

## O problema

Desde esta versão, campanhas com forma de pagamento **"Swile"** gravam CPF,
nome completo, data de nascimento, e-mail e telefone de quem vai receber o
valor (colunas `swile_*` em `campanhas`).

A policy de leitura do banco continua exatamente como estava:

    create policy campanhas_leitura on campanhas
      for select to authenticated using (true);

Ou seja: **qualquer coordenador logado consegue ler esses 5 campos em
qualquer campanha Swile**, não só o aprovador e quem criou a solicitação.
Isso vale por dois caminhos, os dois devolvendo a linha inteira sem filtrar
coluna nenhuma:

- uma consulta comum feita pelo app (ou por qualquer um com a chave anon,
  direto no console do navegador);
- o canal de tempo real que a tela de lista usa para avisar de campanha
  nova (`postgres_changes` na tabela `campanhas`).

RLS no Postgres controla **linha** (quem enxerga aquela campanha), não
**coluna** (quais campos daquela campanha). Por isso não dá para resolver
isso só ajustando a policy que já existe — é preciso mudar também *como* a
leitura é feita.

## Por que não foi corrigido agora

A pedido do dono do produto, esta rodada entregou só o formulário, a
validação, a exibição no detalhe e a exportação em Excel. A correção de
RLS foi propositalmente deixada de fora deste commit, para decisão em
separado.

## Opções de solução (para decidir depois)

**1. View com mascaramento** (mais completa)
Criar uma view (ex.: `campanhas_visivel`) que devolve nulo nos 5 campos
Swile quando quem está lendo não é o aprovador nem o solicitante; trocar a
leitura da lista (`carregar()` em `app.js`) para essa view; e restringir a
permissão de `SELECT` dessas colunas na tabela `campanhas` para forçar todo
mundo a passar pela view. Resolve por completo, inclusive contra alguém
tentando consultar a tabela direto pelo console do navegador. Também exige
restringir a lista de colunas replicadas na publicação de tempo real
(`supabase_realtime`) — senão o vazamento continua acontecendo pelo canal
ao vivo mesmo com a view no lugar. É a opção mais trabalhosa em SQL, mas não
muda nada visível no app além de apontar a leitura para a view.

**2. Tabela separada para os dados do recebedor**
Mover os 5 campos para uma tabela `campanhas_swile_dados` (1 para 1 com
`campanhas`), com policy de leitura própria restrita a aprovador/solicitante.
Fica mais simples de policiar, porque RLS de linha resolve sozinho. Mas
exige trocar a `CHECK constraint` atual (em `campanhas.forma_pagamento`) por
um trigger, já que uma `CHECK` não enxerga outra tabela — desfaz parte do
que foi pedido nesta rodada.

**3. Aceitar o risco por enquanto**
Documentar e não mudar nada, contando com o fato de que hoje só gente da
própria empresa (coordenadores e aprovador) tem login no app. É a opção
mais rápida, mas mantém o vazamento entre colegas.

## Recomendação

Opção 1 (view + coluna + publicação) resolve sem abrir mão da constraint
que foi pedida nem do "todo mundo vê todas as campanhas" que já existe hoje
de propósito. Fica pronta para implementar quando você decidir seguir com
ela.
