/* ═══ js/modules/ficha-pdf.js ════════════════════════════════════════════
 * Módulo de Geração da Ficha de Pedido em PDF (3 páginas A4 landscape)
 *   Pág. 1 — Ordem de Serviço (cliente, pagamentos, instalação)
 *   Pág. 2 — Termo de Garantia e Condições Comerciais
 *   Pág. 3 — Relatório Técnico (descritivo, fotos, painel lateral)
 *
 * Dependências (carregadas ANTES via <script> clássico):
 *   - html2canvas + jsPDF (CDN jsdelivr — único permitido pelo CSP)
 *   - js/core/supabase.js  → db, STORAGE_BUCKET
 *   - js/core/utils.js     → esc, toast
 *   - js/services/crmService.js → uploadRelatorio, urlAssinadaRelatorio, atualizarLead
 *   - inline de faturamento.html → _allPedidosBrutos
 * Carregado apenas por faturamento.html (onde vive a Ficha OS).
 * ════════════════════════════════════════════════════════════════════════ */

/* ─── Utilitários de formatação (escopo do módulo — não colidem com utils) ── */
function fichaBRL(value){
  const num = Number(value) || 0;
  return num.toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
}
function fichaDateBR(isoDate){
  if(!isoDate) return '___';
  const [y,m,d] = String(isoDate).split('-');
  return `${d}/${m}/${y}`;
}
const FICHA_MESES_PT = ['janeiro','fevereiro','março','abril','maio','junho',
                        'julho','agosto','setembro','outubro','novembro','dezembro'];
function fichaDataExtenso(isoDate){
  if(!isoDate) return { dia:'___', mes:'___', ano:'___' };
  const [y,m,d] = String(isoDate).split('-');
  return { dia:String(Number(d)), mes:FICHA_MESES_PT[Number(m)-1], ano:y };
}

/* ─── Logo (a imagem some sozinha se assets/icon-conceito.png não existir) ── */
function buildLogoBlock(){
  return `
    <div class="ficha-logo">
      <img src="assets/icon-conceito.png" alt="" onerror="this.style.display='none'">
      <div class="ficha-logo-text">
        <span class="logo-conceito">conceito</span>
        <span class="logo-sub">vidros &amp; projetos</span>
      </div>
    </div>
  `;
}

/* ─── Página 1 — Ordem de Serviço ──────────────────────────────────────── */
function buildPaginaOS(p){
  const dataExt = fichaDataExtenso(p.dataAtual);

  const linhasPagamento = [];
  for(let i = 0; i < 3; i++){
    const pg = p.pagamentos[i];
    linhasPagamento.push(`
      <tr>
        <td>${pg ? `${String(i+1).padStart(2,'0')}/${String(Math.min(p.pagamentos.length,3)).padStart(2,'0')}` : '-'}</td>
        <td>${pg ? fichaDateBR(pg.vencimento) : '-'}</td>
        <td>${pg ? fichaBRL(pg.valor) : '-'}</td>
        <td>${pg ? esc(pg.via || pg.tipo || '-') : '-'}</td>
      </tr>
    `);
  }

  const totalPg = p.pagamentos.reduce((acc,pg) => acc + (Number(pg.valor)||0), 0);
  const diurnaMark  = (p.periodoObra||'').includes('Diurna')  ? 'x' : '';
  const noturnaMark = (p.periodoObra||'').includes('Noturna') ? 'x' : '';

  return `
  <div class="ficha-page">
    ${buildLogoBlock()}
    <div class="ficha-titulo">
      <h2>ORDEM DE SERVIÇO - CONCEITO VIDROS &amp; PROJETOS</h2>
      <p>CNPJ 44.126.677/0001-46</p>
    </div>
    <table class="os-table">
      <tr>
        <td colspan="2">São Paulo, ${dataExt.dia} de ${dataExt.mes} de ${dataExt.ano}</td>
        <td class="os-numero">OS ${esc(p.numeroOS||'----')}</td>
      </tr>
      <tr>
        <td colspan="2">Cliente: ${esc(p.nomeCliente||'-')}</td>
        <td>Contato: ${esc(p.contato||'-')}</td>
      </tr>
      <tr>
        <td colspan="2">${esc(p.tipoDocumento||'CPF')}: ${esc(p.documento||'-')}</td>
        <td>Telefone: ${esc(p.telefone||'-')}</td>
      </tr>
      <tr>
        <td colspan="2">Endereço: ${esc(p.endereco||'-')}${p.numero ? ', '+esc(p.numero) : ''}</td>
        <td>Complemento: ${esc(p.complemento||'-')}</td>
      </tr>
      <tr>
        <td>CEP: ${esc(p.cep||'-')}</td>
        <td>Cidade: ${esc(p.cidade||'-')}${p.estado ? '/'+esc(p.estado) : ''}</td>
        <td>Bairro: ${esc(p.bairro||'-')}</td>
      </tr>
      <tr class="os-divider"><td colspan="3"></td></tr>
      <tr>
        <td>Mídia: ${esc(p.midia||'-')}</td>
        <td>Consultor(a): ${esc(p.consultor||'-')}</td>
        <td>Técnico: ${esc(p.tecnico||'-')}</td>
      </tr>
      <tr class="os-divider"><td colspan="3"></td></tr>
    </table>

    <div class="os-section-title">CONDIÇÃO DE PAGAMENTO</div>
    <table class="pagamento-table">
      <thead>
        <tr><th>Parcelas</th><th>Vencimento</th><th>Valor</th><th>Via</th></tr>
      </thead>
      <tbody>
        ${linhasPagamento.join('')}
        <tr class="total-row">
          <td colspan="4">Valor total: ${fichaBRL(totalPg)}</td>
        </tr>
      </tbody>
    </table>

    <div class="os-divider-bar"></div>
    <div class="os-section-title">INFORMAÇÕES SOBRE INSTALAÇÃO</div>
    <table class="pagamento-table instalacao-table">
      <tbody>
        <tr>
          <td class="periodo-cell">Diurna ( ${diurnaMark} )</td>
          <td class="periodo-cell">Noturna ( ${noturnaMark} )</td>
          <td colspan="2">Data da medição: ${fichaDateBR(p.dataMedicao)}</td>
        </tr>
        <tr>
          <td colspan="4">Previsão de instalação: ${esc(p.previsaoInstalacao||'-')}</td>
        </tr>
      </tbody>
    </table>
  </div>
  `;
}

