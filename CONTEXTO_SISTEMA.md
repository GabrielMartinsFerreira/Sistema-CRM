# 🧠 ARQUIVO DE CONTEXTO DEFINITIVO — GG TECH CRM (Conceito Vidros & Projetos)
> System Prompt / Context File para uso em futuras conversas com IAs.
> Última atualização: 2026-06-17 (**Governança + Caixa + Cobrança**: **P1/P2** Motor de Projeção de Caixa — `caixa.html` + `caixaService.js`; **P3** Auditoria imutável (`audit_log_financeiro`) e Alçadas de aprovação (`alcadas_aprovacao`) com trava 🔐 cobrindo os **4 caminhos de baixa** (CP, boleto fornecedor, gasto fixo/variável e liquidação em massa); **P4** Fila de Cobrança + Promessas de Pagamento — `promessas_pagamento` + `cobrancaService.js`. Correção: **toda baixa atualiza a tabela unificada na hora** — `loadCP`/`loadBoletosCP`/`renderCP` após salvar, sem precisar de F5.) · Mantido vivo a cada evolução do sistema.

---

## 1. PERFIL DO USUÁRIO & ESPECIFICAÇÕES

- **Quem sou:** Gabriel — gestor/empreendedor à frente da **Conceito Vidros & Projetos**, uma vidraçaria (vidros temperados, esquadrias e projetos sob medida). Atuo na ponta comercial e operacional do negócio (orçamentos, pedidos, obras, finanças).
- **O que faço com a IA:** estou construindo e evoluindo, sozinho, o meu próprio CRM/ERP comercial e financeiro — apelidado de **GG TECH CRM**.
- **Background técnico:** perfil **hands-on**, não-iniciante. Edito o código diretamente (HTML/CSS/JS puro), rodo migrations SQL no **Supabase SQL Editor**, subo o sistema localmente com `npx serve` e testo no navegador. Entendo conceitos de banco (tabelas, RLS, policies, Storage), front-end (DOM, Chart.js) e regras financeiras (DRE, margem, fluxo de caixa).
- **Como trabalho:** peço features completas e detalhadas, valido por etapas, gosto de receber o **SQL pronto para copiar** e de confirmar que tudo funciona no banco antes de seguir.

---

## 2. ESCOPO DO SISTEMA ATUAL

### 2.1 Stack & Arquitetura
- **Front-end:** HTML/CSS/JS **puro (Vanilla JS)**, sem frameworks. Design system próprio via variáveis CSS no `:root` (`--bg-card`, `--bg-card2`, `--border`, `--accent`, `--green`, `--red`, `--yellow`, `--orange`, `--text`, `--text-dim`, `--text-muted`, `--green-dim`, `--yellow-dim`, `--red-dim`). Tema **escuro**.
- **Back-end:** **Supabase** (cliente JS via CDN `@supabase/supabase-js@2`), autenticação **anon key + RLS** (Row Level Security) com policies liberadas para o app interno.
- **Gráficos:** Chart.js. **Calendário:** FullCalendar v6. **Drag-and-drop:** SortableJS.
- **Execução:** servido por `npx serve -l 3456 .` (também funciona em `file://`).

### 2.2 Arquitetura modular (refator concluído — abordagem híbrida)
Scripts clássicos `<script src>` que populam globais com namespace (sem `type="module"`, para não quebrar os ~74 handlers `onclick` inline e manter compatibilidade com `file://`):
```
js/
├── core/
│   ├── utils.js        # esc, brl, fmtDate, badgeClass, num, toast (+ window.Utils)
│   ├── supabase.js     # db, TABLES{LEADS,FATURAMENTO,CLIENTES,GASTOS,VARIAVEIS,MOVIMENTACOES}, STORAGE_BUCKET
│   └── auth.js         # Supabase Auth: tela de login + window.authGate() + botão Sair
├── services/
│   ├── crmService.js          # TODAS as queries de leads/clientes/storage
│   ├── financeiroService.js   # dados de pedidos/faturamento/gastos + MATEMÁTICA PURA (DRE, breakeven, fluxo, resumo) + CP + métodos de pagamento dinâmicos
│   ├── comprasService.js      # fornecedores por OS + boletos + view relatorio_despesas_os
│   ├── caixaService.js        # P1/P2 — projeção de fluxo de caixa (entradas×ICR − saídas) + config_caixa
│   ├── auditService.js        # P3 — leitura do audit_log_financeiro + gestão de alcadas_aprovacao (limites de baixa)
│   └── cobrancaService.js     # P4 — promessas_pagamento (contatos + promessas por lead/OS)
└── modules/
    ├── wizard-aprovacao.js    # UI de visita + cadastro técnico + wizard de aprovação (3 passos)
    └── ficha-pdf.js           # Ficha de Pedido PDF 3 páginas (html2canvas + jsPDF) — só no faturamento
```
**Ordem de carga:** utils → supabase → **auth** → crmService → financeiroService → (comprasService) → script inline → (wizard, só no index; ficha-pdf, só no faturamento).
**CDNs:** apenas `cdn.jsdelivr.net` (CSP do vercel.json) — Chart.js, html2canvas@1.4.1, jspdf@2.5.1.
**Regra de ouro:** scripts clássicos compartilham escopo global; nunca redeclarar `db`/`const` do core dentro do inline (causa SyntaxError). Nenhuma chamada `db.from`/`createClient` deve existir nos HTML — tudo passa pelos serviços.

