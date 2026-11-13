// Calendário: visões Mês, Semana, Dia e Agenda, com tarefas, compromissos e feriados nacionais.
import { state, items, save, today, addDays, parseISO, iso } from './store.js';
import { escapeHtml as esc, MONTHS_FULL, brl } from './collections.js';
import { icon } from './icons.js';
import { ui, on, bus, openForm } from './ui.js';

const HOUR = 52; // altura de uma hora na grade (px)
const DOW = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const DOW_FULL = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const C = () => (state.settings.cal ||= { view: 'week', hideTasks: false, holidays: true });
const cursor = () => ui.calCursor || today();
const toMin = (t) => { const [h, m] = (t || '0:0').split(':').map(Number); return h * 60 + (m || 0); };
const longDay = (d) => { const p = parseISO(d); return `${DOW_FULL[p.getDay()]}, ${p.getDate()} de ${MONTHS_FULL[p.getMonth()].toLowerCase()}`; };
const shift = (d, n, unit = 'd') => { const p = parseISO(d); if (unit === 'm') { p.setDate(1); p.setMonth(p.getMonth() + n); } else p.setDate(p.getDate() + n); return iso(p); };
const monday = (d) => { const p = parseISO(d); p.setDate(p.getDate() - ((p.getDay() + 6) % 7)); return iso(p); };

// ---------- Feriados nacionais do Brasil ----------
function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  return new Date(y, Math.floor((h + l - 7 * m + 114) / 31) - 1, ((h + l - 7 * m + 114) % 31) + 1);
}
const holidayCache = {};
function holidays(y) {
  if (holidayCache[y]) return holidayCache[y];
  const e = easter(y);
  const rel = (n) => { const d = new Date(e); d.setDate(d.getDate() + n); return iso(d); };
  const list = {
    [`${y}-01-01`]: 'Confraternização Universal', [rel(-47)]: 'Carnaval', [rel(-2)]: 'Sexta-feira Santa', [`${y}-04-21`]: 'Tiradentes',
    [`${y}-05-01`]: 'Dia do Trabalho', [rel(60)]: 'Corpus Christi', [`${y}-09-07`]: 'Independência do Brasil', [`${y}-10-12`]: 'Nossa Senhora Aparecida',
    [`${y}-11-02`]: 'Finados', [`${y}-11-15`]: 'Proclamação da República', [`${y}-11-20`]: 'Dia da Consciência Negra', [`${y}-12-25`]: 'Natal',
  };
  return (holidayCache[y] = list);
}
const holidayOn = (d) => (C().holidays ? holidays(+d.slice(0, 4))[d] : null);

// ---------- O que acontece em cada dia ----------
function dayData(d) {
  const c = C();
  const events = items('events').filter((e) => e.date === d).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  const tasks = c.hideTasks ? [] : items('tasks').filter((t) => t.due === d).sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));
  const extra = [];
  const mod = (m) => state.settings.modules?.[m] !== false;
  if (mod('finance')) items('bills').filter((b) => b.due === d && !b.paid).forEach((b) => extra.push({ cls: 'bill', text: `${b.title} · ${brl(b.amount)}`, key: 'bills', id: b.id }));
  if (mod('content')) items('posts').filter((p) => p.date === d).forEach((p) => extra.push({ cls: 'post', text: `${p.platform ? p.platform + ': ' : ''}${p.title}`, key: 'posts', id: p.id }));
  if (mod('travel')) items('trips').filter((t) => t.start && t.start <= d && (t.end || t.start) >= d).forEach((t) => extra.push({ cls: 'trip', text: `✈ ${t.destination}`, key: 'trips', id: t.id }));
  if (mod('studies')) items('studies').filter((s) => s.deadline === d).forEach((s) => extra.push({ cls: 'study', text: `🎓 ${s.title}`, key: 'studies', id: s.id }));
  return { events, tasks, extra, holiday: holidayOn(d) };
}

const taskChip = (t, cls = '') => `<div class="ag-task ${t.done ? 'done' : ''} ${cls}">
  <button class="ag-check ${t.done ? 'on' : ''}" data-action="toggle-done" data-key="tasks" data-id="${t.id}" aria-label="${t.done ? 'Reabrir' : 'Concluir'} ${esc(t.title)}">${icon('check')}</button>
  <button class="ag-task-t" data-action="open-form" data-key="tasks" data-id="${t.id}">${t.time ? `<small>${esc(t.time)}</small>` : ''}<span>${esc(t.title)}</span></button></div>`;
