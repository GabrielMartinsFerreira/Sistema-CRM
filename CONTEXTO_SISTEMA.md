# 🧠 CONTEXTO DEFINITIVO DO SISTEMA — GG TECH CRM
### Conceito Vidros & Projetos

> **Propósito:** System Prompt / Context File para uso em futuras conversas com IA ou revisão humana.
> Qualquer pessoa (ou IA) que ler este documento deve conseguir entender o sistema inteiro sem ler o código.
>
> **Última atualização:** 2026-06-29
> **Regra:** Atualizar este arquivo a cada evolução do sistema (novas tabelas, colunas, telas, regras de negócio, correções).

---

## 1. PERFIL DO USUÁRIO & CONTEXTO DO NEGÓCIO

- **Quem:** Gabriel — gestor/empreendedor à frente da **Conceito Vidros & Projetos** (vidros temperados, esquadrias e projetos sob medida). Atua na ponta comercial e operacional: orçamentos, pedidos, obras, finanças.
- **O que constrói:** O próprio CRM/ERP comercial e financeiro, apelidado de **GG TECH CRM**.
- **Perfil técnico:** Hands-on, não-iniciante. Edita HTML/CSS/JS diretamente, roda migrations SQL no Supabase SQL Editor, testa localmente com `npx serve`. Entende banco (tabelas, RLS, policies, Storage), front-end (DOM, Chart.js) e finanças (DRE, margem, fluxo de caixa).
- **Forma de trabalho:** Features completas, SQL pronto para copiar, validação etapa a etapa, confirma no banco antes de avançar.

---

## 2. ARQUITETURA & STACK

### 2.1 Stack & Bibliotecas

| Camada | Tecnologia |
|---|---|
| Front-end | HTML / CSS / Vanilla JS (sem frameworks) |
| Back-end | Supabase (cliente JS via CDN `@supabase/supabase-js@2`) |
| Auth | Supabase Auth — e-mail/senha, anon key + RLS |
| Gráficos | Chart.js (via jsdelivr CDN) |
| Calendário | FullCalendar v6 |
| Drag-and-drop | SortableJS |
| PDF | html2canvas@1.4.1 + jsPDF@2.5.1 (via jsdelivr CDN) |
| Deploy | Vercel — `sistema-crm-eosin.vercel.app` |
| Dev local | `npx serve -l 3456 .` (também funciona com `file://`) |

**CDN permitida:** apenas `cdn.jsdelivr.net` (CSP no `vercel.json`).

**Design System:** tema escuro com variáveis CSS no `:root`:
`--bg-card`, `--bg-card2`, `--border`, `--accent`, `--accent-glow`, `--green`, `--red`, `--yellow`, `--orange`, `--text`, `--text-dim`, `--text-muted`, `--green-dim`, `--yellow-dim`, `--red-dim`, `--red-dim`.

### 2.2 Estrutura de Arquivos JS (modular)

```
js/
├── core/
│   ├── utils.js        # esc, brl, fmtDate, badgeClass, num, toast  → window.Utils
│   ├── supabase.js     # db, TABLES{...}, STORAGE_BUCKET            → window.*
│   └── auth.js         # authGate(), _renderLogin(), _renderUserBar(), throttle
├── services/
│   ├── crmService.js          # leads + clientes + storage
│   ├── financeiroService.js   # pedidos + faturamento + gastos + DRE + Contas a Pagar + categorias + métodos
│   ├── comprasService.js      # fornecedores por OS + boletos + view relatorio_despesas_os
│   ├── caixaService.js        # P1/P2 — projeção de fluxo de caixa + config_caixa
│   ├── auditService.js        # P3 — audit_log_financeiro + alcadas_aprovacao
│   └── cobrancaService.js     # P4 — promessas_pagamento
└── modules/
    ├── wizard-aprovacao.js    # UI visita + cadastro técnico + wizard aprovação 3 passos
    └── ficha-pdf.js           # Ficha de Pedido PDF 3 páginas (html2canvas + jsPDF)
```

### 2.3 Ordem de Carregamento + Regras Críticas

**Ordem obrigatória em cada HTML:**
`utils.js → supabase.js → auth.js → crmService.js → financeiroService.js → [comprasService.js] → script inline → [wizard-aprovacao.js] → [ficha-pdf.js]`

**Regras:**
- Scripts clássicos `<script src>` sem `type="module"` — compatibilidade com handlers `onclick` inline e com `file://`.
- Globais compartilhados entre scripts: `db`, `TABLES`, `STORAGE_BUCKET`, `_authSession`, `toast`, `brl`, `esc`, `fmtDate`.
- **NUNCA** redeclarar `const db` / `const TABLES` dentro de um script inline (SyntaxError por declaração duplicada no mesmo escopo).
- **NUNCA** chamar `db.from()` diretamente nos HTML — tudo passa pelos serviços.

### 2.4 Páginas HTML (Telas)

| Arquivo | Descrição | Scripts extras carregados |
|---|---|---|
| `index.html` | Pipeline Kanban + Calendário de Visitas + Central de Clientes + Wizard de Aprovação | wizard-aprovacao.js |
| `faturamento.html` | Núcleo financeiro: Visão Obras, Gastos Fixos, Gastos Variáveis, Contas a Pagar, **Impostos**, Projeção de Caixa, Governança | ficha-pdf.js |
| `pedidos.html` | Controle de Pedidos + Contas a Receber + Fila de Cobrança | — |
| `compras.html` | Compras por Obra (fornecedores + boletos) + Contas a Pagar legado | comprasService.js |
| `caixa.html` | Motor de Projeção de Caixa D+0→D+60 | caixaService.js |
| `relatorios.html` | Relatórios mensais: funil, vendedores, rankings, Breakeven | — |

### 2.5 Deploy & Segurança

- **`vercel.json`** na raiz define cabeçalhos HTTP de segurança: `CSP`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, `HSTS`.
- **CSP:** `'unsafe-inline'` em script/style (obrigatório para handlers inline); `connect-src` libera `*.supabase.co` (https+wss) e `viacep.com.br`; `script-src` libera `cdn.jsdelivr.net`.
- **Supabase Auth (e-mail/senha) obrigatório.** `auth.js` expõe `window.authGate()` — cada loader chama `await authGate()` antes de buscar dados. Sem sessão válida → mostra tela de login sobrepostal e **aborta o carregamento** (não carrega nada).
- **Throttle client-side no login:** 3 tentativas incorretas consecutivas → bloqueio de 30 segundos. Implementado em `_loginAttempts` e `_loginBlockedUntil` em `auth.js`.
- **Barra de usuário:** ao autenticar, `_renderUserBar()` injeta um pill fixo no canto inferior-esquerdo (bottom: 14px, left: 14px) com e-mail do usuário + botão "Sair" (chama `db.auth.signOut()` + `location.reload()`).
- **`_authSession`** é uma variável global (escopo compartilhado do `auth.js`) usada por `auditService`, `cobrancaService` e `caixaService` para obter `user.id` ao fazer upserts com `user_id`.
- **Usuários:** criados manualmente no painel Supabase (Authentication → Users, com *Auto Confirm*). **Signup público DESATIVADO.**
- **anon key é pública no código** (normal para Supabase) — sem risco porque RLS + Auth a tornam inútil sem login. **NUNCA** expor a `service_role` key no front-end.
- **Pentest (2026-06-07):** 0 vulnerabilidades — anon key sem login → leitura negada (0 linhas), INSERT negado (401), Storage sem listagem/upload anônimo.
- **Storage bucket `relatorios-tecnicos`:** privado. Leitura sempre via `createSignedUrl(path, 3600)` (URL temporária de 1h). Colunas guardam o **caminho**, não a URL. Função `abrirAnexoTecnico(path)` gera a signed URL sob demanda e abre `window.open()`.

---

## 3. BANCO DE DADOS — SCHEMA COMPLETO

**URL Supabase:** `https://oglwwfdpoqjisxcvdalh.supabase.co`
**Todas as tabelas** têm RLS habilitado com policies `TO authenticated`.

### 3.1 Tabela `leads` (orçamentos e pedidos)

Tabela central do sistema. Cada linha = um orçamento ou pedido.

