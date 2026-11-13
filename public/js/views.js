// Telas do ORBITA.
import { state, items, upsert, find, save, today, addDays, iso, parseISO } from './store.js';
import { COLLECTIONS, chipFor, primaryOf, brl, brlShort, relDate, fmtDate, MONTHS_FULL, WEEKDAYS, monthShort, EXPENSE_CATS, escapeHtml as esc } from './collections.js';
import { icon } from './icons.js';
import { ui, on, bus, openOverlay, closeOverlay, toast, cap } from './ui.js';
import { groupedBars, areaLine, ring, donut, PALETTE } from './charts.js';
import { insights, financeSummary, habitStreak, weekHabitRate, avg, reply } from './ai.js';
import { coverArt, openCoverPicker } from './cover.js';
import { settingsPage } from './settings.js';
import { habitList, habitTree, groupChildren, habitDue, challengeInfo, freqLabel } from './habits.js';
import { dLink, dCard, dEmpty, dBtn, fmtMin, focusWeek, focusBars, focusItemsCard, projectsCard, achievementsCard, heatmapCard, rhythmCard, dataCard } from './home.js';

// ---------- Páginas / navegação ----------
export const PAGES = [
  { id: 'dashboard', title: 'Início', icon: 'home', render: dashboard },
  { id: 'ai', title: 'ORBITA AI', icon: 'spark', render: aiPage },
  { id: 'tasks', group: 'Organização', title: 'Tarefas', icon: 'check', module: 'tasks', tabs: ['tasks'], desc: 'Tudo o que precisa ser feito, por prioridade e data.' },
  { id: 'calendar', group: 'Organização', title: 'Calendário', icon: 'calendar', module: 'calendar', render: calendarPage },
  { id: 'habits', group: 'Organização', title: 'Hábitos e rotina', icon: 'repeat', module: 'habits', render: habitsPage },
  { id: 'goals', group: 'Organização', title: 'Metas e projetos', icon: 'target', module: 'goals', tabs: ['goals', 'personalProjects'], desc: 'Seus objetivos pessoais e os projetos que te levam até eles.' },
  { id: 'work', group: 'Carreira e estudos', title: 'Trabalho e carreira', icon: 'briefcase', module: 'work', tabs: ['workProjects', 'career'], desc: 'Projetos, entregas, desenvolvimento profissional e portfólio.' },
  { id: 'studies', group: 'Carreira e estudos', title: 'Educação', icon: 'grad', module: 'studies', tabs: ['studies', 'books'], desc: 'Faculdade, programação, idiomas, cursos, certificações e leitura.' },
  { id: 'finance', group: 'Vida', title: 'Finanças', icon: 'wallet', module: 'finance', render: financePage },
  { id: 'health', group: 'Vida', title: 'Saúde e bem-estar', icon: 'heart', module: 'health', render: healthPage },
  { id: 'content', group: 'Vida', title: 'Criatividade e conteúdo', icon: 'pen', module: 'content', render: contentPage },
  { id: 'travel', group: 'Vida', title: 'Viagens e lazer', icon: 'plane', module: 'travel', tabs: ['trips', 'leisure'], desc: 'Destinos, roteiros, orçamentos e momentos de lazer.' },
  { id: 'settings', group: 'Sistema', title: 'Configurações', icon: 'gear', render: settingsPage },
];

export const MODULE_INFO = {
  tasks: { title: 'Tarefas', icon: 'check', desc: 'Tarefas e compromissos' },
  calendar: { title: 'Calendário', icon: 'calendar', desc: 'Agenda integrada' },
  habits: { title: 'Hábitos', icon: 'repeat', desc: 'Rotina e sequências' },
  goals: { title: 'Metas', icon: 'target', desc: 'Metas e projetos pessoais' },
  work: { title: 'Trabalho', icon: 'briefcase', desc: 'Carreira, portfólio, entregas' },
  studies: { title: 'Educação', icon: 'grad', desc: 'Faculdade, cursos, idiomas, leitura' },
  finance: { title: 'Finanças', icon: 'wallet', desc: 'Gastos, orçamento, investimentos' },
  health: { title: 'Saúde', icon: 'heart', desc: 'Humor, sono, treino, diário' },
  content: { title: 'Conteúdo', icon: 'pen', desc: 'Ideias, editorial, métricas' },
  travel: { title: 'Viagens', icon: 'plane', desc: 'Destinos, roteiros, lazer' },
};

export const moduleOn = (m) => !m || state.settings.modules[m] !== false;
export const go = (route) => { location.hash = '#/' + route; };

const head = (title, desc, actions = '') => `
  <div class="page-head"><div><h1>${esc(title)}</h1>${desc ? `<p>${esc(desc)}</p>` : ''}</div><div class="actions">${actions}</div></div>`;
const addBtn = (key, label, extra = '') => `<button class="btn primary" data-action="open-form" data-key="${key}" ${extra}>${icon('plus')}${esc(label)}</button>`;
const emptyState = (ico, text) => `<div class="empty">${icon(ico)}${esc(text)}</div>`;
const cardHead = (ico, title, more = '') => `<div class="card-head"><div class="ico">${icon(ico)}</div><h3>${esc(title)}</h3>${more}</div>`;
const moreLink = (route, label = 'Ver tudo') => `<a class="more" href="#/${route}">${esc(label)}${icon('chevR')}</a>`;

// ---------- Item genérico ----------
export function itemRow(key, it, { compact = false } = {}) {
  const cfg = COLLECTIONS[key];
  const doneKey = cfg.done;
  const isDone = doneKey && it[doneKey];
  const pf = cfg.fields.find((f) => f.name === (cfg.primary || 'title')) || cfg.fields[0];
  let title = primaryOf(cfg, it);
  if (pf?.type === 'date') title = cap(relDate(title)) + (title !== today() ? '' : '');
  const metaFields = (cfg.meta || []).map((n) => cfg.fields.find((f) => f.name === n)).filter(Boolean);
  const chips = compact ? metaFields.slice(0, 2) : metaFields;
  const pct = cfg.progress ? +it[cfg.progress] || 0 : cfg.progressOf ? cfg.progressOf(it) : null;
  const sub = cfg.sub && it[cfg.sub] ? String(it[cfg.sub]).split('\n')[0] : '';
  let amount = '';
  if (cfg.amount) {
    const neg = it.type === 'Despesa';
    const pos = it.type === 'Receita';
    amount = `<span class="amount ${pos ? 'up' : ''}">${neg ? '−' : pos ? '+' : ''}${brl(it[cfg.amount])}</span>`;
  }
  return `
    <div class="item ${isDone ? 'done' : ''}">
      ${doneKey ? `<button class="check ${isDone ? 'on' : ''}" data-action="toggle-done" data-key="${key}" data-id="${it.id}" aria-label="Concluir">${icon('check')}</button>` : ''}
      <div class="item-main" data-action="open-form" data-key="${key}" data-id="${it.id}" style="cursor:pointer">
        <div class="item-title">${esc(title)}</div>
        ${sub && !compact ? `<div class="item-sub">${esc(sub)}</div>` : ''}
        ${chips.length ? `<div class="item-meta">${chips.map((f) => chipFor(f, it[f.name], it)).join('')}</div>` : ''}
        ${pct !== null && !compact ? `<div class="progress-line"><div class="bar ${key === 'trips' && pct >= 100 ? 'red' : ''}"><i style="width:${pct}%"></i></div><small>${cfg.progressLabel ? '' : pct + '%'}</small></div>${cfg.progressLabel ? `<div class="item-sub">${esc(cfg.progressLabel(it))}</div>` : ''}` : ''}
      </div>
      ${amount}
      ${compact ? '' : `<div class="item-actions">
        <button class="icon-btn sm" data-action="open-form" data-key="${key}" data-id="${it.id}" aria-label="Editar">${icon('edit')}</button>
        <button class="icon-btn sm" data-action="delete-item" data-key="${key}" data-id="${it.id}" aria-label="Excluir">${icon('trash')}</button>
      </div>`}
    </div>`;
}

function collectionView(key) {
  const cfg = COLLECTIONS[key];
  const q = (ui.filter[key] || '').toLowerCase();
  let list = [...items(key)];
  if (q) list = list.filter((it) => JSON.stringify(it).toLowerCase().includes(q));
  if (cfg.sort) list.sort(cfg.sort);
  const hideDone = cfg.done && ui.filter[key + ':hide'];
  if (hideDone) list = list.filter((it) => !it[cfg.done]);
  const view = cfg.kanban && ui.filter[key + ':view'] !== 'list' ? 'kanban' : 'list';
  const toolbar = `
    <div class="toolbar">
      <input class="input" placeholder="Filtrar ${esc(cfg.label.toLowerCase())}…" value="${esc(ui.filter[key] || '')}" data-input="filter" data-key="${key}">
      ${cfg.done ? `<button class="btn sm ${hideDone ? 'primary' : ''}" data-action="toggle-hide" data-key="${key}">${hideDone ? 'Mostrando pendentes' : 'Ocultar concluídas'}</button>` : ''}
      ${cfg.kanban ? `<div class="seg"><button class="${view === 'kanban' ? 'on' : ''}" data-action="set-view" data-key="${key}" data-view="kanban">${icon('grid')}Quadro</button><button class="${view === 'list' ? 'on' : ''}" data-action="set-view" data-key="${key}" data-view="list">${icon('menu')}Lista</button></div>` : ''}
      <span class="muted" style="margin-left:auto;font-size:12.5px">${list.length} ${list.length === 1 ? 'item' : 'itens'}</span>
      ${addBtn(key, 'Adicionar')}
    </div>`;
  if (view === 'kanban') return toolbar + kanban(key, list);
  return toolbar + `<div class="card" style="padding:8px">${list.length ? `<div class="list">${list.map((it) => itemRow(key, it)).join('')}</div>` : emptyState(cfg.icon, `Nenhum(a) ${cfg.singular} ainda. Clique em Adicionar para começar.`)}</div>`;
}

