/* ═══════════════════════════════════════════════════════════════════════
 * js/core/supabase.js — Inicialização central do cliente Supabase
 * ───────────────────────────────────────────────────────────────────────
 * Carregado como <script> clássico ANTES dos serviços e dos scripts inline.
 * Depende de: window.supabase (CDN @supabase/supabase-js@2, carregado no <head>)
 * Expõe (escopo global compartilhado entre scripts clássicos):
 *   - db              → cliente Supabase
 *   - TABLES          → nomes das tabelas
 *   - STORAGE_BUCKET  → bucket de relatórios técnicos (privado)
 * ═══════════════════════════════════════════════════════════════════════ */
const SUPABASE_URL = "https://oglwwfdpoqjisxcvdalh.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9nbHd3ZmRwb3FqaXN4Y3ZkYWxoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0NTU0MzcsImV4cCI6MjA5NjAzMTQzN30.JtqMClve2EIKtw-V3LAonIB8p0Ebc98NR7kmxgrP0ws";

const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const TABLES = {
  LEADS:       'leads',
  FATURAMENTO: 'faturamento',
  CLIENTES:    'crm_clientes',
  GASTOS:      'gastos_fixos',
  VARIAVEIS:   'crm_gastos_variaveis'
};
const STORAGE_BUCKET = 'relatorios-tecnicos';

/* Compatibilidade explícita com window (para módulos que checam typeof) */
window.db = db;
window.TABLES = TABLES;
window.STORAGE_BUCKET = STORAGE_BUCKET;
/* Retrocompat: algumas funções legadas referenciam a constante antiga */
window.CRM_CLIENTES_TABLE = TABLES.CLIENTES;
