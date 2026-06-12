-- ═══════════════════════════════════════════════════════════════════════
-- Migration: Campos da Ficha de Pedido PDF (3 páginas A4 landscape)
-- Data: 2026-06-12
-- RODAR NO: Supabase Dashboard → SQL Editor (idempotente)
-- ═══════════════════════════════════════════════════════════════════════
-- As tabelas do módulo de Compras (compras_fornecedores_os, boletos_fornecedores)
-- já existem — ver 2026-06-09_compras_fornecedores.sql.

-- ─── Campos complementares da Ficha PDF na tabela leads ──────────────────
-- endereco_numero / cidade / estado → endereço completo da OS no PDF
-- ficha_descritivo → JSONB { item, vidro, estrutura, outros }
-- ficha_foto1_path / ficha_foto2_path → paths no bucket PRIVADO
--   relatorios-tecnicos (leitura via createSignedUrl → base64 → PDF)

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS endereco_numero  TEXT,
  ADD COLUMN IF NOT EXISTS cidade           TEXT,
  ADD COLUMN IF NOT EXISTS estado           TEXT,
  ADD COLUMN IF NOT EXISTS ficha_descritivo JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS ficha_foto1_path TEXT,
  ADD COLUMN IF NOT EXISTS ficha_foto2_path TEXT;

-- ─── Verificação ──────────────────────────────────────────────────────────
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name='leads'
--   AND column_name IN ('endereco_numero','cidade','estado','ficha_descritivo','ficha_foto1_path','ficha_foto2_path');
