// Projetos: grade/lista por tipo, janela "Novo projeto" e a página de cada projeto (tarefas, notas e links).
import { state, items, upsert, remove, find, save, today, parseISO, uid } from './store.js';
import { escapeHtml as esc, MONTHS_FULL } from './collections.js';
import { icon } from './icons.js';
import { ui, on, bus, openOverlay, closeOverlay, toast, confirmDialog, formHooks } from './ui.js';
import { HABIT_COLORS } from './habits.js';
import { parseQuick } from './task-modal.js';

export const TYPES = [['Pessoal', 'user'], ['Acadêmico', 'grad'], ['Profissional', 'briefcase'], ['Freelance', 'bolt']];
const STATUS = ['Planejado', 'Em andamento', 'Em revisão', 'Pausado', 'Concluído'];
const DONE = ['Concluído', 'Entregue'];
const keyFor = (type) => (type === 'Profissional' || type === 'Freelance' ? 'workProjects' : 'personalProjects');

export const typeOf = (p, key) => p.type || ((key || p.key) === 'workProjects' ? 'Profissional' : 'Pessoal');
export const isDone = (p) => DONE.includes(p.status);
const colorOf = (p) => p.color || HABIT_COLORS[[...(p.title || '')].reduce((a, c) => a + c.charCodeAt(0), 0) % HABIT_COLORS.length];
export const allProjects = () => [
  ...items('personalProjects').map((p) => ({ ...p, key: 'personalProjects' })),
  ...items('workProjects').map((p) => ({ ...p, key: 'workProjects' })),
];
const findProject = (id) => allProjects().find((p) => p.id === id);
const projTasks = (p) => items('tasks').filter((t) => t.project && t.project === p.title);
const shortDate = (d) => { const p = parseISO(d); return `${p.getDate()} de ${MONTHS_FULL[p.getMonth()].slice(0, 3).toLowerCase()}.`; };
const P = () => (state.settings.pj ||= { view: 'grid', showDone: false });
const F = () => (ui.pj ||= { type: 'all' });

function deadlineChip(p) {
  if (!p.deadline) return '';
  const late = !isDone(p) && p.deadline < today();
  const days = Math.round((parseISO(p.deadline) - parseISO(today())) / 864e5);
  const rel = isDone(p) ? '' : days === 0 ? ' · hoje' : days > 0 && days <= 7 ? ` · em ${days} ${days === 1 ? 'dia' : 'dias'}` : late ? ' · atrasado' : '';
  return `<span class="pj-due ${late ? 'late' : ''}">${icon('calendar')}até ${shortDate(p.deadline)}${rel}</span>`;
}
function progress(p) {
  const ts = projTasks(p);
  const done = ts.filter((t) => t.done).length;
  return { total: ts.length, done, pct: ts.length ? Math.round((done / ts.length) * 100) : isDone(p) ? 100 : 0 };
}
const typeIcon = (t) => (TYPES.find((x) => x[0] === t) || TYPES[0])[1];

function cardHtml(p) {
  const pr = progress(p);
  const type = typeOf(p);
  return `<article class="pj-card ${isDone(p) ? 'done' : ''}" style="--pc:${esc(colorOf(p))}" data-action="pj-open" data-id="${p.id}" tabindex="0">
    <div class="pj-card-top"><span class="pj-ico">${icon(typeIcon(type))}</span>
      <span class="pj-status s-${(p.status || 'Planejado').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, '-')}">${esc(p.status || 'Planejado')}</span></div>
    <h3>${esc(p.title)}</h3>
    <div class="pj-sub"><span>${esc(type)}</span>${p.client ? `<span>· ${esc(p.client)}</span>` : ''}</div>
    ${p.notes ? `<p class="pj-desc">${esc(p.notes)}</p>` : ''}
    <div class="pj-prog"><span class="pj-bar"><i style="width:${pr.pct}%"></i></span><small>${pr.total ? `${pr.done}/${pr.total} tarefas` : 'Sem tarefas'}</small></div>
    <div class="pj-foot">${deadlineChip(p) || '<span class="pj-due">Sem prazo</span>'}${p.hours ? `<span class="pj-hours">${icon('clock')}${esc(p.hours)}h</span>` : ''}</div>
  </article>`;
}
function rowHtml(p) {
  const pr = progress(p);
  return `<button class="pj-row ${isDone(p) ? 'done' : ''}" style="--pc:${esc(colorOf(p))}" data-action="pj-open" data-id="${p.id}">
    <span class="pj-ico sm">${icon(typeIcon(typeOf(p)))}</span>
    <span class="pj-row-main"><b>${esc(p.title)}</b><small>${esc(typeOf(p))}${p.client ? ' · ' + esc(p.client) : ''}</small></span>
    <span class="pj-status">${esc(p.status || 'Planejado')}</span>
    <span class="pj-prog"><span class="pj-bar"><i style="width:${pr.pct}%"></i></span><small>${pr.total ? `${pr.done}/${pr.total}` : '—'}</small></span>
    ${deadlineChip(p) || '<span class="pj-due">Sem prazo</span>'}
  </button>`;
}

