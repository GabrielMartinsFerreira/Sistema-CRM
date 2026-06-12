/* ═══ js/modules/wizard-aprovacao.js ═════════════════════════════════════
 * Módulo de UI: Visita Técnica + Cadastro Técnico Antecipado
 *               + Wizard de Aprovação 3 Passos
 *
 * Dependências (carregadas ANTES via <script> clássico):
 *   - js/core/supabase.js      → db, TABLES
 *   - js/core/utils.js         → toast, brl, esc
 *   - js/services/crmService.js→ todas as operações de banco (leads/clientes/storage)
 *   - inline de index.html     → allLeads, carregarDados, fecharModal
 * Toda chamada ao Supabase passa pelo crmService (camada de dados).
 * ════════════════════════════════════════════════════════════════════════ */

/* ─── ESTADO GLOBAL DO MÓDULO ───────────────────────────────────────── */
let _aprvCurrentLead  = null;
let _cepTimer         = null;
let _cepTimerCad      = null;   // temporizador do cadastro-tecnico-modal
let _cadLeadId        = null;   // lead em foco no cadastro técnico
let _wizStep          = 0;
let _wizParcelas      = [];
let _wizAnexo         = null;
let _parcelaIdCtr     = 0;
let _wizDesconto      = 0;   // percentual de desconto comercial (step 1 → N2)
let _cadEditId        = null;   // quando não-null, atualiza este cliente no CRUD
let _fromGerenciar    = false;  // voltará para a central de clientes após salvar
let _clientesCache    = [];     // cache local dos clientes (espelho de crm_clientes)

/* Mapeia linha do banco (snake_case) → objeto JS usado na interface */
function _rowToCliente(r){
  if(!r) return null;
  return {
    id: r.id, leadId: r.lead_id ?? null,
    tipo: r.tipo || 'CPF', nome: r.nome || '', doc: r.doc || '',
    cpf: r.cpf || '', cnpj: r.cnpj || '', razao_social: r.razao_social || '',
    nome_contato: r.nome_contato || '', telefone: r.telefone || '',
    cep: r.cep || '', endereco: r.endereco || '', bairro: r.bairro || '',
    complemento: r.complemento || '', periodo: r.periodo || '', prazo: r.prazo || ''
  };
}
/* Mapeia objeto JS → linha do banco (snake_case) para INSERT/UPDATE */
function _clienteToRow(c){
  return {
    lead_id: c.leadId ?? null,
    tipo: c.tipo || 'CPF', nome: c.nome || '', doc: c.doc || '',
    doc_digits: (c.doc || '').replace(/\D/g,''),
    cpf: c.cpf || '', cnpj: c.cnpj || '', razao_social: c.razao_social || '',
    nome_contato: c.nome_contato || '', telefone: c.telefone || '',
    cep: c.cep || '', endereco: c.endereco || '', bairro: c.bairro || '',
    complemento: c.complemento || '', periodo: c.periodo || '', prazo: c.prazo || ''
  };
}

/* Recarrega o cache de clientes a partir do Supabase (chamado no boot e após escritas) */
async function _refreshClientesCache(){
  try{
    const { data, error } = await crmService.listarClientes();
    if(error) throw error;
    _clientesCache = (data || []).map(_rowToCliente);
  }catch(e){ console.warn('crm_clientes load:', e.message); }
  return _clientesCache;
}


/* ══════════════════════════════════════════════════════════════════════
 * 1. VALIDADORES MATEMÁTICOS CPF / CNPJ
 * ══════════════════════════════════════════════════════════════════════ */