| Coluna | Tipo | Default | Descrição |
|---|---|---|---|
| `id` | BIGSERIAL PK | — | — |
| `codigo_orcamento` | TEXT | — | Código único do orçamento (ex: ORC-001) |
| `nome` | TEXT | — | Nome do cliente (PF) |
| `valor` | NUMERIC | — | Valor total do projeto/contrato |
| `status` | TEXT | — | `'Orçamento'` / `'Pedido'` / `'Perdido'` |
| `produto` | TEXT | — | Descrição do produto/serviço |
| `vendedor` | TEXT | — | Nome do vendedor |
| `order_index` | INT | — | Posição no Kanban (atualizada pelo SortableJS) |
| `os` | TEXT | — | Número da Ordem de Serviço (editável em pedidos) |
| `data_aprovacao` | DATE | — | Data em que o orçamento foi aprovado como pedido |
| `visita_necessaria` | BOOLEAN | false | Requer visita técnica? |
| `visita_data` | DATE | — | Data agendada para a visita |
| `visita_horario` | TEXT | — | Horário da visita |
| `visita_status` | TEXT | `'Pendente'` | `'Pendente'` / `'Concluída'` |
| `visita_relatorio_path` | TEXT | — | Path do relatório da visita no Storage |
| `tipo_doc` | TEXT | — | `'CPF'` / `'CNPJ'` |
| `cpf` | TEXT | — | CPF do cliente (só PF) |
| `razao_social` | TEXT | — | Razão Social (só PJ) |
| `cnpj` | TEXT | — | CNPJ (só PJ) |
| `nome_contato` | TEXT | — | Contato da empresa (só PJ) |
| `telefone` | TEXT | — | Telefone / WhatsApp |
| `cep` | TEXT | — | CEP |
| `endereco` | TEXT | — | Logradouro |
| `bairro` | TEXT | — | Bairro |
| `complemento` | TEXT | — | Complemento |
| `periodo_obra` | TEXT | — | Diurno / Noturno / Comercial / Ambos |
| `prazo_entrega` | TEXT | — | Prazo de entrega (ex: "30 dias úteis") |
| `prev_instalacao` | DATE | — | Data prevista de instalação |
| `parcelas` | JSONB | `'[]'` | Array de condições de pagamento (schema §8.1) |
| `relatorio_tecnico_url` | TEXT | — | Path do relatório técnico (Storage privado) |
| `status_os` | TEXT | `'Em andamento'` | Estado da execução: `'Em andamento'` / `'Aguardando'` / `'Congelada'` / `'Concluída'` |
| `motivo_congelamento` | TEXT | — | Motivo obrigatório quando `status_os = 'Congelada'` |
| `observacoes` | TEXT | — | Notas livres |
| `desconto_pct` | NUMERIC(5,2) | 0 | Desconto comercial aplicado na aprovação (%) |
| `tecnico_responsavel` | TEXT | — | Técnico designado para a obra (obrigatório no wizard) |
| `midia_origem` | TEXT | — | Canal de captação do cliente (opcional) |
| `endereco_numero` | TEXT | — | Número do endereço (para Ficha PDF) |
| `cidade` | TEXT | — | Cidade (para Ficha PDF) |
| `estado` | TEXT | — | UF (para Ficha PDF) |
| `ficha_descritivo` | JSONB | `{}` | `{ item, vidro, estrutura, outros }` (Ficha PDF) |
| `ficha_foto1_path` | TEXT | — | Path da 1ª foto no Storage (Ficha PDF) |
| `ficha_foto2_path` | TEXT | — | Path da 2ª foto no Storage (Ficha PDF) |

**RLS:** `FOR ALL TO authenticated USING(true) WITH CHECK(true)`.

### 3.2 Tabela `faturamento` (custos diretos por OS)

Registra deduções de custo de cada pedido para cálculo de lucro/margem.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | BIGSERIAL PK | — |
| `lead_id` | BIGINT | FK → leads (não CASCADE — independente) |
| `materiais` | NUMERIC(12,2) | Custo de materiais realizados |
| `prev_materiais` | NUMERIC(12,2) | Provisão de materiais |
| `logistica` | NUMERIC(12,2) | Fretes e logística |
| `encargos` | NUMERIC(12,2) | Encargos tributários da OS |
| `mao_obra_inst` | NUMERIC(12,2) | Mão de obra de instalação |
| `comissao_vendedor` | NUMERIC(12,2) | Comissão do vendedor |
| `comissao_arq_eng` | NUMERIC(12,2) | Comissão de arquiteto/engenheiro |
| `updated_at`, `created_at` | TIMESTAMPTZ | — |

### 3.3 Tabela `crm_clientes` (clientes recorrentes)

Repositório de clientes cadastrados para reutilização em novos orçamentos (autocomplete por CPF/CNPJ).

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | BIGSERIAL PK | — |
| `lead_id` | BIGINT | Último orçamento vinculado a este cliente (nullable) |
| `tipo` | TEXT | `'CPF'` / `'CNPJ'` |
| `nome` | TEXT | Nome do cliente (PF) ou Razão Social (PJ) |
| `doc` | TEXT | CPF ou CNPJ formatado |
| `doc_digits` | TEXT | Somente dígitos (índice para busca `.eq()`) |
| `cpf` | TEXT | CPF formatado (só PF) |
| `cnpj` | TEXT | CNPJ formatado (só PJ) |
| `razao_social` | TEXT | Razão Social (só PJ) |
| `nome_contato` | TEXT | Contato da empresa (só PJ) |
| `responsavel_financeiro_nome` | TEXT | **Responsável financeiro/legal** — preenchido quando o pagador da obra difere do titular do CPF. Usado em contratos, NF e réguas de cobrança. Somente para PF. *(adicionado 2026-06-29)* |
| `telefone` | TEXT | Telefone/WhatsApp |
| `cep` | TEXT | CEP |
| `endereco` | TEXT | Logradouro |
| `bairro` | TEXT | Bairro |
| `complemento` | TEXT | Complemento |
| `periodo` | TEXT | Período de obra preferido |
| `prazo` | TEXT | Prazo de entrega padrão |
| `created_at` | TIMESTAMPTZ | — |

**Índice:** `idx_crm_clientes_doc_digits` em `doc_digits`.
**Busca:** `crmService.buscarClientesFiltro(q, digits)` — `.ilike()` em nome, razão_social, doc + `.ilike()` em doc_digits quando há dígitos.
**Duplicidade:** `crmService.buscarDuplicadoDoc(digits, exceptId)` bloqueia CPF/CNPJ repetido antes de inserir/atualizar.
**Edit mode em `wizard-aprovacao.js`:** `_preencherCadModal(c)` hidrata todos os campos incluindo `responsavel_financeiro_nome`; `selecionarClienteRecorrente(id)` faz o mesmo no Wizard.

### 3.4 Tabela `gastos_fixos`

Despesas fixas mensais da empresa. Cada linha = um gasto em um mês/ano específico.

| Coluna | Tipo | Default | Descrição |
|---|---|---|---|
| `id` | BIGSERIAL PK | — | — |
| `categoria` | TEXT | — | Nome da categoria (livre ou da `crm_categorias`) |
| `nome` | TEXT | — | Nome do gasto |
| `valor` | NUMERIC(12,2) | 0 | Valor mensal |
| `mes` | INT | — | Mês (0–11, índice JS) |
| `ano` | INT | — | Ano (ex: 2026) |
| `fixar_proximo` | BOOLEAN | false | Replica automaticamente nos meses seguintes |
| `serie_id` | TEXT | — | ID da série (agrupa cópias mensais do mesmo gasto recorrente) |
| `dia_vencimento` | INT | — | Dia do mês (1–31) |
| `status_pagamento` | TEXT | `'Pendente'` | `'Pendente'` / `'Agendado'` / `'Pago'` (`'Atrasado'` = derivado) |
| `data_pagamento_real` | DATE | — | Data real do pagamento |
| `forma_pagamento` | TEXT | — | Itaú / Nubank / Cartão Corporativo / Caixa Interno |
| `comprovante_url` | TEXT | — | Path no Storage |
| `pago` | BOOLEAN | false | Flag legado (obsoleto; usar `status_pagamento`) |
| `pago_em` | TIMESTAMPTZ | — | Timestamp da baixa |
| `created_at` | TIMESTAMPTZ | — | — |

**Índice:** `idx_gastos_fixos_serie` em `serie_id`.

### 3.5 Tabela `crm_gastos_variaveis`

Custos extras variáveis: por obra (com `pedido_id`) ou gerais (sem `pedido_id`).

| Coluna | Tipo | Default | Descrição |
|---|---|---|---|
| `id` | BIGSERIAL PK | — | — |
| `categoria` | TEXT | — | Categoria do gasto |
| `descricao` | TEXT | — | Descrição do lançamento |
| `valor` | NUMERIC(12,2) | 0 | Valor |
| `dia_vencimento` | INT | — | Dia do mês (1–31) |
| `status` | TEXT | `'Pendente'` | `'Pendente'` / `'Pago'` |
| `pedido_id` | BIGINT | NULL | FK lógica → `leads.id`. NULL = Geral / sem vínculo |
| `mes` | INT | — | Mês (0–11) |
| `ano` | INT | — | Ano |
| `data_pagamento_real` | DATE | — | Data real da baixa |
| `forma_pagamento` | TEXT | — | Conta/forma usada |
| `comprovante_url` | TEXT | — | Path no Storage |
| `pago_em` | TIMESTAMPTZ | — | Timestamp da baixa |
| `created_at` | TIMESTAMPTZ | — | — |

