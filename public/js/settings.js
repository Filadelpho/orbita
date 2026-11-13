// Configurações do ORBITA: 9 abas (Conta, Aparência, Navegação, Módulos, Notificações,
// Idioma e região, Integrações, Atalhos, App), busca de configurações, temas, atalhos e lembretes.
import { state, save, seed, items, today, addDays } from './store.js';
import { escapeHtml as esc, setCurrency, COLLECTIONS } from './collections.js';
import { icon, LOGO } from './icons.js';
import { ui, on, bus, openOverlay, closeOverlay, overlayOpen, toast, confirmDialog, openForm, initials, cap } from './ui.js';
import { PAGES, MODULE_INFO, moduleOn, go, integrationsBody, openCaptureModal } from './views.js';
import { COVERS, COVER_KEYS } from './pixels.js';
import { openCoverPicker, UNSPLASH } from './cover.js';

export const APP_VERSION = '0.3.0';

// ---------- Utilidades ----------
const getPath = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
function setPath(obj, path, value) {
  const keys = path.split('.');
  let o = obj;
  keys.slice(0, -1).forEach((k) => { if (typeof o[k] !== 'object' || o[k] === null) o[k] = {}; o = o[k]; });
  o[keys.at(-1)] = value;
}
const S = () => state.settings;
const cfg = (path, fallback) => { const v = getPath(S(), path); return v === undefined ? fallback : v; };

const sec = (id, ico, title, sub, body) => `
  <section class="set-sec" id="${id}"><header class="set-sec-head">${icon(ico)}<h2>${title}</h2></header>${sub ? `<p class="set-sec-sub">${sub}</p>` : ''}${body}</section>`;
const row = (title, sub, control, extra = '') => `<div class="set-row ${extra}"><div class="txt"><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</div><div class="ctl">${control}</div></div>`;
const toggle = (path, on, attrs = '') => `<label class="switch"><input type="checkbox" data-change="set-toggle" data-k="${path}" ${on ? 'checked' : ''} ${attrs}><span></span></label>`;
const timeInput = (path, v) => `<input class="input set-time" type="time" value="${esc(v)}" data-change="set-value" data-k="${path}">`;
const label = (t, right = '') => `<div class="set-label"><span>${t}</span>${right}</div>`;

// ---------- Temas ----------
const mq = matchMedia('(prefers-color-scheme: light)');
export const THEMES = {
  system: { name: 'Automático', desc: 'Claro ou escuro, igual ao sistema', icon: 'monitor', base: 'system' },
  dark: { name: 'Escuro', desc: 'Sólido e focado', icon: 'moon', base: 'dark', p: ['#000000', '#111113', '#0a84ff'] },
  light: { name: 'Claro', desc: 'Para ambientes iluminados', icon: 'sun', base: 'light', p: ['#f5f5f7', '#ffffff', '#0071e3'] },
  grafite: { name: 'Grafite', desc: 'Preto puro e destaque branco', base: 'dark', p: ['#000000', '#0e0e0e', '#ffffff'],
    vars: { bg: '#000', 'bg-2': '#050505', surface: '#0e0e0e', 'surface-2': '#171717', 'surface-3': '#232323', accent: '#f4f4f5', 'accent-2': '#d4d4d8', 'on-accent': '#09090b' } },
  aurora: { name: 'Aurora', desc: 'Azul-petróleo e verde-água', base: 'dark', p: ['#04131a', '#0a1f27', '#2dd4bf'],
    vars: { bg: '#04131a', 'bg-2': '#061920', surface: '#0a1f27', 'surface-2': '#0f2a33', 'surface-3': '#15363f', accent: '#2dd4bf', 'accent-2': '#5eead4', 'on-accent': '#042f2e' } },
  ambar: { name: 'Âmbar', desc: 'Marrom quente e laranja', base: 'dark', p: ['#140c06', '#1d130b', '#f59e0b'],
    vars: { bg: '#140c06', 'bg-2': '#170e07', surface: '#1d130b', 'surface-2': '#271a10', 'surface-3': '#332216', accent: '#f59e0b', 'accent-2': '#fbbf24', 'on-accent': '#1c1006' } },
  floresta: { name: 'Floresta', desc: 'Verde-musgo escuro e verde-limão', base: 'dark', p: ['#08110a', '#0f1a11', '#a3e635'],
    vars: { bg: '#08110a', 'bg-2': '#0a140c', surface: '#0f1a11', 'surface-2': '#152418', 'surface-3': '#1d2f20', accent: '#a3e635', 'accent-2': '#bef264', 'on-accent': '#13200a' } },
  vinho: { name: 'Vinho', desc: 'Bordô quase preto e rosé', base: 'dark', p: ['#12070a', '#1c0c11', '#f4a3b4'],
    vars: { bg: '#12070a', 'bg-2': '#15080c', surface: '#1c0c11', 'surface-2': '#261218', 'surface-3': '#321820', accent: '#f4a3b4', 'accent-2': '#fb7185', 'on-accent': '#2a0d14' } },
  papel: { name: 'Papel', desc: 'Claro e quente, terracota', base: 'light', p: ['#f6f1e9', '#fffdf8', '#c2410c'],
    vars: { bg: '#f6f1e9', 'bg-2': '#efe7db', surface: '#fffdf8', 'surface-2': '#f3ece1', 'surface-3': '#e8dfd1', text: '#2b2118', 'text-2': '#4a3d31', muted: '#8a7b6c', accent: '#c2410c', 'accent-2': '#ea580c' } },
  nevoa: { name: 'Névoa', desc: 'Claro, cinza-azulado e vidro leve', base: 'light', p: ['#eef2f6', '#ffffff', '#4f6d8f'],
    vars: { bg: '#eef2f6', 'bg-2': '#e5eaf0', surface: 'rgba(255,255,255,.82)', 'surface-2': '#e6ebf1', 'surface-3': '#d9e0e8', text: '#1e293b', 'text-2': '#334155', muted: '#64748b', accent: '#4f6d8f', 'accent-2': '#6b8aad' } },
  salvia: { name: 'Sálvia', desc: 'Claro, verde-acinzentado e oliva', base: 'light', p: ['#eef1ea', '#fbfcf9', '#65743a'],
    vars: { bg: '#eef1ea', 'bg-2': '#e6eae1', surface: '#fbfcf9', 'surface-2': '#e5eadf', 'surface-3': '#d8dfd0', text: '#23291c', 'text-2': '#3b4430', muted: '#6f7a63', accent: '#65743a', 'accent-2': '#7d8f48' } },
  areia: { name: 'Areia', desc: 'Claro, bege quente e caramelo', base: 'light', p: ['#f5efe4', '#fffaf2', '#b7791f'],
    vars: { bg: '#f5efe4', 'bg-2': '#efe6d8', surface: '#fffaf2', 'surface-2': '#efe5d4', 'surface-3': '#e3d6c0', text: '#2e2416', 'text-2': '#4d3f2b', muted: '#8b7a62', accent: '#b7791f', 'accent-2': '#d69e2e' } },
  ceu: { name: 'Céu', desc: 'Claro, azul arejado', base: 'light', p: ['#eef6fd', '#ffffff', '#0284c7'],
    vars: { bg: '#eef6fd', 'bg-2': '#e4f0fb', surface: '#ffffff', 'surface-2': '#e3eef9', 'surface-3': '#d3e3f3', text: '#0c2236', 'text-2': '#24405a', muted: '#5d7790', accent: '#0284c7', 'accent-2': '#0ea5e9' } },
  petala: { name: 'Pétala', desc: 'Claro, rosado suave', base: 'light', p: ['#fbf0f3', '#ffffff', '#db2777'],
    vars: { bg: '#fbf0f3', 'bg-2': '#f7e6eb', surface: '#ffffff', 'surface-2': '#f6e4ea', 'surface-3': '#eed3dc', text: '#331520', 'text-2': '#552c3a', muted: '#93697a', accent: '#db2777', 'accent-2': '#ec4899' } },
  lavanda: { name: 'Lavanda', desc: 'Claro, lilás e roxo suave', base: 'light', p: ['#f4f1fb', '#ffffff', '#7c3aed'],
    vars: { bg: '#f4f1fb', 'bg-2': '#ece7f8', surface: '#ffffff', 'surface-2': '#ebe5f7', 'surface-3': '#ddd4f0', text: '#22183a', 'text-2': '#3d3060', muted: '#7a6f99', accent: '#7c3aed', 'accent-2': '#8b5cf6' } },
  contraste: { name: 'Alto contraste', desc: 'Branco, preto e azul forte para ler melhor', icon: 'eye', base: 'light', p: ['#ffffff', '#ffffff', '#0039d6'],
    vars: { bg: '#ffffff', 'bg-2': '#ffffff', surface: '#ffffff', 'surface-2': '#f0f0f0', 'surface-3': '#d0d0d0', border: 'rgba(0,0,0,.55)', 'border-strong': '#000', text: '#000', 'text-2': '#000', muted: '#333', accent: '#0039d6', 'accent-2': '#0039d6' } },
};
const VAR_KEYS = ['bg', 'bg-2', 'surface', 'surface-2', 'surface-3', 'border', 'border-strong', 'text', 'text-2', 'muted', 'accent', 'accent-2', 'accent-soft', 'on-accent', 'glass',
  'success', 'success-soft', 'danger', 'danger-soft', 'warning', 'warning-soft', 'purple', 'font', 'logo-ring', 'logo-core', 'logo-moon', 'page-zoom'];

