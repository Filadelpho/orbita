// Janela "Novo compromisso": formulário à esquerda, calendário no meio e horários livres à direita.
import { state, items, upsert, today, iso, parseISO, uid } from './store.js';
import { escapeHtml as esc, MONTHS_FULL } from './collections.js';
import { icon } from './icons.js';
import { ui, on, openOverlay, closeOverlay, toast, initials, formHooks } from './ui.js';

const DURATIONS = [[15, '15 min'], [30, '30 min'], [45, '45 min'], [60, '1 hora'], [90, '1h30'], [120, '2 horas']];
const REPEATS = [['none', 'Não repete'], ['daily', 'Todo dia'], ['weekly', 'Toda semana'], ['monthly', 'Todo mês']];
const FORMATS = [
  ['none', 'Sem local', null], ['meet', 'Google Meet', 'video'], ['link', 'Outro link', 'link'], ['place', 'Presencial', 'pin'], ['phone', 'Telefone', 'call'],
];
const DOW = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const DOW_FULL = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

let ev = null;

const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const toHM = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const fmtDur = (m) => (m < 60 ? `${m} min` : m % 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}` : `${m / 60} ${m === 60 ? 'hora' : 'horas'}`);
const longDate = (d) => { const p = parseISO(d); return `${DOW_FULL[p.getDay()]}, ${p.getDate()} de ${MONTHS_FULL[p.getMonth()]}`; };
const dayEvents = (d) => items('events').filter((e) => e.date === d);
const tzName = () => {
  try { return new Intl.DateTimeFormat('pt-BR', { timeZoneName: 'long' }).formatToParts(new Date()).find((p) => p.type === 'timeZoneName')?.value || ''; } catch { return ''; }
};

function busy(date, start, dur) {
  return dayEvents(date).filter((e) => e.time).some((e) => {
    const s = toMin(e.time), end = s + (+e.duration || 60);
    return start < end && s < start + dur;
  });
}

// ---------- Painéis ----------
function leftPane() {
  const fmt = ev.format;
  const extra = {
    meet: ['url', 'Link do Google Meet (opcional)', `<a class="evm-mini" href="https://meet.google.com/new" target="_blank" rel="noopener">${icon('arrowUpRight')}Criar sala</a>`],
    link: ['url', 'Cole o link da reunião', ''],
    place: ['text', 'Endereço ou nome do lugar', ''],
    phone: ['tel', 'Número para ligar', ''],
  }[fmt];
  return `
    <div class="evm-kind"><span class="evm-ring">${ringSvg()}</span><span>Compromisso</span></div>
    <input id="evm-title" class="evm-input" data-input="evm-title" maxlength="120" placeholder="Título (ex.: Alinhamento de projeto)" value="${esc(ev.title)}" autocomplete="off">
    <label class="evm-label" for="evm-notes">Pauta ou notas rápidas</label>
    <textarea id="evm-notes" class="evm-input evm-notes" data-input="evm-notes" rows="3" placeholder="Ex.: Discutir próximas metas e prazos…">${esc(ev.notes)}</textarea>
    <div class="evm-label">${icon('clock')}Duração do compromisso</div>
    <div class="evm-chips three">${DURATIONS.map(([m, l]) => `<button class="evm-chip ${!ev.customDur && ev.duration === m ? 'on' : ''}" data-action="evm-dur" data-m="${m}">${l}</button>`).join('')}
      <button class="evm-chip full ${ev.customDur ? 'on' : ''}" data-action="evm-dur-custom">${ev.customDur ? `Outra duração: ${fmtDur(ev.duration)}` : 'Outra duração'}</button>
      ${ev.customDur ? `<div class="evm-custom full"><input id="evm-dur" class="evm-input sm" type="number" min="5" max="720" step="5" value="${ev.duration}" data-change="evm-dur-value"><span>minutos</span></div>` : ''}
      <button class="evm-chip full ${ev.multi ? 'on' : ''}" data-action="evm-multi">${ev.multi ? `Vários dias${ev.endDate ? `: até ${parseISO(ev.endDate).getDate()}/${parseISO(ev.endDate).getMonth() + 1}` : ' (escolha o último dia)'}` : 'Vários dias'}</button>
    </div>
    <div class="evm-label">Repetir</div>
    <div class="evm-chips wrap">${REPEATS.map(([k, l]) => `<button class="evm-chip ${ev.repeat === k ? 'on' : ''}" data-action="evm-repeat" data-k="${k}" ${ev.multi && k !== 'none' ? 'disabled' : ''}>${l}</button>`).join('')}</div>
    <div class="evm-label">Formato do encontro</div>
    <div class="evm-chips wrap">${FORMATS.map(([k, l, ico]) => `<button class="evm-chip fmt ${fmt === k ? 'on' : ''}" data-action="evm-format" data-k="${k}">${ico ? icon(ico) : ringSvg(14)}${l}</button>`).join('')}</div>
    ${extra ? `<div class="evm-extra"><input id="evm-where" class="evm-input" type="${extra[0]}" data-input="evm-where" placeholder="${extra[1]}" value="${esc(ev.where)}">${extra[2]}</div>` : ''}`;
}

function calendarPane() {
  const c = parseISO(ev.cursor);
  const y = c.getFullYear(), m = c.getMonth();
  const ws = state.settings.weekStart === 1 ? 1 : 0;
  const first = new Date(y, m, 1);
  const start = new Date(y, m, 1 - ((first.getDay() - ws + 7) % 7));
  const T = today();
  const heads = [...DOW.slice(ws), ...DOW.slice(0, ws)];
  let cells = '';
  const lead = (first.getDay() - ws + 7) % 7;
  const total = Math.ceil((lead + new Date(y, m + 1, 0).getDate()) / 7) * 7;
  for (let i = 0; i < total; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const s = iso(d);
    const out = d.getMonth() !== m;
    const past = s < T;
    const inRange = ev.multi && ev.endDate && s > ev.date && s <= ev.endDate;
    const has = dayEvents(s).length;
    cells += `<button class="evm-day ${out ? 'out' : ''} ${s === ev.date ? 'sel' : ''} ${inRange ? 'range' : ''} ${s === T ? 'today' : ''}" data-action="evm-day" data-d="${s}" ${past ? 'disabled' : ''} aria-label="${longDate(s)}">${d.getDate()}${has ? '<i></i>' : ''}</button>`;
  }
  const n = dayEvents(ev.date).length;
  return `
    <div class="evm-cal-head"><b>${MONTHS_FULL[m]} de ${y}</b>
      <button class="evm-link" data-action="evm-today">Hoje</button>
      <button class="icon-btn sm" data-action="evm-month" data-d="-1" aria-label="Mês anterior" ${y === new Date().getFullYear() && m <= new Date().getMonth() ? 'disabled' : ''}>${icon('chevL')}</button>
      <button class="icon-btn sm" data-action="evm-month" data-d="1" aria-label="Próximo mês">${icon('chevR')}</button></div>
    <div class="evm-grid">${heads.map((h) => `<span class="evm-dow">${h}</span>`).join('')}${cells}</div>
    <div class="evm-cal-foot"><span>${longDate(ev.date)}</span><span>${n ? `${n} ${n === 1 ? 'compromisso' : 'compromissos'}` : 'Dia livre'}</span></div>`;
}

function slotsPane() {
  const T = today();
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const n = dayEvents(ev.date).length;
  const slots = [];
  for (let t = 6 * 60; t <= 23 * 60 + 30; t += 30) slots.push(t);
  const list = slots.map((t) => {
    const hm = toHM(t);
    const past = ev.date === T && t <= nowMin;
    const isBusy = busy(ev.date, t, ev.duration);
    return `<button class="evm-slot ${ev.time === hm ? 'on' : ''} ${isBusy ? 'busy' : ''}" data-action="evm-slot" data-t="${hm}" ${past ? 'disabled' : ''} ${isBusy ? 'title="Já tem compromisso nesse horário"' : ''}>${hm}${isBusy ? '<small>Ocupado</small>' : ''}${ev.time === hm ? `<small>até ${toHM(t + ev.duration)}</small>` : ''}</button>`;
  }).join('');
  const custom = ev.time && !slots.map(toHM).includes(ev.time);
  return `
    <div class="evm-day-title">${longDate(ev.date)}</div>
    <div class="evm-day-sub">${n} ${n === 1 ? 'compromisso' : 'compromissos'} · ${fmtDur(ev.duration)}</div>
    <div class="evm-slots-head"><span>Horários disponíveis</span><button class="evm-link" data-action="evm-other">${ev.otherTime ? 'Ver lista' : 'Outro horário'}</button></div>
    ${ev.otherTime || custom ? `<div class="evm-other"><input id="evm-time" class="evm-input" type="time" value="${esc(ev.time || '')}" data-change="evm-time" aria-label="Horário"></div>` : ''}
    <div class="evm-slots" id="evm-slots">${list}</div>
    <div class="evm-confirm">
      <button class="evm-allday ${ev.time ? '' : 'on'}" data-action="evm-allday">${ev.time ? 'Sem horário (dia todo)' : 'Dia todo selecionado'}</button>
      <button class="evm-submit" data-action="evm-save" ${ev.title.trim() ? '' : 'disabled'}>Confirmar compromisso</button>
    </div>`;
}

const ringSvg = (s = 22) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="2.6 2.6"/></svg>`;

