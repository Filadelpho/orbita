// Página de Tarefas: lista agrupada por status (ou projeto) e Kanban, com pastas, filtros e ordenação.
import { state, items, upsert, find, save, today, addDays, parseISO, uid } from './store.js';
import { escapeHtml as esc, monthShort } from './collections.js';
import { icon } from './icons.js';
import { ui, on, bus, openOverlay, closeOverlay, toast, confirmDialog, openForm } from './ui.js';
import { parseQuick, prioIcon } from './task-modal.js';

export const STATUSES = ['Backlog', 'A fazer', 'Em progresso', 'Em revisão', 'Concluída'];
const PRIO_RANK = { Urgente: 4, Alta: 3, Média: 2, Baixa: 1 };
const PRIOS = ['Urgente', 'Alta', 'Média', 'Baixa'];

// Ícones de status, iguais nas colunas do Kanban e nos grupos da lista.
const SICON = {
  Backlog: '<svg class="st" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="none" stroke="var(--muted)" stroke-width="1.6" stroke-dasharray="2.2 2.2"/></svg>',
  'A fazer': '<svg class="st" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="none" stroke="var(--text-2)" stroke-width="1.6"/></svg>',
  'Em progresso': '<svg class="st" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="none" stroke="var(--warning)" stroke-width="1.6"/><path d="M8 4a4 4 0 0 1 0 8z" fill="var(--warning)"/></svg>',
  'Em revisão': '<svg class="st" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="none" stroke="var(--purple, #a78bfa)" stroke-width="1.6"/><path d="M8 4a4 4 0 1 1-4 4h4z" fill="var(--purple, #a78bfa)"/></svg>',
  Concluída: '<svg class="st" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="var(--success)"/><path d="M5 8.2l2 2 4-4.4" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

export const statusOf = (t) => (t.done ? 'Concluída' : STATUSES.includes(t.status) && t.status !== 'Concluída' ? t.status : 'A fazer');
const folders = () => items('taskFolders');
const projectNames = () => [...items('personalProjects'), ...items('workProjects')].map((p) => p.title).filter(Boolean);
const S = () => (state.settings.tk ||= { view: 'list', sort: 'prio', showDone: true, groupProj: false });
const F = () => (ui.tk ||= { folder: 'all', q: '', proj: 'all', prio: 'all', created: 'any', pop: null, collapsed: {}, col: 'A fazer' });

function dueLabel(t) {
  if (!t.due) return '';
  const T = today();
  const d = parseISO(t.due);
  const txt = t.due === T ? 'Hoje' : t.due === addDays(1) ? 'Amanhã' : t.due === addDays(-1) ? 'Ontem' : `${d.getDate()} ${monthShort(d.getMonth())}`;
  const late = !t.done && t.due < T;
  return `<span class="tk-due ${late ? 'late' : ''}">${icon('calendar')}${txt}${t.time ? `<span>· ${esc(t.time)}</span>` : ''}</span>`;
}
const tagChips = (t) => (t.tags || '').split(',').map((x) => x.trim()).filter(Boolean).map((x) => `<span class="tk-tag">${esc(x)}</span>`).join('');

function filtered() {
  const f = F(), s = S();
  const q = f.q.trim().toLowerCase();
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const since = { today: now.getTime(), yesterday: now.getTime() - 864e5, 7: now.getTime() - 6 * 864e5, 30: now.getTime() - 29 * 864e5 }[f.created];
  return items('tasks').filter((t) => {
    if (f.folder !== 'all' && t.folder !== f.folder) return false;
    if (!s.showDone && t.done) return false;
    if (q && !`${t.title} ${t.tags || ''} ${t.project || ''} ${t.notes || ''}`.toLowerCase().includes(q)) return false;
    if (f.proj !== 'all' && (t.project || '') !== f.proj) return false;
    if (f.prio !== 'all' && (PRIO_RANK[t.priority] ? t.priority : '') !== f.prio) return false;
    if (since != null) {
      const c = t.createdAt || 0;
      if (c < since) return false;
      if (f.created === 'yesterday' && c >= now.getTime()) return false;
    }
    return true;
  });
}

function sorted(list) {
  const s = S().sort;
  const by = {
    prio: (a, b) => (PRIO_RANK[b.priority] || 0) - (PRIO_RANK[a.priority] || 0) || (a.due || '9').localeCompare(b.due || '9') || (a.time || '').localeCompare(b.time || ''),
    recent: (a, b) => (b.createdAt || 0) - (a.createdAt || 0),
    manual: (a, b) => (a.order ?? a.createdAt ?? 0) - (b.order ?? b.createdAt ?? 0),
  }[s];
  return [...list].sort(by);
}

function row(t) {
  return `<div class="tk-row ${t.done ? 'done' : ''}" draggable="${S().sort === 'manual'}" data-tk-drag="${t.id}">
    <button class="tk-check ${t.done ? 'on' : ''}" data-action="toggle-done" data-key="tasks" data-id="${t.id}" role="checkbox" aria-checked="${!!t.done}" aria-label="${t.done ? 'Reabrir tarefa' : 'Concluir tarefa'}">${icon('check')}</button>
    <span class="tk-prio p-${(t.priority || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()}" title="${esc(t.priority || 'Sem prioridade')}">${PRIO_RANK[t.priority] ? prioIcon(t.priority) : ''}</span>
    <button class="tk-main" data-action="open-form" data-key="tasks" data-id="${t.id}">
      <span class="tk-title">${esc(t.title)}</span>
      <span class="tk-meta">${t.project ? `<span class="tk-proj">${icon('folder')}${esc(t.project)}</span>` : ''}${tagChips(t)}${dueLabel(t)}</span>
    </button>
  </div>`;
}

function card(t) {
  return `<div class="tk-card ${t.done ? 'done' : ''}" draggable="true" data-tk-drag="${t.id}" data-action="open-form" data-key="tasks" data-id="${t.id}">
    <div class="tk-card-top"><span class="tk-title">${esc(t.title)}</span><span class="tk-prio p-${(t.priority || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()}">${PRIO_RANK[t.priority] ? prioIcon(t.priority) : ''}</span></div>
    ${t.project || t.tags ? `<div class="tk-card-tags">${t.project ? `<span class="tk-tag">${esc(t.project)}</span>` : ''}${tagChips(t)}</div>` : ''}
    ${t.due ? `<div class="tk-card-foot">${dueLabel(t)}</div>` : ''}
  </div>`;
}

const check = (on) => (on ? `<span class="tk-ck">${icon('check')}</span>` : '');
function menu(name, label, ico, active, body) {
  const f = F();
  return `<span class="tk-anchor"><button class="tk-filter ${active ? 'on' : ''}" data-action="tk-pop" data-p="${name}" aria-expanded="${f.pop === name}">${ico}<span>${esc(label)}</span></button>${f.pop === name ? `<div class="tk-pop" role="menu">${body}</div>` : ''}</span>`;
}
const opt = (act, v, label, on, ico = '') => `<button role="menuitemradio" aria-checked="${on}" data-action="${act}" data-v="${esc(v)}">${ico}<span>${esc(label)}</span>${check(on)}</button>`;

export function tasksPage() {
  const f = F(), s = S();
  const T = today();
  const all = items('tasks');
  const open = all.filter((t) => !t.done);
  const list = sorted(filtered());
  const projects = projectNames();

  const tabs = `<div class="tk-tabs">
    <button class="tk-tab ${f.folder === 'all' ? 'on' : ''}" data-action="tk-folder" data-v="all">Todas <small>${open.length}</small></button>
    ${folders().map((fo) => `<span class="tk-tab-wrap"><button class="tk-tab ${f.folder === fo.id ? 'on' : ''}" data-action="tk-folder" data-v="${fo.id}">${icon('folder')}${esc(fo.name)} <small>${open.filter((t) => t.folder === fo.id).length}</small></button>${f.folder === fo.id ? `<button class="tk-tab-x" data-action="tk-folder-del" data-id="${fo.id}" aria-label="Excluir pasta ${esc(fo.name)}">${icon('x')}</button>` : ''}</span>`).join('')}
    <button class="tk-tab ghost" data-action="tk-folder-new">${icon('folder')}Nova pasta</button>
  </div>`;

  const projLabel = f.proj === 'all' ? 'Projeto' : f.proj || 'Inbox';
  const filters = `<div class="tk-filters">
    <label class="tk-search">${icon('search')}<input data-input="tk-q" placeholder="Filtrar tarefas…" value="${esc(f.q)}" aria-label="Filtrar tarefas"></label>
    ${menu('proj', projLabel, icon('folder'), f.proj !== 'all' || s.groupProj, `${opt('tk-set-proj', 'all', 'Todos os projetos', f.proj === 'all')}${opt('tk-set-proj', '', 'Inbox (sem projeto)', f.proj === '')}${projects.map((p) => opt('tk-set-proj', p, p, f.proj === p, icon('folder'))).join('')}<hr>${opt('tk-group-proj', '', 'Agrupar por projeto', !!s.groupProj, icon('layout'))}`)}
    ${menu('prio', f.prio === 'all' ? 'Prioridade' : f.prio || 'Sem prioridade', f.prio !== 'all' && f.prio ? prioIcon(f.prio) : '<span class="tk-dash">—</span>', f.prio !== 'all', `${opt('tk-set-prio', 'all', 'Todas', f.prio === 'all')}${PRIOS.map((p) => opt('tk-set-prio', p, p, f.prio === p, prioIcon(p))).join('')}${opt('tk-set-prio', '', 'Sem prioridade', f.prio === '', '<span class="tk-dash">—</span>')}`)}
    ${menu('created', { any: 'Criada em', today: 'Criadas hoje', yesterday: 'Criadas ontem', 7: 'Últimos 7 dias', 30: 'Últimos 30 dias' }[f.created], icon('calendar'), f.created !== 'any', [['any', 'Qualquer data'], ['today', 'Criadas hoje'], ['yesterday', 'Criadas ontem'], ['7', 'Últimos 7 dias'], ['30', 'Últimos 30 dias']].map(([v, l], i) => (i === 1 ? '<hr>' : '') + opt('tk-set-created', v, l, f.created === v)).join(''))}
    <button class="tk-filter plain ${s.showDone ? '' : 'off'}" data-action="tk-show-done" aria-pressed="${s.showDone}">${icon(s.showDone ? 'eye' : 'eyeOff')}<span>Concluídas</span></button>
  </div>`;

  let content;
  if (s.view === 'kanban') {
    const cols = STATUSES.filter((st) => st !== 'Concluída' || s.showDone);
    const active = cols.includes(f.col) ? f.col : cols[1] || cols[0];
    content = `<div class="tk-ktabs">${cols.map((st) => `<button class="${st === active ? 'on' : ''}" data-action="tk-col" data-v="${st}">${SICON[st]}${st} <small>${list.filter((t) => statusOf(t) === st).length}</small></button>`).join('')}</div>
      <div class="tk-kanban">${cols.map((st) => {
        const cs = list.filter((t) => statusOf(t) === st);
        return `<section class="tk-col ${st === active ? 'active' : ''}" data-tk-col="${st}">
          <header>${SICON[st]}<b>${st}</b><small>${cs.length}</small>${st !== 'Concluída' ? `<button class="tk-col-add" data-action="tk-new" data-status="${st}" aria-label="Nova tarefa em ${st}">${icon('plus')}</button>` : ''}</header>
          <div class="tk-col-body">${cs.map(card).join('') || '<div class="tk-drop">Solte itens aqui</div>'}</div></section>`;
      }).join('')}</div>`;
  } else {
    let groups;
    if (s.groupProj) {
      const names = [...new Set(list.map((t) => t.project || ''))].sort((a, b) => (a ? 1 : 0) - (b ? 1 : 0) || a.localeCompare(b));
      groups = names.map((n) => ({ key: 'p:' + n, label: n || 'Inbox (sem projeto)', ico: icon(n ? 'folder' : 'inbox'), list: list.filter((t) => (t.project || '') === n) }));
    } else groups = STATUSES.map((st) => ({ key: st, label: st, ico: SICON[st], list: list.filter((t) => statusOf(t) === st) }));
    groups = groups.filter((g) => g.list.length);
    content = `
      <div class="tk-addbar">
        <label class="tk-quick">${icon('plus')}<input id="tk-quick" placeholder="Adicionar tarefa… use #tag, !alta, amanhã" autocomplete="off" aria-label="Adicionar tarefa"></label>
        <div class="tk-sort" role="radiogroup" aria-label="Ordenar">
          ${[['prio', 'Prioridade', 'sort'], ['recent', 'Mais recentes', 'clock'], ['manual', 'Manual', 'grip']].map(([v, l, ic]) => `<button role="radio" aria-checked="${s.sort === v}" class="${s.sort === v ? 'on' : ''}" data-action="tk-sort" data-v="${v}">${icon(ic)}${l}</button>`).join('')}
        </div>
      </div>
      ${groups.map((g) => {
        const closed = f.collapsed[g.key];
        return `<section class="tk-group ${closed ? 'closed' : ''}">
          <button class="tk-ghead" data-action="tk-collapse" data-v="${esc(g.key)}" aria-expanded="${!closed}">${icon('chevD')}${g.ico}<b>${esc(g.label)}</b><small>${g.list.length}</small></button>
          ${closed ? '' : `<div class="tk-glist" data-tk-group="${esc(g.key)}">${g.list.map(row).join('')}</div>`}
        </section>`;
      }).join('') || `<div class="tk-empty">${icon('checkCircle')}<b>${all.length ? 'Nada com esses filtros' : 'Nenhuma tarefa ainda'}</b><p>${all.length ? 'Tente limpar a busca ou os filtros.' : 'Escreva acima e aperte Enter para criar a primeira.'}</p></div>`}`;
  }

  return `
    <div class="tk-page">
      <div class="tk-head">
        <div><div class="tk-h1"><span class="tk-hico">${icon('checkSquare')}</span><h1>Tarefas</h1></div>
          <p>${open.length} ${open.length === 1 ? 'aberta' : 'abertas'} · ${open.filter((t) => t.due === T).length} para hoje · ${open.filter((t) => t.due && t.due < T).length} ${open.filter((t) => t.due && t.due < T).length === 1 ? 'atrasada' : 'atrasadas'}</p></div>
        <div class="tk-head-actions">
          <div class="tk-view" role="radiogroup" aria-label="Visualização">
            <button role="radio" aria-checked="${s.view !== 'kanban'}" class="${s.view !== 'kanban' ? 'on' : ''}" data-action="tk-view" data-v="list">${icon('menu')}Lista</button>
            <button role="radio" aria-checked="${s.view === 'kanban'}" class="${s.view === 'kanban' ? 'on' : ''}" data-action="tk-view" data-v="kanban">${icon('grid')}Kanban</button>
          </div>
          <button class="btn primary" data-action="tk-new">${icon('plus')}Nova tarefa</button>
        </div>
      </div>
      ${tabs}
      ${filters}
      ${content}
    </div>`;
}

// ---------- Ações ----------
const rerender = () => bus.render();
on('tk-view', (ds) => { S().view = ds.v; save(); });
on('tk-sort', (ds) => { S().sort = ds.v; save(); });
on('tk-show-done', () => { S().showDone = !S().showDone; save(); });
on('tk-col', (ds) => { F().col = ds.v; rerender(); });
on('tk-collapse', (ds) => { const c = F().collapsed; c[ds.v] = !c[ds.v]; rerender(); });
on('tk-folder', (ds) => { F().folder = ds.v; rerender(); });
on('tk-pop', (ds) => { const f = F(); f.pop = f.pop === ds.p ? null : ds.p; rerender(); });
on('tk-set-proj', (ds) => { Object.assign(F(), { proj: ds.v, pop: null }); rerender(); });
on('tk-group-proj', () => { S().groupProj = !S().groupProj; F().pop = null; save(); });
on('tk-set-prio', (ds) => { Object.assign(F(), { prio: ds.v, pop: null }); rerender(); });
on('tk-set-created', (ds) => { Object.assign(F(), { created: ds.v, pop: null }); rerender(); });
on('tk-q', (ds, el) => {
  F().q = el.value;
  const pos = el.selectionStart;
  rerender();
  const i = document.querySelector('[data-input="tk-q"]');
  if (i) { i.focus(); i.setSelectionRange(pos, pos); }
});
on('tk-new', (ds) => {
  const f = F();
  const d = {};
  if (f.proj && f.proj !== 'all') d.project = f.proj;
  if (f.folder !== 'all') d.folder = f.folder;
  if (ds.status) d.status = ds.status;
  openForm('tasks', null, d);
});

// Pastas
on('tk-folder-new', () => {
  openOverlay(`<form class="modal" style="max-width:380px" data-submit="tk-folder-save">
    <div class="modal-head"><h3>Nova pasta</h3><button type="button" class="icon-btn" data-action="close-overlay" aria-label="Fechar">${icon('x')}</button></div>
    <div style="padding:4px 20px 0"><input name="fname" class="tk-input" placeholder="Ex.: Casa, Faculdade, Cliente X" maxlength="40" required></div>
    <div class="modal-foot"><button type="button" class="btn" data-action="close-overlay">Cancelar</button><button class="btn primary">Criar pasta</button></div>
  </form>`, (bd) => bd.querySelector('input')?.focus());
});
on('tk-folder-save', (ds, form) => {
  const name = form.elements.fname.value.trim();
  if (!name) return;
  const fo = { id: uid(), name };
  items('taskFolders').push(fo);
  F().folder = fo.id;
  closeOverlay();
  save();
  toast(`Pasta “${name}” criada`);
});
on('tk-folder-del', async (ds) => {
  const fo = folders().find((x) => x.id === ds.id);
  if (!fo) return;
  if (!(await confirmDialog(`Excluir a pasta “${fo.name}”?`, 'As tarefas dela continuam, só que fora da pasta.'))) return;
  items('tasks').forEach((t) => { if (t.folder === fo.id) delete t.folder; });
  state.data.taskFolders = folders().filter((x) => x.id !== fo.id);
  F().folder = 'all';
  save();
});

// Adicionar rápido (Enter cria; aceita #tag, !alta, hoje/amanhã e horário)
document.addEventListener('keydown', (e) => {
  if (e.target.id !== 'tk-quick' || e.key !== 'Enter' || e.isComposing) return;
  e.preventDefault();
  const q = parseQuick(e.target.value);
  if (!q.title) return;
  const f = F();
  const t = { title: q.title, done: false, status: 'A fazer', priority: q.priority || 'Média' };
  if (q.due) t.due = q.due;
  if (q.time) t.time = q.time;
  if (q.tags) t.tags = q.tags.join(', ');
  if (f.proj && f.proj !== 'all') t.project = f.proj;
  if (f.folder !== 'all') t.folder = f.folder;
  upsert('tasks', t);
  toast('Tarefa criada');
  document.getElementById('tk-quick')?.focus();
});

// Fecha menus ao clicar fora; Esc também.
document.addEventListener('mousedown', (e) => {
  const f = ui.tk;
  if (!f?.pop || e.target.closest('.tk-pop, [data-action="tk-pop"]')) return;
  f.pop = null; rerender();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && ui.tk?.pop && document.querySelector('.tk-pop')) { e.stopImmediatePropagation(); ui.tk.pop = null; rerender(); }
}, true);

