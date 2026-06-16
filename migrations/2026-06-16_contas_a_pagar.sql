/* ═══════════════════════════════════════════════════════════════════════
 * 2026-06-16_contas_a_pagar.sql
 * Módulo de Tesouraria — tabela unificada de Contas a Pagar
 *
 * Máquina de estados:
 *   provisionado → gasto previsto, sem boleto físico
 *   aberto       → boleto/código de barras inserido, aguardando vencimento
 *   atrasado     → data_vencimento < hoje, não pago (derivado — calculado no frontend)
 *   agendado     → agendado no internet banking, aguardando compensação
 *   pago         → liquidado total ou parcialmente (ver parent_id para split)
 *
 * Parcial (split):
 *   Ao pagar parcialmente, o registro original recebe status='pago' com valor_pago < valor_original.
 *   Um novo registro filho é criado automaticamente com o saldo (parent_id → registro original).
 * ═══════════════════════════════════════════════════════════════════════ */

-- ─── Tabela principal ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contas_a_pagar (
  id                BIGSERIAL PRIMARY KEY,
  user_id           UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Identificação do documento
  descricao         TEXT NOT NULL,
  numero_documento  TEXT,
  codigo_barras     TEXT,
  fornecedor_nome   TEXT,
  observacoes       TEXT,

  -- Valores (nunca muta o original; valor_pago registra a baixa real)
  valor_original    NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (valor_original >= 0),
  valor_pago        NUMERIC(12,2) DEFAULT 0 CHECK (valor_pago >= 0),
  juros             NUMERIC(12,2) DEFAULT 0 CHECK (juros >= 0),
  multa             NUMERIC(12,2) DEFAULT 0 CHECK (multa >= 0),

  -- Datas
  data_vencimento   DATE,
  data_pagamento    DATE,

  -- Máquina de estados: provisionado | aberto | atrasado | agendado | pago
  status            TEXT NOT NULL DEFAULT 'provisionado'
                      CHECK (status IN ('provisionado','aberto','atrasado','agendado','pago')),

  -- Forma/conta de pagamento (texto livre — ex: "Itaú", "Nubank")
  forma_pagamento   TEXT,

  -- Comprovante (caminho no Supabase Storage)
  url_comprovante   TEXT,

  -- Vínculo com Obra/Pedido (FK opcional para tabela leads)
  id_obra           BIGINT REFERENCES leads(id) ON DELETE SET NULL,

  -- Rastreabilidade da origem (migração de dados legados)
  origem            TEXT DEFAULT 'manual'
                      CHECK (origem IN ('manual','boleto','fixo','variavel')),
  origem_id         BIGINT,

  -- Pagamento parcial: filho aponta para o pai (registro original)
  parent_id         BIGINT REFERENCES contas_a_pagar(id) ON DELETE SET NULL,

  -- Auditoria
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Índices ───────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_cap_user_status     ON contas_a_pagar(user_id, status);
CREATE INDEX IF NOT EXISTS idx_cap_vencimento      ON contas_a_pagar(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_cap_obra            ON contas_a_pagar(id_obra);
CREATE INDEX IF NOT EXISTS idx_cap_parent          ON contas_a_pagar(parent_id);

-- ─── Row Level Security ────────────────────────────────────────────────
ALTER TABLE contas_a_pagar ENABLE ROW LEVEL SECURITY;

-- SELECT: cada usuário vê apenas seus próprios registros
CREATE POLICY "cap_select_own" ON contas_a_pagar
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- INSERT: só pode inserir com seu próprio user_id
CREATE POLICY "cap_insert_own" ON contas_a_pagar
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- UPDATE: só pode atualizar seus próprios registros
CREATE POLICY "cap_update_own" ON contas_a_pagar
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- DELETE: só pode deletar seus próprios registros
CREATE POLICY "cap_delete_own" ON contas_a_pagar
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ─── Trigger de updated_at ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cap_updated_at ON contas_a_pagar;
CREATE TRIGGER trg_cap_updated_at
  BEFORE UPDATE ON contas_a_pagar
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

-- ─── Bucket de comprovantes (executar via Dashboard se não existir) ────
-- O bucket 'relatorios-tecnicos' já existe e é privado — os comprovantes
-- de CP serão armazenados em comprovantes-pagamento/{user_id}/ dentro dele.
-- Pasta lógica: não requer criação explícita no Storage.