**Taxa de Cartão:** `confirmarCartaoModal()` em `pedidos.html` injeta automaticamente a taxa em `crm_gastos_variaveis` com `pedido_id = leadId`, categoria `'Despesa Financeira'`, status `'Pago'`.
**Custo por OS:** variáveis com `pedido_id` preenchido entram no custo da OS em `faturamento.html` via helper `variaveisDe(leadId)` — somadas em KPIs, Visão Obras, Modal de Custos, Auditoria e Ficha OS. Variáveis `pedido_id = null` (Gerais) entram apenas no DRE/Health mensal geral.

### 3.6 Tabela `financeiro_movimentacoes` (movimentações reais)

Registra recebimentos e saídas reais vinculados a cada pedido.

| Coluna | Tipo | Default | Descrição |
|---|---|---|---|
| `id` | BIGSERIAL PK | — | — |
| `lead_id` | BIGINT | — | FK → leads (CASCADE DELETE) |
| `descricao` | TEXT | — | — |
| `tipo` | TEXT | `'Entrada'` | `'Entrada'` / `'Saída'` |
| `valor` | NUMERIC(12,2) | — | Valor líquido (ou bruto para entradas normais) |
| `valor_bruto` | NUMERIC(12,2) | NULL | O que o cliente pagou (split cartão) |
| `valor_liquido` | NUMERIC(12,2) | NULL | `valor_bruto − taxa_cartao_valor` |
| `taxa_cartao_valor` | NUMERIC(10,2) | 0 | Taxa da operadora (absoluto) |
| `data_movimentacao` | DATE | — | Data do lançamento / competência |
| `data_vencimento` | DATE | NULL | Data de liquidação esperada (parcelas cartão) |
| `status` | TEXT | `'Confirmado'` | `'Confirmado'` (caixa) / `'Pendente'` (a liquidar) |
| `is_parcela_cartao` | BOOLEAN | FALSE | TRUE nas N parcelas do cronograma; FALSE na entrada-resumo |
| `parcela_parent_id` | BIGINT | NULL | FK → id da entrada-resumo que gerou o cronograma |
| `antecipada` | BOOLEAN | FALSE | TRUE quando a operadora adiantou o valor |
| `taxa_antecipacao` | NUMERIC(10,2) | 0 | Valor R$ da taxa de antecipação |
| `parcela_ref` | TEXT | — | Rótulo da parcela (ex: "1/3") |
| `forma_pagamento` | TEXT | — | Pix, Boleto, Cartão… |
| `comprovante_url` | TEXT | — | Path do comprovante no Storage |
| `observacao` | TEXT | — | Nota livre |
| `created_at` | TIMESTAMPTZ | — | — |

**Índices:** `idx_fin_mov_lead_id`, `idx_movs_status_tipo`, `idx_movs_parent_id`, `idx_movs_parcela_cartao`.

### 3.7 Tabela `compras_fornecedores_os` (fornecedores por OS)

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | BIGSERIAL PK | — |
| `os_id` | BIGINT | FK → leads (CASCADE DELETE) |
| `fornecedor_nome` | TEXT | Nome do fornecedor |
| `contato` | TEXT | Telefone/e-mail |
| `valor_total_previsto` | NUMERIC(12,2) | Orçamento previsto |
| `observacao` | TEXT | — |
| `data_vinculo` | DATE | Data de inclusão |
| `auto_org` | BOOLEAN | false | Quando TRUE, boletos Atrasados sobem ao topo da lista independente da ordenação |
| `created_at` | TIMESTAMPTZ | — |

**Índice:** `idx_compras_forn_os_id`.

### 3.8 Tabela `boletos_fornecedores`

| Coluna | Tipo | Default | Descrição |
|---|---|---|---|
| `id` | BIGSERIAL PK | — | — |
| `fornecedor_os_id` | BIGINT | — | FK → compras_fornecedores_os (CASCADE DELETE) |
| `numero_documento` | TEXT | — | Número do boleto / NF |
| `descricao` | TEXT | — | Ex: "Sinal 30%", "Pós-entrega 1/2" |
| `valor` | NUMERIC(12,2) | 0 | — |
| `data_vencimento` | DATE | — | — |
| `status` | TEXT | `'Pendente'` | `'Pendente'` / `'Pago'` / `'Atrasado'` |
| `data_pagamento` | DATE | — | — |
| `forma_pagamento` | TEXT | — | PIX / Boleto / Transferência / Cheque |
| `comprovante_url` | TEXT | — | Path no Storage |
| `observacao` | TEXT | — | — |
| `created_at` | TIMESTAMPTZ | — | — |

**Índices:** `idx_boletos_fornecedor_os_id`, `idx_boletos_status`.
**`atualizar_boletos_atrasados()`:** função SQL que atualiza `status = 'Atrasado'` nos boletos vencidos (Pendente + `data_vencimento < CURRENT_DATE`). Chamada sob demanda no front.

### 3.9 Tabela `contas_a_pagar` (Tesouraria Operacional)

| Coluna | Tipo | Default | Descrição |
|---|---|---|---|
| `id` | BIGSERIAL PK | — | — |
| `user_id` | UUID | — | FK → auth.users (CASCADE; RLS por `user_id`) |
| `descricao` | TEXT | — | — |
| `numero_documento` | TEXT | — | — |
| `codigo_barras` | TEXT | — | — |
| `fornecedor_nome` | TEXT | — | — |
| `observacoes` | TEXT | — | — |
| `valor_original` | NUMERIC(12,2) | 0 | Valor do documento — **nunca muta** |
| `valor_pago` | NUMERIC(12,2) | 0 | Registrado na baixa (< original = split parcial) |
| `juros`, `multa` | NUMERIC(12,2) | 0 | Encargos adicionados na baixa |
| `data_vencimento` | DATE | — | — |
| `data_pagamento` | DATE | — | Preenchido na baixa |
| `status` | TEXT | `'provisionado'` | `provisionado` / `aberto` / `agendado` / `pago` (**`atrasado` = NUNCA persistido** — derivado no front por `capStatusEfetivo()`) |
| `forma_pagamento` | TEXT | — | Conta usada |
| `url_comprovante` | TEXT | — | Path no Storage |
| `id_obra` | BIGINT | — | FK → leads SET NULL (vínculo opcional) |
| `origem` | TEXT | `'manual'` | `manual` / `boleto` / `fixo` / `variavel` |
| `origem_id` | BIGINT | — | ID do registro de origem (para rastreabilidade) |
| `parent_id` | BIGINT | — | FK → contas_a_pagar SET NULL (registro pai em split parcial) |
| `created_at`, `updated_at` | TIMESTAMPTZ | — | Trigger `trg_cap_updated_at` atualiza `updated_at` |

**RLS:** 4 policies `TO authenticated` com `user_id = auth.uid()` (SELECT / INSERT / UPDATE / DELETE).
**Split parcial:** ao pagar parcialmente, registro original → `status='pago'`, `valor_pago` = valor informado. Novo registro filho criado com `parent_id` apontando para o original e `valor_original = saldo restante`.

### 3.10 Tabela `crm_metodos_pagamento` (métodos de pagamento dinâmicos)

Configura as formas de pagamento disponíveis no sistema (usadas na aba Categorias do modal de Governança).

| Coluna | Tipo | Default | Descrição |
|---|---|---|---|
| `id` | BIGSERIAL PK | — | — |
| `nome` | TEXT UNIQUE | — | Nome da forma (ex: "Itaú") |
| `emoji` | TEXT | `'💳'` | Emoji de identificação |
| `ativo` | BOOLEAN | TRUE | FALSE = soft-delete |
| `ordem` | INT | 99 | Ordem de exibição |
| `created_at` | TIMESTAMPTZ | — | — |

**Dados padrão:** Itaú 🟧 (ordem 1), Nubank 🟪 (2), Cartão Corporativo 💳 (3), Caixa Interno 💵 (4).
**TABLES alias:** `TABLES.METODOS_PAGAMENTO = 'crm_metodos_pagamento'`.
**Soft-delete:** `deletarMetodo(id)` atualiza `ativo = false` (não exclui da tabela).

### 3.11 Tabela `crm_categorias` (categorias dinâmicas)

Categorias de gastos fixos e variáveis, utilizadas nos formulários como `<select>` dinâmico.