export const FONTS = ['Geist', 'Inter', 'Manrope', 'Plus Jakarta Sans', 'IBM Plex Sans', 'JetBrains Mono', 'DM Sans', 'Outfit', 'Lexend', 'Space Grotesk'];
const FONT_LABEL = { 'Plus Jakarta Sans': 'Plus Jakarta', 'IBM Plex Sans': 'IBM Plex' };
const loadedFonts = new Set(['DM Sans']);
function loadFonts(list) {
  const need = list.filter((f) => !loadedFonts.has(f));
  if (!need.length) return;
  need.forEach((f) => loadedFonts.add(f));
  const fam = need.map((f) => `family=${f.replace(/ /g, '+')}:wght@300;400;500;600;700`).join('&');
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = `https://fonts.googleapis.com/css2?${fam}&display=swap`;
  document.head.appendChild(l);
}

export const SWATCHES = {
  azul: ['Azul', '#0a84ff'], celeste: ['Celeste', '#5ac8fa'], branco: ['Branco', '#ffffff'], roxo: ['Roxo', '#8b5cf6'], dourado: ['Dourado', '#f5c542'],
  limao: ['Verde-limão', '#a3e635'], laranja: ['Laranja', '#ff9f0a'], rosa: ['Rosa', '#ff375f'], cinza: ['Cinza', '#8e8e93'], preto: ['Preto', '#0a0a0a'],
};
const LOGO_DEFAULT = { ring: 'azul', core: 'branco', moon: 'celeste' };

