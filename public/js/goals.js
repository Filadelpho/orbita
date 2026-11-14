// Metas: cartões com anel de progresso e a janela "Nova meta" (progresso manual ou automático).
import { state, items, upsert, remove, find, today, addDays, parseISO } from './store.js';
import { escapeHtml as esc, MONTHS_FULL } from './collections.js';
import { icon } from './icons.js';
import { on, openOverlay, closeOverlay, toast, confirmDialog, formHooks } from './ui.js';
import { allProjects, isDone as projectDone } from './projects.js';
import { habitList, habitDue } from './habits.js';

export const AREAS = [['Carreira', 'briefcase'], ['Saúde', 'heart'], ['Finanças', 'wallet'], ['Estudos', 'grad'], ['Pessoal', 'spark']];
const COLORS = ['#7b6cc4', '#4a86c5', '#3a9688', '#c4973b', '#c2566f', '#3a97a8'];
const MODES = [['manual', 'Manual (eu atualizo)'], ['tasks', 'Automático: Tarefas desta meta'], ['project', 'Automático: Um projeto'], ['habit', 'Automático: Um hábito'], ['focus', 'Automático: Horas de foco'], ['books', 'Automático: Livros lidos']];
const SUGGEST = ['R$ 30.000 de reserva de emergência', '12 livros lidos no ano', '5 novos clientes atendidos', '10% de gordura corporal'];

const shortDate = (d) => { const p = parseISO(d); return `${p.getDate()} de ${MONTHS_FULL[p.getMonth()].slice(0, 3).toLowerCase()}`; };
const daysLeft = (d) => Math.round((parseISO(d) - parseISO(today())) / 864e5);
const areaIcon = (a) => (AREAS.find((x) => x[0] === a) || AREAS[4])[1];
const sinceOf = (g) => g.since || (g.createdAt ? new Date(g.createdAt).toISOString().slice(0, 10) : addDays(-30));

// Calcula o progresso de uma meta e uma linha que explica de onde ele vem.
export function goalProgress(g) {
  const mode = g.mode || 'manual';
  const pct = (a, b) => (b > 0 ? Math.min(100, Math.round((a / b) * 100)) : 0);
  if (mode === 'tasks') {
    const ts = items('tasks').filter((t) => t.goal === g.id);
    const d = ts.filter((t) => t.done).length;
    return { pct: pct(d, ts.length), line: ts.length ? `${d} de ${ts.length} tarefas` : 'Nenhuma tarefa ligada ainda', ico: 'checkSquare' };
  }
  if (mode === 'project') {
    const p = allProjects().find((x) => x.id === g.link);
    if (!p) return { pct: 0, line: 'Escolha um projeto', ico: 'folder' };
    const ts = items('tasks').filter((t) => t.project === p.title);
    const d = ts.filter((t) => t.done).length;
    return { pct: projectDone(p) ? 100 : pct(d, ts.length), line: `${p.title} · ${d}/${ts.length} tarefas`, ico: 'folder' };
  }
  if (mode === 'habit') {
    const h = find('habits', g.link);
    if (!h) return { pct: 0, line: 'Escolha um hábito', ico: 'repeat' };
    const from = sinceOf(g), to = g.deadline || addDays(30, parseISO(from));
    let due = 0, done = 0;
    for (let d = from; d <= to && due < 800; d = addDays(1, parseISO(d))) { if (habitDue(h, d)) { due++; if (h.log?.[d]) done++; } }
    return { pct: pct(done, due), line: `${h.name} · ${done} de ${due} dias`, ico: 'repeat' };
  }
  if (mode === 'focus') {
    const min = items('focus').filter((f) => f.date >= sinceOf(g)).reduce((s, f) => s + (+f.minutes || 0), 0);
    const goalH = +g.amount || 10;
    return { pct: pct(min, goalH * 60), line: `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')} de ${goalH}h de foco`, ico: 'clock' };
  }
  if (mode === 'books') {
    const since = sinceOf(g);
    const n = items('books').filter((b) => b.status === 'Lido' && (b.finishedAt || (b.createdAt ? new Date(b.createdAt).toISOString().slice(0, 10) : '')) >= since).length;
    const goalN = +g.amount || 12;
    return { pct: pct(n, goalN), line: `${n} de ${goalN} livros`, ico: 'book' };
  }
  return { pct: Math.max(0, Math.min(100, +g.progress || 0)), line: g.target ? `Alvo: ${g.target}` : 'Progresso manual', ico: 'target' };
}

