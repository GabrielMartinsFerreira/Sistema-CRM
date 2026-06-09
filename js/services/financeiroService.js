/* ═══════════════════════════════════════════════════════════════════════
 * js/services/financeiroService.js — Camada de dados + cálculos financeiros
 * ───────────────────────────────────────────────────────────────────────
 * - Data layer: pedidos (leads), faturamento (custos), gastos_fixos.
 * - Lógica matemática PESADA isolada em funções puras (deduções, DRE,
 *   fluxo semanal, resumo mensal) — recebe os dados como parâmetro, sem
 *   tocar no DOM, evitando recálculos caros e lag.
 * Depende de: db, TABLES (js/core/supabase.js)
 * ═══════════════════════════════════════════════════════════════════════ */
const financeiroService = {
  /* ───────────── DATA LAYER ───────────── */
  carregarPedidos(){
    return db.from(TABLES.LEADS).select('*').eq('status','Pedido').order('id',{ascending:false});
  },
  carregarFaturamento(){ return db.from(TABLES.FATURAMENTO).select('*'); },
  buscarFaturamentoPorLead(leadId){
    return db.from(TABLES.FATURAMENTO).select('*').eq('lead_id', leadId).single();
  },
  inserirFaturamento(dados){ return db.from(TABLES.FATURAMENTO).insert([dados]); },
  atualizarFaturamento(id, dados){ return db.from(TABLES.FATURAMENTO).update(dados).eq('id', id); },

  carregarGastos(){ return db.from(TABLES.GASTOS).select('*').order('id',{ascending:true}); },
  inserirGasto(row){ return db.from(TABLES.GASTOS).insert([row]); },
  inserirGastos(rows){ return db.from(TABLES.GASTOS).insert(rows); },
  atualizarGasto(id, upd){ return db.from(TABLES.GASTOS).update(upd).eq('id', id); },
  deletarGasto(id){ return db.from(TABLES.GASTOS).delete().eq('id', id); },
  atualizarGastosIn(ids, upd){ return db.from(TABLES.GASTOS).update(upd).in('id', ids); },
  deletarGastosIn(ids){ return db.from(TABLES.GASTOS).delete().in('id', ids); },

  carregarVariaveis(){ return db.from(TABLES.VARIAVEIS).select('*').order('id',{ascending:true}); },
  inserirVariavel(row){ return db.from(TABLES.VARIAVEIS).insert([row]); },
  atualizarVariavel(id, upd){ return db.from(TABLES.VARIAVEIS).update(upd).eq('id', id); },
  deletarVariavel(id){ return db.from(TABLES.VARIAVEIS).delete().eq('id', id); },

  /* ─────────── MOVIMENTAÇÕES FINANCEIRAS REAIS ─────────── */
  carregarMovimentacoes(){
    return db.from(TABLES.MOVIMENTACOES).select('*').order('data_movimentacao',{ascending:false});
  },
  carregarMovimentacoesPorLead(leadId){
    return db.from(TABLES.MOVIMENTACOES).select('*').eq('lead_id',leadId).order('data_movimentacao',{ascending:false});
  },
  inserirMovimentacao(dados){
    return db.from(TABLES.MOVIMENTACOES).insert([dados]).select().single();
  },
  atualizarMovimentacao(id, upd){
    return db.from(TABLES.MOVIMENTACOES).update(upd).eq('id',id);
  },
  deletarMovimentacao(id){
    return db.from(TABLES.MOVIMENTACOES).delete().eq('id',id);
  },
  /* Soma de Entradas para um array de lead_ids (pode ser Set ou Array) */
  calcValorReal(movimentacoes, leadIds){
    const ids = new Set(leadIds);
    return (movimentacoes||[]).filter(m=>m.tipo==='Entrada' && ids.has(m.lead_id))
      .reduce((s,m)=>s+parseFloat(m.valor||0), 0);
  },
  /* ─────────── CATEGORIAS DINÂMICAS ─────────── */
  carregarCategorias(){
    return db.from(TABLES.CATEGORIAS).select('*').eq('ativo',true).order('ordem',{ascending:true});
  },
  inserirCategoria(dados){
    return db.from(TABLES.CATEGORIAS).insert([dados]).select().single();
  },
  atualizarCategoria(id,upd){
    return db.from(TABLES.CATEGORIAS).update(upd).eq('id',id);
  },
  deletarCategoria(id){
    return db.from(TABLES.CATEGORIAS).update({ativo:false}).eq('id',id);
  },

  /* Soma de Saídas para um array de lead_ids */
  calcSaidas(movimentacoes, leadIds){
    const ids = new Set(leadIds);
    return (movimentacoes||[]).filter(m=>m.tipo==='Saída' && ids.has(m.lead_id))
      .reduce((s,m)=>s+parseFloat(m.valor||0), 0);
  },

  /* ───────────── PURE MATH ───────────── */
  /* Um gasto está pago? (status_pagamento é a fonte; fallback no booleano antigo) */
  ehPago(g){ return (g.status_pagamento || (g.pago?'Pago':'Pendente')) === 'Pago'; },

  /* Deduções detalhadas de um registro de faturamento (com fallback legado) */
  deducoesDetalhadas(f){
    if(!f) return {mat:0,log:0,enc:0,maoInst:0,comVend:0,comArq:0,prevMat:0};
    return {
      mat:     parseFloat(f.materiais||0),
      log:     parseFloat(f.logistica||0),
      enc:     parseFloat(f.encargos||0),
      maoInst: parseFloat(f.mao_obra_inst||f.mao_obra||0),
      comVend: parseFloat(f.comissao_vendedor||0),
      comArq:  parseFloat(f.comissao_arq_eng||0),
      prevMat: parseFloat(f.prev_materiais||0)
    };
  },
  /* Soma das deduções (custos diretos variáveis) de um pedido */
  calcDeducoes(f){
    const c = this.deducoesDetalhadas(f);
    return c.mat + c.log + c.enc + c.maoInst + c.comVend + c.comArq;
  },

  /* Soma dos Gastos Variáveis lançados em um mês/ano (competência) */
  calcVariaveisMes(variaveis, mes, ano){
    return (variaveis||[]).filter(v=>v.mes===mes && v.ano===ano)
      .reduce((s,v)=>s+parseFloat(v.valor||0),0);
  },

  /* Índice 0-11 do mês a partir de uma data 'YYYY-MM-DD' */
  _mesDe(s){ if(!s) return -1; const p=String(s).split('-'); return p.length>=2 ? parseInt(p[1])-1 : -1; },
  _anoDe(s){ if(!s) return -1; return parseInt(String(s).split('-')[0]); },

  /* DRE Oficial — matriz por mês (regime de competência) do ano informado.
   * Retorna arrays de 12 posições + acumulados. */
  calcDRE(pedidos, fatMap, gastos, ano, aliq=0, variaveis=[]){
    const bruto=Array(12).fill(0), custos=Array(12).fill(0), fixos=Array(12).fill(0);
    (pedidos||[]).forEach(p=>{
      if(this._anoDe(p.data_aprovacao)!==ano) return;
      const m=this._mesDe(p.data_aprovacao); if(m<0) return;
      bruto[m]+=parseFloat(p.valor||0);
      if(fatMap[p.id]) custos[m]+=this.calcDeducoes(fatMap[p.id]);
    });
    // Gastos variáveis entram nos Custos de Obras (regime de competência)
    (variaveis||[]).forEach(v=>{ if(v.ano===ano && v.mes>=0 && v.mes<12) custos[v.mes]+=parseFloat(v.valor||0); });
    (gastos||[]).forEach(g=>{ if(g.ano===ano && g.mes>=0 && g.mes<12) fixos[g.mes]+=parseFloat(g.valor||0); });
    const impostos=bruto.map(v=>v*aliq/100);
    const fatLiq  =bruto.map((v,i)=>v-impostos[i]);
    const margem  =fatLiq.map((v,i)=>v-custos[i]);
    const lucro   =margem.map((v,i)=>v-fixos[i]);
    const sum=a=>a.reduce((s,x)=>s+x,0);
    return {
      bruto, impostos, fatLiq, custos, margem, fixos, lucro,
      acc:{ bruto:sum(bruto), impostos:sum(impostos), fatLiq:sum(fatLiq),
            custos:sum(custos), margem:sum(margem), fixos:sum(fixos), lucro:sum(lucro) }
    };
  },

  /* Fluxo de caixa: soma das contas NÃO pagas por faixa semanal do mês */
  calcFluxoSemanal(gastos, mes, ano){
    const buckets=[0,0,0,0,0];
    (gastos||[]).filter(g=>g.mes===mes && g.ano===ano && !this.ehPago(g)).forEach(g=>{
      const d=g.dia_vencimento||0; let i;
      if(d>=1&&d<=7)i=0; else if(d<=14)i=1; else if(d<=21)i=2; else if(d<=28)i=3; else i=4;
      buckets[i]+=parseFloat(g.valor||0);
    });
    return buckets;
  },

  /* Resumo financeiro do mês (para health dashboard e breakeven).
   * custosObras consolida deduções das OS + Gastos Variáveis do mês. */
  calcResumoMes(pedidos, fatMap, gastos, mes, ano, variaveis=[]){
    const doMes = (pedidos||[]).filter(p=>this._mesDe(p.data_aprovacao)===mes && this._anoDe(p.data_aprovacao)===ano);
    const receita = doMes.reduce((a,b)=>a+parseFloat(b.valor||0),0);
    const deducoesOS  = doMes.reduce((a,p)=>a+(fatMap[p.id]?this.calcDeducoes(fatMap[p.id]):0),0);
    const variaveisMes = this.calcVariaveisMes(variaveis, mes, ano);
    const custosObras = deducoesOS + variaveisMes;
    const gMes = (gastos||[]).filter(g=>g.mes===mes && g.ano===ano);
    const fixosPagos     = gMes.filter(g=>this.ehPago(g)).reduce((a,b)=>a+parseFloat(b.valor||0),0);
    const fixosPendentes = gMes.filter(g=>!this.ehPago(g)).reduce((a,b)=>a+parseFloat(b.valor||0),0);
    const fixos = fixosPagos + fixosPendentes;
    return {
      receita, deducoesOS, variaveisMes, custosObras, fixosPagos, fixosPendentes, fixos,
      margem: receita - custosObras,
      lucroReal: receita - custosObras - fixosPagos,
      lucroProjetado: receita - custosObras - fixos,
      pctFixos: receita>0 ? fixos/receita*100 : 0,
      pctVariaveis: receita>0 ? custosObras/receita*100 : 0
    };
  }
};
window.financeiroService = financeiroService;