export function projectsPage() {
  if (ui.sub) {
    const p = findProject(ui.sub);
    if (p) return detailPage(p);
  }
  const s = P(), f = F();
  const all = allProjects();
  const active = all.filter((p) => !isDone(p));
  const pool = s.showDone ? all : active;
  const list = pool.filter((p) => f.type === 'all' || typeOf(p) === f.type)
    .sort((a, b) => (isDone(a) - isDone(b)) || (a.deadline || '9').localeCompare(b.deadline || '9'));
  const count = (t) => pool.filter((p) => typeOf(p) === t).length;
  const body = list.length
    ? (s.view === 'list' ? `<div class="pj-list">${list.map(rowHtml).join('')}</div>` : `<div class="pj-grid">${list.map(cardHtml).join('')}</div>`)
    : `<div class="pj-empty"><span class="pj-empty-ico">${icon('folder')}</span><b>Nenhum projeto aqui</b><p>Crie um projeto para agrupar tarefas, notas e arquivos.</p><button class="btn primary" data-action="pj-new">${icon('plus')}Novo projeto</button></div>`;
  return `<div class="pj-page">
    <div class="tk-head">
      <div><div class="tk-h1"><span class="tk-hico">${icon('folder')}</span><h1>Projetos</h1></div><p>${active.length} ${active.length === 1 ? 'ativo' : 'ativos'} · ${all.length} no total</p></div>
      <div class="tk-head-actions">
        <div class="tk-view" role="radiogroup" aria-label="Visualização">
          <button role="radio" aria-checked="${s.view !== 'list'}" class="${s.view !== 'list' ? 'on' : ''}" data-action="pj-view" data-v="grid">${icon('grid')}Grade</button>
          <button role="radio" aria-checked="${s.view === 'list'}" class="${s.view === 'list' ? 'on' : ''}" data-action="pj-view" data-v="list">${icon('menu')}Lista</button>
        </div>
        <button class="btn primary" data-action="pj-new">${icon('plus')}Novo projeto</button>
      </div>
    </div>
    <div class="pj-tabs">
      <div class="tk-tabs">
        <button class="tk-tab ${f.type === 'all' ? 'on' : ''}" data-action="pj-type" data-v="all">Todos <small>${pool.length}</small></button>
        ${TYPES.map(([t]) => `<button class="tk-tab ${f.type === t ? 'on' : ''}" data-action="pj-type" data-v="${t}">${t} <small>${count(t)}</small></button>`).join('')}
      </div>
      <label class="pj-showdone"><input type="checkbox" data-change="pj-show-done" ${s.showDone ? 'checked' : ''}>Mostrar concluídos</label>
    </div>
    ${body}
  </div>`;
}

