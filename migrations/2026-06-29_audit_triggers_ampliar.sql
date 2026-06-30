/* ═══════════════════════════════════════════════════════════════════════
 * 2026-06-29_audit_triggers_ampliar.sql
 * Amplia a cobertura de auditoria para mais tabelas financeiras.
 *
 * Pré-requisito: 2026-06-16_auditoria.sql deve ter sido executado
 *   (cria audit_log_financeiro + fn_audit_financeiro()).
 *
 * Tabelas adicionadas:
 *   financeiro_movimentacoes  — INSERT, UPDATE, DELETE
 *   crm_gastos_variaveis      — INSERT, UPDATE, DELETE
 *   gastos_fixos              — UPDATE, DELETE  (INSERT não é crítico)
 *
 * RODAR NO: Supabase Dashboard → SQL Editor
 * IDEMPOTENTE: DROP TRIGGER IF EXISTS antes de cada CREATE
 * ═══════════════════════════════════════════════════════════════════════ */


/* ─── financeiro_movimentacoes ───────────────────────────────────────── */

DROP TRIGGER IF EXISTS trg_audit_movs_ins ON financeiro_movimentacoes;
DROP TRIGGER IF EXISTS trg_audit_movs_upd ON financeiro_movimentacoes;
DROP TRIGGER IF EXISTS trg_audit_movs_del ON financeiro_movimentacoes;

CREATE TRIGGER trg_audit_movs_ins
  AFTER INSERT ON financeiro_movimentacoes
  FOR EACH ROW EXECUTE FUNCTION fn_audit_financeiro();

CREATE TRIGGER trg_audit_movs_upd
  AFTER UPDATE ON financeiro_movimentacoes
  FOR EACH ROW EXECUTE FUNCTION fn_audit_financeiro();

CREATE TRIGGER trg_audit_movs_del
  AFTER DELETE ON financeiro_movimentacoes
  FOR EACH ROW EXECUTE FUNCTION fn_audit_financeiro();


/* ─── crm_gastos_variaveis ───────────────────────────────────────────── */

DROP TRIGGER IF EXISTS trg_audit_gvar_ins ON crm_gastos_variaveis;
DROP TRIGGER IF EXISTS trg_audit_gvar_upd ON crm_gastos_variaveis;
DROP TRIGGER IF EXISTS trg_audit_gvar_del ON crm_gastos_variaveis;

CREATE TRIGGER trg_audit_gvar_ins
  AFTER INSERT ON crm_gastos_variaveis
  FOR EACH ROW EXECUTE FUNCTION fn_audit_financeiro();

CREATE TRIGGER trg_audit_gvar_upd
  AFTER UPDATE ON crm_gastos_variaveis
  FOR EACH ROW EXECUTE FUNCTION fn_audit_financeiro();

CREATE TRIGGER trg_audit_gvar_del
  AFTER DELETE ON crm_gastos_variaveis
  FOR EACH ROW EXECUTE FUNCTION fn_audit_financeiro();


/* ─── gastos_fixos ───────────────────────────────────────────────────── */
/* INSERT omitido: novos lançamentos não têm relevância de auditoria;
   UPDATE e DELETE cobrem alterações e exclusões que afetam o DRE.      */

DROP TRIGGER IF EXISTS trg_audit_gfix_upd ON gastos_fixos;
DROP TRIGGER IF EXISTS trg_audit_gfix_del ON gastos_fixos;

CREATE TRIGGER trg_audit_gfix_upd
  AFTER UPDATE ON gastos_fixos
  FOR EACH ROW EXECUTE FUNCTION fn_audit_financeiro();

CREATE TRIGGER trg_audit_gfix_del
  AFTER DELETE ON gastos_fixos
  FOR EACH ROW EXECUTE FUNCTION fn_audit_financeiro();


/* ─── Verificação ────────────────────────────────────────────────────── */
-- Execute após o bloco acima para confirmar os 8 novos triggers:
SELECT
  trigger_name,
  event_object_table  AS tabela,
  event_manipulation  AS operacao,
  action_timing       AS momento
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name LIKE 'trg_audit_%'
ORDER BY event_object_table, event_manipulation;