### 2.3 Banco de dados (Supabase)
- **Tabelas:** `leads`, `faturamento`, `crm_clientes`, `gastos_fixos`, `crm_gastos_variaveis`, `financeiro_movimentacoes`, **`compras_fornecedores_os`** (fornecedores vinculados à OS, FK→leads CASCADE), **`boletos_fornecedores`** (boletos por fornecedor, status Pendente/Pago/Atrasado, FK→compras CASCADE), **`contas_a_pagar`** (tesouraria — ver §2.6), **`crm_metodos_pagamento`** (formas de pagamento dinâmicas).
- **Tabelas de Governança & Operação (2026-06):** **`config_caixa`** (saldo inicial + parâmetros do motor de projeção — P1/P2, ver §2.8), **`audit_log_financeiro`** (trilha **imutável append-only** de INSERT/UPDATE/DELETE em CP e boletos, gravada **só por triggers Postgres** — P3, ver §2.9), **`alcadas_aprovacao`** (limites de aprovação por contexto `baixa_cap`/`baixa_forn` — P3), **`promessas_pagamento`** (contatos e promessas de pagamento por lead — P4, ver §2.10). Todas com **RLS `user_id = auth.uid()`**; o audit log **não tem policy de UPDATE/DELETE** (imutável). Migrations: `2026-06-16_config_caixa.sql`, `2026-06-16_auditoria.sql`, `2026-06-17_promessas_pagamento.sql`.
- **View `relatorio_despesas_os`** (com `security_invoker = true` — respeita RLS): agrega por OS qtd fornecedores, total lançado/pago/pendente/atrasado, lucro bruto e margem %. Função `atualizar_boletos_atrasados()` marca vencidos.
- **Campos da Ficha PDF em `leads`:** `endereco_numero`, `cidade`, `estado`, `ficha_descritivo` (JSONB {item,vidro,estrutura,outros}), `ficha_foto1_path`, `ficha_foto2_path` (paths no bucket privado).
- **Storage:** bucket **PRIVADO** `relatorios-tecnicos` (relatórios contêm PII → LGPD). A coluna `leads.relatorio_tecnico_url` guarda o **caminho**, não a URL; a leitura usa `createSignedUrl(path, 3600)` (URL temporária de 1h).
- **Migração histórica:** `localStorage` foi 100% removido → tudo persiste no Supabase. Parcelas do wizard ficam em `leads.parcelas` (JSONB).
- **Campos em `leads`:** `status_os` (TEXT, default 'Em andamento'), `motivo_congelamento` (TEXT), `visita_relatorio_path` (TEXT), `observacoes` (TEXT), `desconto_pct` (NUMERIC 5,2, default 0), `tecnico_responsavel` (TEXT), `midia_origem` (TEXT).
- **`crm_clientes` — campo adicionado (2026-06-29):** `responsavel_financeiro_nome` (TEXT, opcional). Capturado somente para Pessoa Física (CPF). Usado em emissão de contratos, NF e réguas de cobrança secundárias quando o pagador da obra difere do titular do CPF. Migração: `2026-06-29_responsavel_financeiro.sql`. UI: campo no modal "Cadastro Técnico" (`#cad-responsavel-financeiro`) e no Wizard de Aprovação Step 1 (`#aprov-responsavel-financeiro`). Edit mode hidrata automaticamente em `_preencherCadModal()` e `selecionarClienteRecorrente()`.

### 2.3.1 🔐 SEGURANÇA (RLS + Auth — validado por pentest)
- **Login obrigatório (Supabase Auth, e-mail/senha).** `js/core/auth.js` faz o gate: cada loader de página chama `await authGate()` antes de buscar dados. Sem sessão → mostra tela de login e **não carrega nada**.
- **Usuários:** um por pessoa, criados **só no painel** (Authentication → Users, com *Auto Confirm*). **Signup público DESATIVADO**.
- **RLS ligado em todas as 5 tabelas.** Policies migradas de `USING(true)` (qualquer um) → **`FOR ALL TO authenticated USING(true) WITH CHECK(true)`** (só usuário logado). Storage idem (`TO authenticated`).
- **anon key é pública** (fica no front) — isso é OK **porque** o RLS+Auth a tornam inútil sozinha. **NUNCA** usar a `service_role` key no front-end (ignora RLS).
- **Pentest (2026-06-07):** simulado atacante com a anon key sem login → leitura negada (0 linhas), INSERT negado (401) em todas as tabelas, Storage privado e sem listagem/upload anônimo, signup off, nenhuma service_role no código. **Resultado: 0 vulnerabilidades.**
- **Ordem segura ao apertar RLS (evitar lockout):** criar usuário → testar login → só então rodar o SQL que troca as policies para `authenticated`.
- **Deploy:** hospedado na **Vercel** (`sistema-crm-eosin.vercel.app`). `vercel.json` na raiz envia os cabeçalhos de segurança (CSP, X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy, Permissions-Policy, HSTS). CSP precisa de `'unsafe-inline'` em script/style (o app usa scripts e handlers inline — abordagem híbrida). connect-src libera `*.supabase.co` (https+wss) e `viacep.com.br`; script-src libera `cdn.jsdelivr.net`; fontes do Google.
- **Falso positivo de antivírus (Kaspersky):** alerta de "vazamento" em domínio novo = heurística por (a) anon JWT visível no JS (pública por design) e (b) campo de senha. Não é vazamento real — pentest = 0 vulnerabilidades e sem service_role exposta.
- **Pendências de hardening (recomendado ao hospedar):** Leaked Password Protection ON, senha mínima ≥10, MFA opcional, servir só por HTTPS, definir Site URL, conferir aba Advisors→Security, backups automáticos.