const eventChip = (e) => `<button class="ag-ev" data-action="open-form" data-key="events" data-id="${e.id}">${e.time ? `<small>${esc(e.time)}</small>` : ''}<span>${esc(e.title)}</span></button>`;
const holidayChip = (h) => `<span class="ag-hol" title="Feriado nacional">${esc(h)}</span>`;
const extraChip = (x) => `<button class="ag-x ${x.cls}" data-action="open-form" data-key="${x.key}" data-id="${x.id}">${esc(x.text)}</button>`;

// ---------- Mês ----------
function monthView() {
  const T = today();
  const cur = parseISO(cursor());
  const y = cur.getFullYear(), m = cur.getMonth();
  const start = monday(iso(new Date(y, m, 1)));
  const sel = ui.calSelected || T;
  let cells = '';
  for (let i = 0; i < 42; i++) {
    const d = shift(start, i);
    const p = parseISO(d);
    const { events, tasks, extra, holiday } = dayData(d);
    const chips = [...(holiday ? [holidayChip(holiday)] : []), ...events.map(eventChip), ...tasks.map((t) => taskChip(t, 'mini')), ...extra.map(extraChip)];
    cells += `<div class="ag-cell ${p.getMonth() !== m ? 'out' : ''} ${d === T ? 'today' : ''} ${d === sel ? 'sel' : ''}" data-action="ag-select" data-date="${d}" data-dbl="${d}">
      <span class="ag-n">${p.getDate()}</span>${chips.slice(0, 3).join('')}${chips.length > 3 ? `<span class="ag-more">+${chips.length - 3}</span>` : ''}</div>`;
  }
  const sd = dayData(sel);
  const doneN = sd.tasks.filter((t) => t.done).length;
  return `<div class="ag-month">
    <div class="ag-mgrid">${['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((w) => `<div class="ag-dow">${w}</div>`).join('')}${cells}</div>
    <aside class="ag-side">
      <div class="ag-side-head"><b>${longDay(sel)}</b><button class="ag-link" data-action="ag-new" data-date="${sel}">${icon('plus')}Evento</button></div>
      ${sd.holiday ? `<div class="ag-side-sec">${holidayChip(sd.holiday)}</div>` : ''}
      ${sd.events.length ? `<div class="ag-side-sec"><h4>Compromissos <small>${sd.events.length}</small></h4>${sd.events.map((e) => `<button class="ag-side-ev" data-action="open-form" data-key="events" data-id="${e.id}"><span class="bar"></span><span><b>${esc(e.title)}</b><small>${e.time ? `${esc(e.time)}${e.end ? ' – ' + esc(e.end) : ''}` : 'Dia inteiro'}${e.location ? ' · ' + esc(e.location) : ''}</small></span></button>`).join('')}</div>` : ''}
      ${C().hideTasks ? '' : `<div class="ag-side-sec"><h4>Tarefas do dia <small>${doneN}/${sd.tasks.length}</small></h4>${sd.tasks.map((t) => taskChip(t)).join('') || '<p class="ag-none">Nenhuma tarefa para este dia.</p>'}
        <button class="ag-link" data-action="open-form" data-key="tasks" data-def-due="${sel}">${icon('plus')}Tarefa</button></div>`}
      ${sd.extra.length ? `<div class="ag-side-sec"><h4>Também neste dia</h4>${sd.extra.map(extraChip).join('')}</div>` : ''}
    </aside>
  </div>`;
}

// ---------- Semana e Dia (grade de horários) ----------
function lanes(list) {
  // Distribui compromissos que se sobrepõem em colunas lado a lado.
  const out = [];
  let group = [], end = -1;
  const flush = () => { const n = Math.max(...group.map((g) => g.lane)) + 1; group.forEach((g) => { g.cols = n; out.push(g); }); group = []; };
  list.map((e) => ({ e, s: toMin(e.time), f: toMin(e.time) + (+e.duration || (e.end ? toMin(e.end) - toMin(e.time) : 60)) }))
    .sort((a, b) => a.s - b.s)
    .forEach((it) => {
      if (group.length && it.s >= end) { flush(); end = -1; }
      const used = new Set(group.filter((g) => g.f > it.s).map((g) => g.lane));
      let lane = 0; while (used.has(lane)) lane++;
      it.lane = lane; group.push(it); end = Math.max(end, it.f);
    });
  if (group.length) flush();
  return out;
}

