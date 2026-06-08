-- ═══════════════════════════════════════════════════════════════════════
-- Migration: Controle de Pedidos e Fluxo Financeiro
-- Data: 2026-06-08
-- RODAR NO: Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════

-- 1. Colunas de Controle de OS na tabela leads
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS status_os         TEXT DEFAULT 'Em andamento',
  ADD COLUMN IF NOT EXISTS motivo_congelamento TEXT;

-- 2. Tabela de Movimentações Financeiras Reais
CREATE TABLE IF NOT EXISTS financeiro_movimentacoes (
  id                  BIGSERIAL PRIMARY KEY,
  lead_id             BIGINT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  descricao           TEXT NOT NULL,
  tipo                TEXT NOT NULL DEFAULT 'Entrada',    -- 'Entrada' | 'Saída'
  valor               NUMERIC(12,2) NOT NULL DEFAULT 0,
  data_movimentacao   DATE,
  parcela_ref         TEXT,       -- referência à condição da parcela (JSONB leads.parcelas)
  forma_pagamento     TEXT,
  comprovante_url     TEXT,       -- caminho no bucket relatorios-tecnicos (signed URL p/ leitura)
  observacao          TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Habilitar RLS
ALTER TABLE financeiro_movimentacoes ENABLE ROW LEVEL SECURITY;

-- 4. Policy: apenas usuários autenticados (login obrigatório pelo app)
DROP POLICY IF EXISTS "authenticated_all_movimentacoes" ON financeiro_movimentacoes;
CREATE POLICY "authenticated_all_movimentacoes"
  ON financeiro_movimentacoes
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 5. Índice para performance nas buscas por pedido
CREATE INDEX IF NOT EXISTS idx_fin_mov_lead_id
  ON financeiro_movimentacoes(lead_id);

-- ═══ Verificação (opcional — rodar em seguida para confirmar) ══════════
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'leads' AND column_name IN ('status_os','motivo_congelamento');
-- SELECT COUNT(*) FROM financeiro_movimentacoes;
