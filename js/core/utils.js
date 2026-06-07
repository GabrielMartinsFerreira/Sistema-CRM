/* ═══════════════════════════════════════════════════════════════════════
 * js/core/utils.js — Utilitários puros e compartilhados (GG TECH CRM)
 * ───────────────────────────────────────────────────────────────────────
 * Carregado como <script> clássico. Centraliza funções antes duplicadas
 * nos 4 arquivos. Expõe cada função no escopo global (retrocompat com os
 * handlers inline) E agrupadas em window.Utils.
 * ═══════════════════════════════════════════════════════════════════════ */

/* Escapa HTML para uso seguro em innerHTML */
function esc(s){
  return String(s||'')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* Formata número como moeda BRL */
function brl(v){
  return parseFloat(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
}

/* Converte 'YYYY-MM-DD' → 'DD/MM/YYYY' */
function fmtDate(d){
  if(!d) return '—';
  try{ const [y,m,dd]=String(d).split('-'); return `${dd}/${m}/${y}`; }catch{ return d; }
}

/* Classe CSS a partir de um status (slug) */
function badgeClass(s){ return (s||'').toLowerCase().replace(/[^a-z]/g,''); }

/* Lê valor numérico de um input por id */
function num(id){ const el=document.getElementById(id); return el?parseFloat(el.value)||0:0; }

/* Toast unificado:
 *  - Se existir #toast no DOM (index.html), usa o elemento dedicado.
 *  - Caso contrário (faturamento/relatorios), cria um toast flutuante.
 *  type: 'ok' (default) | 'err' | 'warn'
 */
function toast(msg, type='ok'){
  const fixed = document.getElementById('toast');
  if(fixed){
    const icon = type==='err' ? '❌ ' : type==='warn' ? '⚠️ ' : '✅ ';
    fixed.textContent = icon + msg;
    fixed.className = 'show ' + type;
    clearTimeout(fixed._t);
    fixed._t = setTimeout(()=>{ fixed.className=''; }, 3600);
    return;
  }
  const t = document.createElement('div');
  let style;
  if(type==='err')       style='background:var(--red-dim);color:var(--red);border:1px solid rgba(240,81,106,.4)';
  else if(type==='warn') style='background:var(--yellow-dim);color:var(--yellow);border:1px solid rgba(245,197,66,.45)';
  else                   style='background:rgba(34,212,143,.15);color:var(--green);border:1px solid rgba(34,212,143,.35)';
  t.style.cssText='position:fixed;bottom:24px;right:24px;padding:12px 18px;border-radius:10px;font-size:13px;font-weight:600;z-index:9999;pointer-events:none;transition:opacity .3s;box-shadow:0 8px 24px rgba(0,0,0,.4);max-width:340px;line-height:1.4;'+style;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(()=>{ t.style.opacity='0'; setTimeout(()=>t.remove(),300); }, 4200);
}

/* Namespace agrupado (uso preferencial em código novo) */
const Utils = { esc, brl, fmtDate, badgeClass, num, toast };
window.Utils = Utils;