### 2.4 Arquivos / Telas
- **`index.html`** — Pipeline/funil de vendas (kanban em tabela com drag-and-drop), Calendário de Visitas Técnicas (toggle Pipeline/Calendário sempre visível; ficha da visita com **WhatsApp + Google Maps + Waze** `https://www.waze.com/ul?q=...&navigate=yes`), Central de Clientes Recorrentes (CRUD + busca `.ilike` + autocomplete por CPF/CNPJ), Wizard de Aprovação de pedido (3 passos: cadastro → pagamento/parcelas → relatório técnico). **Passo 1 inclui:** Desconto % (N2 — calcula valor final com `Math.round`, salva `desconto_pct` e `valor` arredondado), Técnico Responsável (N3 — obrigatório, salva `tecnico_responsavel`), Mídia/Origem (N4 — opcional, salva `midia_origem`).
- **Responsividade:** os 3 HTML têm bloco `@media(max-width:640px)` (+400px) — body padding reduzido, abas/tabelas roláveis na horizontal, grids/forms em 1 coluna, modais 96vw, ficha de visita empilha botões. Mobile e desktop no mesmo arquivo (sem app separado).
- **`faturamento.html`** — Núcleo financeiro com **4 abas**: **📊 Visão Obras**, **🏢 Gastos Fixos**, **📉 Gastos Variáveis** e **📋 Contas a Pagar** (Tesouraria Operacional — veja §2.6). No cabeçalho há também os botões **📈 Caixa** (abre `caixa.html` — §2.8) e **📋 Governança** (modal de Auditoria + Alçadas — §2.9). *(DRE Comparativa, Health Dashboard e Gráfico de Fluxo Semanal foram migrados para tela gerencial futura — removidos em 2026-06-16.)*
  - **Recorrência por série (`serie_id`):** gasto fixo com "Replicar" gera a série do mês atual até dezembro (mesma `serie_id`); continua no virar do ano (`garantirSeriesDoAno`). **Editar/Excluir** abre diálogo de escopo: *Apenas este mês / Este e os próximos / Todos* (operações em massa **preservam meses já PAGOS**).
  - **Baixa (fixos e variáveis):** status Pendente/Agendado/Pago (Atrasado derivado). Marcar "Pago" abre modal `gf-pay-modal` capturando **Data de Pagamento Real + Conta/Forma + Comprovante**. Upload de imagem/PDF vai p/ bucket privado `relatorios-tecnicos` prefixo `comprovantes/`; URL aberta via `abrirAnexoTecnico()` (signed URL).
  - **Ficha OS → 📄 Gerar PDF** *(2026-06-12 — substituiu o window.print e os toggles de impressão)*: botão único abre o **modal pré-PDF** (`ficha-pdf-modal`) que confere/completa dados (contato, mídia, consultor, técnico, nº/cidade/UF, datas, descritivo técnico, 2 fotos) — **salva tudo no lead** e chama `gerarFichaPDF(pedido)` (`js/modules/ficha-pdf.js`). PDF de **3 páginas A4 landscape**: OS (cliente+pagamentos+instalação), Termo de Garantia, Relatório Técnico (descritivo+fotos+painel lateral rotacionado). Fotos: bucket privado → signed URL → base64. Logo opcional em `assets/icon-conceito.png` (oculta-se se ausente).
  - **🛒 Custos Reais (Compras)** *(2026-06-12)*: boletos de fornecedores (`relatorio_despesas_os.total_despesas_lancadas`) entram **automaticamente** como dedução em: KPIs, tabela de obras (lucro/margem), Ficha OS (linha própria), Auditoria, Health Dashboard (`calcResumoMes` param `comprasMap`) e DRE (`calcDRE` param `comprasMap`). Mapa `_comprasMap[os_id]` carregado no `Promise.all` do `carregar()`.
- **`caixa.html`** *(nova, 2026-06-16 — P1/P2)* — **Motor de Projeção de Fluxo de Caixa** (§2.8): a partir do **saldo inicial** (`config_caixa`) projeta o caixa futuro somando recebíveis ponderados pelo **ICR** (Índice de Confiabilidade de Recebimento, por aging) e subtraindo as obrigações de Contas a Pagar. Gráfico de linha (Chart.js) + tabela de fluxo dia a dia. Alimentado por `caixaService.js`. Acessível pelo botão 📈 Caixa no `faturamento.html`.
- **`pedidos.html`** *(nova, 2026-06-08; evoluída 2026-06-15)* — **Controle de Pedidos e Fluxo Financeiro**: lista todos os pedidos (`leads` com `status='Pedido'`), ordenados por **maior valor por padrão**; filtros de busca, status OS e vendedor; botões de sort (valor, data, cliente, recebido). **4 abas de visão:** Ver Todos, Visão Anual, Visão Mensal e **💰 Contas a Receber** (Aging List — ver §2.7). Três ações por linha:
  - **✏️ Visualizar/Editar:** modal com tabs "Ver" (todos dados, parcelas com `valor_reais`, saldo, observações, relatório técnico) e "Editar" (todos os campos + **editor completo de parcelas** com dual-mode % / R$, barra de progresso em tempo real, add/remove linhas). **Nº da OS é editável** *(2026-06-12)* — corrige duplicidade, cancelamento/renovação e erros de digitação sem excluir o pedido; ao salvar, alerta com `confirm()` se outra OS igual já existir (case-insensitive) e o toast mostra `OS alterada: antiga → nova`. Código do Orçamento permanece readonly. Botões: **🗑 Excluir Pedido** e **🗑 Remover Relatório**. `salvarEdicao()` persiste parcelas normalizadas no JSONB `leads.parcelas`.
  - **🔄 OS:** modal de controle com 4 cards de status (`Em andamento` / `Aguardando` / `Congelada` → motivo obrigatório / `Concluída`). Salva em `leads.status_os` e `leads.motivo_congelamento`.
  - **💰 Fluxo:** modal de caixa mostrando parcelas contratadas (JSONB) + movimentações registradas (`financeiro_movimentacoes`). Botão "Reg." em cada parcela pré-preenche o form. Permite upload de comprovante PIX (bucket privado, signed URL).
  - **KPIs:** Total de Pedidos, Valor Total dos Contratos, **Valor Real Recebido** (entradas confirmadas, exclui parcelas-cartão) com barra de progresso, A Receber.
  - **Modal de Caixa — 4 KPI cards:** "A Receber (cliente)", "Já Recebido", "Pend. Cartão" (roxo — soma das parcelas pendentes), "Conf. Cartão" (verde — parcelas liquidadas/antecipadas).
  - **Cronograma de Cartão** (`#caixa-cartao-wrap`): agrupado por entrada-resumo, exibe bruto/taxa/líquido por grupo, botão "✓ Confirmar" por parcela pendente, botão "⚡ Antecipar" para antecipar todas as pendentes de uma vez (ver §3.4.3).
- **`relatorios.html`** — Relatórios mensais (Chart.js): funil, vendedores, rankings, e o gráfico de **Breakeven** (receita × custos × gastos × lucro).
- **`compras.html`** — **Compras & Fornecedores** com 2 abas:
  - **📋 Compras por Obra:** accordion OS → fornecedores → boletos (CRUD completo); KPIs; modal de pagamento com comprovante (bucket privado + signed URL); `auto_org`.
  - **💸 Contas a Pagar** *(2026-06-12)*: dashboard mobile-friendly — KPIs (A Pagar no Mês, **Atrasadas em destaque vermelho**, Vencem em 7 dias, Pago no Mês), gráficos Chart.js (doughnut por status + barras por fornecedor top 8), navegação por mês ‹ › + **filtro por dia específico de vencimento** + filtro de status. Lista em cards (sem scroll horizontal): atrasados com borda vermelha, "vence hoje" em amarelo, botão ✓ Pagar reutiliza o modal de pagamento. Status `Atrasado` derivado no front via `statusEfetivo()` (vencimento < hoje e não pago).