const ring = (pct, size = 54) => {
  const r = size / 2 - 4, c = 2 * Math.PI * r;
  return `<svg class="gl-ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--surface-3)" stroke-width="5"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--gc)" stroke-width="5" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - pct / 100)}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg>`;
};

function card(g, preview = false) {
  const pr = goalProgress(g);
  const nProj = allProjects().filter((p) => p.goal === g.id || (g.mode === 'project' && p.id === g.link)).length;
  const nTask = items('tasks').filter((t) => t.goal === g.id).length;
  const nHab = habitList().filter((h) => h.goal === g.id || (g.mode === 'habit' && h.id === g.link)).length;
  const left = g.deadline ? daysLeft(g.deadline) : null;
  const pl = (n, a, b) => `${n} ${n === 1 ? a : b}`;
  return `<article class="gl-card ${pr.pct >= 100 ? 'done' : ''}" style="--gc:${esc(g.color || COLORS[0])}" ${preview ? '' : `data-action="gl-edit" data-id="${g.id}" tabindex="0"`}>
    <div class="gl-top"><span class="gl-area">${esc(g.area || 'Pessoal')}</span><span class="gl-dl">${g.deadline ? `até ${shortDate(g.deadline)}` : 'sem prazo'}</span></div>
    <div class="gl-mid">
      <span class="gl-ringwrap">${ring(pr.pct)}<b>${pr.pct}%</b></span>
      <div class="gl-txt"><h3>${esc(g.title || 'Título da meta')}</h3>${g.target ? `<small>${esc(g.target)}</small>` : ''}<span class="gl-line">${icon(pr.ico)}${esc(pr.line)}</span></div>
    </div>
    <div class="gl-foot">
      <span>${icon('folder')}${pl(nProj, 'projeto', 'projetos')}</span><span>${icon('checkSquare')}${pl(nTask, 'tarefa', 'tarefas')}</span><span>${icon('repeat')}${pl(nHab, 'hábito', 'hábitos')}</span>
      <span class="gl-left ${left != null && left < 0 && pr.pct < 100 ? 'late' : ''}">${left == null ? '' : left < 0 ? `${-left} dias atrás` : left === 0 ? 'hoje' : `${left} ${left === 1 ? 'dia' : 'dias'}`}</span>
    </div>
  </article>`;
}

export function goalsPage() {
  const all = items('goals');
  const withPct = all.map((g) => ({ g, pct: goalProgress(g).pct }));
  const active = withPct.filter((x) => x.pct < 100);
  const done = withPct.filter((x) => x.pct >= 100);
  const avg = active.length ? Math.round(active.reduce((s, x) => s + x.pct, 0) / active.length) : 0;
  const sortByDl = (a, b) => (a.g.deadline || '9').localeCompare(b.g.deadline || '9');
  return `<div class="pj-page">
    <div class="tk-head">
      <div><div class="tk-h1"><span class="tk-hico">${icon('target')}</span><h1>Metas</h1></div><p>${active.length} ${active.length === 1 ? 'meta ativa' : 'metas ativas'} · progresso médio de ${avg}%</p></div>
      <div class="tk-head-actions"><button class="btn primary" data-action="gl-new">${icon('plus')}Nova meta</button></div>
    </div>
    ${all.length ? `<div class="gl-grid">${active.sort(sortByDl).map((x) => card(x.g)).join('')}</div>
      ${done.length ? `<h2 class="gl-h2">Conquistadas <small>${done.length}</small></h2><div class="gl-grid">${done.map((x) => card(x.g)).join('')}</div>` : ''}`
      : `<div class="pj-empty"><span class="pj-empty-ico">${icon('target')}</span><b>Nenhuma meta ainda</b><p>Defina objetivos claros e mensuráveis para direcionar seu foco.</p><button class="btn primary" data-action="gl-new">${icon('plus')}Nova meta</button></div>`}
  </div>`;
}