| Coluna | Tipo | Default | Descrição |
|---|---|---|---|
| `id` | BIGSERIAL PK | — | — |
| `tipo` | TEXT | — | `'fixo'` / `'variavel'` |
| `nome` | TEXT | — | Nome da categoria |
| `grupo` | TEXT | — | Agrupamento para fixos: `'Pessoal'` / `'Infraestrutura'` / `'Serviços'` / `'Marketing/Financeiro'` |
| `padrao` | BOOLEAN | TRUE | Categoria pré-carregada do sistema |
| `ativo` | BOOLEAN | TRUE | FALSE = soft-delete |
| `ordem` | INT | 0 | Ordem de exibição |
| `created_at` | TIMESTAMPTZ | — | — |

**TABLES alias:** `TABLES.CATEGORIAS = 'crm_categorias'`.
**Soft-delete:** `deletarCategoria(id)` atualiza `ativo = false`.

**Categorias fixas pré-carregadas (tipo='fixo', 20 itens):**
- **Pessoal:** Pró-Labore, Salários, Impostos Funcionários, Vale Refeição/Transporte
- **Infraestrutura:** Aluguel, Sabesp, Internet/Telefone Fixo, Luz, Estacionamento, Manutenção Equip/Veículos/Sistema
- **Serviços:** Contabilidade, Limpeza Loja, Tarifs Bancárias, Cartão Crédito Empresa, Despesas Diversas, Mercado, Material Escritório
- **Marketing/Financeiro:** Campanha Google, Gerenciamento Google/Marketing, Telefone Móvel

**Categorias variáveis pré-carregadas (tipo='variavel', 12 itens):** Imposto Sobre as Vendas, Reserva Técnica - Arquitetos, Adicional Noturno, Combustível, Refeição Variável, Prestação de serviços - Terceirizados, Tarifas de Antecipação Recebíveis, Comissão sobre as Vendas, Aquisição de Material para Vendas, Matéria-prima extra/Reposição, Fretes e Carretos, Mão de obra terceirizada (Diárias).

### 3.12 Tabela `config_caixa` (configuração do Motor de Caixa)

Uma linha por usuário — configuração do saldo inicial e pesos do ICR.

| Coluna | Tipo | Default | Descrição |
|---|---|---|---|
| `id` | BIGSERIAL PK | — | — |
| `user_id` | UUID UNIQUE | — | FK → auth.users |
| `saldo_inicial` | NUMERIC | 0 | Saldo de abertura da projeção |
| `peso_em_dia` | INT | 100 | ICR — em dia / a vencer (0–100 %) |
| `peso_atraso_1_30` | INT | 70 | ICR — atraso 1–30 dias |
| `peso_atraso_31_60` | INT | 40 | ICR — atraso 31–60 dias |
| `peso_atraso_60plus` | INT | 0 | ICR — atraso > 60 dias |

**RLS:** SELECT/INSERT/UPDATE `TO authenticated` com `user_id = auth.uid()`.
**Upsert:** `caixaService.salvarConfig(dados)` usa `onConflict: 'user_id'`.

### 3.13 Tabela `audit_log_financeiro` (log imutável)

Trilha de auditoria append-only. **NUNCA tem policy de UPDATE/DELETE** → imutável para usuários.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | BIGSERIAL PK | — |
| `user_id` | UUID | FK → auth.users |
| `tabela` | TEXT | Tabela que gerou o evento |
| `operacao` | TEXT | `'INSERT'` / `'UPDATE'` / `'DELETE'` |
| `registro_id` | BIGINT | ID do registro afetado |
| `dados_antes` | JSONB | Estado anterior (UPDATE/DELETE) |
| `dados_depois` | JSONB | Estado novo (INSERT/UPDATE) |
| `campos_alterados` | TEXT[] | Campos que mudaram (só UPDATE) |
| `created_at` | TIMESTAMPTZ | — |

**Gravado exclusivamente por trigger** `fn_audit_financeiro()` que roda com `auth.uid()` da sessão.
**Triggers:** `AFTER INSERT/UPDATE/DELETE` em `contas_a_pagar` + `AFTER UPDATE` em `boletos_fornecedores`.
**RLS:** somente SELECT + INSERT (`user_id = auth.uid()`). Sem UPDATE/DELETE.

### 3.14 Tabela `alcadas_aprovacao` (limites de alçada)

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | BIGSERIAL PK | — |
| `user_id` | UUID | FK → auth.users |
| `contexto` | TEXT | `'baixa_cap'` / `'baixa_forn'` |
| `valor_limite` | NUMERIC(15,2) | Limite para exigir 2ª confirmação |
| `ativo` | BOOLEAN | false | FALSE = trava desligada |
| `updated_at` | TIMESTAMPTZ | — |

**UNIQUE:** `(user_id, contexto)` — um registro por contexto por usuário.
**Upsert:** `auditService.salvarAlcada(contexto, valorLimite, ativo)` usa `onConflict: 'user_id,contexto'`.

### 3.15 Tabela `promessas_pagamento` (fila de cobrança)

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | BIGSERIAL PK | — |
| `user_id` | UUID | FK → auth.users (RLS) |
| `lead_id` | BIGINT | Pedido/cliente associado |
| `tipo` | TEXT | `'contato'` (registro de comunicação) / `'promessa'` (compromisso de pagamento) |
| `descricao` | TEXT | Nota livre |
| `valor_prometido` | NUMERIC(15,2) | Só para `tipo='promessa'` |
| `data_prometida` | DATE | Só para `tipo='promessa'` |
| `status` | TEXT | `'pendente'` / `'cumprida'` / `'quebrada'` / `'cancelada'` |
| `created_at`, `updated_at` | TIMESTAMPTZ | Trigger `trg_prom_upd` atualiza `updated_at` |

**RLS:** SELECT / INSERT / UPDATE `user_id = auth.uid()` (sem DELETE). Sem policy de DELETE.

### 3.16 Tabela `crm_impostos` (impostos e obrigações fiscais)

Controle mensal de DAS, ISS, INSS, FGTS e outras obrigações tributárias.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | BIGSERIAL PK | — |
| `nome` | TEXT | Ex: `'DAS - Simples Nacional'`, `'ISS'` |
| `categoria` | TEXT | `'federal'` / `'estadual'` / `'municipal'` / `'trabalhista'` |
| `competencia_mes` | SMALLINT | 0-11 (alinhado ao `Date.getMonth()` do JS) |
| `competencia_ano` | SMALLINT | Ex: 2026 |
| `data_vencimento` | DATE | Data de vencimento do pagamento |
| `aliquota_pct` | NUMERIC(6,4) | Alíquota usada para calcular o provisionado automático |
| `valor_provisionado` | NUMERIC(14,2) | Valor calculado/estimado |
| `valor_pago` | NUMERIC(14,2) | Preenchido na baixa |
| `data_pagamento` | DATE | Data efetiva do pagamento |
| `forma_pagamento` | TEXT | Banco/método (Itaú, Nubank, PIX, etc.) |
| `status` | TEXT | `'pendente'` / `'pago'` |
| `observacoes` | TEXT | Notas livres |
| `user_id` | UUID | FK → auth.users (usuário que lançou) |
| `created_at`, `updated_at` | TIMESTAMPTZ | Trigger `set_updated_at_crm_impostos` |

**Status efetivo:** `'atrasado'` é derivado em JS (`status='pendente'` + `data_vencimento < hoje`), não é persistido.
**Botão "Calcular":** usa `financeiroService.calcularImpostoAutomatico(fatMes, aliq)` → `Math.round(fatMes * aliq / 100)`.
**Acesso:** aba "🧾 Impostos" em `faturamento.html` (restrita a gestor/financeiro via `authGateRole`).
**RLS:** SELECT e UPDATE permissivos (`USING(true)`); INSERT exige `user_id = auth.uid()`; DELETE permissivo (botão escondido para não-gestores via `.gestor-only`).
**Índice:** `idx_crm_impostos_competencia` em `(competencia_ano, competencia_mes)`.

**Serviço (financeiroService.js):**
- `carregarImpostos(mes, ano)` — SELECT filtrado por competência, ordenado por `data_vencimento`
- `inserirImposto(dados)` — INSERT
- `atualizarImposto(id, upd)` — UPDATE (usado para editar e para baixa)
- `calcularImpostoAutomatico(fatMes, aliq)` — retorna `Math.round(fatMes * aliq / 100)`

### 3.17 Views & Funções Postgres