export const APP_ICONS = {
  padrao: { name: 'Padrão', bg: '#000000', ring: '#0a84ff', core: '#ffffff', moon: '#5ac8fa' },
  claro: { name: 'Claro', bg: '#ffffff', ring: '#0a84ff', core: '#0a0a0a', moon: '#5ac8fa' },
  mono: { name: 'Mono', bg: '#000000', ring: '#ffffff', core: '#ffffff', moon: '#8e8e93' },
  monoclaro: { name: 'Mono claro', bg: '#ffffff', ring: '#0a0a0a', core: '#0a0a0a', moon: '#8e8e93' },
  oceano: { name: 'Oceano', bg: '#06245a', ring: '#5ac8fa', core: '#ffffff', moon: '#a5f3fc' },
  aurora: { name: 'Aurora', bg: '#04131a', ring: '#2dd4bf', core: '#ffffff', moon: '#a3e635' },
  volt: { name: 'Volt', bg: '#0a0a0a', ring: '#a3e635', core: '#ffffff', moon: '#a3e635' },
  chama: { name: 'Chama', bg: '#1c0a04', ring: '#ff9f0a', core: '#ffffff', moon: '#ff375f' },
  logo: { name: 'Cores da logo' },
};
const iconSvg = (k) => {
  let c = APP_ICONS[k] || APP_ICONS.padrao;
  if (k === 'logo') {
    const L = { ...LOGO_DEFAULT, ...cfg('logo', {}) };
    c = { bg: '#000000', ring: SWATCHES[L.ring][1], core: SWATCHES[L.core][1], moon: SWATCHES[L.moon][1] };
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${c.bg}"/><ellipse cx="32" cy="32" rx="22" ry="9" fill="none" stroke="${c.ring}" stroke-width="3.5" transform="rotate(-28 32 32)"/><circle cx="32" cy="32" r="8.5" fill="${c.core}"/><circle cx="50.8" cy="22" r="3.8" fill="${c.moon}"/></svg>`;
};

const hsl = (h, s, l, a = 1) => `hsl(${h} ${s}% ${l}% / ${a})`;

// Aplica tema, destaque, fonte, cores, logo, ícone, tamanho, moeda.
export function applyAppearance() {
  const s = S();
  const root = document.documentElement;
  const key = THEMES[s.theme] ? s.theme : 'dark';
  const T = THEMES[key];
  const base = T.base === 'system' ? (mq.matches ? 'light' : 'dark') : T.base;
  root.dataset.theme = base;
  VAR_KEYS.forEach((k) => root.style.removeProperty('--' + k));
  const set = (k, v) => root.style.setProperty('--' + k, v);
  Object.entries(T.vars || {}).forEach(([k, v]) => set(k, v));

  const ac = s.accent;
  if (ac?.type === 'hue') {
    set('accent', hsl(ac.h, 90, base === 'dark' ? 58 : 45));
    set('accent-2', hsl((ac.h + 18) % 360, 90, base === 'dark' ? 68 : 52));
    set('on-accent', '#fff');
  } else if (ac?.type === 'white') { set('accent', '#f4f4f5'); set('accent-2', '#d4d4d8'); set('on-accent', '#09090b'); }
  else if (ac?.type === 'black') { set('accent', base === 'dark' ? '#3f3f46' : '#0a0a0a'); set('accent-2', '#52525b'); set('on-accent', '#fff'); }
  if (T.vars || ac) set('accent-soft', 'color-mix(in srgb, var(--accent) 16%, transparent)');
  if (T.vars?.bg) set('glass', 'color-mix(in srgb, var(--bg) 78%, transparent)');

  if (s.colors === 'one') {
    ['success', 'danger', 'warning', 'purple'].forEach((k) => set(k, 'var(--accent)'));
    ['success-soft', 'danger-soft', 'warning-soft'].forEach((k) => set(k, 'var(--accent-soft)'));
  } else if (s.colors === 'mono') {
    ['success', 'danger', 'warning', 'purple'].forEach((k) => set(k, 'var(--text-2)'));
    ['success-soft', 'danger-soft', 'warning-soft'].forEach((k) => set(k, 'var(--surface-3)'));
    set('accent', 'var(--text)'); set('accent-2', 'var(--text-2)'); set('on-accent', 'var(--bg)');
    set('accent-soft', 'color-mix(in srgb, var(--text) 12%, transparent)');
  }
  root.dataset.colors = s.colors || 'color';

  const font = FONTS.includes(s.font) ? s.font : 'DM Sans';
  loadFonts([font]);
  set('font', `"${font}", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`);

  const L = { ...LOGO_DEFAULT, ...(s.logo || {}) };
  set('logo-ring', SWATCHES[L.ring]?.[1] || '#0a84ff');
  set('logo-core', SWATCHES[L.core]?.[1] || '#fff');
  set('logo-moon', SWATCHES[L.moon]?.[1] || '#5ac8fa');

  const fav = document.querySelector('link[rel=icon]');
  const href = 'data:image/svg+xml,' + encodeURIComponent(iconSvg(s.appIcon || 'padrao'));
  if (fav && fav.href !== href) fav.href = href;

  root.style.zoom = (s.uiScale || 100) === 100 ? '' : String(s.uiScale / 100);
  if ((s.textScale || 100) !== 100) set('page-zoom', String(s.textScale / 100));

  setCurrency(s.currency || 'BRL');
  const meta = document.querySelector('meta[name=theme-color]');
  if (meta) meta.content = T.vars?.bg || (base === 'light' ? '#f5f5f7' : '#000000');
}
mq.addEventListener?.('change', () => { if (S().theme === 'system') applyAppearance(); });

// ---------- Navegação: dock e botão + ----------
export const DOCK_DEFAULT = ['dashboard', 'tasks', 'calendar', 'habits', 'finance', 'ai'];
export const DOCK_MAX = 8;
export function dockPages() {
  const ids = (cfg('dock', DOCK_DEFAULT) || DOCK_DEFAULT);
  return ids.map((id) => PAGES.find((p) => p.id === id)).filter((p) => p && moduleOn(p.module));
}

export const PLUS_ITEMS = {
  task: { label: 'Tarefa', icon: 'check', module: 'tasks', run: () => openForm('tasks') },
  event: { label: 'Compromisso', icon: 'calendar', module: 'calendar', run: () => openForm('events') },
  money: { label: 'Gasto ou receita', icon: 'wallet', module: 'finance', run: () => openForm('transactions') },
  note: { label: 'Nota', icon: 'edit', run: () => openCapture('note') },
  focus: { label: 'Foco', icon: 'clock', run: () => { go('dashboard'); setTimeout(() => document.querySelector('[data-action=focus-start]')?.click(), 60); } },
  ai: { label: 'Perguntar à IA', icon: 'spark', module: 'ai', run: () => go('ai') },
  habit: { label: 'Hábito', icon: 'repeat', module: 'habits', run: () => openForm('habits') },
  goal: { label: 'Meta', icon: 'target', module: 'goals', run: () => openForm('goals') },
  journal: { label: 'Diário', icon: 'pen', module: 'health', run: () => openForm('journal') },
  workout: { label: 'Treino', icon: 'dumbbell', module: 'health', run: () => openForm('workouts') },
  post: { label: 'Conteúdo', icon: 'pen', module: 'content', run: () => openForm('posts') },
  study: { label: 'Estudo', icon: 'grad', module: 'studies', run: () => openForm('studies') },
};
export const PLUS_DEFAULT = ['task', 'event', 'money', 'note', 'focus', 'ai', 'habit', 'goal', 'journal', 'workout', 'post', 'study'];
const plusOrder = () => {
  const order = cfg('plus.order', PLUS_DEFAULT);
  return [...order, ...PLUS_DEFAULT.filter((k) => !order.includes(k))];
};
const plusOn = (k) => !(cfg('plus.off', []) || []).includes(k);

export function quickAddMenu() {
  const opts = plusOrder().filter((k) => plusOn(k) && moduleOn(PLUS_ITEMS[k].module));
  openOverlay(`<div class="modal"><div class="modal-head"><h3>Adicionar rapidamente</h3><button class="icon-btn" data-action="close-overlay" aria-label="Fechar">${icon('x')}</button></div>
    <div class="plus-grid">${opts.map((k) => `
      <button class="module-pick" data-action="plus-run" data-k="${k}"><span class="ico">${icon(PLUS_ITEMS[k].icon)}</span><span>${PLUS_ITEMS[k].label}</span></button>`).join('') || '<p class="muted">Nenhum atalho ligado. Escolha em Configurações › Navegação.</p>'}</div></div>`);
}
on('quick-add', quickAddMenu);
on('plus-run', (ds) => { closeOverlay(); PLUS_ITEMS[ds.k]?.run(); });

export function openCapture(mode = 'task') {
  ui.capMode = mode;
  if (S().dashStyle === 'none') { openCaptureModal(); return; }
  if (ui.route !== 'dashboard') go('dashboard');
  else bus.render();
  setTimeout(() => { const t = document.getElementById('cap-text'); t?.focus(); t?.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 80);
}

// ---------- Atalhos ----------
export const SHORTCUTS = [
  { group: 'Ações globais', items: [
    ['palette', 'Paleta de comandos', 'Abre a busca e a navegação rápida por todo o ORBITA', 'Mod+K'],
    ['capture', 'Captura rápida global', 'Abre a captura de notas e tarefas de qualquer lugar', 'Mod+J'],
    ['captureDirect', 'Captura rápida direta', 'Abre a captura com uma só tecla quando você não está digitando', 'C'],
    ['add', 'Adicionar', 'Abre o menu do botão +', 'N'],
    ['newTask', 'Nova tarefa', 'Abre o formulário de tarefa', 'T'],
    ['goPrefix', 'Prefixo de salto de módulo', 'Primeira tecla antes da letra do módulo', 'G'],
  ] },
  { group: 'Navegação rápida por módulos', note: 'Pressione a tecla de salto e, em seguida, a letra do módulo.', prefix: true, items: [
    ['go.dashboard', 'Início', '', 'D'], ['go.tasks', 'Tarefas', '', 'T'], ['go.calendar', 'Calendário', '', 'C'], ['go.habits', 'Hábitos', '', 'H'],
    ['go.goals', 'Metas', '', 'M'], ['go.finance', 'Finanças', '', 'F'], ['go.health', 'Saúde', '', 'S'], ['go.ai', 'ORBITA AI', '', 'A'], ['go.settings', 'Configurações', '', 'O'],
  ] },
];
const SC_DEFAULTS = Object.fromEntries(SHORTCUTS.flatMap((g) => g.items.map(([k, , , d]) => [k, d])));
const sc = (k) => cfg('shortcuts', {})?.[k] || SC_DEFAULTS[k];
const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
function keyString(e) {
  const k = e.key.length === 1 ? e.key.toUpperCase() : e.key;
  if (['Control', 'Meta', 'Shift', 'Alt'].includes(k)) return null;
  return [(e.ctrlKey || e.metaKey) && 'Mod', e.altKey && 'Alt', e.shiftKey && e.key.length > 1 && 'Shift', k].filter(Boolean).join('+');
}
const keycaps = (str) => str.split('+').map((p) => `<kbd>${p === 'Mod' ? (isMac ? '⌘' : 'Ctrl') : p === 'Shift' ? '⇧' : p === 'Enter' ? '↵' : p === 'Escape' ? 'Esc' : esc(p)}</kbd>`).join('');

export const hooks = { palette: null, closeAll: null };
let goPending = 0;
export function handleShortcut(e) {
  if (ui.recording) {
    e.preventDefault(); e.stopPropagation();
    if (e.key === 'Escape') { ui.recording = null; bus.render(); return true; }
    const ks = keyString(e);
    if (!ks) return true;
    const map = { ...(S().shortcuts || {}) };
    map[ui.recording] = ks;
    S().shortcuts = map;
    ui.recording = null;
    save();
    toast(`Atalho definido: ${ks.replace('Mod', isMac ? '⌘' : 'Ctrl')}`);
    return true;
  }
  const ks = keyString(e);
  if (!ks) return false;
  if (ks === sc('palette')) { e.preventDefault(); overlayOpen() ? closeOverlay() : hooks.palette?.(); return true; }
  if (ks === sc('capture')) { e.preventDefault(); closeOverlay(); openCapture('task'); return true; }
  const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
  if (typing || overlayOpen() || e.ctrlKey || e.metaKey || e.altKey) return false;
  if (goPending && Date.now() - goPending < 1500) {
    goPending = 0;
    const hit = SHORTCUTS[1].items.find(([k]) => sc(k) === ks);
    if (hit) { e.preventDefault(); const id = hit[0].split('.')[1]; go(id); return true; }
    return false;
  }
  if (ks === sc('goPrefix')) { goPending = Date.now(); e.preventDefault(); return true; }
  if (ks === '/') { e.preventDefault(); hooks.palette?.(); return true; }
  if (ks === sc('captureDirect')) { e.preventDefault(); openCapture('task'); return true; }
  if (ks === sc('add')) { e.preventDefault(); quickAddMenu(); return true; }
  if (ks === sc('newTask')) { e.preventDefault(); openForm('tasks'); return true; }
  return false;
}

// ---------- Avisos e lembretes ----------
const NOTIF_DEFAULT = {
  device: false, sound: true,
  morning: { on: true, time: '07:30' }, evening: { on: false, time: '21:00' },
  weekly: { on: true, day: 0, time: '19:00' }, workout: { on: false, time: '18:00' },
  bills: { on: true, days: 3 }, habits: { on: true, time: '20:00' },
  quiet: { on: true, from: '22:00', to: '07:00' },
};
const nc = (path) => { const v = getPath(S().notif || {}, path); return v === undefined ? getPath(NOTIF_DEFAULT, path) : v; };
const LOG_KEY = 'orbita:notif-log';
const readLog = () => { try { return JSON.parse(localStorage.getItem(LOG_KEY)) || {}; } catch { return {}; } };
const writeLog = (l) => { try { localStorage.setItem(LOG_KEY, JSON.stringify(l)); } catch { /* sem espaço */ } };

let audioCtx = null;
export function playSound() {
  try {
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    const t = audioCtx.currentTime;
    [880, 1320].forEach((f, i) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t + i * 0.12);
      g.gain.exponentialRampToValueAtTime(0.18, t + i * 0.12 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.12 + 0.25);
      o.connect(g).connect(audioCtx.destination);
      o.start(t + i * 0.12); o.stop(t + i * 0.12 + 0.3);
    });
  } catch { /* sem áudio */ }
}
async function notify(title, body) {
  if (nc('sound') && document.visibilityState === 'visible') playSound();
  if (nc('device') && 'Notification' in window && Notification.permission === 'granted') {
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      if (reg) return reg.showNotification(title, { body, icon: 'icon.svg', badge: 'icon.svg' });
      new Notification(title, { body, icon: 'icon.svg' });
      return;
    } catch { /* cai no aviso da tela */ }
  }
  toast(`${title}: ${body}`);
}
const hm = (d = new Date()) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
function inQuiet(now) {
  if (!nc('quiet.on')) return false;
  const f = nc('quiet.from'), t = nc('quiet.to');
  return f <= t ? now >= f && now < t : now >= f || now < t;
}
function reminders() {
  const T = today();
  const tasks = items('tasks').filter((t) => !t.done);
  const todayTasks = tasks.filter((t) => t.due && t.due <= T).length;
  const events = items('events').filter((e) => e.date === T).length;
  return [
    { id: 'morning', on: nc('morning.on'), time: nc('morning.time'), title: 'Bom dia ☀️', body: () => `Hoje você tem ${todayTasks} tarefa(s) e ${events} compromisso(s).` },
    { id: 'evening', on: nc('evening.on'), time: nc('evening.time'), title: 'Boa noite 🌙', body: () => {
      const done = items('tasks').filter((t) => t.done && t.due === T).length;
      const tomorrow = tasks.filter((t) => t.due === addDays(1)).length;
      return `Você concluiu ${done} tarefa(s) hoje. Amanhã tem ${tomorrow}.`; } },
    { id: 'weekly', on: nc('weekly.on') && new Date().getDay() === +nc('weekly.day'), time: nc('weekly.time'), title: 'Revisão da semana', body: () => 'Que tal revisar a semana e escolher as prioridades da próxima?' },
    { id: 'workout', on: nc('workout.on') && moduleOn('health') && !items('workouts').some((w) => w.date === T), time: nc('workout.time'), title: 'Hora do treino 💪', body: () => 'Você ainda não registrou um treino hoje.' },
    { id: 'habits', on: nc('habits.on') && moduleOn('habits'), time: nc('habits.time'), title: 'Hábitos de hoje', body: () => {
      const pend = items('habits').filter((h) => !h.log?.[T]).length;
      return pend ? `Faltam ${pend} hábito(s) para fechar o dia.` : null; } },
    { id: 'bills', on: nc('bills.on') && moduleOn('finance'), time: '09:00', title: 'Contas a vencer', body: () => {
      const lim = addDays(+nc('bills.days'));
      const due = items('bills').filter((b) => !b.paid && b.due && b.due >= T && b.due <= lim);
      return due.length ? `${due.length} conta(s) vencem até ${lim.split('-').reverse().slice(0, 2).join('/')}.` : null; } },
  ];
}
function checkReminders() {
  if (!state.user || !state.onboarded) return;
  const now = hm();
  if (inQuiet(now)) return;
  const log = readLog();
  const T = today();
  let changed = false;
  reminders().forEach((r) => {
    if (!r.on || now < r.time || log[r.id] === T) return;
    log[r.id] = T; changed = true;
    const body = r.body();
    if (body) notify(r.title, body);
  });
  if (changed) writeLog(log);
}
setInterval(checkReminders, 30000);
setTimeout(checkReminders, 4000);

