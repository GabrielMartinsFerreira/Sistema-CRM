-- ════════════════════════════════════════════════════════════════════
-- Migration: 2026-06-15_cartao_movimentacoes.sql
-- Suporte a parcelamento de Cartão de Crédito na tabela de movimentações
--
-- RODAR NO: Supabase Dashboard → SQL Editor
-- ════════════════════════════════════════════════════════════════════

-- 1. status: 'Confirmado' (receita realizada) vs 'Pendente' (parcela futura de cartão)
--    Retrocompatível: todas as linhas existentes recebem 'Confirmado' via DEFAULT
ALTER TABLE financeiro_movimentacoes
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Confirmado';

-- 2. data_vencimento: data em que a parcela de cartão está prevista para liquidar
--    Diferente de data_movimentacao (data do lançamento / entrada imediata)
ALTER TABLE financeiro_movimentacoes
  ADD COLUMN IF NOT EXISTS data_vencimento DATE;

-- 3. taxa_cartao_valor: valor absoluto da taxa de intermediação (Stone/operadora)
--    já descontada no líquido que o sistema considera
ALTER TABLE financeiro_movimentacoes
  ADD COLUMN IF NOT EXISTS taxa_cartao_valor NUMERIC(10,2) DEFAULT 0;

-- 4. índice para acelerar queries de aging (Contas a Receber / status pendente)
CREATE INDEX IF NOT EXISTS idx_movs_status_tipo
  ON financeiro_movimentacoes(status, tipo);

-- 5. Garante que linhas existentes tenham 'Confirmado' (caso o DEFAULT não preencha retroativamente)
UPDATE financeiro_movimentacoes
  SET status = 'Confirmado'
  WHERE status IS NULL;
