// Saúde: o dia (humor, energia, sono, água, remédios e diário), sono, diário,
// remédios com horários, consultas e exames, e os padrões que ligam tudo.
import { state, items, upsert, remove, find, save, persist, today, addDays, parseISO, uid } from './store.js';
import { escapeHtml as esc, MONTHS_FULL, monthShort, fmtDate } from './collections.js';
import { icon } from './icons.js';
import { on, openOverlay, closeOverlay, toast, confirmDialog, formHooks } from './ui.js';

export const FACES = ['😞', '😕', '😐', '🙂', '😄'];
const FACE_LABEL = ['Mal', 'Pra baixo', 'Ok', 'Bem', 'Ótimo'];
const ENERGY = ['muito baixa', 'baixa', 'média', 'boa', 'alta'];
const QUALITY = ['Péssima', 'Ruim', 'Ok', 'Boa', 'Ótima'];
const TABS = [['hoje', 'Hoje', 'calendar'], ['sono', 'Sono', 'bed'], ['diario', 'Diário', 'pen'], ['remedios', 'Remédios', 'pill'], ['consultas', 'Consultas', 'steth'], ['padroes', 'Padrões', 'spark']];
const WD = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const FOLLOW = [['', 'Sem retorno agendado'], ['15', 'Em 15 dias'], ['30', 'Em 1 mês'], ['90', 'Em 3 meses'], ['180', 'Em 6 meses'], ['365', 'Em 1 ano']];

const H = () => (state.settings.hl ||= { tab: 'hoje', d: 0, glass: 250, waterGoal: 2000 });
const setH = (p) => { Object.assign(H(), p); save(); };
const dayOf = () => addDays(Math.min(0, H().d || 0));
const byDate = (key, d) => items(key).find((x) => x.date === d && (key !== 'journal' || x.daily));
const qIndex = (s) => (s?.q ? s.q - 1 : Math.max(0, QUALITY.indexOf(s?.quality === 'Ok' ? 'Ok' : s?.quality)));
const daysBetween = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 864e5);
const longDate = (d) => { const p = parseISO(d); return `${['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'][p.getDay()]}, ${p.getDate()} de ${MONTHS_FULL[p.getMonth()].toLowerCase()}`; };
const dm = (d) => `${d.slice(8)}/${d.slice(5, 7)}`;
const bars = (n, on) => `<span class="hl-bars">${[1, 2, 3, 4, 5].map((k) => `<i class="${k <= on ? 'on' : ''}" style="height:${4 + k * 3}px"></i>`).join('')}</span>`;
const sleepHours = (bed, wake) => { if (!bed || !wake) return 0; const [a, b] = bed.split(':').map(Number), [c, d] = wake.split(':').map(Number); let m = c * 60 + d - (a * 60 + b); if (m <= 0) m += 1440; return Math.round((m / 60) * 10) / 10; };
const fmtH = (h) => { const m = Math.round(h * 60); return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`; };

// ---------- Remédios ----------
export function medOn(m, d) {
  if (m.start && d < m.start) return false;
  if (m.end && d > m.end) return false;
  const from = m.start || (m.createdAt ? new Date(m.createdAt).toISOString().slice(0, 10) : d);
  const n = daysBetween(from, d);
  if (+m.cycleOn && +m.cycleOff && n >= 0 && n % (+m.cycleOn + +m.cycleOff) >= +m.cycleOn) return false;
  if (m.when === 'weekdays') return (m.days || []).includes(parseISO(d).getDay());
  if (m.when === 'every') return n >= 0 && n % Math.max(1, +m.every || 1) === 0;
  if (m.when === 'asneeded') return false;
  return true;
}
export const dosesOn = (d) => items('meds').filter((m) => medOn(m, d)).flatMap((m) => (m.times?.length ? m.times : ['08:00']).map((t) => ({ m, t, k: `${d} ${t}`, done: !!m.taken?.[`${d} ${t}`] }))).sort((a, b) => a.t.localeCompare(b.t));
function adherence(m, days = 7) {
  let due = 0, ok = 0;
  for (let k = 0; k < days; k++) { const d = addDays(-k); if (!medOn(m, d)) continue; (m.times?.length ? m.times : ['08:00']).forEach((t) => { if (k === 0 && t > nowHM()) return; due++; if (m.taken?.[`${d} ${t}`]) ok++; }); }
  return due ? Math.round((ok / due) * 100) : null;
}
const nowHM = () => { const n = new Date(); return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`; };
const schedText = (m) => {
  if (m.when === 'asneeded') return 'Se precisar';
  const when = m.when === 'weekdays' ? (m.days || []).sort().map((d) => WD[d]).join(', ') || 'Nenhum dia' : m.when === 'every' ? `A cada ${m.every || 1} dias` : 'Todo dia';
  return `${when} · ${(m.times || ['08:00']).join(', ')}${+m.cycleOn && +m.cycleOff ? ` · ${m.cycleOn}/${m.cycleOff} com pausa` : ''}`;
};

// Avisos para o sino do topo.
export function healthNotifs() {
  const T = today(), out = [];
  const late = dosesOn(T).filter((x) => !x.done && x.t <= nowHM());
  late.forEach((x) => out.push({ ico: 'pill', cls: 'yellow', text: `${x.t} · ${x.m.name}${x.m.dose ? ` (${x.m.dose})` : ''}: marcar como tomado`, route: 'health' }));
  items('meds').filter((m) => m.stock !== '' && m.stock != null && +m.stock <= 5 && m.when !== 'asneeded').forEach((m) => out.push({ ico: 'pill', cls: 'red', text: `${m.name}: só ${m.stock} em casa`, route: 'health' }));
  items('appts').forEach((a) => {
    if (a.date === T) out.push({ ico: 'steth', cls: 'blue', text: `Hoje${a.time ? ' às ' + a.time : ''}: ${a.kind} ${a.with}`, route: 'health' });
    else if (a.date === addDays(1)) out.push({ ico: 'steth', cls: 'blue', text: `Amanhã${a.time ? ' às ' + a.time : ''}: ${a.kind} ${a.with}`, route: 'health' });
    if (a.returnDate === T) out.push({ ico: 'steth', cls: 'yellow', text: `Marcar o retorno: ${a.with}`, route: 'health' });
  });
  return out;
}