### 2.5 Módulo de Gastos Fixos (estrutura validada)
- **Categorias de negócio (fixas):**
  - 🏢 **Infraestrutura** (Aluguel, IPTU, Água/Esgoto, Energia, Telefone, Internet)
  - 👥 **Pessoal** (Folha, Pró-labore, FGTS/INSS, Benefícios, Vale-Transporte/Refeição)
  - ⚙️ **Serviços** (Software/SaaS, Contador, Limpeza, Manutenção, Segurança, Consultoria)
  - 📣 **Marketing/Financeiro** (Anúncios, Taxas Bancárias, Juros/IOF, Material Gráfico)
- **Lógica de Subtotais:** a listagem agrupa as despesas por categoria, exibe **Subtotal por categoria** e um **Total do mês** (com destaque do valor já **Pago** vs **Total**).
- **Recorrência:** flag “Fixar Próx. Meses” (`fixar_proximo`) — ao navegar para um mês sem lançamentos, o sistema **projeta automaticamente** os recorrentes como `Pendente` (provisão), sem afetar o pagamento do mês anterior (cada mês tem sua própria linha).
- **Fechamento — “Resultado Líquido Mensal” (Health Dashboard):**
  - `(+)` **Faturamento Bruto** (soma dos pedidos do mês por `data_aprovacao`)
  - `(−)` **Custos de Obras (Variáveis)** = deduções das OS + Gastos Variáveis do mês
  - `(=)` **Margem de Contribuição**
  - `(−)` **Gastos Fixos Pagos** (realizado/caixa)
  - `(−)` **Provisão — Contas a Pagar** (pendente)
  - `(=)` **Lucro Líquido Real** (caixa, só o que foi pago) + **Projetado c/ provisões** ao lado
  - Alerta visual quando Gastos Fixos > 30% do faturamento.

---

## 3. DIRETRIZES DE IMPLEMENTAÇÃO E MELHORIAS (planejado e/ou entregue)

### 3.1 Controle de pagamento (Contas a Pagar) — tabela `gastos_fixos`
Colunas adicionadas: `dia_vencimento` (1–31), `status_pagamento`, `data_pagamento_real`, `forma_pagamento`, `comprovante_url`, `pago`, `pago_em`.
- **Status:** `Pendente` | `Agendado` | `Pago` — com **`Atrasado` derivado** (pendente cujo vencimento já passou). Badges coloridos: Pago=`--green`, Atrasado=`--red`, Agendado=`--yellow`, Pendente=`--text-dim`.
- **Modal de baixa (Tick):** ao marcar como Pago, abre modal que **captura Data de Pagamento Real + Conta/Forma de Pagamento + URL do Comprovante** antes de gravar.
- **Forma de Pagamento (opções de negócio):** `Itaú`, `Nubank`, `Cartão Corporativo`, `Caixa Interno`.
- **Comprovante:** armazenado como URL/string (ícone de clipe 📎 abre o link).

### 3.2 Gastos Fixos — Controle de pagamento
- **Provisões automáticas:** ao abrir um novo mês, recorrentes (`fixar_proximo`) são projetados como `Pendente`.
- **Indicador de Provisão:** soma de tudo que está Pendente/Agendado/Atrasado no mês.
- **Alertas nativos:** ao carregar, dispara `toast('⚠️ Atenção: Você tem X contas vencidas ou vencendo hoje!', 'warn')`; também avisa as que vencem nos próximos 3 dias.
- *(Gráfico “Previsão de Saídas por Semana” e Health Dashboard removidos do `faturamento.html` em 2026-06-16 — lógica `calcFluxoSemanal` e `calcResumoMes` mantidas em `financeiroService.js` para uso futuro em tela gerencial.)*

### 3.4 Tabela `financeiro_movimentacoes`
Rastreia recebimentos e saídas **reais** vinculados a cada pedido.

#### 3.4.1 Colunas completas
| Coluna | Tipo | Default | Descrição |
|---|---|---|---|
| `id` | BIGINT PK | — | Gerado automaticamente |
| `lead_id` | BIGINT FK→leads | — | Pedido associado (CASCADE DELETE) |
| `descricao` | TEXT | — | Descrição do lançamento |
| `tipo` | TEXT | — | `'Entrada'` ou `'Saída'` |
| `valor` | NUMERIC(12,2) | — | Valor da linha (net para parcelas cartão; bruto para entradas normais) |
| `data_movimentacao` | DATE | — | Data do lançamento / competência |
| `data_vencimento` | DATE | NULL | Data de liquidação esperada (parcelas cartão) |
| `status` | TEXT | `'Confirmado'` | `'Confirmado'` = caixa; `'Pendente'` = a liquidar |
| `taxa_cartao_valor` | NUMERIC(10,2) | 0 | Valor absoluto da taxa Stone/operadora descontada |
| `parcela_ref` | TEXT | — | Rótulo da parcela (ex.: "1/3") |
| `forma_pagamento` | TEXT | — | Pix, Boleto, Cartão, etc. |
| `comprovante_url` | TEXT | — | Path ou URL do comprovante PIX |
| `observacao` | TEXT | — | Nota livre |
| **`valor_bruto`** | NUMERIC(12,2) | NULL | *(novo — split)* O que o cliente pagou — **zeroa 100% da dívida** |
| **`valor_liquido`** | NUMERIC(12,2) | NULL | *(novo — split)* Valor líquido: `valor_bruto − taxa_cartao_valor` |
| **`is_parcela_cartao`** | BOOLEAN | FALSE | TRUE nas N linhas do cronograma; FALSE na "entrada-resumo" |
| **`parcela_parent_id`** | BIGINT FK | NULL | Aponta para o `id` da "entrada-resumo" que gerou o cronograma |
| **`antecipada`** | BOOLEAN | FALSE | TRUE quando o financeiro marca que a operadora adiantou o valor |
| **`taxa_antecipacao`** | NUMERIC(10,2) | 0 | Valor R$ da taxa cobrada na antecipação |
| `created_at` | TIMESTAMPTZ | NOW() | — |

**Migrations:**
- `migrations/2026-06-15_cartao_movimentacoes.sql` — `status`, `data_vencimento`, `taxa_cartao_valor`, índice `idx_movs_status_tipo`
- `migrations/2026-06-15_cartao_split_valores.sql` — 6 colunas do split + índices `idx_movs_parent_id`, `idx_movs_parcela_cartao`

