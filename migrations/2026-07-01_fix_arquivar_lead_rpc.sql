/* ═══════════════════════════════════════════════════════════════════════
 * 2026-07-01_fix_arquivar_lead_rpc.sql
 * Correção FINAL do erro ao arquivar lead ("new row violates RLS for leads").
 *
 * ───────────────────────────────────────────────────────────────────────
 * CAUSA RAIZ (comprovada empiricamente):
 *   A policy de SELECT `leads_sel USING (arquivado = false)` é aplicada
 *   também à linha resultante de um UPDATE. Ao setar arquivado = true a
 *   linha "sai" da visibilidade do SELECT e o Postgres rejeita o UPDATE —
 *   mesmo com a policy de UPDATE tendo WITH CHECK (true).
 *
 *   Provas:
 *     • UPDATE ... SET id = id      (arquivado continua false) → SUCESSO
 *     • UPDATE ... SET arquivado=true                          → 42501
 *     • Nenhum trigger e nenhuma rule em leads.
 *
 * POR QUE NÃO SOLTAR O FILTRO DO SELECT:
 *   leads é lido SEM filtro de arquivado em comprasService, financeiro
 *   (carregarPedidos) e listarLeadsSimples. Trocar o SELECT para USING(true)
 *   vazaria leads arquivados para pedidos/compras/relatórios. O filtro no
 *   RLS é o que esconde os arquivados em todas essas telas de uma vez.
 *
 * SOLUÇÃO:
 *   Arquivar passa a rodar por uma função SECURITY DEFINER (executa como
 *   dono da tabela → ignora RLS), então o UPDATE não esbarra na policy de
 *   SELECT. O RLS continua escondendo arquivados em todas as leituras.
 *
 *   O app chama via RPC: db.rpc('arquivar_lead', { p_id: <id> })
 *   (ver alteração em js/services/crmService.js).
 *
 * RODAR NO: Supabase Dashboard → SQL Editor
 * IDEMPOTENTE: CREATE OR REPLACE + REVOKE/GRANT
 * ═══════════════════════════════════════════════════════════════════════ */


/* ─── 1. Função de arquivamento (soft-delete) ────────────────────────── */
CREATE OR REPLACE FUNCTION public.arquivar_lead(p_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Defesa: só usuário autenticado pode arquivar
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  UPDATE public.leads SET arquivado = true WHERE id = p_id;
END;
$$;


/* ─── 2. Permissões: só authenticated pode executar ──────────────────── */
REVOKE ALL     ON FUNCTION public.arquivar_lead(bigint) FROM public;
GRANT  EXECUTE ON FUNCTION public.arquivar_lead(bigint) TO   authenticated;


/* ─── 3. (Opcional) Função para DESARQUIVAR, mesma proteção ──────────── */
CREATE OR REPLACE FUNCTION public.desarquivar_lead(p_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  UPDATE public.leads SET arquivado = false WHERE id = p_id;
END;
$$;

REVOKE ALL     ON FUNCTION public.desarquivar_lead(bigint) FROM public;
GRANT  EXECUTE ON FUNCTION public.desarquivar_lead(bigint) TO   authenticated;


/* ─── 4. Verificação ─────────────────────────────────────────────────── */
-- Confirma que as funções existem e são SECURITY DEFINER:
SELECT proname, prosecdef AS security_definer, pg_get_function_identity_arguments(oid) AS args
FROM   pg_proc
WHERE  pronamespace = 'public'::regnamespace
  AND  proname IN ('arquivar_lead', 'desarquivar_lead');
