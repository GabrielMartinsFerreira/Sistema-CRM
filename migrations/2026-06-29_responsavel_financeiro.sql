/* ═══════════════════════════════════════════════════════════════════════
 * 2026-06-29_responsavel_financeiro.sql
 * Governança de Cobrança — campo "Responsável Financeiro/Legal"
 *
 * Usado quando o pagador da obra/projeto é diferente do titular do CPF:
 * emissão de contratos, NF e réguas de cobrança secundárias.
 *
 * Tabela alvo: crm_clientes (RLS já ativa — sem alteração de policy)
 * ═══════════════════════════════════════════════════════════════════════ */

ALTER TABLE crm_clientes
  ADD COLUMN IF NOT EXISTS responsavel_financeiro_nome TEXT;
