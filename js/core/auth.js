/* ═══════════════════════════════════════════════════════════════════════
 * js/core/auth.js — Autenticação (Supabase Auth) + gate de sessão
 * ───────────────────────────────────────────────────────────────────────
 * Carregado como <script> clássico LOGO APÓS supabase.js e ANTES dos
 * serviços/inline. Expõe window.authGate(): bloqueia o carregamento de
 * dados enquanto não houver sessão válida (mostra tela de login).
 * Depende de: db (js/core/supabase.js, com auth do @supabase/supabase-js)
 * ═══════════════════════════════════════════════════════════════════════ */
let _authSession = null;

/* ── Throttle de login (anti-brute-force client-side) ── */
let _loginAttempts   = 0;
let _loginBlockedUntil = 0;   // timestamp ms — 0 = não bloqueado

/* Chamado no início de cada loader de página.
 * → true  = autenticado (segue o fluxo normal)
 * → false = sem sessão (mostra login e ABORTA o carregamento) */
async function authGate(){
  try{
    const { data:{ session } } = await db.auth.getSession();
    _authSession = session;
    if(session){ _renderUserBar(session); return true; }
  }catch(e){ console.warn('auth getSession:', e.message); }
  _renderLogin();
  return false;
}
window.authGate = authGate;

function _setAuthMsg(m){ const el=document.getElementById('auth-msg'); if(el) el.textContent=m||''; }

function _renderLogin(){
  if(document.getElementById('auth-overlay')) return;
  const o=document.createElement('div');
  o.id='auth-overlay';
  o.style.cssText='position:fixed;inset:0;z-index:100000;background:#0c0e16;display:flex;align-items:center;justify-content:center;font-family:"DM Sans",system-ui,sans-serif';
  o.innerHTML=`
    <div style="background:#11131d;border:1px solid #252840;border-radius:16px;padding:34px 32px;width:340px;max-width:92%;box-shadow:0 24px 64px rgba(0,0,0,.6)">
      <div style="font-size:20px;font-weight:800;color:#dde1f0;margin-bottom:4px">🔒 GG TECH CRM</div>
      <div style="font-size:13px;color:#8890b0;margin-bottom:22px">Acesso restrito — faça login para continuar</div>
      <input id="auth-email" type="email" placeholder="E-mail" autocomplete="username"
        style="width:100%;box-sizing:border-box;padding:11px 13px;margin-bottom:10px;background:#0c0e16;border:1px solid #252840;border-radius:9px;color:#dde1f0;font-size:14px;outline:none">
      <input id="auth-pass" type="password" placeholder="Senha" autocomplete="current-password"
        style="width:100%;box-sizing:border-box;padding:11px 13px;margin-bottom:8px;background:#0c0e16;border:1px solid #252840;border-radius:9px;color:#dde1f0;font-size:14px;outline:none">
      <div id="auth-msg" style="font-size:12px;color:#f0516a;min-height:16px;margin-bottom:10px"></div>
      <button id="auth-btn" style="width:100%;padding:12px;background:#5b6ef5;border:none;border-radius:9px;color:#fff;font-weight:700;font-size:14px;cursor:pointer">Entrar</button>
    </div>`;
  document.body.appendChild(o);

  const submit=async()=>{
    const email=document.getElementById('auth-email').value.trim();
    const pass =document.getElementById('auth-pass').value;
    const btn  =document.getElementById('auth-btn');
    if(!email||!pass){ _setAuthMsg('Informe e-mail e senha.'); return; }

    /* Throttle: bloqueio temporário após 3 tentativas consecutivas */
    const agora=Date.now();
    if(_loginBlockedUntil > agora){
      const restante=Math.ceil((_loginBlockedUntil - agora)/1000);
      _setAuthMsg(`Muitas tentativas. Aguarde ${restante}s antes de tentar novamente.`);
      return;
    }

    btn.disabled=true; btn.textContent='Entrando…'; _setAuthMsg('');
    try{
      const { error } = await db.auth.signInWithPassword({ email, password:pass });
      if(error) throw error;
      _loginAttempts=0;                   // sucesso → zera contador
      location.reload();                  // sessão criada → recarrega autenticado
    }catch(e){
      _loginAttempts++;
      if(_loginAttempts>=3){
        _loginBlockedUntil=Date.now()+30000;  // bloqueia 30 segundos
        _loginAttempts=0;
        _setAuthMsg('Acesso bloqueado por 30s após 3 tentativas incorretas.');
        btn.disabled=true; btn.textContent='Bloqueado (30s)';
        setTimeout(()=>{ btn.disabled=false; btn.textContent='Entrar'; _setAuthMsg(''); }, 30000);
        return;
      }
      const restantes=3-_loginAttempts;
      _setAuthMsg(`Falha no login: ${e.message||e} (${restantes} tentativa${restantes!==1?'s':''} restante${restantes!==1?'s':''})`);
      btn.disabled=false; btn.textContent='Entrar';
    }
  };
  document.getElementById('auth-btn').addEventListener('click', submit);
  document.getElementById('auth-pass').addEventListener('keydown', e=>{ if(e.key==='Enter') submit(); });
  setTimeout(()=>{ const el=document.getElementById('auth-email'); if(el) el.focus(); }, 120);
}

function _renderUserBar(session){
  if(document.getElementById('auth-userbar')) return;
  const email=(session && session.user && session.user.email) || 'usuário';
  const bar=document.createElement('div');
  bar.id='auth-userbar';
  bar.style.cssText='position:fixed;bottom:14px;left:14px;z-index:9998;display:flex;align-items:center;gap:8px;background:rgba(17,19,29,.92);border:1px solid #252840;border-radius:24px;padding:6px 8px 6px 14px;font-family:"DM Sans",sans-serif;font-size:12px;color:#8890b0;box-shadow:0 6px 20px rgba(0,0,0,.4)';
  bar.innerHTML=`<span>🔒 ${email}</span><button id="auth-logout" style="background:#1a1d2a;border:1px solid #252840;border-radius:18px;color:#f0516a;padding:5px 12px;font-size:12px;font-weight:600;cursor:pointer">Sair</button>`;
  document.body.appendChild(bar);
  document.getElementById('auth-logout').addEventListener('click', async()=>{
    try{ await db.auth.signOut(); }catch(e){}
    location.reload();
  });
}
