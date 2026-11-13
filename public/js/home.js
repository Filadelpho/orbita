// Cartões do Início: progresso, ritmo e conquistas (cálculos a partir dos dados de todos os módulos).
import { state, items, today, addDays, parseISO, iso } from './store.js';
import { escapeHtml as esc, MONTHS_FULL } from './collections.js';
import { icon } from './icons.js';
import { ui, on, bus } from './ui.js';
import { insights } from './ai.js';
import { habitList } from './habits.js';

// ---------- Peças dos cartões ----------
export const dLink = (route, label) => `<a class="dcard-link" href="#/${route}">${esc(label)}${icon('arrowUpRight')}</a>`;
export const dCard = (ico, title, body, { link = '', cls = '', extra = '' } = {}) => `
  <section class="dcard ${cls}"><header class="dcard-head">${icon(ico)}<h3>${esc(title)}</h3>${extra}${link}</header><div class="dcard-body">${body}</div></section>`;
export const dEmpty = (ico, title, text, btn = '') => `
  <div class="dempty"><span class="dempty-ico">${icon(ico)}</span><b>${title}</b>${text ? `<p>${esc(text)}</p>` : ''}${btn}</div>`;
export const dBtn = (label, attrs) => `<button class="dbtn" ${attrs}>${icon('plus')}${esc(label)}</button>`;
export const fmtMin = (m) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ' ' + (m % 60) + ' min' : ''}` : `${m} min`);

const WD = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const WD_FULL = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
const dow = (s) => (parseISO(s).getDay() + 6) % 7; // 0 = segunda
const num = (n, d = 1) => (+n).toLocaleString('pt-BR', { maximumFractionDigits: d });
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// Dia em que a tarefa foi concluída (tarefas antigas sem registro usam o prazo).
export const doneDate = (t) => (t.done ? t.doneAt || t.due || null : null);
function doneByDay() {
  const map = {};
  items('tasks').forEach((t) => { const d = doneDate(t); if (d) map[d] = (map[d] || 0) + 1; });
  return map;
}
// Segunda-feira da semana de uma data.
const weekStart = (base = new Date()) => { const d = new Date(base); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d; };
const weekDays = (offset = 0) => { const s = weekStart(); s.setDate(s.getDate() + offset * 7); return [...Array(7)].map((_, i) => { const d = new Date(s); d.setDate(s.getDate() + i); return iso(d); }); };

function streak(isActive) {
  let n = 0;
  let k = isActive(today()) ? 0 : -1; // hoje ainda pode estar em aberto
  while (isActive(addDays(k))) { n++; k--; }
  return n;
}
const activeDay = (d) => {
  if (doneByDay()[d]) return true;
  if (habitList().some((h) => h.log?.[d])) return true;
  if (items('moods').some((m) => m.date === d)) return true;
  return items('focus').some((f) => f.date === d);
};

// ---------- Tempo de foco ----------
export function focusWeek() {
  const sum = (days) => items('focus').filter((f) => days.includes(f.date)).reduce((s, f) => s + (+f.minutes || 0), 0);
  const cur = weekDays(0), prev = weekDays(-1);
  const total = sum(cur), before = sum(prev);
  const elapsed = Math.max(1, cur.indexOf(today()) + 1);
  const perDay = cur.map((d) => sum([d]));
  const delta = before ? Math.round(((total - before) / before) * 100) : total ? 100 : 0;
  return { total, before, delta, avg: Math.round(total / elapsed), perDay, days: cur };
}
export function focusBars(perDay, days) {
  const max = Math.max(60, ...perDay);
  const T = today();
  return `<div class="fbars">${perDay.map((m, i) => `<span class="fbar ${days[i] === T ? 'today' : ''}" title="${WD_FULL[i]}: ${fmtMin(m)}"><i style="height:${Math.max(4, (m / max) * 100)}%"></i><small>${WD[i][0]}</small></span>`).join('')}</div>`;
}

// ---------- Foco por item ----------
export function focusItemsCard() {
  const days = weekDays(0);
  const by = {};
  items('focus').filter((f) => days.includes(f.date)).forEach((f) => { const k = f.item || 'Foco livre'; by[k] = (by[k] || 0) + (+f.minutes || 0); });
  const list = Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const max = list[0]?.[1] || 1;
  return dCard('clock', 'Foco por item', list.length ? `<div class="fitems">${list.map(([k, m]) => `
      <div class="fitem"><div><b>${esc(k)}</b><small>${fmtMin(m)}</small></div><div class="bar"><i style="width:${(m / max) * 100}%"></i></div></div>`).join('')}</div>`
    : dEmpty('clock', 'Nenhum foco nesta semana', 'Escolha uma tarefa, hábito ou projeto e o tempo aparece aqui.', dBtn('Começar um foco', 'data-action="focus-pick"')),
  { link: dLink('tasks', 'Tarefas') });
}

// ---------- Projetos em andamento ----------
export function projectsCard() {
  const tasks = items('tasks');
  const list = [...items('personalProjects').map((p) => ({ ...p, key: 'personalProjects' })), ...items('workProjects').map((p) => ({ ...p, key: 'workProjects' }))]
    .filter((p) => p.status === 'Em andamento' || p.status === 'Em revisão')
    .slice(0, 4);
  return dCard('folder', 'Projetos em andamento', list.length ? `<div class="plist">${list.map((p) => {
      const ts = tasks.filter((t) => t.project && t.project === p.title);
      const done = ts.filter((t) => t.done).length;
      const pct = ts.length ? Math.round((done / ts.length) * 100) : 0;
      return `<button class="prow" data-action="open-form" data-key="${p.key}" data-id="${p.id}"><span class="pt"><b>${esc(p.title)}</b><small>${ts.length ? `${done} de ${plural(ts.length, 'tarefa', 'tarefas')}` : esc(p.status)}${p.deadline ? ' · até ' + p.deadline.split('-').reverse().slice(0, 2).join('/') : ''}</small></span>
        <span class="bar"><i style="width:${pct}%"></i></span></button>`;
    }).join('')}</div>`
    : dEmpty('folder', 'Nenhum projeto ativo', 'Junte as tarefas e os prazos de um mesmo trabalho.', dBtn('Criar seu primeiro projeto', 'data-action="open-form" data-key="personalProjects"')),
  { link: dLink('goals', 'Projetos') });
}

// ---------- Metas e conquistas ----------
const MILESTONES = {
  tasks: [5, 10, 25, 50, 100, 250, 500, 1000],
  streak: [3, 7, 14, 30, 60, 100, 365],
  habits: [10, 25, 50, 100, 250, 500, 1000],
  focus: [1, 5, 10, 25, 50, 100, 250],
};
const next = (list, v) => list.find((m) => m > v) || list.at(-1);
function achievements() {
  const week = weekDays(0);
  const dbd = doneByDay();
  const doneTotal = Object.values(dbd).reduce((a, b) => a + b, 0);
  const doneWeek = week.reduce((s, d) => s + (dbd[d] || 0), 0);
  const st = streak(activeDay);
  const checks = habitList().reduce((s, h) => s + Object.keys(h.log || {}).length, 0);
  const checksWeek = habitList().reduce((s, h) => s + week.filter((d) => h.log?.[d]).length, 0);
  const focusH = Math.floor(items('focus').reduce((s, f) => s + (+f.minutes || 0), 0) / 60);
  return [
    { id: 'tasks', label: 'Produtividade', emoji: '✅', value: doneWeek, unit: doneWeek === 1 ? 'tarefa na semana' : 'tarefas na semana', marks: week.map((d) => !!dbd[d]),
      total: doneTotal, mile: next(MILESTONES.tasks, doneTotal), quote: 'Uma tarefa riscada por vez já é progresso de verdade.' },
    { id: 'streak', label: 'Constância', emoji: '🚀', value: st, unit: st === 1 ? 'dia seguido' : 'dias seguidos', marks: week.map(activeDay),
      total: st, mile: next(MILESTONES.streak, st), quote: 'Aparecer todo dia vale mais do que um dia perfeito.' },
    { id: 'habits', label: 'Hábitos', emoji: '🔁', value: checksWeek, unit: checksWeek === 1 ? 'check-in na semana' : 'check-ins na semana', marks: week.map((d) => habitList().some((h) => h.log?.[d])),
      total: checks, mile: next(MILESTONES.habits, checks), quote: 'Hábitos pequenos, repetidos, mudam a semana inteira.' },
    { id: 'focus', label: 'Foco', emoji: '🎯', value: focusH, unit: focusH === 1 ? 'hora de foco no total' : 'horas de foco no total', marks: week.map((d) => items('focus').some((f) => f.date === d)),
      total: focusH, mile: next(MILESTONES.focus, focusH), quote: 'Vinte e cinco minutos de atenção inteira rendem mais do que uma tarde distraída.' },
  ];
}
export function achievementsCard() {
  const list = achievements();
  const i = ((ui.achIdx || 0) % list.length + list.length) % list.length;
  const a = list[i];
  const T = today();
  const week = weekDays(0);
  const left = Math.max(0, a.mile - a.total);
  const pct = Math.min(100, (a.total / a.mile) * 100);
  const nav = `<span class="ach-nav"><button class="icon-btn sm" data-action="ach-move" data-d="-1" aria-label="Anterior">${icon('chevL')}</button><button class="icon-btn sm" data-action="ach-move" data-d="1" aria-label="Próxima">${icon('chevR')}</button>
    <span class="ach-dots">${list.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</span></span>`;
  return dCard('target', 'Metas e conquistas', `
    <div class="ach">
      <div class="ach-top"><span class="ach-emoji">${a.emoji}</span><div><small class="ach-label">${esc(a.label)}</small><div class="ach-val"><b>${a.value}</b><span>${esc(a.unit)}</span></div></div></div>
      <div class="ach-week">${week.map((d, k) => `<span class="${d === T ? 'today' : ''}"><small>${WD[k]}</small><i class="${a.marks[k] ? 'on' : ''}">${a.marks[k] ? icon('check') : ''}</i></span>`).join('')}</div>
      <div class="ach-mile"><span>Próximo marco: <b>${a.mile}</b></span><span>${left ? `Faltam ${left}` : 'Marco alcançado 🎉'}</span></div>
      <div class="bar"><i style="width:${pct}%"></i></div>
      <p class="ach-quote">“${esc(a.quote)}”</p>
    </div>`, { cls: 'wide', extra: nav });
}
on('ach-move', (ds) => { ui.achIdx = (ui.achIdx || 0) + +ds.d; bus.render(); });

// ---------- Tarefas concluídas (mosaico) ----------
const level = (n, max) => (!n ? 0 : Math.min(4, Math.ceil((n / Math.max(max, 1)) * 4)));
export function heatmapCard() {
  const dbd = doneByDay();
  const mode = ui.heatMode || 'mosaic';
  const T = today();
  const now = new Date();
  const ym = (o) => { const d = new Date(now.getFullYear(), now.getMonth() + o, 1); return [d.getFullYear(), d.getMonth()]; };
  const countMonth = ([y, m]) => Object.entries(dbd).filter(([d]) => { const p = parseISO(d); return p.getFullYear() === y && p.getMonth() === m; }).reduce((s, [, n]) => s + n, 0);
  const thisM = countMonth(ym(0)), lastM = countMonth(ym(-1));
  const st = streak((d) => !!dbd[d]);
  let body;
  if (mode === 'months') {
    const months = [-5, -4, -3, -2, -1, 0].map((o) => { const k = ym(o); return { label: MONTHS_FULL[k[1]].slice(0, 3), n: countMonth(k), cur: o === 0 }; });
    const max = Math.max(1, ...months.map((m) => m.n));
    body = `<div class="hm-months">${months.map((m) => `<span class="${m.cur ? 'cur' : ''}" title="${m.label}: ${plural(m.n, 'tarefa', 'tarefas')}"><b>${m.n}</b><i style="height:${Math.max(4, (m.n / max) * 100)}%"></i><small>${m.label}</small></span>`).join('')}</div>`;
  } else {
    const start = weekStart(); start.setDate(start.getDate() - 7 * 9); // 10 semanas
    const cells = [...Array(70)].map((_, k) => { const d = new Date(start); d.setDate(start.getDate() + k); return iso(d); });
    const max = Math.max(1, ...cells.map((d) => dbd[d] || 0));
    body = `<div class="hm-grid">${WD.map((w) => `<small>${w}</small>`).join('')}${cells.map((d) => {
      const n = dbd[d] || 0;
      const fut = d > T;
      return `<i class="l${level(n, max)} ${d === T ? 'today' : ''} ${fut ? 'fut' : ''}" data-hm="${d.split('-').reverse().slice(0, 2).join('/')}" data-n="${n}">${d === T ? d.slice(8) : ''}</i>`;
    }).join('')}</div>
    <div class="hm-legend"><span>Menos</span>${[0, 1, 2, 3, 4].map((l) => `<i class="l${l}"></i>`).join('')}<span>Mais</span></div>
    <p class="hm-info" id="hm-info">Passe o mouse num dia</p>`;
  }
  return dCard('checkCircle', 'Tarefas concluídas', `
    <div class="mini-tabs"><button class="${mode === 'mosaic' ? 'on' : ''}" data-action="heat-mode" data-m="mosaic">Mosaico</button><button class="${mode === 'months' ? 'on' : ''}" data-action="heat-mode" data-m="months">Meses</button></div>
    ${body}
    <div class="hm-stats"><div><small>Este mês</small><b>${thisM}</b><span>vs. ${lastM} no mês passado</span></div><div><small>Sequência</small><b>${st}</b><span>${st === 1 ? 'dia' : 'dias'} entregando</span></div></div>`,
  { link: dLink('tasks', 'Tarefas'), cls: 'tall' });
}
on('heat-mode', (ds) => { ui.heatMode = ds.m; bus.render(); });
document.addEventListener('mouseover', (e) => {
  const c = e.target.closest?.('[data-hm]');
  const info = document.getElementById('hm-info');
  if (!c || !info) return;
  const n = +c.dataset.n;
  info.textContent = `${c.dataset.hm}: ${n ? plural(n, 'tarefa concluída', 'tarefas concluídas') : 'nenhuma tarefa concluída'}`;
});

// ---------- Ritmo da semana (radar) ----------
export function rhythmCard() {
  const dbd = doneByDay();
  const DAYS = 120;
  const sums = Array(7).fill(0), counts = Array(7).fill(0);
  for (let k = 0; k < DAYS; k++) { const d = addDays(-k); const w = dow(d); sums[w] += dbd[d] || 0; counts[w]++; }
  const avg = sums.map((s, i) => s / Math.max(1, counts[i]));
  const max = Math.max(...avg);
  const scale = max || 1;
  const C = 110, R = 78;
  const pt = (i, r) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / 7; return [C + Math.cos(a) * r, C + Math.sin(a) * r]; };
  const poly = (r) => [...Array(7)].map((_, i) => pt(i, typeof r === 'function' ? r(i) : r).map((v) => v.toFixed(1)).join(',')).join(' ');
  const best = max ? avg.indexOf(max) : -1;
  const svg = `<svg class="radar" viewBox="0 0 220 220" role="img" aria-label="Média de tarefas concluídas por dia da semana">
    ${[0.25, 0.5, 0.75, 1].map((f) => `<polygon points="${poly(R * f)}" class="rg"/>`).join('')}
    ${[...Array(7)].map((_, i) => { const [x, y] = pt(i, R); return `<line x1="${C}" y1="${C}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" class="rg"/>`; }).join('')}
    <polygon points="${poly((i) => Math.max(3, (avg[i] / scale) * R))}" class="rv"/>
    ${[...Array(7)].map((_, i) => { const [x, y] = pt(i, R + 18); return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" class="rl ${i === best ? 'best' : ''}">${WD[i]}</text><text x="${x.toFixed(1)}" y="${(y + 11).toFixed(1)}" class="rn">${num(avg[i])}</text>`; }).join('')}
  </svg>`;
  return dCard('repeat', 'Ritmo da semana', `
    ${svg}
    <div class="rhythm-foot"><small>Dia que mais entrega</small>${best >= 0 ? `<b>${WD_FULL[best]}</b><span>${num(avg[best])} tarefas em média nos últimos ${DAYS} dias</span>` : '<b>Ainda sem dados</b><span>Conclua tarefas e o seu ritmo aparece aqui.</span>'}</div>`,
  { extra: `<span class="dcard-meta">média · ${DAYS} dias</span>`, cls: 'tall' });
}

// ---------- O que seus dados mostram ----------
export function dataCard() {
  const moods = items('moods');
  const out = [];
  const recent = moods.filter((m) => m.date >= addDays(-28));
  if (recent.length >= 7) {
    const avgMood = recent.reduce((s, m) => s + (+m.score || 0), 0) / recent.length;
    out.push({ kind: avgMood >= 3.5 ? 'good' : avgMood < 2.5 ? 'bad' : 'warn', text: `Seu humor médio nas últimas 4 semanas foi ${num(avgMood)} de 5.` });
    const dbd = doneByDay();
    const hi = recent.filter((m) => m.score >= 4), lo = recent.filter((m) => m.score <= 2);
    const avgDone = (l) => l.reduce((s, m) => s + (dbd[m.date] || 0), 0) / Math.max(1, l.length);
    if (hi.length >= 3 && lo.length >= 2 && avgDone(hi) > avgDone(lo)) out.push({ kind: 'good', text: `Nos dias de humor bom você conclui ${num(avgDone(hi))} tarefas, contra ${num(avgDone(lo))} nos dias ruins.` });
    const withE = recent.filter((m) => m.energy);
    if (withE.length >= 5) {
      const byDow = Array(7).fill(0).map(() => []);
      withE.forEach((m) => byDow[dow(m.date)].push(+m.energy));
      const means = byDow.map((l) => (l.length ? l.reduce((a, b) => a + b, 0) / l.length : 0));
      const top = means.indexOf(Math.max(...means));
      if (means[top]) out.push({ kind: 'good', text: `Sua energia costuma ser mais alta na ${WD_FULL[top].toLowerCase()}.` });
    }
  }
  insights().slice(0, 4 - out.length).forEach((i) => out.push(i));
  const body = out.length
    ? `<div class="data-list">${out.map((i) => `<div class="insight ${i.kind}"><span class="dot"></span><span>${esc(i.text)}</span></div>`).join('')}</div>`
    : '';
  const early = recent.length < 7 ? `<p class="data-early">Ainda é cedo para padrões de humor: faça o check-in do dia por mais algumas semanas (${plural(recent.length, 'registro', 'registros')} até agora).</p>` : '';
  return dCard('spark', 'O que seus dados mostram', body + early || early, { link: dLink('ai', 'ORBITA AI'), cls: 'tall' });
}

export { WD, weekDays };
