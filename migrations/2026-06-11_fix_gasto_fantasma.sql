-- ═══════════════════════════════════════════════════════════════════════
-- Diagnóstico e Correção: Gasto Fantasma / Séries Recorrentes Incorretas
-- Data: 2026-06-11
-- USO: Supabase Dashboard → SQL Editor  (executa em 2 passos)
-- ═══════════════════════════════════════════════════════════════════════

-- ─── PASSO 1 — Diagnóstico: mostra todas as séries ativas ─────────────
-- Rode este SELECT primeiro para identificar a série problemática.
-- Procure a linha com valor = 3000 (meses 5-11 de 2026 = Jun-Dez).
SELECT
  serie_id,
  nome,
  categoria,
  valor,
  COUNT(*)          AS qtd_meses,
  MIN(mes)          AS mes_inicio,   -- 0=Jan … 11=Dez
  MAX(mes)          AS mes_fim,
  MIN(ano)          AS ano_inicio,
  MAX(ano)          AS ano_fim,
  SUM(valor)        AS impacto_total,
  SUM(CASE WHEN status_pagamento='Pago' OR pago=true THEN 1 ELSE 0 END) AS pagos
FROM gastos_fixos
WHERE serie_id IS NOT NULL
GROUP BY serie_id, nome, categoria, valor
ORDER BY valor DESC, serie_id;


-- ─── PASSO 2 — Correção: exclui a série fantasma ──────────────────────
-- ATENÇÃO: substitua o valor em WHERE abaixo pelo serie_id encontrado
-- no passo 1. Confirme o nome e valor antes de executar.
--
-- DELETE FROM gastos_fixos
-- WHERE serie_id = 'serie_XXXXXXXX_XXXXX'   -- cole o serie_id aqui
--   AND status_pagamento != 'Pago'           -- preserva entradas já pagas
--   AND (pago IS NULL OR pago = false);      -- preserva pagos (campo legado)
--
-- Para excluir TODOS os itens da série inclusive os pagos (não recomendado):
-- DELETE FROM gastos_fixos WHERE serie_id = 'serie_XXXXXXXX_XXXXX';


-- ─── Verificação pós-limpeza ──────────────────────────────────────────
-- SELECT COUNT(*), SUM(valor) FROM gastos_fixos WHERE ano=2026 AND mes>=5;
