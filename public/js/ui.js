// Infra de UI: estado de navegação, ações delegadas, modais, toasts e formulários.
import { state, upsert, find, remove, today } from './store.js';
import { COLLECTIONS, escapeHtml as esc } from './collections.js';
import { icon } from './icons.js';

export const ui = {
  route: 'dashboard',
  tab: {},
  filter: {},
  calCursor: null,
  calSelected: null,
  navOpen: false,
  notifOpen: false,
  aiTyping: false,
};

export const bus = { render: () => {} };

// ---------- Ações delegadas (data-action="nome") ----------
const actions = {};
export const on = (name, fn) => { actions[name] = fn; };

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const fn = actions[el.dataset.action];
  if (!fn) return;
  if (el.tagName !== 'INPUT') e.preventDefault();
  fn(el.dataset, el, e);
});

document.addEventListener('submit', (e) => {
  const form = e.target.closest('form[data-submit]');
  if (!form) return;
  e.preventDefault();
  const fn = actions[form.dataset.submit];
  if (fn) fn(form.dataset, form, e);
});

document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-change]');
  if (!el) return;
  const fn = actions[el.dataset.change];
  if (fn) fn(el.dataset, el, e);
});

document.addEventListener('input', (e) => {
  const el = e.target.closest('[data-input]');
  if (!el) return;
  const fn = actions[el.dataset.input];
  if (fn) fn(el.dataset, el, e);
});

// ---------- Toast ----------
export function toast(msg) {
  const wrap = document.getElementById('toasts');
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `${icon('checkCircle')}<span>${esc(msg)}</span>`;
  wrap.appendChild(t);
  setTimeout(() => { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; }, 2200);
  setTimeout(() => t.remove(), 2600);
}

// ---------- Overlay ----------
const overlay = () => document.getElementById('overlay');
export function openOverlay(html, onMount) {
  overlay().innerHTML = `<div class="backdrop" data-backdrop>${html}</div>`;
  const bd = overlay().firstElementChild;
  bd.addEventListener('mousedown', (e) => { if (e.target === bd) closeOverlay(); });
  onMount?.(bd);
}
export function closeOverlay() { overlay().innerHTML = ''; }
export const overlayOpen = () => !!overlay().firstElementChild;

on('close-overlay', closeOverlay);

export function confirmDialog(title, text, okLabel = 'Excluir') {
  return new Promise((resolve) => {
    openOverlay(`
      <div class="modal" style="max-width:400px">
        <div class="modal-head"><h3>${esc(title)}</h3></div>
        <div style="padding:4px 20px 0;color:var(--muted)">${esc(text)}</div>
        <div class="modal-foot">
          <button class="btn" data-confirm="0">Cancelar</button>
          <button class="btn primary" style="background:var(--danger)" data-confirm="1">${esc(okLabel)}</button>
        </div>
      </div>`, (bd) => {
      bd.querySelectorAll('[data-confirm]').forEach((b) => b.addEventListener('click', () => {
        closeOverlay();
        resolve(b.dataset.confirm === '1');
      }));
    });
  });
}

