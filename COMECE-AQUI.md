# Comece aqui

App de aprovação de campanhas promocionais. Leva uns **30 minutos** para colocar no ar.
Não precisa saber programar e não precisa instalar nada no computador.

Custo: **R$ 0**. O volume de 5 coordenadores cabe folgado nos planos gratuitos.

---

## Parte 1 — Criar o banco de dados (10 min)

1. Entre em **supabase.com** e crie uma conta (pode ser com a conta Google da empresa).
2. Clique em **New project**.
   - **Name:** `campanhas`
   - **Database Password:** deixe ele gerar uma e **guarde num lugar seguro** — você quase nunca vai usar, mas não dá para recuperar depois.
   - **Region:** escolha `South America (São Paulo)`, que é a mais perto.
3. Espere uns 2 minutos enquanto ele cria.
4. No menu da esquerda, clique em **SQL Editor** → **New query**.
5. Abra o arquivo `schema.sql` num bloco de notas, **copie tudo** e cole ali.
6. Clique em **Run**. Deve aparecer `Success`. Pronto, o banco está montado.

---

## Parte 2 — Pegar as duas chaves (2 min)

1. Menu da esquerda → **Project Settings** (a engrenagem) → **Data API**.
2. Copie a **Project URL**. É algo como `https://abcdefgh.supabase.co`.
3. Ainda em Project Settings, vá em **API Keys** e copie a chave **anon** (às vezes aparece como *publishable*). É um texto longo.
4. Abra o arquivo **`config.js`** num bloco de notas e cole os dois valores nos lugares indicados:

```js
SUPABASE_URL: "https://abcdefgh.supabase.co",
SUPABASE_ANON_KEY: "eyJhbGciOi...",
```

Salve o arquivo.

> **Essa chave pode ficar visível?** Pode. Ela sozinha não abre nada. Quem controla o acesso são
> as regras que você acabou de instalar no banco: sem login válido, ela não devolve um único dado.

---

## Parte 3 — Publicar o app (5 min)

1. Junte todos os arquivos desta pasta num único ZIP, ou deixe a pasta pronta.
2. Entre em **app.netlify.com/drop**.
3. **Arraste a pasta inteira** para dentro da página. Só isso.
4. Em segundos ele devolve um endereço tipo `https://algo-aleatorio.netlify.app`.
5. Clique em **Site configuration → Change site name** para trocar por algo decente, tipo
   `campanhas-suaempresa`. O endereço vira `https://campanhas-suaempresa.netlify.app`.

Guarde esse endereço: é o seu app.

---

## Parte 4 — Liberar o login por e-mail (3 min)

1. Volte no Supabase → **Authentication** → **URL Configuration**.
2. Em **Site URL**, cole o endereço do Netlify (`https://campanhas-suaempresa.netlify.app`).
3. Em **Redirect URLs**, adicione o mesmo endereço.
4. Salve.

> Isso é o que permite que o link enviado por e-mail funcione. Sem esse passo, o login falha.

---

## Parte 5 — Virar o aprovador (2 min)

1. Abra o app no celular e digite **seu e-mail**. Toque em *Enviar link de acesso*.
2. Abra o e-mail **no mesmo celular** e toque no link. Você entra no app.
3. Volte no Supabase → **SQL Editor** → **New query** e rode isto, trocando pelo seu e-mail:

```sql
update perfis set papel = 'aprovador' where email = 'seu.email@empresa.com.br';
```

4. No app, saia e entre de novo. Agora você é o aprovador — só você vê os botões de decisão.

> **Todo mundo que entra vira coordenador automaticamente.** Só quem você promover com esse
> comando pode aprovar. É proposital: assim ninguém libera verba por engano.

---

## Parte 6 — Instalar no celular (1 min)

Mande o endereço para os 5 coordenadores. Cada um faz o seguinte:

**Android (Chrome):** abrir o link → menu de três pontinhos → **Instalar aplicativo**.

**iPhone (Safari):** abrir o link → botão de compartilhar (o quadradinho com a seta) →
**Adicionar à Tela de Início**.

