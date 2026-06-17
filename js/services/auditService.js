/* ═══════════════════════════════════════════════════════════════════════
 * js/services/auditService.js — P3 Governança Financeira
 *
 * Leitura do audit_log_financeiro e gestão de alcadas_aprovacao.
 * Escrita no log é feita exclusivamente via triggers Postgres.
 *
 * Depende de: db, _authSession (js/core/supabase.js + auth.js)
 * ═══════════════════════════════════════════════════════════════════════ */
const auditService = {

  /* ─── Log de auditoria ────────────────────────────────────────── */

  carregarLogs({ limite = 50, tabela = null } = {}) {
    let q = db.from('audit_log_financeiro')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limite);
    if (tabela) q = q.eq('tabela', tabela);
    return q;
  },

  /* ─── Alçadas ─────────────────────────────────────────────────── */

  carregarAlcadas() {
    return db.from('alcadas_aprovacao').select('*');
  },

  salvarAlcada(contexto, valorLimite, ativo = false) {
    const uid = (_authSession && _authSession.user) ? _authSession.user.id : null;
    return db.from('alcadas_aprovacao')
      .upsert(
        { user_id: uid, contexto, valor_limite: valorLimite, ativo },
        { onConflict: 'user_id,contexto' }
      )
      .select().single();
  },

  /* Retorna o limite (número) para um contexto, ou 0 se inativo/inexistente */
  getLimite(contexto, alcadas) {
    const a = (alcadas || []).find(x => x.contexto === contexto && x.ativo);
    if (!a || !a.valor_limite) return 0;
    return parseFloat(a.valor_limite);
  },

  /* true se o valor excede o limite configurado (e alçada está ativa) */
  verificarAlcada(contexto, valor, alcadas) {
    const lim = this.getLimite(contexto, alcadas);
    return lim > 0 && parseFloat(valor) > lim;
  },

  /* ─── Formatação para UI ──────────────────────────────────────── */

  formatarLog(log) {
    const d   = log.dados_depois || log.dados_antes || {};
    const desc = d.descricao || d.numero_documento || d.nome || `#${log.registro_id}`;
    const valor = d.valor_original ?? d.valor_pago ?? d.valor ?? null;
    const ops  = { INSERT: 'Novo', UPDATE: 'Alterado', DELETE: 'Removido' };
    const tabs = { contas_a_pagar: 'Conta a Pagar', boletos_fornecedores: 'Boleto Forn.' };
    const ignorar = ['updated_at', 'user_id', 'created_at'];
    return {
      op:    ops[log.operacao]  || log.operacao,
      tab:   tabs[log.tabela]   || log.tabela,
      desc:  String(desc || '—'),
      valor: valor != null ? parseFloat(valor) : null,
      campos: (log.campos_alterados || []).filter(c => !ignorar.includes(c)),
      data:  log.created_at,
    };
  },
};
window.auditService = auditService;