function shell() {
  const name = state.user?.name || 'Você';
  return `<div class="modal evm" role="dialog" aria-label="Novo compromisso">
    <div class="evm-head"><div><h3>Novo compromisso</h3><p>Escolha o dia e a hora e confirme. O compromisso vai direto para o calendário.</p></div>
      <button class="icon-btn" data-action="close-overlay" aria-label="Fechar">${icon('x')}</button></div>
    <div class="evm-cols">
      <div class="evm-left"><div class="evm-scroll" id="evm-left">${leftPane()}</div>
        <div class="evm-owner"><span class="avatar sm">${esc(initials(name))}</span><div><b>${esc(ev.title.trim() || 'Sem título ainda')}</b><small>Sua agenda ORBITA${tzName() ? ' · ' + esc(tzName()) : ''}</small></div></div></div>
      <div class="evm-mid" id="evm-mid">${calendarPane()}</div>
      <div class="evm-right" id="evm-right">${slotsPane()}</div>
    </div></div>`;
}

// Redesenha mantendo foco, cursor e rolagem.
function render() {
  const modal = document.querySelector('.evm');
  if (!modal) return;
  const left = document.getElementById('evm-left')?.scrollTop || 0;
  const slots = document.getElementById('evm-slots')?.scrollTop || 0;
  const a = document.activeElement;
  const fid = a?.id, sel = a && 'selectionStart' in a ? [a.selectionStart, a.selectionEnd] : null;
  modal.outerHTML = shell();
  document.getElementById('evm-left').scrollTop = left;
  const sl = document.getElementById('evm-slots');
  if (sl) sl.scrollTop = slots;
  if (fid) { const el = document.getElementById(fid); el?.focus(); if (sel && el?.setSelectionRange) try { el.setSelectionRange(...sel); } catch { /* tipo sem cursor */ } }
}

