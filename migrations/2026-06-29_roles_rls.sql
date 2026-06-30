/* ═══════════════════════════════════════════════════════════════════════
 * 2026-06-29_roles_rls.sql
 * Implementa perfis de acesso (roles) multi-usuário no GG TECH CRM.
 *
 * Papéis disponíveis (salvo em raw_user_meta_data do auth.users):
 *   gestor     → acesso total
 *   vendedor   → index.html + pedidos.html (somente seus leads)
 *   financeiro → faturamento.html, pedidos.html, caixa.html (sem deletar leads)
 *   tecnico    → index.html e compras.html
 *
 * Como definir o papel de um usuário (Supabase Dashboard → Authentication
 *   → Users → clique no usuário → Edit → raw_user_meta_data):
 *   {"role":"vendedor","nome":"Gabriel"}
 *
 *   O campo "nome" DEVE corresponder exatamente ao valor de leads.vendedor
 *   para que a policy de vendedor funcione (ex: "Gabriel", "Camille").
 *   Usuários SEM campo "role" recebem papel 'gestor' automaticamente
 *   (retrocompatibilidade com o administrador existente).
 *
 * RODAR NO: Supabase Dashboard → SQL Editor
 * IDEMPOTENTE: CREATE OR REPLACE + DROP IF EXISTS garantem reexecução segura
 * ═══════════════════════════════════════════════════════════════════════ */


/* ─── 1. get_user_role() ────────────────────────────────────────────── */
-- Lê o papel do JWT do usuário autenticado atual.
-- Retorna 'gestor' quando o campo não está definido (retrocompat).
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COALESCE(
    auth.jwt() -> 'user_metadata' ->> 'role',
    'gestor'
  );
$$;


/* ─── 2. get_user_nome() ────────────────────────────────────────────── */
-- Retorna o "nome" do vendedor (user_metadata.nome) para comparar com
-- leads.vendedor. Fallback para e-mail caso "nome" não esteja definido.
CREATE OR REPLACE FUNCTION get_user_nome()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COALESCE(
    auth.jwt() -> 'user_metadata' ->> 'nome',
    auth.jwt() ->> 'email'
  );
$$;


/* ─── 3. Recriar RLS de leads com policies por papel ───────────────── */

-- Remove TODAS as policies existentes em leads (limpeza total para recriar)
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'leads' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON leads', pol.policyname);
    RAISE NOTICE 'Policy removida: %', pol.policyname;
  END LOOP;
END $$;

-- ── SELECT ──────────────────────────────────────────────────────────
-- gestor, financeiro, tecnico: vêem todos os leads não-arquivados
CREATE POLICY "leads_sel_staff" ON leads
  FOR SELECT TO authenticated
  USING (
    arquivado = false
    AND get_user_role() IN ('gestor', 'financeiro', 'tecnico')
  );

-- vendedor: apenas os seus próprios leads
CREATE POLICY "leads_sel_vendedor" ON leads
  FOR SELECT TO authenticated
  USING (
    arquivado = false
    AND get_user_role() = 'vendedor'
    AND vendedor = get_user_nome()
  );

-- ── INSERT ──────────────────────────────────────────────────────────
-- técnico não cria leads; gestor, financeiro e vendedor podem
CREATE POLICY "leads_ins" ON leads
  FOR INSERT TO authenticated
  WITH CHECK (get_user_role() IN ('gestor', 'financeiro', 'vendedor'));

-- ── UPDATE ──────────────────────────────────────────────────────────
-- gestor e financeiro atualizam qualquer lead
CREATE POLICY "leads_upd_staff" ON leads
  FOR UPDATE TO authenticated
  USING     (get_user_role() IN ('gestor', 'financeiro'))
  WITH CHECK(get_user_role() IN ('gestor', 'financeiro'));

-- vendedor atualiza apenas seus leads
CREATE POLICY "leads_upd_vendedor" ON leads
  FOR UPDATE TO authenticated
  USING     (get_user_role() = 'vendedor' AND vendedor = get_user_nome())
  WITH CHECK(get_user_role() = 'vendedor' AND vendedor = get_user_nome());

-- ── DELETE (hard-delete via resetarLeads) ───────────────────────────
-- Apenas gestor pode executar delete físico.
-- Soft-delete (arquivado=true) é coberto pela policy de UPDATE acima.
CREATE POLICY "leads_del_gestor" ON leads
  FOR DELETE TO authenticated
  USING (get_user_role() = 'gestor');


/* ─── 4. Verificação ────────────────────────────────────────────────── */
-- Lista todas as policies ativas em leads:
SELECT policyname, cmd, qual, with_check
FROM   pg_policies
WHERE  tablename = 'leads' AND schemaname = 'public'
ORDER  BY cmd, policyname;

-- Confirma as duas funções criadas:
SELECT routine_name, security_type
FROM   information_schema.routines
WHERE  routine_schema = 'public'
  AND  routine_name IN ('get_user_role', 'get_user_nome');