function kanban(key, list) {
  const cfg = COLLECTIONS[key];
  const field = cfg.fields.find((f) => f.name === cfg.kanban);
  return `<div class="kanban">${field.options.map((col) => {
    const cards = list.filter((it) => (it[cfg.kanban] || field.options[0]) === col);
    return `<div class="kcol" data-drop="${key}" data-col="${esc(col)}">
      <div class="kcol-head">${esc(col)} <span class="count">${cards.length}</span>
        <button class="icon-btn sm" style="margin-left:auto" data-action="open-form" data-key="${key}" data-def-${cfg.kanban}="${esc(col)}" aria-label="Adicionar">${icon('plus')}</button></div>
      ${cards.map((it) => {
        const meta = (cfg.meta || []).map((n) => cfg.fields.find((f) => f.name === n)).filter(Boolean);
        const pct = cfg.progressOf ? cfg.progressOf(it) : null;
        return `<div class="kcard" draggable="true" data-drag="${it.id}">
          <div class="t">${esc(primaryOf(cfg, it))}</div>
          ${pct !== null && pct > 0 ? `<div class="bar"><i style="width:${pct}%"></i></div>` : ''}
          <div class="row">${meta.map((f) => chipFor(f, it[f.name], it)).join('')}
            <button class="icon-btn sm" data-action="open-form" data-key="${key}" data-id="${it.id}" aria-label="Editar">${icon('edit')}</button></div>
        </div>`;
      }).join('')}
    </div>`;
  }).join('')}</div>`;
}

// Drag & drop do quadro
document.addEventListener('dragstart', (e) => {
  const c = e.target.closest?.('[data-drag]');
  if (!c) return;
  e.dataTransfer.setData('text/plain', c.dataset.drag);
  c.classList.add('dragging');
});
document.addEventListener('dragend', (e) => e.target.closest?.('[data-drag]')?.classList.remove('dragging'));
document.addEventListener('dragover', (e) => {
  const col = e.target.closest?.('[data-drop]');
  if (!col) return;
  e.preventDefault();
  document.querySelectorAll('.kcol.over').forEach((x) => x !== col && x.classList.remove('over'));
  col.classList.add('over');
});
document.addEventListener('drop', (e) => {
  const col = e.target.closest?.('[data-drop]');
  if (!col) return;
  e.preventDefault();
  const id = e.dataTransfer.getData('text/plain');
  const key = col.dataset.drop;
  upsert(key, { id, [COLLECTIONS[key].kanban]: col.dataset.col });
});

on('filter', (ds, el) => {
  ui.filter[ds.key] = el.value;
  const pos = el.selectionStart;
  bus.render();
  const again = document.querySelector(`[data-input="filter"][data-key="${ds.key}"]`);
  if (again) { again.focus(); again.setSelectionRange(pos, pos); }
});
on('toggle-hide', (ds) => { ui.filter[ds.key + ':hide'] = !ui.filter[ds.key + ':hide']; bus.render(); });
on('set-view', (ds) => { ui.filter[ds.key + ':view'] = ds.view; bus.render(); });
on('set-tab', (ds) => { ui.tab[ds.page] = ds.tab; bus.render(); });

function tabbed(pageId, tabs) {
  const active = tabs.includes(ui.tab[pageId]) ? ui.tab[pageId] : tabs[0];
  const bar = tabs.length > 1 ? `<div class="tabs">${tabs.map((k) => `<button class="tab ${k === active ? 'active' : ''}" data-action="set-tab" data-page="${pageId}" data-tab="${k}">${esc(COLLECTIONS[k].label)}</button>`).join('')}</div>` : '';
  return bar + collectionView(active);
}

export function genericPage(page) {
  return head(page.title, page.desc) + tabbed(page.id, page.tabs);
}

// ---------- Início ----------
function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Boa madrugada' : h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

export const MOODS = ['😞', '😕', '😐', '🙂', '😄'];
export const MOOD_LABEL = ['Muito mal', 'Mal', 'Neutro', 'Bem', 'Ótimo'];

const energyIcon = (n) => `<svg viewBox="0 0 22 14" width="22" height="14" aria-hidden="true">${[0, 1, 2, 3, 4].map((i) => `<rect x="${i * 4.5}" y="${12 - (i + 1) * 2.2}" width="3" height="${(i + 1) * 2.2}" rx="1" fill="${i < n ? 'currentColor' : 'var(--surface-3)'}"/>`).join('')}</svg>`;

const fmtClock = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
const FOCUS_SECONDS = 25 * 60;
const RING_C = 2 * Math.PI * 44;
function focusFace(running) {
  const left = focusLeft();
  const prog = 1 - left / FOCUS_SECONDS;
  const style = state.settings.focusClock || 'digital';
  const txt = `<span id="focus-time" class="${running ? 'running' : ''}">${fmtClock(left)}</span>`;
  if (style === 'ring') return `<span class="focus-ring"><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="44" fill="none" stroke="var(--surface-3)" stroke-width="6"/><circle id="focus-ring" cx="50" cy="50" r="44" fill="none" stroke="var(--accent)" stroke-width="6" stroke-linecap="round" stroke-dasharray="${RING_C}" stroke-dashoffset="${RING_C * (1 - prog)}" transform="rotate(-90 50 50)"/></svg>${txt}</span>`;
  if (style === 'minimal') return `<span class="focus-min">${txt}<span class="focus-line"><i id="focus-line" style="width:${prog * 100}%"></i></span></span>`;
  return txt;
}
const focusLeft = () => {
  const f = ui.focus;
  if (!f) return FOCUS_SECONDS;
  return Math.max(0, Math.round(f.paused ? f.left : (f.end - Date.now()) / 1000));
};

