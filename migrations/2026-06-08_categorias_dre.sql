-- ═══════════════════════════════════════════════════════════════════════
-- Migration: Tabela de Categorias Dinâmicas (DRE Conceito Vidros)
-- Data: 2026-06-08
-- RODAR NO: Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS crm_categorias (
  id          BIGSERIAL PRIMARY KEY,
  tipo        TEXT NOT NULL,   -- 'fixo' | 'variavel'
  nome        TEXT NOT NULL,
  grupo       TEXT,            -- Para fixos: 'Pessoal'|'Infraestrutura'|'Serviços'|'Marketing/Financeiro'
  padrao      BOOLEAN DEFAULT TRUE,
  ativo       BOOLEAN DEFAULT TRUE,
  ordem       INT     DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE crm_categorias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_all_categorias" ON crm_categorias;
CREATE POLICY "auth_all_categorias"
  ON crm_categorias FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_crm_cat_tipo ON crm_categorias(tipo);

-- ═══ DESPESAS FIXAS (mapeadas por grupo para organização) ══════════════
INSERT INTO crm_categorias (tipo, nome, grupo, padrao, ordem) VALUES
('fixo','Pró-Labore',                          'Pessoal',              true,  1),
('fixo','Salários',                             'Pessoal',              true,  2),
('fixo','Impostos Funcionários',               'Pessoal',              true,  3),
('fixo','Vale Refeição - Vale Transporte',     'Pessoal',              true,  4),
('fixo','Aluguel',                             'Infraestrutura',       true,  5),
('fixo','Sabesp',                              'Infraestrutura',       true,  6),
('fixo','Internet - Telefone Fixo',            'Infraestrutura',       true,  7),
('fixo','Luz',                                 'Infraestrutura',       true,  8),
('fixo','Estacionamento',                      'Infraestrutura',       true,  9),
('fixo','Manutenção de Equip - Veículos - Sistema','Infraestrutura',   true, 10),
('fixo','Contabilidade',                       'Serviços',             true, 11),
('fixo','Limpeza Loja',                        'Serviços',             true, 12),
('fixo','Tarifs Bancárias',                    'Serviços',             true, 13),
('fixo','Cartão Crédito Empresa',              'Serviços',             true, 14),
('fixo','Despesas Diversas',                   'Serviços',             true, 15),
('fixo','Mercado',                             'Serviços',             true, 16),
('fixo','Material Escritório',                 'Serviços',             true, 17),
('fixo','Campanha Google',                     'Marketing/Financeiro', true, 18),
('fixo','Gerenciamento Google | Marketing',    'Marketing/Financeiro', true, 19),
('fixo','Telefone Móvel',                      'Marketing/Financeiro', true, 20)
ON CONFLICT DO NOTHING;

-- ═══ DESPESAS VARIÁVEIS (DRE Conceito Vidros) ═════════════════════════
INSERT INTO crm_categorias (tipo, nome, grupo, padrao, ordem) VALUES
('variavel','Imposto Sobre as Vendas',              null, true,  1),
('variavel','Reserva Técnica - Arquitetos',         null, true,  2),
('variavel','Adicional Noturno',                    null, true,  3),
('variavel','Combustível',                          null, true,  4),
('variavel','Refeição Variável',                    null, true,  5),
('variavel','Prestação de serviços - Terceirizados',null, true,  6),
('variavel','Tarifas de Antecipação Recebíveis',    null, true,  7),
('variavel','Comissão sobre as Vendas',             null, true,  8),
('variavel','Aquisição de Material para Vendas',    null, true,  9),
('variavel','Matéria-prima extra / Reposição',      null, true, 10),
('variavel','Fretes e Carretos',                    null, true, 11),
('variavel','Mão de obra terceirizada (Diárias)',   null, true, 12)
ON CONFLICT DO NOTHING;

-- ═══ Verificação ═══════════════════════════════════════════════════════
-- SELECT tipo, COUNT(*) FROM crm_categorias GROUP BY tipo;