// ---------- App instalável ----------
let installEvt = null;
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; if (ui.route === 'settings') bus.render(); });
addEventListener('appinstalled', () => { installEvt = null; toast('ORBITA instalado'); if (ui.route === 'settings') bus.render(); });
addEventListener('online', () => ui.route === 'settings' && bus.render());
addEventListener('offline', () => ui.route === 'settings' && bus.render());

// ---------- Abas ----------
export const CATS = [
  { id: 'conta', label: 'Conta', icon: 'user' },
  { id: 'aparencia', label: 'Aparência', icon: 'palette' },
  { id: 'navegacao', label: 'Navegação', icon: 'layout' },
  { id: 'modulos', label: 'Módulos', icon: 'grid' },
  { id: 'notificacoes', label: 'Notificações', icon: 'bell' },
  { id: 'idioma', label: 'Idioma e região', icon: 'globe' },
  { id: 'integracoes', label: 'Integrações', icon: 'plug' },
  { id: 'atalhos', label: 'Atalhos', icon: 'keyboard' },
  { id: 'app', label: 'App', icon: 'phone' },
];

// Índice da busca: [texto, palavras-chave, aba, seção]
const INDEX = [
  ['Perfil', 'nome email foto avatar', 'conta', 's-perfil'], ['Foto de perfil', 'avatar imagem enviar foto', 'conta', 's-perfil'],
  ['Plano', 'assinatura gratuito pago', 'conta', 's-plano'], ['Segurança', 'senha login google apple', 'conta', 's-seguranca'],
  ['Verificação em duas etapas', '2fa dois fatores codigo', 'conta', 's-seguranca'], ['Trocar senha', 'senha password', 'conta', 's-seguranca'],
  ['Aparelhos conectados', 'sessao dispositivo navegador', 'conta', 's-aparelhos'], ['Sair', 'logout desconectar', 'conta', 's-sessao'],
  ['Excluir minha conta', 'apagar deletar conta', 'conta', 's-sessao'], ['Backup e dados', 'exportar importar json csv backup recomecar exemplo', 'conta', 's-dados'],
  ['Tema', 'escuro claro automatico cores aurora grafite papel', 'aparencia', 's-tema'], ['Cor da logo', 'logo anel planeta satelite', 'aparencia', 's-logo'],
  ['Cor de destaque', 'destaque accent cor botao', 'aparencia', 's-logo'], ['Fonte', 'tipografia letra fonte', 'aparencia', 's-fonte'],
  ['Cores do sistema', 'colorido monocromatico uma cor', 'aparencia', 's-cores'], ['Ícone do app', 'favicon icone aba', 'aparencia', 's-icone'],
  ['Tamanho', 'zoom tamanho texto interface', 'aparencia', 's-tamanho'], ['Relógio do foco', 'foco pomodoro relogio cronometro', 'aparencia', 's-relogio'],
  ['Barra lateral ou dock', 'menu lateral dock navegacao', 'navegacao', 's-nav'], ['Módulos na dock', 'fixar dock ordem', 'navegacao', 's-dock'],
  ['Botão +', 'adicionar atalhos mais', 'navegacao', 's-plus'], ['Capa do Início', 'capa imagem unsplash pixels foto inicio dashboard', 'navegacao', 's-inicio'],
  ['Módulos', 'ligar desligar areas', 'modulos', 's-modulos'], ['Rever boas-vindas', 'onboarding boas vindas', 'modulos', 's-modulos'],
  ['Notificações no aparelho', 'notificacao push avisos', 'notificacoes', 's-avisos'], ['Som', 'som audio aviso', 'notificacoes', 's-avisos'],
  ['Bom dia', 'resumo manha', 'notificacoes', 's-resumos'], ['Boa noite', 'resumo noite', 'notificacoes', 's-resumos'],
  ['Revisão da semana', 'domingo semanal', 'notificacoes', 's-resumos'], ['Lembrete de treino', 'academia treino', 'notificacoes', 's-lembretes'],
  ['Contas a vencer', 'boleto contas financas', 'notificacoes', 's-lembretes'], ['Silêncio', 'nao perturbe horario silencio', 'notificacoes', 's-silencio'],
  ['Idioma', 'portugues ingles espanhol lingua', 'idioma', 's-idioma'], ['Moeda', 'real dolar euro moeda', 'idioma', 's-regiao'],
  ['Início da semana', 'domingo segunda semana calendario', 'idioma', 's-regiao'], ['Integrações', 'google github apple open finance notion', 'integracoes', 's-integracoes'],
  ['Atalhos de teclado', 'teclado tecla atalho', 'atalhos', 's-atalhos'], ['Instalar o app', 'pwa instalar app celular', 'app', 's-pwa'],
  ['Limpar cache offline', 'cache offline rede', 'app', 's-rede'], ['Versão', 'versao sobre', 'app', 's-sobre'],
];
const norm = (s) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

export function settingsPage() {
  const cat = CATS.find((c) => c.id === ui.sub) ? ui.sub : 'conta';
  const q = ui.setQuery || '';
  const results = q.trim() ? INDEX.filter(([t, k]) => norm(t + ' ' + k).includes(norm(q.trim()))).slice(0, 8) : [];
  return `
    <div class="set-page">
      <div class="set-head"><span class="set-head-ico">${icon('gear')}</span><h1>Configurações</h1></div>
      <p class="set-head-sub">Tudo do ORBITA em um lugar. Procure pelo nome ou navegue pelas categorias.</p>
      <div class="set-search">${icon('search')}<input id="set-q" type="search" placeholder="Buscar configuração (ex.: tema, senha, fonte, atalho)" value="${esc(q)}" data-input="set-search" autocomplete="off" aria-label="Buscar configuração">
        ${q.trim() ? `<div class="set-results">${results.length ? results.map(([t, , c, s]) => `
          <button class="set-result" data-action="set-goto" data-cat="${c}" data-sec="${s}"><span>${esc(t)}</span><small>${esc(CATS.find((x) => x.id === c).label)}</small></button>`).join('') : '<div class="set-noresult">Nada encontrado.</div>'}</div>` : ''}
      </div>
      <div class="set-grid">
        <nav class="set-nav" aria-label="Categorias">${CATS.map((c) => `
          <a class="set-nav-item ${c.id === cat ? 'active' : ''}" href="#/settings/${c.id}">${icon(c.icon)}<span>${c.label}</span></a>`).join('')}</nav>
        <div class="set-body">${TABS[cat]()}<p class="set-version">ORBITA v${APP_VERSION}</p></div>
      </div>
    </div>`;
}