function dashboard() {
  const T = today();
  const W = state.settings.widgets;
  const M = (m) => moduleOn(m);
  const name = state.user?.name?.split(' ')[0] || '';
  const dateStr = cap(new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }));
  const hoje = [], progresso = [], ritmo = [];

  if (W.mood && M('health')) {
    const mood = items('moods').find((m) => m.date === T);
    const strip = [];
    for (let k = -13; k <= 0; k++) {
      const m = items('moods').find((x) => x.date === addDays(k));
      strip.push(`<i class="${m ? 'm' + m.score : ''}" title="${m ? MOOD_LABEL[m.score - 1] : 'Sem registro'}"></i>`);
    }
    hoje.push(dCard('smile', 'Como foi hoje?', `
      <div class="hoje-row"><span>Humor</span><div class="mseg">${MOODS.map((e, i) => `<button class="${mood?.score === i + 1 ? 'on' : ''}" data-action="log-mood" data-score="${i + 1}" title="${MOOD_LABEL[i]}" aria-label="${MOOD_LABEL[i]}">${e}</button>`).join('')}</div></div>
      <div class="hoje-row"><span>Energia</span><div class="mseg energy">${[1, 2, 3, 4, 5].map((n) => `<button class="${mood?.energy === n ? 'on' : ''}" data-action="log-energy" data-n="${n}" aria-label="Energia ${n} de 5">${energyIcon(n)}</button>`).join('')}</div></div>
      <input class="dinput" id="mood-note" data-change="mood-note" maxlength="140" placeholder="Uma linha sobre o dia (opcional)" value="${esc(mood?.note || '')}">
      <div class="mood-strip" aria-label="Humor dos últimos 14 dias">${strip.join('')}</div>`,
    { extra: mood ? `<span class="dcard-meta">${MOOD_LABEL[mood.score - 1]}</span>` : '' }));
  }

  if (W.habits && M('habits')) {
    const habits = habitList().filter((h) => habitDue(h, T));
    const doneH = habits.filter((h) => h.log?.[T]).length;
    const rows = habitTree().filter(({ h }) => h.group ? groupChildren(h).some((c) => habitDue(c, T)) : habitDue(h, T)).slice(0, 9);
    // Com todos os hábitos do dia feitos, a lista sai do Início e fica só a comemoração.
    const allDone = habits.length > 0 && doneH === habits.length && !ui.showDoneHabits;
    if (allDone) {
      const best = Math.max(0, ...habits.map(habitStreak));
      hoje.push(dCard('repeat', 'Hábitos de hoje', `
      <div class="dempty habits-done"><span class="dempty-ico">${icon('check')}</span><b>Todos os hábitos de hoje feitos 🎉</b>
        <p>${habits.length} de ${habits.length} concluídos${best > 1 ? ` · maior sequência: 🔥 ${best} dias` : ''}. Volte amanhã para manter o ritmo.</p>
        <button class="dbtn ghost" data-action="show-done-habits">Ver hábitos de hoje</button></div>`,
      { link: dLink('habits', 'Hábitos'), cls: 'tallh' }));
    } else hoje.push(dCard('repeat', 'Hábitos de hoje', rows.length ? `
      <div class="hlist">${rows.map(({ h, depth }) => {
        if (h.group) {
          const kids = groupChildren(h).filter((c) => habitDue(c, T));
          const n = kids.filter((c) => c.log?.[T]).length;
          return `<button class="hrow group" data-action="open-form" data-key="habits" data-id="${h.id}" style="--hc:${esc(h.color || 'var(--accent)')}"><span class="emoji">${esc(h.emoji || '📁')}</span><span class="name">${esc(h.name)}</span><span class="gcount ${n === kids.length ? 'full' : ''}">${n}/${kids.length}</span></button>`;
        }
        const c = challengeInfo(h);
        return `<button class="hrow ${h.log?.[T] ? 'on' : ''} ${depth ? 'child' : ''}" data-action="toggle-habit" data-id="${h.id}" data-date="${T}" style="--hc:${esc(h.color || 'var(--accent)')}">
          <span class="emoji">${esc(h.emoji || '✨')}</span><span class="name">${esc(h.name)}${c ? `<small>Dia ${c.day} de ${c.total}</small>` : h.minutes ? `<small>${h.minutes} min</small>` : ''}</span>
          ${habitStreak(h) ? `<span class="streak">🔥 ${habitStreak(h)}</span>` : ''}<span class="tick">${icon('check')}</span></button>`;
      }).join('')}</div>
      <div class="hfoot"><span>${doneH} de ${habits.length} feitos hoje${ui.showDoneHabits && doneH === habits.length ? ' · <button class="link-btn" data-action="hide-done-habits">Esconder</button>' : ''}</span><div class="bar"><i style="width:${habits.length ? (doneH / habits.length) * 100 : 0}%"></i></div></div>`
      : dEmpty('repeat', 'Nenhum hábito ainda', 'Comece com um pequeno e marque aqui todo dia.', dBtn('Criar seu primeiro hábito', 'data-action="open-form" data-key="habits"')),
    { link: dLink('habits', 'Hábitos'), cls: 'tallh' }));
  }

  if (W.tasks && M('tasks')) {
    const list = items('tasks').filter((t) => !t.done && (!t.due || t.due <= T)).sort(COLLECTIONS.tasks.sort).slice(0, 5);
    hoje.push(dCard('check', 'Tarefas', list.length ? `
      <div class="tlist">${list.map((t) => `
        <div class="trow"><button class="tcheck" data-action="toggle-done" data-key="tasks" data-id="${t.id}" aria-label="Concluir">${icon('check')}</button>
          <button class="ttitle" data-action="open-form" data-key="tasks" data-id="${t.id}">${esc(t.title)}</button>
          ${t.due && t.due < T ? '<span class="tchip late">Atrasada</span>' : t.priority === 'Alta' ? '<span class="tchip high">Alta</span>' : t.time ? `<span class="tchip">${esc(t.time)}</span>` : ''}</div>`).join('')}</div>`
      : dEmpty('check', 'Tudo feito por aqui. 🎉', '', dBtn('Criar tarefa', 'data-action="open-form" data-key="tasks"')),
    { link: dLink('tasks', 'Tarefas') }));
  }

  if (W.events && M('calendar')) {
    const ev = items('events').filter((e) => e.date >= T && e.date <= addDays(7)).sort(COLLECTIONS.events.sort).slice(0, 4);
    hoje.push(dCard('calendar', 'Agenda', ev.length ? `
      <div class="elist">${ev.map((e) => `
        <button class="erow" data-action="open-form" data-key="events" data-id="${e.id}">
          <span class="when"><b>${e.date === T ? 'Hoje' : e.date === addDays(1) ? 'Amanhã' : WEEKDAYS[parseISO(e.date).getDay()]}</b><small>${esc(e.time || 'Dia todo')}</small></span>
          <span class="what"><b>${esc(e.title)}</b>${e.location ? `<small>${esc(e.location)}</small>` : ''}</span></button>`).join('')}</div>`
      : dEmpty('calendar', 'Agenda livre', 'Nada marcado para os próximos 7 dias.', dBtn('Criar evento', 'data-action="open-form" data-key="events"')),
    { link: dLink('calendar', 'Calendário') }));
  }

  if (W.focus) {
    const wf = focusWeek();
    const running = ui.focus && !ui.focus.paused;
    const goal = 240;
    hoje.push(dCard('clock', 'Tempo de foco', `
      <div class="focus-stats">
        <div><small>Esta semana</small><b>${fmtMin(wf.total)}</b><span class="delta ${wf.delta < 0 ? 'down' : ''}">${icon('arrowUpRight')}${Math.abs(wf.delta)}% <em>vs. anterior</em></span></div>
        <div><small>Média diária</small><b>${fmtMin(wf.avg)}</b><span class="delta plain">meta ${goal / 60}h</span></div></div>
      ${focusBars(wf.perDay, wf.days)}
      <div class="focus-timer clock-${state.settings.focusClock || 'digital'}">${focusFace(running)}
        <div class="focus-actions">${running ? '<button class="dbtn ghost" data-action="focus-pause">Pausar</button>' : ui.focus ? '<button class="dbtn" data-action="focus-start">Continuar</button>' : '<button class="dbtn" data-action="focus-pick">Focar 25 min</button>'}${ui.focus ? '<button class="dbtn ghost" data-action="focus-stop">Encerrar</button>' : ''}</div></div>
      ${ui.focus?.item ? `<small class="focus-on">Focando em: <b>${esc(ui.focus.item)}</b></small>` : ''}`));
  }

  if (W.goals && M('goals')) {
    const g = items('goals').slice(0, 4);
    progresso.push(dCard('target', 'Metas', g.length ? `<div class="glist2">${g.map((x) => `
      <button class="grow2" data-action="open-form" data-key="goals" data-id="${x.id}"><span class="gt"><i></i><b>${esc(x.title)}</b><em>${+x.progress || 0}%</em></span>
        <span class="bar"><i style="width:${+x.progress || 0}%"></i></span><small>${x.deadline ? 'até ' + fmtDate(x.deadline) : esc(x.area || '')}</small></button>`).join('')}</div>`
      : dEmpty('target', 'Nenhuma meta ainda', 'Defina algo que você quer conquistar.', dBtn('Criar meta', 'data-action="open-form" data-key="goals"')),
    { link: dLink('goals', 'Metas'), cls: 'wide' }));
  }
  if (W.projects && (M('goals') || M('work'))) progresso.push(projectsCard());

  if (W.finance && M('finance')) {
    const f = financeSummary();
    const pct = f.income ? Math.min(100, Math.round((f.expense / f.income) * 100)) : 0;
    progresso.push(dCard('wallet', 'Finanças do mês', `
      <div class="fin-big ${f.balance < 0 ? 'down' : ''}">${brl(f.balance)}</div><small class="muted">Saldo até agora · ${pct}% da renda gasto</small>
      <div class="fin-bar"><i style="width:${pct}%"></i></div>
      <div class="fin-rows"><span><i class="in"></i>Entrou<b>${brl(f.income)}</b></span><span><i class="out"></i>Saiu<b>${brl(f.expense)}</b></span></div>`,
    { link: dLink('finance', 'Finanças') }));
  }
  if (W.content && M('content')) {
    const posts = items('posts').filter((p) => p.status !== 'Publicado').sort((a, b) => (a.date || '9').localeCompare(b.date || '9')).slice(0, 4);
    progresso.push(dCard('pen', 'Próximos conteúdos', posts.length ? `<div class="elist">${posts.map((p) => `
      <button class="erow" data-action="open-form" data-key="posts" data-id="${p.id}"><span class="what"><b>${esc(p.title)}</b><small>${esc([p.platform, p.status, p.date ? relDate(p.date) : ''].filter(Boolean).join(' · '))}</small></span></button>`).join('')}</div>`
      : dEmpty('pen', 'Nada planejado', 'Anote a próxima ideia de conteúdo.', dBtn('Novo conteúdo', 'data-action="open-form" data-key="posts"')),
    { link: dLink('content', 'Conteúdo') }));
  }
  if (W.studies && M('studies')) {
    const st = items('studies').slice(0, 4);
    progresso.push(dCard('grad', 'Estudos', st.length ? st.map((s) => `
      <div class="srow"><div><b>${esc(s.title)}</b><small>${s.progress || 0}%</small></div><div class="bar"><i style="width:${s.progress || 0}%"></i></div></div>`).join('')
      : dEmpty('grad', 'Nenhum curso ainda', 'Cadastre uma matéria, curso ou idioma.', dBtn('Novo estudo', 'data-action="open-form" data-key="studies"')),
    { link: dLink('studies', 'Educação') }));
  }

  if (W.focusItems) ritmo.push(focusItemsCard());
  if (W.achievements) ritmo.push(achievementsCard());
  if (W.heatmap && M('tasks')) ritmo.push(heatmapCard());
  if (W.rhythm && M('tasks')) ritmo.push(rhythmCard());
  if (W.ai) ritmo.push(dataCard());

  const projects = [...items('personalProjects'), ...items('workProjects')].map((p) => p.title).filter(Boolean);
  const classic = state.settings.dashStyle === 'none';
  const openT = items('tasks').filter((t) => !t.done && t.due === T).length;
  const evT = items('events').filter((e) => e.date === T).length;
  const sub = `${openT} ${openT === 1 ? 'tarefa' : 'tarefas'} para hoje · ${evT} ${evT === 1 ? 'evento' : 'eventos'} na agenda`;
  const section = (label, cards, first = false) => cards.length ? `
      <div class="dash-head"><span>${label}</span>${first && !classic ? `<button class="dash-custom" data-action="customize-dash">${icon('grid')}Personalizar</button>` : ''}</div>
      <div class="dgrid">${cards.join('')}</div>` : '';
  const grid = section('Hoje', hoje, true) + section('Progresso', progresso) + section('Ritmo', ritmo)
    || dEmpty('grid', 'Seu Início está vazio', 'Escolha os cartões que quer ver.', dBtn('Personalizar', 'data-action="customize-dash"'));

  if (classic) {
    return `
    <div class="classic">
      <header class="classic-head">
        <div><small>${esc(dateStr)}</small><h1>${greeting()}${name ? ', ' + esc(name) : ''}.</h1><p>${sub}</p></div>
        <div class="classic-actions">
          <button class="cbtn ghost" data-action="customize-dash">${icon('grid')}Personalizar</button>
          <button class="cbtn outline" data-action="${ui.focus ? 'focus-scroll' : 'focus-pick'}">${icon('clock')}${ui.focus ? 'Foco em andamento' : 'Iniciar foco'}</button>
          <button class="cbtn primary" data-action="capture-open">${icon('plus')}Capturar</button>
        </div>
      </header>
      ${grid}
    </div>`;
  }
  return `
    <section class="cover">
      ${coverArt()}
      <div class="cover-text"><h1>${greeting()}${name ? ', ' + esc(name) : ''}. O que vem agora?</h1><p>${esc(dateStr)}</p></div>
      <button class="cover-btn" data-action="cover">${icon('image')}Trocar capa</button>
    </section>
    ${captureBox(projects)}
    <div class="dash-wrap">${grid}</div>`;
}

