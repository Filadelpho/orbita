// Regras dos hábitos: grupos, frequência, desafios com prazo e sequência.
import { items, today, addDays, parseISO } from './store.js';

export const HABIT_COLORS = ['#c0504d', '#c2566f', '#b9638f', '#a45cb4', '#7b6cc4', '#5b6cc4', '#4a86c5', '#3a97a8', '#3a9688', '#34c77b', '#7da345', '#b7a23f', '#c4973b', '#c2703d', '#8d6a52', '#71717a'];

// Hábitos que podem ser marcados (títulos de grupo ficam de fora).
export const habitList = () => items('habits').filter((h) => !h.group);
export const groupChildren = (g) => items('habits').filter((h) => h.parent === g.id && !h.group);

// Ordem de exibição: hábitos soltos e grupos, cada grupo seguido dos hábitos dele.
export function habitTree() {
  const all = items('habits');
  const ids = new Set(all.filter((h) => h.group).map((h) => h.id));
  const out = [];
  all.filter((h) => !h.parent || !ids.has(h.parent)).forEach((h) => {
    out.push({ h, depth: 0 });
    if (h.group) groupChildren(h).forEach((c) => out.push({ h: c, depth: 1 }));
  });
  return out;
}

export function challengeInfo(h, date = today()) {
  if (h.mode !== 'challenge' || !h.days || !h.start) return null;
  const day = Math.floor((parseISO(date) - parseISO(h.start)) / 86400000) + 1;
  return { day: Math.max(1, Math.min(day, h.days)), total: h.days, over: day > h.days, end: addDays(h.days - 1, parseISO(h.start)) };
}

// O hábito está previsto para essa data?
export function habitDue(h, date = today()) {
  if (h.group) return false;
  if (h.start && date < h.start) return false;
  const c = challengeInfo(h, date);
  if (c?.over) return false;
  if (h.freq === 'weekdays') { const w = parseISO(date).getDay(); return w !== 0 && w !== 6; }
  return true;
}

export function freqLabel(h) {
  if (h.group) return 'Grupo';
  const f = h.freq || (h.target && h.target < 7 ? 'times' : 'daily');
  if (f === 'weekdays') return 'Dias úteis';
  if (f === 'times') return `${h.target || 3}x por semana`;
  return 'Todo dia';
}

// Dias seguidos marcando; dias fora da frequência (ex.: fim de semana em "dias úteis") não quebram a sequência.
export function streakOf(h) {
  let n = 0;
  let d = h.log?.[today()] ? today() : addDays(-1);
  for (let guard = 0; guard < 400; guard++) {
    if (h.log?.[d]) n++;
    else if (h.freq !== 'weekdays' || habitDue(h, d)) break;
    d = addDays(-1, parseISO(d));
  }
  return n;
}
