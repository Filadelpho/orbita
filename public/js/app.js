// ORBITA — ponto de entrada: autenticação, shell, roteamento, busca global e comandos.
import { state, save, subscribe, seed, items, today, addDays, replaceState, resetAll } from './store.js';
import { COLLECTIONS, primaryOf, brl, relDate, escapeHtml as esc } from './collections.js';
import { icon, LOGO, GOOGLE } from './icons.js';
import { ui, on, bus, openOverlay, closeOverlay, overlayOpen, toast, confirmDialog, initials, openForm } from './ui.js';
import { PAGES, MODULE_INFO, moduleOn, go, genericPage, askAI } from './views.js';
import { applyAppearance, dockPages as pinnedPages, quickAddMenu, handleShortcut, hooks, avatarInner, scrollToPending } from './settings.js';
import { mountDashCover } from './cover.js';
import { startPixels } from './pixels.js';
import './event-modal.js';
import './habit-modal.js';
import './task-modal.js';
import { habitList, habitDue } from './habits.js';

const app = document.getElementById('app');

// ---------- Tema (detalhes em settings.js) ----------
on('set-theme', (ds) => { state.settings.theme = ds.t; save(); });
function toggleTheme() {
  const cur = document.documentElement.dataset.theme;
  state.settings.theme = cur === 'dark' ? 'light' : 'dark';
  delete state.settings.accent;
  save();
}
on('toggle-theme', toggleTheme);

// ---------- Render ----------
function render() {
  applyAppearance();
  if (!state.user) return renderAuth();
  if (!state.onboarded) return renderOnboarding();
  renderShell();
}
bus.render = render;
subscribe(render);

// ---------- Login (inspirado em tela dividida) ----------
function renderAuth() {
  const mode = ui.authMode || 'login';
  const login = mode === 'login';
  app.innerHTML = `
  <div class="auth">
    <section class="auth-hero">
      <div class="auth-art"><canvas class="pixel-canvas"></canvas><div class="pixel-grid"></div><div class="pixel-fade"></div></div>
      <div class="auth-top">
        <a class="auth-brand" href="#"><span class="auth-logo">${LOGO}</span><span>ORBITA</span></a>
        <button type="button" class="lang-pill" data-action="lang"><svg viewBox="0 0 20 14" width="17" height="12" aria-hidden="true"><rect width="20" height="14" rx="2" fill="#009c3b"/><path d="M10 1.6 18 7l-8 5.4L2 7z" fill="#ffdf00"/><circle cx="10" cy="7" r="3.1" fill="#002776"/></svg><span>PT</span>${icon('chevD')}</button>
      </div>
      <div class="auth-bottom">
        <div class="auth-head">
          <h1>A vida inteira<br>em dia</h1>
          <p>Tarefas, agenda, finanças, saúde, estudos e carreira, na mesma órbita.</p>
        </div>
        <ol class="auth-steps">
          <li class="on"><span>1</span><p>${login ? 'Entrar com e-mail e senha' : 'Criar sua conta'}</p></li>
          <li><span>2</span><p>Escolher seus módulos</p></li>
          <li><span>3</span><p>Seu Início pronto</p></li>
        </ol>
      </div>
    </section>
    <section class="auth-panel">
      <div class="auth-box">
        <div class="auth-title">
          <h2>${login ? 'Entrar no ORBITA' : 'Criar conta no ORBITA'}</h2>
          <p>${login ? 'Bom te ver de novo.' : 'Leva menos de um minuto.'}</p>
        </div>
        <div class="auth-social">
          <button type="button" class="auth-btn dark" data-action="social" data-p="Google">${GOOGLE}Continuar com o Google</button>
          <button type="button" class="auth-btn light" data-action="social" data-p="Apple"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M16.4 12.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9-1.7 0-3.3 1-4.2 2.6-1.8 3.1-.5 7.7 1.3 10.2.8 1.2 1.8 2.6 3.1 2.5 1.3-.1 1.7-.8 3.3-.8 1.5 0 1.9.8 3.3.8 1.4 0 2.2-1.3 3-2.5 1-1.4 1.4-2.7 1.4-2.8 0 0-2.7-1-2.7-4.1zM14 4.9c.7-.9 1.2-2 1-3.2-1 .1-2.2.7-2.9 1.5-.6.7-1.2 1.9-1 3.1 1.1.1 2.2-.6 2.9-1.4z"/></svg>Continuar com a Apple</button>
          <div class="auth-or">ou</div>
        </div>
        <form class="auth-form" data-submit="auth" data-mode="${mode}">
          ${login ? '' : '<div><label class="auth-label" for="a-name">Nome</label><input id="a-name" class="auth-input" name="name" required placeholder="Como quer ser chamado(a)?" autocomplete="name"></div>'}
          <div><label class="auth-label" for="a-email">E-mail</label><input id="a-email" class="auth-input" name="email" type="email" required placeholder="voce@email.com" autocomplete="email"></div>
          <div>
            <div class="auth-row"><label class="auth-label" for="a-pass">Senha</label>${login ? '<button type="button" class="auth-link" data-action="forgot">Esqueci minha senha</button>' : ''}</div>
            <div class="auth-pass"><input id="a-pass" class="auth-input" name="password" type="password" required minlength="6" placeholder="${login ? 'Sua senha' : 'Mínimo de 6 caracteres'}" autocomplete="${login ? 'current-password' : 'new-password'}"><button type="button" class="auth-eye" data-action="toggle-pass" aria-label="Mostrar senha">${icon('eye')}</button></div>
          </div>
          <button class="auth-submit">${login ? 'Entrar' : 'Criar conta'}</button>
        </form>
        <p class="auth-switch">${login ? 'Ainda não tem conta? <a href="#" data-action="auth-mode" data-m="signup">Criar conta</a>' : 'Já tem conta? <a href="#" data-action="auth-mode" data-m="login">Entrar</a>'}</p>
        <p class="auth-legal">Ao entrar você concorda com os <a href="#" data-action="legal">Termos de Uso</a> e a <a href="#" data-action="legal">Política de Privacidade (LGPD)</a>.</p>
      </div>
    </section>
  </div>`;
  startPixels(app.querySelector('.pixel-canvas'), 'orbita', { cell: 4 });
}