**RLS:** `FOR ALL TO authenticated USING(true) WITH CHECK(true)`. Índices em `lead_id` e `parcela_parent_id`.

#### 3.4.2 🆕 Modelo Split Bruto / Taxa / Líquido (2026-06-15)

Quando o cliente paga via **Cartão de Crédito**, o sistema cria **3 camadas de artefatos**:

**Camada 1 — Saldo do cliente (entra-resumo):**
```
is_parcela_cartao = FALSE
valor             = valor_bruto = R$10.000   ← zeroa 100% da dívida imediatamente
valor_liquido     = R$9.700
taxa_cartao_valor = R$300
status            = 'Confirmado'              ← valRecebido() conta aqui
```
`valRecebido()` e `calcValorReal()` filtram `!is_parcela_cartao` + `status='Confirmado'` → **saldo = ZERO** após o lançamento.

**Camada 2 — Cronograma de recebíveis (N parcelas):**
```
is_parcela_cartao = TRUE                      ← excluído do saldo do cliente
parcela_parent_id = id da entrada-resumo
valor             = R$3.233,33 (líquido/N)
status            = 'Pendente'                ← vira 'Confirmado' quando a operadora deposita
data_vencimento   = datas mensais calculadas
```
Exibidas no modal de caixa, aba "Cronograma de Cartão", com botão "✓ Confirmar" por parcela.

**Camada 3 — Custo operacional (DRE):**
```
crm_gastos_variaveis {
  categoria   = 'Despesa Financeira'
  descricao   = 'Taxa de Cartão — <descrição do lançamento>'
  valor       = R$300
  pedido_id   = <lead_id>
  mes/ano     = mês corrente
  status      = 'Pago'
}
```
Injetado automaticamente em `confirmarCartaoModal()`. `calcDRE()` e `calcResumoMes()` já consomem `variaveis[]` → margem de lucro recalculada **sem ação manual**.

#### 3.4.3 🆕 Antecipação de Recebíveis

Botão "⚡ Antecipar" no cabeçalho do grupo de parcelas:
1. Operador informa taxa % da antecipação (ex.: 2,5 %).
2. Todas as parcelas `status='Pendente'` do grupo viram `antecipada=true, status='Confirmado'`.
3. Taxa de antecipação (R$) é auto-injetada em `crm_gastos_variaveis` (categoria `'Despesa Financeira'`).
4. Modal de caixa recalcula KPIs; DRE absorve o custo automaticamente.

#### 3.4.4 Regras de negócio e retrocompatibilidade

- **`valRecebido(leadId)`** em `pedidos.html`: `!is_parcela_cartao && (status||'Confirmado')==='Confirmado'` usando `valor_bruto||valor`.
- **`calcValorReal(movs, leadIds)`** em `financeiroService.js`: mesma lógica multi-lead.
- **`calcFluxoCartao(movs, leadId)`** em `financeiroService.js`: retorna parcelas `is_parcela_cartao=true` ordenadas por `data_vencimento`.
- **Retrocompat:** `is_parcela_cartao DEFAULT FALSE` → registros antigos sem a coluna comportam-se como entradas normais. `valor_bruto||valor` garante cálculo correto em registros sem `valor_bruto`.
- **Float precision:** `Math.round(x * 100) / 100` em todos os cálculos de parcelas.

#### 3.4.5 KPIs do modal de Caixa (4 cards)

| Card | Cálculo |
|---|---|
| A Receber (cliente) | `lead.valor − valRecebido(leadId)` |
| Já Recebido | `valRecebido(leadId)` (entradas-resumo confirmadas) |
| Pend. Cartão | parcelas cartão com `status='Pendente'` |
| Conf. Cartão | parcelas cartão com `status='Confirmado'` ou `antecipada=true` |

**Métodos em `financeiroService`:** `carregarMovimentacoes`, `carregarMovimentacoesPorLead`, `inserirMovimentacao`, `atualizarMovimentacao`, `deletarMovimentacao`, `calcValorReal(movs, leadIds)`, `calcFluxoCartao(movs, leadId)`, `calcSaidas(movs, leadIds)`.

**Valor Real no `faturamento.html`:** 5º KPI card **"Valor Real Recebido"** = soma das Entradas **Confirmadas** (não-parcela-cartão) para os pedidos do mês.

### 2.6 Tesouraria Operacional — aba 📋 em `faturamento.html` *(refactor 2026-06-16)*

Aba `tab-contas-pagar` → `#view-contas-pagar`. Módulo completo de Contas a Pagar. **Migration obrigatória:** `migrations/2026-06-16_contas_a_pagar.sql`.

#### Tabela `contas_a_pagar`
| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | BIGSERIAL PK | — |
| `user_id` | UUID FK→auth.users CASCADE | Dono do registro (RLS multi-tenant) |
| `descricao` | TEXT NOT NULL | — |
| `numero_documento`, `codigo_barras`, `fornecedor_nome`, `observacoes` | TEXT | Opcionais |
| `valor_original` | NUMERIC(12,2) | Valor do documento — nunca muta |
| `valor_pago` | NUMERIC(12,2) | Registrado na baixa (< original = split parcial) |
| `juros`, `multa` | NUMERIC(12,2) | Encargos adicionados na baixa |
| `data_vencimento` | DATE | — |
| `data_pagamento` | DATE | Preenchido na baixa |
| `status` | TEXT CHECK | `provisionado` / `aberto` / `atrasado` / `agendado` / `pago` |
| `forma_pagamento` | TEXT | Conta usada (Itaú, Nubank…) |
| `url_comprovante` | TEXT | Path no bucket `relatorios-tecnicos` |
| `id_obra` | BIGINT FK→leads SET NULL | Vínculo opcional com obra/pedido |
| `origem` | TEXT CHECK | `manual` / `boleto` / `fixo` / `variavel` |
| `parent_id` | BIGINT FK→contas_a_pagar SET NULL | Aponta ao registro pai no pagamento parcial (split) |
| `created_at`, `updated_at` | TIMESTAMPTZ | Trigger `trg_cap_updated_at` atualiza `updated_at` |

**RLS:** 4 policies `TO authenticated` filtrando `user_id = auth.uid()` (SELECT / INSERT WITH CHECK / UPDATE / DELETE).

