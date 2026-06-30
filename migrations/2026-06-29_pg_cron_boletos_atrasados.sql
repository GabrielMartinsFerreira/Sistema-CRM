/* ═══════════════════════════════════════════════════════════════════════
 * 2026-06-29_pg_cron_boletos_atrasados.sql
 * Agenda execução automática diária de atualizar_boletos_atrasados()
 * via extensão pg_cron do Supabase.
 *
 * Horário: 09:00 UTC = 06:00 BRT (horário de Brasília, UTC-3)
 *
 * RODAR NO: Supabase Dashboard → SQL Editor
 * ORDEM: pode ser rodado a qualquer momento — independente de outras migrations
 * IDEMPOTENTE: usa DROP/unschedule antes de criar → seguro reexecutar
 * ═══════════════════════════════════════════════════════════════════════ */


/* ─── 1. Habilitar a extensão pg_cron ──────────────────────────────────
 * No Supabase a extensão fica no schema "pg_catalog" por default.
 * Se preferir habilitar pelo Dashboard: Database → Extensions → pg_cron → Enable.
 * Ambas as formas produzem o mesmo resultado; IF NOT EXISTS é idempotente. */
CREATE EXTENSION IF NOT EXISTS pg_cron;


/* ─── 2. Remover o job se já existir (idempotência) ────────────────────
 * pg_cron lança erro se cron.schedule() for chamado com um jobname já
 * cadastrado; o bloco DO remove silenciosamente antes de recriar. */
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'atualizar-boletos'
  ) THEN
    PERFORM cron.unschedule('atualizar-boletos');
    RAISE NOTICE 'Job "atualizar-boletos" removido para recriação.';
  END IF;
END $$;


/* ─── 3. Criar o job de execução diária ────────────────────────────────
 * Cron: '0 9 * * *'  = minuto 0, hora 9, todo dia, todo mês, todo dia da semana
 *                     → 09:00 UTC = 06:00 BRT
 *
 * A função é chamada com schema explícito (public.) porque o pg_cron
 * do Supabase executa sem garantia de search_path incluir "public". */
SELECT cron.schedule(
  'atualizar-boletos',           -- jobname (único)
  '0 9 * * *',                   -- expressão cron (09:00 UTC / 06:00 BRT)
  $$ SELECT public.atualizar_boletos_atrasados() $$
);


/* ─── 4. Verificar que o job foi criado corretamente ───────────────────
 * Execute esta query separadamente ou logo em seguida para confirmar.
 * Esperado: 1 linha com jobname='atualizar-boletos', schedule='0 9 * * *', active=true */
SELECT
  jobid,
  jobname,
  schedule,
  command,
  active,
  database,
  username
FROM cron.job
WHERE jobname = 'atualizar-boletos';
