-- ═══════════════════════════════════════════════════════════════════════
-- Migration: Auto-Org e Ordenação nos Fornecedores
-- Data: 2026-06-09
-- RODAR NO: Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════

-- Adiciona flag de Organização Automática por fornecedor
-- Quando true: boletos Atrasados são sempre exibidos no topo da tabela
ALTER TABLE compras_fornecedores_os
  ADD COLUMN IF NOT EXISTS auto_org BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN compras_fornecedores_os.auto_org
  IS 'Organização Automática: quando true, boletos Atrasados sobem ao topo independente da ordenação escolhida.';

-- ═══ Verificação ═════════════════════════════════════════════════════
-- SELECT id, fornecedor_nome, auto_org FROM compras_fornecedores_os LIMIT 10;
