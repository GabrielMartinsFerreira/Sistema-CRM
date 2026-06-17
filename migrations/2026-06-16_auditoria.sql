/* ═══════════════════════════════════════════════════════════════════════
 * 2026-06-16_auditoria.sql
 * P3 — Governança Financeira: Auditoria + Alçadas
 *
 * Cria:
 *   audit_log_financeiro  — log imutável de todas as operações financeiras
 *   alcadas_aprovacao     — limites de valor que exigem 2ª confirmação
 *   fn_audit_financeiro() — função trigger (AFTER INSERT/UPDATE/DELETE)
 *   trg_audit_*           — triggers em contas_a_pagar e boletos_fornecedores
 *
 * Dependência: trg_set_updated_at() criada em 2026-06-16_contas_a_pagar.sql
 * ═══════════════════════════════════════════════════════════════════════ */

/* ─── 1. Log de Auditoria (append-only) ──────────────────────────── */
CREATE TABLE IF NOT EXISTS audit_log_financeiro (
  id               BIGSERIAL PRIMARY KEY,
  user_id          UUID REFERENCES auth.users(id),
  tabela           TEXT NOT NULL,
  operacao         TEXT NOT NULL CHECK (operacao IN ('INSERT','UPDATE','DELETE')),
  registro_id      BIGINT,
  dados_antes      JSONB,
  dados_depois     JSONB,
  campos_alterados TEXT[],
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE audit_log_financeiro ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_select" ON audit_log_financeiro;
DROP POLICY IF EXISTS "audit_insert" ON audit_log_financeiro;

-- Cada usuário lê apenas seus próprios registros
CREATE POLICY "audit_select" ON audit_log_financeiro
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- INSERT ocorre via trigger na sessão do usuário autenticado
CREATE POLICY "audit_insert" ON audit_log_financeiro
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Sem políticas UPDATE/DELETE → tabela imutável para usuários

CREATE INDEX IF NOT EXISTS idx_audit_created  ON audit_log_financeiro(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_tabela   ON audit_log_financeiro(tabela, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_registro ON audit_log_financeiro(registro_id);
CREATE INDEX IF NOT EXISTS idx_audit_user     ON audit_log_financeiro(user_id, created_at DESC);


/* ─── 2. Alçadas de Aprovação ─────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS alcadas_aprovacao (
  id           BIGSERIAL PRIMARY KEY,
  user_id      UUID REFERENCES auth.users(id),
  contexto     TEXT NOT NULL,  -- 'baixa_cap' | 'baixa_forn'
  valor_limite NUMERIC(15,2) NOT NULL DEFAULT 0,
  ativo        BOOLEAN NOT NULL DEFAULT false,
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Um registro por contexto por usuário
CREATE UNIQUE INDEX IF NOT EXISTS uq_alcada_user_ctx
  ON alcadas_aprovacao(user_id, contexto);

ALTER TABLE alcadas_aprovacao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "alcada_select" ON alcadas_aprovacao;
DROP POLICY IF EXISTS "alcada_insert" ON alcadas_aprovacao;
DROP POLICY IF EXISTS "alcada_update" ON alcadas_aprovacao;

CREATE POLICY "alcada_select" ON alcadas_aprovacao
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "alcada_insert" ON alcadas_aprovacao
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "alcada_update" ON alcadas_aprovacao
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP TRIGGER IF EXISTS trg_alcada_upd ON alcadas_aprovacao;
CREATE TRIGGER trg_alcada_upd
  BEFORE UPDATE ON alcadas_aprovacao
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();


/* ─── 3. Função Trigger de Auditoria ──────────────────────────────── */
CREATE OR REPLACE FUNCTION fn_audit_financeiro()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO audit_log_financeiro(
    user_id,
    tabela,
    operacao,
    registro_id,
    dados_antes,
    dados_depois,
    campos_alterados
  ) VALUES (
    auth.uid(),
    TG_TABLE_NAME::TEXT,
    TG_OP::TEXT,
    CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
    -- Campos que mudaram (somente UPDATE)
    CASE WHEN TG_OP = 'UPDATE' THEN
      ARRAY(
        SELECT key
        FROM   jsonb_each(to_jsonb(NEW)) AS n
        WHERE  to_jsonb(OLD) -> key IS DISTINCT FROM n.value
      )
    ELSE NULL END
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;


/* ─── 4. Triggers em contas_a_pagar ──────────────────────────────── */
DROP TRIGGER IF EXISTS trg_audit_cap_ins ON contas_a_pagar;
DROP TRIGGER IF EXISTS trg_audit_cap_upd ON contas_a_pagar;
DROP TRIGGER IF EXISTS trg_audit_cap_del ON contas_a_pagar;

CREATE TRIGGER trg_audit_cap_ins
  AFTER INSERT ON contas_a_pagar
  FOR EACH ROW EXECUTE FUNCTION fn_audit_financeiro();

CREATE TRIGGER trg_audit_cap_upd
  AFTER UPDATE ON contas_a_pagar
  FOR EACH ROW EXECUTE FUNCTION fn_audit_financeiro();

CREATE TRIGGER trg_audit_cap_del
  AFTER DELETE ON contas_a_pagar
  FOR EACH ROW EXECUTE FUNCTION fn_audit_financeiro();


/* ─── 5. Trigger em boletos_fornecedores (baixas) ────────────────── */
DROP TRIGGER IF EXISTS trg_audit_forn_upd ON boletos_fornecedores;

CREATE TRIGGER trg_audit_forn_upd
  AFTER UPDATE ON boletos_fornecedores
  FOR EACH ROW EXECUTE FUNCTION fn_audit_financeiro();
