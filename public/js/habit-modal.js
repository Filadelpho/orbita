// Janela "Novo hábito": sugestões de um clique, grupo, modalidade, frequência, tempo, meta, cor e prévia.
import { items, upsert, find, remove, today, addDays, parseISO } from './store.js';
import { escapeHtml as esc } from './collections.js';
import { icon } from './icons.js';
import { on, openOverlay, closeOverlay, toast, confirmDialog, formHooks } from './ui.js';
import { HABIT_COLORS, freqLabel, streakOf } from './habits.js';

const SUGGESTIONS = [
  { emoji: '📵', name: '21 dias sem Instagram', mode: 'challenge', days: 21 },
  { emoji: '💧', name: 'Beber 2L de água' },
  { emoji: '🏋️', name: 'Treino / Musculação', freq: 'times', target: 4 },
  { emoji: '📖', name: 'Ler 20 páginas' },
  { emoji: '🧘', name: 'Meditar 10 minutos', minutes: 10 },
  { emoji: '🌙', name: 'Dormir antes das 23h' },
  { emoji: '⚡', name: 'Revisão semanal', freq: 'times', target: 1 },
];
const EMOJIS = ['✨', '💧', '📖', '🏋️', '🧘', '🌙', '🍎', '🚶', '🗣️', '💊', '🧹', '💰', '✍️', '🎸', '📵', '☀️', '🦷', '🛏️', '🥗', '🧠'];
const MINUTES = [0, 10, 15, 20, 30, 45, 60];
const CHALLENGE_DAYS = [7, 14, 21, 30, 66, 90];

let hb = null;

const preview = () => {
  const c = hb.color || HABIT_COLORS[9];
  const sub = hb.group ? 'Título de grupo' : [hb.mode === 'challenge' ? `Desafio de ${hb.days} dias` : freqLabel(hb), hb.minutes ? `${hb.minutes} min` : ''].filter(Boolean).join(' · ');
  return `<div class="hbm-prev"><div class="hbm-prev-head"><span>Pré-visualização</span><span>Hoje</span></div>
    <div class="hbm-prev-row"><span class="hbm-prev-check" style="background:${c}">${hb.group ? esc(hb.emoji) : icon('check')}</span>
      <span class="hbm-prev-txt"><b>${esc(hb.name.trim() || 'Nome do seu hábito')}</b><small>${icon(hb.group ? 'grid' : 'calendar')}${sub}</small></span>
      ${hb.group ? '<span class="hbm-prev-count">0/0</span>' : `<span class="hbm-prev-streak">🔥 ${hb.id ? streakOf(find('habits', hb.id) || {}) : 0}d</span>`}</div></div>`;
};