// ---------- Página ----------
export function healthPage() {
  const h = H();
  const body = { hoje: todayTab, sono: sleepTab, diario: diaryTab, remedios: medsTab, consultas: apptsTab, padroes: patternsTab }[h.tab] || todayTab;
  return `<div class="pj-page hl">
    <div class="tk-head"><div><div class="tk-h1"><span class="tk-hico">${icon('heart')}</span><h1>Saúde</h1></div><p>Sono, água, remédios, consultas e um diário do dia, com os padrões que ligam tudo isso.</p></div></div>
    <div class="hl-tabs" role="tablist">${TABS.map(([id, l, ic]) => `<button role="tab" class="${h.tab === id ? 'on' : ''}" data-action="hl-tab" data-v="${id}">${icon(ic)}${l}</button>`).join('')}</div>
    ${body()}
  </div>`;
}
const card = (ico, title, right, inner, cls = '') => `<section class="hl-card ${cls}"><div class="hl-card-h"><h3>${icon(ico)}${title}</h3>${right || ''}</div>${inner}</section>`;
const empty = (ico, title, text, btn = '') => `<div class="pj-empty"><span class="pj-empty-ico">${icon(ico)}</span><b>${title}</b><p>${text}</p>${btn}</div>`;

// ---------- Hoje ----------
function todayTab() {
  const d = dayOf();
  const h = H();
  const mood = byDate('moods', d) || {};
  const sl = byDate('sleep', d) || {};
  const water = +(byDate('water', d)?.ml || 0);
  const goal = +h.waterGoal || 2000, glass = +h.glass || 250;
  const nGlass = Math.round(water / glass), goalGlasses = Math.ceil(goal / glass);
  const doses = dosesOn(d);
  const asNeeded = items('meds').filter((m) => m.when === 'asneeded' && (!m.end || d <= m.end));
  const diary = byDate('journal', d);
  const hrs = sl.hours || sleepHours(sl.bed, sl.wake);
  const wk = items('workouts').filter((w) => w.date === d), ml = items('meals').filter((m) => m.date === d);
  return `<div class="hl-day"><button class="icon-btn" data-action="hl-day" data-d="-1" aria-label="Dia anterior">${icon('chevL')}</button><b>${d === today() ? 'Hoje' : d === addDays(-1) ? 'Ontem' : longDate(d)}</b><button class="icon-btn" data-action="hl-day" data-d="1" aria-label="Próximo dia" ${d === today() ? 'disabled' : ''}>${icon('chevR')}</button></div>
    ${card('smile', 'Como você está', '', `<span class="hl-label">Humor</span>
      <div class="hl-five">${FACES.map((f, i) => `<button class="${mood.score === i + 1 ? 'on' : ''}" data-action="hl-mood" data-v="${i + 1}" title="${FACE_LABEL[i]}" aria-label="${FACE_LABEL[i]}"><span class="hl-face">${f}</span></button>`).join('')}</div>
      <span class="hl-label">Energia</span>
      <div class="hl-five">${[1, 2, 3, 4, 5].map((k) => `<button class="${+mood.energy === k ? 'on' : ''}" data-action="hl-energy" data-v="${k}" title="Energia ${ENERGY[k - 1]}" aria-label="Energia ${ENERGY[k - 1]}">${bars(5, k)}</button>`).join('')}</div>
      <label class="hl-label" for="hl-grat">Hoje sou grato por</label>
      <input id="hl-grat" class="pjm-input sm" data-input="hl-grat" value="${esc(mood.grateful || '')}" placeholder="Uma coisa boa de hoje, por menor que seja" maxlength="160" autocomplete="off">`)}
    ${card('bed', 'Sono da noite', hrs ? `<span class="hl-pill">${fmtH(hrs)}</span>` : '', `<div class="hl-two">
        <label><span class="hl-label">Fui dormir</span><span class="hl-time">${icon('clock')}<input type="time" data-change="hl-bed" value="${esc(sl.bed || '')}" aria-label="Fui dormir"></span></label>
        <label><span class="hl-label">Acordei</span><span class="hl-time">${icon('clock')}<input type="time" data-change="hl-wake" value="${esc(sl.wake || '')}" aria-label="Acordei"></span></label></div>
      <span class="hl-label">Qualidade</span>
      <div class="hl-five">${[1, 2, 3, 4, 5].map((k) => `<button class="${sl.date && qIndex(sl) + 1 === k && (sl.q || sl.quality) ? 'on' : ''}" data-action="hl-quality" data-v="${k}" title="${QUALITY[k - 1]}" aria-label="Qualidade ${QUALITY[k - 1]}">${bars(5, k)}</button>`).join('')}</div>`)}
    ${card('drop', 'Água', `<button class="hl-link" data-action="hl-water-cfg">copo de ${glass} ml ${icon('gear')}</button>`, `<div class="hl-water">
        <button class="hl-wbtn" data-action="hl-water" data-v="-1" aria-label="Tirar um copo" ${water ? '' : 'disabled'}>−</button>
        <div class="hl-wmid"><b>${(water / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} L <small>/ ${(goal / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} L</small></b>
          <div class="hl-glasses">${Array.from({ length: Math.max(goalGlasses, nGlass) }, (_, i) => `<i class="${i < nGlass ? 'on' : ''}"></i>`).join('')}</div>
          <small>${nGlass} ${nGlass === 1 ? 'copo' : 'copos'} de ${glass} ml${water >= goal ? ' · meta batida 💧' : ''}</small></div>
        <button class="hl-wbtn plus" data-action="hl-water" data-v="1" aria-label="Mais um copo">+</button></div>`)}
    ${card('pill', 'Remédios', items('meds').length ? `<button class="hl-link" data-action="hl-tab" data-v="remedios">Ver todos</button>` : '', doses.length || asNeeded.length ? `<div class="hl-rows">${doses.map((x) => `<button class="hl-dose ${x.done ? 'done' : ''} ${!x.done && d === today() && x.t < nowHM() ? 'late' : ''}" data-action="hl-take" data-id="${x.m.id}" data-k="${x.k}"><span class="hl-tick">${icon('check')}</span><span class="hl-dt">${x.t}</span><span class="hl-desc">${esc(x.m.name)}<small>${esc([x.m.dose, x.m.how && x.m.how !== 'Tanto faz' ? x.m.how.toLowerCase() : ''].filter(Boolean).join(' · '))}</small></span>${!x.done && d === today() && x.t < nowHM() ? '<em>atrasado</em>' : ''}</button>`).join('')}
        ${asNeeded.map((m) => { const n = (m.log?.[d] || []).length; return `<div class="hl-dose"><span class="hl-tick ghost">${icon('pill')}</span><span class="hl-dt">—</span><span class="hl-desc">${esc(m.name)}<small>Se precisar${n ? ` · tomado ${n}x hoje` : ''}</small></span><button class="btn sm" data-action="hl-took" data-id="${m.id}">Tomei agora</button></div>`; }).join('')}</div>`
      : `<p class="hl-muted">Nenhum remédio cadastrado. <button class="hl-link" data-action="hl-med-new">Cadastrar</button> para acompanhar cada dose.</p>`)}
    ${card('dumbbell', 'Movimento e refeições', `<span class="hl-acts"><button class="btn sm" data-action="open-form" data-key="workouts">${icon('plus')}Treino</button><button class="btn sm" data-action="open-form" data-key="meals">${icon('plus')}Refeição</button></span>`, wk.length || ml.length ? `<div class="hl-rows">${wk.map((w) => `<button class="hl-row" data-action="open-form" data-key="workouts" data-id="${w.id}">${icon('dumbbell')}<span class="hl-desc">${esc(w.type)}<small>${w.duration ? `${w.duration} min` : ''}${w.notes ? ` · ${esc(w.notes)}` : ''}</small></span></button>`).join('')}${ml.map((m) => `<button class="hl-row" data-action="open-form" data-key="meals" data-id="${m.id}">${icon('apple')}<span class="hl-desc">${esc(m.meal)}<small>${esc(m.description || '')}${m.kcal ? ` · ${m.kcal} kcal` : ''}</small></span></button>`).join('')}</div>` : '<p class="hl-muted">Nada registrado neste dia.</p>')}
    ${card('pen', 'Diário', '<span class="hl-muted sm">Só você lê. Salva sozinho.</span>', `<textarea class="pjm-input area hl-diary" data-input="hl-diary" rows="5" placeholder="Como foi o dia? O que pesou, o que deu certo, o que quer lembrar.">${esc(diary?.text || '')}</textarea><small class="hl-saved" aria-live="polite"></small>`)}`;
}

// ---------- Sono ----------
function sleepTab() {
  const list = items('sleep').filter((s) => s.hours || s.bed).slice().sort((a, b) => b.date.localeCompare(a.date));
  if (!list.length) return empty('bed', 'Nenhuma noite registrada ainda', 'Na aba Hoje, coloque a hora que foi dormir e que acordou. Com algumas noites, a média e o gráfico aparecem aqui.', '<button class="btn primary" data-action="hl-tab" data-v="hoje">Registrar a noite</button>');
  const hrs = (s) => +s.hours || sleepHours(s.bed, s.wake);
  const last = (n) => list.filter((s) => s.date > addDays(-n));
  const avgOf = (l) => (l.length ? l.reduce((a, s) => a + hrs(s), 0) / l.length : 0);
  const a7 = avgOf(last(7)), a30 = avgOf(last(30));
  const beds = last(30).filter((s) => s.bed).map((s) => { const [h, m] = s.bed.split(':').map(Number); return (h < 12 ? h + 24 : h) * 60 + m; });
  const mean = beds.length ? beds.reduce((a, b) => a + b, 0) / beds.length : 0;
  const sd = beds.length > 1 ? Math.sqrt(beds.reduce((a, b) => a + (b - mean) ** 2, 0) / beds.length) : 0;
  const bedAvg = beds.length ? `${String(Math.floor(mean / 60) % 24).padStart(2, '0')}:${String(Math.round(mean % 60)).padStart(2, '0')}` : '—';
  const q = last(30).filter((s) => s.q || s.quality);
  const qAvg = q.length ? q.reduce((a, s) => a + qIndex(s) + 1, 0) / q.length : 0;
  const days = Array.from({ length: 14 }, (_, i) => addDays(i - 13));
  const max = 10;
  return `<div class="hl-kpis">
      <div class="hl-kpi"><span>Média 7 noites</span><b class="${a7 && a7 < 7 ? 'warn' : ''}">${a7 ? fmtH(a7) : '—'}</b><small>${a7 ? (a7 >= 7 ? 'dentro do recomendado' : 'abaixo de 7h') : ''}</small></div>
      <div class="hl-kpi"><span>Média 30 noites</span><b>${a30 ? fmtH(a30) : '—'}</b><small>${last(30).length} noites registradas</small></div>
      <div class="hl-kpi"><span>Costuma deitar</span><b>${bedAvg}</b><small>${beds.length > 2 ? (sd <= 30 ? 'horário regular' : `varia ±${Math.round(sd)} min`) : ''}</small></div>
      <div class="hl-kpi"><span>Qualidade média</span><b>${qAvg ? QUALITY[Math.round(qAvg) - 1] : '—'}</b><small>${qAvg ? bars(5, Math.round(qAvg)) : ''}</small></div>
    </div>
    ${card('chart', 'Últimas 14 noites', '<span class="hl-muted sm">linha = 7h</span>', `<div class="hl-sleepchart">${days.map((d) => { const s = list.find((x) => x.date === d); const v = s ? hrs(s) : 0; return `<div title="${dm(d)}: ${v ? fmtH(v) : 'sem registro'}"><span class="hl-sbar ${v && v < 6 ? 'low' : v >= 7 ? 'ok' : ''}" style="height:${Math.round((Math.min(v, max) / max) * 140)}px"></span><small>${parseISO(d).getDate()}</small></div>`; }).join('')}<i class="hl-7h" style="bottom:${20 + (7 / max) * 140}px"></i></div>`)}
    ${card('bed', 'Noites', '', `<div class="hl-rows">${list.slice(0, 20).map((s) => `<div class="hl-row"><span class="hl-dt">${dm(s.date)}</span><span class="hl-desc">${fmtH(hrs(s))}<small>${s.bed && s.wake ? `${s.bed} → ${s.wake}` : ''}${s.q || s.quality ? ` · ${QUALITY[qIndex(s)]}` : ''}</small></span>${bars(5, s.q || s.quality ? qIndex(s) + 1 : 0)}</div>`).join('')}</div>`)}`;
}

// ---------- Diário ----------
function diaryTab() {
  const dates = new Set([...items('moods').filter((m) => m.score || m.grateful).map((m) => m.date), ...items('journal').map((j) => j.date)]);
  const list = [...dates].sort().reverse().slice(0, 60);
  if (!list.length) return empty('pen', 'Seu diário está vazio', 'Na aba Hoje, marque o humor e escreva algumas linhas. Cada dia aparece aqui.', '<button class="btn primary" data-action="hl-tab" data-v="hoje">Escrever hoje</button>');
  return `<div class="hl-diarylist">${list.map((d) => {
    const m = byDate('moods', d) || {};
    const js = items('journal').filter((j) => j.date === d);
    const text = js.map((j) => (j.daily ? j.text : [j.title, j.text].filter(Boolean).join(' — '))).filter(Boolean).join('\n\n');
    return `<button class="hl-entry" data-action="hl-open-day" data-d="${d}"><span class="hl-entry-face">${m.score ? FACES[m.score - 1] : '·'}</span><span class="hl-entry-d"><b>${dm(d)}</b></span>
      <span class="hl-entry-body"><b>${longDate(d)}</b><small>${[m.energy ? `energia ${ENERGY[m.energy - 1]}` : '', m.grateful ? `grato por ${esc(m.grateful)}` : ''].filter(Boolean).join(' · ')}</small>${text ? `<p>${esc(text)}</p>` : ''}</span></button>`;
  }).join('')}</div>`;
}

// ---------- Remédios ----------
function medsTab() {
  const meds = items('meds');
  return `<div class="hl-bar"><p>${icon('bell')}O ORBITA avisa no sino na hora de cada dose e marca na aba Hoje.</p><button class="btn primary" data-action="hl-med-new">${icon('plus')}Novo remédio</button></div>
    ${meds.length ? `<div class="hl-meds">${meds.map((m) => { const ad = adherence(m); return `<button class="hl-med" data-action="hl-med-edit" data-id="${m.id}">
      <span class="hl-med-h"><span class="hl-med-ico ${m.kind === 'Suplemento' ? 'sup' : ''}">${icon(m.kind === 'Suplemento' ? 'leaf' : 'pill')}</span><span><b>${esc(m.name)}</b><small>${esc([m.kind || 'Remédio', m.dose].filter(Boolean).join(' · '))}</small></span></span>
      <span class="hl-med-s">${icon('clock')}${esc(schedText(m))}</span>
      ${m.how && m.how !== 'Tanto faz' ? `<span class="hl-med-s">${icon('apple')}${esc(m.how)}</span>` : ''}
      <span class="hl-med-f">${ad != null ? `<span class="hl-ad ${ad >= 80 ? 'ok' : ad >= 50 ? 'mid' : 'bad'}">${ad}% em dia (7 dias)</span>` : '<span class="hl-muted sm">sem doses ainda</span>'}${m.stock !== '' && m.stock != null ? `<span class="${+m.stock <= 5 ? 'low' : ''}">${m.stock} em casa</span>` : ''}${m.end ? `<span>até ${fmtDate(m.end)}</span>` : '<span>uso contínuo</span>'}</span>
    </button>`; }).join('')}</div>`
      : empty('pill', 'Nenhum remédio cadastrado', 'Cadastre remédios, vitaminas ou suplementos com os horários. Você recebe o lembrete e acompanha se está tomando certinho.')}`;
}
let mm = null;
function openMedModal(id = null) {
  const m = id ? find('meds', id) : null;
  mm = m ? { ...m, times: [...(m.times || ['08:00'])], days: [...(m.days || [])] } : { kind: 'Remédio', name: '', dose: '', when: 'daily', days: [1, 2, 3, 4, 5], every: 2, cycleOn: '', cycleOff: '', times: ['08:00'], start: '', end: '', how: 'Tanto faz', stock: '', note: '' };
  renderMed();
  return true;
}
function renderMed(focus = '#hm-name') {
  const seg = (action, list, cur) => `<div class="hl-seg">${list.map(([v, l]) => `<button class="${cur === v ? 'on' : ''}" data-action="${action}" data-v="${v}">${l}</button>`).join('')}</div>`;
  openOverlay(`<div class="modal pjm hlm" role="dialog" aria-label="${mm.id ? 'Editar remédio' : 'Novo remédio'}">
    <div class="pjm-head"><span class="pj-ico">${icon('pill')}</span><div><h3>${mm.id ? 'Editar remédio' : 'Novo remédio'}</h3><p>Na hora de cada dose você recebe um aviso, até marcar como tomado.</p></div><button class="icon-btn" data-action="close-overlay" aria-label="Fechar">${icon('x')}</button></div>
    <div class="pjm-body">
      ${seg('hm-kind', [['Remédio', `${icon('pill')}Remédio`], ['Suplemento', `${icon('leaf')}Suplemento`]], mm.kind)}
      <label class="pjm-label" for="hm-name">Nome</label><input id="hm-name" class="pjm-input sm" data-input="hm-f" data-f="name" value="${esc(mm.name)}" placeholder="Ex.: Dipirona" maxlength="80" autocomplete="off">
      <label class="pjm-label" for="hm-dose">Dose</label><input id="hm-dose" class="pjm-input sm" data-input="hm-f" data-f="dose" value="${esc(mm.dose)}" placeholder="Ex.: 1 comprimido, 10 gotas" maxlength="60" autocomplete="off">
      <span class="pjm-label">Quando</span>
      ${seg('hm-when', [['daily', 'Todo dia'], ['weekdays', 'Dias da semana'], ['every', 'A cada X dias'], ['asneeded', 'Se precisar']], mm.when)}
      ${mm.when === 'weekdays' ? `<div class="hl-wd">${WD.map((l, i) => `<button class="${mm.days.includes(i) ? 'on' : ''}" data-action="hm-day" data-v="${i}">${l}</button>`).join('')}</div>` : ''}
      ${mm.when === 'every' ? `<div class="hl-inline">A cada <input type="number" min="2" max="60" class="pjm-input sm" data-input="hm-f" data-f="every" value="${esc(mm.every)}" aria-label="Intervalo em dias"> dias</div>` : ''}
      ${mm.when !== 'asneeded' ? `<div class="hl-inline">Com pausa? <input type="number" min="1" class="pjm-input sm" data-input="hm-f" data-f="cycleOn" value="${esc(mm.cycleOn)}" placeholder="21" aria-label="Dias tomando"> dias tomando e <input type="number" min="1" class="pjm-input sm" data-input="hm-f" data-f="cycleOff" value="${esc(mm.cycleOff)}" placeholder="7" aria-label="Dias de pausa"> de pausa</div>
      <p class="hl-hint">Ex.: cartela de 21 com 7 de pausa. Conta da data de início; vazio = sem pausa.</p>
      <span class="pjm-label">Horários</span>
      <div class="hl-times">${mm.times.map((t, i) => `<span class="hl-time">${icon('clock')}<input type="time" data-change="hm-time" data-i="${i}" value="${t}" aria-label="Horário ${i + 1}">${mm.times.length > 1 ? `<button class="icon-btn sm" data-action="hm-time-del" data-i="${i}" aria-label="Tirar horário">${icon('x')}</button>` : ''}</span>`).join('')}<button class="btn sm" data-action="hm-time-add">${icon('plus')}Horário</button></div>` : ''}
      <div class="pjm-two">
        <div><span class="pjm-label">Começa em</span><label class="pjm-date">${icon('calendar')}<span>${mm.start ? fmtDate(mm.start) : 'Já começou'}</span><input type="date" data-change="hm-start" value="${mm.start}"></label></div>
        <div><span class="pjm-label">Termina em</span><label class="pjm-date">${icon('calendar')}<span>${mm.end ? fmtDate(mm.end) : 'Uso contínuo'}</span><input type="date" data-change="hm-end" value="${mm.end}"></label>${mm.end ? '<button class="link-btn pjm-clear" data-action="hm-end-clear">uso contínuo</button>' : ''}</div>
      </div>
      <span class="pjm-label">Como tomar</span>
      ${seg('hm-how', [['Tanto faz', 'Tanto faz'], ['Com comida', 'Com comida'], ['Em jejum', 'Em jejum']], mm.how)}
      <div class="pjm-two">
        <div><label class="pjm-label" for="hm-stock">Estoque em casa</label><input id="hm-stock" class="pjm-input sm" type="number" min="0" data-input="hm-f" data-f="stock" value="${esc(mm.stock)}" placeholder="Ex.: 30"></div>
        <div><label class="pjm-label" for="hm-note">Observação</label><input id="hm-note" class="pjm-input sm" data-input="hm-f" data-f="note" value="${esc(mm.note)}" placeholder="Ex.: receita do Dr. Paulo" maxlength="120"></div>
      </div>
    </div>
    <div class="pjm-foot">${mm.id ? `<button class="btn danger" data-action="hm-delete" style="margin-right:auto">${icon('trash')}Excluir</button>` : ''}<button class="btn ghost" data-action="close-overlay">Cancelar</button><button class="btn primary" data-action="hm-save" ${mm.name.trim() ? '' : 'disabled'}>Salvar</button></div>
  </div>`, (bd) => { bd.classList.add('pjm-backdrop'); const el = focus && bd.querySelector(focus); if (el) { el.focus(); el.setSelectionRange?.(el.value.length, el.value.length); } });
}
const keepMed = (fn) => { const s = document.querySelector('.hlm .pjm-body')?.scrollTop || 0; fn(); const b = document.querySelector('.hlm .pjm-body'); if (b) b.scrollTop = s; };
const reMed = () => keepMed(() => renderMed(null));
on('hm-f', (ds, el) => { mm[ds.f] = el.value; const b = document.querySelector('[data-action="hm-save"]'); if (b) b.disabled = !mm.name.trim(); });
on('hm-kind', (ds) => { mm.kind = ds.v; reMed(); });
on('hm-when', (ds) => { mm.when = ds.v; reMed(); });
on('hm-day', (ds) => { const i = +ds.v; mm.days = mm.days.includes(i) ? mm.days.filter((x) => x !== i) : [...mm.days, i]; reMed(); });
on('hm-how', (ds) => { mm.how = ds.v; reMed(); });
on('hm-time', (ds, el) => { mm.times[+ds.i] = el.value || '08:00'; });
on('hm-time-add', () => { const last = mm.times.at(-1) || '08:00'; const h = (+last.slice(0, 2) + 12) % 24; mm.times.push(`${String(h).padStart(2, '0')}:${last.slice(3)}`); reMed(); });
on('hm-time-del', (ds) => { mm.times.splice(+ds.i, 1); reMed(); });
on('hm-start', (ds, el) => { mm.start = el.value; reMed(); });
on('hm-end', (ds, el) => { mm.end = el.value; reMed(); });
on('hm-end-clear', () => { mm.end = ''; reMed(); });
on('hm-save', () => {
  if (!mm.name.trim()) return;
  const data = { kind: mm.kind, name: mm.name.trim(), dose: mm.dose.trim(), when: mm.when, days: mm.days, every: +mm.every || 2, cycleOn: mm.cycleOn === '' ? '' : +mm.cycleOn, cycleOff: mm.cycleOff === '' ? '' : +mm.cycleOff, times: [...new Set(mm.times.filter(Boolean))].sort(), start: mm.start || (mm.id ? mm.start : today()), end: mm.end, how: mm.how, stock: mm.stock === '' ? '' : +mm.stock, note: mm.note.trim() };
  upsert('meds', mm.id ? { id: mm.id, ...data } : { ...data, taken: {}, log: {} });
  toast(mm.id ? 'Remédio atualizado' : `${data.name} cadastrado`);
  mm = null;
  closeOverlay();
});
on('hm-delete', async () => {
  const m = mm && find('meds', mm.id);
  if (!m) return;
  closeOverlay();
  if (await confirmDialog(`Excluir “${m.name}”?`, 'O histórico de doses dele também some.')) { remove('meds', m.id); toast('Remédio excluído'); }
  mm = null;
});
on('hl-med-new', () => openMedModal());
on('hl-med-edit', (ds) => openMedModal(ds.id));
on('hl-take', (ds) => {
  const m = find('meds', ds.id);
  if (!m) return;
  m.taken ||= {};
  const was = !!m.taken[ds.k];
  if (was) delete m.taken[ds.k]; else m.taken[ds.k] = Date.now();
  if (m.stock !== '' && m.stock != null) m.stock = Math.max(0, +m.stock + (was ? 1 : -1));
  save();
  if (!was) toast(`${m.name} marcado como tomado`);
});
on('hl-took', (ds) => {
  const m = find('meds', ds.id);
  if (!m) return;
  const d = dayOf();
  m.log ||= {}; (m.log[d] ||= []).push(Date.now());
  if (m.stock !== '' && m.stock != null) m.stock = Math.max(0, +m.stock - 1);
  save();
  toast(`${m.name} registrado`);
});

// ---------- Consultas ----------
function apptsTab() {
  const T = today();
  const list = items('appts');
  const next = list.filter((a) => a.date >= T).sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
  const past = list.filter((a) => a.date < T).sort((a, b) => b.date.localeCompare(a.date));
  const returns = list.filter((a) => a.returnDate && a.returnDate >= T && !list.some((x) => x !== a && x.with === a.with && x.date > a.date)).sort((a, b) => a.returnDate.localeCompare(b.returnDate));
  const row = (a) => `<button class="hl-appt ${a.date < T ? 'past' : ''}" data-action="hl-appt-edit" data-id="${a.id}">
      <span class="hl-appt-d"><b>${parseISO(a.date).getDate()}</b><small>${monthShort(parseISO(a.date).getMonth())}</small></span>
      <span class="hl-desc"><b>${esc(a.kind)}${a.with ? ` · ${esc(a.with)}` : ''}</b><small>${[a.date === T ? 'hoje' : a.date === addDays(1) ? 'amanhã' : longDate(a.date).split(',')[0].toLowerCase(), a.time, a.place].filter(Boolean).map(esc).join(' · ')}</small>${a.notes ? `<small class="hl-appt-n">${esc(a.notes)}</small>` : ''}</span>
      ${a.returnDate ? `<span class="hl-ret">retorno ${fmtDate(a.returnDate)}</span>` : ''}</button>`;
  return `<div class="hl-bar"><p>Consultas, exames e retornos, com aviso na véspera.</p><button class="btn primary" data-action="hl-appt-new">${icon('plus')}Agendar</button></div>
    ${list.length ? `${returns.length ? card('repeat', 'Retornos para marcar', '', `<div class="hl-rows">${returns.map((a) => `<div class="hl-row"><span class="hl-dt">${dm(a.returnDate)}</span><span class="hl-desc">${esc(a.with || a.kind)}<small>retorno da ${a.kind.toLowerCase()} de ${fmtDate(a.date)}</small></span><button class="btn sm" data-action="hl-appt-new" data-with="${esc(a.with)}" data-kind="${esc(a.kind)}" data-date="${a.returnDate}">Agendar</button></div>`).join('')}</div>`) : ''}
      ${card('calendar', 'Próximas', `<span class="hl-muted sm">${next.length}</span>`, next.length ? next.map(row).join('') : '<p class="hl-muted">Nada agendado.</p>')}
      ${past.length ? card('clock', 'Histórico', '', past.slice(0, 20).map(row).join('')) : ''}`
      : empty('steth', 'Nenhuma consulta ou exame', 'Anote consultas e exames com data, local e o que perguntar. O ORBITA lembra na véspera e na data do retorno.')}`;
}
let am = null;
function openApptModal(defaults = {}, id = null) {
  const a = id ? find('appts', id) : null;
  am = a ? { ...a } : { kind: defaults.kind || 'Consulta', with: defaults.with || '', date: defaults.date || today(), time: '', place: '', notes: '', follow: '' };
  renderAppt();
  return true;
}
function renderAppt(focus = '#ha-with') {
  openOverlay(`<div class="modal pjm hlm" role="dialog" aria-label="${am.id ? 'Editar consulta' : 'Nova consulta ou exame'}">
    <div class="pjm-head"><span class="pj-ico">${icon('steth')}</span><div><h3>${am.id ? `Editar ${am.kind.toLowerCase()}` : 'Nova consulta ou exame'}</h3><p>Você recebe um aviso na véspera e no dia de marcar o retorno.</p></div><button class="icon-btn" data-action="close-overlay" aria-label="Fechar">${icon('x')}</button></div>
    <div class="pjm-body">
      <div class="hl-seg">${['Consulta', 'Exame'].map((k) => `<button class="${am.kind === k ? 'on' : ''}" data-action="ha-kind" data-v="${k}">${k}</button>`).join('')}</div>
      <label class="pjm-label" for="ha-with">${am.kind === 'Exame' ? 'Qual exame' : 'Consulta com'}</label><input id="ha-with" class="pjm-input sm" data-input="ha-f" data-f="with" value="${esc(am.with)}" placeholder="${am.kind === 'Exame' ? 'Ex.: Hemograma completo' : 'Ex.: Dra. Ana (dermatologista)'}" maxlength="80" autocomplete="off">
      <div class="pjm-two">
        <div><span class="pjm-label">Data</span><label class="pjm-date">${icon('calendar')}<span>${am.date === today() ? `Hoje, ${parseISO(am.date).getDate()} de ${monthShort(parseISO(am.date).getMonth()).toLowerCase()}` : fmtDate(am.date)}</span><input type="date" data-change="ha-date" value="${am.date}"></label></div>
        <div><span class="pjm-label">Horário (opcional)</span><span class="hl-time">${icon('clock')}<input type="time" data-change="ha-time" value="${esc(am.time)}" aria-label="Horário"></span></div>
      </div>
      <label class="pjm-label" for="ha-place">Local</label><input id="ha-place" class="pjm-input sm" data-input="ha-f" data-f="place" value="${esc(am.place)}" placeholder="Ex.: Clínica Vida, sala 304" maxlength="100">
      <label class="pjm-label" for="ha-notes">Anotações</label><textarea id="ha-notes" class="pjm-input area" rows="3" data-input="ha-f" data-f="notes" placeholder="O que perguntar, o que levar, preparo do exame…">${esc(am.notes)}</textarea>
      <label class="pjm-label" for="ha-follow">Retorno ou repetir em (opcional)</label>
      <div class="hbm-select"><select id="ha-follow" data-change="ha-follow">${FOLLOW.map(([v, l]) => `<option value="${v}" ${String(am.follow || '') === v ? 'selected' : ''}>${l}</option>`).join('')}</select>${icon('chevD')}</div>
    </div>
    <div class="pjm-foot">${am.id ? `<button class="btn danger" data-action="ha-delete" style="margin-right:auto">${icon('trash')}Excluir</button>` : ''}<button class="btn ghost" data-action="close-overlay">Cancelar</button><button class="btn primary" data-action="ha-save" ${am.with.trim() ? '' : 'disabled'}>Salvar</button></div>
  </div>`, (bd) => { bd.classList.add('pjm-backdrop'); const el = focus && bd.querySelector(focus); if (el) { el.focus(); el.setSelectionRange?.(el.value.length, el.value.length); } });
}
on('ha-f', (ds, el) => { am[ds.f] = el.value; const b = document.querySelector('[data-action="ha-save"]'); if (b) b.disabled = !am.with.trim(); });
on('ha-kind', (ds) => { am.kind = ds.v; renderAppt(null); });
on('ha-date', (ds, el) => { am.date = el.value || today(); renderAppt(null); });
on('ha-time', (ds, el) => { am.time = el.value; });
on('ha-follow', (ds, el) => { am.follow = el.value; });
on('ha-save', () => {
  if (!am.with.trim()) return;
  const data = { kind: am.kind, with: am.with.trim(), date: am.date, time: am.time || '', place: am.place.trim(), notes: am.notes.trim(), follow: am.follow || '', returnDate: am.follow ? addDays(+am.follow, parseISO(am.date)) : '' };
  upsert('appts', am.id ? { id: am.id, ...data } : data);
  toast(am.id ? 'Atualizado' : `${data.kind} agendada`);
  am = null;
  closeOverlay();
});
on('ha-delete', async () => {
  const a = am && find('appts', am.id);
  if (!a) return;
  closeOverlay();
  if (await confirmDialog(`Excluir ${a.kind.toLowerCase()} “${a.with}”?`, '')) { remove('appts', a.id); toast('Excluído'); }
  am = null;
});
on('hl-appt-new', (ds) => openApptModal({ with: ds.with || '', kind: ds.kind || 'Consulta', date: ds.date || '' }));
on('hl-appt-edit', (ds) => openApptModal({}, ds.id));
formHooks.meds = (d, id) => openMedModal(id);
formHooks.appts = (d, id) => openApptModal(d, id);

// ---------- Padrões ----------
function patternsTab() {
  const days = Array.from({ length: 30 }, (_, i) => addDays(i - 29));
  const pts = days.map((d) => { const s = byDate('sleep', d); const m = byDate('moods', d); return { d, s: s ? +s.hours || sleepHours(s.bed, s.wake) : null, m: m?.score || null, e: m?.energy || null, w: +(byDate('water', d)?.ml || 0) }; });
  const W = 640, Hh = 190, pad = 26, bw = (W - pad * 2) / 30;
  const x = (i) => pad + i * bw + bw / 2;
  const ys = (v) => Hh - 22 - (Math.min(v, 10) / 10) * (Hh - 40);
  const ym = (v) => Hh - 22 - ((v - 1) / 4) * (Hh - 40);
  const line = pts.map((p, i) => (p.m ? [x(i), ym(p.m)] : null)).filter(Boolean);
  const chart = `<svg class="hl-pchart" viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Sono e humor nos últimos 30 dias">
    ${[1, 3, 5].map((v) => `<text x="${W - 4}" y="${ym(v) + 4}" text-anchor="end">${v}</text><line x1="${pad}" x2="${W - pad}" y1="${ym(v)}" y2="${ym(v)}" class="g"/>`).join('')}
    ${pts.map((p, i) => (p.s ? `<rect x="${x(i) - bw * 0.32}" y="${ys(p.s)}" width="${bw * 0.64}" height="${Hh - 22 - ys(p.s)}" rx="2" class="s"><title>${dm(p.d)}: ${fmtH(p.s)}</title></rect>` : '')).join('')}
    ${line.length > 1 ? `<polyline points="${line.map((q) => q.join(',')).join(' ')}" class="m"/>` : ''}${line.map(([a, b]) => `<circle cx="${a}" cy="${b}" r="3" class="mc"/>`).join('')}
    ${pts.map((p, i) => (i % 3 === 0 || i === 29 ? `<text x="${x(i)}" y="${Hh - 6}" text-anchor="middle">${dm(p.d)}</text>` : '')).join('')}
  </svg>`;
  const both = pts.filter((p) => p.s && p.m);
  const good = both.filter((p) => p.s >= 7), bad = both.filter((p) => p.s < 6.5);
  const avg = (l, k) => l.reduce((a, p) => a + p[k], 0) / l.length;
  const out = [];
  if (good.length >= 3 && bad.length >= 3) {
    const g = avg(good, 'm'), b = avg(bad, 'm');
    out.push(['bed', g - b >= 0.3 ? `Nos dias depois de dormir 7h ou mais, seu humor fica em média ${g.toFixed(1).replace('.', ',')}; depois de noites curtas, ${b.toFixed(1).replace('.', ',')}.` : 'Seu humor quase não muda entre noites curtas e longas, por enquanto.']);
    const eg = good.filter((p) => p.e), eb = bad.filter((p) => p.e);
    if (eg.length >= 3 && eb.length >= 3) out.push(['bolt', `Energia: ${avg(eg, 'e').toFixed(1).replace('.', ',')} depois de noites boas, ${avg(eb, 'e').toFixed(1).replace('.', ',')} depois das curtas.`]);
  }
  const goal = +H().waterGoal || 2000;
  const wd = pts.filter((p) => p.w && p.e);
  const wHi = wd.filter((p) => p.w >= goal), wLo = wd.filter((p) => p.w < goal * 0.6);
  if (wHi.length >= 3 && wLo.length >= 3) out.push(['drop', `Nos dias em que bateu a meta de água, sua energia foi ${avg(wHi, 'e').toFixed(1).replace('.', ',')}; nos de pouca água, ${avg(wLo, 'e').toFixed(1).replace('.', ',')}.`]);
  const ads = items('meds').map((m) => [m, adherence(m, 30)]).filter(([, a]) => a != null);
  ads.forEach(([m, a]) => out.push(['pill', `${m.name}: ${a}% das doses dos últimos 30 dias marcadas como tomadas.`]));
  const moodDays = pts.filter((p) => p.m).length;
  return `${card('chart', 'Sono e humor nos últimos 30 dias', '<span class="hl-legend"><span><i class="s"></i>Sono (h)</span><span><i class="m"></i>Humor (1 a 5)</span></span>', `<div class="hl-pwrap">${chart}</div>`)}
    ${card('spark', 'O que os dados mostram', '', out.length ? `<div class="hl-rows">${out.map(([ic, t]) => `<div class="hl-insight">${icon(ic)}<p>${esc(t)}</p></div>`).join('')}</div>` : '')}
    ${good.length >= 3 && bad.length >= 3 ? '' : `<p class="hl-muted">Ainda faltam dados para comparar. Com pelo menos 3 noites boas e 3 ruins com humor marcado, as primeiras conclusões aparecem aqui (${moodDays} ${moodDays === 1 ? 'dia' : 'dias'} com humor até agora).</p>`}`;
}

// ---------- Ações do dia ----------
const moodRec = (d) => byDate('moods', d) || upsert('moods', { date: d });
on('hl-tab', (ds) => { setH({ tab: ds.v }); requestAnimationFrame(() => document.querySelector('.hl-tabs .on')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })); });
on('hl-day', (ds) => setH({ d: Math.min(0, (H().d || 0) + +ds.d) }));
on('hl-open-day', (ds) => { setH({ tab: 'hoje', d: daysBetween(today(), ds.d) }); window.scrollTo({ top: 0 }); });
on('hl-mood', (ds) => { const m = moodRec(dayOf()); if (m.score === +ds.v) delete m.score; else m.score = +ds.v; save(); });
on('hl-energy', (ds) => { const m = moodRec(dayOf()); if (+m.energy === +ds.v) delete m.energy; else m.energy = +ds.v; save(); });
let tGrat = null, tDiary = null;
on('hl-grat', (ds, el) => { const d = dayOf(); clearTimeout(tGrat); tGrat = setTimeout(() => { const m = byDate('moods', d) || (() => { const o = { id: uid(), date: d, createdAt: Date.now() }; items('moods').push(o); return o; })(); m.grateful = el.value.trim(); persist(); }, 300); });
on('hl-diary', (ds, el) => {
  const d = dayOf();
  const note = document.querySelector('.hl-saved'); if (note) note.textContent = 'Salvando…';
  clearTimeout(tDiary);
  tDiary = setTimeout(() => {
    let j = byDate('journal', d);
    if (!j && el.value.trim()) { j = { id: uid(), date: d, daily: true, title: 'Diário', createdAt: Date.now() }; items('journal').push(j); }
    if (j) { j.text = el.value; if (!el.value.trim()) state.data.journal = items('journal').filter((x) => x !== j); }
    persist();
    if (note) note.textContent = 'Salvo';
  }, 500);
});
function sleepRec(d) { return byDate('sleep', d) || upsert('sleep', { date: d, hours: 0 }); }
const fixHours = (s) => { const h = sleepHours(s.bed, s.wake); if (h) s.hours = h; };
on('hl-bed', (ds, el) => { const s = sleepRec(dayOf()); s.bed = el.value; fixHours(s); save(); });
on('hl-wake', (ds, el) => { const s = sleepRec(dayOf()); s.wake = el.value; fixHours(s); save(); });
on('hl-quality', (ds) => { const s = sleepRec(dayOf()); s.q = +ds.v; s.quality = QUALITY[+ds.v - 1]; save(); });
on('hl-water', (ds) => {
  const d = dayOf(), g = +H().glass || 250;
  const w = byDate('water', d) || upsert('water', { date: d, ml: 0 });
  const before = +w.ml || 0;
  w.ml = Math.max(0, before + +ds.v * g);
  save();
  const goal = +H().waterGoal || 2000;
  if (before < goal && w.ml >= goal) toast('Meta de água batida 💧');
});
on('hl-water-cfg', () => {
  const h = H();
  openOverlay(`<form class="modal" data-submit="hl-water-save"><div class="modal-head"><h3>Água</h3><button type="button" class="icon-btn" data-action="close-overlay" aria-label="Fechar">${icon('x')}</button></div>
    <div class="modal-body"><label class="field"><span>Tamanho do copo (ml)</span><select name="glass">${[150, 200, 250, 300, 350, 500].map((v) => `<option ${+h.glass === v ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
    <label class="field"><span>Meta por dia (ml)</span><input name="goal" type="number" min="500" step="100" value="${h.waterGoal || 2000}"></label></div>
    <div class="modal-foot"><button type="button" class="btn" data-action="close-overlay">Cancelar</button><button class="btn primary">Salvar</button></div></form>`);
});
on('hl-water-save', (ds, form) => { closeOverlay(); setH({ glass: +form.elements.glass.value || 250, waterGoal: Math.max(500, +form.elements.goal.value || 2000) }); });
