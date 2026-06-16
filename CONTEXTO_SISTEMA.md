# 🧠 ARQUIVO DE CONTEXTO DEFINITIVO — GG TECH CRM (Conceito Vidros & Projetos)
> System Prompt / Context File para uso em futuras conversas com IAs.
> Última atualização: 2026-06-15 (Aging List, Cartão de Crédito — split Bruto/Taxa/Líquido + antecipação + DRE automática, Contas a Pagar Unificado, bug fix Infraestrutura) · Mantido vivo a cada evolução do sistema.

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
│   ├── financeiroService.js   # dados de pedidos/faturamento/gastos + MATEMÁTICA PURA (DRE, breakeven, fluxo, resumo)
│   └── comprasService.js      # fornecedores por OS + boletos + view relatorio_despesas_os
└── modules/
    ├── wizard-aprovacao.js    # UI de visita + cadastro técnico + wizard de aprovação (3 passos)
    └── ficha-pdf.js           # Ficha de Pedido PDF 3 páginas (html2canvas + jsPDF) — só no faturamento
```
**Ordem de carga:** utils → supabase → **auth** → crmService → financeiroService → (comprasService) → script inline → (wizard, só no index; ficha-pdf, só no faturamento).
**CDNs:** apenas `cdn.jsdelivr.net` (CSP do vercel.json) — Chart.js, html2canvas@1.4.1, jspdf@2.5.1.
**Regra de ouro:** scripts clássicos compartilham escopo global; nunca redeclarar `db`/`const` do core dentro do inline (causa SyntaxError). Nenhuma chamada `db.from`/`createClient` deve existir nos HTML — tudo passa pelos serviços.

### 2.3 Banco de dados (Supabase)
- **Tabelas:** `leads`, `faturamento`, `crm_clientes`, `gastos_fixos`, `crm_gastos_variaveis`, `financeiro_movimentacoes`, **`compras_fornecedores_os`** (fornecedores vinculados à OS, FK→leads CASCADE), **`boletos_fornecedores`** (boletos por fornecedor, status Pendente/Pago/Atrasado, FK→compras CASCADE).
- **View `relatorio_despesas_os`** (com `security_invoker = true` — respeita RLS): agrega por OS qtd fornecedores, total lançado/pago/pendente/atrasado, lucro bruto e margem %. Função `atualizar_boletos_atrasados()` marca vencidos.
- **Campos da Ficha PDF em `leads`:** `endereco_numero`, `cidade`, `estado`, `ficha_descritivo` (JSONB {item,vidro,estrutura,outros}), `ficha_foto1_path`, `ficha_foto2_path` (paths no bucket privado).
- **Storage:** bucket **PRIVADO** `relatorios-tecnicos` (relatórios contêm PII → LGPD). A coluna `leads.relatorio_tecnico_url` guarda o **caminho**, não a URL; a leitura usa `createSignedUrl(path, 3600)` (URL temporária de 1h).
- **Migração histórica:** `localStorage` foi 100% removido → tudo persiste no Supabase. Parcelas do wizard ficam em `leads.parcelas` (JSONB).
- **Campos em `leads`:** `status_os` (TEXT, default 'Em andamento'), `motivo_congelamento` (TEXT), `visita_relatorio_path` (TEXT), `observacoes` (TEXT), `desconto_pct` (NUMERIC 5,2, default 0), `tecnico_responsavel` (TEXT), `midia_origem` (TEXT).

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
- **`faturamento.html`** — Núcleo financeiro com **4 abas** no topo: **📊 Visão Obras** (custos/margem/lucro por pedido), **🏢 Gastos Fixos** (contas a pagar recorrentes), **📉 Gastos Variáveis** e **📋 Contas a Pagar** (nova — visão unificada, veja §2.6). Inclui Health Dashboard, DRE comparativa e gráfico de fluxo de caixa semanal.
  - **Recorrência por série (`serie_id`):** gasto fixo com "Replicar" gera a série do mês atual até dezembro (mesma `serie_id`); continua no virar do ano (`garantirSeriesDoAno`). **Editar/Excluir** abre diálogo de escopo: *Apenas este mês / Este e os próximos / Todos* (operações em massa **preservam meses já PAGOS**).
  - **Baixa (fixos e variáveis):** status Pendente/Agendado/Pago (Atrasado derivado). Marcar "Pago" abre modal capturando **Data de Pagamento Real + Conta/Forma (Itaú/Nubank/Cartão Corporativo/Caixa Interno) + Comprovante**. O comprovante pode ser **upload de imagem/PDF do PIX** (vai p/ bucket privado `relatorios-tecnicos` prefixo `comprovantes/`, guarda o caminho; abre via signed URL com `abrirAnexoTecnico()`) ou um link colado.
  - **DRE:** botão "🔍 Tela cheia" abre modal full-screen (`dre-modal`) e **🖨️ Imprimir/PDF** (`imprimirDRE` abre nova janela com CSS A4 landscape).
  - **Ficha OS → 📄 Gerar PDF** *(2026-06-12 — substituiu o window.print e os toggles de impressão)*: botão único abre o **modal pré-PDF** (`ficha-pdf-modal`) que confere/completa dados (contato, mídia, consultor, técnico, nº/cidade/UF, datas, descritivo técnico, 2 fotos) — **salva tudo no lead** e chama `gerarFichaPDF(pedido)` (`js/modules/ficha-pdf.js`). PDF de **3 páginas A4 landscape**: OS (cliente+pagamentos+instalação), Termo de Garantia, Relatório Técnico (descritivo+fotos+painel lateral rotacionado). Fotos: bucket privado → signed URL → base64. Logo opcional em `assets/icon-conceito.png` (oculta-se se ausente).
  - **🛒 Custos Reais (Compras)** *(2026-06-12)*: boletos de fornecedores (`relatorio_despesas_os.total_despesas_lancadas`) entram **automaticamente** como dedução em: KPIs, tabela de obras (lucro/margem), Ficha OS (linha própria), Auditoria, Health Dashboard (`calcResumoMes` param `comprasMap`) e DRE (`calcDRE` param `comprasMap`). Mapa `_comprasMap[os_id]` carregado no `Promise.all` do `carregar()`.
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

### 3.2 Relatório de Contas a Pagar
- **Provisões automáticas:** ao abrir um novo mês, recorrentes (`fixar_proximo`) são projetados como `Pendente`.
- **Indicador de Provisão:** soma de tudo que está Pendente/Agendado/Atrasado no mês.
- **Alertas nativos:** ao carregar, dispara `toast('⚠️ Atenção: Você tem X contas vencidas ou vencendo hoje!', 'warn')`; também avisa as que vencem nos próximos 3 dias.
- **Visão de linha do tempo (fluxo de caixa):** gráfico de barras Chart.js **“Previsão de Saídas por Semana”** agrupando vencimentos não pagos em Sem 1 (1–7), Sem 2 (8–14), Sem 3 (15–21), Sem 4 (22–28), Sem 5 (29–31).

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

### 2.6 Contas a Pagar Unificado — aba 📋 em `faturamento.html`
Nova aba `tab-contas-pagar` → `#view-contas-pagar`. Consolida 3 fontes de obrigações pendentes:
1. **Boletos de Fornecedores** (de `boletos_fornecedores` via `comprasService.carregarOSComFornecedores()`, carregados em `_boletosCP` na startup)
2. **Gastos Fixos** pendentes do mês (`_gastosCache` filtrado por `!isPago()`)
3. **Gastos Variáveis** pendentes do mês (`_variaveisCache` filtrado por `status!='Pago'`)
- **Quick-filters:** Todos Pendentes / ⏰ Vence Esta Semana / 🔴 Em Atraso
- **KPIs:** Fornecedores (R$), Gastos Fixos (R$), Gastos Variáveis (R$), Total Vencido (R$)
- **Tabela:** Origem (badge) | Descrição | Valor | Vencimento | Status — ordenada: Atrasados primeiro