// ---------- Página de um projeto ----------
function detailPage(p) {
  const pr = progress(p);
  const ts = projTasks(p).sort((a, b) => (a.done - b.done) || (a.due || '9').localeCompare(b.due || '9'));
  const notes = items('ideas').filter((n) => n.project === p.title);
  const links = p.links || [];
  const T = today();
  return `<div class="pj-page pj-detail" style="--pc:${esc(colorOf(p))}">
    <a class="pj-back" href="#/projects">${icon('chevL')}Projetos</a>
    <div class="pj-dhead">
      <span class="pj-ico lg">${icon(typeIcon(typeOf(p)))}</span>
      <div class="pj-dtitle"><h1>${esc(p.title)}</h1>
        <div class="pj-sub"><span class="pj-status">${esc(p.status || 'Planejado')}</span><span>${esc(typeOf(p))}</span>${p.client ? `<span>· ${esc(p.client)}</span>` : ''}${deadlineChip(p)}${p.hours ? `<span class="pj-hours">${icon('clock')}${esc(p.hours)}h estimadas</span>` : ''}</div></div>
      <div class="pj-dactions">
        <button class="btn" data-action="pj-edit" data-id="${p.id}">${icon('edit')}Editar</button>
        <button class="btn" data-action="pj-toggle-done" data-id="${p.id}">${icon(isDone(p) ? 'refresh' : 'check')}${isDone(p) ? 'Reabrir' : 'Concluir'}</button>
        <button class="icon-btn danger" data-action="pj-delete" data-id="${p.id}" aria-label="Excluir projeto">${icon('trash')}</button>
      </div>
    </div>
    ${p.notes ? `<p class="pj-ddesc">${esc(p.notes)}</p>` : ''}
    <div class="pj-dstats">
      <div><small>Progresso</small><b>${pr.pct}%</b><span class="pj-bar"><i style="width:${pr.pct}%"></i></span></div>
      <div><small>Tarefas</small><b>${pr.done}/${pr.total}</b><span class="muted">${ts.filter((t) => !t.done && t.due && t.due < T).length} atrasadas</span></div>
      <div><small>Notas</small><b>${notes.length}</b><span class="muted">${links.length} ${links.length === 1 ? 'link' : 'links'}</span></div>
    </div>
    <div class="pj-cols">
      <section class="pj-sec">
        <h3>${icon('checkSquare')}Tarefas <small>${pr.total}</small></h3>
        <label class="tk-quick">${icon('plus')}<input id="pj-task" data-pid="${p.id}" placeholder="Nova tarefa… use !alta, amanhã, 15h" autocomplete="off"></label>
        <div class="pj-tasks">${ts.map((t) => `<div class="tk-row ${t.done ? 'done' : ''}">
          <button class="tk-check ${t.done ? 'on' : ''}" data-action="toggle-done" data-key="tasks" data-id="${t.id}" aria-label="${t.done ? 'Reabrir' : 'Concluir'}">${icon('check')}</button>
          <button class="tk-main" data-action="open-form" data-key="tasks" data-id="${t.id}"><span class="tk-title">${esc(t.title)}</span>${t.due ? `<span class="tk-due ${!t.done && t.due < T ? 'late' : ''}">${icon('calendar')}${t.due === T ? 'Hoje' : shortDate(t.due)}${t.time ? ` · ${esc(t.time)}` : ''}</span>` : ''}</button></div>`).join('') || '<p class="pj-none">Nenhuma tarefa ainda. Escreva acima e aperte Enter.</p>'}</div>
      </section>
      <div class="pj-side">
        <section class="pj-sec">
          <h3>${icon('file')}Notas <small>${notes.length}</small></h3>
          <label class="tk-quick">${icon('plus')}<input id="pj-note" data-pid="${p.id}" placeholder="Anotar algo sobre o projeto…" autocomplete="off"></label>
          ${notes.map((n) => `<button class="pj-note" data-action="open-form" data-key="ideas" data-id="${n.id}"><b>${esc(n.title)}</b>${n.notes ? `<small>${esc(n.notes)}</small>` : ''}</button>`).join('') || '<p class="pj-none">Sem notas.</p>'}
        </section>
        <section class="pj-sec">
          <h3>${icon('link')}Links e arquivos <small>${links.length}</small></h3>
          <form class="pj-linkform" data-submit="pj-link-add" data-id="${p.id}"><input name="url" type="url" placeholder="Cole um link (Drive, Figma, documento…)" required><button class="btn sm" aria-label="Adicionar link">${icon('plus')}</button></form>
          ${links.map((l, i) => `<div class="pj-link"><a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${icon('link')}<span>${esc(l.label || l.url.replace(/^https?:\/\/(www\.)?/, ''))}</span></a><button class="icon-btn" data-action="pj-link-del" data-id="${p.id}" data-i="${i}" aria-label="Remover link">${icon('x')}</button></div>`).join('')}
        </section>
      </div>
    </div>
  </div>`;
}