| Objeto | Tipo | Descrição |
|---|---|---|
| `relatorio_despesas_os` | VIEW | `security_invoker = true` — agrega por OS: qtd fornecedores/boletos, total lançado/pago/pendente/atrasado, `lucro_bruto_obra`, `margem_pct`. `LEFT JOIN leads → compras_fornecedores_os → boletos_fornecedores` |
| `vw_promessas_quebradas` | VIEW | Promessas `tipo='promessa'`, `status='pendente'`, `data_prometida < CURRENT_DATE` |
| `trg_set_updated_at()` | FUNCTION | Trigger genérico que seta `NEW.updated_at = NOW()`. Reutilizado por `contas_a_pagar`, `alcadas_aprovacao`, `promessas_pagamento` |
| `fn_audit_financeiro()` | FUNCTION | Trigger de auditoria: grava linha em `audit_log_financeiro` com `dados_antes`/`dados_depois`/`campos_alterados` |
| `atualizar_boletos_atrasados()` | FUNCTION | Marca `status='Atrasado'` em boletos Pendente vencidos. Chamada sob demanda |

---

## 4. HISTÓRICO DE MIGRAÇÕES

Todas as migrations abaixo já foram **executadas no Supabase** (confirmado pelo usuário).
As migrations marcadas com ⚠️ **PENDENTE** ainda não foram executadas.

| # | Arquivo | Data | O que criou/alterou |
|---|---|---|---|
| 1 | *(sem arquivo — SQL inline)* | ~2026-05 | Criação inicial: `leads`, `faturamento`, `crm_clientes`, `gastos_fixos`; políticas iniciais |
| 2 | `2026-06-08_controle_pedidos.sql` | 2026-06-08 | Colunas `leads.status_os`, `leads.motivo_congelamento`; tabela `financeiro_movimentacoes` |
| 3 | `2026-06-08_categorias_dre.sql` | 2026-06-08 | Tabela `crm_categorias` + 20 categorias fixas + 12 variáveis pré-populadas |
| 4 | `2026-06-09_compras_fornecedores.sql` | 2026-06-09 | Tabelas `compras_fornecedores_os` + `boletos_fornecedores`; função `atualizar_boletos_atrasados()`; view `relatorio_despesas_os` |
| 5 | `2026-06-09_auto_org_boletos.sql` | 2026-06-09 | Coluna `compras_fornecedores_os.auto_org` |
| 6 | `2026-06-10_visita_relatorio_metodos_pagamento.sql` | 2026-06-10 | Coluna `leads.visita_relatorio_path`; tabela `crm_metodos_pagamento` + 4 métodos padrão |
| 7 | `2026-06-11_fix_gasto_fantasma.sql` | 2026-06-11 | Correção de bug de fantasma nos gastos fixos |
| 8 | `2026-06-12_pedidos_novos_campos.sql` | 2026-06-12 | Colunas `leads`: `observacoes`, `desconto_pct`, `tecnico_responsavel`, `midia_origem` |
| 9 | `2026-06-12_ficha_pdf_campos.sql` | 2026-06-12 | Colunas `leads`: `endereco_numero`, `cidade`, `estado`, `ficha_descritivo`, `ficha_foto1_path`, `ficha_foto2_path` |
| 10 | `2026-06-15_cartao_movimentacoes.sql` | 2026-06-15 | Colunas `financeiro_movimentacoes`: `status`, `data_vencimento`, `taxa_cartao_valor`; índice `idx_movs_status_tipo` |
| 11 | `2026-06-15_cartao_split_valores.sql` | 2026-06-15 | Colunas `financeiro_movimentacoes`: `valor_bruto`, `valor_liquido`, `is_parcela_cartao`, `parcela_parent_id`, `antecipada`, `taxa_antecipacao`; índices `idx_movs_parent_id`, `idx_movs_parcela_cartao` |
| 12 | `2026-06-16_contas_a_pagar.sql` | 2026-06-16 | Tabela `contas_a_pagar` (5 estados + split); função `trg_set_updated_at()` |
| 13 | `2026-06-16_config_caixa.sql` | 2026-06-16 | Tabela `config_caixa` (saldo inicial + pesos ICR) |
| 14 | `2026-06-16_auditoria.sql` | 2026-06-16 | Tabela `audit_log_financeiro` (imutável); tabela `alcadas_aprovacao`; função `fn_audit_financeiro()`; triggers em `contas_a_pagar` e `boletos_fornecedores` |
| 15 | `2026-06-17_promessas_pagamento.sql` | 2026-06-17 | Tabela `promessas_pagamento`; view `vw_promessas_quebradas` |
| 16 | `2026-06-29_responsavel_financeiro.sql` | 2026-06-29 | ⚠️ **PENDENTE** — `ALTER TABLE crm_clientes ADD COLUMN IF NOT EXISTS responsavel_financeiro_nome TEXT` |
| 17 | `2026-06-29_pg_cron_boletos_atrasados.sql` | 2026-06-29 | ⚠️ **PENDENTE** — Habilita extensão `pg_cron`; cria job `atualizar-boletos` → `SELECT public.atualizar_boletos_atrasados()` todo dia às 09:00 UTC (06:00 BRT) |

**SQLs pendentes de execução:**

Migration 16:
```sql
ALTER TABLE crm_clientes
  ADD COLUMN IF NOT EXISTS responsavel_financeiro_nome TEXT;
```

Migration 17 (pg_cron — executar no SQL Editor):
```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'atualizar-boletos') THEN
    PERFORM cron.unschedule('atualizar-boletos');
  END IF;
END $$;

SELECT cron.schedule(
  'atualizar-boletos',
  '0 9 * * *',
  $$ SELECT public.atualizar_boletos_atrasados() $$
);

-- Verificação:
SELECT jobid, jobname, schedule, command, active FROM cron.job WHERE jobname = 'atualizar-boletos';
```

---

## 5. CAMADA DE SERVIÇOS JS

### 5.1 `crmService` (leads + clientes + storage)

```
Leads:
  listarLeads()                         → ordered by order_index, id
  listarLeadsSimples()                  → ordered by id only
  inserirLead(lead)
  atualizarLead(id, dados)
  deletarLead(id)
  resetarLeads()                        ⚠️ deleta TODOS os leads (uso restrito)
  atualizarOrdem(updates)               → array de {id, order_index} para o SortableJS kanban

Clientes (crm_clientes):
  listarClientes()
  buscarClientePorDoc(digits)           → .eq('doc_digits', digits), limit 1
  buscarClientesFiltro(q, digits)       → .ilike() em nome/razao_social/doc + digits
  buscarDuplicadoDoc(digits, exceptId)  → verifica CPF/CNPJ duplicado antes de inserir
  inserirCliente(row)
  atualizarCliente(id, row)
  deletarCliente(id)
  deletarClientesPorLead(leadId)        → remove clientes vinculados a um lead (antes de reinserir)
  deletarClientesPorDoc(digits)         → idempotência ao salvar do wizard

Storage (bucket relatorios-tecnicos):
  uploadRelatorio(path, file, contentType)   → upsert: true
  urlAssinadaRelatorio(path, expiraSeg=3600) → createSignedUrl
```

### 5.2 `financeiroService` (dados financeiros + matemática pura)

```
Pedidos/Faturamento:
  carregarPedidos()                     → leads com status='Pedido', order id DESC
  carregarFaturamento()
  buscarFaturamentoPorLead(leadId)
  inserirFaturamento(dados)
  atualizarFaturamento(id, dados)

Gastos Fixos:
  carregarGastos()
  inserirGasto(row)
  inserirGastos(rows)                   → bulk insert (replicação de série)
  atualizarGasto(id, upd)
  deletarGasto(id)
  atualizarGastosIn(ids, upd)           → bulk update por série
  deletarGastosIn(ids)                  → bulk delete por série

Gastos Variáveis:
  carregarVariaveis()
  inserirVariavel(row)
  atualizarVariavel(id, upd)
  deletarVariavel(id)

Movimentações Financeiras:
  carregarMovimentacoes()
  carregarMovimentacoesPorLead(leadId)
  inserirMovimentacao(dados)            → .select().single()
  atualizarMovimentacao(id, upd)
  deletarMovimentacao(id)

Contas a Pagar:
  carregarCP()                          → ordered by data_vencimento ASC
  inserirCP(dados)                      → .select().single()
  atualizarCP(id, upd)
  deletarCP(id)

Categorias Dinâmicas (crm_categorias):
  carregarCategorias()                  → .eq('ativo', true), ordered by ordem
  inserirCategoria(dados)               → .select().single()
  atualizarCategoria(id, upd)
  deletarCategoria(id)                  → soft-delete: ativo = false

Métodos de Pagamento (crm_metodos_pagamento):
  carregarMetodos()                     → .eq('ativo', true), ordered by ordem
  inserirMetodo(dados)                  → .select().single()
  atualizarMetodo(id, upd)
  deletarMetodo(id)                     → soft-delete: ativo = false

Matemática pura (sem acesso ao banco):
  ehPago(g)                            → status_pagamento === 'Pago' (+ fallback legado booleano)
  deducoesDetalhadas(f)                → { mat, log, enc, maoInst, comVend, comArq, prevMat }
  calcDeducoes(f)                      → soma das deduções (sem prevMat)
  calcVariaveisMes(variaveis, mes, ano)
  calcValorReal(movimentacoes, leadIds) → entradas confirmadas não-parcela-cartão (usa valor_bruto || valor)
  calcFluxoCartao(movimentacoes, leadId)→ parcelas is_parcela_cartao ordenadas por data_vencimento
  calcSaidas(movimentacoes, leadIds)
  calcDRE(pedidos, fatMap, gastos, ano, aliq, variaveis, comprasMap) → DRE 12 meses
  calcFluxoSemanal(gastos, mes, ano)   → 5 buckets de semana para gastos fixos não pagos
  calcResumoMes(pedidos, fatMap, gastos, mes, ano, variaveis, comprasMap)
    → { receita, deducoesOS, variaveisMes, comprasMes, custosObras, fixosPagos, fixosPendentes,
        fixos, margem, lucroReal, lucroProjetado, pctFixos, pctVariaveis }
```

