// Janela de captura "Tarefa / Nota": texto com atalhos (#tag !alta amanhã 15h), data, hora, prioridade e projeto.
import { items, upsert, today, addDays, parseISO } from './store.js';
import { escapeHtml as esc, MONTHS_FULL } from './collections.js';
import { icon } from './icons.js';
import { ui, on, openOverlay, closeOverlay, toast, formHooks } from './ui.js';

const PRIOS = [['Urgente', 4], ['Alta', 3], ['Média', 2], ['Baixa', 1]];
const DOW = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const prioKey = (p) => p.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
// Ícone de prioridade: alerta para urgente, barrinhas de sinal para as outras.
const prioIcon = (p) => {
  if (p === 'Urgente') return `<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 8v5M12 16h.01"/></svg>`;
  const lvl = (PRIOS.find((x) => x[0] === p) || [0, 0])[1];
  if (!lvl) return '<span class="tkm-dash">—</span>';
  return `<svg class="i bars" viewBox="0 0 24 24" aria-hidden="true">${[1, 2, 3].map((n) => `<rect x="${3 + (n - 1) * 7}" y="${20 - n * 5}" width="3.2" height="${n * 5}" rx="1" class="${n <= lvl ? 'f' : ''}"/>`).join('')}</svg>`;
};
let tm = null;

const projectNames = () => [...items('personalProjects'), ...items('workProjects')].map((p) => p.title).filter(Boolean);
const shortDate = (d) => { const p = parseISO(d); return `${p.getDate()} de ${MONTHS_FULL[p.getMonth()].slice(0, 3).toLowerCase()}.`; };