on('lang', () => toast('Outros idiomas chegam em breve.'));
on('legal', () => toast('Termos e política completos chegam com a conta em nuvem.'));
on('toggle-pass', (ds, el) => {
  const input = el.parentElement.querySelector('input');
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  el.innerHTML = icon(show ? 'eyeOff' : 'eye');
  el.setAttribute('aria-label', show ? 'Ocultar senha' : 'Mostrar senha');
});

on('auth-mode', (ds) => { ui.authMode = ds.m; render(); });
on('forgot', () => toast('A recuperação de senha chega com a conta em nuvem.'));
function login(name, email, provider = 'email') {
  const hasData = Object.keys(state.data || {}).length > 0;
  state.user = { ...(state.user?.email === email && email ? state.user : {}), name, email, provider };
  if (!hasData) seed();
  save();
}
on('auth', (ds, form) => {
  const email = form.elements.email.value.trim();
  const name = form.elements.name?.value.trim() || state.user?.name || email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  login(name, email);
});
on('social', (ds) => login(`Usuário ${ds.p}`, '', ds.p));

// ---------- Onboarding ----------
function renderOnboarding() {
  const mods = state.settings.modules;
  app.innerHTML = `
  <div class="onboard"><div class="onboard-card">
    <div class="brand"><span class="brand-logo">${LOGO}</span>ORBITA</div>
    <h1>Monte o seu ORBITA.</h1>
    <p class="muted" style="font-size:15px;margin:0">Escolha as áreas da vida que você quer organizar. Dá para mudar quando quiser em Configurações.</p>
    <div class="module-grid">${Object.entries(MODULE_INFO).map(([k, m]) => `
      <button class="module-pick ${mods[k] !== false ? 'on' : ''}" data-action="toggle-module" data-m="${k}"><span class="tick">${icon('check')}</span><span class="ico">${icon(m.icon)}</span><b>${m.title}</b><small>${m.desc}</small></button>`).join('')}</div>
    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
      <button class="btn primary" style="height:46px;padding:0 28px" data-action="finish-onboarding">Começar ${icon('chevR')}</button>
      <span class="muted">Incluímos dados de exemplo para você explorar. Apague em Configurações quando quiser.</span>
    </div>
  </div></div>`;
}
on('finish-onboarding', () => { state.onboarded = true; save(); go('dashboard'); });

