-- ═══════════════════════════════════════════════════════════════════════
-- Migration: Relatório de Visita Técnica + Tabela de Métodos de Pagamento
-- Data: 2026-06-10
-- RODAR NO: Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════

-- ─── 1. Coluna para o path do relatório técnico da visita ────────────────
-- Guarda o caminho no Storage (bucket relatorios-tecnicos).
-- Herdado automaticamente para relatorio_tecnico_url ao aprovar o orçamento.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS visita_relatorio_path TEXT;

-- ─── 2. Tabela de métodos de pagamento dinâmicos ─────────────────────────
CREATE TABLE IF NOT EXISTS crm_metodos_pagamento (
  id         BIGSERIAL PRIMARY KEY,
  nome       TEXT NOT NULL UNIQUE,
  emoji      TEXT DEFAULT '💳',
  ativo      BOOLEAN DEFAULT TRUE,
  ordem      INT DEFAULT 99,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE crm_metodos_pagamento ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_all_metodos_pag" ON crm_metodos_pagamento;
CREATE POLICY "auth_all_metodos_pag"
  ON crm_metodos_pagamento FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_metodos_pag_ativo ON crm_metodos_pagamento(ativo);

-- ─── 3. Dados padrão (idempotente: ON CONFLICT skipa se já existir) ───────
-- Os nomes coincidem com os valores já gravados nos gastos existentes,
-- garantindo compatibilidade com registros históricos.
INSERT INTO crm_metodos_pagamento (nome, emoji, ativo, ordem) VALUES
  ('Itaú',               '🟧', TRUE, 1),
  ('Nubank',             '🟪', TRUE, 2),
  ('Cartão Corporativo', '💳', TRUE, 3),
  ('Caixa Interno',      '💵', TRUE, 4)
ON CONFLICT (nome) DO NOTHING;

-- ─── Verificação ─────────────────────────────────────────────────────────
-- SELECT column_name FROM information_schema.columns WHERE table_name='leads' AND column_name='visita_relatorio_path';
-- SELECT id, nome, emoji, ordem FROM crm_metodos_pagamento ORDER BY ordem;