#### Máquina de 5 estados
`provisionado` → `aberto` → `agendado` → `pago`.
⚠️ `atrasado` **nunca é persistido** — calculado por `capStatusEfetivo()` em tempo real quando `data_vencimento < hoje` e status ≠ pago.

#### Agregação 4 fontes — `capBuildUnified()`
| # | Fonte | Cache | Origem badge | Ações |
|---|---|---|---|---|
| 1 | Tabela `contas_a_pagar` | `_capCache` | `cp` | Checkbox, baixa modal, delete, status select |
| 2 | Boletos de fornecedores | `_boletosCP` | `forn` | Somente leitura (link compras.html) |
| 3 | Gastos fixos do mês | `_gastosCache` | `fixo` | Somente leitura |
| 4 | Gastos variáveis do mês/ano | `_variaveisCache` | `var` | Somente leitura |

#### KPIs (4 cards)
- **Total Vencido** — status `atrasado`, soma `valor_original`
- **A Vencer Mês** — `aberto`/`agendado`/`provisionado` com `data_vencimento` no mês corrente
- **Total Pago Mês** — `pago` com `data_pagamento` no mês corrente
- **Projeção 7 Dias** — vence nos próximos 7 dias, não pago

#### Filtros, ordenação e views
- **Filtros:** Todos (não-pagos) / Vencido / Esta Semana / Este Mês / Pago
- **Ordenação:** `atrasado(0) > aberto(1) > agendado(2) > provisionado(3) > pago(4)` → por data
- **View Lista** (`#cap-view-lista`): tabela com checkboxes (só registros `'cp'`), badges de status e origem, ações
- **View Calendário** (`#cap-view-cal`): grade mensal (`#cap-cal-grid`), badges por dia — vencido vermelho, normal amarelo; dia com vencidos destacado em `--red`

#### Modal de Baixa (`#cap-baixa-modal`)
Campos: descrição (readonly), valor original (readonly), **valor pago** (editável → aciona split hint), data pagamento (default hoje), forma pagamento, juros, multa, upload comprovante.
**Upload** → `relatorios-tecnicos/comprovantes-pagamento/{user_id}/cap_{id}_{ts}.{ext}` via `crmService.uploadRelatorio()`. URL aberta por `abrirAnexoTecnico()` (signed URL 1h).

#### Split (Pagamento Parcial)
Se `valor_pago < valor_original − 0.01` ao confirmar a baixa:
1. Registro original → `status='pago'`, `valor_pago` = valor informado
2. Novo registro filho → `parent_id = id_original`, `valor_original = saldo restante`, `status='aberto'`

#### Seleção em Massa
Checkbox no header seleciona todos registros `'cp'`. Botão **"Liquidar Selecionados"** (`#cap-mass-btn`):
- 1 selecionado → abre modal de baixa individual
- N selecionados → `prompt()` de forma de pagamento → `atualizarCP()` em lote

#### Nova Conta (`#cap-nova-modal`)
Campos: descrição, valor, vencimento (se < hoje → status forçado a `atrasado`), status, fornecedor, nº doc, obra (dropdown de `_allPedidosBrutos`), código de barras, observações.

#### Métodos em `financeiroService` adicionados (2026-06-16)
`carregarCP()`, `inserirCP(dados)`, `atualizarCP(id, upd)`, `deletarCP(id)`.

### 2.7 Contas a Receber / Aging List — aba 💰 em `pedidos.html`
Nova aba `vtab-cobranca` → `#view-cobranca`. Usa dados já carregados (`_pedidos` + `_movimentacoes`).
- **Campos:** Cliente, OS/Código, Valor Total, Já Pago, Saldo, Próx. Vencimento, Status
- **Status derivado:** Quitado (excluído da lista) / Atrasado / Parcialmente Pago / Pendente
- **Filtros:** busca livre, status, data início, data fim de vencimento
- **KPIs:** Total a Receber, Saldo Vencido (R$), Clientes Parciais (qtd), Clientes em Dia (qtd)
- **Ação:** botão 💰 Caixa abre o fluxo de caixa do pedido para registrar recebimento

### 2.8 Motor de Projeção de Caixa — `caixa.html` *(P1/P2, 2026-06-16)*

Projeção diária do saldo **D+0 → D+60** a partir do saldo inicial, ponderando recebíveis pelo risco de não-liquidação. **Migration:** `2026-06-16_config_caixa.sql` (rodar **depois** de `contas_a_pagar.sql` — reutiliza `trg_set_updated_at()`). Serviço: `caixaService.js`.

#### Tabela `config_caixa` (1 linha por usuário — `user_id` UNIQUE)
| Coluna | Default | Descrição |
|---|---|---|
| `saldo_inicial` | 0 | Ponto de partida da projeção |
| `peso_em_dia` | 100 | ICR — em dia / a vencer |
| `peso_atraso_1_30` | 70 | ICR — atraso 1–30 dias |
| `peso_atraso_31_60` | 40 | ICR — atraso 31–60 dias |
| `peso_atraso_60plus` | 0 | ICR — atraso > 60 dias |

**RLS:** SELECT/INSERT/UPDATE `TO authenticated` com `user_id = auth.uid()`.

#### ICR — Índice de Confiabilidade de Recebimento
`calcPeso(dataVenc, hoje, config)` retorna 0..1 conforme o aging da parcela. **Só entradas são ponderadas** — saídas entram pelo valor cheio (custo é custo). Parcelas vencidas são puxadas para **D+0** (hoje).

#### 5 fontes agregadas em `calcProjecaoDiaria()`
| Fonte | Direção | Tabela / filtro |
|---|---|---|
| Parcelas de cartão pendentes | Entrada (×ICR) | `financeiro_movimentacoes` (is_parcela_cartao, status Pendente) |
| Contas a pagar nativas | Saída | `contas_a_pagar` (status ≠ pago) — usa saldo `valor_original − valor_pago` |
| Boletos de fornecedores | Saída | `boletos_fornecedores` (status ≠ Pago) |
| Gastos fixos | Saída | `gastos_fixos` (próx. 3 meses, ≠ Pago) |
| Gastos variáveis | Saída | `crm_gastos_variaveis` (próx. 3 meses, ≠ Pago) |

#### KPIs — `calcKPIs(dias)`
A Receber / A Pagar em 30 e 60 dias, Saldo projetado em D+30 e D+60, **dias com saldo negativo** (`diasNegativos`), **primeiro dia negativo** (alerta de ruptura de caixa) e **pior dia** (menor saldo). Gráfico de linha (Chart.js) + tabela dia a dia.