function body() {
  const goals = items('goals');
  const groups = items('habits').filter((h) => h.group && h.id !== hb.id);
  const opt = (on, attrs, title, sub, ico = '') => `<button type="button" class="hbm-opt ${on ? 'on' : ''}" ${attrs}>${ico}<span><b>${title}</b><small>${sub}</small></span></button>`;
  return `
    ${hb.id ? '' : `<div class="hbm-sugg"><div class="hbm-sugg-title">${icon('spark')}Sugestões rápidas (1 clique)</div>
      <div class="hbm-chips">${SUGGESTIONS.map((s, i) => `<button type="button" class="hbm-chip" data-action="hbm-sugg" data-i="${i}"><span>${s.emoji}</span>${esc(s.name)}</button>`).join('')}</div></div>`}
    <label class="hbm-label" for="hbm-name">${hb.group ? 'Nome do grupo' : 'Nome do hábito'} <em>*</em></label>
    <div class="hbm-name-row">
      <button type="button" class="hbm-emoji" data-action="hbm-emoji-open" aria-label="Escolher emoji">${esc(hb.emoji)}</button>
      <input id="hbm-name" class="hbm-input" data-input="hbm-name" maxlength="80" placeholder="ex: 21 dias sem Instagram, Beber 2L de água…" value="${esc(hb.name)}" autocomplete="off">
    </div>
    ${hb.emojiOpen ? `<div class="hbm-emojis">${EMOJIS.map((e) => `<button type="button" class="${hb.emoji === e ? 'on' : ''}" data-action="hbm-emoji" data-e="${e}">${e}</button>`).join('')}</div>` : ''}
    <label class="hbm-group"><input type="checkbox" data-change="hbm-group" ${hb.group ? 'checked' : ''}><span><b>Só um título de grupo</b><small>Ex.: “Alimentação”, com Jejum, Evitar açúcar e Tomar chá dentro. O grupo não se marca: mostra quantos foram feitos.</small></span></label>
    ${hb.group ? '' : `
    ${groups.length ? `<label class="hbm-label" for="hbm-parent">Dentro do grupo (opcional)</label>
      <div class="hbm-select"><select id="hbm-parent" data-change="hbm-parent"><option value="">Nenhum grupo</option>${groups.map((g) => `<option value="${g.id}" ${hb.parent === g.id ? 'selected' : ''}>${esc(g.emoji || '')} ${esc(g.name)}</option>`).join('')}</select>${icon('chevD')}</div>` : ''}
    <div class="hbm-label">Modalidade</div>
    <div class="hbm-grid two">
      ${opt(hb.mode !== 'challenge', 'data-action="hbm-mode" data-v="continuous"', 'Hábito contínuo', 'Sem data fim, foco em constância', icon('repeat'))}
      ${opt(hb.mode === 'challenge', 'data-action="hbm-mode" data-v="challenge"', 'Desafio com prazo', 'Ex.: 21 dias sem Instagram', '<span class="hbm-medal">🏅</span>')}
    </div>
    ${hb.mode === 'challenge' ? `<div class="hbm-chips">${CHALLENGE_DAYS.map((d) => `<button type="button" class="hbm-pill ${hb.days === d ? 'on' : ''}" data-action="hbm-days" data-d="${d}">${d} dias</button>`).join('')}</div>
      <small class="hbm-note">Começa ${hb.start === today() ? 'hoje' : parseISO(hb.start).toLocaleDateString('pt-BR')} e termina em ${parseISO(addDays(hb.days - 1, hb.start)).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}.</small>` : ''}
    <div class="hbm-label">Frequência</div>
    <div class="hbm-grid three">
      ${opt(hb.freq === 'daily', 'data-action="hbm-freq" data-v="daily"', 'Todo dia', '7 dias / semana')}
      ${opt(hb.freq === 'weekdays', 'data-action="hbm-freq" data-v="weekdays"', 'Dias úteis', 'Segunda a sexta')}
      ${opt(hb.freq === 'times', 'data-action="hbm-freq" data-v="times"', 'Vezes na semana', hb.freq === 'times' ? `${hb.target}x por semana` : 'Você escolhe quantas')}
    </div>
    ${hb.freq === 'times' ? `<div class="hbm-chips">${[1, 2, 3, 4, 5, 6].map((n) => `<button type="button" class="hbm-pill ${hb.target === n ? 'on' : ''}" data-action="hbm-target" data-n="${n}">${n}x</button>`).join('')}</div>` : ''}
    <div class="hbm-label">${icon('clock')}Tempo por dia (opcional)</div>
    <div class="hbm-chips">${MINUTES.map((m) => `<button type="button" class="hbm-pill ${hb.minutes === m ? 'on' : ''}" data-action="hbm-min" data-m="${m}">${m ? m + ' min' : 'Sem tempo'}</button>`).join('')}</div>
    <label class="hbm-label" for="hbm-goal">${icon('target')}Vincular a uma meta (opcional)</label>
    <div class="hbm-select"><select id="hbm-goal" data-change="hbm-goal"><option value="">${goals.length ? 'Nenhuma meta associada' : 'Você ainda não tem metas'}</option>${goals.map((g) => `<option value="${g.id}" ${hb.goal === g.id ? 'selected' : ''}>${esc(g.title)}</option>`).join('')}</select>${icon('chevD')}</div>`}
    <div class="hbm-label">Cor de destaque</div>
    <div class="hbm-colors">${HABIT_COLORS.map((c) => `<button type="button" class="${hb.color === c ? 'on' : ''}" style="--c:${c}" data-action="hbm-color" data-c="${c}" aria-label="Cor ${c}">${icon('check')}</button>`).join('')}</div>
    ${preview()}`;
}

function shell() {
  const c = hb.color || HABIT_COLORS[9];
  return `<div class="modal hbm" role="dialog" aria-label="${hb.id ? 'Editar hábito' : 'Novo hábito'}">
    <div class="hbm-scroll" id="hbm-scroll">
      <div class="hbm-head"><span class="hbm-ico" style="--c:${c}">${icon('repeat')}</span><div><h3>${hb.id ? 'Editar hábito' : 'Novo hábito'}</h3><p>Pequenas repetições, todo dia, mudam a semana inteira.</p></div>
        <button type="button" class="icon-btn" data-action="close-overlay" aria-label="Fechar">${icon('x')}</button></div>
      <div class="hbm-body">${body()}</div>
    </div>
    <div class="hbm-foot">
      ${hb.id ? `<button type="button" class="btn danger" data-action="hbm-delete">${icon('trash')}Excluir</button>` : ''}
      <span class="spacer"></span>
      <button type="button" class="btn ghost" data-action="close-overlay">Cancelar</button>
      <button type="button" class="hbm-save" data-action="hbm-save" ${hb.name.trim() ? '' : 'disabled'}>${icon('check')}${hb.id ? 'Salvar' : hb.group ? 'Criar grupo' : 'Criar hábito'}</button>
    </div></div>`;
}