// ---------- Janela "Nova meta" ----------
let gm = null;
export function openGoalModal(defaults = {}, id = null) {
  const g = id ? find('goals', id) : null;
  const endYear = `${new Date().getFullYear()}-12-31`;
  gm = g ? { ...g, area: AREAS.some((a) => a[0] === g.area) ? g.area : 'Pessoal', mode: g.mode || 'manual', color: g.color || COLORS[0], progress: +g.progress || 0 }
    : { title: defaults.title || '', area: 'Carreira', deadline: addDays(90), target: '', mode: 'manual', progress: 0, color: COLORS[0], link: '', amount: '', since: '' };
  if (!gm.deadline && !g) gm.deadline = endYear;
  render();
  return true;
}
function modeExtra() {
  const m = gm.mode;
  if (m === 'manual') return `<div class="glm-box"><div class="glm-row"><span>Progresso atual</span><b class="glm-pct">${gm.progress}%</b></div>
    <input type="range" min="0" max="100" step="5" value="${gm.progress}" data-input="glm-progress" aria-label="Progresso atual" style="--v:${gm.progress}%">
    <div class="glm-steps">${[0, 25, 50, 75, 100].map((v) => `<button class="${+gm.progress === v ? 'on' : ''}" data-action="glm-step" data-v="${v}">${v}%</button>`).join('')}</div></div>`;
  if (m === 'tasks') return `<p class="glm-note">Ligue tarefas a esta meta no campo “Meta” da tarefa. O progresso é a parte concluída.</p>`;
  if (m === 'project') { const ps = allProjects(); return `<div class="hbm-select"><select data-change="glm-link" aria-label="Projeto"><option value="">${ps.length ? 'Escolha um projeto' : 'Você ainda não tem projetos'}</option>${ps.map((p) => `<option value="${p.id}" ${gm.link === p.id ? 'selected' : ''}>${esc(p.title)}</option>`).join('')}</select>${icon('chevD')}</div>`; }
  if (m === 'habit') { const hs = habitList(); return `<div class="hbm-select"><select data-change="glm-link" aria-label="Hábito"><option value="">${hs.length ? 'Escolha um hábito' : 'Você ainda não tem hábitos'}</option>${hs.map((h) => `<option value="${h.id}" ${gm.link === h.id ? 'selected' : ''}>${esc((h.emoji ? h.emoji + ' ' : '') + h.name)}</option>`).join('')}</select>${icon('chevD')}</div><p class="glm-note">Conta os dias marcados desde o início até o prazo.</p>`; }
  const unit = m === 'focus' ? 'horas de foco' : 'livros';
  return `<p class="glm-note">${m === 'focus' ? 'Soma o tempo das sessões de foco.' : 'Conta livros terminados.'}</p>
    <div class="glm-inline">Meta de <input type="number" min="1" data-input="glm-amount" value="${esc(gm.amount || (m === 'focus' ? 10 : 12))}" aria-label="Quantidade"> ${unit} desde
      <label class="pjm-date sm">${icon('calendar')}<span>${gm.since ? shortDate(gm.since) : 'Selecione uma data'}</span><input type="date" data-change="glm-since" value="${gm.since || ''}"></label></div>
    <p class="glm-now">Agora: ${esc(goalProgress({ ...gm, id: gm.id || '_' }).line)} (${goalProgress({ ...gm, id: gm.id || '_' }).pct}%)</p>`;
}
function render(focus = null) {
  const left = gm.deadline ? daysLeft(gm.deadline) : null;
  const end = `${new Date().getFullYear()}-12-31`;
  openOverlay(`<div class="modal pjm glm" style="--gc:${esc(gm.color)};--pc:${esc(gm.color)}" role="dialog" aria-label="${gm.id ? 'Editar meta' : 'Nova meta'}">
    <div class="pjm-head"><span class="pj-ico">${icon('target')}</span><div><h3>${gm.id ? 'Editar meta' : 'Nova meta'}</h3><p>Defina objetivos claros e mensuráveis para direcionar seu foco.</p></div>
      <button class="icon-btn" data-action="close-overlay" aria-label="Fechar">${icon('x')}</button></div>
    <div class="pjm-body">
      <label class="pjm-label" for="glm-title">Título da meta <em class="req">*</em></label>
      <input id="glm-title" class="pjm-input" data-input="glm-f" data-f="title" value="${esc(gm.title)}" placeholder="ex: Reserva de emergência de R$ 30 mil" maxlength="100" autocomplete="off">
      <span class="pjm-label">Área da vida</span>
      <div class="pjm-types five">${AREAS.map(([a, ic]) => `<button class="${gm.area === a ? 'on' : ''}" data-action="glm-area" data-v="${a}">${icon(ic)}${a}</button>`).join('')}</div>
      <div class="glm-row"><span class="pjm-label">Prazo limite</span><small class="muted">${left == null ? 'sem prazo' : left < 0 ? 'prazo passou' : `${left} dias restantes`}</small></div>
      <div class="glm-due">
        <label class="pjm-date">${icon('calendar')}<span>${gm.deadline ? shortDate(gm.deadline) + (gm.deadline.slice(0, 4) !== String(new Date().getFullYear()) ? ', ' + gm.deadline.slice(0, 4) : '') : 'Sem prazo'}</span><input type="date" data-change="glm-due" value="${gm.deadline || ''}"></label>
        ${gm.deadline ? `<button class="icon-btn" data-action="glm-due-set" data-v="" aria-label="Tirar prazo">${icon('x')}</button>` : ''}
        <button class="glm-quick" data-action="glm-due-set" data-v="${addDays(30)}">+1 mês</button><button class="glm-quick" data-action="glm-due-set" data-v="${addDays(91)}">+3 meses</button><button class="glm-quick" data-action="glm-due-set" data-v="${end}">Fim do ano</button>
      </div>
      <label class="pjm-label" for="glm-target">Alvo descritivo / Métrica de sucesso (opcional)</label>
      <input id="glm-target" class="pjm-input sm" data-input="glm-f" data-f="target" value="${esc(gm.target || '')}" placeholder="ex: R$ 30.000 poupados ou 3 de 5 clientes">
      <div class="glm-sugg">${SUGGEST.map((s) => `<button data-action="glm-target" data-v="${esc(s)}">+ ${esc(s)}</button>`).join('')}</div>
      <div class="glm-box"><span class="pjm-label" style="margin:0">Progresso</span>
        <div class="hbm-select"><select data-change="glm-mode" aria-label="Como medir o progresso">${MODES.map(([v, l]) => `<option value="${v}" ${gm.mode === v ? 'selected' : ''}>${l}</option>`).join('')}</select>${icon('chevD')}</div>
        ${modeExtra()}</div>
      <span class="pjm-label">Cor de destaque</span>
      <div class="hbm-colors">${COLORS.map((c) => `<button style="--c:${c}" class="${gm.color === c ? 'on' : ''}" data-action="glm-color" data-v="${c}" aria-label="Cor ${c}">${icon('check')}</button>`).join('')}</div>
      <div class="hbm-prev"><div class="hbm-prev-head"><span>Pré-visualização</span><span>Como aparecerá na lista</span></div>${card({ ...gm, id: gm.id || '_' }, true)}</div>
    </div>
    <div class="pjm-foot">${gm.id ? `<button class="btn danger" data-action="glm-delete" style="margin-right:auto">${icon('trash')}Excluir</button>` : ''}<button class="btn ghost" data-action="close-overlay">Cancelar</button><button class="btn primary" data-action="glm-save" ${gm.title.trim() ? '' : 'disabled'}>${gm.id ? 'Salvar alterações' : 'Criar meta'}</button></div>
  </div>`, (bd) => {
    bd.classList.add('pjm-backdrop');
    const el = focus === false ? null : bd.querySelector(focus || '#glm-title');
    if (el) { el.focus(); el.setSelectionRange?.(el.value.length, el.value.length); }
  });
}
const keepScroll = (fn) => { const s = document.querySelector('.glm .pjm-body')?.scrollTop || 0; fn(); const b = document.querySelector('.glm .pjm-body'); if (b) b.scrollTop = s; };
const rerender = () => keepScroll(() => render(false));
on('glm-f', (ds, el) => {
  gm[ds.f] = el.value;
  const b = document.querySelector('[data-action="glm-save"]');
  if (b) b.disabled = !gm.title.trim();
  const h = document.querySelector('.glm .gl-card h3'); if (h && ds.f === 'title') h.textContent = el.value || 'Título da meta';
});
on('glm-area', (ds) => { gm.area = ds.v; rerender(); });
on('glm-due', (ds, el) => { gm.deadline = el.value; rerender(); });
on('glm-due-set', (ds) => { gm.deadline = ds.v; rerender(); });
on('glm-target', (ds) => { gm.target = ds.v; rerender(); });
on('glm-mode', (ds, el) => { gm.mode = el.value; gm.link = ''; rerender(); });
on('glm-link', (ds, el) => { gm.link = el.value; rerender(); });
on('glm-since', (ds, el) => { gm.since = el.value; rerender(); });
on('glm-amount', (ds, el) => { gm.amount = el.value; });
on('glm-color', (ds) => { gm.color = ds.v; rerender(); });
on('glm-step', (ds) => { gm.progress = +ds.v; rerender(); });
on('glm-progress', (ds, el) => {
  gm.progress = +el.value;
  const p = document.querySelector('.glm-pct'); if (p) p.textContent = `${el.value}%`;
  el.style.setProperty('--v', `${el.value}%`);
});
on('glm-save', () => {
  const title = gm.title.trim();
  if (!title) return;
  const data = { title, area: gm.area, deadline: gm.deadline || '', target: (gm.target || '').trim(), mode: gm.mode, progress: +gm.progress || 0, color: gm.color, link: gm.link || '', amount: gm.amount === '' ? '' : +gm.amount, since: gm.since || '' };
  upsert('goals', gm.id ? { id: gm.id, ...data } : data);
  toast(gm.id ? 'Meta atualizada' : 'Meta criada 🎯');
  gm = null;
  closeOverlay();
});
on('glm-delete', async () => {
  const g = gm && find('goals', gm.id);
  if (!g) return;
  closeOverlay();
  if (await confirmDialog(`Excluir “${g.title}”?`, 'Tarefas, projetos e hábitos ligados a ela continuam, só que sem meta.')) {
    [items('tasks'), items('habits'), items('personalProjects'), items('workProjects')].forEach((l) => l.forEach((x) => { if (x.goal === g.id) delete x.goal; }));
    remove('goals', g.id);
    toast('Meta excluída');
  }
  gm = null;
});
on('gl-new', () => openGoalModal());
on('gl-edit', (ds) => openGoalModal({}, ds.id));
document.addEventListener('keydown', (e) => { if (gm && e.key === 'Enter' && e.target.id === 'glm-title' && gm.title.trim()) { e.preventDefault(); document.querySelector('[data-action="glm-save"]')?.click(); } });

formHooks.goals = (d, id) => openGoalModal(d, id);