**Métodos em `caixaService`:** `carregarConfig`, `salvarConfig` (upsert por `user_id`), `carregarEntradasPendentes`, `carregarSaidasNativas`, `carregarBoletosPendentes`, `carregarGastosFixosPendentes`, `carregarVariaveisPendentes`, `calcPeso`, `calcProjecaoDiaria`, `calcKPIs`.

### 2.9 Governança Financeira — Auditoria + Alçadas *(P3, 2026-06-16/17)*

Botão **📋 Governança** no cabeçalho do `faturamento.html` → modal `#gov-modal` com 2 abas. **Migration:** `2026-06-16_auditoria.sql` (rodar **depois** de `contas_a_pagar.sql`). Serviço: `auditService.js`.

#### Auditoria — `audit_log_financeiro` (imutável / append-only)
- Colunas: `tabela`, `operacao` (INSERT/UPDATE/DELETE), `registro_id`, `dados_antes` JSONB, `dados_depois` JSONB, `campos_alterados` TEXT[], `created_at`.
- **Gravado exclusivamente por trigger** `fn_audit_financeiro()` (`auth.uid()` da sessão). Triggers: `AFTER INSERT/UPDATE/DELETE` em `contas_a_pagar` + `AFTER UPDATE` em `boletos_fornecedores`. `campos_alterados` calculado comparando `to_jsonb(OLD)` × `to_jsonb(NEW)` via `jsonb_each`.
- **RLS:** só SELECT + INSERT (`user_id = auth.uid()`). **Sem policy de UPDATE/DELETE → o log é imutável pelo app.** A aba "Log de Operações" mostra os 50 mais recentes (`auditService.formatarLog`).

#### Alçadas — `alcadas_aprovacao` + trava 🔐
- Colunas: `contexto` (`baixa_cap` | `baixa_forn`), `valor_limite`, `ativo`. UNIQUE `(user_id, contexto)`. Upsert via `auditService.salvarAlcada` (`onConflict: 'user_id,contexto'`).
- Aba "Alçadas" configura limite + Ativo por contexto (`renderAlcadasForm` / `salvarAlcadas`). `mudarTabGov('alcadas')` recarrega do banco antes de renderizar.
- Ao confirmar uma baixa **acima do limite ativo**, dispara o overlay `#alcada-overlay` (🔐, z-index **1100**, acima dos modais 1000) exigindo 2ª confirmação. Máquina de estado: `_alcadaBypass` (pula a checagem na re-entrada) + `_alcadaCallback` (função a re-executar após confirmar).
- **A trava cobre os 4 caminhos de baixa** (corrigido 2026-06-17):

| Caminho | Função | Contexto | Refresh pós-baixa |
|---|---|---|---|
| Conta a Pagar | `confirmarCapBaixa` | `baixa_cap` | `loadCP` + `renderCP` |
| Boleto Fornecedor | `_confirmarFornBaixa` | `baixa_forn` | `loadBoletosCP` + `renderCP` |
| Gasto Fixo / Variável | `confirmarPagamento` | `baixa_cap` | `renderCP` |
| Liquidação em massa | `liquidarSelecionados` | `baixa_cap` (maior item do lote) | `renderCP` |

> ⚠️ **`baixa_cap` governa CP + Gasto Fixo + Gasto Variável** (todos "Tesouraria Operacional"); **`baixa_forn`** governa boletos de fornecedor. Rótulo na UI: "Baixa de Conta / Gasto".
> **`_alcadas` é carregado com `await` no `carregar()`** — evita race condition (a trava não disparava se a baixa ocorresse antes de o fetch resolver).
> **Toda baixa re-busca do banco e re-renderiza a tabela unificada na hora** (sem F5).

**Métodos em `auditService`:** `carregarLogs`, `carregarAlcadas`, `salvarAlcada`, `getLimite(contexto, alcadas)`, `verificarAlcada`, `formatarLog`.

### 2.10 Fila de Cobrança + Promessas de Pagamento *(P4, 2026-06-17 — estende §2.7)*

Extensão da aba **💰 Contas a Receber** em `pedidos.html`. **Migration:** `2026-06-17_promessas_pagamento.sql`. Serviço: `cobrancaService.js`.

#### Tabela `promessas_pagamento`
| Coluna | Descrição |
|---|---|
| `lead_id` | Pedido/cliente associado |
| `tipo` | `contato` (registro de comunicação) \| `promessa` (compromisso de pagamento) |
| `descricao` | Nota livre |
| `valor_prometido`, `data_prometida` | Só para `tipo='promessa'` |
| `status` | `pendente` \| `cumprida` \| `quebrada` \| `cancelada` |

**RLS:** SELECT/INSERT/UPDATE `user_id = auth.uid()`. **View `vw_promessas_quebradas`**: `tipo='promessa' AND status='pendente' AND data_prometida < CURRENT_DATE`.

#### UI
- **Fila Prioritária** (3 cards no topo da aba): **Promessas Quebradas** (vermelho), **Vencem em 3 dias** (amarelo), **Atrasados s/ Contato** (laranja).
- Cada linha da Aging List ganha **badge de promessa** (ativa / quebrada / contato) e botão **📞 Cobrar** → modal `#cobranca-modal` com abas **📝 Contato** / **🤝 Promessa** + **histórico** por cliente (ações ✓ Cumprida / ✗ Quebrada).

**Métodos em `cobrancaService`:** `carregarTodas`, `registrar`, `marcarStatus`, `getPorLead`, `getUltimoContato`, `getPromessaAtiva`, `isQuebrada`.

### 3.3 DRE — Demonstração do Resultado do Exercício (comparativa)
> ⚠️ O modal `#dre-modal` e funções `renderDRE / abrirDREModal / imprimirDRE` foram **removidos de `faturamento.html`** em 2026-06-16. A matemática (`calcDRE`) permanece em `financeiroService.js` para uso futuro em tela gerencial dedicada.
- **Formato:** matriz **linhas (contas) × colunas (12 meses + Acumulado do Ano)**, regime de competência.
- **Estrutura:**
  1. `(+)` Faturamento Bruto
  2. `(−)` Impostos sobre Vendas (alíquota configurável, default 0%)
  3. `(=)` Faturamento Líquido
  4. `(−)` Custos Diretos de Obras (deduções das OS + Gastos Variáveis + Compras)
  5. `(=)` Margem de Contribuição
  6. `(−)` Gastos Fixos
  7. `(=)` Lucro Líquido Operacional
