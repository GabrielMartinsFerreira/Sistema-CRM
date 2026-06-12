/* ═══════════════════════════════════════════════════════════════════════
 * js/services/comprasService.js — Módulo de Compras e Pagamentos por OS
 * ───────────────────────────────────────────────────────────────────────
 * Gerencia fornecedores vinculados a cada OS e seus respectivos boletos.
 * Hierarquia: leads (OS) → compras_fornecedores_os → boletos_fornecedores
 *
 * Depende de: db, TABLES, STORAGE_BUCKET (js/core/supabase.js)
 * ═══════════════════════════════════════════════════════════════════════ */
const comprasService = {

  /* ─── OS (leads com status=Pedido) ──────────────────────────────────── */

  /** Carrega todos os pedidos (OS) com fornecedores e boletos em nested join.
   *  Retorna: [ { ...lead, compras_fornecedores_os: [ { ...forn, boletos_fornecedores: [...] } ] } ]
   */
  carregarOSComFornecedores(){
    return db
      .from(TABLES.LEADS)
      .select(`
        id, codigo_orcamento, os, nome, razao_social, nome_contato, produto,
        vendedor, valor, status_os, data_aprovacao, periodo_obra,
        compras_fornecedores_os (
          id, fornecedor_nome, contato, valor_total_previsto, observacao, data_vinculo, auto_org,
          boletos_fornecedores (
            id, numero_documento, descricao, valor,
            data_vencimento, status, data_pagamento,
            forma_pagamento, comprovante_url, observacao, created_at
          )
        )
      `)
      .eq('status', 'Pedido')
      .order('id', { ascending: false });
  },

  /** Carrega uma única OS com fornecedores+boletos por id. */
  carregarOSPorId(osId){
    return db
      .from(TABLES.LEADS)
      .select(`
        id, codigo_orcamento, os, nome, razao_social, nome_contato, produto,
        vendedor, valor, status_os, data_aprovacao,
        compras_fornecedores_os (
          id, fornecedor_nome, contato, valor_total_previsto, observacao, data_vinculo, auto_org,
          boletos_fornecedores (
            id, numero_documento, descricao, valor,
            data_vencimento, status, data_pagamento,
            forma_pagamento, comprovante_url, observacao, created_at
          )
        )
      `)
      .eq('id', osId)
      .eq('status', 'Pedido')
      .single();
  },

  /* ─── Fornecedores ───────────────────────────────────────────────────── */

  /** Lista fornecedores de uma OS específica. */
  listarFornecedoresPorOS(osId){
    return db
      .from(TABLES.COMPRAS_FORN)
      .select('*')
      .eq('os_id', osId)
      .order('created_at', { ascending: true });
  },

  /** Insere um novo fornecedor vinculado à OS. */
  inserirFornecedor(dados){
    return db
      .from(TABLES.COMPRAS_FORN)
      .insert([dados])
      .select()
      .single();
  },

  /** Atualiza dados de um fornecedor (nome, contato, valor previsto, obs). */
  atualizarFornecedor(id, upd){
    return db
      .from(TABLES.COMPRAS_FORN)
      .update(upd)
      .eq('id', id);
  },

  /** Remove o fornecedor e todos os seus boletos (CASCADE). */
  deletarFornecedor(id){
    return db
      .from(TABLES.COMPRAS_FORN)
      .delete()
      .eq('id', id);
  },

  /* ─── Boletos ────────────────────────────────────────────────────────── */

  /** Lista boletos de um fornecedor específico. */
  listarBoletosPorFornecedor(fornecedorOsId){
    return db
      .from(TABLES.BOLETOS_FORN)
      .select('*')
      .eq('fornecedor_os_id', fornecedorOsId)
      .order('data_vencimento', { ascending: true });
  },

  /** Insere um novo boleto. */
  inserirBoleto(dados){
    return db
      .from(TABLES.BOLETOS_FORN)
      .insert([dados])
      .select()
      .single();
  },

  /** Atualiza um boleto (ex: marcar como pago, alterar valor/vencimento). */
  atualizarBoleto(id, upd){
    return db
      .from(TABLES.BOLETOS_FORN)
      .update(upd)
      .eq('id', id);
  },

  /** Remove um boleto. */
  deletarBoleto(id){
    return db
      .from(TABLES.BOLETOS_FORN)
      .delete()
      .eq('id', id);
  },

  /** Marca boleto como Pago (convenience method). */
  marcarPago(id, dataPagamento, formaPagamento, comprovanteUrl){
    const upd = {
      status: 'Pago',
      data_pagamento: dataPagamento || new Date().toISOString().slice(0,10),
      forma_pagamento: formaPagamento || null,
    };
    if(comprovanteUrl) upd.comprovante_url = comprovanteUrl;
    return db.from(TABLES.BOLETOS_FORN).update(upd).eq('id', id);
  },

  /* ─── Storage (comprovantes) ─────────────────────────────────────────── */

  uploadComprovante(path, file, contentType){
    return db.storage.from(STORAGE_BUCKET).upload(path, file, { contentType, upsert: true });
  },

  urlAssinadaComprovante(path, expiraSeg=3600){
    return db.storage.from(STORAGE_BUCKET).createSignedUrl(path, expiraSeg);
  },

  /* ─── Preferências / Auto-Org ───────────────────────────────────────── */

  /** Liga/desliga auto_org em TODOS os fornecedores de uma OS simultaneamente. */
  toggleAutoOrgPorOS(osId, valor){
    return db.from(TABLES.COMPRAS_FORN).update({auto_org: valor}).eq('os_id', osId);
  },

  /* ─── Relatório (VIEW) ───────────────────────────────────────────────── */

  /** Lê a view relatorio_despesas_os — retorna resumo agregado por OS. */
  carregarRelatorio(){
    return db
      .from('relatorio_despesas_os')
      .select('*')
      .order('os_id', { ascending: false });
  },

  /* ─── Helpers de cálculo (pure) ──────────────────────────────────────── */

  /** Soma todos os boletos de um fornecedor. */
  totalBoletos(boletos){
    return (boletos||[]).reduce((s,b) => s + parseFloat(b.valor||0), 0);
  },

  /** Soma apenas boletos pagos. */
  totalPago(boletos){
    return (boletos||[]).filter(b=>b.status==='Pago')
      .reduce((s,b) => s + parseFloat(b.valor||0), 0);
  },

  /** Soma boletos pendentes e atrasados. */
  totalPendente(boletos){
    return (boletos||[]).filter(b=>b.status!=='Pago')
      .reduce((s,b) => s + parseFloat(b.valor||0), 0);
  },

  /** Calcula totais agregados de uma lista de boletos de todos os fornecedores de uma OS. */
  calcTotaisOS(fornecedores){
    let total=0, pago=0, pendente=0, atrasado=0;
    (fornecedores||[]).forEach(f=>{
      (f.boletos_fornecedores||[]).forEach(b=>{
        const v=parseFloat(b.valor||0);
        total+=v;
        if(b.status==='Pago')    pago+=v;
        else if(b.status==='Atrasado') atrasado+=v;
        else pendente+=v;
      });
    });
    return { total, pago, pendente, atrasado };
  },

  /** Recalcula status de boletos vencidos no front (para exibição imediata). */
  statusEfetivo(boleto){
    if(boleto.status==='Pago') return 'Pago';
    if(boleto.data_vencimento && boleto.data_vencimento < new Date().toISOString().slice(0,10)){
      return 'Atrasado';
    }
    return 'Pendente';
  }
};

window.comprasService = comprasService;
