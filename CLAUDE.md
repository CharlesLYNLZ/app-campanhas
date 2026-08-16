# Projeto: Aprovação de Campanhas Promocionais — LYNKZ

App de celular (PWA) onde coordenadores de campo solicitam campanhas promocionais
para clientes e a gerência aprova ou reprova. Tudo fica registrado e exporta para Excel.

## Stack

HTML, CSS e JavaScript puros. **Sem framework, sem build, sem npm.**
Banco e autenticação: Supabase (importado via ESM na tag `<script type="module">`).
Publicação: arrastar a pasta no Netlify Drop.

Essa simplicidade é proposital: quem mantém o projeto não é desenvolvedor.
**Não introduza React, Vue, Tailwind, bundler ou etapa de build sem que seja pedido.**

## Arquivos

| Arquivo | Papel |
|---|---|
| `index.html` | Estrutura das telas e barra inferior. Só a casca — todo conteúdo é renderizado por JS. |
| `estilo.css` | **Design system compartilhado entre os apps da empresa.** |
| `app.js` | Toda a lógica: login, renderização, cálculos, decisões, Excel. |
| `config.js` | Chaves do Supabase, marca e listas dos menus. O usuário edita este. |
| `schema.sql` | Banco de dados e regras de segurança. |
| `logo.png` / `logo-branca.png` | Marca oficial, fundo transparente. |

## Marca

- Vermelho oficial: **`#E11F1C`** (amostrado do arquivo original da logo — não chute outro tom).
- **O vermelho é cor de ação, não de alerta.** Ele está nos botões primários, filtros ativos e
  botão flutuante. Para alertas, use o vermelho apenas em texto e fundo claro (`--red-soft`).
- Estados seguem o padrão dos outros apps: selo verde para positivo, vermelho para negativo,
  âmbar para pendente.
- A logo aparece **só na tela de acesso**. O cabeçalho interno leva apenas título e contador.

## Design system

Todas as cores, raios e sombras estão nas variáveis no topo do `estilo.css`.
**Nunca escreva cor literal (hex, rgb) fora desse bloco** — use as variáveis.
Este arquivo é copiado para outros projetos da empresa, então mudanças nele devem ser
genéricas o bastante para servir a qualquer app do padrão.

Padrões de layout já estabelecidos, a seguir em telas novas:
- Lista → detalhe. Cartão na lista, tela cheia no detalhe.
- Seções no detalhe: rótulo em caixa-alta cinza acima de um bloco branco com linhas `dt`/`dd`.
- Ação primária: botão vermelho de largura total no fim da tela de detalhe.
- Filtros: pílulas roláveis na horizontal, a ativa em vermelho sólido.

## Regras de negócio

**Custo total = investimento + rebate estimado.** O rebate estimado é `meta × %`, limitado pelo
teto quando houver. A barra de "custo sobre a meta" usa o **total**, nunca só a verba — o ponto
inteiro do app é não deixar o rebate passar despercebido. A função `calc()` no `app.js` é a
fonte única dessa conta; não duplique a lógica.

Faixas do indicador vêm de `FAIXA_VERDE` e `FAIXA_AMARELA` no `config.js`. Não fixe no código.

## Segurança — não enfraquecer

As regras vivem no banco (RLS + triggers no `schema.sql`), não na interface. A tela apenas
esconde botões; o banco é quem recusa. Isso é intencional e deve continuar assim:

- Só perfil `aprovador` altera `status`.
- Toda campanha nasce `Pendente`.
- Campanha já decidida não pode ser decidida de novo.
- Reprova exige motivo.
- Não existe permissão de exclusão. O histórico é permanente.
- `aprovador_nome` e `data_decisao` são carimbados pelo trigger, nunca enviados pelo cliente.

Se uma funcionalidade nova precisar de acesso a dados, escreva a policy correspondente —
não relaxe as existentes.

## Ao mexer no código

- Português do Brasil em nomes de variáveis, comentários e textos de interface.
- Escape sempre conteúdo vindo do banco com `esc()` antes de injetar em HTML.
- Valores em reais: `brl()` com duas casas; `brl0()` para números grandes arredondados.
- Datas do banco vêm em ISO; exiba com `dt()` em DD/MM/AAAA.
- Depois de editar, sirva a pasta com `python3 -m http.server` e abra no navegador.
  Módulos ESM **não funcionam** abrindo o arquivo direto por `file://`.

## Pendências conhecidas

- Notificação push não existe. Hoje o app avisa só com a tela aberta. O caminho mais simples
  é uma Edge Function no Supabase disparando e-mail a cada campanha nova.
- O rebate estimado assume que o cliente bate exatamente a meta. Rebate escalonado por faixa
  ou incidente sobre todo o volume ainda não é suportado.