function gridView(days) {
  const T = today();
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const data = days.map(dayData);
  const allDay = data.some((d) => d.holiday || d.events.some((e) => !e.time) || d.tasks.some((t) => !t.time) || d.extra.length);
  const hours = [...Array(24).keys()];
  return `<div class="ag-week ${days.length === 1 ? 'one' : ''}" style="--cols:${days.length}">
    <div class="ag-whead"><span></span>${days.map((d) => { const p = parseISO(d); return `<button class="ag-wday ${d === T ? 'today' : ''}" data-action="ag-goday" data-date="${d}"><small>${DOW[p.getDay()]}</small><b>${p.getDate()}</b></button>`; }).join('')}</div>
    ${allDay ? `<div class="ag-allday"><span>dia todo</span>${data.map((x, i) => `<div data-date="${days[i]}">${x.holiday ? holidayChip(x.holiday) : ''}${x.events.filter((e) => !e.time).map(eventChip).join('')}${x.tasks.filter((t) => !t.time).map((t) => taskChip(t, 'mini')).join('')}${x.extra.map(extraChip).join('')}</div>`).join('')}</div>` : ''}
    <div class="ag-scroll" id="ag-scroll">
      <div class="ag-body" style="height:${24 * HOUR}px">
        <div class="ag-hours">${hours.map((h) => `<span style="top:${h * HOUR}px">${String(h).padStart(2, '0')}h</span>`).join('')}</div>
        ${days.map((d, i) => `<div class="ag-daycol ${d === T ? 'today' : ''}">
          ${hours.map((h) => `<button class="ag-slot" style="top:${h * HOUR}px" data-action="ag-slot" data-date="${d}" data-time="${String(h).padStart(2, '0')}:00" aria-label="Novo evento ${longDay(d)} às ${h}h"></button>`).join('')}
          ${lanes(data[i].events.filter((e) => e.time)).map((it) => `<button class="ag-block" data-action="open-form" data-key="events" data-id="${it.e.id}" style="top:${(it.s / 60) * HOUR}px;height:${Math.max(22, ((it.f - it.s) / 60) * HOUR - 2)}px;left:calc(${(it.lane / it.cols) * 100}% + 2px);width:calc(${100 / it.cols}% - 4px)"><b>${esc(it.e.title)}</b><small>${esc(it.e.time)}${it.e.end ? ' – ' + esc(it.e.end) : ''}${it.e.location ? ' · ' + esc(it.e.location) : ''}</small></button>`).join('')}
          ${data[i].tasks.filter((t) => t.time).map((t) => `<div class="ag-tblock" style="top:${(toMin(t.time) / 60) * HOUR}px">${taskChip(t)}</div>`).join('')}
          ${d === T ? `<div class="ag-now" style="top:${(nowMin / 60) * HOUR}px"></div>` : ''}
        </div>`).join('')}
      </div>
    </div>
  </div>`;
}

// ---------- Agenda (lista dos próximos dias) ----------
function agendaView() {
  const T = today();
  const startD = cursor() < T && parseISO(cursor()).getMonth() === parseISO(T).getMonth() ? T : cursor();
  const out = [];
  for (let i = 0; i < 45; i++) {
    const d = shift(startD, i);
    const x = dayData(d);
    if (!x.holiday && !x.events.length && !x.tasks.length && !x.extra.length) continue;
    const p = parseISO(d);
    const label = `${d === T ? 'Hoje · ' : d === addDays(1) ? 'Amanhã · ' : ''}${DOW[p.getDay()]}, ${p.getDate()} de ${MONTHS_FULL[p.getMonth()].slice(0, 3).toLowerCase()}`;
    out.push(`<section class="ag-aday"><h4>${label}</h4>
      ${x.tasks.map((t) => taskChip(t)).join('')}
      ${x.holiday ? `<div class="ag-aitem hol"><span class="t">00:00</span><span class="bar"></span><span><b>${esc(x.holiday)}</b><small>Feriado nacional · dia inteiro</small></span></div>` : ''}
      ${x.events.map((e) => `<button class="ag-aitem" data-action="open-form" data-key="events" data-id="${e.id}"><span class="t">${esc(e.time || 'Dia')}</span><span class="bar"></span><span><b>${esc(e.title)}</b><small>${e.time ? `${esc(e.time)}${e.end ? ' – ' + esc(e.end) : ''}` : 'Dia inteiro'}${e.location ? ' · ' + esc(e.location) : ''}</small></span></button>`).join('')}
      ${x.extra.map(extraChip).join('')}
    </section>`);
  }
  return `<div class="ag-agenda">${out.join('') || `<div class="ag-empty">${icon('calendar')}<b>Nada nos próximos 45 dias</b><p>Crie um evento ou uma tarefa com data para ver aqui.</p></div>`}</div>`;
}