### 2.7 Contas a Receber / Aging List — aba 💰 em `pedidos.html`
Nova aba `vtab-cobranca` → `#view-cobranca`. Usa dados já carregados (`_pedidos` + `_movimentacoes`).
- **Campos:** Cliente, OS/Código, Valor Total, Já Pago, Saldo, Próx. Vencimento, Status
- **Status derivado:** Quitado (excluído da lista) / Atrasado / Parcialmente Pago / Pendente
- **Filtros:** busca livre, status, data início, data fim de vencimento
- **KPIs:** Total a Receber, Saldo Vencido (R$), Clientes Parciais (qtd), Clientes em Dia (qtd)
- **Ação:** botão 💰 Caixa abre o fluxo de caixa do pedido para registrar recebimento

### 3.3 DRE — Demonstração do Resultado do Exercício (comparativa)
- **Formato:** matriz **linhas (contas) × colunas (12 meses + Acumulado do Ano)**, com **scroll horizontal** e 1ª coluna fixa. **Regime de competência**.
- **Estrutura (rigorosa):**
  1. `(+)` Faturamento Bruto
  2. `(−)` Impostos sobre Vendas (**alíquota configurável**, default **0%**)
  3. `(=)` Faturamento Líquido
  4. `(−)` Custos Diretos de Obras (deduções das OS **+ Gastos Variáveis** do mês)
  5. `(=)` Margem de Contribuição
  6. `(−)` Gastos Fixos
  7. `(=)` Lucro Líquido Operacional
- **% vertical:** ao lado de cada valor, percentual sobre o **Faturamento Bruto** (100% base) da coluna.

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
- **Integração financeira:** os Gastos Variáveis entram em **“Custos de Obras (Variáveis)”** no Health Dashboard, na DRE (Custos Diretos de Obras) e no **Breakeven** (`relatorios.html`) — garantindo consistência entre todas as telas.

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
