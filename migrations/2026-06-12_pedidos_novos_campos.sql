-- ═══════════════════════════════════════════════════════════════════════
-- Migration: Campos comerciais adicionais nos Pedidos
-- Data: 2026-06-12
-- RODAR NO: Supabase Dashboard → SQL Editor (idempotente — IF NOT EXISTS)
-- ═══════════════════════════════════════════════════════════════════════

-- ─── Novos campos na tabela leads ────────────────────────────────────────
-- observacoes         → campo já existia no formulário de edição mas faltava
--                       a coluna no banco; causava erro PGRST no UPDATE
-- desconto_pct        → percentual de desconto aplicado na aprovação (N2)
-- tecnico_responsavel → técnico designado para a obra (N3, obrigatório no wizard)
-- midia_origem        → canal de captação do cliente (N4)

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS observacoes          TEXT,
  ADD COLUMN IF NOT EXISTS desconto_pct         NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tecnico_responsavel  TEXT,
  ADD COLUMN IF NOT EXISTS midia_origem         TEXT;

-- ─── Verificação ──────────────────────────────────────────────────────────
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'leads'
--   AND column_name IN ('observacoes','desconto_pct','tecnico_responsavel','midia_origem')
-- ORDER BY column_name;
