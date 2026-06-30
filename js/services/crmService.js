/* ═══════════════════════════════════════════════════════════════════════
 * js/services/crmService.js — Camada de dados do CRM (leads + clientes + storage)
 * ───────────────────────────────────────────────────────────────────────
 * Isola TODAS as chamadas .from()/.storage do Supabase relacionadas a
 * leads e clientes recorrentes. A interface chama métodos assíncronos
 * (ex: crmService.deletarCliente(id)); o tratamento de erro/toast fica na UI.
 * Depende de: db, TABLES, STORAGE_BUCKET (js/core/supabase.js)
 * ═══════════════════════════════════════════════════════════════════════ */
const crmService = {
  /* ── LEADS ── */
  listarLeads(){
    return db.from(TABLES.LEADS).select('*')
      .eq('arquivado', false)
      .order('order_index',{ascending:true,nullsFirst:false})
      .order('id',{ascending:true});
  },
  listarLeadsSimples(){
    return db.from(TABLES.LEADS).select('*').order('id',{ascending:true});
  },
  inserirLead(lead){ return db.from(TABLES.LEADS).insert([lead]); },
  atualizarLead(id, dados){ return db.from(TABLES.LEADS).update(dados).eq('id', id); },
  deletarLead(id){ return db.from(TABLES.LEADS).update({arquivado:true}).eq('id', id); },
  arquivarLead(id){ return db.from(TABLES.LEADS).update({arquivado:true}).eq('id', id); },
  resetarLeads(confirmacao){
    if(confirmacao !== 'CONFIRMAR_RESET_TOTAL'){
      console.error('resetarLeads: confirmação obrigatória não fornecida');
      return;
    }
    return db.from(TABLES.LEADS).delete().neq('id', 0);
  },
  atualizarOrdem(updates){
    return Promise.all(updates.map(u =>
      db.from(TABLES.LEADS).update({order_index:u.order_index}).eq('id', u.id)
    ));
  },

  /* ── CLIENTES RECORRENTES (crm_clientes) ── */
  listarClientes(){ return db.from(TABLES.CLIENTES).select('*').order('id',{ascending:true}); },
  buscarClientePorDoc(digits){
    return db.from(TABLES.CLIENTES).select('*').eq('doc_digits', digits).limit(1);
  },
  /* Busca server-side com .ilike() em nome/razão social/doc/dígitos */
  buscarClientesFiltro(q, digits){
    let query = db.from(TABLES.CLIENTES).select('*').order('id',{ascending:true});
    if(q){
      const like = '%' + q.replace(/[%,]/g,'') + '%';
      const ors  = [`nome.ilike.${like}`, `razao_social.ilike.${like}`, `doc.ilike.${like}`];
      if(digits) ors.push(`doc_digits.ilike.%${digits}%`);
      query = query.or(ors.join(','));
    }
    return query;
  },
  buscarDuplicadoDoc(digits, exceptId){
    let q = db.from(TABLES.CLIENTES).select('id,nome,razao_social,doc').eq('doc_digits', digits);
    if(exceptId) q = q.neq('id', exceptId);
    return q;
  },
  inserirCliente(row){ return db.from(TABLES.CLIENTES).insert([row]); },
  atualizarCliente(id, row){ return db.from(TABLES.CLIENTES).update(row).eq('id', id); },
  deletarCliente(id){ return db.from(TABLES.CLIENTES).delete().eq('id', id); },
  deletarClientesPorLead(leadId){ return db.from(TABLES.CLIENTES).delete().eq('lead_id', leadId); },
  deletarClientesPorDoc(digits){ return db.from(TABLES.CLIENTES).delete().eq('doc_digits', digits); },

  /* ── STORAGE (relatórios técnicos — bucket privado) ── */
  uploadRelatorio(path, file, contentType){
    return db.storage.from(STORAGE_BUCKET).upload(path, file, { contentType, upsert:true });
  },
  urlAssinadaRelatorio(path, expiraSeg=3600){
    return db.storage.from(STORAGE_BUCKET).createSignedUrl(path, expiraSeg);
  }
};
window.crmService = crmService;