// ---------- Shell ----------
function notifications() {
  if (!state.settings.notifications) return [];
  const T = today();
  const out = [];
  if (moduleOn('tasks')) {
    items('tasks').filter((t) => !t.done && t.due && t.due < T).forEach((t) => out.push({ ico: 'clock', cls: 'red', text: `Atrasada: ${t.title}`, key: 'tasks', id: t.id }));
    items('tasks').filter((t) => !t.done && t.due === T).forEach((t) => out.push({ ico: 'check', cls: 'blue', text: `Hoje${t.time ? ' às ' + t.time : ''}: ${t.title}`, key: 'tasks', id: t.id }));
  }
  if (moduleOn('finance')) {
    items('bills').filter((b) => !b.paid && b.due <= addDays(3)).forEach((b) => out.push({ ico: 'wallet', cls: b.due < T ? 'red' : 'yellow', text: `${b.title} · ${brl(b.amount)} — vence ${relDate(b.due).toLowerCase()}`, key: 'bills', id: b.id }));
    items('subscriptions').filter((s) => s.next && s.next >= T && s.next <= addDays(3)).forEach((s) => out.push({ ico: 'refresh', cls: '', text: `${s.name} renova ${relDate(s.next).toLowerCase()} (${brl(s.amount)})`, key: 'subscriptions', id: s.id }));
  }
  if (moduleOn('calendar')) items('events').filter((e) => e.date === T).forEach((e) => out.push({ ico: 'calendar', cls: 'blue', text: `${e.time || 'Hoje'} · ${e.title}`, key: 'events', id: e.id }));
  if (moduleOn('habits')) {
    const pend = habitList().filter((h) => habitDue(h, T) && !h.log?.[T]);
    if (pend.length && new Date().getHours() >= 18) out.push({ ico: 'repeat', cls: 'yellow', text: `${pend.length} hábito(s) ainda não concluído(s) hoje`, route: 'habits' });
  }
  return out;
}

// Dock flutuante (módulos fixados em Configurações › Navegação) ou barra lateral.