O ícone fica na tela junto com os outros apps, abre em tela cheia e ninguém percebe que é um site.

---

## Como funciona no dia a dia

O coordenador abre o app, preenche a campanha e envia. A tela dele já abre direto no formulário,
porque é só isso que ele pode fazer.

No seu celular, a aba **Campanhas** mostra a bolinha vermelha com quantos estão na fila, já
filtrada em *Pendentes*. Se o app estiver aberto, ele atualiza sozinho na hora. Você toca no
cartão, vê a tela de detalhe com o custo total e a barra de meta, e decide no botão vermelho.
Reprovar abre uma folha pedindo o motivo — o coordenador lê depois.

A aba **Início** dá a posição consolidada, e o **Histórico** guarda tudo que já foi decidido.
Em **Perfil**, o botão baixa o Excel com 29 colunas, incluindo investimento LYNKZ, investimento
indústria, rebate estimado, custo total e o motivo de cada reprova.

---

## Regras que estão travadas no banco (ninguém contorna)

- Só quem tem papel de `aprovador` consegue mudar o status. Um coordenador que tente fazer isso
  pelo navegador recebe erro do próprio banco de dados.
- Toda campanha nasce como **Pendente**. Não dá para criar algo já aprovado.
- Uma campanha já decidida **não pode ser decidida de novo**. Se tentar, o banco recusa.
- Reprova **sem motivo** é bloqueada.
- **Nada pode ser apagado.** O histórico é permanente.
- Quem aprovou e em que data são carimbados pelo banco, não pelo app — não tem como falsificar.

---

## Perguntas que vão aparecer

**Um coordenador saiu da empresa.** No Supabase → **Table Editor** → tabela `perfis` → desmarque
`ativo` na linha dele. Ele perde o acesso na hora.

**Quero mudar as faixas de cor.** Abra o `config.js`, mude `FAIXA_VERDE` e `FAIXA_AMARELA`
(`0.08` é 8%) e publique de novo arrastando a pasta no Netlify.

**A marca oficial já está aplicada.** O vermelho do sistema é o `#E11F1C`, amostrado do arquivo
original da logo. Se a marca mudar, troque o `logo.png` e rode de novo o passo que gera os ícones.

**Quero mudar as cores da marca.** Abra o `estilo.css`. As primeiras 30 linhas concentram todas
as cores, cantos arredondados e sombras do sistema. Mudar `--red` ali troca a cor do app inteiro:
botões, filtros, botão flutuante e barra inferior. É o mesmo bloco em todos os nossos aplicativos,
então dá para copiar entre projetos.

**Quero adicionar um laboratório.** Mesma coisa: `config.js`, lista `LABORATORIOS`.

**Perdi tudo?** Não. Os dados ficam no Supabase, não no app. Republicar o site não apaga nada.

**Chega notificação empurrada no celular?** Ainda não. Hoje o app avisa quando está aberto, e a
bolinha vermelha mostra a fila quando você abre. Push de verdade é o próximo passo — o caminho
mais simples é um e-mail automático para você a cada campanha nova.

**Por que o login é por link e não por senha?** Menos coisa para o campo esquecer e nada de
redefinição de senha para você administrar. Se o padrão da empresa exigir e-mail e senha como
nos outros apps, dá para trocar: o Supabase suporta os dois.

---

## Arquivos desta pasta

| Arquivo | O que é |
|---|---|
| `index.html` | A estrutura das telas |
| `estilo.css` | O sistema visual (cores, cantos, sombras) — padrão dos nossos apps |
| `app.js` | A lógica: login, cálculos, aprovação, Excel |
| `config.js` | **O que você edita no dia a dia:** chaves, marca e listas |
| `schema.sql` | O banco de dados e as regras de segurança |
| `manifest.json`, `sw.js` | O que faz virar app instalável |
| `logo.png` | Marca em vermelho, fundo transparente |
| `logo-branca.png` | Marca em branco, para usar sobre fundo vermelho |
| `icon-*.png` | Ícone na tela do celular, gerado a partir da marca |