export function openEventModal(defaults = {}) {
  const date = defaults.date && defaults.date >= today() ? defaults.date : today();
  ev = { title: defaults.title || '', notes: '', duration: 30, customDur: false, multi: false, endDate: null, repeat: 'none', format: 'none', where: '', date, cursor: date.slice(0, 8) + '01', time: defaults.time || null, otherTime: false };
  openOverlay(shell(), (bd) => {
    bd.classList.add('evm-backdrop');
    bd.querySelector('#evm-title')?.focus();
    // Começa a lista perto do horário atual.
    const first = bd.querySelector('.evm-slot:not([disabled])');
    if (first) bd.querySelector('#evm-slots').scrollTop = first.offsetTop - bd.querySelector('#evm-slots').offsetTop - 4;
  });
}
formHooks.events = (defaults, id) => (id ? false : openEventModal(defaults));

// ---------- Ações ----------
on('evm-title', (ds, el) => {
  ev.title = el.value;
  const b = document.querySelector('.evm-submit'); if (b) b.disabled = !el.value.trim();
  const o = document.querySelector('.evm-owner b'); if (o) o.textContent = el.value.trim() || 'Sem título ainda';
});
on('evm-notes', (ds, el) => { ev.notes = el.value; });
on('evm-where', (ds, el) => { ev.where = el.value; });
on('evm-dur', (ds) => { ev.duration = +ds.m; ev.customDur = false; render(); });
on('evm-dur-custom', () => { ev.customDur = true; render(); document.getElementById('evm-dur')?.focus(); });
on('evm-dur-value', (ds, el) => { ev.duration = Math.min(720, Math.max(5, Math.round(+el.value / 5) * 5 || 30)); render(); });
on('evm-multi', () => { ev.multi = !ev.multi; ev.endDate = null; if (ev.multi) ev.repeat = 'none'; render(); });
on('evm-repeat', (ds) => { ev.repeat = ds.k; render(); });
on('evm-format', (ds) => { ev.format = ds.k; ev.where = ''; render(); document.getElementById('evm-where')?.focus(); });
on('evm-day', (ds) => {
  if (ev.multi && ds.d > ev.date && !ev.endDate) ev.endDate = ds.d;
  else { ev.date = ds.d; ev.endDate = null; }
  ev.cursor = ds.d.slice(0, 8) + '01';
  if (ev.time && busy(ev.date, toMin(ev.time), ev.duration)) ev.time = null;
  render();
});
on('evm-month', (ds) => { const c = parseISO(ev.cursor); c.setMonth(c.getMonth() + +ds.d); ev.cursor = iso(c).slice(0, 8) + '01'; render(); });
on('evm-today', () => { ev.date = today(); ev.cursor = ev.date.slice(0, 8) + '01'; ev.endDate = null; render(); });
on('evm-slot', (ds) => { ev.time = ev.time === ds.t ? null : ds.t; render(); });
on('evm-other', () => { ev.otherTime = !ev.otherTime; render(); document.getElementById('evm-time')?.focus(); });
on('evm-time', (ds, el) => { ev.time = el.value || null; render(); });
on('evm-allday', () => { ev.time = null; render(); });