const TABS = {
  conta() {
    const u = state.user || {};
    const provider = u.provider || 'email';
    const ua = navigator.userAgent;
    const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Navegador';
    const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'este sistema';
    const way = (id, name, ico) => row(`${ico} ${name}`, '', provider === id ? '<span class="chip green">Conectado</span>' : `<button class="btn sm" data-action="set-soon" data-m="Conectar outra forma de entrar">Ligar</button>`);
    return sec('s-perfil', 'user', 'Perfil', 'Como o ORBITA te chama.', `
        <div class="set-card set-profile">
          <div class="set-avatar">${avatarInner()}</div>
          <label class="btn sm">${icon('upload')}Enviar foto<input type="file" accept="image/*" data-change="avatar-file" hidden></label>
          ${u.photo ? '<button class="btn sm ghost" data-action="avatar-remove">Remover</button>' : ''}
          <div class="set-fields">
            <label class="field"><span>Nome</span><input class="input" value="${esc(u.name || '')}" data-change="profile" data-f="name" autocomplete="name"></label>
            <label class="field"><span>E-mail</span><input class="input" type="email" value="${esc(u.email || '')}" data-change="profile" data-f="email" autocomplete="email"></label>
          </div>
          <small class="muted">Perfil salvo neste aparelho.</small>
        </div>`)
      + sec('s-plano', 'spark', 'Plano', 'O plano da sua conta.', `
        <div class="set-card set-plan"><div><b>Pessoal</b> <span class="chip blue">Atual</span><p class="muted">Gratuito. Todos os módulos, a ORBITA AI, tema e capa personalizáveis, funcionamento offline e backup quando quiser.</p></div>
          <ul class="set-list">${['Dez áreas da vida em um só app', 'Funciona sem internet e pode ser instalado', 'Seus dados são seus: backup em JSON e CSV', 'Sincronização entre aparelhos: chega com a conta em nuvem'].map((t) => `<li>${icon('check')}${t}</li>`).join('')}</ul></div>`)
      + sec('s-seguranca', 'lock', 'Segurança', 'Proteja o acesso à sua conta.', `
        <div class="set-card">
          ${label('Formas de entrar')}
          ${way('email', 'E-mail e senha', icon('pen'))}${way('Google', 'Google', icon('globe'))}${way('Apple', 'Apple', icon('apple'))}
          ${row('Verificação em duas etapas', S().twofa ? 'Ativada: o código do celular será pedido quando a conta em nuvem estiver ligada.' : 'Desativada', toggle('twofa', S().twofa))}
          ${row('Trocar senha', 'A troca de senha chega com a conta em nuvem.', '<button class="btn sm" data-action="set-soon" data-m="Trocar senha">Trocar senha</button>')}
        </div>`)
      + sec('s-aparelhos', 'monitor', 'Aparelhos conectados', 'Onde a sua conta está aberta.', `
        <div class="set-card">${row(`${browser} no ${os} <span class="chip blue">este aparelho</span>`, 'Usado agora', '')}</div>`)
      + sec('s-sessao', 'shield', 'Conta', 'Sessão neste aparelho.', `
        <div class="set-card">
          ${row('Conectado como', esc(u.email || u.name || 'Você'), `<button class="btn sm" data-action="logout">${icon('logout')}Sair</button>`)}
          ${row('<span class="danger-txt">Excluir minha conta</span>', 'Apaga a conta e todos os dados deste aparelho. Não dá para desfazer.', `<button class="btn sm danger" data-action="wipe">${icon('trash')}Excluir</button>`)}
        </div>`)
      + sec('s-dados', 'database', 'Dados', 'Seus dados, sempre exportáveis.', `
        <div class="set-card">
          ${row('Baixar backup (.json)', 'Tudo o que você guardou no ORBITA em um arquivo.', `<button class="btn sm" data-action="export">${icon('download')}Baixar</button>`)}
          ${row('Importar backup', 'Restaura um arquivo exportado antes.', `<label class="btn sm">${icon('upload')}Importar<input type="file" accept="application/json" data-change="import" hidden></label>`)}
          ${row('Exportar finanças (.csv)', 'Receitas e despesas para usar em planilhas.', `<button class="btn sm" data-action="export-csv">${icon('download')}CSV</button>`)}
          ${row('Carregar dados de exemplo', 'Substitui seus dados pelos de demonstração.', '<button class="btn sm" data-action="reseed">Carregar</button>')}
          ${row('Recomeçar', 'Apaga tarefas, finanças e todo o resto, mas mantém a conta e as configurações.', '<button class="btn sm danger" data-action="start-fresh">Recomeçar</button>')}
        </div>`);
  },

  aparencia() {
    loadFonts(FONTS);
    const s = S();
    const cur = THEMES[s.theme] ? s.theme : 'dark';
    const preview = (k) => {
      if (k === 'system') return `<span class="tp split"><span class="tp-half" style="--a:#000;--b:#111113;--c:#0a84ff"></span><span class="tp-half" style="--a:#f5f5f7;--b:#fff;--c:#0071e3"></span></span>`;
      const [a, b, c] = THEMES[k].p;
      return `<span class="tp" style="--a:${a};--b:${b};--c:${c}"><i class="tp-side"></i><i class="tp-card"><i class="l1"></i><i class="l2"></i><i class="acc"></i></i></span>`;
    };
    const L = { ...LOGO_DEFAULT, ...(s.logo || {}) };
    const chips = (part) => `<div class="chips">${Object.entries(SWATCHES).map(([k, [n, c]]) => `<button class="chip-opt ${L[part] === k ? 'on' : ''}" data-action="set-logo" data-part="${part}" data-v="${k}"><i style="background:${c}"></i>${n}</button>`).join('')}</div>`;
    const ac = s.accent;
    const hue = ac?.type === 'hue' ? ac.h : 211;
    const clock = s.focusClock || 'digital';
    return sec('s-tema', 'palette', 'Tema', 'Escuro por padrão. Mais treze temas com a mesma interface.', `
        <div class="opt-grid">${Object.entries(THEMES).map(([k, t]) => `
          <button class="opt-card theme-card ${cur === k ? 'on' : ''}" data-action="set-choice" data-k="theme" data-v="${k}">${preview(k)}
            <span class="opt-name">${t.icon ? icon(t.icon) : icon('drop')}${t.name}</span><small>${t.desc}</small></button>`).join('')}</div>`)
      + sec('s-logo', 'drop', 'Cor da logo e destaque', 'Personalize a logo e a cor de destaque do sistema.', `
        <div class="set-card">
          ${label('Cor da logo', `<button class="link-btn" data-action="set-reset" data-k="logo">${icon('refresh')}Padrão</button>`)}
          <div class="logo-preview"><span class="lp-logo">${LOGO}</span><b>ORBITA</b></div>
          <div class="set-sub-label">Anel</div>${chips('ring')}
          <div class="set-sub-label">Planeta</div>${chips('core')}
          <div class="set-sub-label">Satélite</div>${chips('moon')}
          <div class="set-divider"></div>
          ${label('Cor de destaque do sistema', ac ? `<button class="link-btn" data-action="set-reset" data-k="accent">${icon('refresh')}Cor do tema</button>` : '<small class="muted">Usando a cor do tema</small>')}
          <input class="hue" type="range" min="0" max="359" value="${hue}" data-input="set-hue" aria-label="Cor de destaque">
          <div class="accent-row"><span class="muted">Sem cor:</span>
            <button class="chip-opt ${ac?.type === 'white' ? 'on' : ''}" data-action="set-accent" data-v="white"><i style="background:#f4f4f5"></i>Branco</button>
            <button class="chip-opt ${ac?.type === 'black' ? 'on' : ''}" data-action="set-accent" data-v="black"><i style="background:#0a0a0a"></i>Preto</button>
            <span class="accent-demo"><span class="btn primary sm">Botão</span><span class="chip blue">Destaque</span><span class="bar" style="width:80px"><i style="width:60%"></i></span></span></div>
        </div>`)
      + sec('s-fonte', 'type', 'Fonte', 'A tipografia de todo o sistema.', `
        <div class="opt-grid">${FONTS.map((f) => `
          <button class="opt-card font-card ${(s.font || 'DM Sans') === f ? 'on' : ''}" data-action="set-choice" data-k="font" data-v="${f}" style="font-family:'${f}'">
            <span class="aa">Aa</span><span class="opt-name">${FONT_LABEL[f] || f}</span><small>Tudo conectado, 0123</small></button>`).join('')}</div>`)
      + sec('s-cores', 'drop', 'Cores do sistema', 'Colorido, uma cor só ou tudo em tons de cinza.', `
        <div class="opt-grid">${[['color', 'Colorido', 'Cada coisa com a sua cor.', 'conic-gradient(#ff453a,#ffd60a,#30d158,#0a84ff,#bf5af2,#ff453a)'], ['one', 'Uma cor', 'Tudo na sua cor de destaque.', 'var(--accent)'], ['mono', 'Monocromático', 'Tudo em tons de cinza.', 'linear-gradient(135deg,#fff,#3a3a3c)']].map(([k, n, d, bg]) => `
          <button class="opt-card row-card ${(s.colors || 'color') === k ? 'on' : ''}" data-action="set-choice" data-k="colors" data-v="${k}"><span class="dot-big" style="background:${bg}"></span><span><span class="opt-name">${n}</span><small>${d}</small></span></button>`).join('')}</div>`)
      + sec('s-icone', 'image', 'Ícone do app', 'O ícone que aparece na aba do navegador.', `
        <div class="set-card icon-row"><span class="icon-big">${iconSvg(s.appIcon || 'padrao')}</span>
          <div class="chips">${Object.entries(APP_ICONS).map(([k, v]) => `<button class="chip-opt ${(s.appIcon || 'padrao') === k ? 'on' : ''}" data-action="set-choice" data-k="appIcon" data-v="${k}"><span class="mini-ico">${iconSvg(k)}</span>${v.name}</button>`).join('')}</div></div>`)
      + sec('s-tamanho', 'monitor', 'Tamanho', 'O tamanho da interface e do texto neste aparelho.', `
        <div class="set-card">
          ${label('Interface')}<div class="seg-opts">${[85, 90, 100, 110, 125].map((v) => `<button class="${(s.uiScale || 100) === v ? 'on' : ''}" data-action="set-choice" data-k="uiScale" data-v="${v}" data-num="1">${v}%</button>`).join('')}</div>
          ${label('Conteúdo das páginas')}<div class="seg-opts">${[90, 100, 110, 120, 135].map((v) => `<button class="${(s.textScale || 100) === v ? 'on' : ''}" data-action="set-choice" data-k="textScale" data-v="${v}" data-num="1">${v}%</button>`).join('')}</div>
          <small class="muted">Vale só para este aparelho.</small></div>`)
      + sec('s-relogio', 'clock', 'Relógio do foco', 'Como o cronômetro aparece no cartão Tempo de foco.', `
        <div class="opt-grid">${[['digital', 'Digital'], ['ring', 'Anel'], ['minimal', 'Minimal']].map(([k, n]) => `
          <button class="opt-card clock-card ${clock === k ? 'on' : ''}" data-action="set-choice" data-k="focusClock" data-v="${k}">${clockPreview(k)}<span class="opt-name">${n}</span></button>`).join('')}</div>`);
  },

  navegacao() {
    const s = S();
    const nav = s.nav || 'dock';
    const dock = cfg('dock', DOCK_DEFAULT);
    const pinnable = PAGES.filter((p) => moduleOn(p.module));
    const dockList = dockPages();
    const order = plusOrder().filter((k) => moduleOn(PLUS_ITEMS[k].module));
    const dash = s.dashStyle || 'cover';
    const img = s.coverImage;
    const coverKind = dash === 'none' ? 'none' : img ? (img.type === 'upload' ? 'upload' : 'unsplash') : 'pixels';
    return sec('s-nav', 'layout', 'Navegação', 'Barra lateral ou dock, e os módulos que ficam à mão.', `
        ${label('Navegação (computador)')}
        <div class="opt-grid two">
          <button class="opt-card nav-card ${nav === 'sidebar' ? 'on' : ''}" data-action="set-choice" data-k="nav" data-v="sidebar"><span class="np np-side"><i></i><i></i><i></i></span><span class="opt-name">Barra lateral</span><small>Todos os módulos à vista, à esquerda.</small></button>
          <button class="opt-card nav-card ${nav === 'dock' ? 'on' : ''}" data-action="set-choice" data-k="nav" data-v="dock"><span class="np np-dock"><i></i></span><span class="opt-name">Dock</span><small>Tela livre, módulos fixados embaixo.</small></button>
        </div>
        <small class="muted">No celular a navegação continua sendo a barra de baixo.</small>`)
      + sec('s-dock', 'dock', 'Módulos na dock', `Os que ficam à mão na dock${nav === 'sidebar' ? ' e no topo da barra lateral' : ''}. Os demais ficam no botão “Módulos”.`, `
        ${label(`Fixados`, `<span class="muted">${dock.length}/${DOCK_MAX} · <button class="link-btn" data-action="set-reset" data-k="dock">restaurar padrão</button></span>`)}
        <div class="pin-grid">${pinnable.map((p) => `<button class="pin ${dock.includes(p.id) ? 'on' : ''}" data-action="dock-pin" data-id="${p.id}">${icon(p.icon)}<span>${p.id === 'dashboard' ? 'Início' : esc(p.title)}</span></button>`).join('')}</div>
        ${label('Ordem na dock')}
        <div class="order-list" data-order="dock">${dockList.map((p, i) => `
          <div class="order-row" draggable="true" data-id="${p.id}"><span class="grip">${icon('grip')}</span>${icon(p.icon)}<span class="name">${p.id === 'dashboard' ? 'Início' : esc(p.title)}</span>
            <button class="icon-btn sm" data-action="dock-move" data-id="${p.id}" data-d="-1" ${i === 0 ? 'disabled' : ''} aria-label="Subir">${icon('arrowUp')}</button>
            <button class="icon-btn sm" data-action="dock-move" data-id="${p.id}" data-d="1" ${i === dockList.length - 1 ? 'disabled' : ''} aria-label="Descer">${icon('arrowDown')}</button></div>`).join('')}</div>
        <small class="muted">Arraste pela alça ou use as setas. O primeiro fica à esquerda.</small>`)
      + sec('s-plus', 'plus', 'Botão +', 'Quais atalhos aparecem no menu do + e em que ordem.', `
        <div class="order-list" data-order="plus">${order.map((k, i) => `
          <div class="order-row ${plusOn(k) ? '' : 'off'}" draggable="true" data-id="${k}"><span class="grip">${icon('grip')}</span>${icon(PLUS_ITEMS[k].icon)}<span class="name">${PLUS_ITEMS[k].label}</span>
            <button class="icon-btn sm" data-action="plus-move" data-id="${k}" data-d="-1" ${i === 0 ? 'disabled' : ''} aria-label="Subir">${icon('arrowUp')}</button>
            <button class="icon-btn sm" data-action="plus-move" data-id="${k}" data-d="1" ${i === order.length - 1 ? 'disabled' : ''} aria-label="Descer">${icon('arrowDown')}</button>
            <label class="switch sm"><input type="checkbox" data-change="plus-toggle" data-id="${k}" ${plusOn(k) ? 'checked' : ''} aria-label="Mostrar ${PLUS_ITEMS[k].label}"><span></span></label></div>`).join('')}</div>
        <small class="muted">${order.filter(plusOn).length} de ${order.length} atalhos ligados.</small>`)
      + sec('s-inicio', 'home', 'Início', 'Como o Início aparece e a imagem da capa.', `
        ${label('Dashboard')}
        <div class="opt-grid two">
          <button class="opt-card nav-card ${dash === 'none' ? 'on' : ''}" data-action="set-choice" data-k="dashStyle" data-v="none"><span class="np np-classic"><i></i><i></i><i></i><i></i></span><span class="opt-name">Clássico</span><small>Grade de cartões com o resumo do dia.</small></button>
          <button class="opt-card nav-card ${dash !== 'none' ? 'on' : ''}" data-action="set-choice" data-k="dashStyle" data-v="cover"><span class="np np-cover"><i></i><i></i></span><span class="opt-name">Capa</span><small>Imagem no topo e a caixa “O que vem agora?”.</small></button>
        </div>
        ${label('Imagem do dashboard')}
        <div class="seg-opts wrap">
          <button class="${coverKind === 'pixels' ? 'on' : ''}" data-action="cover-kind" data-v="pixels">Pixels (original)</button>
          <button class="${coverKind === 'upload' ? 'on' : ''}" data-action="cover-kind" data-v="upload">Enviar imagem</button>
          <button class="${coverKind === 'unsplash' ? 'on' : ''}" data-action="cover-kind" data-v="unsplash">Banco de imagens</button>
          <button class="${coverKind === 'none' ? 'on' : ''}" data-action="cover-kind" data-v="none">Sem capa</button>
        </div>
        ${coverKind === 'pixels' ? `${label('Cor dos pixels')}<div class="chips">${COVER_KEYS.map((k) => `<button class="chip-opt ${(s.cover || 'orbita') === k ? 'on' : ''}" data-action="set-choice" data-k="cover" data-v="${k}"><i style="background:rgb(${COVERS[k].blobs[0].join(',')})"></i>${COVERS[k].name}</button>`).join('')}</div>` : ''}
        <small class="muted">Imagens enviadas são reduzidas para carregar rápido e ficam salvas neste aparelho. ${UNSPLASH.length} fotos do Unsplash estão disponíveis no banco de imagens.</small>`);
  },

  modulos() {
    const groups = [
      ['Núcleo', 'O dia a dia: o que fazer, quando e onde.', ['tasks', 'calendar', 'work']],
      ['Vida', 'Corpo, mente, dinheiro e evolução pessoal.', ['goals', 'habits', 'health', 'finance', 'studies']],
      ['Criação e lazer', 'O que você produz e aproveita.', ['content', 'travel']],
      ['Sistema', 'Assistente do ORBITA.', ['ai']],
    ];
    const info = { ...MODULE_INFO, ai: { title: 'ORBITA AI', icon: 'spark', desc: 'Assistente que entende português e cruza os módulos' } };
    const all = groups.flatMap((g) => g[2]);
    const onCount = all.filter((m) => S().modules[m] !== false).length;
    return sec('s-modulos', 'grid', 'Módulos', 'Escolha quais áreas aparecem no seu ORBITA.', `
        <div class="set-label"><span>${onCount} de ${all.length} ligados</span><button class="link-btn" data-action="rever-boas-vindas">${icon('refresh')}Rever boas-vindas</button></div>
        ${groups.map(([g, d, ms]) => `<div class="mod-group"><div class="mod-group-head"><b>${g}</b><small>${d}</small></div>
          <div class="set-card">${ms.map((m) => row(`${icon(info[m].icon)} ${info[m].title}`, info[m].desc, `<label class="switch"><input type="checkbox" data-change="module-toggle" data-m="${m}" ${S().modules[m] !== false ? 'checked' : ''}><span></span></label>`)).join('')}</div></div>`).join('')}
        <small class="muted">Início e Configurações ficam sempre ligados. Módulos desligados somem do menu, da dock e da busca.</small>`);
  },

  notificacoes() {
    const perm = 'Notification' in window ? Notification.permission : 'unsupported';
    const permTxt = { granted: 'Permitido neste navegador.', denied: 'Bloqueado pelo navegador. Libere nas permissões do site para receber avisos.', default: 'O navegador vai pedir permissão quando você ligar.', unsupported: 'Este navegador não suporta notificações.' }[perm];
    const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const t = (p) => toggle('notif.' + p, nc(p));
    return sec('s-avisos', 'bell', 'Avisos', 'Lembretes do ORBITA, com notificação e som.', `
        <div class="set-card">
          ${row('Avisos neste aparelho', `Os lembretes chegam como notificação do sistema enquanto o ORBITA estiver aberto ou instalado. ${permTxt}`, `<label class="switch"><input type="checkbox" data-change="notif-device" ${nc('device') && perm === 'granted' ? 'checked' : ''} ${perm === 'unsupported' ? 'disabled' : ''}><span></span></label>`)}
          ${row('Som com o app aberto', 'Um toque curto quando chega um aviso.', `<button class="btn sm" data-action="notif-test">${icon('volume')}Testar</button>${t('sound')}`)}
          ${row('Sino de notificações', 'Tarefas atrasadas, contas que vão vencer e hábitos pendentes no sino do topo.', toggle('notifications', S().notifications !== false))}
        </div>`)
      + sec('s-resumos', 'sun', 'Resumos do dia', 'Um panorama rápido na hora certa.', `
        <div class="set-card">
          ${row('Bom dia', 'Quantas tarefas e compromissos você tem hoje.', `${timeInput('notif.morning.time', nc('morning.time'))}${t('morning.on')}`)}
          ${row('Boa noite', 'O que você fez hoje e uma prévia de amanhã.', `${timeInput('notif.evening.time', nc('evening.time'))}${t('evening.on')}`)}
          ${row('Revisão da semana', 'Um lembrete para revisar a semana e escolher as prioridades da próxima.', `<select class="input set-sel" data-change="set-value" data-k="notif.weekly.day" data-num="1">${days.map((d, i) => `<option value="${i}" ${+nc('weekly.day') === i ? 'selected' : ''}>${d}</option>`).join('')}</select>${timeInput('notif.weekly.time', nc('weekly.time'))}${t('weekly.on')}`)}
        </div>`)
      + sec('s-lembretes', 'clock', 'Lembretes', 'Avisos que só chegam quando fazem sentido.', `
        <div class="set-card">
          ${row('Hábitos pendentes', 'Avisa se ainda faltar algum hábito do dia.', `${timeInput('notif.habits.time', nc('habits.time'))}${t('habits.on')}`)}
          ${row('Lembrete de treino', 'Só se você ainda não registrou um treino no dia.', `${timeInput('notif.workout.time', nc('workout.time'))}${t('workout.on')}`)}
          ${row('Contas a vencer', 'Avisa às 9h sobre as contas que vencem nos próximos dias.', `<select class="input set-sel" data-change="set-value" data-k="notif.bills.days" data-num="1">${[1, 2, 3, 5, 7].map((d) => `<option value="${d}" ${+nc('bills.days') === d ? 'selected' : ''}>${d} dia${d > 1 ? 's' : ''} antes</option>`).join('')}</select>${t('bills.on')}`)}
        </div>`)
      + sec('s-silencio', 'moon', 'Silêncio', 'Nenhum aviso nesse horário.', `
        <div class="set-card">${row('Silenciar das', '', `${timeInput('notif.quiet.from', nc('quiet.from'))}<span class="muted">às</span>${timeInput('notif.quiet.to', nc('quiet.to'))}${t('quiet.on')}`)}</div>`);
  },

  idioma() {
    const s = S();
    const loc = Intl.DateTimeFormat().resolvedOptions();
    const langs = [['pt', 'Português', 'Brasil (padrão)'], ['en', 'English', 'United States / Global'], ['es', 'Español', 'España y América Latina']];
    const curs = [['BRL', 'Real (R$)'], ['USD', 'Dólar (US$)'], ['EUR', 'Euro (€)'], ['GBP', 'Libra (£)']];
    return sec('s-idioma', 'globe', 'Idioma do aplicativo', 'O idioma do ORBITA.', `
        <div class="opt-grid">${langs.map(([k, n, d]) => `
          <button class="opt-card row-card ${k === 'pt' ? 'on' : 'soon'}" ${k === 'pt' ? '' : 'data-action="set-soon" data-m="O ORBITA em ' + n + '"'}><span class="lang-code">${k.toUpperCase()}</span><span><span class="opt-name">${n}${k === 'pt' ? '' : ' <span class="chip">Em breve</span>'}</span><small>${d}</small></span></button>`).join('')}</div>
        <small class="muted">Local detectado: ${esc(loc.locale)} · fuso ${esc(loc.timeZone)}.</small>`)
      + sec('s-regiao', 'calendar', 'Região', 'Moeda e calendário.', `
        <div class="set-card">
          ${row('Moeda', 'Usada em Finanças e nos resumos.', `<select class="input set-sel" data-change="set-value" data-k="currency">${curs.map(([k, n]) => `<option value="${k}" ${(s.currency || 'BRL') === k ? 'selected' : ''}>${n}</option>`).join('')}</select>`)}
          ${row('A semana começa no', 'Vale para o calendário.', `<div class="seg-opts"><button class="${!s.weekStart ? 'on' : ''}" data-action="set-choice" data-k="weekStart" data-v="0" data-num="1">Domingo</button><button class="${s.weekStart === 1 ? 'on' : ''}" data-action="set-choice" data-k="weekStart" data-v="1" data-num="1">Segunda</button></div>`)}
        </div>`);
  },

  integracoes() {
    return sec('s-integracoes', 'plug', 'Integrações', 'Conecte o ORBITA às plataformas que você já usa.', integrationsBody());
  },

  atalhos() {
    return sec('s-atalhos', 'keyboard', 'Atalhos de teclado', 'Personalize as teclas para usar o ORBITA com velocidade.', `
        <div class="set-label"><span></span><button class="link-btn" data-action="set-reset" data-k="shortcuts">${icon('refresh')}Restaurar padrões</button></div>
        ${SHORTCUTS.map((g) => `<div class="mod-group"><div class="mod-group-head"><b>${g.group}</b>${g.note ? `<small>${g.note}</small>` : ''}</div><div class="set-card">${g.items.map(([k, n, d]) => row(n, d, `
          <span class="keys">${g.prefix ? keycaps(sc('goPrefix')) + '<span class="plus">+</span>' : ''}${ui.recording === k ? '<kbd class="rec">Pressione uma tecla…</kbd>' : keycaps(sc(k))}</span>
          <button class="btn sm ghost" data-action="sc-record" data-k="${k}">${ui.recording === k ? 'Cancelar' : 'Alterar tecla'}</button>`)).join('')}</div></div>`).join('')}
        <div class="mod-group"><div class="mod-group-head"><b>Outros atalhos</b></div><div class="set-card">
          ${row('Abrir a busca', '', `<span class="keys"><kbd>/</kbd></span>`)}
          ${row('Salvar captura', 'Na caixa de captura rápida do Início', `<span class="keys"><kbd>↵</kbd></span>`)}
          ${row('Quebrar linha na captura', '', `<span class="keys"><kbd>⇧</kbd><kbd>↵</kbd></span>`)}
          ${row('Fechar janelas e menus', '', `<span class="keys"><kbd>Esc</kbd></span>`)}
        </div></div>`);
  },

  app() {
    const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    const ios = /iPhone|iPad/.test(navigator.userAgent);
    const online = navigator.onLine;
    let bytes = 0;
    try { bytes = (localStorage.getItem('orbita:data:v1') || '').length * 2; } catch { /* sem acesso */ }
    const size = bytes > 1048576 ? (bytes / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(bytes / 1024)) + ' KB';
    const status = standalone ? '<span class="chip green">Instalado</span>' : installEvt ? '<span class="chip blue">Disponível</span>' : '<span class="chip">Pelo menu do navegador</span>';
    return sec('s-pwa', 'phone', 'Aplicativo', 'Instalação, modo offline e armazenamento.', `
        <div class="set-card app-card">
          <div class="app-head"><span class="icon-big">${iconSvg(S().appIcon || 'padrao')}</span><div><b>ORBITA</b> ${status}<p class="muted">Instale o ORBITA na área de trabalho ou na tela inicial para abrir rápido, sem a barra do navegador.</p></div></div>
          ${standalone ? '' : installEvt ? `<button class="btn primary" data-action="pwa-install">${icon('download')}Instalar aplicativo</button>` : `<p class="muted small">${ios ? 'No iPhone ou iPad: toque em Compartilhar e depois em “Adicionar à Tela de Início”.' : 'No Chrome ou Edge: abra o menu ⋮ e escolha “Instalar ORBITA” ou “Instalar app”.'}</p>`}
        </div>`)
      + sec('s-rede', 'wifi', 'Rede e armazenamento', '', `
        <div class="set-card">
          ${row('Status da rede', online ? 'Online. Tudo salvo neste aparelho.' : 'Offline. Você pode continuar usando; os dados ficam salvos neste aparelho.', `<span class="chip ${online ? 'green' : 'yellow'}">${online ? 'Online' : 'Offline'}</span>`)}
          ${row('Dados salvos', `${size} no armazenamento do navegador.`, '')}
          ${row('Limpar cache offline', 'Baixa de novo os arquivos do app. Seus dados não são apagados.', `<button class="btn sm" data-action="clear-cache">${icon('refresh')}Limpar cache</button>`)}
        </div>`)
      + sec('s-sobre', 'spark', 'Sobre', '', `<div class="set-card">${row(`ORBITA v${APP_VERSION}`, 'A vida inteira em dia.', '<a class="btn sm" href="https://github.com/Filadelpho/orbita" target="_blank" rel="noopener">' + icon('code') + 'Código no GitHub</a>')}</div>`);
  },
};