### 5.3 `comprasService` (fornecedores por OS + boletos)

```
OS com fornecedores aninhados:
  carregarOSComFornecedores()    → nested join: leads → compras_fornecedores_os → boletos_fornecedores
  carregarOSPorId(osId)          → idem para uma OS específica

Fornecedores:
  listarFornecedoresPorOS(osId)
  inserirFornecedor(dados)       → .select().single()
  atualizarFornecedor(id, upd)
  deletarFornecedor(id)          → CASCADE deleta os boletos
  toggleAutoOrgPorOS(osId, valor)→ liga/desliga auto_org em todos os fornecedores da OS

Boletos:
  listarBoletosPorFornecedor(fornecedorOsId)
  inserirBoleto(dados)           → .select().single()
  atualizarBoleto(id, upd)
  deletarBoleto(id)
  marcarPago(id, dataPagamento, formaPagamento, comprovanteUrl)

Storage de comprovantes:
  uploadComprovante(path, file, contentType)
  urlAssinadaComprovante(path, expiraSeg=3600)

View:
  carregarRelatorio()            → lê relatorio_despesas_os

Helpers puros:
  totalBoletos(boletos)
  totalPago(boletos)
  totalPendente(boletos)
  calcTotaisOS(fornecedores)     → { total, pago, pendente, atrasado } agregado da OS
  statusEfetivo(boleto)          → 'Pago' / 'Atrasado' / 'Pendente' (derivado no front)
```

### 5.4 `caixaService` (motor de projeção de caixa)

```
Config:
  carregarConfig()              → maybeSingle da config_caixa do usuário
  salvarConfig(dados)           → upsert por user_id

5 Fontes de dados:
  carregarEntradasPendentes()   → financeiro_movimentacoes (is_parcela_cartao, Pendente)
  carregarSaidasNativas()       → contas_a_pagar (≠ pago)
  carregarBoletosPendentes()    → boletos_fornecedores (≠ Pago)
  carregarGastosFixosPendentes()→ gastos_fixos (próx. 3 meses, ≠ Pago)
  carregarVariaveisPendentes()  → crm_gastos_variaveis (próx. 3 meses, ≠ Pago)

Motor matemático:
  calcPeso(dataVenc, hoje, config) → ICR: 0..1 baseado no aging da parcela
  calcProjecaoDiaria({config, entradasPendentes, saidasNativas,
                       boletosPendentes, gastosFixos, variaveisCP, janelaDias=60})
    → array de { data, idx, isHoje, entradas[], saidas[], totalEntradas,
                 totalSaidas, saldoAcumulado } (D+0 até D+janelaDias)
  calcKPIs(dias)
    → { aReceber30, aReceber60, aPagar30, aPagar60,
        saldo30, saldo60, diasNegativos[], primeiroNegativo, piorDia }

Helpers internos:
  _addDays(dateStr, n)
  _dataDeMesAno(dia, mes, ano)  → 'YYYY-MM-DD' (clipa dia ao 28 para evitar fim-de-mês inválido)
  _proxMeses(n)                 → { meses[], anos[] } para os próximos N meses
```

### 5.5 `auditService` (governança + alçadas)

```
Log:
  carregarLogs({ limite=50, tabela=null })  → audit_log_financeiro, desc por created_at
  formatarLog(log)                          → { op, tab, desc, valor, campos, data }

Alçadas:
  carregarAlcadas()                         → alcadas_aprovacao
  salvarAlcada(contexto, valorLimite, ativo)→ upsert por (user_id, contexto)
  getLimite(contexto, alcadas)              → número (0 = inativo)
  verificarAlcada(contexto, valor, alcadas) → boolean
```

### 5.6 `cobrancaService` (fila de cobrança)

```
Persistência:
  carregarTodas()                         → promessas_pagamento, desc por created_at
  registrar({ leadId, tipo, descricao, valorPrometido, dataPrometida })
  marcarStatus(id, status)               → .select().single()

Helpers puros:
  getPorLead(leadId, todas)              → filtra pelo lead_id
  getUltimoContato(leadId, todas)        → entrada mais recente de qualquer tipo
  getPromessaAtiva(leadId, todas)        → promessa pendente mais recente
  isQuebrada(promessa, hojeStr)          → boolean
```

---

## 6. MÓDULOS UI (JS)

### 6.1 `wizard-aprovacao.js` — Pipeline completo de Aprovação

**Estado interno:**
- `_aprvCurrentLead` — lead em edição no wizard
- `_wizParcelas[]` — condições de pagamento do passo 2
- `_wizAnexo` — objeto `{ name, type, size, base64, file }` do relatório técnico
- `_wizDesconto` — % de desconto aplicado
- `_cadEditId` — ID do cliente sendo editado (null = novo)
- `_cadLeadId` — lead vinculado ao cadastro técnico
- `_fromGerenciar` — flag para voltar à central de clientes após salvar
- `_clientesCache[]` — espelho local de `crm_clientes` (carregado ao boot)

**Mapeadores:**
- `_rowToCliente(r)` — linha do banco → objeto JS (inclui `responsavel_financeiro_nome`)
- `_clienteToRow(c)` — objeto JS → linha do banco (inclui `responsavel_financeiro_nome`)

**Fluxos:**
1. **Visita Técnica** (`abrirVisitaModal`, `salvarVisita`, `marcarVisitaConcluida`) — Modal de agendamento com upload de relatório da visita. Se agendada, abre automaticamente o Cadastro Técnico Antecipado.
2. **Cadastro Técnico Antecipado** (`abrirCadastroTecnico`, `salvarCadastroTecnico`) — Pré-cadastra cliente antes do orçamento ser aprovado. Propaga dados para o lead vinculado.
3. **Wizard de Aprovação 3 Passos** (`abrirAprovarModal`, `wizGoTo`, `confirmarAprovacao`):
   - Passo 1: OS + Documentação do cliente (CPF/CNPJ + `responsavel_financeiro_nome` para PF) + contato/endereço + desconto % + técnico + mídia
   - Passo 2: Parcelas (dual-mode % / R$, barra de progresso, validação de fechamento)
   - Passo 3: Relatório técnico + Resumo (preview antes de confirmar)
4. **Central de Clientes** (`abrirGerenciarClientes`, `renderListaClientes`, `editarClienteRecorrente`, `excluirClienteRecorrente`) — CRUD completo.

**Edit mode (hidratação):**
- `_preencherCadModal(c)` — popula o formulário do Cadastro Técnico (inclui `responsavel_financeiro_nome` para CPF).
- `selecionarClienteRecorrente(id)` — popula o formulário do Wizard (inclui `responsavel_financeiro_nome` para CPF).
- `_preencherDadosLead(lead)` — popula o Wizard a partir de dados do lead já existente.

**Reset:** `_aprvReset()` limpa todos os campos incluindo `#aprov-responsavel-financeiro`.

### 6.2 `ficha-pdf.js` — PDF da Ficha de Pedido

Gera PDF de **3 páginas A4 landscape** via html2canvas + jsPDF (jsdelivr):
1. **Página 1 — Ficha OS:** dados do cliente, pagamentos (parcelas com datas), instalação, contato, técnico, mídia
2. **Página 2 — Termo de Garantia**
3. **Página 3 — Relatório Técnico:** descritivo (`ficha_descritivo` JSONB), 2 fotos do Storage (signed URL → base64), painel lateral rotacionado