export function calendarPage() {
  const c = C();
  const v = c.view || 'week';
  const cur = cursor();
  const p = parseISO(cur);
  const title = v === 'day' ? longDay(cur).replace(/^./, (ch) => ch.toUpperCase()) : `${MONTHS_FULL[p.getMonth()]} de ${p.getFullYear()}`;
  let body;
  if (v === 'month') body = monthView();
  else if (v === 'day') body = gridView([cur]);
  else if (v === 'agenda') body = agendaView();
  else { const s = monday(cur); body = gridView([...Array(7).keys()].map((i) => shift(s, i))); }
  return `<div class="ag-page">
    <div class="ag-head">
      <div><div class="ag-h1"><span class="ag-hico">${icon('calendar')}</span><h1>Calendário</h1></div><p>Eventos conectados a tarefas e projetos.</p></div>
      <div class="ag-head-actions">
        <button class="ag-tbtn ${c.hideTasks ? 'on' : ''}" data-action="ag-hide-tasks" aria-pressed="${!!c.hideTasks}">${icon('checkSquare')}${c.hideTasks ? 'Mostrar tarefas' : 'Ocultar tarefas'}</button>
        <button class="ag-tbtn ${c.holidays ? '' : 'off'}" data-action="ag-holidays" aria-pressed="${!!c.holidays}">${icon('spark')}Feriados</button>
        <button class="btn primary" data-action="ag-new" data-date="${ui.calSelected || today()}">${icon('plus')}Novo evento</button>
      </div>
    </div>
    <div class="ag-bar">
      <h2>${esc(title)}</h2>
      <div class="ag-nav">
        <button class="icon-btn" data-action="ag-move" data-n="-1" aria-label="Anterior">${icon('chevL')}</button>
        <button class="ag-today" data-action="ag-today">Hoje</button>
        <button class="icon-btn" data-action="ag-move" data-n="1" aria-label="Próximo">${icon('chevR')}</button>
      </div>
      <div class="ag-views" role="radiogroup" aria-label="Visualização">
        ${[['month', 'Mês', 'calendar'], ['week', 'Semana', 'grid'], ['day', 'Dia', 'checkSquare'], ['agenda', 'Agenda', 'menu']].map(([k, l, ic]) => `<button role="radio" aria-checked="${v === k}" class="${v === k ? 'on' : ''}" data-action="ag-view" data-v="${k}">${icon(ic)}${l}</button>`).join('')}
      </div>
    </div>
    ${body}
  </div>`;
}

// Rola a grade até perto da hora atual (ou 7h) quando a visão muda.
let lastScrollKey = '';
export function afterCalendarRender() {
  const sc = document.getElementById('ag-scroll');
  if (!sc) { lastScrollKey = ''; return; }
  const key = `${C().view}|${cursor()}`;
  if (key === lastScrollKey) { sc.scrollTop = ui.calScroll ?? sc.scrollTop; return; }
  lastScrollKey = key;
  const h = Math.max(0, Math.min(new Date().getHours() - 2, 7));
  sc.scrollTop = h * HOUR;
}
document.addEventListener('scroll', (e) => { if (e.target.id === 'ag-scroll') ui.calScroll = e.target.scrollTop; }, true);

on('ag-view', (ds) => { C().view = ds.v; save(); });
on('ag-hide-tasks', () => { C().hideTasks = !C().hideTasks; save(); });
on('ag-holidays', () => { C().holidays = !C().holidays; save(); });
on('ag-today', () => { ui.calCursor = null; ui.calSelected = today(); bus.render(); });
on('ag-move', (ds) => {
  const v = C().view;
  const n = +ds.n;
  ui.calCursor = v === 'month' || v === 'agenda' ? shift(cursor(), n, 'm') : shift(cursor(), v === 'day' ? n : 7 * n);
  bus.render();
});
on('ag-select', (ds, el, e) => {
  if (e.target.closest('button')) return; // clicou numa tarefa ou evento dentro do dia
  ui.calSelected = ds.date;
  bus.render();
});
on('ag-goday', (ds) => { ui.calCursor = ds.date; C().view = 'day'; save(); });
on('ag-slot', (ds) => openForm('events', null, { date: ds.date, time: ds.time }));
on('ag-new', (ds) => openForm('events', null, { date: ds.date || today() }));
document.addEventListener('dblclick', (e) => {
  const cell = e.target.closest('.ag-cell');
  if (cell && !e.target.closest('button')) openForm('events', null, { date: cell.dataset.date });
});
