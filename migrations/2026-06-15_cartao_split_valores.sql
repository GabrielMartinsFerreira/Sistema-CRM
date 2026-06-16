-- ════════════════════════════════════════════════════════════════════
-- Migration: 2026-06-15_cartao_split_valores.sql
-- Split Bruto / Taxa / Líquido nas movimentações de Cartão de Crédito
--
-- RODAR NO: Supabase Dashboard → SQL Editor
-- ════════════════════════════════════════════════════════════════════

-- 1. valor_bruto: o que o cliente pagou (zeroa 100% da dívida do cliente)
--    Para entradas normais: NULL (usa `valor` diretamente).
--    Para a "entrada-resumo" de cartão: igual ao valor bruto do contrato.
ALTER TABLE financeiro_movimentacoes
  ADD COLUMN IF NOT EXISTS valor_bruto NUMERIC(12,2) DEFAULT NULL;

-- 2. valor_liquido: o que efetivamente entra no caixa após desconto da taxa
--    Para cartão: valor_bruto - taxa_cartao_valor.
ALTER TABLE financeiro_movimentacoes
  ADD COLUMN IF NOT EXISTS valor_liquido NUMERIC(12,2) DEFAULT NULL;

-- 3. is_parcela_cartao: TRUE nas N linhas do cronograma de recebíveis.
--    Estas linhas NÃO contam para o saldo devedor do cliente —
--    apenas rastreiam quando o dinheiro líquido chega ao caixa.
--    A "entrada-resumo" (que zeroa o cliente) fica FALSE.
ALTER TABLE financeiro_movimentacoes
  ADD COLUMN IF NOT EXISTS is_parcela_cartao BOOLEAN DEFAULT FALSE;

-- 4. parcela_parent_id: FK para a "entrada-resumo" que gerou o cronograma.
--    Usado para agrupar parcelas e calcular a antecipação correta.
ALTER TABLE financeiro_movimentacoes
  ADD COLUMN IF NOT EXISTS parcela_parent_id BIGINT
    REFERENCES financeiro_movimentacoes(id) ON DELETE SET NULL;

-- 5. antecipada: TRUE quando o financeiro marca que a operadora adiantou o saldo.
ALTER TABLE financeiro_movimentacoes
  ADD COLUMN IF NOT EXISTS antecipada BOOLEAN DEFAULT FALSE;

-- 6. taxa_antecipacao: valor absoluto da taxa cobrada na antecipação (R$).
ALTER TABLE financeiro_movimentacoes
  ADD COLUMN IF NOT EXISTS taxa_antecipacao NUMERIC(10,2) DEFAULT 0;

-- Índices de performance para queries do cronograma
CREATE INDEX IF NOT EXISTS idx_movs_parent_id
  ON financeiro_movimentacoes(parcela_parent_id)
  WHERE parcela_parent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_movs_parcela_cartao
  ON financeiro_movimentacoes(lead_id, is_parcela_cartao);

-- Retrocompatibilidade: garantir valores padrão em linhas existentes
UPDATE financeiro_movimentacoes SET is_parcela_cartao = FALSE WHERE is_parcela_cartao IS NULL;
UPDATE financeiro_movimentacoes SET antecipada        = FALSE WHERE antecipada        IS NULL;
UPDATE financeiro_movimentacoes SET taxa_antecipacao  = 0     WHERE taxa_antecipacao  IS NULL;
