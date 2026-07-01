/* ═══════════════════════════════════════════════════════════════════════
 * 2026-07-01_fix_leads_archive_rls.sql
 * Corrige erro "new row violates row-level security policy for table leads"
 * ao arquivar (soft-delete) um lead.
 *
 * CAUSA RAIZ:
 *   A policy SELECT em leads tem USING (arquivado = false).
 *   Quando não existe nenhuma UPDATE policy explícita, o PostgreSQL tenta
 *   validar que a linha resultante ainda satisfaz as políticas de SELECT.
 *   Setar arquivado = true faz a linha "desaparecer" do SELECT → RLS rejeita.
 *
 * SOLUÇÃO:
 *   Adiciona UPDATE policies com WITH CHECK explícito que não restringe
 *   o campo arquivado, permitindo a transição false→true (arquivar).
 *   Se roles_rls.sql já foi rodado, as policies serão substituídas de forma
 *   idempotente. Se não foi, esta migration serve como correção imediata.
 *
 * RODAR NO: Supabase Dashboard → SQL Editor
 * IDEMPOTENTE: DROP IF EXISTS + CREATE garante reexecução segura
 * ═══════════════════════════════════════════════════════════════════════ */


/* ─── 1. Garante coluna e índice ────────────────────────────────────── */
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS arquivado BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_leads_arquivado ON leads(arquivado);


/* ─── 2. Remove UPDATE policies existentes para recriar ─────────────── */
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'leads' AND schemaname = 'public' AND cmd = 'UPDATE'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON leads', pol.policyname);
    RAISE NOTICE 'Policy UPDATE removida: %', pol.policyname;
  END LOOP;
END $$;


/* ─── 3. Recria UPDATE policies com WITH CHECK que permite arquivar ─── */
-- Usa get_user_role() se a função existir (roles_rls.sql já rodou),
-- caso contrário aplica política permissiva para authenticated.

DO $$
DECLARE fn_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_user_role'
  ) INTO fn_exists;

  IF fn_exists THEN
    -- roles_rls.sql já foi executado: recria com controle por papel
    EXECUTE $pol$
      CREATE POLICY "leads_upd_staff" ON leads
        FOR UPDATE TO authenticated
        USING     (get_user_role() IN ('gestor', 'financeiro'))
        WITH CHECK (get_user_role() IN ('gestor', 'financeiro'));
    $pol$;

    EXECUTE $pol$
      CREATE POLICY "leads_upd_vendedor" ON leads
        FOR UPDATE TO authenticated
        USING     (get_user_role() = 'vendedor' AND vendedor = get_user_nome())
        WITH CHECK (get_user_role() = 'vendedor' AND vendedor = get_user_nome());
    $pol$;

    RAISE NOTICE 'Policies por papel (gestor/vendedor) criadas.';
  ELSE
    -- roles_rls.sql ainda não rodou: policy permissiva temporária
    EXECUTE $pol$
      CREATE POLICY "leads_upd_authenticated" ON leads
        FOR UPDATE TO authenticated
        USING     (true)
        WITH CHECK (true);
    $pol$;

    RAISE NOTICE 'Policy temporária permissiva criada. Execute roles_rls.sql para RBAC completo.';
  END IF;
END $$;


/* ─── 4. Verificação ────────────────────────────────────────────────── */
SELECT policyname, cmd, qual, with_check
FROM   pg_policies
WHERE  tablename = 'leads' AND schemaname = 'public'
ORDER  BY cmd, policyname;