function render(focusId) {
  const m = document.querySelector('.hbm');
  if (!m) return;
  const top = document.getElementById('hbm-scroll').scrollTop;
  const a = document.activeElement;
  const fid = focusId || a?.id;
  const sel = a && 'selectionStart' in a && a.type === 'text' ? [a.selectionStart, a.selectionEnd] : null;
  m.outerHTML = shell();
  document.getElementById('hbm-scroll').scrollTop = top;
  const el = fid && document.getElementById(fid);
  if (el) { el.focus({ preventScroll: true }); if (sel && el.setSelectionRange) el.setSelectionRange(...sel); }
}

export function openHabitModal(defaults = {}, id = null) {
  const h = id ? find('habits', id) : null;
  hb = {
    id: h?.id || null, name: h?.name || defaults.name || '', emoji: h?.emoji || '✨', group: !!h?.group, parent: h?.parent || defaults.parent || '',
    mode: h?.mode || 'continuous', days: h?.days || 21, start: h?.start || today(),
    freq: h?.freq || (h && h.target && h.target < 7 ? 'times' : 'daily'), target: h?.target && h.target < 7 ? h.target : 3,
    minutes: h?.minutes || 0, goal: h?.goal || '', color: h?.color || HABIT_COLORS[9], emojiOpen: false,
  };
  openOverlay(shell(), (bd) => { bd.classList.add('hbm-backdrop'); bd.querySelector('#hbm-name')?.focus(); });
}
formHooks.habits = openHabitModal;

// ---------- Ações ----------
on('hbm-name', (ds, el) => {
  hb.name = el.value;
  const b = document.querySelector('.hbm-save'); if (b) b.disabled = !el.value.trim();
  const p = document.querySelector('.hbm-prev-txt b'); if (p) p.textContent = el.value.trim() || 'Nome do seu hábito';
});
on('hbm-sugg', (ds) => {
  const s = SUGGESTIONS[+ds.i];
  Object.assign(hb, { name: s.name, emoji: s.emoji, mode: s.mode || 'continuous', days: s.days || 21, start: today(), freq: s.freq || 'daily', target: s.target || 3, minutes: s.minutes || 0, group: false });
  render('hbm-name');
});
on('hbm-emoji-open', () => { hb.emojiOpen = !hb.emojiOpen; render(); });
on('hbm-emoji', (ds) => { hb.emoji = ds.e; hb.emojiOpen = false; render(); });
on('hbm-group', (ds, el) => { hb.group = el.checked; if (hb.group && hb.emoji === '✨') hb.emoji = '📁'; render(); });
on('hbm-parent', (ds, el) => { hb.parent = el.value; });
on('hbm-mode', (ds) => { hb.mode = ds.v; if (ds.v === 'challenge' && !hb.id) hb.start = today(); render(); });
on('hbm-days', (ds) => { hb.days = +ds.d; render(); });
on('hbm-freq', (ds) => { hb.freq = ds.v; render(); });
on('hbm-target', (ds) => { hb.target = +ds.n; render(); });
on('hbm-min', (ds) => { hb.minutes = +ds.m; render(); });
on('hbm-goal', (ds, el) => { hb.goal = el.value; });
on('hbm-color', (ds) => { hb.color = ds.c; render(); });

on('hbm-save', () => {
  const name = hb.name.trim();
  if (!name) { document.getElementById('hbm-name')?.focus(); return; }
  const target = hb.freq === 'times' ? hb.target : hb.freq === 'weekdays' ? 5 : 7;
  const obj = hb.group
    ? { name, emoji: hb.emoji, color: hb.color, group: true }
    : {
      name, emoji: hb.emoji, color: hb.color, group: false, parent: hb.parent || null, mode: hb.mode, freq: hb.freq, target,
      minutes: hb.minutes || 0, goal: hb.goal || null,
      ...(hb.mode === 'challenge' ? { days: hb.days, start: hb.start } : { days: null }),
    };
  if (hb.id) obj.id = hb.id; else obj.log = {};
  upsert('habits', obj);
  closeOverlay();
  toast(hb.id ? 'Hábito atualizado' : hb.group ? `Grupo “${name}” criado` : hb.mode === 'challenge' ? `Desafio de ${hb.days} dias começou` : 'Hábito criado');
  hb = null;
});
on('hbm-delete', async () => {
  const h = find('habits', hb.id);
  if (!h) return;
  closeOverlay();
  const kids = items('habits').filter((x) => x.parent === h.id);
  if (await confirmDialog(`Excluir ${h.group ? 'grupo' : 'hábito'}?`, h.group && kids.length ? `Os ${kids.length} hábitos dentro dele continuam, só que fora do grupo.` : 'O histórico de dias marcados também será apagado.')) {
    kids.forEach((k) => upsert('habits', { id: k.id, parent: null }));
    remove('habits', h.id);
    toast('Excluído');
  }
});
