// ============================================================
//  CONFIGURAÇÃO — este é o único arquivo que você precisa editar.
//  Pegue os dois valores no Supabase em:
//  Project Settings → Data API  (e Project Settings → API Keys)
// ============================================================

window.CONFIG = {

  // Cole aqui a "Project URL". Parece com: https://abcdefgh.supabase.co
  SUPABASE_URL: "https://kdznytksxtjmuqwrqxka.supabase.co",

  // Cole aqui a chave pública "anon" / "publishable".
  // Pode ficar visível no site: ela sozinha não dá acesso a nada,
  // porque as regras de segurança estão no banco de dados.
  SUPABASE_ANON_KEY: "sb_publishable_XnuKH9eGnMBvX2EVEGbTPQ_PTzZTIrt",

  // ---------- IDENTIDADE ----------
  // Aparece na tela de login e no rodapé.
  MARCA: "LYNKZ",
  SUBMARCA: "CAMPANHAS",
  DOMINIO: "lynkz.com.br",
  VERSAO: "1.0.0",

  // Faixas do indicador de custo sobre a meta.
  // 0.08 = 8%. Ajuste para a régua da sua operação.
  FAIXA_VERDE: 0.08,   // até aqui, dentro do padrão
  FAIXA_AMARELA: 0.15, // até aqui, atenção; acima disso, vermelho

  // Listas dos menus suspensos. Edite à vontade.
  LABORATORIOS: ["Avert","BePet","Biogénesis Bagó Pet","Bionatural","Boehringer","Catlife","Centagro","Coolors","Farmina","Kelco","Nova D+","Nutripharme","OmniLab","Organnact Pet","Ouro Fino","Pet Delícia","Pet Next","Pet Nutrition","Premier","Special Dog","Vansil"],
  TIPOS: ["Desconto progressivo","Bonificação (leve X pague Y)","Verba de merchandising","Rebate por meta","Ponto extra / exposição","Encarte / tabloide","Combo de produtos","Ação de sell-out"],
  METAS: ["Mensal","Trimestral","Anual","Do mês da campanha"],
  PAGTO: ["Desconto em nota","Bonificação em produto","Depósito / verba","Crédito em conta corrente"],
  BASES: ["Bonificação","Sell-in (compras do cliente)","Sell-out (vendas do cliente)","Faturamento no período"],
  GATILHOS: ["Ao atingir 100% da meta","A partir de 80% da meta","Escalonado por faixa","Sobre todo o volume comprado"]
};
