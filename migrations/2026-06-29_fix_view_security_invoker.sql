/* ═══════════════════════════════════════════════════════════════════════
 * 2026-06-29_fix_view_security_invoker.sql
 * Corrige alerta de segurança do Supabase Advisor:
 *   "Security Definer View — vw_promessas_quebradas"
 *
 * Problema: views criadas pelo superuser (postgres) rodam com as
 * permissões do criador, contornando RLS dos usuários autenticados.
 *
 * Solução: recriar com security_invoker = true para que a view execute
 * com as permissões de quem consulta, respeitando a policy
 * "prom_select" (user_id = auth.uid()) da tabela promessas_pagamento.
 *
 * RODAR NO: Supabase Dashboard → SQL Editor
 * IDEMPOTENTE: CREATE OR REPLACE não destrói permissões existentes
 * ═══════════════════════════════════════════════════════════════════════ */

CREATE OR REPLACE VIEW vw_promessas_quebradas
  WITH (security_invoker = true)
AS
SELECT *
FROM   promessas_pagamento
WHERE  tipo           = 'promessa'
  AND  status         = 'pendente'
  AND  data_prometida < CURRENT_DATE;

/* ─── Verificação ────────────────────────────────────────────────────── */
-- Confirma que a view agora tem security_invoker:
SELECT viewname, definition
FROM   pg_views
WHERE  schemaname = 'public' AND viewname = 'vw_promessas_quebradas';

-- Confirma a opção no catálogo (reloptions deve conter 'security_invoker=on'):
SELECT relname, reloptions
FROM   pg_class
WHERE  relname = 'vw_promessas_quebradas';