/* ─── Página 2 — Termo de Garantia ─────────────────────────────────────── */
function buildPaginaTermos(){
  return `
  <div class="ficha-page termos">
    ${buildLogoBlock()}
    <h2>TERMO DE GARANTIA - CONCEITO VIDROS &amp; PROJETOS</h2>
    <div class="termos-box">
      <h4>1. Condições Comerciais</h4>
      <ol>
        <li>A ordem de serviço deve ser elaborada com base nas informações fornecidas pelo responsável técnico durante a medição e aprovada pelo cliente.</li>
        <li>Situações não previstas estarão sujeitas a orçamento prévio.</li>
        <li>Não está incluso içamento de peças, apenas transporte via elevador ou até 3 lances de escada.</li>
        <li>Pagamento de parcela vinculada à conclusão de instalação só serão prorrogadas em caso de adiamento por conta da Conceito Vidros. Atrasos em obras por questões técnicas, por parte do cliente, o pagamento deve ser feito na data acordada.</li>
        <li>Cancelamentos após 2 dias da aprovação não terão devolução do sinal.</li>
        <li>Após o início da produção ou instalação, não será permitido cancelamento, pois os materiais são feitos sob medida. Alterações posteriores poderão gerar novos custos.</li>
        <li>Em caso de adiamento solicitado pelo cliente, será acrescido prazo de 3 dias úteis para reprogramação.</li>
        <li>O prazo de instalação é contado a partir da medição técnica final e, em caso de parcelamento, após o pagamento da primeira parcela.</li>
        <li>A produção poderá ser suspensa caso haja impedimentos na obra (acabamentos não finalizados, ausência de estrutura adequada, etc.).</li>
        <li>Caso o cliente autorize a produção com medidas coletadas em obra incompleta, deverá formalizar sua responsabilidade por escrito.</li>
      </ol>
      <h4>2. Compromissos da Empresa</h4>
      <ol>
        <li>Fornecimento de mão de obra própria, qualificada e treinada.</li>
        <li>Fornecimento de materiais, ferramentas e EPIs necessários à instalação.</li>
        <li>Preços incluem entrega e montagem.</li>
        <li>Frete incluso em até 40 km; acima disso, será cobrado valor adicional.</li>
        <li>Transporte horizontal até 15 m do caminhão e vertical via elevador (exceto içamento), bem como retirada de resíduos, são de responsabilidade da empresa.</li>
        <li>Instalações fora do horário comercial poderão ter taxa adicional.</li>
        <li>Cancelamento de serviço noturno (após 18h) sem aviso prévio implicará taxa de R$ 650,00.</li>
        <li>É responsabilidade do cliente fornecer planta hidráulica; danos por perfuração de tubulações sem essa informação serão de sua responsabilidade.</li>
      </ol>
      <h4>3. Garantia</h4>
      <ol>
        <li>Garantia de 12 meses contra defeitos de fabricação ou instalação, contados da data do pedido.</li>
        <li>Não há garantia para quebra de vidro, exceto se causada pela equipe durante a instalação ou em até 24 horas após a conclusão.</li>
        <li>Prazo para manutenção: 5 a 7 dias úteis após solicitação.</li>
        <li>Ao final da instalação, um responsável deverá conferir e assinar o termo de conclusão.</li>
      </ol>
    </div>
  </div>
  `;
}