- **% vertical:** percentual sobre Faturamento Bruto (100% base) por coluna.

---

## 4. ESPECIFICAÇÃO DA SUBPÁGINA — GASTOS VARIÁVEIS

- **Onde:** 3ª aba (`📉 Gastos Variáveis`) em `faturamento.html`, ao lado de Visão Obras e Gastos Fixos (mesma identidade de navegação por abas, cor `--accent`).
- **Tabela Supabase `crm_gastos_variaveis`:** `id`, `categoria`, `descricao`, `valor`, `dia_vencimento`, `status` (Pendente/Pago), `pedido_id` (vínculo com a obra; `null` = Geral), `mes`, `ano`.
- **Formulário “➕ Lançar Gasto Variável”:**
  - **Categoria** (`<select>` com `<optgroup>`):
    - **Produção/Obras:** `Matéria-prima extra / Reposição`, `Fretes e Carretos`, `Mão de obra terceirizada (Diárias)`
    - **Comerciais/Vendas:** `Comissões de Vendedores/Closers`, `Taxas de Cartão / Emissão de Boletos`
    - **Marketing:** `Anúncios / Tráfego Pago (Meta/Google Ads)`
  - **Obra / Pedido / Cliente** (`<select>` dinâmico de `allPedidos`/`_allPedidosBrutos`) ou **🌐 Geral / Sem Vínculo**.
  - Descrição, Valor, Dia de Vencimento; Status com toggle Pendente⇄Pago.
- **Card “Índice de Variabilidade”:** métrica destacada calculada em tempo real:
  - `Índice = (Total de Gastos Variáveis do Mês / Faturamento Bruto do Mês) × 100`
  - Exibe total em `brl()` e o percentual sutil (ex.: **“15.5% s/ Faturamento”**).
- **Integração financeira:** os Gastos Variáveis entram em **”Custos de Obras (Variáveis)”** no Health Dashboard, na DRE (Custos Diretos de Obras) e no **Breakeven** (`relatorios.html`) — garantindo consistência entre todas as telas.
- **Custo por OS (2026-06-17):** variáveis com `pedido_id` preenchido (incl. a **Taxa de Cartão** injetada automaticamente em `confirmarCartaoModal`) também entram no **custo da obra** em `faturamento.html` via helper **`variaveisDe(leadId)`** — somadas em KPIs (lucro/margem), Visão Obras, Modal de Custos, Auditoria (🔍) e Ficha OS. Antes só deduções + boletos contavam por OS; a taxa de cartão ficava de fora do lucro por obra. Variáveis “🌐 Geral” (`pedido_id=null`) não são atribuídas a nenhuma OS.

---

## 5. DIRETRIZES DE COMUNICAÇÃO E FORMATO (como a IA deve se portar comigo)

- **Idioma:** Português (pt-BR), tom direto, profissional e objetivo. Pode usar emojis com moderação para organizar (✅, ⚠️, 📊).
- **Persona esperada:** atue como **Engenheiro de Software Full-Stack Sênior / Arquiteto de Soluções**. Pense em arquitetura, riscos e manutenibilidade.
- **Nível técnico:** alto. Não simplifique demais; explique decisões de engenharia e trade-offs. Pode mostrar código real.
- **Padrões de código inegociáveis:**
  - **`Math.round()` em todos os preços** — regra de negócio: nenhum valor em centavos. Aplica em `salvarEdicao()`, `confirmarAprovacao()` e em toda lógica de parcelas.
- **Schema de parcelas** (JSONB `leads.parcelas`): `{ metodo, pct, valor_reais, condicao, vencimento, modo }`. `pct` é sempre salvo (back-calculado se usuário digitou R$). `valor_reais` é sempre salvo (calculado de `Math.round(val × pct/100)` se usuário digitou %). Parcelas antigas sem `valor_reais` fazem fallback para `Math.round(valor × pct/100)` na leitura.
- **Validação de parcelas** (wizard `validarStep2` e editor de pedidos): `sum(valor_reais) === valorFinal` (inteiros exatos). **Não** usa `sum(pct) === 100` — evita falso positivo por arredondamento de ponto flutuante.
- **Dual-mode % / R$** por parcela: botão toggle `[%]` / `[R$]` comuta o modo. Ao comutar, o valor é convertido automaticamente para a outra unidade.
  - **Vanilla JS** + manipulação nativa de DOM (nada de frameworks).
  - Respeitar **as variáveis CSS do `:root`** (não introduzir cores soltas).
  - Toda operação assíncrona Supabase em **`try/catch`** com feedback via **`toast()`** (`'ok'` | `'err'` | `'warn'`).
  - Acesso a dados **somente** via camada de serviços (`crmService` / `financeiroService`); nada de `db.from()` solto na UI.
  - Validar **fechamento de tags HTML** e sintaxe antes de concluir.
- **Quando houver mudança de banco:** sempre entregar o **SQL pronto para colar** no Supabase SQL Editor (com `IF NOT EXISTS` / `DROP POLICY IF EXISTS` para reexecução segura) e avisar claramente que precisa ser rodado **antes** de testar.
- **Segurança/LGPD:** preferir sempre a opção mais segura (bucket privado + signed URLs; nunca expor dados de cliente publicamente; nunca usar service_role key no front-end). O sistema usa **RLS + Supabase Auth (login obrigatório)**; toda nova tabela deve nascer com **RLS ligado** e policy **`TO authenticated`** (nunca `USING(true)` para anon). Mudanças que apertam RLS seguem a ordem: criar usuário → testar login → rodar SQL. Não criar arquivos de teste com chaves versionados no projeto (foram removidos).
- **Processo:** planejar antes de executar; aplicar em etapas; **validar** (sintaxe, balanceamento de tags, teste de banco quando possível) e entregar um **resumo conciso em tabela** ao final.
- **Decisões de arquitetura que impactam risco** devem ser apresentadas a mim para eu escolher (ex.: ES Modules vs scripts clássicos), com recomendação fundamentada.
- **Manutenção deste arquivo:** **sempre atualizar este `CONTEXTO_SISTEMA.md` a cada evolução do sistema** (novas tabelas, colunas, telas, regras de negócio).