function renderShell() {
  const page = PAGES.find((p) => p.id === ui.route && moduleOn(p.module)) || PAGES[0];
  ui.route = page.id;
  const content = document.querySelector('.content');
  const scroll = content && content.dataset.route === page.id ? content.scrollTop : 0;
  const focusId = document.activeElement?.id;
  const overdue = items('tasks').filter((t) => !t.done && t.due && t.due <= today()).length;
  const notifs = notifications();
  const isDash = page.id === 'dashboard';
  const onCover = isDash && state.settings.dashStyle !== 'none';
  const sidebar = state.settings.nav === 'sidebar';

  const dockPages = pinnedPages();
  if (!dockPages.includes(page)) dockPages.push(page);
  const sideRest = PAGES.filter((p) => moduleOn(p.module) && !dockPages.includes(p) && p.id !== 'settings');
  const sideLink = (p) => `<a class="side-item ${p === page ? 'active' : ''}" href="#/${p.id}">${icon(p.icon)}<span>${esc(p.id === 'dashboard' ? 'Início' : p.title)}</span>${p.id === 'tasks' && overdue ? `<b class="side-count">${overdue}</b>` : ''}</a>`;

  app.innerHTML = `
  <div class="shell ${onCover ? 'on-cover' : ''} ${sidebar ? 'nav-side' : ''}">
    ${sidebar ? `<aside class="side" aria-label="Módulos">
      <a class="side-logo" href="#/dashboard">${LOGO}<b>ORBITA</b></a>
      <button class="side-add" data-action="quick-add">${icon('plus')}<span>Adicionar</span><kbd>N</kbd></button>
      <nav class="side-nav">${dockPages.map(sideLink).join('')}${sideRest.length ? `<div class="side-sep">Mais</div>${sideRest.map(sideLink).join('')}` : ''}</nav>
      <div class="side-foot">${sideLink(PAGES.find((p) => p.id === 'settings'))}</div>
    </aside>` : ''}
    <header class="topbar">
      <a class="tb-logo" href="#/dashboard" aria-label="Início">${LOGO}</a>
      <div class="spacer"></div>
      <button class="tb-pill" data-action="palette">${icon('search')}<span class="lbl">Buscar</span><kbd>Ctrl</kbd><kbd>K</kbd></button>
      <a class="tb-pill ai" href="#/ai">${icon('spark')}<span class="lbl">ORBITA AI</span></a>
      <button class="tb-icon notif-dot" data-count="${notifs.length}" data-action="notif" aria-label="Notificações">${icon('bell')}</button>
      <button class="tb-avatar" data-action="user-menu" aria-label="Sua conta">${avatarInner()}</button>
    </header>
    <main class="content ${onCover ? 'flush' : ''}" data-route="${page.id}"><div class="page">${page.render ? page.render(page) : genericPage(page)}</div></main>
    <nav class="dock" aria-label="Navegação">
      <div class="dock-items">${dockPages.map((p) => `
        <a class="dock-item ${p === page ? 'active' : ''}" href="#/${p.id}" title="${esc(p.title)}" aria-label="${esc(p.title)}">${icon(p.icon)}${p === page ? `<span>${esc(p.id === 'dashboard' ? 'Início' : p.title)}</span>` : ''}${p.id === 'tasks' && overdue && p !== page ? '<i class="dock-dot"></i>' : ''}</a>`).join('')}</div>
      <span class="dock-sep"></span>
      <button class="dock-item ${ui.modulesOpen ? 'open' : ''}" data-action="modules" title="Todos os módulos" aria-label="Todos os módulos">${icon('grid')}</button>
      <button class="dock-add" data-action="quick-add" title="Adicionar (N)" aria-label="Adicionar">${icon('plus')}</button>
    </nav>
  </div>
  ${ui.notifOpen ? `<div class="popover" id="notif-pop"><h4>Notificações</h4>${notifs.length ? notifs.map((n) => `
    <button class="palette-item" data-action="notif-open" ${n.key ? `data-key="${n.key}" data-id="${n.id}"` : `data-route="${n.route}"`}><span class="chip ${n.cls}" style="width:28px;height:28px;padding:0;justify-content:center">${icon(n.ico)}</span><span style="flex:1">${esc(n.text)}</span></button>`).join('') : '<div class="empty">Tudo em dia ✨</div>'}</div>` : ''}
  ${ui.userOpen ? `<div class="popover user-pop" id="user-pop">
    <div class="user-head"><div class="avatar">${avatarInner()}</div><div><b>${esc(state.user.name || 'Você')}</b><small>${esc(state.user.email || 'Plano pessoal · local')}</small></div></div>
    <a class="palette-item" href="#/settings">${icon('gear')}<span>Configurações</span></a>
    <a class="palette-item" href="#/settings/integracoes">${icon('plug')}<span>Integrações</span></a>
    <button class="palette-item" data-action="toggle-theme">${icon(document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon')}<span>Tema ${document.documentElement.dataset.theme === 'dark' ? 'claro' : 'escuro'}</span></button>
    <button class="palette-item" data-action="logout">${icon('logout')}<span>Sair</span></button>
  </div>` : ''}
  ${ui.modulesOpen ? `<div class="popover modules-pop" id="modules-pop"><h4>Módulos</h4><div class="modules-grid">${PAGES.filter((p) => moduleOn(p.module)).map((p) => `
    <a class="module-link ${p === page ? 'active' : ''}" href="#/${p.id}">${icon(p.icon)}<span>${esc(p.id === 'dashboard' ? 'Início' : p.title)}</span></a>`).join('')}</div></div>` : ''}`;

  const c = document.querySelector('.content');
  c.scrollTop = scroll;
  if (onCover) {
    mountDashCover();
    const tb = app.querySelector('.topbar');
    const solid = () => tb.classList.toggle('solid', c.scrollTop > 360);
    solid();
    c.addEventListener('scroll', solid, { passive: true });
  }
  if (focusId) document.getElementById(focusId)?.focus();
  scrollToPending();
  const log = document.getElementById('chat-log');
  if (log) log.scrollTop = log.scrollHeight;
}

const closePops = () => { ui.notifOpen = false; ui.userOpen = false; ui.modulesOpen = false; };
document.addEventListener('click', (e) => {
  const t = e.target;
  const inside = t.closest?.('.popover') || t.closest?.('[data-action=notif],[data-action=user-menu],[data-action=modules]');
  if ((ui.notifOpen || ui.userOpen || ui.modulesOpen) && !inside) { closePops(); render(); }
});
on('notif', () => { const o = !ui.notifOpen; closePops(); ui.notifOpen = o; render(); });
on('user-menu', () => { const o = !ui.userOpen; closePops(); ui.userOpen = o; render(); });
on('modules', () => { const o = !ui.modulesOpen; closePops(); ui.modulesOpen = o; render(); });
on('notif-open', (ds) => {
  ui.notifOpen = false;
  if (ds.route) go(ds.route);
  else { render(); openForm(ds.key, ds.id); }
});

// ---------- Roteamento ----------
function route() {
  let r = location.hash.replace(/^#\/?/, '') || 'dashboard';
  if (r === 'integrations') { location.replace('#/settings/integracoes'); return; }
  const [id, sub] = r.split('/');
  ui.route = id;
  ui.sub = sub || '';
  ui.recording = null;
  closePops();
  render();
  document.querySelector('.content')?.scrollTo(0, 0);
}
addEventListener('hashchange', route);

// ---------- Busca global e comandos (Ctrl/Cmd + K) ----------
const SEARCHABLE = ['tasks', 'events', 'goals', 'personalProjects', 'workProjects', 'career', 'studies', 'books', 'transactions', 'bills', 'investments', 'subscriptions', 'journal', 'workouts', 'posts', 'ideas', 'trips', 'leisure', 'habits'];
const PAGE_OF = { tasks: 'tasks', events: 'calendar', goals: 'goals', personalProjects: 'goals', workProjects: 'work', career: 'work', studies: 'studies', books: 'studies', transactions: 'finance', bills: 'finance', investments: 'finance', subscriptions: 'finance', journal: 'health', workouts: 'health', posts: 'content', ideas: 'content', trips: 'travel', leisure: 'travel', habits: 'habits' };

function paletteResults(q) {
  const n = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
  const nq = n(q);
  const res = [];
  const commands = [
    { label: 'Nova tarefa', ico: 'check', run: () => openForm('tasks') },
    { label: 'Novo compromisso', ico: 'calendar', run: () => openForm('events') },
    { label: 'Novo lançamento financeiro', ico: 'wallet', run: () => openForm('transactions') },
    { label: 'Novo hábito', ico: 'repeat', run: () => openForm('habits') },
    { label: 'Escrever no diário', ico: 'pen', run: () => openForm('journal') },
    { label: 'Nova meta', ico: 'target', run: () => openForm('goals') },
    { label: 'Alternar tema claro/escuro', ico: 'moon', run: toggleTheme },
    { label: 'Exportar backup', ico: 'download', run: () => exportData() },
    { label: 'Relatório da semana (IA)', ico: 'spark', run: () => { go('ai'); askAI('Relatório da semana'); } },
  ];
  const pages = PAGES.filter((p) => moduleOn(p.module)).map((p) => ({ label: p.title, ico: p.icon, hint: 'Ir para', run: () => go(p.id) }));
  const match = (x) => !nq || n(x.label).includes(nq);
  const c = commands.filter(match);
  const p = pages.filter(match);
  if (c.length) res.push({ sec: 'Ações', items: c.slice(0, nq ? 6 : 5) });
  if (p.length) res.push({ sec: 'Navegar', items: p.slice(0, nq ? 8 : 6) });
  if (nq.length >= 2) {
    const found = [];
    for (const key of SEARCHABLE) {
      if (!moduleOn(PAGE_OF[key])) continue;
      const cfg = COLLECTIONS[key];
      for (const it of items(key)) {
        const hay = n(Object.values(it).filter((v) => typeof v === 'string' || typeof v === 'number').join(' '));
        if (hay.includes(nq)) found.push({ label: String(primaryOf(cfg, it)), ico: cfg.icon, hint: cfg.label, run: () => { go(PAGE_OF[key]); setTimeout(() => openForm(key, it.id), 30); } });
        if (found.length > 12) break;
      }
    }
    if (found.length) res.push({ sec: 'Resultados', items: found });
    res.push({ sec: 'ORBITA AI', items: [{ label: `Perguntar: “${q}”`, ico: 'spark', run: () => { go('ai'); askAI(q); } }] });
  }
  return res;
}

function openPalette() {
  let sel = 0;
  let flat = [];
  openOverlay(`<div class="palette" role="dialog" aria-label="Busca global">
    <div class="palette-input">${icon('search')}<input id="pal-q" placeholder="Buscar em tudo, navegar ou perguntar à IA…" autocomplete="off"><kbd>Esc</kbd></div>
    <div class="palette-list" id="pal-list"></div></div>`, (bd) => {
    const input = bd.querySelector('#pal-q');
    const list = bd.querySelector('#pal-list');
    const draw = () => {
      const groups = paletteResults(input.value.trim());
      flat = groups.flatMap((g) => g.items);
      sel = Math.min(sel, Math.max(0, flat.length - 1));
      let i = 0;
      list.innerHTML = groups.map((g) => `<div class="palette-sec">${esc(g.sec)}</div>${g.items.map((it) => `<button class="palette-item ${i === sel ? 'sel' : ''}" data-i="${i++}">${icon(it.ico)}<span>${esc(it.label)}</span>${it.hint ? `<span class="muted">${esc(it.hint)}</span>` : ''}</button>`).join('')}`).join('') || '<div class="empty">Nada encontrado.</div>';
      list.querySelector('.sel')?.scrollIntoView({ block: 'nearest' });
    };
    const run = (i) => { const it = flat[i]; if (!it) return; closeOverlay(); it.run(); };
    input.addEventListener('input', () => { sel = 0; draw(); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); sel = (sel + 1) % flat.length; draw(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); sel = (sel - 1 + flat.length) % flat.length; draw(); }
      if (e.key === 'Enter') { e.preventDefault(); run(sel); }
    });
    list.addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (b) run(+b.dataset.i); });
    draw();
    input.focus();
  });
}
on('palette', openPalette);
hooks.palette = openPalette;