// ---------- Janela "Novo projeto" ----------
let pm = null;
export function openProjectModal(defaults = {}, id = null) {
  const cur = id ? findProject(id) : null;
  pm = cur
    ? { id, key: cur.key, title: cur.title, type: typeOf(cur), color: colorOf(cur), client: cur.client || '', deadline: cur.deadline || '', hours: cur.hours || '', notes: cur.notes || '', status: cur.status === 'Entregue' ? 'Concluído' : cur.status || 'Planejado' }
    : { id: null, title: defaults.title || '', type: defaults.type || (F().type !== 'all' ? F().type : 'Pessoal'), color: HABIT_COLORS[4], client: '', deadline: '', hours: '', notes: '', status: 'Planejado' };
  renderModal();
  return true;
}
function renderModal(focus = '#pjm-name') {
  const clients = [...new Set(allProjects().map((p) => p.client).filter((c) => c && c !== 'Interno'))];
  openOverlay(`<div class="modal pjm" style="--pc:${esc(pm.color)}" role="dialog" aria-label="${pm.id ? 'Editar projeto' : 'Novo projeto'}">
    <div class="pjm-head"><span class="pj-ico">${icon(typeIcon(pm.type))}</span><div><h3>${pm.id ? 'Editar projeto' : 'Novo projeto'}</h3><p>Tudo pode ser ajustado depois.</p></div>
      <button class="icon-btn" data-action="close-overlay" aria-label="Fechar">${icon('x')}</button></div>
    <div class="pjm-body">
      <label class="pjm-label" for="pjm-name">Nome</label>
      <input id="pjm-name" class="pjm-input" data-input="pjm-f" data-f="title" value="${esc(pm.title)}" placeholder="Ex.: Lançamento do portfólio" maxlength="80" autocomplete="off">
      <span class="pjm-label">Tipo</span>
      <div class="pjm-types">${TYPES.map(([t, ic]) => `<button class="${pm.type === t ? 'on' : ''}" data-action="pjm-type" data-v="${t}">${icon(ic)}${t}</button>`).join('')}</div>
      <span class="pjm-label">Cor</span>
      <div class="hbm-colors">${HABIT_COLORS.map((c) => `<button style="--c:${c}" class="${pm.color === c ? 'on' : ''}" data-action="pjm-color" data-v="${c}" aria-label="Cor ${c}">${icon('check')}</button>`).join('')}</div>
      <div class="pjm-two">
        <div><label class="pjm-label" for="pjm-client">Cliente</label>
          <input id="pjm-client" class="pjm-input sm" list="pjm-clients" data-input="pjm-f" data-f="client" value="${esc(pm.client)}" placeholder="Nenhum (iniciativa própria)">
          <datalist id="pjm-clients">${clients.map((c) => `<option value="${esc(c)}">`).join('')}</datalist></div>
        <div><label class="pjm-label" for="pjm-due">Entrega</label>
          <label class="pjm-date">${icon('calendar')}<span>${pm.deadline ? shortDate(pm.deadline) : 'Sem prazo'}</span><input id="pjm-due" type="date" data-change="pjm-due" value="${pm.deadline}"></label>
          ${pm.deadline ? '<button class="link-btn pjm-clear" data-action="pjm-due-clear">tirar prazo</button>' : ''}</div>
      </div>
      <div class="pjm-effort"><span class="pjm-effort-t">${icon('clock')}Estimativa de esforço (opcional)</span>
        <label for="pjm-hours">Horas estimadas de dedicação</label>
        <input id="pjm-hours" class="pjm-input sm mono" type="number" min="0" step="1" data-input="pjm-f" data-f="hours" value="${esc(pm.hours)}" placeholder="Ex.: 20"></div>
      ${pm.id ? `<span class="pjm-label">Status</span><div class="pjm-status">${STATUS.map((s) => `<button class="${pm.status === s ? 'on' : ''}" data-action="pjm-status" data-v="${s}">${s}</button>`).join('')}</div>` : ''}
      <label class="pjm-label" for="pjm-desc">Descrição</label>
      <textarea id="pjm-desc" class="pjm-input area" data-input="pjm-f" data-f="notes" rows="3" placeholder="Qual o objetivo deste projeto?">${esc(pm.notes)}</textarea>
    </div>
    <div class="pjm-foot"><button class="btn ghost" data-action="close-overlay">Cancelar</button><button class="btn primary" data-action="pjm-save" ${pm.title.trim() ? '' : 'disabled'}>${pm.id ? 'Salvar' : 'Criar projeto'}</button></div>
  </div>`, (bd) => { bd.classList.add('pjm-backdrop'); const el = bd.querySelector(focus); if (el && focus) { el.focus(); el.setSelectionRange?.(el.value.length, el.value.length); } });
}
on('pjm-f', (ds, el) => {
  pm[ds.f] = el.value;
  const b = document.querySelector('[data-action="pjm-save"]');
  if (b) b.disabled = !pm.title.trim();
});
on('pjm-type', (ds) => { pm.type = ds.v; renderModal(null); });
on('pjm-color', (ds) => { pm.color = ds.v; renderModal(null); });
on('pjm-status', (ds) => { pm.status = ds.v; renderModal(null); });
on('pjm-due', (ds, el) => { pm.deadline = el.value; renderModal(null); });
on('pjm-due-clear', () => { pm.deadline = ''; renderModal(null); });
on('pjm-save', () => {
  const title = pm.title.trim();
  if (!title) return;
  const key = keyFor(pm.type);
  const data = { title, type: pm.type, color: pm.color, client: pm.client.trim(), deadline: pm.deadline, hours: pm.hours === '' ? '' : +pm.hours, notes: pm.notes.trim() };
  if (pm.id) {
    const old = findProject(pm.id);
    const status = pm.status === 'Concluído' && old.key === 'workProjects' && key === 'workProjects' ? 'Entregue' : pm.status;
    // Renomear leva as tarefas e notas junto.
    if (old.title !== title) {
      items('tasks').forEach((t) => { if (t.project === old.title) t.project = title; });
      items('ideas').forEach((n) => { if (n.project === old.title) n.project = title; });
    }
    const { key: _k, ...rest } = old;
    if (old.key !== key) { remove(old.key, old.id); items(key).push({ ...rest, ...data, status }); save(); }
    else upsert(key, { id: pm.id, ...data, status });
    toast('Projeto atualizado');
  } else {
    const p = upsert(key, { ...data, status: 'Em andamento' });
    toast(`Projeto “${title}” criado`);
    location.hash = `#/projects/${p.id}`;
  }
  pm = null;
  closeOverlay();
});
document.addEventListener('keydown', (e) => {
  if (pm && e.key === 'Enter' && e.target.id === 'pjm-name' && pm.title.trim()) { e.preventDefault(); document.querySelector('[data-action="pjm-save"]')?.click(); }
});