**Entrada:** `gerarFichaPDF(pedido)` — pedido enriquecido com dados do modal pré-PDF.
**Logo:** `assets/icon-conceito.png` (ocultada se ausente).
**Fotos:** carregadas via `urlAssinadaRelatorio(path) → base64` antes de montar o PDF.

---

## 7. FUNCIONALIDADES POR TELA

### 7.1 `index.html` — Pipeline & Visitas & Clientes

**Pipeline Kanban:**
- Drag-and-drop com SortableJS → atualiza `leads.order_index` via `crmService.atualizarOrdem()`.
- Filtros por status, vendedor, busca livre.
- Ação de aprovação: botão "✓ Aprovar" → `abrirAprovarModal(leadId)`.

**Calendário de Visitas Técnicas:**
- Toggle Pipeline / Calendário (sempre visível).
- FullCalendar v6 — eventos com cor por status.
- Ficha de visita: WhatsApp (`wa.me/55...`), Google Maps (`maps.google.com/?q=...`), Waze (`waze.com/ul?q=...&navigate=yes`).
- Upload de relatório da visita (PDF/imagem, máx. 10 MB, bucket privado).
- Relatório da visita é herdado automaticamente pelo pedido (campo `relatorio_tecnico_url`) se o wizard não anexar um novo.

**Central de Clientes Recorrentes:**
- Modal `#gerenciar-clientes-modal` — CRUD + busca `.ilike()` server-side.
- Botão "+ Novo Cliente" abre o Cadastro Técnico sem vínculo de lead (`leadId = null`).

**Wizard de Aprovação (ver §6.1):**
- Passo 1 inclui: **N2** Desconto %, **N3** Técnico Responsável (obrigatório), **N4** Mídia/Origem.
- Persistência: `dados.parcelas` salvo em JSONB `leads.parcelas`.
- Herança de relatório técnico: se a visita já tinha relatório e o wizard não anexou novo → `relatorio_tecnico_url = visita_relatorio_path`.

**Validações CPF/CNPJ:** módulos `validarCPF()` e `validarCNPJ()` com checagem de dígitos verificadores. Feedback visual imediato. Autocomplete por CPF/CNPJ: ao digitar um número válido, busca cliente existente e pré-preenche o formulário.

**Responsividade:** `@media(max-width: 640px)` — body padding reduzido, modais 96vw, grids em 1 coluna.

### 7.2 `faturamento.html` — Núcleo Financeiro (4 abas + botões de módulos)

**Cabeçalho:** botões **📈 Caixa** (abre `caixa.html`) e **📋 Governança** (abre modal `#gov-modal`).

**Aba 📊 Visão Obras:**
- Tabela de todos os pedidos com KPIs de lucro/margem por OS.
- Custo por OS = `calcDed(fatMap[p.id]) + comprasDe(p.id) + variaveisDe(p.id)`.
  - `calcDed()` = deduções da tabela `faturamento`
  - `comprasDe()` = total de boletos de fornecedores (`_comprasMap`)
  - `variaveisDe(leadId)` = soma de `crm_gastos_variaveis` onde `pedido_id = leadId` (inclui taxa de cartão)
- Ícone 🔍 Auditoria (modal por OS com breakdown de custos + gráfico doughnut).
- Ícone 🔢 Custos (modal `calcularModal` com linha "💳 Custos Variáveis" visível quando > 0).
- Ícone 📋 Ficha OS (resumo financeiro com linha "💳 Custos Variáveis da OS").
- Botão **📄 Gerar PDF** → `ficha-pdf-modal` pré-PDF → `gerarFichaPDF()`.
- KPIs do topo: Total de Pedidos, Faturamento, Custo Total, Lucro, Margem %, Valor Real Recebido.

**Aba 🏢 Gastos Fixos:**
- Listagem agrupada por categoria com subtotais.
- Navegação por mês/ano com projeção automática de recorrentes.
- **Recorrência por série (`serie_id`):** "Replicar" gera cópias do mês atual até dezembro. Editar/Excluir oferece escopo: *Apenas este mês / Este e os próximos / Todos* (preserva meses já PAGOS).
- Baixa: `status_pagamento = 'Pago'` → modal `gf-pay-modal` captura data real + conta/forma + comprovante.
- Alertas: `verificarContasVencendo()` dispara toast quando há contas vencidas ou vencendo em 3 dias.

**Aba 📉 Gastos Variáveis:**
- Formulário com `<select>` de categoria (`<optgroup>`) + vínculo com OS (`pedido_id`).
- Card "Índice de Variabilidade" = `Total Variáveis do Mês / Faturamento do Mês × 100`.
- Alterações chamam `renderPorMes()` (não só `renderVariaveis()`) — garante que Visão Obras atualize.

**Aba 📋 Contas a Pagar (Tesouraria Operacional):**
- `capBuildUnified()` agrega 4 fontes: `contas_a_pagar` (CP), boletos fornecedores, gastos fixos, gastos variáveis.
- KPIs: Total Vencido, A Vencer Mês, Total Pago Mês, Projeção 7 Dias.
- Filtros: Todos / Vencido / Esta Semana / Este Mês / Pago.
- Views: Lista (com checkboxes) + Calendário mensal.
- Baixa individual: modal `#cap-baixa-modal` com campos data/forma/valor pago/comprovante. Split automático se `valor_pago < valor_original`.
- Seleção em massa: checkbox no header → "Liquidar Selecionados" (N=1 → modal individual; N>1 → `prompt()` de forma → batch).
- Nova conta: modal `#cap-nova-modal` com vínculo opcional de obra.

**Modal de Governança (`#gov-modal`) — 2 abas:**
- **Log de Operações:** últimos 50 registros de `audit_log_financeiro` com formatação via `auditService.formatarLog()`.
- **Alçadas:** configura `valor_limite` e `ativo` por contexto. Trava 🔐 (`#alcada-overlay`, z-index 1100) intercepta baixas acima do limite.

**Cobertura da trava de alçada — 4 caminhos:**

| Caminho | Função | Contexto | Refresh pós-baixa |
|---|---|---|---|
| Conta a Pagar (CP) | `confirmarCapBaixa` | `baixa_cap` | `loadCP()` + `renderCP()` |
| Boleto Fornecedor | `_confirmarFornBaixa` | `baixa_forn` | `loadBoletosCP()` + `renderCP()` |
| Gasto Fixo / Variável | `confirmarPagamento` | `baixa_cap` | `renderCP()` |
| Liquidação em massa | `liquidarSelecionados` | `baixa_cap` (maior item do lote) | `renderCP()` |

> **`_alcadas` é carregado com `await` no `carregar()`** — evita race condition (trava não disparava antes do fetch resolver).

### 7.3 `pedidos.html` — Controle de Pedidos + Recebíveis + Cobrança

**4 abas:**
- **Ver Todos:** lista de pedidos com filtros de busca/status OS/vendedor e ordenação.
- **Visão Anual / Visão Mensal:** agrupamentos com KPIs.
- **💰 Contas a Receber (Aging List):** status derivado por pedido — Quitado excluído; Atrasado / Parcialmente Pago / Pendente. Filtros: busca, status, datas de vencimento. KPIs: Total a Receber, Saldo Vencido, Clientes Parciais, Clientes em Dia.

**Ações por pedido:**
- **✏️ Visualizar/Editar:** modal com abas Ver (dados + parcelas + saldo + observações + relatório técnico) e Editar (campos + editor completo de parcelas com dual-mode). Nº da OS é editável — alerta `confirm()` se OS duplicada.
- **🔄 OS:** modal de controle de status (`status_os`): Em andamento / Aguardando / Congelada (motivo obrigatório) / Concluída.
- **💰 Fluxo:** modal de caixa da OS. 4 KPI cards: "A Receber (cliente)", "Já Recebido", "Pend. Cartão" (roxo), "Conf. Cartão" (verde). Seção de cronograma de cartão (`#caixa-cartao-wrap`) com grupos por `parcela_parent_id`, botão "✓ Confirmar" por parcela, botão "⚡ Antecipar" por grupo.

**Fila de Cobrança (extensão da aba Contas a Receber):**
- 3 cards prioritários no topo: Promessas Quebradas 🔴, Vencem em 3 dias 🟡, Atrasados s/ Contato 🟠.
- Badge de promessa em cada linha da Aging List.
- Botão 📞 Cobrar → modal `#cobranca-modal` com abas 📝 Contato / 🤝 Promessa + histórico com ações ✓ Cumprida / ✗ Quebrada.

**KPIs gerais:** Total de Pedidos, Valor Total dos Contratos, Valor Real Recebido (com barra de progresso), A Receber.

### 7.4 `compras.html` — Compras & Fornecedores