// ---------- Formulário genérico ----------
function fieldInput(f, v) {
  let val = v ?? (typeof f.default === 'function' ? f.default() : f.default) ?? '';
  const req = f.required ? 'required' : '';
  const n = `name="${f.name}"`;
  switch (f.type) {
    case 'textarea': return `<textarea ${n} rows="4" ${req}>${esc(val)}</textarea>`;
    case 'select':
      return `<select ${n} ${req}>${f.required ? '' : '<option value="">—</option>'}${f.options
        .map((o) => `<option ${o === val ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
    case 'checkbox': return `<label class="switch"><input type="checkbox" ${n} ${val ? 'checked' : ''}><span></span></label>`;
    case 'progress':
      return `<div class="range"><input type="range" min="0" max="100" step="5" ${n} value="${+val || 0}" oninput="this.nextElementSibling.textContent=this.value+'%'"><output>${+val || 0}%</output></div>`;
    case 'money': return `<input type="number" step="0.01" min="0" inputmode="decimal" ${n} value="${esc(val)}" ${req}>`;
    case 'number': return `<input type="number" step="any" ${n} value="${esc(val)}" ${req}>`;
    case 'date': case 'time': case 'url':
      return `<input type="${f.type}" ${n} value="${esc(val)}" ${req}>`;
    default: return `<input type="text" ${n} value="${esc(val)}" ${req} autocomplete="off">`;
  }
}

// Janelas próprias para criar itens de algumas coleções (ex.: compromissos).
export const formHooks = {};

export function openForm(key, id = null, defaults = {}) {
  if (!id && formHooks[key]) return formHooks[key](defaults);
  const cfg = COLLECTIONS[key];
  const item = id ? find(key, id) : { ...defaults };
  const title = id ? `Editar ${cfg.singular}` : `Novo(a) ${cfg.singular}`;
  openOverlay(`
    <form class="modal" data-submit="save-form" data-key="${key}" data-id="${id || ''}">
      <div class="modal-head"><h3>${esc(title)}</h3><button type="button" class="icon-btn" data-action="close-overlay">${icon('x')}</button></div>
      <div class="modal-body">
        ${cfg.fields.map((f) => `<label class="field ${f.full ? 'full' : ''}"><span>${esc(f.label)}</span>${fieldInput(f, item[f.name])}</label>`).join('')}
      </div>
      <div class="modal-foot">
        ${id ? `<button type="button" class="btn danger" style="margin-right:auto" data-action="delete-item" data-key="${key}" data-id="${id}">${icon('trash')}Excluir</button>` : ''}
        <button type="button" class="btn" data-action="close-overlay">Cancelar</button>
        <button class="btn primary">${id ? 'Salvar' : 'Adicionar'}</button>
      </div>
    </form>`, (bd) => bd.querySelector('input:not([type=hidden]),textarea,select')?.focus());
}

on('save-form', (ds, form) => {
  const cfg = COLLECTIONS[ds.key];
  const obj = ds.id ? { id: ds.id } : {};
  for (const f of cfg.fields) {
    const el = form.elements[f.name];
    if (!el) continue;
    if (f.type === 'checkbox') obj[f.name] = el.checked;
    else if (['number', 'money', 'progress'].includes(f.type)) obj[f.name] = el.value === '' ? '' : parseFloat(el.value);
    else obj[f.name] = el.value.trim();
  }
  if (!ds.id) {
    if (cfg.done) obj[cfg.done] = false;
    if (ds.key === 'habits') obj.log = {};
  }
  upsert(ds.key, obj);
  closeOverlay();
  toast(ds.id ? 'Alterações salvas' : `${cap(cfg.singular)} adicionado(a)`);
});

on('open-form', (ds) => {
  const defaults = {};
  for (const [k, v] of Object.entries(ds)) if (k.startsWith('def')) defaults[k.slice(3).toLowerCase()] = v;
  openForm(ds.key, ds.id || null, defaults);
});

on('delete-item', async (ds) => {
  const cfg = COLLECTIONS[ds.key];
  closeOverlay();
  if (await confirmDialog(`Excluir ${cfg.singular}?`, 'Essa ação não pode ser desfeita.')) {
    remove(ds.key, ds.id);
    toast('Excluído');
  }
});

on('toggle-done', (ds) => {
  const cfg = COLLECTIONS[ds.key];
  const it = find(ds.key, ds.id);
  if (!it) return;
  const val = !it[cfg.done];
  // Guarda o dia da conclusão para o mosaico e o ritmo da semana no Início.
  upsert(ds.key, { id: it.id, [cfg.done]: val, ...(ds.key === 'tasks' ? { doneAt: val ? today() : null } : {}) });
});

export const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
export const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || 'O';
export { esc };
