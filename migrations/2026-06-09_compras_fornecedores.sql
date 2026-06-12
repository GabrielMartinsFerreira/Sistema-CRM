-- ═══════════════════════════════════════════════════════════════════════
-- Migration: Módulo de Compras e Controle de Pagamentos por OS
-- Data: 2026-06-09
-- RODAR NO: Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════

-- ─── 1. Fornecedores vinculados à OS ────────────────────────────────────
CREATE TABLE IF NOT EXISTS compras_fornecedores_os (
  id                   BIGSERIAL PRIMARY KEY,
  os_id                BIGINT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  fornecedor_nome      TEXT NOT NULL,
  contato              TEXT,                -- telefone / e-mail do fornecedor
  valor_total_previsto NUMERIC(12,2) DEFAULT 0,
  observacao           TEXT,
  data_vinculo         DATE DEFAULT CURRENT_DATE,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE compras_fornecedores_os ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_all_compras_forn" ON compras_fornecedores_os;
CREATE POLICY "auth_all_compras_forn"
  ON compras_fornecedores_os FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_compras_forn_os_id ON compras_fornecedores_os(os_id);

-- ─── 2. Boletos / débitos de cada fornecedor ─────────────────────────────
CREATE TABLE IF NOT EXISTS boletos_fornecedores (
  id                 BIGSERIAL PRIMARY KEY,
  fornecedor_os_id   BIGINT NOT NULL REFERENCES compras_fornecedores_os(id) ON DELETE CASCADE,
  numero_documento   TEXT,                  -- número do boleto / NF
  descricao          TEXT,                  -- ex: "Sinal 30%", "Pós-entrega 1/2"
  valor              NUMERIC(12,2) NOT NULL DEFAULT 0,
  data_vencimento    DATE,
  status             TEXT NOT NULL DEFAULT 'Pendente',  -- 'Pendente'|'Pago'|'Atrasado'
  data_pagamento     DATE,
  forma_pagamento    TEXT,                  -- PIX | Boleto | Transferência | Cheque
  comprovante_url    TEXT,                  -- path no bucket relatorios-tecnicos
  observacao         TEXT,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE boletos_fornecedores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_all_boletos_forn" ON boletos_fornecedores;
CREATE POLICY "auth_all_boletos_forn"
  ON boletos_fornecedores FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_boletos_fornecedor_os_id ON boletos_fornecedores(fornecedor_os_id);
CREATE INDEX IF NOT EXISTS idx_boletos_status ON boletos_fornecedores(status);

-- ─── 3. Atualização automática de status para "Atrasado" ─────────────────
-- Função chamada sob demanda (ou via cron no Supabase) para atualizar boletos vencidos
CREATE OR REPLACE FUNCTION atualizar_boletos_atrasados()
RETURNS void LANGUAGE sql AS $$
  UPDATE boletos_fornecedores
  SET    status = 'Atrasado'
  WHERE  status = 'Pendente'
    AND  data_vencimento < CURRENT_DATE;
$$;

-- ─── 4. VIEW — Relatório Consolidado de Despesas por OS ──────────────────
CREATE OR REPLACE VIEW relatorio_despesas_os WITH (security_invoker = true) AS
SELECT
  l.id                                               AS os_id,
  l.codigo_orcamento,
  l.nome                                             AS cliente_nome,
  l.produto,
  l.vendedor,
  l.status_os,
  l.data_aprovacao,
  COALESCE(l.valor, 0)                               AS valor_contrato,

  -- Fornecedores
  COUNT(DISTINCT cf.id)                              AS qtd_fornecedores,
  COALESCE(SUM(cf.valor_total_previsto), 0)          AS total_previsto_fornecedores,

  -- Boletos
  COUNT(bf.id)                                       AS qtd_boletos,
  COALESCE(SUM(bf.valor), 0)                         AS total_despesas_lancadas,
  COALESCE(SUM(CASE WHEN bf.status = 'Pago'    THEN bf.valor ELSE 0 END), 0) AS total_pago,
  COALESCE(SUM(CASE WHEN bf.status != 'Pago'   THEN bf.valor ELSE 0 END), 0) AS total_pendente,
  COALESCE(SUM(CASE WHEN bf.status = 'Atrasado' THEN bf.valor ELSE 0 END), 0) AS total_atrasado,

  -- Margens
  COALESCE(l.valor, 0) - COALESCE(SUM(bf.valor), 0) AS lucro_bruto_obra,
  CASE
    WHEN COALESCE(l.valor, 0) > 0
    THEN ROUND(
      ((COALESCE(l.valor, 0) - COALESCE(SUM(bf.valor), 0)) / l.valor * 100)::numeric, 2
    )
    ELSE NULL
  END                                                AS margem_pct

FROM leads l
LEFT JOIN compras_fornecedores_os cf ON cf.os_id = l.id
LEFT JOIN boletos_fornecedores      bf ON bf.fornecedor_os_id = cf.id
WHERE l.status = 'Pedido'
GROUP BY l.id, l.codigo_orcamento, l.nome, l.produto, l.vendedor,
         l.status_os, l.data_aprovacao, l.valor
ORDER BY l.id DESC;

-- ═══ Verificação ═══════════════════════════════════════════════════════════
-- SELECT * FROM relatorio_despesas_os LIMIT 5;
-- SELECT * FROM compras_fornecedores_os LIMIT 5;
-- SELECT * FROM boletos_fornecedores LIMIT 5;
