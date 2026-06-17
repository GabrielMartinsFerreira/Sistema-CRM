/* ═══════════════════════════════════════════════════════════════════════
 * 2026-06-16_config_caixa.sql
 * Motor de Projeção de Caixa — configuração por usuário
 *
 * Índice de Confiabilidade de Recebimento (ICR):
 *   Pondera parcelas a receber pelo risco de não-liquidação baseado
 *   em dias de atraso. Exemplo padrão:
 *     Em dia / a vencer  → 100 % (certeza de recebimento)
 *     Atrasada 1–30 dias → 70 %  (risco moderado)
 *     Atrasada 31–60 d   → 40 %  (risco alto)
 *     Atrasada > 60 dias → 0 %   (excluída do projetado por padrão)
 *
 * Dependência: função trg_set_updated_at() criada em
 *   2026-06-16_contas_a_pagar.sql — rodar DEPOIS daquela migration.
 * ═══════════════════════════════════════════════════════════════════════ */

CREATE TABLE IF NOT EXISTS config_caixa (
  id                 BIGSERIAL PRIMARY KEY,
  user_id            UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Saldo atual em conta (ponto de partida do cálculo)
  saldo_inicial      NUMERIC(15,2) NOT NULL DEFAULT 0,

  -- Índice de Confiabilidade de Recebimento por faixa de aging (0-100)
  peso_em_dia        NUMERIC(5,2)  NOT NULL DEFAULT 100  CHECK (peso_em_dia        BETWEEN 0 AND 100),
  peso_atraso_1_30   NUMERIC(5,2)  NOT NULL DEFAULT 70   CHECK (peso_atraso_1_30   BETWEEN 0 AND 100),
  peso_atraso_31_60  NUMERIC(5,2)  NOT NULL DEFAULT 40   CHECK (peso_atraso_31_60  BETWEEN 0 AND 100),
  peso_atraso_60plus NUMERIC(5,2)  NOT NULL DEFAULT 0    CHECK (peso_atraso_60plus  BETWEEN 0 AND 100),

  updated_at         TIMESTAMPTZ   DEFAULT NOW()
);

-- ─── RLS ──────────────────────────────────────────────────────────────
ALTER TABLE config_caixa ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cfg_caixa_select" ON config_caixa;
DROP POLICY IF EXISTS "cfg_caixa_insert" ON config_caixa;
DROP POLICY IF EXISTS "cfg_caixa_update" ON config_caixa;

CREATE POLICY "cfg_caixa_select" ON config_caixa
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "cfg_caixa_insert" ON config_caixa
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "cfg_caixa_update" ON config_caixa
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─── Trigger de updated_at (reutiliza função da migration contas_a_pagar) ──
DROP TRIGGER IF EXISTS trg_config_caixa_upd ON config_caixa;
CREATE TRIGGER trg_config_caixa_upd
  BEFORE UPDATE ON config_caixa
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

-- ─── Índice ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_config_caixa_user ON config_caixa(user_id);