function validarCPF(cpf){
  cpf = cpf.replace(/\D/g,'');
  if(cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  let s = 0;
  for(let i = 0; i < 9; i++) s += parseInt(cpf[i]) * (10 - i);
  let r = (s * 10) % 11;
  if(r === 10 || r === 11) r = 0;
  if(r !== parseInt(cpf[9])) return false;
  s = 0;
  for(let i = 0; i < 10; i++) s += parseInt(cpf[i]) * (11 - i);
  r = (s * 10) % 11;
  if(r === 10 || r === 11) r = 0;
  return r === parseInt(cpf[10]);
}
function validarCNPJ(cnpj){
  cnpj = cnpj.replace(/\D/g,'');
  if(cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;
  const calc = (c, len) => {
    let s = 0, pos = len - 7;
    for(let i = len; i >= 1; i--){ s += parseInt(c[len - i]) * pos--; if(pos < 2) pos = 9; }
    return s % 11 < 2 ? 0 : 11 - (s % 11);
  };
  return calc(cnpj,12) === parseInt(cnpj[12]) && calc(cnpj,13) === parseInt(cnpj[13]);
}


/* ══════════════════════════════════════════════════════════════════════
 * 2. MODAL DE VISITA TÉCNICA
 * ══════════════════════════════════════════════════════════════════════ */
function toggleVisitaFields(){
  const nec = document.getElementById('vm-necessaria').checked;
  document.getElementById('vm-fields').style.display = nec ? 'block' : 'none';
  const statusVal = document.getElementById('vm-status').value;
  document.getElementById('btn-visita-concluida').style.display =
    (nec && statusVal !== 'Concluída') ? '' : 'none';
  toggleVisitaRelatorio();
}
function toggleVisitaRelatorio(){
  const nec     = document.getElementById('vm-necessaria').checked;
  const status  = document.getElementById('vm-status')?.value || '';
  const wrap    = document.getElementById('vm-relatorio-wrap');
  if(wrap) wrap.style.display = (nec && status === 'Concluída') ? '' : 'none';
}

function abrirVisitaModal(id){
  const l = allLeads.find(x => x.id === id); if(!l) return;
  document.getElementById('vm-lead-id').value = id;
  document.getElementById('vm-codigo').textContent = l.codigo_orcamento || '—';
  document.getElementById('vm-nome').textContent   = l.nome || '';
  const nec = l.visita_necessaria || false;
  document.getElementById('vm-necessaria').checked  = nec;
  document.getElementById('vm-data').value           = l.visita_data    || '';
  document.getElementById('vm-horario').value        = l.visita_horario || '';
  document.getElementById('vm-status').value         = l.visita_status  || 'Pendente';
  document.getElementById('vm-fields').style.display = nec ? 'block' : 'none';
  document.getElementById('btn-visita-concluida').style.display =
    (nec && (l.visita_status || '') !== 'Concluída') ? '' : 'none';
  // Mostra indicador de relatório já anexado
  const relAtual = document.getElementById('vm-relatorio-atual');
  const relFile  = document.getElementById('vm-relatorio-file');
  if(relAtual) relAtual.style.display = l.visita_relatorio_path ? 'block' : 'none';
  if(relFile) relFile.value = '';
  toggleVisitaRelatorio();
  document.getElementById('visita-modal').classList.add('open');
}

async function salvarVisita(){
  const id  = parseInt(document.getElementById('vm-lead-id').value); if(!id) return;
  const btn = document.getElementById('btn-salvar-visita');
  btn.disabled = true; btn.textContent = 'Salvando…';
  const nec        = document.getElementById('vm-necessaria').checked;
  const visitaData = nec ? (document.getElementById('vm-data').value || null) : null;
  const statusVisita = nec ? document.getElementById('vm-status').value : 'Pendente';
  const dados = {
    visita_necessaria: nec,
    visita_data:       visitaData,
    visita_horario:    nec ? (document.getElementById('vm-horario').value || null) : null,
    visita_status:     statusVisita
  };
  // Upload do relatório técnico da visita quando status = Concluída
  const relFile = document.getElementById('vm-relatorio-file');
  if(relFile && relFile.files[0] && statusVisita === 'Concluída'){
    const file = relFile.files[0];
    if(file.size > 10*1024*1024){ toast('Arquivo muito grande — máx. 10 MB','err'); btn.disabled=false; btn.textContent='💾 Salvar'; return; }
    try{
      btn.textContent = 'Enviando relatório…';
      const ext  = (file.name.split('.').pop() || 'bin').toLowerCase();
      const path = id + '/visita_relatorio_' + Date.now() + '.' + ext;
      const { error: upErr } = await crmService.uploadRelatorio(path, file, file.type);
      if(upErr) throw new Error('Upload: ' + upErr.message);
      dados.visita_relatorio_path = path;
    }catch(e){ toast('Erro no upload: ' + e.message, 'err'); btn.disabled=false; btn.textContent='💾 Salvar'; return; }
  }
  try{
    const { error } = await crmService.atualizarLead(id, dados);
    if(error) throw error;
    toast('📅 Visita atualizada!');
    fecharModal('visita-modal', true);
    await carregarDados();
    // Visita agendada com data → abre cadastro técnico antecipado
    if(nec && visitaData){
      setTimeout(() => abrirCadastroTecnico(id), 380);
    }
  }catch(e){ toast('Erro: ' + e.message, 'err'); }
  finally{ btn.disabled = false; btn.textContent = '💾 Salvar'; }
}

async function marcarVisitaConcluida(){
  const id  = parseInt(document.getElementById('vm-lead-id').value); if(!id) return;
  const btn = document.getElementById('btn-visita-concluida');
  btn.disabled = true; btn.textContent = 'Salvando…';
  // Muda o status para Concluída e mostra o campo de relatório em vez de salvar imediatamente
  const statusSel = document.getElementById('vm-status');
  if(statusSel) statusSel.value = 'Concluída';
  btn.style.display = 'none';
  toggleVisitaRelatorio();
  btn.disabled = false; btn.textContent = '✓ Marcar como Realizada';
  // Foca no input de arquivo para facilitar o upload
  const relFile = document.getElementById('vm-relatorio-file');
  if(relFile){ relFile.click(); }
  // O usuário clica em "💾 Salvar" após selecionar (ou não) o arquivo
}


/* ══════════════════════════════════════════════════════════════════════
 * 3. MODAL CADASTRO TÉCNICO ANTECIPADO (abre após agendamento de visita)
 * ══════════════════════════════════════════════════════════════════════ */
async function abrirCadastroTecnico(leadId){
  _cadLeadId = leadId;
  _cadEditId = null;
  await _refreshClientesCache();
  popularClienteSelectCad();
  const lead = allLeads.find(l => l.id === leadId);

  // Limpa campos
  ['cad-nome-completo','cad-cpf','cad-razao-social','cad-cnpj','cad-nome-contato',
   'cad-telefone','cad-cep','cad-endereco','cad-bairro','cad-complemento','cad-prazo']
    .forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
  document.getElementById('cad-periodo').value = '';
  ['cad-cpf-feedback','cad-cnpj-feedback'].forEach(id => {
    const el = document.getElementById(id); if(el) el.style.display = 'none';
  });

  if(lead){
    document.getElementById('cad-lead-ref').textContent =
      (lead.codigo_orcamento || '?') + '  ·  ' + (lead.nome || 'Sem nome identificado');

    // Verifica se já há dados pré-cadastrados para este lead
    const clientes = loadClientesRecorrentes();
    const preReg   = clientes.find(c => String(c.leadId) === String(leadId));

    if(preReg){
      _preencherCadModal(preReg);
    } else if(lead.tipo_doc || lead.nome || lead.cpf || lead.cnpj){
      // Pré-preenche do banco
      const src = {
        tipo: lead.tipo_doc || 'CPF',
        nome: lead.nome || '', cpf: lead.cpf || '',
        razao_social: lead.razao_social || '', cnpj: lead.cnpj || '',
        nome_contato: lead.nome_contato || '', telefone: lead.telefone || '',
        cep: lead.cep || '', endereco: lead.endereco || '',
        bairro: lead.bairro || '', complemento: lead.complemento || '',
        periodo: lead.periodo_obra || '', prazo: lead.prazo_entrega || ''
      };
      _preencherCadModal(src);
    } else {
      setCadDocType('CPF');
    }
  } else {
    document.getElementById('cad-lead-ref').textContent = '—';
    setCadDocType('CPF');
  }

  document.getElementById('cadastro-tecnico-modal').classList.add('open');
}

function _preencherCadModal(c){
  setCadDocType(c.tipo || 'CPF');
  if((c.tipo || 'CPF') === 'CPF'){
    document.getElementById('cad-nome-completo').value = c.nome || '';
    document.getElementById('cad-cpf').value           = c.cpf  || c.doc || '';
  } else {
    document.getElementById('cad-razao-social').value  = c.razao_social || c.nome || '';
    document.getElementById('cad-cnpj').value          = c.cnpj || c.doc || '';
    document.getElementById('cad-nome-contato').value  = c.nome_contato || '';
  }
  document.getElementById('cad-telefone').value    = c.telefone    || '';
  document.getElementById('cad-cep').value         = c.cep         || '';
  document.getElementById('cad-endereco').value    = c.endereco    || '';
  document.getElementById('cad-bairro').value      = c.bairro      || '';
  document.getElementById('cad-complemento').value = c.complemento || '';
  if(c.periodo) document.getElementById('cad-periodo').value = c.periodo;
  if(c.prazo)   document.getElementById('cad-prazo').value   = c.prazo;
}

/* ── Seletor de cliente já cadastrado (cliente retroativo) ── */
function popularClienteSelectCad(){
  const sel = document.getElementById('cad-cliente-select'); if(!sel) return;
  sel.innerHTML = '<option value="">— Novo cliente —</option>' +
    _clientesCache.map(c =>
      `<option value="${c.id}">${esc(c.nome||c.razao_social||'—')} — ${esc(c.doc||'')}</option>`
    ).join('');
  sel.value = '';
}
function selecionarClienteCad(id){
  if(!id){ _cadEditId = null; return; }   // "— Novo cliente —" → volta ao modo de criação
  const c = loadClientesRecorrentes().find(x => String(x.id) === String(id));
  if(!c) return;
  // Reaproveita o cliente existente: salvar irá ATUALIZAR este registro e
  // vinculá-lo ao lead atual (evita bloqueio por CPF/CNPJ duplicado).
  _cadEditId = c.id;
  _preencherCadModal(c);
  ['cad-cpf-feedback','cad-cnpj-feedback'].forEach(fid => {
    const fb = document.getElementById(fid); if(fb) fb.style.display = 'none';
  });
  toast('✓ Dados de "' + (c.nome||c.razao_social||'cliente') + '" carregados — confira e salve');
}

function setCadDocType(tipo){
  document.getElementById('cad-doc-type').value = tipo;
  document.getElementById('cad-cpf-fields').style.display  = tipo === 'CPF'  ? '' : 'none';
  document.getElementById('cad-cnpj-fields').style.display = tipo === 'CNPJ' ? '' : 'none';
  document.getElementById('btn-cad-cpf').className  = 'doc-type-btn' + (tipo === 'CPF'  ? ' active' : '');
  document.getElementById('btn-cad-cnpj').className = 'doc-type-btn' + (tipo === 'CNPJ' ? ' active' : '');
}

function onCadCepInput(v){
  const digits = v.replace(/\D/g,'');
  document.getElementById('cad-cep').value =
    digits.length > 5 ? digits.slice(0,5) + '-' + digits.slice(5,8) : digits;
  clearTimeout(_cepTimerCad);
  if(digits.length === 8) _cepTimerCad = setTimeout(() => _buscarCepCad(digits), 400);
}
async function _buscarCepCad(cep){
  try{
    const r = await fetch('https://viacep.com.br/ws/' + cep + '/json/');
    const d = await r.json();
    if(!d.erro){
      document.getElementById('cad-endereco').value = d.logradouro || '';
      document.getElementById('cad-bairro').value   = d.bairro     || '';
    }
  }catch(e){ console.warn('ViaCEP cad:', e); }
}

function fmtCadCPFInput(el){
  let v = el.value.replace(/\D/g,'').substring(0,11);
  v = v.replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d{1,2})$/,'$1-$2');
  el.value = v;
  const d  = v.replace(/\D/g,'');
  const fb = document.getElementById('cad-cpf-feedback');
  if(d.length === 11){
    fb.style.display = 'block';
    const ok = validarCPF(d);
    fb.className   = 'wiz-doc-feedback ' + (ok ? 'ok' : 'err');
    fb.textContent = ok ? '✓ CPF válido' : '✗ CPF inválido — verifique os dígitos verificadores';
    if(ok) _autoCompletarCadPorDoc(d);
  } else { fb.style.display = 'none'; }
}
function fmtCadCNPJInput(el){
  let v = el.value.replace(/\D/g,'').substring(0,14);
  v = v.replace(/(\d{2})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2')
       .replace(/(\d{3})(\d)/,'$1/$2').replace(/(\d{4})(\d{1,2})$/,'$1-$2');
  el.value = v;
  const d  = v.replace(/\D/g,'');
  const fb = document.getElementById('cad-cnpj-feedback');
  if(d.length === 14){
    fb.style.display = 'block';
    const ok = validarCNPJ(d);
    fb.className   = 'wiz-doc-feedback ' + (ok ? 'ok' : 'err');
    fb.textContent = ok ? '✓ CNPJ válido' : '✗ CNPJ inválido — verifique os dígitos verificadores';
    if(ok) _autoCompletarCadPorDoc(d);
  } else { fb.style.display = 'none'; }
}
function fmtCadTelInput(el){
  let v = el.value.replace(/\D/g,'').substring(0,11);
  if(v.length > 10)     v = v.replace(/(\d{2})(\d{5})(\d{4})/,'($1) $2-$3');
  else if(v.length > 6) v = v.replace(/(\d{2})(\d{4})(\d*)/,'($1) $2-$3');
  else if(v.length > 2) v = v.replace(/(\d{2})(\d+)/,'($1) $2');
  el.value = v;
}

async function salvarCadastroTecnico(){
  const tipo = document.getElementById('cad-doc-type').value;

  /* ── Validações de campo obrigatório ── */
  if(tipo === 'CPF'){
    if(!document.getElementById('cad-nome-completo').value.trim()){ toast('Informe o nome completo','err'); return; }
    if(!validarCPF(document.getElementById('cad-cpf').value)){ toast('CPF inválido','err'); return; }
  } else {
    if(!document.getElementById('cad-razao-social').value.trim()){ toast('Informe a Razão Social','err'); return; }
    if(!validarCNPJ(document.getElementById('cad-cnpj').value)){ toast('CNPJ inválido','err'); return; }
  }

  const nome = tipo === 'CPF'
    ? document.getElementById('cad-nome-completo').value.trim()
    : document.getElementById('cad-razao-social').value.trim();
  const doc  = tipo === 'CPF'
    ? document.getElementById('cad-cpf').value.trim()
    : document.getElementById('cad-cnpj').value.trim();

  /* ── Verificação de duplicidade por CPF / CNPJ (consulta .eq no Supabase) ── */
  const docDigits = doc.replace(/\D/g,'');
  try{
    const { data: dups, error: dupErr } = await crmService.buscarDuplicadoDoc(docDigits, _cadEditId);
    if(dupErr) throw dupErr;
    if(dups && dups.length){
      const d = dups[0];
      toast('⚠️ ' + (tipo==='CPF'?'CPF':'CNPJ') + ' já cadastrado — '
        + (d.nome||d.razao_social||d.doc||'—'), 'err');
      return;
    }
  }catch(e){ toast('Erro ao verificar duplicidade: ' + e.message, 'err'); return; }

  /* ── Monta objeto do cliente ─────────────────────────────────────── */
  const cliente = {
    leadId:      _cadLeadId || null,            // null = cliente avulso (sem orçamento vinculado)
    tipo, nome, doc,
    cpf:          tipo === 'CPF'  ? doc : '',
    cnpj:         tipo === 'CNPJ' ? doc : '',
    razao_social: tipo === 'CNPJ' ? nome : '',
    nome_contato: tipo === 'CNPJ' ? document.getElementById('cad-nome-contato').value.trim() : '',
    telefone:     document.getElementById('cad-telefone').value.trim(),
    cep:          document.getElementById('cad-cep').value.trim(),
    endereco:     document.getElementById('cad-endereco').value.trim(),
    bairro:       document.getElementById('cad-bairro').value.trim(),
    complemento:  document.getElementById('cad-complemento').value.trim(),
    periodo:      document.getElementById('cad-periodo').value,
    prazo:        document.getElementById('cad-prazo').value.trim()
  };

  const btn = document.getElementById('btn-salvar-cadastro');
  if(btn){ btn.disabled = true; btn.textContent = 'Salvando…'; }

  /* ── Persistência no Supabase ────────────────────────────────────── *
   * Edit mode  → UPDATE pelo id                                        *
   * Lead mode  → DELETE por lead_id (substitui) + INSERT               *
   * Avulso     → INSERT (duplicado já bloqueado acima)                 */
  try{
    if(_cadEditId){
      const { error } = await crmService.atualizarCliente(_cadEditId, _clienteToRow(cliente));
      if(error) throw error;
    } else {
      if(_cadLeadId){
        await crmService.deletarClientesPorLead(_cadLeadId);
      }
      const { error } = await crmService.inserirCliente(_clienteToRow(cliente));
      if(error) throw error;
    }
  }catch(e){
    toast('Erro ao salvar cliente: ' + e.message, 'err');
    if(btn){ btn.disabled = false; btn.textContent = '💾 Salvar Cliente'; }
    return;
  }

  await _refreshClientesCache();

  /* ── Propaga os dados técnicos para o LEAD vinculado ──────────────── *
   * Faz a Ficha Logística do calendário (e o orçamento) já abrirem      *
   * totalmente preenchidos no dia da visita, não só com o bloco-resumo. */
  if(cliente.leadId){
    const leadUpd = {
      tipo_doc:      tipo,
      telefone:      cliente.telefone    || null,
      cep:           cliente.cep         || null,
      endereco:      cliente.endereco    || null,
      bairro:        cliente.bairro      || null,
      complemento:   cliente.complemento || null,
      periodo_obra:  cliente.periodo     || null,
      prazo_entrega: cliente.prazo       || null
    };
    if(tipo === 'CPF'){
      leadUpd.nome = nome;
      leadUpd.cpf  = doc;
    } else {
      leadUpd.razao_social = nome;
      leadUpd.cnpj         = doc;
      leadUpd.nome_contato = cliente.nome_contato || null;
    }
    try{
      const { error } = await crmService.atualizarLead(cliente.leadId, leadUpd);
      if(error) throw error;
      // Atualiza o cache em memória para a ficha/pipeline refletirem na hora
      if(typeof allLeads !== 'undefined' && Array.isArray(allLeads)){
        const lead = allLeads.find(l => String(l.id) === String(cliente.leadId));
        if(lead) Object.assign(lead, leadUpd);
      }
    }catch(e){ console.warn('propagar dados técnicos ao lead:', e.message); }
  }

  const isEdit = Boolean(_cadEditId);
  const wasFromGerenciar = _fromGerenciar;
  _cadEditId = null; _fromGerenciar = false;
  if(btn){ btn.disabled = false; btn.textContent = '💾 Salvar Cliente'; }

  toast(isEdit
    ? '✅ Dados do cliente atualizados — visita e orçamento preenchidos!'
    : '✅ Cliente salvo! Dados disponíveis na visita e em futuros pedidos.'
  );
  fecharModal('cadastro-tecnico-modal', true);

  if(wasFromGerenciar) setTimeout(() => abrirGerenciarClientes(), 300);
  else if(cliente.leadId && typeof carregarDados === 'function') carregarDados();
}


/* ══════════════════════════════════════════════════════════════════════
 * 4. WIZARD DE APROVAÇÃO — 3 PASSOS
 * ══════════════════════════════════════════════════════════════════════ */

/* ── Formatadores inline ── */
function fmtCPFInput(el){
  let v = el.value.replace(/\D/g,'').substring(0,11);
  v = v.replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d{1,2})$/,'$1-$2');
  el.value = v;
  const d  = v.replace(/\D/g,'');
  const fb = document.getElementById('cpf-feedback');
  if(d.length === 11){
    fb.style.display = 'block';
    const ok = validarCPF(d);
    fb.className   = 'wiz-doc-feedback ' + (ok ? 'ok' : 'err');
    fb.textContent = ok ? '✓ CPF válido' : '✗ CPF inválido — verifique os dígitos verificadores';
    if(ok) _autoCompletarPorDoc(d);
  } else { fb.style.display = 'none'; }
}
function fmtCNPJInput(el){
  let v = el.value.replace(/\D/g,'').substring(0,14);
  v = v.replace(/(\d{2})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2')
       .replace(/(\d{3})(\d)/,'$1/$2').replace(/(\d{4})(\d{1,2})$/,'$1-$2');
  el.value = v;
  const d  = v.replace(/\D/g,'');
  const fb = document.getElementById('cnpj-feedback');
  if(d.length === 14){
    fb.style.display = 'block';
    const ok = validarCNPJ(d);
    fb.className   = 'wiz-doc-feedback ' + (ok ? 'ok' : 'err');
    fb.textContent = ok ? '✓ CNPJ válido' : '✗ CNPJ inválido — verifique os dígitos verificadores';
    if(ok) _autoCompletarPorDoc(d);
  } else { fb.style.display = 'none'; }
}
function fmtTelefoneInput(el){
  let v = el.value.replace(/\D/g,'').substring(0,11);
  if(v.length > 10)     v = v.replace(/(\d{2})(\d{5})(\d{4})/,'($1) $2-$3');
  else if(v.length > 6) v = v.replace(/(\d{2})(\d{4})(\d*)/,'($1) $2-$3');
  else if(v.length > 2) v = v.replace(/(\d{2})(\d+)/,'($1) $2');
  el.value = v;
}

/* ── CEP (wizard) ── */
function onCepInput(v){
  const digits = v.replace(/\D/g,'');
  document.getElementById('aprov-cep').value =
    digits.length > 5 ? digits.slice(0,5) + '-' + digits.slice(5,8) : digits;
  clearTimeout(_cepTimer);
  if(digits.length === 8) _cepTimer = setTimeout(() => _buscarCepWiz(digits), 400);
}
async function _buscarCepWiz(cep){
  const loading = document.getElementById('cep-loading');
  if(loading) loading.style.display = 'flex';
  try{
    const r = await fetch('https://viacep.com.br/ws/' + cep + '/json/');
    const d = await r.json();
    if(!d.erro){
      document.getElementById('aprov-endereco').value = d.logradouro || '';
      document.getElementById('aprov-bairro').value   = d.bairro     || '';
    }
  }catch(e){ console.warn('ViaCEP wiz:', e); }
  if(loading) loading.style.display = 'none';
}

/* ── Tipo de documento ── */
function setDocType(tipo){
  document.getElementById('aprovar-doc-type').value = tipo;
  document.getElementById('doc-cpf-fields').style.display  = tipo === 'CPF'  ? '' : 'none';
  document.getElementById('doc-cnpj-fields').style.display = tipo === 'CNPJ' ? '' : 'none';
  document.getElementById('btn-doc-cpf').className  = 'doc-type-btn' + (tipo === 'CPF'  ? ' active' : '');
  document.getElementById('btn-doc-cnpj').className = 'doc-type-btn' + (tipo === 'CNPJ' ? ' active' : '');
}

/* ── Navegação de passos ── */
function wizGoTo(step){
  _wizStep = step;
  ['wiz-p0','wiz-p1','wiz-p2','wiz-p3'].forEach((id, i) => {
    const el = document.getElementById(id); if(el) el.style.display = (i === step) ? '' : 'none';
  });
  const navBar = document.getElementById('wiz-nav-bar');
  if(navBar) navBar.style.display = step >= 1 ? 'flex' : 'none';
  [1,2,3].forEach(s => {
    const dot = document.getElementById('wiz-dot-' + s);
    if(dot) dot.className = 'wiz-dot' + (s === step ? ' active' : s < step ? ' done' : '');
  });
  [1,2].forEach(s => {
    const line = document.getElementById('wiz-line-' + s);
    if(line) line.className = 'wiz-line' + (s < step ? ' done' : '');
  });
  const backBtn    = document.getElementById('wiz-btn-back');
  const nextBtn    = document.getElementById('wiz-btn-next');
  const cancelBtn  = document.getElementById('wiz-btn-cancel');
  const confirmBtn = document.getElementById('btn-confirmar-aprovacao');
  if(backBtn)    backBtn.style.display    = step > 1              ? '' : 'none';
  if(nextBtn)    nextBtn.style.display    = (step >= 1 && step < 3) ? '' : 'none';
  if(cancelBtn)  cancelBtn.style.display  = step < 1             ? '' : 'none';
  if(confirmBtn) confirmBtn.style.display = step === 3            ? '' : 'none';
  if(step === 2){
    const _base = parseFloat(_aprvCurrentLead ? _aprvCurrentLead.valor || 0 : 0);
    const _vf   = Math.round(_base * (1 - (_wizDesconto || 0) / 100));
    if(_aprvCurrentLead) document.getElementById('wiz-valor-projeto').textContent = brl(_vf);
    if(_wizParcelas.length === 0) adicionarLinhaParcela();
    atualizarTotalParcelas();
  }
  if(step === 3) renderResumoWizard();
}
function wizNext(){ if(_wizStep === 1 && !validarStep1()) return; if(_wizStep === 2 && !validarStep2()) return; wizGoTo(_wizStep + 1); }
function wizPrev(){ wizGoTo(_wizStep - 1); }

/* ── Validações ── */
function validarStep1(){
  const os = document.getElementById('aprovar-os').value.trim();
  if(!os){ toast('Informe o número da OS','err'); return false; }
  const docType = document.getElementById('aprovar-doc-type').value;
  if(docType === 'CPF'){
    if(!document.getElementById('aprov-nome-completo').value.trim()){ toast('Informe o nome do cliente','err'); return false; }
    if(!validarCPF(document.getElementById('aprov-cpf').value)){
      toast('CPF inválido — verifique os dígitos verificadores','err');
      const fb = document.getElementById('cpf-feedback');
      fb.style.display = 'block'; fb.className = 'wiz-doc-feedback err'; fb.textContent = '✗ CPF inválido';
      return false;
    }
  } else {
    if(!document.getElementById('aprov-razao-social').value.trim()){ toast('Informe a Razão Social','err'); return false; }
    if(!validarCNPJ(document.getElementById('aprov-cnpj').value)){
      toast('CNPJ inválido — verifique os dígitos verificadores','err');
      const fb = document.getElementById('cnpj-feedback');
      fb.style.display = 'block'; fb.className = 'wiz-doc-feedback err'; fb.textContent = '✗ CNPJ inválido';
      return false;
    }
  }
  if(document.getElementById('aprov-telefone').value.replace(/\D/g,'').length < 10){ toast('Informe o telefone/WhatsApp','err'); return false; }
  if(!document.getElementById('aprov-periodo').value){ toast('Selecione o Período da Obra','err'); return false; }
  if(!(document.getElementById('aprov-tecnico')?.value||'').trim()){ toast('Informe o Técnico Responsável','err'); return false; }
  return true;
}
function validarStep2(){
  if(_wizParcelas.length === 0){ toast('Adicione ao menos uma condição de pagamento','err'); return false; }
  const t = calcTotalParcelas();
  if(Math.abs(t.pct - 100) > 0.01){ toast(`Pagamento cobre ${t.pct.toFixed(1)}% — precisa somar 100%`,'err'); return false; }
  return true;
}

/* ── Parcelas com data de vencimento (Task 4) ── */
function adicionarLinhaParcela(){
  const id = ++_parcelaIdCtr;
  _wizParcelas.push({ id, metodo:'Pix', pct:'', condicao:'Sinal', vencimento:'' });
  renderParcelasContainer();
}
function removerLinhaParcela(id){
  _wizParcelas = _wizParcelas.filter(p => p.id !== id);
  renderParcelasContainer(); atualizarTotalParcelas();
}
function renderParcelasContainer(){
  const cont = document.getElementById('parcelas-container'); if(!cont) return;
  const metodos = ['Crédito','Débito','Transferência','Pix','Boleto','Link'];
  cont.innerHTML = _wizParcelas.map(p => `
    <div class="parcela-row" id="pr-${p.id}">
      <select class="form-control" style="font-size:12px"
        onchange="_wizParcelas.find(x=>x.id===${p.id}).metodo=this.value">
        ${metodos.map(m => `<option value="${m}"${p.metodo===m?' selected':''}>${m}</option>`).join('')}
      </select>
      <div style="position:relative">
        <input type="number" class="form-control" style="font-size:12px;padding-right:22px"
          placeholder="%" min="0" max="100" step="1" value="${p.pct||''}"
          oninput="(function(v,id){const p=_wizParcelas.find(x=>x.id===id);if(p)p.pct=parseFloat(v)||0;atualizarTotalParcelas();})(this.value,${p.id})">
        <span style="position:absolute;right:7px;top:50%;transform:translateY(-50%);font-size:11px;color:var(--text-muted);pointer-events:none">%</span>
      </div>
      <input type="text" class="form-control" style="font-size:12px" placeholder="Sinal / Prazo / Condição"
        value="${esc(p.condicao||'')}"
        oninput="_wizParcelas.find(x=>x.id===${p.id}).condicao=this.value">
      <input type="date" class="form-control" style="font-size:12px" title="Data de Vencimento"
        value="${p.vencimento||''}"
        onchange="_wizParcelas.find(x=>x.id===${p.id}).vencimento=this.value">
      <button class="btn-rem-parcela" onclick="removerLinhaParcela(${p.id})" title="Remover">✕</button>
    </div>`).join('');
}
function calcTotalParcelas(){
  const base = parseFloat(_aprvCurrentLead ? _aprvCurrentLead.valor || 0 : 0);
  const val  = Math.round(base * (1 - (_wizDesconto || 0) / 100));
  const pct  = _wizParcelas.reduce((a, p) => a + (parseFloat(p.pct) || 0), 0);
  return { pct, reais: Math.round(val * pct / 100), valorProjeto: val };
}
function atualizarTotalParcelas(){
  const t    = calcTotalParcelas();
  const fill = document.getElementById('wiz-parcela-fill'); if(!fill) return;
  fill.style.width  = Math.min(t.pct, 100) + '%';
  fill.className    = 'wiz-parcela-fill' + (t.pct > 100 ? ' over' : '');
  document.getElementById('wiz-parcela-pct').textContent   = t.pct.toFixed(1) + '%';
  document.getElementById('wiz-parcela-reais').textContent = brl(t.reais) + ' de ' + brl(t.valorProjeto);
  const alertEl = document.getElementById('wiz-parcela-alert');
  if(t.pct === 0){
    alertEl.style.display = 'none';
  } else if(t.pct < 100){
    alertEl.style.display = ''; alertEl.className = 'wiz-parcela-alert warn';
    alertEl.textContent = '⚠️ Faltam ' + (100 - t.pct).toFixed(1) + '% para cobrir o valor total';
  } else if(t.pct > 100){
    alertEl.style.display = ''; alertEl.className = 'wiz-parcela-alert err';
    alertEl.textContent = '✗ Excede em ' + (t.pct - 100).toFixed(1) + '% — ajuste as parcelas';
  } else {
    alertEl.style.display = ''; alertEl.className = 'wiz-parcela-alert ok';
    alertEl.textContent = '✓ Pagamento balanceado — 100% coberto';
  }
}

/* ── Upload de arquivo — Base64 com prefixo MIME (Task 5) ── */
function handleFileUpload(input){
  const file = input.files[0]; if(!file) return;
  if(file.size > 10 * 1024 * 1024){ toast('Arquivo muito grande — máx. 10 MB','err'); input.value = ''; return; }
  const reader = new FileReader();
  reader.onload = function(e){
    // Mantém o File real para upload no Supabase Storage + base64 para preview imediato
    const base64 = e.target.result;
    _wizAnexo = { name: file.name, type: file.type, size: file.size, base64, file };
    document.getElementById('wiz-upload-area').style.display  = 'none';
    document.getElementById('wiz-file-preview').style.display = '';
    const ext = file.name.split('.').pop().toLowerCase();
    document.getElementById('wiz-file-icon').textContent = ext === 'pdf' ? '📕' : '🖼️';
    document.getElementById('wiz-file-name').textContent = file.name;
    document.getElementById('wiz-file-size').textContent = (file.size / 1024).toFixed(1) + ' KB';
  };
  reader.onerror = function(){ toast('Erro ao ler o arquivo','err'); };
  reader.readAsDataURL(file);
}
function removerAnexoWiz(){
  _wizAnexo = null;
  const fi = document.getElementById('wiz-file-input'); if(fi) fi.value = '';
  document.getElementById('wiz-upload-area').style.display  = '';
  document.getElementById('wiz-file-preview').style.display = 'none';
}

/* ── N2: Desconto comercial ── */
function atualizarValorComDesconto(){
  const pct = Math.min(100, Math.max(0, parseFloat(document.getElementById('aprov-desconto')?.value) || 0));
  _wizDesconto = pct;
  const base  = parseFloat(_aprvCurrentLead ? _aprvCurrentLead.valor || 0 : 0);
  const final = Math.round(base * (1 - pct / 100));
  const el = document.getElementById('aprov-valor-final');
  if(el) el.value = base > 0 ? brl(final) : '';
  if(_wizStep === 2){
    const wvEl = document.getElementById('wiz-valor-projeto');
    if(wvEl) wvEl.textContent = brl(final);
    atualizarTotalParcelas();
  }
}

/* ── Resumo Passo 3 (com datas das parcelas) ── */
function renderResumoWizard(){
  const l = _aprvCurrentLead; if(!l) return;
  const docType  = document.getElementById('aprovar-doc-type').value;
  const nomeStr  = docType === 'CPF'
    ? document.getElementById('aprov-nome-completo').value
    : document.getElementById('aprov-razao-social').value;
  const docStr   = docType === 'CPF'
    ? document.getElementById('aprov-cpf').value
    : document.getElementById('aprov-cnpj').value;
  const fmtV     = v => { if(!v) return '—'; try{ const[y,m,d]=v.split('-'); return d+'/'+m+'/'+y; }catch{ return v; }};
  const linhasPag = _wizParcelas.map(p =>
    `<div class="wiz-review-line">
      <span class="wiz-review-label">${esc(p.metodo)} — ${esc(p.condicao||'?')}</span>
      <span class="wiz-review-val">${p.pct||0}%&nbsp;·&nbsp;${fmtV(p.vencimento)}</span>
    </div>`).join('');
  const anexoStr = _wizAnexo
    ? `<div class="wiz-review-line"><span class="wiz-review-label">📎 Relatório</span><span class="wiz-review-val">${esc(_wizAnexo.name)}</span></div>`
    : `<div class="wiz-review-line"><span class="wiz-review-label">📎 Relatório</span><span class="wiz-review-val" style="color:var(--text-muted)">Não anexado</span></div>`;
  document.getElementById('wiz-review-content').innerHTML = `
    <div class="wiz-review-line"><span class="wiz-review-label">OS</span><span class="wiz-review-val">${esc(document.getElementById('aprovar-os').value)}</span></div>
    <div class="wiz-review-line"><span class="wiz-review-label">Código</span><span class="wiz-review-val">${esc(l.codigo_orcamento||'—')}</span></div>
    <div class="wiz-review-line"><span class="wiz-review-label">Cliente</span><span class="wiz-review-val">${esc(nomeStr)}</span></div>
    <div class="wiz-review-line"><span class="wiz-review-label">Documento</span><span class="wiz-review-val">${esc(docStr)}</span></div>
    <div class="wiz-review-line"><span class="wiz-review-label">Valor Original</span><span class="wiz-review-val">${brl(l.valor)}</span></div>
    ${_wizDesconto > 0 ? `<div class="wiz-review-line"><span class="wiz-review-label">Desconto</span><span class="wiz-review-val" style="color:var(--green)">-${_wizDesconto}% → ${brl(Math.round(l.valor*(1-_wizDesconto/100)))}</span></div>` : ''}
    <div class="wiz-review-line"><span class="wiz-review-label">Técnico</span><span class="wiz-review-val">${esc((document.getElementById('aprov-tecnico')?.value||'').trim()||'—')}</span></div>
    ${(document.getElementById('aprov-midia')?.value||'') ? `<div class="wiz-review-line"><span class="wiz-review-label">Mídia/Origem</span><span class="wiz-review-val">${esc(document.getElementById('aprov-midia').value)}</span></div>` : ''}
    ${linhasPag}${anexoStr}`;
}

/* ── Clientes Recorrentes (espelho síncrono do cache Supabase) ── */
function loadClientesRecorrentes(){ return _clientesCache; }

async function popularClienteSelect(){
  const sel = document.getElementById('wiz-cliente-select'); if(!sel) return;
  const clientes = await _refreshClientesCache();
  sel.innerHTML = '<option value="">— Novo cliente —</option>' +
    clientes.map(c => `<option value="${c.id}">${esc(c.nome)} — ${esc(c.doc)}</option>`).join('');

  // Auto-seleciona cliente pré-cadastrado vinculado a este lead
  if(_aprvCurrentLead){
    const preReg = clientes.find(c => String(c.leadId) === String(_aprvCurrentLead.id));
    if(preReg){ sel.value = String(preReg.id); selecionarClienteRecorrente(String(preReg.id)); }
  }
}
function selecionarClienteRecorrente(id){
  const isNovo = !id;
  document.getElementById('wiz-save-client-row').style.display = isNovo ? '' : 'none';
  if(isNovo) return;
  const c = loadClientesRecorrentes().find(x => String(x.id) === String(id)); if(!c) return;
  setDocType(c.tipo || 'CPF');
  if(c.tipo === 'CPF'){
    document.getElementById('aprov-nome-completo').value = c.nome || '';
    document.getElementById('aprov-cpf').value           = c.cpf  || c.doc || '';
  } else {
    document.getElementById('aprov-razao-social').value  = c.razao_social || c.nome || '';
    document.getElementById('aprov-cnpj').value          = c.cnpj || c.doc || '';
    document.getElementById('aprov-nome-contato').value  = c.nome_contato || '';
  }
  document.getElementById('aprov-telefone').value    = c.telefone    || '';
  document.getElementById('aprov-cep').value         = c.cep         || '';
  document.getElementById('aprov-endereco').value    = c.endereco    || '';
  document.getElementById('aprov-bairro').value      = c.bairro      || '';
  document.getElementById('aprov-complemento').value = c.complemento || '';
  if(c.periodo) document.getElementById('aprov-periodo').value = c.periodo;
  if(c.prazo)   document.getElementById('aprov-prazo').value   = c.prazo;
  ['cpf-feedback','cnpj-feedback'].forEach(fbId => {
    const fb = document.getElementById(fbId); if(fb) fb.style.display = 'none';
  });
}
async function salvarClienteRecorrente(leadId){
  const docType = document.getElementById('aprovar-doc-type').value;
  const nome    = docType === 'CPF'
    ? document.getElementById('aprov-nome-completo').value.trim()
    : document.getElementById('aprov-razao-social').value.trim();
  const doc     = docType === 'CPF'
    ? document.getElementById('aprov-cpf').value.trim()
    : document.getElementById('aprov-cnpj').value.trim();
  if(!nome || !doc) return;
  const cliente = {
    leadId:       leadId || null,
    tipo: docType, nome, doc,
    cpf:          docType === 'CPF'  ? doc  : '',
    cnpj:         docType === 'CNPJ' ? doc  : '',
    razao_social: docType === 'CNPJ' ? nome : '',
    nome_contato: docType === 'CNPJ' ? document.getElementById('aprov-nome-contato').value.trim() : '',
    telefone:     document.getElementById('aprov-telefone').value.trim(),
    cep:          document.getElementById('aprov-cep').value.trim(),
    endereco:     document.getElementById('aprov-endereco').value.trim(),
    bairro:       document.getElementById('aprov-bairro').value.trim(),
    complemento:  document.getElementById('aprov-complemento').value.trim(),
    periodo:      document.getElementById('aprov-periodo').value,
    prazo:        document.getElementById('aprov-prazo').value.trim()
  };
  try{
    const digits = doc.replace(/\D/g,'');
    // Remove qualquer registro com o mesmo documento (idempotência) e reinsere
    await crmService.deletarClientesPorDoc(digits);
    const { error } = await crmService.inserirCliente(_clienteToRow(cliente));
    if(error) throw error;
    await _refreshClientesCache();
  }catch(e){ console.warn('salvarClienteRecorrente:', e.message); }
}

/* ── Reset + Abertura do Wizard ── */
function _aprvReset(){
  _wizParcelas = []; _wizAnexo = null; _parcelaIdCtr = 0; _aprvCurrentLead = null;
  const busca = document.getElementById('aprovar-busca'); if(busca) busca.value = '';
  const res   = document.getElementById('aprovar-result'); if(res) res.className = 'aprovar-result';
  ['ar-codigo','ar-nome','ar-valor','ar-status'].forEach(id => { const el = document.getElementById(id); if(el) el.textContent = ''; });
  document.getElementById('aprovar-os').value = '';
  ['aprov-nome-completo','aprov-cpf','aprov-razao-social','aprov-cnpj','aprov-nome-contato',
   'aprov-telefone','aprov-cep','aprov-endereco','aprov-bairro','aprov-complemento',
   'aprov-prazo','aprov-prev-inst']
    .forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
  document.getElementById('aprov-periodo').value = '';
  const avd = document.getElementById('aprov-visita-data'); if(avd) avd.value = '';
  setDocType('CPF');
  ['cpf-feedback','cnpj-feedback'].forEach(id => { const fb = document.getElementById(id); if(fb) fb.style.display = 'none'; });
  document.getElementById('aprovar-lead-id').value = '';
  const wsc = document.getElementById('wiz-salvar-cliente'); if(wsc) wsc.checked = false;
  removerAnexoWiz();
  _wizDesconto = 0;
  const adEl = document.getElementById('aprov-desconto'); if(adEl) adEl.value = '0';
  const vfEl = document.getElementById('aprov-valor-final'); if(vfEl) vfEl.value = '';
  const tecEl = document.getElementById('aprov-tecnico'); if(tecEl) tecEl.value = '';
  const midEl = document.getElementById('aprov-midia'); if(midEl) midEl.value = '';
}

function _preencherDadosLead(lead){
  document.getElementById('aprovar-os').value        = lead.os             || '';
  document.getElementById('aprov-telefone').value    = lead.telefone       || '';
  document.getElementById('aprov-cep').value         = lead.cep            || '';
  document.getElementById('aprov-endereco').value    = lead.endereco       || '';
  document.getElementById('aprov-bairro').value      = lead.bairro         || '';
  document.getElementById('aprov-complemento').value = lead.complemento    || '';
  document.getElementById('aprov-prazo').value       = lead.prazo_entrega  || '';
  document.getElementById('aprov-prev-inst').value   = lead.prev_instalacao|| '';
  if(lead.periodo_obra){ document.getElementById('aprov-periodo').value = lead.periodo_obra; }
  const avd = document.getElementById('aprov-visita-data');
  if(avd){
    if(lead.visita_data){ const[y,m,d]=lead.visita_data.split('-'); avd.value = d+'/'+m+'/'+y; }
    else avd.value = 'Não agendada';
  }
  if(lead.tipo_doc === 'CNPJ'){
    setDocType('CNPJ');
    document.getElementById('aprov-razao-social').value = lead.razao_social  || '';
    document.getElementById('aprov-cnpj').value         = lead.cnpj          || '';
    document.getElementById('aprov-nome-contato').value = lead.nome_contato  || '';
  } else {
    setDocType('CPF');
    document.getElementById('aprov-nome-completo').value = lead.nome || '';
    document.getElementById('aprov-cpf').value           = lead.cpf  || '';
  }
  // N2/N3/N4: preenche desconto, técnico e mídia do lead (edição retroativa)
  _wizDesconto = parseFloat(lead.desconto_pct || 0);
  const adEl = document.getElementById('aprov-desconto'); if(adEl) adEl.value = _wizDesconto || 0;
  const tecEl = document.getElementById('aprov-tecnico'); if(tecEl) tecEl.value = lead.tecnico_responsavel || '';
  const midEl = document.getElementById('aprov-midia'); if(midEl) midEl.value = lead.midia_origem || '';
  atualizarValorComDesconto();

  // Carrega parcelas salvas (com vencimento) da coluna JSONB leads.parcelas
  try{
    let ex = lead.parcelas;
    if(typeof ex === 'string') ex = JSON.parse(ex || '[]');
    if(Array.isArray(ex) && ex.length){
      _wizParcelas = ex;
      _parcelaIdCtr = Math.max(...ex.map(p => p.id || 0), 0);
    }
  }catch{}
}

function abrirAprovarModal(leadId){
  _aprvReset();
  if(leadId){
    const lead = allLeads.find(l => l.id === leadId);
    if(lead){
      _aprvCurrentLead = lead;
      document.getElementById('aprovar-lead-id').value = lead.id;
      _preencherDadosLead(lead);
      popularClienteSelect();
      document.getElementById('aprovar-modal').classList.add('open');
      wizGoTo(1);
      return;
    }
  }
  popularClienteSelect();
  wizGoTo(0);
  document.getElementById('aprovar-modal').classList.add('open');
  setTimeout(() => { const b = document.getElementById('aprovar-busca'); if(b) b.focus(); }, 120);
}

function buscarParaAprovacao(){
  const termo = document.getElementById('aprovar-busca').value.trim().toUpperCase();
  const res   = document.getElementById('aprovar-result');
  _aprvCurrentLead = null; document.getElementById('aprovar-lead-id').value = '';
  if(!termo){ res.className = 'aprovar-result'; return; }
  const lead = allLeads.find(l => (l.codigo_orcamento || '').toUpperCase() === termo);
  if(!lead){
    res.className = 'aprovar-result erro show';
    document.getElementById('ar-codigo').textContent = '';
    document.getElementById('ar-nome').textContent   = 'Código não encontrado: ' + termo;
    document.getElementById('ar-valor').textContent  = '';
    document.getElementById('ar-status').textContent = '';
    return;
  }
  if(lead.status === 'Pedido'){
    res.className = 'aprovar-result erro show';
    document.getElementById('ar-codigo').textContent = lead.codigo_orcamento;
    document.getElementById('ar-nome').textContent   = lead.nome || '—';
    document.getElementById('ar-valor').textContent  = brl(lead.valor);
    document.getElementById('ar-status').textContent = 'Este orçamento já foi aprovado como Pedido' + (lead.os ? ' · OS: ' + lead.os : '');
    return;
  }
  res.className = 'aprovar-result show';
  document.getElementById('ar-codigo').textContent = lead.codigo_orcamento;
  document.getElementById('ar-nome').textContent   = lead.nome || '—';
  document.getElementById('ar-valor').textContent  = brl(lead.valor);
  document.getElementById('ar-status').textContent = 'Status: ' + lead.status + ' · Vendedor: ' + lead.vendedor;
  _aprvCurrentLead = lead;
  document.getElementById('aprovar-lead-id').value = lead.id;
  _preencherDadosLead(lead);
  setTimeout(() => wizGoTo(1), 400);
}

/* ── Confirmar Aprovação (Supabase: leads + Storage relatorios-tecnicos) ── */
async function confirmarAprovacao(){
  const id  = parseInt(document.getElementById('aprovar-lead-id').value); if(!id) return;
  const docType = document.getElementById('aprovar-doc-type').value;
  const os      = document.getElementById('aprovar-os').value.trim();
  const btn     = document.getElementById('btn-confirmar-aprovacao');
  btn.disabled = true; btn.textContent = 'Salvando…';
  try{
    const hoje = new Date().toISOString().split('T')[0];
    const dados = {
      status:'Pedido', os, data_aprovacao: hoje, tipo_doc: docType,
      telefone:      document.getElementById('aprov-telefone').value.trim()   || null,
      cep:           document.getElementById('aprov-cep').value.trim()        || null,
      endereco:      document.getElementById('aprov-endereco').value.trim()   || null,
      bairro:        document.getElementById('aprov-bairro').value.trim()     || null,
      complemento:   document.getElementById('aprov-complemento').value.trim()|| null,
      periodo_obra:  document.getElementById('aprov-periodo').value           || null,
      prazo_entrega: document.getElementById('aprov-prazo').value.trim()      || null,
      prev_instalacao: document.getElementById('aprov-prev-inst').value       || null,
      valor: Math.round(parseFloat(_aprvCurrentLead ? _aprvCurrentLead.valor || 0 : 0) * (1 - (_wizDesconto || 0) / 100)),
      desconto_pct:  _wizDesconto || 0,
      tecnico_responsavel: (document.getElementById('aprov-tecnico')?.value.trim() || null),
      midia_origem:  (document.getElementById('aprov-midia')?.value || null),
    };
    if(docType === 'CPF'){
      dados.nome = document.getElementById('aprov-nome-completo').value.trim();
      dados.cpf  = document.getElementById('aprov-cpf').value.trim() || null;
    } else {
      dados.razao_social  = document.getElementById('aprov-razao-social').value.trim();
      dados.cnpj          = document.getElementById('aprov-cnpj').value.trim() || null;
      dados.nome_contato  = document.getElementById('aprov-nome-contato').value.trim() || null;
    }

    // Persiste parcelas (com datas de vencimento) na coluna JSONB leads.parcelas
    dados.parcelas = _wizParcelas;

    // Herança automática: se visita tinha relatório e wizard não anexou nenhum, herda
    const leadAtual = allLeads.find(l => l.id === id);
    if(!_wizAnexo && leadAtual && leadAtual.visita_relatorio_path){
      dados.relatorio_tecnico_url = leadAtual.visita_relatorio_path;
    }

    // Upload do relatório técnico para o Storage PRIVADO (bucket relatorios-tecnicos)
    if(_wizAnexo && _wizAnexo.file){
      btn.textContent = 'Enviando anexo…';
      const ext  = (_wizAnexo.name.split('.').pop() || 'bin').toLowerCase();
      const path = id + '/relatorio_' + Date.now() + '.' + ext;
      const { error: upErr } = await crmService.uploadRelatorio(path, _wizAnexo.file, _wizAnexo.type);
      if(upErr) throw new Error('Upload do anexo: ' + upErr.message);
      // Guarda apenas o CAMINHO (não a URL). A URL assinada/temporária é gerada
      // sob demanda na hora de abrir — assim o bucket permanece privado (LGPD).
      dados.relatorio_tecnico_url = path;
      btn.textContent = 'Salvando…';
    }

    const { error } = await crmService.atualizarLead(id, dados);
    if(error) throw error;

    // Salva cliente recorrente se marcado (vinculado a este lead)
    if(document.getElementById('wiz-salvar-cliente').checked) await salvarClienteRecorrente(id);

    // Atualiza cache local
    const lead = allLeads.find(l => l.id === id);
    if(lead) Object.assign(lead, dados);

    toast('🎉 Orçamento aprovado como Pedido! OS: ' + os);
    fecharModal('aprovar-modal', true);
    await carregarDados();
  }catch(e){ toast('Erro ao aprovar: ' + e.message, 'err'); }
  finally{ btn.disabled = false; btn.textContent = '✅ Aprovar Pedido'; }
}


/* ══════════════════════════════════════════════════════════════════════
 * 5. HELPERS DE AUTOCOMPLETE POR DOCUMENTO (CPF / CNPJ)
 * ══════════════════════════════════════════════════════════════════════ */

/** Consulta .eq() no Supabase por documento normalizado (apenas dígitos) */
async function _buscarClientePorDoc(digits){
  try{
    const { data, error } = await crmService.buscarClientePorDoc(digits);
    if(error) throw error;
    return (data && data.length) ? _rowToCliente(data[0]) : null;
  }catch(e){ console.warn('autocomplete doc:', e.message); return null; }
}

/** Chamado pelo fmtCPFInput / fmtCNPJInput do wizard step-1 */
async function _autoCompletarPorDoc(digits){
  const match = await _buscarClientePorDoc(digits);
  if(!match) return;
  // Garante que o cache contenha o cliente, então preenche via selecionarClienteRecorrente
  if(!_clientesCache.some(c => String(c.id) === String(match.id))) _clientesCache.push(match);
  selecionarClienteRecorrente(String(match.id));
  const sel = document.getElementById('wiz-cliente-select');
  if(sel) sel.value = String(match.id);
  toast('✓ Cliente encontrado: ' + match.nome);
}

/** Chamado pelo fmtCadCPFInput / fmtCadCNPJInput do cadastro-tecnico-modal */
async function _autoCompletarCadPorDoc(digits){
  const match = await _buscarClientePorDoc(digits);
  if(!match) return;
  _preencherCadModal(match);
  toast('✓ Dados preenchidos automaticamente: ' + match.nome);
}


/* ══════════════════════════════════════════════════════════════════════
 * 6. CRUD — CENTRAL DE CLIENTES RECORRENTES
 * ══════════════════════════════════════════════════════════════════════ */

function abrirGerenciarClientes(){
  _cadEditId = null; _fromGerenciar = false;
  const buscaEl = document.getElementById('clientes-busca');
  if(buscaEl) buscaEl.value = '';
  document.getElementById('gerenciar-clientes-modal').classList.add('open');
  renderListaClientes('');
}

/* ──────────────────────────────────────────────────────────────────────
 * Abre o formulário de cadastro diretamente pelo dashboard de clientes
 * (sem vínculo com orçamento — cliente avulso, leadId = null)
 * ────────────────────────────────────────────────────────────────────── */
function abrirNovoClienteDireto(){
  _cadEditId     = null;
  _cadLeadId     = null;
  _fromGerenciar = true;   // ao salvar, volta para a central de clientes

  /* Limpa todos os campos do formulário */
  ['cad-nome-completo','cad-cpf','cad-razao-social','cad-cnpj','cad-nome-contato',
   'cad-telefone','cad-cep','cad-endereco','cad-bairro','cad-complemento','cad-prazo']
    .forEach(fid => { const el = document.getElementById(fid); if(el) el.value = ''; });
  const perEl = document.getElementById('cad-periodo'); if(perEl) perEl.value = '';
  ['cad-cpf-feedback','cad-cnpj-feedback'].forEach(fid => {
    const fb = document.getElementById(fid); if(fb) fb.style.display = 'none';
  });

  /* Rótulo de referência no topo do modal */
  const refEl = document.getElementById('cad-lead-ref');
  if(refEl) refEl.textContent = '✨ Novo cliente avulso — sem vínculo com orçamento';

  setCadDocType('CPF');
  popularClienteSelectCad();

  /* Fecha o dashboard e abre o formulário de cadastro */
  document.getElementById('gerenciar-clientes-modal').classList.remove('open');
  document.getElementById('cadastro-tecnico-modal').classList.add('open');
}

async function renderListaClientes(filtro){
  const cont = document.getElementById('clientes-lista'); if(!cont) return;
  const q      = (filtro||'').trim();
  const digits = q.replace(/\D/g,'');

  /* Consulta no Supabase: .ilike() em nome/razão social/doc (busca server-side) */
  let filtered = [];
  try{
    const { data, error } = await crmService.buscarClientesFiltro(q, digits);
    if(error) throw error;
    filtered = (data || []).map(_rowToCliente);
  }catch(e){
    cont.innerHTML = `<div style="text-align:center;padding:30px;color:var(--red);font-size:13px">⚠️ Erro ao carregar clientes: ${esc(e.message)}</div>`;
    return;
  }
  // Mantém o cache sincronizado para editar/selecionar
  filtered.forEach(c => { if(!_clientesCache.some(x => String(x.id)===String(c.id))) _clientesCache.push(c); });

  // Atualiza contador
  const ctr = document.getElementById('clientes-contador');
  if(ctr){
    ctr.textContent = q
      ? `${filtered.length} cliente${filtered.length!==1?'s':''} encontrado${filtered.length!==1?'s':''}`
      : `${filtered.length} cliente${filtered.length!==1?'s':''} cadastrado${filtered.length!==1?'s':''}`;
  }

  if(!filtered.length){
    cont.innerHTML = `<div style="text-align:center;padding:36px 20px;color:var(--text-muted);font-size:13px">
      ${q ? '🔍 Nenhum cliente encontrado para "'+esc(q)+'"' : '📭 Nenhum cliente cadastrado ainda.<br><span style="font-size:12px;margin-top:6px;display:block">Agende uma visita técnica para pré-cadastrar o primeiro cliente.</span>'}
    </div>`;
    return;
  }

  cont.innerHTML = filtered.map(c => `
    <div style="display:flex;align-items:center;gap:10px;padding:11px 12px;background:var(--bg-card2);border-radius:9px;border:1px solid var(--border);margin-bottom:7px">
      <div style="width:36px;height:36px;border-radius:50%;background:var(--accent-glow);border:1px solid rgba(91,110,245,.35);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0">
        ${(c.tipo||'CPF')==='CPF'?'👤':'🏢'}
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;font-size:13px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(c.nome||c.razao_social||'—')}</div>
        <div style="font-size:11px;color:var(--text-muted);font-family:'DM Mono',monospace;margin-top:2px">
          ${esc(c.tipo||'CPF')} · ${esc(c.doc||'—')}${c.telefone?' &nbsp;·&nbsp; '+esc(c.telefone):''}
        </div>
        ${c.endereco?`<div style="font-size:11px;color:var(--text-muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">📍 ${esc(c.endereco+(c.bairro?', '+c.bairro:''))}</div>`:''}
      </div>
      <button title="Editar" onclick="editarClienteRecorrente(${c.id})"
        style="padding:7px 9px;background:var(--accent-glow);border:1px solid rgba(91,110,245,.4);border-radius:7px;color:var(--accent);cursor:pointer;font-size:13px;line-height:1;flex-shrink:0;transition:.15s"
        onmouseover="this.style.background='var(--accent)';this.style.color='white'"
        onmouseout="this.style.background='var(--accent-glow)';this.style.color='var(--accent)'">✏️</button>
      <button title="Excluir permanentemente" onclick="excluirClienteRecorrente(${c.id})"
        style="padding:7px 9px;background:var(--red-dim);border:1px solid rgba(240,81,106,.3);border-radius:7px;color:var(--red);cursor:pointer;font-size:13px;line-height:1;flex-shrink:0;transition:.15s"
        onmouseover="this.style.background='var(--red)';this.style.color='white'"
        onmouseout="this.style.background='var(--red-dim)';this.style.color='var(--red)'">🗑️</button>
    </div>`).join('');
}

function editarClienteRecorrente(clienteId){
  const c = loadClientesRecorrentes().find(x => String(x.id) === String(clienteId)); if(!c) return;
  _cadEditId     = clienteId;
  _fromGerenciar = true;
  _cadLeadId     = c.leadId || null;
  const refEl = document.getElementById('cad-lead-ref');
  if(refEl) refEl.textContent =
    c.leadId ? '✏️ Editando cliente (Lead #'+c.leadId+')' : '✏️ Editando cliente existente';
  _preencherCadModal(c);
  popularClienteSelectCad();
  document.getElementById('gerenciar-clientes-modal').classList.remove('open');
  document.getElementById('cadastro-tecnico-modal').classList.add('open');
}

function excluirClienteRecorrente(clienteId){
  const c = loadClientesRecorrentes().find(x => String(x.id) === String(clienteId)); if(!c) return;
  const ex = document.getElementById('crm-confirm-excluir'); if(ex) ex.remove();
  const dlg = document.createElement('div');
  dlg.id = 'crm-confirm-excluir';
  dlg.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;z-index:10000';
  dlg.innerHTML = `
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:16px;padding:28px 32px;max-width:380px;width:92%;text-align:center;box-shadow:0 24px 64px rgba(0,0,0,.5)">
      <div style="font-size:32px;margin-bottom:12px">🗑️</div>
      <div style="font-size:15px;font-weight:700;margin-bottom:12px;color:var(--text)">Excluir permanentemente?</div>
      <div style="padding:10px 14px;background:var(--bg-card2);border-radius:9px;margin-bottom:12px">
        <div style="font-size:14px;font-weight:700;color:var(--text)">${esc(c.nome||c.razao_social||'—')}</div>
        <div style="font-size:11px;font-family:'DM Mono',monospace;color:var(--text-muted);margin-top:3px">${esc(c.tipo||'CPF')} · ${esc(c.doc||'—')}</div>
      </div>
      <div style="font-size:12px;color:var(--red);padding:8px 12px;background:var(--red-dim);border-radius:7px;margin-bottom:22px;border:1px solid rgba(240,81,106,.25)">
        ⚠️ Esta ação é irreversível e não pode ser desfeita.
      </div>
      <div style="display:flex;gap:10px;justify-content:center">
        <button onclick="document.getElementById('crm-confirm-excluir').remove()"
          style="padding:10px 18px;background:var(--bg-card2);border:1px solid var(--border);border-radius:8px;color:var(--text);cursor:pointer;font-size:13px;font-weight:600">Cancelar</button>
        <button onclick="_confirmarExclusaoCliente(${clienteId})"
          style="padding:10px 18px;background:var(--red);border:none;border-radius:8px;color:white;cursor:pointer;font-size:13px;font-weight:600">Confirmar Exclusão</button>
      </div>
    </div>`;
  document.body.appendChild(dlg);
}

async function _confirmarExclusaoCliente(clienteId){
  const ex = document.getElementById('crm-confirm-excluir'); if(ex) ex.remove();
  try{
    const { error } = await crmService.deletarCliente(clienteId);
    if(error) throw error;
    _clientesCache = _clientesCache.filter(c => String(c.id) !== String(clienteId));
    toast('🗑️ Cliente removido da central de clientes.');
  }catch(e){ toast('Erro ao excluir: ' + e.message, 'err'); return; }
  renderListaClientes(document.getElementById('clientes-busca')?.value || '');
}


/* ══════════════════════════════════════════════════════════════════════
 * 7. BOOT — pré-carrega o cache de clientes do Supabase
 * ══════════════════════════════════════════════════════════════════════ */
if(typeof db !== 'undefined' && db){ _refreshClientesCache(); }
else document.addEventListener('DOMContentLoaded', () => { if(typeof db !== 'undefined' && db) _refreshClientesCache(); });
