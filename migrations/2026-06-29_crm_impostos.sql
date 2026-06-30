-- ═══════════════════════════════════════════════════════════════════════
-- Módulo Impostos e Obrigações Fiscais — GG TECH CRM
-- Data: 2026-06-29
-- ═══════════════════════════════════════════════════════════════════════

-- 1. Tabela principal
CREATE TABLE IF NOT EXISTS crm_impostos (
  id                  BIGSERIAL       PRIMARY KEY,
  nome                TEXT            NOT NULL,
  categoria           TEXT            NOT NULL  DEFAULT 'federal',
  competencia_mes     SMALLINT        NOT NULL,
  competencia_ano     SMALLINT        NOT NULL,
  data_vencimento     DATE,
  aliquota_pct        NUMERIC(6,4),
  valor_provisionado  NUMERIC(14,2)   NOT NULL  DEFAULT 0,
  valor_pago          NUMERIC(14,2),
  data_pagamento      DATE,
  forma_pagamento     TEXT,
  status              TEXT            NOT NULL  DEFAULT 'pendente',
  observacoes         TEXT,
  user_id             UUID            REFERENCES auth.users(id),
  created_at          TIMESTAMPTZ     NOT NULL  DEFAULT NOW(),
  updated_at          TIMESTAMPTZ     NOT NULL  DEFAULT NOW()
);

-- 2. Trigger updated_at (reutiliza trg_set_updated_at já existente)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_updated_at_crm_impostos'
      AND tgrelid = 'public.crm_impostos'::regclass
  ) THEN
    CREATE TRIGGER set_updated_at_crm_impostos
      BEFORE UPDATE ON crm_impostos
      FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
  END IF;
END $$;

-- 3. Índice de competência (acesso primário por mes+ano)
CREATE INDEX IF NOT EXISTS idx_crm_impostos_competencia
  ON crm_impostos (competencia_ano, competencia_mes);

-- 4. RLS
ALTER TABLE crm_impostos ENABLE ROW LEVEL SECURITY;

-- Limpeza idempotente das políticas
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'crm_impostos' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON crm_impostos', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "impostos_select"
  ON crm_impostos FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "impostos_insert"
  ON crm_impostos FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "impostos_update"
  ON crm_impostos FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "impostos_delete"
  ON crm_impostos FOR DELETE TO authenticated
  USING (true);

-- 5. Comentários
COMMENT ON TABLE  crm_impostos IS 'Impostos e obrigações fiscais mensais (DAS, ISS, INSS, FGTS, etc.)';
COMMENT ON COLUMN crm_impostos.competencia_mes IS '0-11, alinhado ao Date.getMonth() do JavaScript';
COMMENT ON COLUMN crm_impostos.aliquota_pct    IS 'Alíquota % usada para calcular o provisionado automático';

-- 6. Verificação
SELECT 'crm_impostos criada com ' || COUNT(*) || ' colunas' AS status
FROM information_schema.columns
WHERE table_name = 'crm_impostos' AND table_schema = 'public';