on('evm-save', () => {
  const title = ev.title.trim();
  if (!title) { document.getElementById('evm-title')?.focus(); return toast('Dê um título ao compromisso.'); }
  const where = ev.where.trim();
  const location = ev.format === 'meet' ? (where || 'Google Meet') : ev.format === 'none' ? '' : where || { link: 'Online', place: 'Presencial', phone: 'Telefone' }[ev.format];
  const base = {
    title, notes: ev.notes.trim(), location, format: ev.format, duration: ev.duration,
    ...(ev.time ? { time: ev.time, end: toHM(toMin(ev.time) + ev.duration) } : {}),
    ...(ev.format !== 'none' && /^https?:\/\//i.test(where) ? { url: where } : {}),
  };
  // Datas: um dia, vários dias seguidos ou repetições (gera as próximas ocorrências).
  const dates = [ev.date];
  const add = (d, k, unit) => { const p = parseISO(d); if (unit === 'm') p.setMonth(p.getMonth() + k); else p.setDate(p.getDate() + k); return iso(p); };
  if (ev.multi && ev.endDate) { let d = ev.date; while (d < ev.endDate && dates.length < 31) { d = add(d, 1); dates.push(d); } }
  else if (ev.repeat === 'daily') for (let k = 1; k < 30; k++) dates.push(add(ev.date, k));
  else if (ev.repeat === 'weekly') for (let k = 1; k < 12; k++) dates.push(add(ev.date, 7 * k));
  else if (ev.repeat === 'monthly') for (let k = 1; k < 6; k++) dates.push(add(ev.date, k, 'm'));
  const series = dates.length > 1 ? uid() : null;
  const repeat = ev.multi ? 'multi' : ev.repeat;
  dates.forEach((date) => upsert('events', { ...base, date, ...(series ? { series, repeat } : {}) }));
  closeOverlay();
  const when = `${longDate(ev.date).toLowerCase()}${ev.time ? ' às ' + ev.time : ''}`;
  toast(dates.length > 1 ? `${dates.length} compromissos criados a partir de ${when}` : `Compromisso marcado: ${when}`);
  ev = null;
});