// Arrastar: no Kanban muda o status; na lista (ordem manual) muda a posição.
let dragId = null;
document.addEventListener('dragstart', (e) => {
  const el = e.target.closest?.('[data-tk-drag]');
  if (!el) return;
  dragId = el.dataset.tkDrag;
  el.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  try { e.dataTransfer.setData('text/plain', dragId); } catch { /* alguns navegadores não deixam */ }
});
document.addEventListener('dragend', (e) => {
  e.target.closest?.('[data-tk-drag]')?.classList.remove('dragging');
  document.querySelectorAll('.tk-col.over').forEach((c) => c.classList.remove('over'));
  dragId = null;
});
document.addEventListener('dragover', (e) => {
  if (!dragId) return;
  const col = e.target.closest('[data-tk-col]');
  const r = e.target.closest('.tk-row');
  if (col || r) e.preventDefault();
  document.querySelectorAll('.tk-col.over').forEach((c) => c !== col && c.classList.remove('over'));
  col?.classList.add('over');
});
document.addEventListener('drop', (e) => {
  if (!dragId) return;
  const t = find('tasks', dragId);
  const col = e.target.closest('[data-tk-col]');
  const r = e.target.closest('.tk-row');
  if (!t || (!col && !r)) return;
  e.preventDefault();
  if (col) {
    const st = col.dataset.tkCol;
    if (st === 'Concluída') upsert('tasks', { id: t.id, done: true, doneAt: today() });
    else upsert('tasks', { id: t.id, status: st, done: false, doneAt: null });
  } else if (r.dataset.tkDrag !== t.id) {
    const list = sorted(filtered());
    const from = list.findIndex((x) => x.id === t.id), to = list.findIndex((x) => x.id === r.dataset.tkDrag);
    list.splice(to, 0, list.splice(from, 1)[0]);
    list.forEach((x, i) => { x.order = i; });
    save();
  }
  dragId = null;
});
