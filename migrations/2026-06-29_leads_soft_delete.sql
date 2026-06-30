/* ═══════════════════════════════════════════════════════════════════════
 * 2026-06-29_leads_soft_delete.sql
 * Implementa soft-delete em leads para preservar histórico financeiro.
 *
 * "Arquivar" seta arquivado = true; a linha permanece no banco e pode
 * ser auditada, mas some de todas as queries normais do sistema.
 *
 * RODAR NO: Supabase Dashboard → SQL Editor
 * IDEMPOTENTE: IF NOT EXISTS / DO block garantem reexecução segura
 * ═══════════════════════════════════════════════════════════════════════ */


/* ─── 1. Coluna de soft-delete ──────────────────────────────────────── */
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS arquivado BOOLEAN NOT NULL DEFAULT false;


/* ─── 2. Índice para filtro rápido ─────────────────────────────────── */
CREATE INDEX IF NOT EXISTS idx_leads_arquivado ON leads(arquivado);


/* ─── 3. Atualizar policies RLS de SELECT para excluir arquivados ───── */
-- Remove TODAS as policies SELECT existentes em leads e recria com o
-- filtro arquivado = false. Abordagem segura independente de nome.
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM   pg_policies
    WHERE  tablename = 'leads'
      AND  schemaname = 'public'
      AND  cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON leads', pol.policyname);
    RAISE NOTICE 'Policy removida: %', pol.policyname;
  END LOOP;
END $$;

CREATE POLICY "leads_select_authenticated" ON leads
  FOR SELECT TO authenticated
  USING (arquivado = false);


/* ─── 4. Verificação ────────────────────────────────────────────────── */
-- Confirma coluna, índice e policy criados:
SELECT column_name, data_type, column_default
FROM   information_schema.columns
WHERE  table_name = 'leads' AND column_name = 'arquivado';

SELECT indexname FROM pg_indexes
WHERE  tablename = 'leads' AND indexname = 'idx_leads_arquivado';

SELECT policyname, cmd, qual
FROM   pg_policies
WHERE  tablename = 'leads' AND schemaname = 'public';
