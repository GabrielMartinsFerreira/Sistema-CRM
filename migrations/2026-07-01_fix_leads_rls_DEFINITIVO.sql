/* ═══════════════════════════════════════════════════════════════════════
 * 2026-07-01_fix_leads_rls_DEFINITIVO.sql
 * Correção DEFINITIVA do erro ao arquivar lead:
 *   "new row violates row-level security policy for table leads"
 *
 * ───────────────────────────────────────────────────────────────────────
 * CAUSA RAIZ (confirmada):
 *   A tabela leads ainda tem uma policy ANTIGA "FOR ALL" (cmd = 'ALL' na
 *   pg_policies) com USING (arquivado = false) e SEM WITH CHECK explícito.
 *   No PostgreSQL, quando uma policy de UPDATE não tem WITH CHECK, o USING
 *   é reaproveitado como WITH CHECK. Logo, ao setar arquivado = true a nova
 *   linha falha a checagem (arquivado = false) → RLS rejeita.
 *
 *   As migrations anteriores NÃO removeram essa policy porque filtravam por
 *   cmd = 'SELECT' (soft_delete) ou cmd = 'UPDATE' (fix parcial); a policy
 *   "FOR ALL" tem cmd = 'ALL' e escapou das duas.
 *
 * O QUE ESTE SCRIPT FAZ:
 *   1. Garante coluna arquivado + índice + RLS habilitado
 *   2. DROPA TODAS as policies de leads — QUALQUER cmd (SELECT/INSERT/
 *      UPDATE/DELETE/ALL). É isto que resolve de vez.
 *   3. Recria 4 policies limpas: SELECT esconde arquivados; UPDATE tem
 *      WITH CHECK (true) explícito → arquivar passa a funcionar.
 *   4. Imprime o estado final para conferência.
 *
 * NÃO é necessária nenhuma alteração no código do app — crmService.deletarLead
 * (UPDATE leads SET arquivado=true) já está correto.
 *
 * RODAR NO: Supabase Dashboard → SQL Editor  (rode SÓ este arquivo)
 * IDEMPOTENTE: pode ser reexecutado quantas vezes quiser.
 * ═══════════════════════════════════════════════════════════════════════ */


/* ─── 1. Coluna, índice e RLS ────────────────────────────────────────── */
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS arquivado boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_leads_arquivado ON public.leads(arquivado);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;


/* ─── 2. Remove TODAS as policies de leads (qualquer cmd) ────────────── */
-- Os NOTICEs mostram, na aba "Messages", o que existia antes — útil para
-- confirmar a policy "FOR ALL" que estava causando o bloqueio.
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname, cmd
    FROM   pg_policies
    WHERE  schemaname = 'public' AND tablename = 'leads'
  LOOP
    RAISE NOTICE 'Removendo policy existente: %  (cmd = %)', pol.policyname, pol.cmd;
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.leads', pol.policyname);
  END LOOP;

  IF NOT FOUND THEN
    RAISE NOTICE 'Nenhuma policy pré-existente encontrada em leads.';
  END IF;
END $$;


/* ─── 3. Recria policies limpas e corretas ───────────────────────────── */

-- SELECT: esconde leads arquivados (soft-delete continua funcionando)
CREATE POLICY "leads_sel" ON public.leads
  FOR SELECT TO authenticated
  USING (arquivado = false);

-- INSERT: qualquer usuário autenticado pode criar lead
CREATE POLICY "leads_ins" ON public.leads
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- UPDATE: WITH CHECK (true) EXPLÍCITO → permite setar arquivado = true
CREATE POLICY "leads_upd" ON public.leads
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- DELETE: hard-delete (usado só por resetarLeads)
CREATE POLICY "leads_del" ON public.leads
  FOR DELETE TO authenticated
  USING (true);


/* ─── 4. Verificação final (aparece na grade de resultados) ──────────── */
-- Esperado: exatamente 4 linhas.
--   leads_sel  SELECT  using=(arquivado = false)  with_check=NULL
--   leads_ins  INSERT  using=NULL                 with_check=true
--   leads_upd  UPDATE  using=true                 with_check=true   ← chave
--   leads_del  DELETE  using=true                 with_check=NULL
SELECT policyname, cmd, roles, qual AS using_expr, with_check
FROM   pg_policies
WHERE  schemaname = 'public' AND tablename = 'leads'
ORDER  BY cmd, policyname;