function clockPreview(k) {
  if (k === 'ring') return `<span class="cp"><svg viewBox="0 0 60 60" width="56" height="56"><circle cx="30" cy="30" r="25" fill="none" stroke="var(--surface-3)" stroke-width="5"/><circle cx="30" cy="30" r="25" fill="none" stroke="var(--accent)" stroke-width="5" stroke-dasharray="157" stroke-dashoffset="50" stroke-linecap="round" transform="rotate(-90 30 30)"/><text x="30" y="34" text-anchor="middle" font-size="11" fill="var(--text)" font-family="var(--font)">18:42</text></svg></span>`;
  if (k === 'minimal') return '<span class="cp"><span class="cp-min">18:42</span><span class="cp-line"><i></i></span></span>';
  return '<span class="cp"><span class="cp-dig">18:42</span></span>';
}

// Avatar (foto ou iniciais) — usado na barra do topo e na conta.
export function avatarInner() {
  const u = state.user || {};
  return u.photo ? `<img src="${esc(u.photo)}" alt="">` : esc(initials(u.name || 'Você'));
}

// ---------- Ações ----------
on('set-toggle', (ds, el) => { setPath(S(), ds.k, el.checked); save(); });
on('set-value', (ds, el) => { setPath(S(), ds.k, ds.num ? +el.value : el.value); save(); });
on('set-choice', (ds) => {
  setPath(S(), ds.k, ds.num ? +ds.v : ds.v);
  if (ds.k === 'cover') S().coverImage = null;
  if (ds.k === 'dashStyle' && ds.v === 'cover' && S().dashStyle === 'cover') { /* mantém */ }
  save();
});
on('set-reset', (ds) => { delete S()[ds.k]; save(); toast('Padrão restaurado'); });
on('set-soon', (ds) => toast(`${ds.m} chega em breve.`));
on('set-logo', (ds) => { S().logo = { ...LOGO_DEFAULT, ...(S().logo || {}), [ds.part]: ds.v }; save(); });
on('set-accent', (ds) => { S().accent = { type: ds.v }; save(); });
let hueTimer = null;
on('set-hue', (ds, el) => {
  S().accent = { type: 'hue', h: +el.value };
  applyAppearance();
  clearTimeout(hueTimer);
  hueTimer = setTimeout(save, 200);
});
on('set-search', (ds, el) => {
  ui.setQuery = el.value;
  const pos = el.selectionStart;
  bus.render();
  const input = document.getElementById('set-q');
  input?.focus(); input?.setSelectionRange(pos, pos);
});
on('set-goto', (ds) => {
  ui.setQuery = '';
  ui.pendingSec = ds.sec;
  if (ui.sub === ds.cat) { bus.render(); scrollToPending(); } else location.hash = `#/settings/${ds.cat}`;
});
export function scrollToPending() {
  if (!ui.pendingSec) return;
  const el = document.getElementById(ui.pendingSec);
  ui.pendingSec = null;
  if (!el) return;
  el.scrollIntoView({ block: 'start', behavior: 'smooth' });
  el.classList.add('flash');
  setTimeout(() => el.classList.remove('flash'), 1600);
}

