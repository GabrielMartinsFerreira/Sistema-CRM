/* ═══════════════════════════════════════════════════════════════════════
 * 2026-06-17_promessas_pagamento.sql
 * P4 — Fila de Cobrança + Promessas de Pagamento
 *
 * Registra tentativas de cobrança e promessas de clientes,
 * associando ao lead/OS. Sem dependência de outras migrations P3.
 * ═══════════════════════════════════════════════════════════════════════ */

CREATE TABLE IF NOT EXISTS promessas_pagamento (
  id               BIGSERIAL PRIMARY KEY,
  user_id          UUID REFERENCES auth.users(id),
  lead_id          BIGINT NOT NULL,

  -- 'contato'  → tentativa/registro de comunicação sem compromisso de data
  -- 'promessa' → cliente comprometeu-se a pagar até data_prometida
  tipo             TEXT NOT NULL DEFAULT 'contato'
                     CHECK (tipo IN ('contato','promessa')),

  descricao        TEXT,
  valor_prometido  NUMERIC(15,2),  -- apenas para tipo='promessa'
  data_prometida   DATE,           -- apenas para tipo='promessa'

  -- pendente  → aguardando vencimento/cumprimento
  -- cumprida  → cliente pagou conforme prometido
  -- quebrada  → data passou e não houve pagamento (marcada manualmente ou via UI)
  -- cancelada → descartada pelo operador
  status           TEXT NOT NULL DEFAULT 'pendente'
                     CHECK (status IN ('pendente','cumprida','quebrada','cancelada')),

  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Índices ────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_prom_lead     ON promessas_pagamento(lead_id);
CREATE INDEX IF NOT EXISTS idx_prom_user     ON promessas_pagamento(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prom_status   ON promessas_pagamento(status) WHERE status = 'pendente';
CREATE INDEX IF NOT EXISTS idx_prom_data_pr  ON promessas_pagamento(data_prometida) WHERE data_prometida IS NOT NULL;

-- ─── RLS ────────────────────────────────────────────────────────────
ALTER TABLE promessas_pagamento ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prom_select" ON promessas_pagamento;
DROP POLICY IF EXISTS "prom_insert" ON promessas_pagamento;
DROP POLICY IF EXISTS "prom_update" ON promessas_pagamento;

CREATE POLICY "prom_select" ON promessas_pagamento
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "prom_insert" ON promessas_pagamento
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "prom_update" ON promessas_pagamento
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ─── Trigger updated_at ─────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_prom_upd ON promessas_pagamento;
CREATE TRIGGER trg_prom_upd
  BEFORE UPDATE ON promessas_pagamento
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

-- ─── View auxiliar: promessas quebradas automáticas ─────────────────
-- Útil para relatórios SQL; a UI também computa isso client-side.
CREATE OR REPLACE VIEW vw_promessas_quebradas AS
SELECT *
FROM   promessas_pagamento
WHERE  tipo           = 'promessa'
  AND  status         = 'pendente'
  AND  data_prometida < CURRENT_DATE;
