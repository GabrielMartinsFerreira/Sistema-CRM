/* ═══════════════════════════════════════════════════════════════════════
 * js/services/caixaService.js — Motor de Projeção de Caixa Consolidado
 *
 * Agrega 5 fontes de dados (parcelas cartão, contas_a_pagar, boletos,
 * gastos fixos, gastos variáveis) e projeta o saldo diário D+0→D+60.
 *
 * Índice de Confiabilidade de Recebimento (ICR):
 *   Pesos por faixa de atraso (config_caixa) ponderados em entradas.
 *   Saídas NÃO recebem desconto — custo é custo.
 *
 * Depende de: db, TABLES (js/core/supabase.js)
 * ═══════════════════════════════════════════════════════════════════════ */
const caixaService = {

  /* ─── Config (upsert por user_id) ─────────────────────────────────── */

  carregarConfig(){
    return db.from('config_caixa').select('*').maybeSingle();
  },

  salvarConfig(dados){
    const uid = (_authSession && _authSession.user) ? _authSession.user.id : null;
    return db.from('config_caixa')
      .upsert({...dados, user_id: uid}, {onConflict: 'user_id'})
      .select().single();
  },

  /* ─── Fontes de entrada/saída ─────────────────────────────────────── */

  /* Parcelas de cartão pendentes (Contas a Receber) */
  carregarEntradasPendentes(){
    return db.from('financeiro_movimentacoes')
      .select('id,data_vencimento,valor,valor_liquido,descricao,lead_id,parcela_ref')
      .eq('tipo','Entrada')
      .eq('status','Pendente')
      .eq('is_parcela_cartao',true)
      .not('data_vencimento','is',null);
  },

  /* Contas a pagar nativas (tabela dedicada, com user_id/RLS) */
  carregarSaidasNativas(){
    return db.from('contas_a_pagar')
      .select('id,descricao,valor_original,valor_pago,data_vencimento,status,fornecedor_nome')
      .neq('status','pago')
      .not('data_vencimento','is',null);
  },

  /* Boletos de fornecedores (origem legado) */
  carregarBoletosPendentes(){
    return db.from('boletos_fornecedores')
      .select('id,valor,data_vencimento,descricao,numero_documento')
      .neq('status','Pago')
      .not('data_vencimento','is',null);
  },

  /* Gastos fixos não pagos nos próximos 2 meses correntes */
  carregarGastosFixosPendentes(){
    const {meses, anos} = this._proxMeses(3);
    return db.from('gastos_fixos')
      .select('id,nome,valor,dia_vencimento,mes,ano,categoria,status_pagamento')
      .in('mes', meses).in('ano', anos)
      .neq('status_pagamento','Pago');
  },

  /* Gastos variáveis não pagos nos próximos 2 meses correntes */
  carregarVariaveisPendentes(){
    const {meses, anos} = this._proxMeses(3);
    return db.from('crm_gastos_variaveis')
      .select('id,descricao,valor,dia_vencimento,mes,ano,categoria,status')
      .in('mes', meses).in('ano', anos)
      .neq('status','Pago');
  },

  /* ─── Matemática Pura ─────────────────────────────────────────────── */

  /**
   * Peso do Índice de Confiabilidade de Recebimento.
   * @param {string|null} dataVencStr  YYYY-MM-DD da parcela
   * @param {string}      hojeStr      YYYY-MM-DD de hoje
   * @param {object}      config       linha de config_caixa
   * @returns {number}  0..1
   */
  calcPeso(dataVencStr, hojeStr, config){
    if(!dataVencStr || dataVencStr >= hojeStr)
      return (config.peso_em_dia ?? 100) / 100;
    const dias = Math.floor((new Date(hojeStr) - new Date(dataVencStr)) / 86400000);
    if(dias <= 30) return (config.peso_atraso_1_30  ?? 70)  / 100;
    if(dias <= 60) return (config.peso_atraso_31_60 ?? 40)  / 100;
    return              (config.peso_atraso_60plus  ?? 0)   / 100;
  },

  /**
   * Motor principal de projeção diária.
   * Retorna array de {data, idx, totalEntradas, totalSaidas, saldoAcumulado, …}
   * com janelaDias+1 posições (D+0 até D+janelaDias).
   */
  calcProjecaoDiaria({config, entradasPendentes, saidasNativas,
                      boletosPendentes, gastosFixos, variaveisCP, janelaDias=60}){
    const hoje   = new Date(); hoje.setHours(0,0,0,0);
    const hojeStr= hoje.toISOString().slice(0,10);
    const fimStr = this._addDays(hojeStr, janelaDias);

    /* Mapa dia → listas de fluxos */
    const mapa = {};
    const slot = d => { if(!mapa[d]) mapa[d]={in:[],out:[]}; return mapa[d]; };

    /* Entradas: parcelas de cartão pendentes */
    for(const m of (entradasPendentes||[])){
      const rawD = m.data_vencimento;
      const d    = (!rawD || rawD < hojeStr) ? hojeStr : rawD;
      if(d > fimStr) continue;
      const vlr  = parseFloat(m.valor_liquido ?? m.valor ?? 0);
      const peso = this.calcPeso(rawD, hojeStr, config);
      slot(d).in.push({valor: Math.round(vlr * peso * 100)/100, rawValor: vlr,
        peso, label: m.descricao || `Parcela ${m.parcela_ref||''}`, origem:'cartao'});
    }

    /* Saídas: contas_a_pagar nativas */
    for(const c of (saidasNativas||[])){
      const rawD = c.data_vencimento;
      const d    = (!rawD || rawD < hojeStr) ? hojeStr : rawD;
      if(d > fimStr) continue;
      const saldo = Math.max(0, parseFloat(c.valor_original??0) - parseFloat(c.valor_pago??0));
      if(saldo < 0.01) continue;
      slot(d).out.push({valor: saldo, label: c.descricao||(c.fornecedor_nome||'—'), origem:'cap'});
    }

    /* Saídas: boletos de fornecedores */
    for(const b of (boletosPendentes||[])){
      const rawD = b.data_vencimento;
      const d    = (!rawD || rawD < hojeStr) ? hojeStr : rawD;
      if(d > fimStr) continue;
      slot(d).out.push({valor: parseFloat(b.valor??0),
        label: b.descricao || b.numero_documento || 'Boleto fornecedor', origem:'forn'});
    }

    /* Saídas: gastos fixos */
    for(const g of (gastosFixos||[])){
      const rawD = this._dataDeMesAno(g.dia_vencimento, g.mes, g.ano);
      const d    = (!rawD || rawD < hojeStr) ? hojeStr : rawD;
      if(d > fimStr) continue;
      slot(d).out.push({valor: parseFloat(g.valor??0),
        label: g.nome || 'Gasto Fixo', origem:'fixo'});
    }

    /* Saídas: gastos variáveis */
    for(const v of (variaveisCP||[])){
      const rawD = this._dataDeMesAno(v.dia_vencimento, v.mes, v.ano);
      const d    = (!rawD || rawD < hojeStr) ? hojeStr : rawD;
      if(d > fimStr) continue;
      slot(d).out.push({valor: parseFloat(v.valor??0),
        label: v.descricao || 'Gasto Variável', origem:'var'});
    }

    /* Série temporal cumulativa */
    const dias = [];
    let saldo  = parseFloat(config.saldo_inicial ?? 0);
    for(let i = 0; i <= janelaDias; i++){
      const d    = this._addDays(hojeStr, i);
      const info = mapa[d] || {in:[], out:[]};
      const totalE = info.in .reduce((s,e)=>s+e.valor, 0);
      const totalS = info.out.reduce((s,e)=>s+e.valor, 0);
      saldo = Math.round((saldo + totalE - totalS) * 100) / 100;
      dias.push({data:d, idx:i, isHoje:i===0,
        entradas:info.in, saidas:info.out,
        totalEntradas:totalE, totalSaidas:totalS,
        saldoAcumulado:saldo});
    }
    return dias;
  },

  /** KPIs resumidos derivados da série gerada por calcProjecaoDiaria */
  calcKPIs(dias){
    const fut  = dias.filter(d => d.idx > 0);
    const d30  = fut.filter(d => d.idx <= 30);
    const d60  = fut.filter(d => d.idx <= 60);
    const sumE = arr => arr.reduce((s,d)=>s+d.totalEntradas, 0);
    const sumS = arr => arr.reduce((s,d)=>s+d.totalSaidas,   0);

    const diasNegativos   = fut.filter(d => d.saldoAcumulado < 0);
    const primeiroNegativo= diasNegativos[0] || null;
    const piorDia         = fut.length
      ? fut.reduce((p,d)=> d.saldoAcumulado < p.saldoAcumulado ? d : p, fut[0])
      : null;

    return {
      aReceber30: sumE(d30), aReceber60: sumE(d60),
      aPagar30:   sumS(d30), aPagar60:   sumS(d60),
      saldo30: dias[Math.min(30, dias.length-1)]?.saldoAcumulado ?? 0,
      saldo60: dias[Math.min(60, dias.length-1)]?.saldoAcumulado ?? 0,
      diasNegativos, primeiroNegativo, piorDia,
    };
  },

  /* ─── Helpers internos ────────────────────────────────────────────── */

  _addDays(dateStr, n){
    const d = new Date(dateStr); d.setDate(d.getDate() + n);
    return d.toISOString().slice(0,10);
  },

  _dataDeMesAno(dia, mes, ano){
    if(!dia || dia < 1) return null;
    const m         = String(mes + 1).padStart(2,'0');
    const ultimoDia = new Date(ano, mes + 1, 0).getDate();
    const d         = String(Math.min(dia, ultimoDia)).padStart(2,'0');
    return `${ano}-${m}-${d}`;
  },

  _proxMeses(n){
    const hoje  = new Date();
    const meses = new Set(), anos = new Set();
    for(let i = 0; i < n; i++){
      const d = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
      meses.add(d.getMonth());
      anos.add(d.getFullYear());
    }
    return {meses:[...meses], anos:[...anos]};
  },
};
window.caixaService = caixaService;
