import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const C  = window.CONFIG;
const sb = createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY);

let dados = [], perfil = null, alvo = null, canal = null;
let filtro = 'Pendente', busca = '', abaAtual = 'inicio', voltarPara = 'lista';

/* ---------------- utilidades ---------------- */
const brl  = n => Number(n||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
const brl0 = n => Number(n||0).toLocaleString('pt-BR',{maximumFractionDigits:0});
const dt   = s => s ? String(s).slice(0,10).split('-').reverse().join('/') : '—';
const esc  = s => String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const dias = (a,b) => (a&&b) ? Math.round((new Date(b)-new Date(a))/864e5)+1 : null;
const $    = id => document.getElementById(id);

/* Custo real = investimento LYNKZ + investimento indústria + rebate estimado (devido se o cliente bater a meta) */
function calc(c){
  const invL=+c.investimento_lynkz||0, invI=+c.investimento_industria||0, inv=invL+invI;
  const meta=+c.meta||0, pct=+c.rebate_pct||0, teto=+c.rebate_teto||0;
  let reb = (meta>0 && pct>0) ? meta*(pct/100) : 0;
  const limitado = teto>0 && reb>teto;
  if(limitado) reb = teto;
  const total = inv+reb;
  return {invL, invI, inv, meta, reb, total, limitado, pctMeta: meta>0 ? total/meta : null};
}
function banda(p){
  if(p==null)              return {cor:'var(--ink-3)',  txt:'sem meta informada'};
  if(p<=C.FAIXA_VERDE)     return {cor:'var(--green)',  txt:'dentro do padrão'};
  if(p<=C.FAIXA_AMARELA)   return {cor:'var(--amber)',  txt:'atenção'};
  return                          {cor:'var(--red)',    txt:'acima do padrão'};
}
const selo = s => s==='Aprovada' ? 'b-ok' : s==='Reprovada' ? 'b-no' : 'b-wait';

function toast(msg){
  const t=$('toast'); t.textContent=msg; t.classList.add('show');
  clearTimeout(t._x); t._x=setTimeout(()=>t.classList.remove('show'),3000);
}
const ICO = {
  relogio:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 1.9"/></svg>',
  check:'<svg viewBox="0 0 24 24"><path d="M4 12.5l5.5 5.5L20 7"/></svg>',
  lista:'<svg viewBox="0 0 24 24"><path d="M8 6h13M8 12h13M8 18h13"/></svg>',
  baixar:'<svg viewBox="0 0 24 24"><path d="M12 3v12"/><path d="M7.5 10.5L12 15l4.5-4.5"/><path d="M4 20h16"/></svg>',
  busca:'<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6"/></svg>'
};
const PIN = `<svg class="pin" viewBox="0 0 34 38"><path d="M17 1C8.7 1 2 7.7 2 16c0 10.5 13.2 20.4 13.8 20.8a2 2 0 002.4 0C18.8 36.4 32 26.5 32 16 32 7.7 25.3 1 17 1z" fill="var(--red)"/><circle cx="17" cy="15.5" r="8.5" fill="#fff"/><path d="M12.7 15.6l3 3 5.6-6" stroke="var(--red)" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const LOGO = `<div class="logo">${PIN}<div class="wordmark"><img src="logo.png" alt="LYNKZ"><span>${'{SUB}'}</span></div></div>`;
const marca = () => LOGO.replace('{SUB}', (C.SUBMARCA||'CAMPANHAS'));

/* ---------------- acesso ---------------- */
async function iniciar(){
  const { data:{ session } } = await sb.auth.getSession();
  if(!session){ mostrarLogin(); return; }

  const { data:p, error } = await sb.from('perfis').select('*').eq('id', session.user.id).single();
  if(error || !p){ aviso('Perfil não encontrado','Sua conta entrou, mas o perfil não foi criado. Rode o schema.sql no Supabase e tente de novo.'); return; }
  if(!p.ativo){ aviso('Acesso desativado','Fale com a gerência para reativar seu acesso.'); return; }

  perfil = p;
  $('gate').hidden = true;
  $('app').hidden  = false;
  await carregar();
  escutar();
  irPara(perfil.papel==='aprovador' ? 'inicio' : 'lista');
}

function aviso(titulo, texto){
  $('app').hidden = true; $('gate').hidden = false;
  $('gate').innerHTML = `<div class="gate-in">
    ${marca()}
    <h2>${esc(titulo)}</h2><p class="sub">${esc(texto)}</p>
    <button class="btn btn-ghost" id="sair-x">Sair</button></div>`;
  $('sair-x').onclick = sair;
}

function mostrarLogin(){
  $('app').hidden = true; $('gate').hidden = false;
  $('gate').innerHTML = `
    <div class="gate-in">
      ${marca()}
      <h2>Bem-vindo de volta</h2>
      <p class="sub">Entre com o e-mail e a senha da empresa.</p>
      <div class="field"><label>E-mail</label>
        <input id="g-email" type="email" inputmode="email" autocomplete="email" placeholder="seuemail@${esc(C.DOMINIO||'empresa.com.br')}"></div>
      <div class="field"><label>Senha</label>
        <input id="g-senha" type="password" autocomplete="current-password" placeholder="Sua senha"></div>
      <button class="btn btn-red" id="g-send">Entrar</button>
      <p class="gate-msg" id="g-msg"></p>
      <p class="ver">Online · v${esc(C.VERSAO||'1.0.0')}</p>
    </div>`;

  $('g-send').onclick = async () => {
    const email = ($('g-email').value||'').trim().toLowerCase();
    const senha = $('g-senha').value||'';
    const msg = $('g-msg'); msg.className = 'gate-msg';
    if(!/^\S+@\S+\.\S+$/.test(email)){ msg.classList.add('err'); msg.textContent='Digite um e-mail válido.'; return; }
    if(!senha){ msg.classList.add('err'); msg.textContent='Digite sua senha.'; return; }
    $('g-send').disabled = true; $('g-send').textContent = 'Entrando…';
    const { error } = await sb.auth.signInWithPassword({ email, password: senha });
    $('g-send').disabled = false; $('g-send').textContent = 'Entrar';
    if(error){
      msg.className = 'gate-msg err';
      msg.textContent = /invalid login credentials/i.test(error.message)
        ? 'E-mail ou senha inválidos.'
        : 'Não foi possível entrar: ' + error.message;
    }
  };
  $('g-email').addEventListener('keydown', e => { if(e.key==='Enter') $('g-senha').focus(); });
  $('g-senha').addEventListener('keydown', e => { if(e.key==='Enter') $('g-send').click(); });
}

async function sair(){
  if(canal) sb.removeChannel(canal);
  await sb.auth.signOut();
  location.reload();
}

/* ---------------- dados ---------------- */
async function carregar(){
  const { data, error } = await sb.from('campanhas').select('*').order('criado_em',{ascending:false});
  if(error){ toast('Não foi possível carregar: ' + error.message); return; }
  dados = data || [];
  render();
}
function escutar(){
  canal = sb.channel('campanhas-ao-vivo')
    .on('postgres_changes',{event:'*',schema:'public',table:'campanhas'}, payload => {
      carregar();
      if(payload.eventType==='INSERT' && perfil.papel==='aprovador'){
        toast('Nova campanha aguardando você.');
        if(navigator.vibrate) navigator.vibrate(140);
      }
    }).subscribe();
}
const pendentes = () => dados.filter(c=>c.status==='Pendente');

/* ---------------- INÍCIO ---------------- */
function pintarInicio(){
  const pend = pendentes();
  const aprov = dados.filter(c=>c.status==='Aprovada');
  const custoAprov = aprov.reduce((a,c)=>a+calc(c).total,0);
  const rebComp    = aprov.reduce((a,c)=>a+calc(c).reb,0);
  const valorPend  = pend.reduce((a,c)=>a+calc(c).total,0);
  const ehAprov = perfil.papel==='aprovador';

  $('s-inicio').innerHTML = `
    ${pend.length ? `
      <div class="callout">
        <p>${ehAprov ? 'Aguardando sua decisão' : 'Suas campanhas em análise'}</p>
        <strong>${pend.length} ${pend.length===1?'campanha':'campanhas'} · R$ ${brl0(valorPend)}</strong>
        <button id="ir-pend">${ehAprov?'Revisar agora':'Ver situação'}</button>
      </div>` : `
      <div class="callout" style="background:var(--green);box-shadow:0 6px 18px rgba(18,138,72,.28)">
        <p>Fila limpa</p><strong>Nenhuma campanha pendente</strong>
        <button id="ir-pend" style="color:var(--green)">Ver todas</button>
      </div>`}

    <p class="seclabel">Posição consolidada</p>
    <div class="kpis">
      <dl class="kpi"><dt>Campanhas</dt><dd>${dados.length}</dd></dl>
      <dl class="kpi amber"><dt>Pendentes</dt><dd>${pend.length}</dd></dl>
      <dl class="kpi green"><dt>Custo aprovado</dt><dd>R$ ${brl0(custoAprov)}</dd></dl>
      <dl class="kpi ${rebComp>0?'red':'zero'}"><dt>Rebate comprometido</dt><dd>R$ ${brl0(rebComp)}</dd></dl>
    </div>
    <p class="hint" style="margin:-6px 0 18px">Custo = verba + rebate estimado se o cliente bater a meta.</p>

    <p class="seclabel">Últimas movimentações</p>
    ${dados.slice(0,4).map(cartao).join('') || `<div class="empty"><div class="ring">${ICO.lista}</div>
      <p>Nenhuma campanha ainda</p><small>Toque no botão vermelho para cadastrar a primeira.</small></div>`}`;

  const b = $('ir-pend'); if(b) b.onclick = () => { filtro='Pendente'; irPara('lista'); };
}

/* ---------------- cartão de lista ---------------- */
function cartao(c){
  const k = calc(c), bd = banda(k.pctMeta);
  const larg = k.pctMeta==null ? 0 : Math.min(k.pctMeta/.25*100,100);
  return `<button class="item" data-abrir="${c.id}">
    <div class="item-top">
      <p class="item-name">${esc(c.cliente)}</p>
      <span class="badge ${selo(c.status)}">${esc(c.status)}</span>
    </div>
    <p class="item-sub">${esc(c.codigo)} · ${esc(c.laboratorio)} · ${esc(c.campanha)}</p>
    <div class="mini">
      <div class="mini-bar"><i style="width:${larg}%;background:${bd.cor}"></i></div>
      <span class="mini-pct" style="color:${bd.cor}">${k.pctMeta==null?'—':(k.pctMeta*100).toFixed(1)+'% da meta'}</span>
    </div>
    <div class="item-foot">
      <span class="item-val">R$ ${brl(k.total)}</span>
      <span class="item-when">${ICO.relogio}${dt(c.criado_em)}</span>
    </div>
  </button>`;
}

/* ---------------- LISTA ---------------- */
function pintarLista(){
  const d = $('dot'), np = pendentes().length;
  if(np){ d.hidden=false; d.textContent=np; } else d.hidden=true;

  const filtros = ['Pendente','Aprovada','Reprovada','Todas'];
  const termo = busca.trim().toLowerCase();
  let lista = dados.filter(c => filtro==='Todas' || c.status===filtro);
  if(termo) lista = lista.filter(c =>
    (c.cliente+' '+c.laboratorio+' '+c.campanha+' '+c.codigo).toLowerCase().includes(termo));

  $('s-lista').innerHTML = `
    <div class="search">${ICO.busca}
      <input id="f-busca" placeholder="Buscar por cliente, laboratório ou código" value="${esc(busca)}"></div>
    <div class="pills">${filtros.map(f=>{
      const n = f==='Todas' ? dados.length : dados.filter(c=>c.status===f).length;
      return `<button class="pill ${f===filtro?'on':''}" data-filtro="${f}">${f==='Pendente'?'Pendentes':f==='Aprovada'?'Aprovadas':f==='Reprovada'?'Reprovadas':'Todas'} ${n?`(${n})`:''}</button>`;
    }).join('')}</div>
    ${lista.length ? lista.map(cartao).join('') : `<div class="empty"><div class="ring">${ICO.check}</div>
      <p>${termo?'Nada encontrado':'Nada por aqui'}</p>
      <small>${termo?'Tente outro nome, código ou laboratório.':'Campanhas com esse status aparecem aqui.'}</small></div>`}`;

  const inp = $('f-busca');
  inp.oninput = e => { busca = e.target.value; const p = e.target.selectionStart; pintarLista();
    const n = $('f-busca'); n.focus(); n.setSelectionRange(p,p); };
  document.querySelectorAll('[data-filtro]').forEach(b => b.onclick = () => { filtro=b.dataset.filtro; pintarLista(); });
}

/* ---------------- DETALHE ---------------- */
function abrir(id){
  const c = dados.find(x => String(x.id)===String(id));
  if(!c) return;
  const k = calc(c), bd = banda(k.pctMeta);
  const larg = k.pctMeta==null ? 0 : Math.min(k.pctMeta/.25*100,100);
  const d = dias(c.data_inicio, c.data_fim);
  const podeDecidir = perfil.papel==='aprovador' && c.status==='Pendente';

  $('s-detalhe').innerHTML = `
    <div class="hero">
      <div class="hero-top">
        <p class="hero-name">${esc(c.cliente)}</p>
        <span class="badge ${selo(c.status)}">${esc(c.status)}</span>
      </div>
      <p class="hero-title">${esc(c.campanha)}</p>
      <p class="hero-code">${esc(c.codigo)} · ${esc(c.laboratorio)}</p>
    </div>

    <p class="seclabel">Custo da campanha</p>
    <div class="block">
      <div class="amount">
        <p class="lbl">Custo total</p>
        <p class="big">R$ ${brl(k.total)}</p>
        <p class="split">LYNKZ <b>R$ ${brl(k.invL)}</b> + indústria <b>R$ ${brl(k.invI)}</b>${k.reb>0?` + rebate <b>R$ ${brl(k.reb)}</b>${k.limitado?' <span class="tag-teto">no teto</span>':''}`:''}</p>
      </div>
      <div class="gauge-wrap">
        <div class="gauge-head">
          <span>sobre a meta ${c.tipo_meta?'('+esc(c.tipo_meta.toLowerCase())+')':''}</span>
          <b style="color:${bd.cor}">${k.pctMeta==null?'—':(k.pctMeta*100).toFixed(1)+'%'}</b>
        </div>
        <div class="gbar"><i style="width:${larg}%;background:${bd.cor}"></i></div>
        <div class="gmarks">
          <span style="left:${C.FAIXA_VERDE/.25*100}%">${(C.FAIXA_VERDE*100).toFixed(0)}%</span>
          <span style="left:${C.FAIXA_AMARELA/.25*100}%">${(C.FAIXA_AMARELA*100).toFixed(0)}%</span>
          <span style="left:100%;transform:translateX(-100%)">25%+</span>
        </div>
        <p class="gnote" style="color:${bd.cor}">${bd.txt}</p>
      </div>
    </div>

    <p class="seclabel">Informações</p>
    <div class="block">
      <div class="line"><dt>Meta do cliente</dt><dd>${c.meta?'R$ '+brl(c.meta):'—'}</dd></div>
      <div class="line"><dt>Tipo de meta</dt><dd>${esc(c.tipo_meta)||'—'}</dd></div>
      <div class="line"><dt>Período</dt><dd>${dt(c.data_inicio)} → ${dt(c.data_fim)}</dd></div>
      <div class="line"><dt>Duração</dt><dd>${d?d+' dias':'—'}</dd></div>
      <div class="line"><dt>Mecânica</dt><dd>${esc(c.tipo)||'—'}</dd></div>
      <div class="line"><dt>Pagamento</dt><dd>${esc(c.forma_pagamento)||'—'}</dd></div>
      ${c.mecanica?`<div class="line stack"><dt>Como funciona</dt><dd>${esc(c.mecanica)}</dd></div>`:''}
      ${c.observacoes?`<div class="line stack"><dt>Observações</dt><dd>${esc(c.observacoes)}</dd></div>`:''}
    </div>

    ${k.reb>0?`
    <p class="seclabel">Rebate</p>
    <div class="block">
      <div class="line"><dt>Percentual</dt><dd style="color:var(--red)">${String(c.rebate_pct).replace('.',',')}%</dd></div>
      <div class="line"><dt>Base de cálculo</dt><dd>${esc(c.rebate_base)||'—'}</dd></div>
      <div class="line"><dt>Quando é devido</dt><dd>${esc(c.rebate_gatilho)||'—'}</dd></div>
      <div class="line"><dt>Teto</dt><dd>${c.rebate_teto>0?'R$ '+brl(c.rebate_teto):'sem teto'}</dd></div>
      <div class="line"><dt>Estimado</dt><dd>R$ ${brl(k.reb)}</dd></div>
    </div>`:''}

    <p class="seclabel">Solicitação</p>
    <div class="block">
      <div class="line"><dt>Solicitante</dt><dd>${esc(c.solicitante_nome)||'—'}</dd></div>
      <div class="line"><dt>Enviada em</dt><dd>${dt(c.criado_em)}</dd></div>
      ${c.status!=='Pendente'?`
        <div class="line"><dt>Decidida por</dt><dd>${esc(c.aprovador_nome)||'—'}</dd></div>
        <div class="line"><dt>Data da decisão</dt><dd>${dt(c.data_decisao)}</dd></div>`:''}
      ${c.motivo?`<div class="line stack"><dt>Motivo da reprova</dt><dd style="color:var(--red)">${esc(c.motivo)}</dd></div>`:''}
    </div>

    ${podeDecidir ? `<div class="actions">
      <button class="btn btn-red" data-ok="${c.id}">${ICO.check} Aprovar campanha</button>
      <button class="btn btn-danger" data-no="${c.id}">Reprovar</button>
    </div>` : ''}`;

  voltarPara = abaAtual==='detalhe' ? voltarPara : abaAtual;
  irPara('detalhe', esc(c.cliente));
}

/* ---------------- NOVA ---------------- */
function pintarNova(){
  const op = (a,ph) => `<option value="">${ph}</option>` + a.map(x=>`<option>${esc(x)}</option>`).join('');
  $('s-nova').innerHTML = `
    <p class="seclabel">Dados do cliente</p>
    <div class="field"><label>Cliente</label><input id="f-cliente" placeholder="Razão social ou nome da loja"></div>
    <div class="field"><label>Laboratório</label><select id="f-lab">${op(C.LABORATORIOS,'Selecione')}</select></div>

    <p class="seclabel">A campanha</p>
    <div class="field"><label>Nome da campanha</label><input id="f-camp" placeholder="Ex.: Genéricos Setembro"></div>
    <div class="field"><label>Mecânica</label><select id="f-tipo">${op(C.TIPOS,'Selecione')}</select></div>
    <div class="field"><label>Como funciona</label><textarea id="f-mec" placeholder="Ex.: 5% de desconto acima de 200 un. e 8% acima de 400 un."></textarea></div>
    <div class="two">
      <div class="field"><label>Início</label><input id="f-ini" type="date"></div>
      <div class="field"><label>Fim</label><input id="f-fim" type="date"></div>
    </div>

    <p class="seclabel">Investimento</p>
    <div class="two">
      <div class="field"><label>LYNKZ (R$)</label><input id="f-inv-lynkz" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0,00"></div>
      <div class="field"><label>Indústria (R$)</label><input id="f-inv-industria" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0,00"></div>
    </div>
    <p class="hint">LYNKZ sai do caixa agora. Indústria é a bonificação prometida, paga no mês seguinte.</p>
    <div class="field"><label>Forma de pagamento</label><select id="f-pag">${op(C.PAGTO,'Selecione')}</select></div>

    <p class="seclabel">Contrapartida do cliente</p>
    <div class="field"><label>Tipo de meta</label><select id="f-tm">${op(C.METAS,'Selecione')}</select></div>
    <div class="field"><label>Meta do cliente (R$)</label><input id="f-meta" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0,00"></div>

    <div class="switch"><label><input type="checkbox" id="f-rb-on"> Esta campanha tem rebate</label></div>
    <div id="rb-box" hidden>
      <div class="two">
        <div class="field"><label>% de rebate</label><input id="f-rb-pct" type="number" min="0" step="0.1" inputmode="decimal" placeholder="0,0"></div>
        <div class="field"><label>Teto em R$ (opcional)</label><input id="f-rb-teto" type="number" min="0" step="0.01" inputmode="decimal" placeholder="sem teto"></div>
      </div>
      <div class="field"><label>Base de cálculo</label><select id="f-rb-base">${op(C.BASES,'Selecione')}</select></div>
      <div class="field"><label>Quando o rebate é devido</label><select id="f-rb-gat">${op(C.GATILHOS,'Selecione')}</select></div>
      <p class="preview" id="rb-calc">Informe a meta e o % para ver o custo total.</p>
    </div>

    <div class="field"><label>Observações</label><textarea id="f-obs" placeholder="Opcional"></textarea></div>
    <button class="btn btn-red" id="f-send">Enviar para aprovação</button>
    <p class="hint">Cliente, laboratório, nome da campanha e os dois valores de investimento são obrigatórios.</p>`;

  const v = id => ($(id).value||'').trim();

  function previa(){
    const on = $('f-rb-on').checked;
    $('rb-box').hidden = !on;
    if(!on) return;
    const k = calc({ investimento_lynkz:parseFloat(v('f-inv-lynkz'))||0, investimento_industria:parseFloat(v('f-inv-industria'))||0,
                     meta:parseFloat(v('f-meta'))||0,
                     rebate_pct:parseFloat(v('f-rb-pct'))||0, rebate_teto:parseFloat(v('f-rb-teto'))||0 });
    $('rb-calc').innerHTML = (k.meta>0 && k.reb>0)
      ? `Rebate estimado <b>R$ ${brl(k.reb)}</b>${k.limitado?' (limitado pelo teto)':''}<br>
         Custo total <b>R$ ${brl(k.total)}</b> · <b>${(k.pctMeta*100).toFixed(1)}%</b> da meta`
      : 'Informe a meta e o % para ver o custo total.';
  }
  ['f-rb-on','f-rb-pct','f-rb-teto','f-meta','f-inv-lynkz','f-inv-industria'].forEach(id=>{
    $(id).addEventListener('input',previa); $(id).addEventListener('change',previa);
  });

  $('f-send').onclick = async () => {
    if(!v('f-cliente')||!v('f-lab')||!v('f-camp')||!v('f-inv-lynkz')||!v('f-inv-industria')){
      toast('Preencha cliente, laboratório, campanha e os dois valores de investimento.'); return; }
    if(v('f-ini') && v('f-fim') && v('f-fim') < v('f-ini')){
      toast('A data fim está antes da data início.'); return; }
    const rbOn = $('f-rb-on').checked;
    if(rbOn && !(parseFloat(v('f-rb-pct'))>0)){ toast('Informe o % de rebate ou desmarque a opção.'); return; }
    if(rbOn && !(parseFloat(v('f-meta'))>0)){ toast('Rebate precisa da meta do cliente para ser calculado.'); return; }

    $('f-send').disabled = true; $('f-send').textContent = 'Enviando…';
    const { error } = await sb.from('campanhas').insert({
      cliente:v('f-cliente'), laboratorio:v('f-lab'), campanha:v('f-camp'),
      tipo:v('f-tipo')||null, mecanica:v('f-mec')||null,
      investimento_lynkz:parseFloat(v('f-inv-lynkz'))||0, investimento_industria:parseFloat(v('f-inv-industria'))||0,
      forma_pagamento:v('f-pag')||null,
      data_inicio:v('f-ini')||null, data_fim:v('f-fim')||null,
      tipo_meta:v('f-tm')||null, meta:parseFloat(v('f-meta'))||0,
      rebate_pct:  rbOn ? (parseFloat(v('f-rb-pct'))||0)  : 0,
      rebate_teto: rbOn ? (parseFloat(v('f-rb-teto'))||0) : 0,
      rebate_base: rbOn ? (v('f-rb-base')||null) : null,
      rebate_gatilho: rbOn ? (v('f-rb-gat')||null) : null,
      observacoes:v('f-obs')||null, status:'Pendente',
      solicitante_id: perfil.id, solicitante_nome: perfil.nome
    });
    $('f-send').disabled = false; $('f-send').textContent = 'Enviar para aprovação';
    if(error){ toast('Não foi possível enviar: ' + error.message); return; }
    toast('Enviada. Já está na fila de aprovação.');
    await carregar();
    filtro = 'Pendente';
    irPara('lista');
  };
}

/* ---------------- HISTÓRICO ---------------- */
function pintarHistorico(){
  const decididas = dados.filter(c => c.status!=='Pendente');
  $('s-historico').innerHTML = decididas.length
    ? `<p class="seclabel">${decididas.length} ${decididas.length===1?'decisão registrada':'decisões registradas'}</p>`
      + decididas.map(cartao).join('')
    : `<div class="empty"><div class="ring">${ICO.relogio}</div><p>Sem histórico ainda</p>
       <small>Toda campanha aprovada ou reprovada fica arquivada aqui, para sempre.</small></div>`;
}

/* ---------------- PERFIL ---------------- */
function pintarPerfil(){
  const inicial = (perfil.nome||'?').trim().charAt(0).toUpperCase();
  const minhas = dados.filter(c => c.solicitante_id===perfil.id).length;
  $('s-perfil').innerHTML = `
    <div class="me">
      <div class="av">${esc(inicial)}</div>
      <h3>${esc(perfil.nome)}</h3>
      <p>${esc(perfil.email)}</p>
      <span class="badge ${perfil.papel==='aprovador'?'b-no':'b-ok'}">${perfil.papel==='aprovador'?'Aprovador':'Coordenador'}</span>
    </div>

    <p class="seclabel">Resumo</p>
    <div class="block">
      <div class="line"><dt>Campanhas que você enviou</dt><dd>${minhas}</dd></div>
      <div class="line"><dt>Total no sistema</dt><dd>${dados.length}</dd></div>
      <div class="line"><dt>Aguardando decisão</dt><dd>${pendentes().length}</dd></div>
    </div>

    <p class="seclabel">Relatório</p>
    <div class="actions" style="margin-bottom:18px">
      <button class="btn btn-ghost" id="btn-xls">${ICO.baixar} Baixar planilha Excel</button>
    </div>

    <button class="btn btn-danger" id="btn-sair">Sair da conta</button>
    <p class="ver" style="text-align:center">Online · v${esc(C.VERSAO||'1.0.0')}</p>`;
  $('btn-xls').onclick  = exportar;
  $('btn-sair').onclick = sair;
}

/* ---------------- Excel ---------------- */
function exportar(){
  if(!dados.length){ toast('Não há nada para exportar ainda.'); return; }
  if(typeof XLSX === 'undefined'){ toast('A biblioteca de Excel não carregou. Recarregue a página.'); return; }
  const linhas = dados.map(c => { const k = calc(c); return {
    'ID':c.codigo,'Data Solicitação':dt(c.criado_em),'Solicitante':c.solicitante_nome,
    'Cliente':c.cliente,'Laboratório':c.laboratorio,'Nome da Campanha':c.campanha,
    'Tipo de Campanha':c.tipo,'Mecânica / Descrição':c.mecanica,
    'Investimento LYNKZ (R$)':k.invL,'Investimento Indústria (R$)':k.invI,'Forma de Pagamento':c.forma_pagamento,
    'Data Início':dt(c.data_inicio),'Data Fim':dt(c.data_fim),
    'Duração (dias)':dias(c.data_inicio,c.data_fim)||'',
    'Tipo de Meta':c.tipo_meta,'Meta do Cliente (R$)':+c.meta||0,
    'Tem Rebate':k.reb>0?'Sim':'Não','% Rebate':c.rebate_pct?(+c.rebate_pct)/100:'',
    'Base do Rebate':c.rebate_base||'','Gatilho do Rebate':c.rebate_gatilho||'',
    'Teto do Rebate (R$)':+c.rebate_teto||'','Rebate Estimado (R$)':k.reb||0,
    'Custo Total (R$)':k.total,'% Custo Total / Meta':k.pctMeta==null?'':k.pctMeta,
    'Status':c.status,'Aprovador':c.aprovador_nome||'',
    'Data da Decisão':c.data_decisao?dt(c.data_decisao):'',
    'Motivo da Reprova':c.motivo||'','Observações':c.observacoes||''
  };});
  const ws = XLSX.utils.json_to_sheet(linhas);
  ws['!cols'] = [{wch:11},{wch:15},{wch:16},{wch:26},{wch:15},{wch:26},{wch:24},{wch:38},
    {wch:19},{wch:19},{wch:21},{wch:12},{wch:12},{wch:13},{wch:16},{wch:19},{wch:11},{wch:10},
    {wch:26},{wch:24},{wch:18},{wch:20},{wch:17},{wch:18},{wch:12},{wch:16},{wch:15},{wch:30},{wch:28}];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Campanhas');
  XLSX.writeFile(wb, `Extrato_Campanhas_${new Date().toISOString().slice(0,10)}.xlsx`);
  toast('Planilha gerada.');
}

/* ---------------- decisões ---------------- */
async function decidir(id, status, motivo){
  const c = dados.find(x => String(x.id)===String(id));
  if(!c) return;
  const { error } = await sb.from('campanhas')
    .update({ status, motivo: motivo||null }).eq('id', id).eq('status','Pendente');
  if(error){ toast('Não foi possível registrar: ' + error.message); return; }
  toast(status==='Aprovada' ? `Aprovada · ${c.cliente} · R$ ${brl(calc(c).total)}` : `Reprovada · ${c.cliente}`);
  await carregar();
  irPara(voltarPara==='detalhe' ? 'lista' : voltarPara);
}

document.addEventListener('click', e => {
  const ab = e.target.closest('[data-abrir]');
  const ok = e.target.closest('[data-ok]');
  const no = e.target.closest('[data-no]');
  if(ab) abrir(ab.dataset.abrir);
  if(ok) decidir(ok.dataset.ok,'Aprovada');
  if(no){
    alvo = no.dataset.no;
    const c = dados.find(x => String(x.id)===String(alvo));
    $('sheet-sub').textContent = c ? `${c.cliente} · R$ ${brl(calc(c).total)}` : '';
    $('motivo').value = '';
    $('sheet').classList.add('on');
    $('motivo').focus();
  }
});
$('sheet-cancel').onclick = () => { $('sheet').classList.remove('on'); alvo = null; };
$('sheet-ok').onclick = () => {
  const m = $('motivo').value.trim();
  if(!m){ toast('Escreva o motivo antes de confirmar.'); return; }
  $('sheet').classList.remove('on');
  decidir(alvo,'Reprovada',m); alvo = null;
};

/* ---------------- navegação ---------------- */
const TITULOS = { inicio:'Início', lista:'Campanhas', nova:'Nova campanha', historico:'Histórico', perfil:'Perfil' };

function irPara(tela, titulo){
  abaAtual = tela;
  ['inicio','lista','detalhe','nova','historico','perfil']
    .forEach(t => $('s-'+t).classList.toggle('on', t===tela));

  const interna = tela==='detalhe' || tela==='nova';
  $('btn-back').hidden = !interna;
  $('bar-title').textContent = titulo || TITULOS[tela] || '';
  $('bar-count').textContent = tela==='lista' && pendentes().length ? `${pendentes().length} pendente${pendentes().length>1?'s':''}` : '';

  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('on', b.dataset.tab===tela));
  $('s-'+tela).scrollTop = 0;
  window.scrollTo(0,0);
}
document.querySelectorAll('.tab').forEach(b => b.onclick = () => irPara(b.dataset.tab));
$('fab').onclick = () => { voltarPara = abaAtual==='nova' ? 'lista' : abaAtual; irPara('nova'); };
$('btn-back').onclick = () => irPara(voltarPara==='nova'||voltarPara==='detalhe' ? 'lista' : voltarPara);

function render(){
  pintarInicio(); pintarLista(); pintarNova(); pintarHistorico(); pintarPerfil();
  if(abaAtual==='detalhe'){ /* mantém o detalhe aberto durante atualizações ao vivo */ }
  else irPara(abaAtual);
}

sb.auth.onAuthStateChange(evt => { if(evt==='SIGNED_IN'||evt==='SIGNED_OUT') iniciar(); });
iniciar();