// Conta
on('profile', (ds, el) => { state.user = { ...state.user, [ds.f]: el.value.trim() }; save(); toast('Perfil atualizado'); });
on('avatar-file', (ds, el) => {
  const f = el.files?.[0];
  if (!f || !f.type.startsWith('image/')) return toast('Escolha uma imagem.');
  const r = new FileReader();
  r.onload = () => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      const side = Math.min(img.width, img.height);
      c.width = c.height = 256;
      c.getContext('2d').drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 256, 256);
      state.user = { ...state.user, photo: c.toDataURL('image/jpeg', 0.85) };
      save();
      toast('Foto atualizada');
    };
    img.src = r.result;
  };
  r.readAsDataURL(f);
});
on('avatar-remove', () => { const u = { ...state.user }; delete u.photo; state.user = u; save(); });
on('start-fresh', async () => {
  if (await confirmDialog('Recomeçar do zero?', 'Tarefas, finanças, hábitos e todos os outros registros serão apagados. A conta e as configurações continuam.', 'Recomeçar')) {
    state.data = {};
    save();
    toast('Tudo limpo. Bom recomeço!');
  }
});

// Navegação
on('dock-pin', (ds) => {
  const d = [...cfg('dock', DOCK_DEFAULT)];
  const i = d.indexOf(ds.id);
  if (i >= 0) { if (d.length === 1) return toast('Deixe pelo menos um módulo na dock.'); d.splice(i, 1); }
  else { if (d.length >= DOCK_MAX) return toast(`A dock comporta até ${DOCK_MAX} módulos.`); d.push(ds.id); }
  S().dock = d; save();
});
const moveIn = (arr, id, delta) => {
  const i = arr.indexOf(id), j = i + delta;
  if (i < 0 || j < 0 || j >= arr.length) return arr;
  [arr[i], arr[j]] = [arr[j], arr[i]];
  return arr;
};
on('dock-move', (ds) => { S().dock = moveIn(dockPages().map((p) => p.id), ds.id, +ds.d); save(); });
on('plus-move', (ds) => { S().plus = { ...(S().plus || {}), order: moveIn(plusOrder(), ds.id, +ds.d) }; save(); });
on('plus-toggle', (ds, el) => {
  const off = new Set(cfg('plus.off', []));
  el.checked ? off.delete(ds.id) : off.add(ds.id);
  S().plus = { ...(S().plus || {}), off: [...off] }; save();
});
on('cover-kind', (ds) => {
  const s = S();
  if (ds.v === 'none') { s.dashStyle = 'none'; save(); return; }
  s.dashStyle = 'cover';
  if (ds.v === 'pixels') { s.coverImage = null; save(); return; }
  save();
  ui.coverTab = ds.v === 'upload' ? 'upload' : 'unsplash';
  openCoverPicker(ui.coverTab);
});
// Arrastar e soltar nas listas de ordem
let dragId = null;
document.addEventListener('dragstart', (e) => { const r = e.target.closest?.('.order-row'); if (!r) return; dragId = r.dataset.id; r.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
document.addEventListener('dragend', (e) => { e.target.closest?.('.order-row')?.classList.remove('dragging'); });
document.addEventListener('dragover', (e) => { if (dragId && e.target.closest?.('.order-row')) e.preventDefault(); });
document.addEventListener('drop', (e) => {
  const r = e.target.closest?.('.order-row');
  const list = r?.closest('[data-order]');
  if (!r || !dragId || !list) return;
  e.preventDefault();
  const kind = list.dataset.order;
  const arr = kind === 'dock' ? dockPages().map((p) => p.id) : plusOrder();
  const from = arr.indexOf(dragId), to = arr.indexOf(r.dataset.id);
  dragId = null;
  if (from < 0 || to < 0 || from === to) return;
  arr.splice(to, 0, arr.splice(from, 1)[0]);
  if (kind === 'dock') S().dock = arr; else S().plus = { ...(S().plus || {}), order: arr };
  save();
});

// Módulos
on('module-toggle', (ds, el) => { S().modules[ds.m] = el.checked; save(); });
on('rever-boas-vindas', () => { state.onboarded = false; save(); });

// Notificações
on('notif-device', async (ds, el) => {
  if (!el.checked) { setPath(S(), 'notif.device', false); save(); return; }
  if (!('Notification' in window)) return;
  const p = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  setPath(S(), 'notif.device', p === 'granted');
  save();
  toast(p === 'granted' ? 'Avisos ligados neste aparelho' : 'O navegador não liberou as notificações.');
});
on('notif-test', () => { playSound(); notify('ORBITA', 'Assim chegam os seus avisos.'); });

// Atalhos
on('sc-record', (ds) => { ui.recording = ui.recording === ds.k ? null : ds.k; bus.render(); });

// App
on('pwa-install', async () => {
  if (!installEvt) return;
  installEvt.prompt();
  await installEvt.userChoice.catch(() => null);
  installEvt = null;
  bus.render();
});
on('clear-cache', async () => {
  try {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    const reg = await navigator.serviceWorker?.getRegistration();
    await reg?.update();
    toast('Cache limpo. Recarregando…');
    setTimeout(() => location.reload(), 800);
  } catch { toast('Não consegui limpar o cache.'); }
});

// Exporta para outros módulos que precisam de um resumo de capitalização.
export { cap };