/* ─── Página 3 — Relatório Técnico ─────────────────────────────────────── */
function buildPaginaRelatorio(p){
  const placeholderImg = 'data:image/svg+xml;utf8,' + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
      <rect width="200" height="200" fill="#eef4fb"/>
      <text x="100" y="108" font-size="13" text-anchor="middle" fill="#9aa7b8" font-family="Segoe UI, sans-serif">Sem imagem</text>
    </svg>
  `);

  const img1 = p.imagens && p.imagens.imagem1 ? p.imagens.imagem1 : placeholderImg;
  const img2 = p.imagens && p.imagens.imagem2 ? p.imagens.imagem2 : placeholderImg;
  const d = p.descritivo || {};

  return `
  <div class="ficha-page ficha-page-relatorio">
    <div class="relatorio">
      <div class="relatorio-main">
        <h2 class="relatorio-title">RELATÓRIO TÉCNICO - CONCEITO VIDROS &amp; PROJETOS</h2>
        <div class="relatorio-spacer"></div>
        <div class="relatorio-content">
          <div class="descritivo-box">
            <div class="descritivo-titulo">DESCRITIVO</div>
            <p>ITEM: <span>${esc(d.item||'-')}</span></p>
            <p>VIDRO: <span>${esc(d.vidro||'-')}</span></p>
            <p>ESTRUTURA: <span>${esc(d.estrutura||'-')}</span></p>
            <p>Outros: <span>${esc(d.outros||'-')}</span></p>
          </div>
          <div class="relatorio-imagens">
            <h3>IMAGENS</h3>
            <div class="imgs-row">
              <img src="${img1}" alt="Imagem do ambiente 1">
              <img src="${img2}" alt="Imagem do ambiente 2">
            </div>
          </div>
        </div>
        <div class="assinaturas">
          <div>Assinatura Cliente</div>
          <div>Assinatura Responsável</div>
        </div>
      </div>

      <div class="relatorio-side">
        <div class="logo-box">
          <div class="logo-arch">
            <img src="assets/icon-conceito.png" alt="" onerror="this.style.display='none'">
            <div class="ficha-logo-text small">
              <span class="logo-conceito">conceito</span>
              <span class="logo-sub">vidros &amp; projetos</span>
            </div>
          </div>
        </div>
        <div class="side-block">
          <div class="side-cell"><span class="side-cell-text">Contato.: ${esc(p.contato||'-')}</span></div>
          <div class="side-cell"><span class="side-cell-text">Bairro: ${esc(p.bairro||'-')}</span></div>
          <div class="side-cell"><span class="side-cell-text">Telefone: ${esc(p.telefone||'-')}</span></div>
        </div>
        <div class="side-block">
          <div class="side-cell"><span class="side-cell-text">Cliente: ${esc(p.nomeCliente||'-')}</span></div>
          <div class="side-cell"><span class="side-cell-text">Endereço: ${esc(p.endereco||'-')}${p.numero ? ', '+esc(p.numero) : ''}</span></div>
          <div class="side-cell"><span class="side-cell-text">Complemento: ${esc(p.complemento||'-')}</span></div>
        </div>
        <div class="side-block side-block-last">
          <div class="side-cell-empty"></div>
          <div class="side-cell"><span class="side-cell-text">CEP: ${esc(p.cep||'-')}</span></div>
          <div class="side-cell-empty"></div>
        </div>
        <div class="side-os">OS ${esc(p.numeroOS||'----')}</div>
      </div>
    </div>
  </div>
  `;
}

/* ─── Geração do PDF (html2canvas → jsPDF) ─────────────────────────────── */
async function gerarFichaPDF(pedido, btnRef = null){
  const fichaContainer = document.getElementById('ficha-container');
  if(!fichaContainer){ toast('Container da ficha não encontrado','err'); return; }

  if(btnRef){ btnRef.textContent = 'Gerando PDF…'; btnRef.disabled = true; }

  fichaContainer.innerHTML =
    buildPaginaOS(pedido) +
    buildPaginaTermos() +
    buildPaginaRelatorio(pedido);

  // Aguarda carregamento das imagens (logo e fotos do ambiente)
  const imgs = fichaContainer.querySelectorAll('img');
  await Promise.all(Array.from(imgs).map(img => {
    if(img.complete) return Promise.resolve();
    return new Promise(resolve => { img.onload = resolve; img.onerror = resolve; });
  }));

  try{
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation:'landscape', unit:'px', format:[1123,794] });

    const pages = fichaContainer.querySelectorAll('.ficha-page');
    for(let i = 0; i < pages.length; i++){
      const canvas = await html2canvas(pages[i], { scale:2, useCORS:true, backgroundColor:'#ffffff' });
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      if(i > 0) pdf.addPage([1123,794], 'landscape');
      pdf.addImage(imgData, 'JPEG', 0, 0, 1123, 794);
    }

    const nomeArquivo = `OS_${pedido.numeroOS||'sem_numero'}_${(pedido.nomeCliente||'cliente').replace(/\s+/g,'_')}.pdf`;
    pdf.save(nomeArquivo);
    toast('📄 Ficha PDF gerada com sucesso!');
  }catch(err){
    console.error('Erro ao gerar PDF:', err);
    toast('Erro ao gerar o PDF: ' + (err.message||err), 'err');
  }finally{
    fichaContainer.innerHTML = '';
    if(btnRef){ btnRef.textContent = '📄 Gerar PDF'; btnRef.disabled = false; }
  }
}

/* ══════════════════════════════════════════════════════════════════════
 * MODAL PRÉ-PDF — confere/completa dados da ficha antes de gerar
 * ══════════════════════════════════════════════════════════════════════ */
let _fichaLeadId = null;

function abrirFichaPdfModal(leadId){
  const p = _allPedidosBrutos.find(x => x.id === leadId); if(!p) return;
  _fichaLeadId = leadId;

  const g = id => document.getElementById(id);
  const desc = (() => {
    try{ let d = p.ficha_descritivo; if(typeof d === 'string') d = JSON.parse(d||'{}'); return d||{}; }
    catch{ return {}; }
  })();

  g('fp-contato').value   = p.nome_contato || p.nome || '';
  g('fp-midia').value     = p.midia_origem || '';
  g('fp-consultor').value = p.vendedor || '';
  g('fp-tecnico').value   = p.tecnico_responsavel || '';
  g('fp-medicao').value   = p.visita_data || '';
  g('fp-prev-inst').value = p.prev_instalacao || '';
  g('fp-numero').value    = p.endereco_numero || '';
  g('fp-cidade').value    = p.cidade || 'São Paulo';
  g('fp-estado').value    = p.estado || 'SP';
  g('fp-item').value      = desc.item || p.produto || '';
  g('fp-vidro').value     = desc.vidro || '';
  g('fp-estrutura').value = desc.estrutura || '';
  g('fp-outros').value    = desc.outros || '';
  g('fp-foto1').value = ''; g('fp-foto2').value = '';
  g('fp-foto1-atual').style.display = p.ficha_foto1_path ? '' : 'none';
  g('fp-foto2-atual').style.display = p.ficha_foto2_path ? '' : 'none';

  document.getElementById('ficha-pdf-modal').classList.add('open');
}

function fecharFichaPdfModal(){
  document.getElementById('ficha-pdf-modal').classList.remove('open');
  _fichaLeadId = null;
}

/* Converte path do Storage privado → base64 data URL (via signed URL) */
async function _fotoPathParaBase64(path){
  if(!path) return null;
  try{
    const { data, error } = await crmService.urlAssinadaRelatorio(path, 600);
    if(error || !data?.signedUrl) throw error || new Error('sem URL');
    const resp = await fetch(data.signedUrl);
    if(!resp.ok) throw new Error('HTTP ' + resp.status);
    const blob = await resp.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }catch(e){ console.warn('foto ficha:', e.message||e); return null; }
}

/* Salva os dados do modal no lead, faz upload das fotos e dispara o PDF */
async function confirmarGerarPdf(){
  const leadId = _fichaLeadId; if(!leadId) return;
  const p = _allPedidosBrutos.find(x => x.id === leadId); if(!p) return;
  const g = id => document.getElementById(id);
  const btn = g('fp-btn-gerar');
  btn.disabled = true; btn.textContent = 'Preparando…';

  try{
    /* 1. Upload das fotos novas (se selecionadas) para o bucket privado */
    const upd = {};
    for(const [inputId, col] of [['fp-foto1','ficha_foto1_path'], ['fp-foto2','ficha_foto2_path']]){
      const file = g(inputId).files[0];
      if(!file) continue;
      if(file.size > 10*1024*1024){ throw new Error('Foto muito grande — máx. 10 MB'); }
      const ext  = (file.name.split('.').pop()||'jpg').toLowerCase();
      const path = leadId + '/ficha_' + inputId.replace('fp-','') + '_' + Date.now() + '.' + ext;
      btn.textContent = 'Enviando fotos…';
      const { error: upErr } = await crmService.uploadRelatorio(path, file, file.type);
      if(upErr) throw new Error('Upload foto: ' + upErr.message);
      upd[col] = path;
    }

    /* 2. Persiste dados complementares no lead */
    upd.nome_contato        = g('fp-contato').value.trim()   || null;
    upd.midia_origem        = g('fp-midia').value            || null;
    upd.tecnico_responsavel = g('fp-tecnico').value.trim()   || null;
    upd.endereco_numero     = g('fp-numero').value.trim()    || null;
    upd.cidade              = g('fp-cidade').value.trim()    || null;
    upd.estado              = g('fp-estado').value.trim().toUpperCase().slice(0,2) || null;
    upd.prev_instalacao     = g('fp-prev-inst').value        || null;
    upd.ficha_descritivo    = {
      item:      g('fp-item').value.trim(),
      vidro:     g('fp-vidro').value.trim(),
      estrutura: g('fp-estrutura').value.trim(),
      outros:    g('fp-outros').value.trim()
    };
    btn.textContent = 'Salvando dados…';
    const { error } = await crmService.atualizarLead(leadId, upd);
    if(error) throw error;
    Object.assign(p, upd);

    /* 3. Converte fotos do Storage → base64 (necessário para o html2canvas) */
    btn.textContent = 'Carregando fotos…';
    const [img1, img2] = await Promise.all([
      _fotoPathParaBase64(p.ficha_foto1_path),
      _fotoPathParaBase64(p.ficha_foto2_path)
    ]);

    /* 4. Mapeia o lead → estrutura `pedido` esperada pelo módulo PDF */
    const parcelas = (() => {
      try{ let x = p.parcelas; if(typeof x === 'string') x = JSON.parse(x||'[]'); return Array.isArray(x) ? x : []; }
      catch{ return []; }
    })();
    const valorTotal = Math.round(parseFloat(p.valor||0));
    const pagamentos = parcelas.map(px => ({
      tipo:       px.condicao || 'Parcela',
      vencimento: px.vencimento || '',
      valor:      px.valor_reais != null ? px.valor_reais : Math.round(valorTotal*(parseFloat(px.pct)||0)/100),
      via:        px.metodo || '-'
    }));

    const pedido = {
      numeroOS:      p.os || '',
      dataAtual:     p.data_aprovacao || new Date().toISOString().slice(0,10),
      nomeCliente:   p.razao_social || p.nome || '',
      contato:       upd.nome_contato || '',
      tipoDocumento: p.tipo_doc || 'CPF',
      documento:     p.tipo_doc === 'CNPJ' ? (p.cnpj||'') : (p.cpf||''),
      telefone:      p.telefone || '',
      midia:         upd.midia_origem || '',
      cep:           p.cep || '',
      endereco:      p.endereco || '',
      numero:        upd.endereco_numero || '',
      complemento:   p.complemento || '',
      bairro:        p.bairro || '',
      cidade:        upd.cidade || '',
      estado:        upd.estado || '',
      consultor:     g('fp-consultor').value.trim() || p.vendedor || '',
      tecnico:       upd.tecnico_responsavel || '',
      dataMedicao:   g('fp-medicao').value || p.visita_data || '',
      previsaoInstalacao: upd.prev_instalacao ? fichaDateBR(upd.prev_instalacao) : (p.prazo_entrega||'-'),
      periodoObra:   p.periodo_obra || '',
      pagamentos,
      descritivo:    upd.ficha_descritivo,
      imagens:       { imagem1: img1, imagem2: img2 }
    };

    fecharFichaPdfModal();
    await gerarFichaPDF(pedido, document.getElementById('btn-gerar-pdf-ficha'));
  }catch(e){
    toast('Erro: ' + (e.message||e), 'err');
  }finally{
    btn.disabled = false; btn.textContent = '📄 Gerar PDF';
  }
}