**Aba 📋 Compras por Obra:** accordion OS → fornecedores → boletos. CRUD completo via `comprasService`. KPIs. Modal de pagamento com comprovante. Toggle `auto_org` por OS (reordena automaticamente boletos atrasados ao topo).

**Aba 💸 Contas a Pagar (legado):** dashboard mobile-friendly — KPIs (A Pagar no Mês, Atrasadas em vermelho, Vencem em 7 dias, Pago no Mês), gráficos doughnut/barras. Navegação mês ‹ › + filtro por dia de vencimento + filtro de status. Cards de boletos com `statusEfetivo()` derivado no front.

### 7.5 `caixa.html` — Motor de Projeção de Caixa

Projeção diária D+0→D+60 via `caixaService`. Gráfico de linha (Chart.js) + tabela dia a dia. Painel de configuração do saldo inicial e pesos ICR. KPIs: dias negativos, primeiro dia negativo (alerta de ruptura), pior dia, A Receber / A Pagar em 30 e 60 dias, Saldo em D+30 e D+60.

### 7.6 `relatorios.html` — Relatórios Mensais

Relatórios Chart.js: funil de vendas, ranking de vendedores, rankings de produtos. Gráfico de **Breakeven** (receita × custos de obras × gastos fixos × lucro projetado).

---

## 8. REGRAS DE NEGÓCIO & LÓGICA FINANCEIRA

### 8.1 Schema de Parcelas (JSONB `leads.parcelas`)

```json
{
  "metodo": "Pix",
  "pct": 50.0,
  "valor_reais": 5000,
  "condicao": "Sinal",
  "vencimento": "2026-07-01",
  "modo": "pct"
}
```
- `pct` sempre salvo (back-calculado se usuário digitou R$).
- `valor_reais` sempre salvo (calculado de `Math.round(val × pct/100)` se usuário digitou %).
- Parcelas antigas sem `valor_reais` → fallback para `Math.round(valor × pct/100)` na leitura.
- **Dual-mode % / R$** por parcela: botão toggle `[%]` / `[R$]` converte automaticamente.
- **Validação:** `sum(valor_reais) === valorFinal` (inteiros). NÃO usa `sum(pct) === 100` — evita falso positivo por float.

### 8.2 Modelo Split Cartão de Crédito

3 artefatos criados por `confirmarCartaoModal()` em `pedidos.html`:

**Camada 1 — Entrada-resumo** (zeroa saldo do cliente imediatamente):
```
financeiro_movimentacoes {
  is_parcela_cartao = false
  valor = valor_bruto = R$ 10.000
  valor_liquido = R$ 9.700
  taxa_cartao_valor = R$ 300
  status = 'Confirmado'
}
```

**Camada 2 — Cronograma de recebíveis** (N parcelas líquidas):
```
financeiro_movimentacoes {
  is_parcela_cartao = true
  parcela_parent_id = id_da_entrada_resumo
  valor = R$ 3.233,33 (líquido / N)
  status = 'Pendente'  → 'Confirmado' quando a operadora deposita
  data_vencimento = datas mensais calculadas
}
```

**Camada 3 — Custo operacional** (DRE absorve automaticamente):
```
crm_gastos_variaveis {
  categoria = 'Despesa Financeira'
  descricao = 'Taxa de Cartão — <descrição>'
  valor = R$ 300
  pedido_id = leadId
  status = 'Pago'
}
```

**Antecipação (`confirmarAntecipacao()`):**
1. Informa taxa % da antecipação.
2. Parcelas Pendentes do grupo → `antecipada=true, status='Confirmado'`.
3. Taxa R$ injetada em `crm_gastos_variaveis` (categoria `'Despesa Financeira'`).

**Retrocompatibilidade:** `is_parcela_cartao DEFAULT FALSE` → registros antigos comportam-se como entradas normais. `valor_bruto || valor` em `calcValorReal()` garante cálculo correto.

**`valRecebido(leadId)`:** `!is_parcela_cartao && status === 'Confirmado'`, soma `valor_bruto || valor`.

### 8.3 DRE — Demonstração do Resultado

`financeiroService.calcDRE(pedidos, fatMap, gastos, ano, aliq, variaveis, comprasMap)`:

```
(+) Faturamento Bruto           → soma dos pedidos do ano por data_aprovacao
(-) Impostos sobre Vendas       → aliq% (default 0)
(=) Faturamento Líquido
(-) Custos Diretos de Obras     → deduções das OS + gastos variáveis + boletos de fornecedores
(=) Margem de Contribuição
(-) Gastos Fixos
(=) Lucro Líquido Operacional
```

> ⚠️ O modal `#dre-modal` foi removido de `faturamento.html` em 2026-06-16. A matemática permanece em `financeiroService.js` para uso futuro em tela gerencial dedicada.

### 8.4 Motor de Caixa — ICR (Índice de Confiabilidade de Recebimento)

`caixaService.calcPeso(dataVenc, hoje, config)`:
- Em dia / a vencer → `peso_em_dia / 100` (padrão: 100%)
- Atraso 1–30 dias → `peso_atraso_1_30 / 100` (padrão: 70%)
- Atraso 31–60 dias → `peso_atraso_31_60 / 100` (padrão: 40%)
- Atraso > 60 dias → `peso_atraso_60plus / 100` (padrão: 0%)

**Apenas entradas são ponderadas.** Saídas entram pelo valor cheio. Parcelas vencidas → puxadas para D+0.

### 8.5 Governança & Alçadas

- `_alcadas` carregado com `await` no `carregar()` — sem race condition.
- `_alcadaBypass` (bool): pula a checagem na segunda entrada após o usuário confirmar.
- `_alcadaCallback` (fn): armazena a função a re-executar após confirmação.
- Overlay `#alcada-overlay` tem z-index **1100** (acima de todos os modais, z-index 1000).
- `baixa_cap` → governa CP + gastos fixos + gastos variáveis + liquidação em massa.
- `baixa_forn` → governa boletos de fornecedores.

### 8.6 Recorrência de Gastos Fixos (Série)

- `serie_id` (UUID gerado no front) agrupa todas as cópias mensais do mesmo gasto recorrente.
- `garantirSeriesDoAno()` — garante replicação automática até dezembro ao virar o ano.
- Editar/Excluir por escopo: *Apenas este mês / Este e os próximos / Todos* — operações em massa **preservam meses já com status 'Pago'**.

---

## 9. PADRÕES DE CÓDIGO & DIRETRIZES

### 9.1 Padrões inegociáveis

- **`Math.round()` em todos os valores monetários** — nenhum valor em centavos fracionários.
- **Toda operação assíncrona Supabase em `try/catch`** com feedback via `toast(msg, type)` (`'ok'` | `'err'` | `'warn'`).
- **Acesso a dados somente via serviços.** Nenhum `db.from()` solto no HTML ou inline.
- **Validar fechamento de tags HTML** antes de entregar qualquer alteração em HTML.
- **Variáveis CSS do `:root` sempre.** Nunca introduzir cores hardcoded.
- **RLS em toda nova tabela** — policy `TO authenticated`, nunca `USING(true)` para anon.
- **Bucket Storage sempre PRIVADO** — signed URLs de 1h. Nunca expor dados de cliente publicamente.
- **`service_role` key NUNCA no front-end.**

### 9.2 Quando houver mudança de banco

1. Entregar o SQL completo pronto para copiar no Supabase SQL Editor.
2. Usar `IF NOT EXISTS` / `DROP POLICY IF EXISTS` para idempotência (pode reexecutar).
3. Avisar claramente que deve ser executado **antes** de testar.
4. Mudanças que apertam RLS seguem a ordem: criar usuário → testar login → rodar SQL.

### 9.3 Atualização deste arquivo

**Sempre atualizar `CONTEXTO_SISTEMA.md` ao final de cada evolução:** novas tabelas, colunas, telas, funções, regras de negócio ou correções. Este é o único documento de referência do sistema — mantê-lo vivo é obrigatório.

### 9.4 Segurança LGPD

Relatórios técnicos e comprovantes de pagamento contêm PII → bucket `relatorios-tecnicos` **privado**, acesso sempre via `createSignedUrl(path, 3600)` (URL temporária de 1h). A coluna do banco guarda somente o **caminho** (path), nunca a URL. Leitura via `abrirAnexoTecnico(path)` que gera a URL sob demanda.

### 9.5 Processo recomendado para novas features

1. Planejar e apresentar o impacto em banco + UI antes de executar.
2. SQL primeiro → testar no banco → depois o front-end.
3. Atualizar `CONTEXTO_SISTEMA.md` ao finalizar.
4. Entregar resumo conciso (tabela ou lista) do que foi modificado.