// Lê os atalhos digitados no texto. Devolve o título limpo e o que foi encontrado.
export function parseQuick(raw) {
  let text = ` ${raw} `;
  const out = {};
  const tags = [...text.matchAll(/\s#([\p{L}\d_-]+)/gu)].map((m) => m[1]);
  if (tags.length) { out.tags = tags; text = text.replace(/\s#[\p{L}\d_-]+/gu, ' '); }
  const pr = text.match(/\s!(urgente|alta|m[eé]dia|baixa)(?=\s)/iu);
  if (pr) { out.priority = { alta: 'Alta', baixa: 'Baixa', urgente: 'Urgente' }[pr[1].toLowerCase()] || 'Média'; text = text.replace(pr[0], ' '); }
  const day = text.match(/\s(hoje|amanh[ãa])(?=\s)/iu);
  if (day) { out.due = /hoje/i.test(day[1]) ? today() : addDays(1); text = text.replace(day[0], ' '); }
  const hr = text.match(/\s(?:às\s)?([01]?\d|2[0-3])(?:h([0-5]\d)?|:([0-5]\d))(?=\s)/iu);
  if (hr) { out.time = `${hr[1].padStart(2, '0')}:${hr[2] || hr[3] || '00'}`; text = text.replace(hr[0], ' '); }
  out.title = text.replace(/\s+/g, ' ').trim();
  return out;
}

const fresh = (mode = 'task', d = {}) => ({
  mode, title: d.title || '', details: d.notes || '', showDetails: !!d.notes,
  due: d.due ?? (new Date().getHours() >= 18 ? addDays(1) : today()),
  time: d.time || '', priority: d.priority && d.priority !== 'Média' ? d.priority : '', project: d.project || '',
  image: null, noteTitle: '', noteBody: '', pop: null, calY: null, calM: null,
});

export function openTaskModal(defaults = {}, mode = 'task') {
  tm = fresh(mode, defaults);
  render();
  return true;
}

function render(focusSel) {
  const note = tm.mode === 'note';
  const T = today(), A = addDays(1);
  const other = tm.due && tm.due !== T && tm.due !== A;
  const q = parseQuick(tm.title);
  const projects = projectNames();
  const can = note ? (tm.noteTitle.trim() || tm.noteBody.trim()) : q.title;
  const body = note ? `
      <input class="tkm-title" id="tkm-note-title" data-input="tkm-note-title" placeholder="Título da nota" value="${esc(tm.noteTitle)}" maxlength="140">
      <textarea class="tkm-body" id="tkm-note-body" data-input="tkm-note-body" placeholder="Escreva livremente…" rows="5">${esc(tm.noteBody)}</textarea>` : `
      <input class="tkm-title" id="tkm-title" data-input="tkm-title" placeholder="O que precisa ser feito?" value="${esc(tm.title)}" maxlength="200" autocomplete="off">
      <div class="tkm-parsed">${parsedChips(q)}</div>
      ${tm.showDetails
        ? `<textarea class="tkm-body small" id="tkm-details" data-input="tkm-details" placeholder="Detalhes, links, passos…" rows="3">${esc(tm.details)}</textarea>`
        : `<button class="tkm-more" data-action="tkm-show-details">${icon('chevD')}+ Detalhes</button>`}`;
  const opts = note ? '' : `
    <div class="tkm-opts">
      <button class="tkm-chip ${tm.due === T ? 'on' : ''}" data-action="tkm-day" data-d="${T}">${icon('calendar')}Hoje</button>
      <button class="tkm-chip ${tm.due === A ? 'on' : ''}" data-action="tkm-day" data-d="${A}">${icon('calendar')}Amanhã</button>
      <span class="tkm-anchor"><button class="tkm-chip dashed ${other ? 'on' : ''}" data-action="tkm-pop" data-p="date" aria-expanded="${tm.pop === 'date'}">${icon('calendar')}<span>${other ? shortDate(tm.due) : 'Outro dia…'}</span></button>${tm.pop === 'date' ? calendarPop() : ''}</span>
      <label class="tkm-chip dashed ${tm.time ? 'on' : ''}">${icon('clock')}<span>${tm.time || 'Hora…'}</span><input type="time" data-change="tkm-time" value="${tm.time}" aria-label="Hora"></label>
      <span class="tkm-anchor"><button class="tkm-chip plain prio ${tm.priority ? 'on p-' + prioKey(tm.priority) : ''}" data-action="tkm-pop" data-p="prio" aria-expanded="${tm.pop === 'prio'}">${prioIcon(tm.priority)}<span>${tm.priority || 'Prioridade'}</span></button>${tm.pop === 'prio' ? prioPop() : ''}</span>
    </div>`;
  openOverlay(`
    <div class="modal tkm ${tm.drawn ? 'still' : ''}" role="dialog" aria-label="${note ? 'Nova nota' : 'Nova tarefa'}">
      <div class="tkm-top">
        <div class="tkm-tabs" role="tablist">
          <button class="${note ? '' : 'on'}" role="tab" aria-selected="${!note}" data-action="tkm-mode" data-m="task">${icon('checkCircle')}Tarefa</button>
          <button class="${note ? 'on' : ''}" role="tab" aria-selected="${note}" data-action="tkm-mode" data-m="note">${icon('file')}Nota</button>
        </div>
        <span class="tkm-hint">Use <code>#tag</code> <code>!alta</code> <code>amanhã</code> <code>15h</code></span>
        <label class="tkm-gallery">${icon('image')}Galeria<input type="file" accept="image/*" data-change="tkm-image" aria-label="Anexar imagem da galeria"></label>
      </div>
      <div class="tkm-main">
        ${body}
        ${tm.image ? `<div class="tkm-img"><img src="${tm.image}" alt="Imagem anexada"><button class="icon-btn" data-action="tkm-img-x" aria-label="Remover imagem">${icon('x')}</button></div>` : ''}
      </div>
      <div class="tkm-foot">
        ${opts}
        <div class="tkm-bottom">
          <span class="tkm-anchor proj-a"><button class="tkm-chip plain proj" data-action="tkm-pop" data-p="proj" aria-expanded="${tm.pop === 'proj'}">${icon('inbox')}<span>${esc(tm.project || 'Inbox')}</span></button>${tm.pop === 'proj' ? projPop(projects) : ''}</span>
          <span class="tkm-keys"><kbd>⇧</kbd><kbd>↵</kbd> salvar e continuar</span>
          <button class="tkm-save" data-action="tkm-save" ${can ? '' : 'disabled'}>Salvar ${icon('enter')}</button>
        </div>
      </div>
    </div>`, (bd) => {
    bd.classList.add('tkm-backdrop');
    if (tm.drawn) bd.classList.add('still');
    tm.drawn = true;
    const f = bd.querySelector(focusSel || (note ? '#tkm-note-title' : '#tkm-title'));
    if (f && !tm.pop) { f.focus(); const n = f.value.length; f.setSelectionRange?.(n, n); }
    // Mantém o menu aberto dentro da tela.
    const pop = bd.querySelector('.tkm-pop');
    if (pop) {
      const a = pop.parentElement.getBoundingClientRect(), w = pop.offsetWidth;
      let left = 0;
      if (a.left + w > innerWidth - 8) left = innerWidth - 8 - w - a.left;
      if (a.left + left < 8) left = 8 - a.left;
      pop.style.left = `${left}px`;
    }
  });
}

const check = (on) => (on ? `<span class="tkm-ck">${icon('check')}</span>` : '');
function prioPop() {
  return `<div class="tkm-pop menu" role="menu">${PRIOS.map(([p]) => `<button role="menuitemradio" aria-checked="${tm.priority === p}" class="p-${prioKey(p)}" data-action="tkm-set-prio" data-v="${p}">${prioIcon(p)}<span>${p}</span>${check(tm.priority === p)}</button>`).join('')}
    <button role="menuitemradio" aria-checked="${!tm.priority}" data-action="tkm-set-prio" data-v=""><span class="tkm-dash">—</span><span>Sem prioridade</span>${check(!tm.priority)}</button></div>`;
}
function projPop(projects) {
  return `<div class="tkm-pop menu up" role="menu"><button role="menuitemradio" aria-checked="${!tm.project}" data-action="tkm-set-proj" data-v=""><span>Inbox (sem projeto)</span>${check(!tm.project)}</button>
    ${projects.map((p) => `<button role="menuitemradio" aria-checked="${tm.project === p}" data-action="tkm-set-proj" data-v="${esc(p)}">${icon('folder')}<span>${esc(p)}</span>${check(tm.project === p)}</button>`).join('')}</div>`;
}
function calendarPop() {
  const T = today();
  const base = parseISO(tm.due || T);
  if (tm.calY == null) { tm.calY = base.getFullYear(); tm.calM = base.getMonth(); }
  const first = new Date(tm.calY, tm.calM, 1);
  const start = new Date(first); start.setDate(1 - ((first.getDay() + 6) % 7));
  const cells = [];
  for (let k = 0; k < 42; k++) {
    const d = new Date(start); d.setDate(start.getDate() + k);
    const s = iso(d);
    cells.push(`<button class="${d.getMonth() !== tm.calM ? 'out' : ''} ${s === T ? 'today' : ''} ${s === tm.due ? 'sel' : ''}" data-action="tkm-pick" data-d="${s}" aria-label="${shortDate(s)}">${d.getDate()}</button>`);
  }
  const now = new Date();
  const endMonth = iso(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  const y0 = now.getFullYear();
  return `<div class="tkm-pop tkm-calpop" role="dialog" aria-label="Escolher dia">
    <div class="tkm-cal-head">
      <button class="icon-btn" data-action="tkm-cal" data-n="-1" aria-label="Mês anterior">${icon('chevL')}</button>
      <label class="tkm-sel strong"><span>${MONTHS_FULL[tm.calM]}</span>${icon('chevD')}<select data-change="tkm-cal-m" aria-label="Mês">${MONTHS_FULL.map((m, i) => `<option value="${i}" ${i === tm.calM ? 'selected' : ''}>${m}</option>`).join('')}</select></label>
      <label class="tkm-sel"><span>${tm.calY}</span>${icon('chevD')}<select data-change="tkm-cal-y" aria-label="Ano">${[y0 - 1, y0, y0 + 1, y0 + 2, y0 + 3].map((y) => `<option ${y === tm.calY ? 'selected' : ''}>${y}</option>`).join('')}</select></label>
      <button class="icon-btn" data-action="tkm-cal" data-n="1" aria-label="Próximo mês">${icon('chevR')}</button>
    </div>
    <div class="tkm-quick">
      <button data-action="tkm-pick" data-d="${T}">Hoje</button><button data-action="tkm-pick" data-d="${addDays(1)}">Amanhã</button>
      <button data-action="tkm-pick" data-d="${addDays(7)}">+7 dias</button><button data-action="tkm-pick" data-d="${endMonth}">Fim do mês</button>
    </div>
    <div class="tkm-grid">${DOW.map((d) => `<span>${d}</span>`).join('')}${cells.join('')}</div>
  </div>`;
}

function parsedChips(q) {
  const c = [];
  if (q.tags) q.tags.forEach((t) => c.push(`<span>#${esc(t)}</span>`));
  if (q.priority) c.push(`<span>!${q.priority.toLowerCase()}</span>`);
  if (q.due) c.push(`<span>${q.due === today() ? 'hoje' : 'amanhã'}</span>`);
  if (q.time) c.push(`<span>${q.time}</span>`);
  return c.join('');
}

// Atualiza só o necessário enquanto digita (sem redesenhar a janela).
function refresh() {
  const bd = document.querySelector('.tkm');
  if (!bd) return;
  const note = tm.mode === 'note';
  const q = parseQuick(tm.title);
  const can = note ? (tm.noteTitle.trim() || tm.noteBody.trim()) : q.title;
  bd.querySelector('.tkm-save').disabled = !can;
  const p = bd.querySelector('.tkm-parsed');
  if (p) p.innerHTML = parsedChips(q);
}

on('tkm-title', (ds, el) => { tm.title = el.value; refresh(); });
on('tkm-details', (ds, el) => { tm.details = el.value; });
on('tkm-note-title', (ds, el) => { tm.noteTitle = el.value; refresh(); });
on('tkm-note-body', (ds, el) => { tm.noteBody = el.value; refresh(); });
on('tkm-mode', (ds) => { tm.mode = ds.m; render(); });
on('tkm-show-details', () => { tm.showDetails = true; render('#tkm-details'); });
on('tkm-day', (ds) => { tm.due = tm.due === ds.d ? '' : ds.d; render(); });
on('tkm-pop', (ds) => { tm.pop = tm.pop === ds.p ? null : ds.p; if (tm.pop === 'date') tm.calY = null; render(); });
on('tkm-pick', (ds) => { tm.due = ds.d; tm.pop = null; render(); });
on('tkm-cal', (ds) => { const d = new Date(tm.calY, tm.calM + +ds.n, 1); tm.calY = d.getFullYear(); tm.calM = d.getMonth(); render(); });
on('tkm-cal-m', (ds, el) => { tm.calM = +el.value; render(); });
on('tkm-cal-y', (ds, el) => { tm.calY = +el.value; render(); });
on('tkm-set-prio', (ds) => { tm.priority = ds.v; tm.pop = null; render(); });
on('tkm-set-proj', (ds) => { tm.project = ds.v; tm.pop = null; render(); });
// Clique fora fecha o menu aberto; Esc fecha o menu antes da janela.
document.addEventListener('mousedown', (e) => {
  if (!tm?.pop || !e.target.closest('.tkm') || e.target.closest('.tkm-pop, [data-action="tkm-pop"]')) return;
  tm.pop = null; render();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && tm?.pop && document.querySelector('.tkm')) { e.stopImmediatePropagation(); tm.pop = null; render(); }
}, true);
on('tkm-time', (ds, el) => { tm.time = el.value; render(); });
on('tkm-img-x', () => { tm.image = null; render(); });
on('tkm-save', () => save(false));
on('tkm-image', (ds, el) => {
  const file = el.files?.[0];
  if (!file) return;
  const img = new Image();
  img.onload = () => {
    const k = Math.min(1, 900 / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    tm.image = c.toDataURL('image/jpeg', 0.8);
    URL.revokeObjectURL(img.src);
    render();
  };
  img.onerror = () => toast('Não consegui abrir essa imagem.');
  img.src = URL.createObjectURL(file);
});

function save(keepOpen) {
  if (!tm) return;
  if (tm.mode === 'note') {
    const title = tm.noteTitle.trim(), body = tm.noteBody.trim();
    if (!title && !body) return;
    const tags = [...` ${title} ${body}`.matchAll(/\s#([\p{L}\d_-]+)/gu)].map((m) => m[1]);
    upsert('ideas', { title: title || body.split('\n')[0].slice(0, 80), notes: body, tags: tags.join(', '), project: tm.project || undefined, image: tm.image || undefined });
    toast('Nota salva em Ideias');
    if (keepOpen) { tm.noteTitle = ''; tm.noteBody = ''; tm.image = null; render(); } else { tm = null; closeOverlay(); }
    return;
  }
  const q = parseQuick(tm.title);
  if (!q.title) return;
  const task = {
    title: q.title, done: false,
    due: q.due || tm.due || undefined,
    time: q.time || tm.time || undefined,
    priority: q.priority || tm.priority || 'Média',
    project: tm.project || undefined,
    tags: q.tags?.join(', ') || undefined,
    notes: tm.details.trim() || undefined,
    image: tm.image || undefined,
  };
  upsert('tasks', task);
  const when = task.due === today() ? ' para hoje' : task.due === addDays(1) ? ' para amanhã' : task.due ? ` para ${shortDate(task.due)}` : '';
  toast(`Tarefa criada${when}`);
  if (keepOpen) { tm.title = ''; tm.details = ''; tm.image = null; render(); } else { tm = null; closeOverlay(); }
}

document.addEventListener('keydown', (e) => {
  if (!tm || !e.target.closest?.('.tkm') || e.key !== 'Enter' || e.isComposing) return;
  const inBody = e.target.tagName === 'TEXTAREA';
  if (e.shiftKey) { e.preventDefault(); save(true); return; }
  if (inBody && !(e.ctrlKey || e.metaKey)) return; // Enter comum quebra linha nos textos longos
  if (e.target.id === 'tkm-note-title' && !(e.ctrlKey || e.metaKey)) { e.preventDefault(); document.getElementById('tkm-note-body')?.focus(); return; }
  e.preventDefault();
  save(false);
});

// Nova tarefa abre esta janela; editar uma tarefa continua no formulário completo.
formHooks.tasks = (d, id) => (id ? false : openTaskModal(d));