document.addEventListener('keydown', (e) => {
  if (!state.user || !state.onboarded) return;
  if (e.key === 'Escape' && !ui.recording) { if (overlayOpen()) closeOverlay(); else if (ui.notifOpen || ui.userOpen || ui.modulesOpen) { closePops(); render(); } return; }
  handleShortcut(e);
});

// ---------- Dados: exportar / importar ----------
function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function exportData() {
  download(`orbita-backup-${today()}.json`, JSON.stringify({ app: 'ORBITA', version: 1, exportedAt: new Date().toISOString(), ...state }, null, 2), 'application/json');
  toast('Backup exportado');
}
on('export', exportData);
on('export-csv', () => {
  const rows = [['Data', 'Descrição', 'Tipo', 'Categoria', 'Valor']].concat(
    items('transactions').sort((a, b) => a.date.localeCompare(b.date)).map((t) => [t.date, t.desc, t.type, t.category, String(t.amount).replace('.', ',')]));
  download(`orbita-financas-${today()}.csv`, '﻿' + rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\n'), 'text/csv');
  toast('CSV exportado');
});
on('import', async (ds, el) => {
  const file = el.files?.[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (data.app !== 'ORBITA' || !data.data) throw new Error();
    if (!(await confirmDialog('Importar backup?', 'Seus dados atuais serão substituídos pelos do arquivo.', 'Importar'))) return;
    const { app: _a, version: _v, exportedAt: _e, ...rest } = data;
    replaceState({ ...state, ...rest, user: rest.user || state.user, onboarded: true });
    toast('Backup restaurado');
  } catch {
    toast('Arquivo inválido');
  }
});
on('logout', () => { state.user = null; save(); location.hash = ''; });
on('reseed', async () => {
  if (await confirmDialog('Restaurar dados de exemplo?', 'Seus dados atuais serão substituídos.', 'Restaurar')) { seed(); save(); toast('Dados de exemplo restaurados'); }
});
on('wipe', async () => {
  if (await confirmDialog('Apagar tudo?', 'Todos os seus dados deste dispositivo serão removidos permanentemente.', 'Apagar tudo')) { resetAll(); location.hash = ''; }
});

// ---------- Inicialização ----------
route();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