function captureBox(projects, inModal = false) {
  const note = ui.capMode === 'note';
  return `<div class="capture ${inModal ? 'in-modal' : ''}">
      <div class="cap-tabs" role="tablist">
        <button class="cap-tab ${note ? '' : 'on'}" role="tab" aria-selected="${!note}" data-action="cap-mode" data-m="task">${icon('checkSquare')}Tarefa</button>
        <button class="cap-tab ${note ? 'on' : ''}" role="tab" aria-selected="${note}" data-action="cap-mode" data-m="note">${icon('edit')}Nota</button>
      </div>
      <textarea id="cap-text" rows="2" data-input="cap-type" placeholder="${note ? 'Anote uma ideia, um link ou um lembrete…' : 'O que precisa ser feito?'}">${esc(ui.capText || '')}</textarea>
      <div class="cap-foot">
        ${note ? '' : `<label class="cap-proj">${icon('folder')}<select id="cap-proj" data-change="cap-proj" aria-label="Projeto"><option value="">Sem projeto</option>${projects.map((p) => `<option ${ui.capProj === p ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select>${icon('chevD')}</label>`}
        <span class="cap-hint">${note ? 'Use #tag para organizar' : 'Use #tag, !alta e hoje / amanhã'}</span>
        <button class="cap-send" data-action="cap-send" aria-label="Salvar" ${ui.capText?.trim() ? '' : 'disabled'}>${icon('arrowUp')}</button>
      </div>
    </div>`;
}
const captureProjects = () => [...items('personalProjects'), ...items('workProjects')].map((p) => p.title).filter(Boolean);
function openCaptureModal() {
  openOverlay(`<div class="modal cap-modal"><div class="modal-head"><h3>Capturar</h3><button class="icon-btn" data-action="close-overlay" aria-label="Fechar">${icon('x')}</button></div>
    <div class="cap-modal-body">${captureBox(captureProjects(), true)}</div></div>`, (bd) => bd.querySelector('#cap-text')?.focus());
}
export { openCaptureModal };
on('capture-open', openCaptureModal);
on('focus-scroll', () => document.querySelector('.focus-timer')?.scrollIntoView({ block: 'center', behavior: 'smooth' }));

on('cover', openCoverPicker);
on('show-done-habits', () => { ui.showDoneHabits = true; bus.render(); });
on('hide-done-habits', () => { ui.showDoneHabits = false; bus.render(); });

// Captura rápida
on('cap-mode', (ds) => { ui.capMode = ds.m; if (document.querySelector('.cap-modal')) openCaptureModal(); else { bus.render(); document.getElementById('cap-text')?.focus(); } });
on('cap-type', (ds, el) => {
  ui.capText = el.value;
  const b = document.querySelector('.cap-send');
  if (b) b.disabled = !el.value.trim();
});
on('cap-proj', (ds, el) => { ui.capProj = el.value; });
export function captureSubmit() {
  let text = (ui.capText || '').trim();
  if (!text) return;
  const tags = [...text.matchAll(/(^|\s)#([\p{L}\d_-]+)/gu)].map((m) => m[2]);
  text = text.replace(/(^|\s)#[\p{L}\d_-]+/gu, ' ');
  if (ui.capMode === 'note') {
    upsert('ideas', { title: text.replace(/\s+/g, ' ').trim() || tags.join(' '), tags: tags.join(', ') });
    toast('Nota salva em Ideias');
  } else {
    const task = { done: false, priority: 'Média' };
    const pr = text.match(/(^|\s)!(alta|m[eé]dia|baixa)(?=\s|$)/iu);
    if (pr) { task.priority = { alta: 'Alta', baixa: 'Baixa' }[pr[2].toLowerCase()] || 'Média'; text = text.replace(pr[0], ' '); }
    const day = text.match(/(^|\s)(hoje|amanh[ãa])(?=\s|$)/iu);
    if (day) { task.due = /hoje/i.test(day[2]) ? today() : addDays(1); text = text.replace(day[0], ' '); }
    task.title = text.replace(/\s+/g, ' ').trim();
    if (!task.title) { toast('Escreva o que precisa ser feito.'); return; }
    if (tags.length) task.tags = tags.join(', ');
    if (ui.capProj) task.project = ui.capProj;
    ui.capText = '';
    const inModal = !!document.querySelector('.cap-modal');
    upsert('tasks', task);
    if (inModal) closeOverlay();
    toast(`Tarefa criada${task.due ? (task.due === today() ? ' para hoje' : ' para amanhã') : ''}`);
    document.getElementById('cap-text')?.focus();
    return;
  }
  ui.capText = '';
  if (document.querySelector('.cap-modal')) closeOverlay();
  bus.render();
  document.getElementById('cap-text')?.focus();
}
on('cap-send', captureSubmit);
document.addEventListener('keydown', (e) => {
  if (e.target.id === 'cap-text' && e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); captureSubmit(); }
});

// Humor e energia
const todayMood = () => items('moods').find((m) => m.date === today());
on('log-mood', (ds) => {
  upsert('moods', { ...(todayMood() || {}), date: today(), score: +ds.score });
  toast('Humor registrado');
});
on('log-energy', (ds) => {
  upsert('moods', { score: 3, ...(todayMood() || {}), date: today(), energy: +ds.n });
});
on('mood-note', (ds, el) => {
  upsert('moods', { score: 3, ...(todayMood() || {}), date: today(), note: el.value.trim() });
  toast('Anotado');
});

on('toggle-habit', (ds) => {
  const h = find('habits', ds.id);
  if (!h) return;
  h.log ||= {};
  if (h.log[ds.date]) delete h.log[ds.date]; else h.log[ds.date] = true;
  save();
});

// Tempo de foco (sessões de 25 minutos)
let focusTick = null;
function tickFocus() {
  const left = focusLeft();
  const el = document.getElementById('focus-time');
  if (el) el.textContent = fmtClock(left);
  const prog = 1 - left / FOCUS_SECONDS;
  document.getElementById('focus-ring')?.setAttribute('stroke-dashoffset', String(RING_C * (1 - prog)));
  document.getElementById('focus-line')?.style.setProperty('width', `${prog * 100}%`);
  if (ui.focus && !ui.focus.paused && left <= 0) finishFocus(true);
}
function finishFocus(completed) {
  const spent = completed ? FOCUS_SECONDS : FOCUS_SECONDS - focusLeft();
  clearInterval(focusTick); focusTick = null;
  ui.focusItem = ui.focus?.item || null;
  ui.focus = null;
  const min = Math.round(spent / 60);
  toast(completed ? `Sessão de foco concluída: ${min} min 🎯` : min > 0 ? `${min} min de foco registrados` : 'Sessão encerrada');
  const item = ui.focusItem;
  ui.focusItem = null;
  if (min > 0) upsert('focus', { date: today(), minutes: min, ...(item ? { item } : {}) });
  else bus.render();
}
// Escolher no que focar: tarefa, hábito, projeto ou foco livre.
on('focus-pick', () => {
  if (ui.focus) return;
  const opts = [
    ['Tarefas', items('tasks').filter((t) => !t.done).sort(COLLECTIONS.tasks.sort).slice(0, 12).map((t) => t.title)],
    ['Hábitos', habitList().map((h) => h.name)],
    ['Projetos', [...items('personalProjects'), ...items('workProjects')].filter((p) => !['Concluído', 'Entregue'].includes(p.status)).map((p) => p.title)],
  ].filter(([, l]) => l.length);
  openOverlay(`<div class="modal"><div class="modal-head"><h3>Iniciar foco</h3><button class="icon-btn" data-action="close-overlay" aria-label="Fechar">${icon('x')}</button></div>
    <form class="focus-form" data-submit="focus-go">
      <label class="field"><span>No que você vai focar?</span><select class="input" name="what"><option value="">Foco livre</option>${opts.map(([g, l]) => `<optgroup label="${g}">${l.map((x) => `<option>${esc(x)}</option>`).join('')}</optgroup>`).join('')}</select></label>
      <p class="muted">Uma sessão de 25 minutos. O tempo entra em “Tempo de foco” e em “Foco por item”.</p>
      <div class="modal-foot"><button type="button" class="btn ghost" data-action="close-overlay">Cancelar</button><button class="btn primary">${icon('clock')}Começar</button></div>
    </form></div>`);
});
on('focus-go', (ds, form) => {
  const item = form.elements.what.value;
  closeOverlay();
  ui.focus = { end: Date.now() + FOCUS_SECONDS * 1000, paused: false, item: item || null };
  clearInterval(focusTick); focusTick = setInterval(tickFocus, 1000);
  if (ui.route !== 'dashboard') go('dashboard'); else bus.render();
  setTimeout(() => document.querySelector('.focus-timer')?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 80);
});
on('focus-start', () => {
  const f = ui.focus;
  if (f && f.paused) { f.end = Date.now() + f.left * 1000; f.paused = false; }
  else ui.focus = { end: Date.now() + FOCUS_SECONDS * 1000, paused: false };
  clearInterval(focusTick); focusTick = setInterval(tickFocus, 1000);
  bus.render();
});
on('focus-pause', () => {
  const f = ui.focus; if (!f) return;
  f.left = focusLeft(); f.paused = true;
  clearInterval(focusTick); focusTick = null;
  bus.render();
});
on('focus-stop', () => { if (ui.focus) finishFocus(false); });

on('customize-dash', () => {
  const W = state.settings.widgets;
  const labels = { mood: 'Como foi hoje?', habits: 'Hábitos de hoje', tasks: 'Tarefas', events: 'Agenda', focus: 'Tempo de foco', goals: 'Metas', projects: 'Projetos em andamento', finance: 'Finanças do mês', content: 'Próximos conteúdos', studies: 'Estudos', focusItems: 'Foco por item', achievements: 'Metas e conquistas', heatmap: 'Tarefas concluídas', rhythm: 'Ritmo da semana', ai: 'O que seus dados mostram' };
  openOverlay(`<div class="modal"><div class="modal-head"><h3>Personalizar Início</h3><button class="icon-btn" data-action="close-overlay">${icon('x')}</button></div>
    <div style="padding:0 20px;max-height:60vh;overflow:auto">${Object.entries(labels).map(([k, l]) => `<div class="setting"><div class="txt"><b>${l}</b></div><label class="switch"><input type="checkbox" data-change="toggle-widget" data-w="${k}" ${W[k] ? 'checked' : ''}><span></span></label></div>`).join('')}</div>
    <div class="modal-foot"><button class="btn primary" data-action="close-overlay">Pronto</button></div></div>`);
});
on('toggle-widget', (ds, el) => { state.settings.widgets[ds.w] = el.checked; save(); });


// ---------- Hábitos ----------
const HDAYS = 28;
const deDate = (d) => { const x = parseISO(d); return `${x.getDate()} de ${monthShort(x.getMonth())}.`; };
function habitsPage() {
  const hs = habitList();
  const T = today();
  const days = [];
  for (let k = -(HDAYS - 1); k <= 0; k++) days.push(addDays(k));
  const dueToday = hs.filter((h) => habitDue(h, T));
  let due = 0, done = 0;
  days.forEach((d) => hs.forEach((h) => { if (habitDue(h, d)) { due++; if (h.log?.[d]) done++; } }));
  const rate = due ? Math.round((done / due) * 100) : 0;
  const best = hs.reduce((m, h) => (habitStreak(h) > (m ? habitStreak(m) : 0) ? h : m), null);
  const bestN = best ? habitStreak(best) : 0;
  const stat = (label, value, ico, sub = '') => `<div class="hb-stat"><div class="hb-stat-top"><span>${label}</span>${icon(ico)}</div><b>${value}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</div>`;
  const cells = (h) => days.map((d) => `<button class="hb-cell ${h.log?.[d] ? 'on' : ''} ${d === T ? 'today' : ''} ${habitDue(h, d) ? '' : 'off'}" data-action="toggle-habit" data-id="${h.id}" data-date="${d}" title="${fmtDate(d)}" aria-label="${fmtDate(d)}"></button>`).join('');
  const row = ({ h, depth }) => {
    const color = esc(h.color || 'var(--accent)');
    const grip = `<span class="hb-grip" title="Arraste para reordenar">${icon('grip')}</span>`;
    if (h.group) {
      const kids = groupChildren(h);
      const kd = kids.filter((c) => habitDue(c, T));
      const n = kd.filter((c) => c.log?.[T]).length;
      return `<div class="hb-row group" draggable="true" data-hid="${h.id}" style="--hc:${color}">${grip}
        <span class="hb-emoji">${esc(h.emoji || '📁')}</span>
        <div class="hb-info" data-action="open-form" data-key="habits" data-id="${h.id}"><div class="hb-name">${esc(h.name)}</div><small>Grupo · ${kids.length} ${kids.length === 1 ? 'hábito' : 'hábitos'}</small></div>
        <span class="hb-gcount ${kd.length && n === kd.length ? 'full' : ''}">${n}/${kd.length} hoje</span></div>`;
    }
    const c = challengeInfo(h);
    let meta;
    if (c) {
      const cd = Object.keys(h.log || {}).filter((d) => d >= h.start && d <= c.end).length;
      const pct = Math.round((cd / c.total) * 100);
      meta = `<div class="hb-prog"><span class="hb-bar"><i style="width:${pct}%"></i></span><small>${cd}/${c.total} dias (${pct}%) · ${c.over ? 'encerrado' : 'até ' + deDate(c.end)}</small></div>`;
    } else meta = `<small>${freqLabel(h)}${h.minutes ? ` · ${h.minutes} min` : ''}</small>`;
    const badge = c ? `<span class="hb-badge">${icon('trophy')}Desafio ${c.total}d</span>` : '';
    const st = habitStreak(h);
    const on = !!h.log?.[T];
    return `<div class="hb-row ${depth ? 'child' : ''}" draggable="true" data-hid="${h.id}" style="--hc:${color}">${grip}
      <button class="hb-check ${on ? 'on' : ''} ${habitDue(h, T) ? '' : 'off'}" data-action="toggle-habit" data-id="${h.id}" data-date="${T}" aria-label="Marcar hoje">${on ? icon('check') : (h.emoji && h.emoji !== '✨' ? `<span>${esc(h.emoji)}</span>` : '')}</button>
      <div class="hb-info" data-action="open-form" data-key="habits" data-id="${h.id}"><div class="hb-title"><span class="hb-name">${esc(h.name)}</span>${badge}</div>${meta}</div>
      <div class="hb-cells">${cells(h)}</div>
      <span class="hb-streak ${st ? 'hot' : ''}">${icon('flame')}${st}</span></div>`;
  };
  return `
    <div class="hb-head">
      <div><div class="hb-h1"><span class="hb-hico">${icon('repeat')}</span><h1>Hábitos</h1></div><p>Consistência > intensidade. Últimos ${HDAYS} dias.</p></div>
      ${addBtn('habits', 'Novo hábito')}
    </div>
    <div class="hb-stats">
      ${stat('Hoje', `${dueToday.filter((h) => h.log?.[T]).length}/${dueToday.length}`, 'check')}
      ${stat(`Taxa em ${HDAYS} dias`, `${rate}%`, 'repeat')}
      ${stat('Maior sequência', `${bestN} ${bestN === 1 ? 'dia' : 'dias'}`, 'trophy', bestN ? best.name : '')}
    </div>
    <div class="hb-list">
      ${habitTree().map(row).join('') || emptyState('repeat', 'Nenhum hábito ainda. Comece com algo pequeno, como beber água.')}
    </div>`;
}

// Arrastar para reordenar hábitos
let habitDrag = null;
document.addEventListener('dragstart', (e) => { const r = e.target.closest?.('.hb-row'); if (!r) return; habitDrag = r.dataset.hid; r.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
document.addEventListener('dragend', (e) => { e.target.closest?.('.hb-row')?.classList.remove('dragging'); habitDrag = null; });
document.addEventListener('dragover', (e) => { if (habitDrag && e.target.closest?.('.hb-row')) e.preventDefault(); });
document.addEventListener('drop', (e) => {
  const r = e.target.closest?.('.hb-row');
  if (!r || !habitDrag) return;
  e.preventDefault();
  const arr = items('habits');
  const from = arr.findIndex((h) => h.id === habitDrag), to = arr.findIndex((h) => h.id === r.dataset.hid);
  habitDrag = null;
  if (from < 0 || to < 0 || from === to) return;
  arr.splice(to, 0, arr.splice(from, 1)[0]);
  save();
});

// ---------- Calendário ----------
function calendarEntries(date) {
  const out = [];
  if (moduleOn('calendar') || moduleOn('tasks')) items('events').filter((e) => e.date === date).forEach((e) => out.push({ cls: '', text: (e.time ? e.time + ' ' : '') + e.title, key: 'events', id: e.id, time: e.time || '' }));
  if (moduleOn('tasks')) items('tasks').filter((t) => t.due === date).forEach((t) => out.push({ cls: 'task', text: (t.done ? '✓ ' : '') + t.title, key: 'tasks', id: t.id, time: t.time || '99' }));
  if (moduleOn('finance')) items('bills').filter((b) => b.due === date && !b.paid).forEach((b) => out.push({ cls: 'bill', text: `${b.title} · ${brl(b.amount)}`, key: 'bills', id: b.id, time: '98' }));
  if (moduleOn('finance')) items('subscriptions').filter((s) => s.next === date).forEach((s) => out.push({ cls: 'bill', text: `${s.name} · ${brl(s.amount)}`, key: 'subscriptions', id: s.id, time: '98' }));
  if (moduleOn('content')) items('posts').filter((p) => p.date === date).forEach((p) => out.push({ cls: 'post', text: `${p.platform || ''}: ${p.title}`, key: 'posts', id: p.id, time: '97' }));
  if (moduleOn('travel')) items('trips').filter((t) => t.start && t.start <= date && (t.end || t.start) >= date).forEach((t) => out.push({ cls: 'trip', text: '✈ ' + t.destination, key: 'trips', id: t.id, time: '00' }));
  if (moduleOn('studies')) items('studies').filter((s) => s.deadline === date).forEach((s) => out.push({ cls: 'task', text: '🎓 ' + s.title, key: 'studies', id: s.id, time: '96' }));
  return out.sort((a, b) => a.time.localeCompare(b.time));
}

function calendarPage() {
  const T = today();
  const cursor = ui.calCursor ? parseISO(ui.calCursor) : new Date();
  const y = cursor.getFullYear(), m = cursor.getMonth();
  const first = new Date(y, m, 1);
  const ws = state.settings.weekStart === 1 ? 1 : 0;
  const start = new Date(y, m, 1 - ((first.getDay() - ws + 7) % 7));
  const sel = ui.calSelected || T;
  let cells = '';
  for (let i = 0; i < 42; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const ds = iso(d);
    const ents = calendarEntries(ds);
    cells += `<button class="cal-day ${d.getMonth() !== m ? 'out' : ''} ${ds === T ? 'today' : ''} ${ds === sel ? 'sel' : ''}" data-action="cal-select" data-date="${ds}">
      <span class="n">${d.getDate()}</span>${ents.slice(0, 3).map((e) => `<span class="cal-ev ${e.cls}">${esc(e.text)}</span>`).join('')}${ents.length > 3 ? `<span class="cal-more">+${ents.length - 3}</span>` : ''}</button>`;
  }
  const dayEnts = calendarEntries(sel);
  const selD = parseISO(sel);
  return head('Calendário', 'Compromissos, tarefas, contas, conteúdos e viagens em uma só agenda.', `
      <button class="btn" data-action="cal-today">Hoje</button>
      <button class="icon-btn" data-action="cal-move" data-d="-1" aria-label="Mês anterior">${icon('chevL')}</button>
      <button class="icon-btn" data-action="cal-move" data-d="1" aria-label="Próximo mês">${icon('chevR')}</button>
      <button class="btn primary" data-action="open-form" data-key="events" data-def-date="${sel}">${icon('plus')}Compromisso</button>`) + `
    <div class="cal">
      <div><h2 style="margin:0 0 12px;font-size:20px;letter-spacing:-.02em">${MONTHS_FULL[m]} <span class="muted" style="font-weight:400">${y}</span></h2>
        <div class="cal-grid">${[...WEEKDAYS.slice(ws), ...WEEKDAYS.slice(0, ws)].map((w) => `<div class="cal-dow">${w}</div>`).join('')}${cells}</div>
        <div class="legend" style="flex-wrap:wrap"><span><i style="background:var(--accent)"></i>Compromissos</span><span><i style="background:var(--surface-3)"></i>Tarefas</span><span><i style="background:var(--danger)"></i>Contas</span><span><i style="background:var(--purple)"></i>Conteúdo</span><span><i style="background:var(--success)"></i>Viagens</span></div>
      </div>
      <div class="card">
        <div class="card-head"><h3>${cap(selD.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }))}</h3></div>
        ${dayEnts.length ? `<div class="list">${dayEnts.map((e) => `<div class="item" data-action="open-form" data-key="${e.key}" data-id="${e.id}" style="cursor:pointer"><span class="cal-ev ${e.cls}" style="width:6px;height:28px;padding:0;flex:none"></span><div class="item-main"><div class="item-title">${esc(e.text)}</div><div class="item-sub">${esc(COLLECTIONS[e.key].label)}</div></div></div>`).join('')}</div>` : emptyState('calendar', 'Nada neste dia.')}
        <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
          <button class="btn sm" data-action="open-form" data-key="events" data-def-date="${sel}">${icon('plus')}Compromisso</button>
          <button class="btn sm" data-action="open-form" data-key="tasks" data-def-due="${sel}">${icon('plus')}Tarefa</button>
        </div>
      </div>
    </div>`;
}
on('cal-select', (ds) => { ui.calSelected = ds.date; bus.render(); });
on('cal-today', () => { ui.calCursor = null; ui.calSelected = today(); bus.render(); });
on('cal-move', (ds) => {
  const c = ui.calCursor ? parseISO(ui.calCursor) : new Date();
  c.setDate(1); c.setMonth(c.getMonth() + +ds.d);
  ui.calCursor = iso(c);
  bus.render();
});

// ---------- Finanças ----------
function financePage() {
  const f = financeSummary();
  const prev = financeSummary(-1);
  const budgets = state.settings.budgets || {};
  const inv = items('investments');
  const invTotal = inv.reduce((a, i) => a + +i.amount, 0);
  const subs = items('subscriptions');
  const subsTotal = subs.reduce((a, s) => a + (s.cycle === 'Anual' ? s.amount / 12 : +s.amount), 0);
  const debt = items('bills').filter((b) => b.type === 'Dívida').reduce((a, b) => a + (+b.remaining || 0), 0);
  const cats = Object.entries(f.byCat).sort((a, b) => b[1] - a[1]);
  const months = [];
  for (let k = -5; k <= 0; k++) {
    const s = financeSummary(k);
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + k);
    months.push({ label: monthShort(d.getMonth()), values: [s.income, s.expense] });
  }
  const delta = prev.expense ? ((f.expense - prev.expense) / prev.expense) * 100 : 0;
  const budgetRows = Object.keys({ ...budgets, ...f.byCat }).map((c) => [c, f.byCat[c] || 0, budgets[c] || 0]).sort((a, b) => b[1] - a[1]);
  const month = MONTHS_FULL[new Date().getMonth()];

  return head('Finanças', `Visão de ${month}: gastos, orçamento, contas, investimentos e assinaturas.`, `
      <button class="btn" data-action="edit-budget">${icon('target')}Orçamento</button>
      <button class="btn primary" data-action="open-form" data-key="transactions">${icon('plus')}Lançamento</button>`) + `
    <div class="grid cols-4" style="margin-bottom:16px">
      <div class="card"><div class="stat"><span class="label">Saldo do mês</span><span class="value ${f.balance < 0 ? 'down' : ''}">${brl(f.balance)}</span><span class="delta muted">${f.income ? Math.round((f.balance / f.income) * 100) + '% da renda poupada' : '—'}</span></div></div>
      <div class="card"><div class="stat"><span class="label">${icon('arrowUp')}Receitas</span><span class="value up">${brl(f.income)}</span></div></div>
      <div class="card"><div class="stat"><span class="label">${icon('arrowDown')}Despesas</span><span class="value">${brl(f.expense)}</span><span class="delta ${delta > 0 ? 'down' : 'up'}">${prev.expense ? (delta > 0 ? '+' : '') + delta.toFixed(0) + '% vs. mês anterior' : ''}</span></div></div>
      <div class="card"><div class="stat"><span class="label">${icon('chart')}Patrimônio investido</span><span class="value">${brl(invTotal)}</span><span class="delta muted">${debt ? 'Dívidas: ' + brl(debt) : 'Sem dívidas'}</span></div></div>
    </div>
    <div class="dash" style="margin-bottom:16px">
      <div class="card span-7">${cardHead('chart', 'Receitas x despesas (6 meses)')}${groupedBars(months, ['var(--accent)', 'var(--surface-3)'], { fmt: brlShort, height: 200 })}
        <div class="legend"><span><i style="background:var(--accent)"></i>Receitas</span><span><i style="background:var(--surface-3)"></i>Despesas</span></div></div>
      <div class="card span-5">${cardHead('wallet', 'Para onde foi o dinheiro')}
        ${cats.length ? `<div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap">${donut(cats.map(([c, v], i) => ({ label: `${c}: ${brl(v)}`, value: v, color: PALETTE[i % PALETTE.length] })))}
        <div style="flex:1;min-width:140px;display:flex;flex-direction:column;gap:6px">${cats.slice(0, 6).map(([c, v], i) => `<div style="display:flex;align-items:center;gap:8px;font-size:13px"><i style="width:8px;height:8px;border-radius:2px;background:${PALETTE[i % PALETTE.length]}"></i><span style="flex:1">${esc(c)}</span><span class="muted">${Math.round((v / f.expense) * 100)}%</span></div>`).join('')}</div></div>` : emptyState('wallet', 'Sem despesas neste mês.')}</div>
      <div class="card span-7">${cardHead('target', 'Orçamento mensal', `<button class="more" data-action="edit-budget">Editar${icon('chevR')}</button>`)}
        ${budgetRows.map(([c, spent, lim]) => {
          const pct = lim ? Math.min(100, (spent / lim) * 100) : 0;
          return `<div class="catbar"><span>${esc(c)}</span><div class="bar ${pct >= 100 ? 'red' : pct >= 85 ? 'yellow' : ''}"><i style="width:${lim ? pct : 0}%"></i></div><span class="val">${brl(spent)}${lim ? ` <span class="muted">/ ${brl(lim)}</span>` : ''}</span></div>`;
        }).join('')}</div>
      <div class="card span-5">${cardHead('refresh', 'Assinaturas', `<span class="more">${brl(subsTotal)}/mês</span>`)}
        <div class="list">${subs.map((s) => itemRow('subscriptions', s, { compact: true })).join('') || emptyState('refresh', 'Nenhuma assinatura.')}</div>
        <div class="muted" style="font-size:12.5px;margin-top:8px">${brl(subsTotal * 12)} por ano em assinaturas.</div></div>
    </div>
    ${tabbed('finance', ['transactions', 'bills', 'investments', 'subscriptions'])}`;
}

on('edit-budget', () => {
  const b = state.settings.budgets || {};
  openOverlay(`<form class="modal" data-submit="save-budget"><div class="modal-head"><h3>Orçamento mensal por categoria</h3><button type="button" class="icon-btn" data-action="close-overlay">${icon('x')}</button></div>
    <div class="modal-body">${EXPENSE_CATS.map((c) => `<label class="field"><span>${c}</span><input type="number" step="10" min="0" name="${c}" value="${b[c] || ''}" placeholder="Sem limite"></label>`).join('')}</div>
    <div class="modal-foot"><button type="button" class="btn" data-action="close-overlay">Cancelar</button><button class="btn primary">Salvar orçamento</button></div></form>`);
});
on('save-budget', (ds, form) => {
  const out = {};
  EXPENSE_CATS.forEach((c) => { const v = parseFloat(form.elements[c].value); if (v > 0) out[c] = v; });
  state.settings.budgets = out;
  save();
  closeOverlay();
  toast('Orçamento atualizado');
});

// ---------- Saúde ----------
function healthPage() {
  const T = today();
  const mood = items('moods').find((m) => m.date === T);
  const sleep = items('sleep').filter((s) => s.date >= addDays(-13)).sort((a, b) => a.date.localeCompare(b.date));
  const sleepAvg = avg(sleep.slice(-7).map((s) => +s.hours));
  const wk = items('workouts').filter((w) => w.date >= addDays(-6));
  const kcal = items('meals').filter((m) => m.date === T).reduce((a, m) => a + (+m.kcal || 0), 0);
  const moods = [];
  const ml = [];
  for (let k = -13; k <= 0; k++) {
    const d = addDays(k);
    const m = items('moods').find((x) => x.date === d);
    if (m) { moods.push(+m.score); ml.push(k % 2 === 0 ? String(parseISO(d).getDate()) : ''); }
  }
  return head('Saúde e bem-estar', 'Humor, sono, exercícios, alimentação e diário pessoal.', `
      <button class="btn" data-action="open-form" data-key="sleep">${icon('moon')}Sono</button>
      <button class="btn" data-action="open-form" data-key="workouts">${icon('dumbbell')}Treino</button>
      <button class="btn primary" data-action="open-form" data-key="journal">${icon('pen')}Escrever no diário</button>`) + `
    <div class="grid cols-4" style="margin-bottom:16px">
      <div class="card"><div class="stat"><span class="label">Humor hoje</span><span class="value">${mood ? MOODS[mood.score - 1] + ' ' + MOOD_LABEL[mood.score - 1] : '—'}</span></div></div>
      <div class="card"><div class="stat"><span class="label">Sono médio (7 dias)</span><span class="value ${sleepAvg && sleepAvg < 7 ? 'down' : ''}">${sleepAvg ? sleepAvg.toFixed(1) + ' h' : '—'}</span></div></div>
      <div class="card"><div class="stat"><span class="label">Treinos na semana</span><span class="value">${wk.length}</span><span class="delta muted">${wk.reduce((a, w) => a + (+w.duration || 0), 0)} min no total</span></div></div>
      <div class="card"><div class="stat"><span class="label">Calorias hoje</span><span class="value">${kcal || '—'}</span><span class="delta muted">${kcal ? 'kcal registradas' : 'registre suas refeições'}</span></div></div>
    </div>
    <div class="dash" style="margin-bottom:16px">
      <div class="card span-6">${cardHead('smile', 'Acompanhamento de humor')}
        <div class="mood-picker">${MOODS.map((e, i) => `<button class="mood-btn ${mood?.score === i + 1 ? 'on' : ''}" data-action="log-mood" data-score="${i + 1}" title="${MOOD_LABEL[i]}">${e}</button>`).join('')}</div>
        <div style="margin-top:14px">${moods.length > 1 ? areaLine(moods, { height: 110, min: 1, max: 5, labels: ml, color: 'var(--purple)' }) : emptyState('smile', 'Registre seu humor por alguns dias para ver a evolução.')}</div></div>
      <div class="card span-6">${cardHead('moon', 'Sono (14 dias)')}
        ${sleep.length > 1 ? areaLine(sleep.map((s) => +s.hours), { height: 150, min: 4, max: 10, labels: sleep.map((s, i) => (i % 2 ? '' : String(parseISO(s.date).getDate()))), color: 'var(--accent-2)' }) : emptyState('moon', 'Sem registros de sono.')}</div>
    </div>
    ${tabbed('health', ['journal', 'workouts', 'meals', 'sleep'])}`;
}

// ---------- Conteúdo ----------
function contentPage() {
  const posts = items('posts');
  const pub = posts.filter((p) => p.status === 'Publicado');
  const views = pub.reduce((a, p) => a + (+p.views || 0), 0);
  const likes = pub.reduce((a, p) => a + (+p.likes || 0), 0);
  const byPlat = {};
  pub.forEach((p) => { byPlat[p.platform || 'Outro'] = (byPlat[p.platform || 'Outro'] || 0) + (+p.views || 0); });
  const nf = (n) => n.toLocaleString('pt-BR');
  return head('Criatividade e conteúdo', 'Ideias, referências, planejamento editorial, roteiros e métricas.', addBtn('posts', 'Novo conteúdo')) + `
    <div class="grid cols-4" style="margin-bottom:16px">
      <div class="card"><div class="stat"><span class="label">No pipeline</span><span class="value">${posts.length - pub.length}</span></div></div>
      <div class="card"><div class="stat"><span class="label">Publicados</span><span class="value">${pub.length}</span></div></div>
      <div class="card"><div class="stat"><span class="label">Visualizações</span><span class="value">${nf(views)}</span></div></div>
      <div class="card"><div class="stat"><span class="label">Engajamento</span><span class="value">${views ? ((likes / views) * 100).toFixed(1) + '%' : '—'}</span><span class="delta muted">${nf(likes)} curtidas</span></div></div>
    </div>
    ${Object.keys(byPlat).length ? `<div class="card" style="margin-bottom:16px">${cardHead('chart', 'Visualizações por plataforma')}
      ${Object.entries(byPlat).sort((a, b) => b[1] - a[1]).map(([p, v]) => `<div class="catbar"><span>${esc(p)}</span><div class="bar"><i style="width:${(v / views) * 100}%"></i></div><span class="val">${nf(v)}</span></div>`).join('')}</div>` : ''}
    ${tabbed('content', ['posts', 'ideas'])}`;
}

// ---------- ORBITA AI ----------
const md = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');

function aiPage() {
  const msgs = state.ai || [];
  const sugg = ['Como está meu dia?', 'Como estão minhas finanças?', 'Relatório da semana', 'Organize minhas tarefas atrasadas', 'Me dê sugestões', 'Gastei 45 no ifood', 'Adicionar tarefa ligar para o dentista amanhã às 9h'];
  return head('ORBITA AI', 'Seu assistente pessoal: cria, registra, organiza e analisa tudo o que está no ORBITA.', `<button class="btn" data-action="ai-clear">${icon('refresh')}Nova conversa</button>`) + `
    <div class="ai-wrap">
      <div class="chat">
        <div class="chat-log" id="chat-log">
          ${msgs.length ? '' : `<div style="margin:auto;text-align:center;max-width:420px"><div class="ai-orb" style="width:72px;height:72px;margin:0 auto 18px"></div>
            <h2 style="margin:0 0 6px;letter-spacing:-.02em">Como posso ajudar?</h2><p class="muted" style="margin:0">Peça em linguagem natural. Eu conecto suas tarefas, agenda, finanças, saúde e estudos.</p></div>`}
          ${msgs.map((m) => `<div class="msg ${m.role}">${md(m.text)}</div>`).join('')}
          ${ui.aiTyping ? '<div class="msg bot muted">Pensando…</div>' : ''}
        </div>
        <div class="suggestions">${sugg.map((s) => `<button class="suggestion" data-action="ai-ask" data-q="${esc(s)}">${esc(s)}</button>`).join('')}</div>
        <form class="chat-input" data-submit="ai-send"><input name="q" placeholder="Pergunte ou peça algo ao ORBITA AI…" autocomplete="off" id="ai-input"><button class="btn primary" aria-label="Enviar">${icon('send')}</button></form>
      </div>
      <div style="display:flex;flex-direction:column;gap:16px;min-height:0;overflow-y:auto">
        <div class="card">${cardHead('spark', 'Insights agora')}${insights().slice(0, 6).map((i) => `<div class="insight ${i.kind}"><span class="dot"></span><span>${esc(i.text)}</span></div>`).join('')}</div>
        <div class="card">${cardHead('wand', 'Automação')}
          <div style="display:flex;flex-direction:column;gap:8px">
            <button class="btn" data-action="ai-ask" data-q="Organize minhas tarefas atrasadas">${icon('wand')}Organizar tarefas atrasadas</button>
            <button class="btn" data-action="ai-ask" data-q="Relatório da semana">${icon('chart')}Gerar relatório semanal</button>
            <button class="btn" data-action="ai-ask" data-q="Como está minha saúde?">${icon('heart')}Analisar saúde</button>
          </div>
          <p class="muted" style="font-size:12px;margin:12px 0 0">A IA roda localmente no seu dispositivo, sem enviar seus dados para fora.</p></div>
      </div>
    </div>`;
}

function askAI(q) {
  if (!q.trim()) return;
  state.ai ||= [];
  state.ai.push({ role: 'user', text: q });
  ui.aiTyping = true;
  save();
  setTimeout(() => {
    ui.aiTyping = false;
    let text;
    try { text = reply(q); } catch (e) { text = 'Desculpe, não consegui processar isso agora.'; console.error(e); }
    state.ai.push({ role: 'bot', text });
    state.ai = state.ai.slice(-60);
    save();
  }, 450);
}
export { askAI };
on('ai-send', (ds, form) => { const q = form.elements.q.value; form.reset(); askAI(q); });
on('ai-ask', (ds) => { if (ui.route !== 'ai') go('ai'); askAI(ds.q); });
on('ai-clear', () => { state.ai = []; save(); });

// ---------- Integrações ----------
const INTEGRATIONS = [
  { id: 'gcal', name: 'Google Agenda', logo: '📅', desc: 'Sincronize compromissos nos dois sentidos.' },
  { id: 'gdrive', name: 'Google Drive', logo: '🗂️', desc: 'Backup automático e anexos em documentos.' },
  { id: 'github', name: 'GitHub', logo: '🐙', desc: 'Veja seus repositórios e acompanhe a evolução em programação.' },
  { id: 'applehealth', name: 'Apple Saúde', logo: '❤️', desc: 'Importe passos, sono e treinos do iPhone e Apple Watch.' },
  { id: 'healthconnect', name: 'Health Connect', logo: '💚', desc: 'Dados de saúde de dispositivos Android.' },
  { id: 'openfinance', name: 'Open Finance', logo: '🏦', desc: 'Importe transações dos seus bancos automaticamente.' },
  { id: 'notion', name: 'Notion', logo: '📝', desc: 'Traga páginas e bancos de dados.' },
  { id: 'spotify', name: 'Spotify', logo: '🎧', desc: 'Playlists de foco para suas sessões de estudo.' },
];

export function integrationsBody() {
  const st = state.integrations || {};
  const gh = st.github;
  return `
    <div class="grid cols-2">${INTEGRATIONS.map((it) => {
      const on = !!st[it.id];
      let extra = '';
      if (it.id === 'github') {
        extra = `<form data-submit="gh-connect" style="display:flex;gap:8px"><input class="input" name="user" placeholder="Seu usuário do GitHub" value="${esc(gh?.user || '')}" style="height:36px"><button class="btn sm primary" style="height:36px">${gh ? 'Atualizar' : 'Conectar'}</button></form>
          ${gh?.repos?.length ? `<div>${gh.repos.slice(0, 5).map((r) => `<div class="repo">${icon('code')}<a href="${esc(r.url)}" target="_blank" rel="noopener" style="flex:1">${esc(r.name)}</a><span class="muted">${esc(r.lang || '')}</span><span class="muted">★ ${r.stars}</span></div>`).join('')}</div>` : ''}
          ${gh?.error ? `<span class="chip red">${esc(gh.error)}</span>` : ''}`;
      }
      return `<div class="card integ"><div class="top"><div class="logo">${it.logo}</div><div style="flex:1"><b>${esc(it.name)}</b><div>${on ? '<span class="chip green">Conectado</span>' : '<span class="chip">Desconectado</span>'}</div></div>
        ${it.id === 'github' ? (gh ? `<button class="btn sm" data-action="integ-off" data-id="github">Desconectar</button>` : '') : `<button class="btn sm ${on ? '' : 'primary'}" data-action="integ-toggle" data-id="${it.id}">${on ? 'Desconectar' : 'Conectar'}</button>`}</div>
        <p>${esc(it.desc)}</p>${extra}</div>`;
    }).join('')}</div>
    <p class="muted" style="font-size:12.5px;margin-top:16px">O GitHub usa a API pública (apenas repositórios públicos). As demais integrações exigem login OAuth com o provedor e ficam ativas quando o backend de sincronização estiver configurado — por enquanto, conectar apenas registra sua preferência.</p>`;
}
on('integ-toggle', (ds) => {
  state.integrations ||= {};
  state.integrations[ds.id] = !state.integrations[ds.id];
  save();
  toast(state.integrations[ds.id] ? 'Integração marcada como conectada' : 'Integração desconectada');
});
on('integ-off', (ds) => { delete state.integrations[ds.id]; save(); });
on('gh-connect', async (ds, form) => {
  const user = form.elements.user.value.trim();
  if (!/^[a-z\d](?:[a-z\d-]{0,38})$/i.test(user)) { toast('Usuário inválido'); return; }
  state.integrations ||= {};
  try {
    const res = await fetch(`https://api.github.com/users/${encodeURIComponent(user)}/repos?sort=updated&per_page=10`);
    if (!res.ok) throw new Error(res.status === 404 ? 'Usuário não encontrado' : 'Falha ao consultar o GitHub');
    const data = await res.json();
    state.integrations.github = { user, repos: data.map((r) => ({ name: r.name, url: r.html_url, stars: r.stargazers_count, lang: r.language })) };
    toast(`GitHub conectado: ${data.length} repositórios`);
  } catch (e) {
    state.integrations.github = { user, repos: [], error: e.message };
  }
  save();
});

on('toggle-module', (ds) => { state.settings.modules[ds.m] = state.settings.modules[ds.m] === false; save(); });