// ---------- Ações da página ----------
on('pj-view', (ds) => { P().view = ds.v; save(); });
on('pj-type', (ds) => { F().type = ds.v; bus.render(); });
on('pj-show-done', (ds, el) => { P().showDone = el.checked; save(); });
on('pj-new', () => openProjectModal());
on('pj-open', (ds) => { location.hash = `#/projects/${ds.id}`; });
on('pj-edit', (ds) => openProjectModal({}, ds.id));
on('pj-toggle-done', (ds) => {
  const p = findProject(ds.id);
  if (!p) return;
  const status = isDone(p) ? 'Em andamento' : p.key === 'workProjects' ? 'Entregue' : 'Concluído';
  upsert(p.key, { id: p.id, status });
  toast(isDone(p) ? 'Projeto reaberto' : 'Projeto concluído 🎉');
});
on('pj-delete', async (ds) => {
  const p = findProject(ds.id);
  if (!p) return;
  const n = projTasks(p).length;
  if (!(await confirmDialog(`Excluir “${p.title}”?`, n ? `As ${n} tarefas dele continuam, só que sem projeto.` : 'Essa ação não pode ser desfeita.'))) return;
  items('tasks').forEach((t) => { if (t.project === p.title) delete t.project; });
  remove(p.key, p.id);
  location.hash = '#/projects';
  toast('Projeto excluído');
});
on('pj-link-add', (ds, form) => {
  const p = findProject(ds.id);
  const url = form.elements.url.value.trim();
  if (!p || !/^https?:\/\//i.test(url)) return toast('Cole um link começando com http.');
  upsert(p.key, { id: p.id, links: [...(p.links || []), { url, id: uid() }] });
});
on('pj-link-del', (ds) => {
  const p = findProject(ds.id);
  if (!p) return;
  upsert(p.key, { id: p.id, links: (p.links || []).filter((_, i) => i !== +ds.i) });
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || e.isComposing || !['pj-task', 'pj-note'].includes(e.target.id)) return;
  e.preventDefault();
  const p = findProject(e.target.dataset.pid);
  const val = e.target.value.trim();
  if (!p || !val) return;
  if (e.target.id === 'pj-task') {
    const q = parseQuick(val);
    if (!q.title) return;
    upsert('tasks', { title: q.title, done: false, status: 'A fazer', priority: q.priority || 'Média', project: p.title, ...(q.due ? { due: q.due } : {}), ...(q.time ? { time: q.time } : {}), ...(q.tags ? { tags: q.tags.join(', ') } : {}) });
  } else upsert('ideas', { title: val, project: p.title });
  document.getElementById(e.target.id)?.focus();
});

// Criar/editar projeto (das listas antigas, do Início ou do botão +) abre esta janela.
formHooks.personalProjects = (d, id) => openProjectModal(d, id);
formHooks.workProjects = (d, id) => openProjectModal({ type: 'Profissional', ...d }, id);
