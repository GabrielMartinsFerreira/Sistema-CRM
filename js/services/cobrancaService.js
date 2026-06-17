/* ═══════════════════════════════════════════════════════════════════════
 * js/services/cobrancaService.js — P4 Fila de Cobrança
 *
 * Gerencia promessas_pagamento: contatos e promessas por lead/OS.
 * Depende de: db, _authSession (js/core/supabase.js + auth.js)
 * ═══════════════════════════════════════════════════════════════════════ */
const cobrancaService = {

  /* ─── Persistência ────────────────────────────────────────────── */

  carregarTodas() {
    return db.from('promessas_pagamento')
      .select('*')
      .order('created_at', { ascending: false });
  },

  registrar({ leadId, tipo, descricao, valorPrometido, dataPrometida }) {
    const uid = (_authSession && _authSession.user) ? _authSession.user.id : null;
    return db.from('promessas_pagamento')
      .insert({
        user_id:         uid,
        lead_id:         leadId,
        tipo,
        descricao:       descricao    || null,
        valor_prometido: valorPrometido || null,
        data_prometida:  dataPrometida  || null,
      })
      .select().single();
  },

  marcarStatus(id, status) {
    return db.from('promessas_pagamento')
      .update({ status })
      .eq('id', id)
      .select().single();
  },

  /* ─── Helpers puros (não fazem fetch) ─────────────────────────── */

  getPorLead(leadId, todas) {
    const id = String(leadId);
    return (todas || []).filter(p => String(p.lead_id) === id);
  },

  /* Entrada mais recente de qualquer tipo para o lead */
  getUltimoContato(leadId, todas) {
    const items = this.getPorLead(leadId, todas);
    if (!items.length) return null;
    return items.reduce((last, p) =>
      !last || p.created_at > last.created_at ? p : last
    , null);
  },

  /* Promessa pendente mais recente para o lead */
  getPromessaAtiva(leadId, todas) {
    return this.getPorLead(leadId, todas)
      .filter(p => p.tipo === 'promessa' && p.status === 'pendente')
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] || null;
  },

  /* true se a promessa ativa já passou da data prometida */
  isQuebrada(promessa, hojeStr) {
    return !!(promessa
      && promessa.tipo       === 'promessa'
      && promessa.status     === 'pendente'
      && promessa.data_prometida
      && promessa.data_prometida < hojeStr);
  },
};
window.cobrancaService = cobrancaService;
