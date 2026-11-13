// Capa do Início: animada (pixels), foto do Unsplash ou foto da própria pessoa.
import { state, save } from './store.js';
import { escapeHtml as esc } from './collections.js';
import { icon } from './icons.js';
import { ui, on, openOverlay, closeOverlay, toast } from './ui.js';
import { COVERS, COVER_KEYS, mountCover } from './pixels.js';

// Fotos selecionadas do Unsplash (licença Unsplash: uso gratuito, crédito ao fotógrafo).
export const UNSPLASH = [
  { id: 'photo-1491466424936-e304919aada7', user: 'r3dmax', alt: 'Aurora boreal' },
  { id: 'photo-1469474968028-56623f02e42e', user: 'urban_vintage', alt: 'Montanha com raios de sol' },
  { id: 'photo-1771128479085-710e103b9ee0', user: 'dvzsg', alt: 'Céu estrelado' },
  { id: 'photo-1787752412212-b04483b35a5c', user: 'maldivianist', alt: 'Formas abstratas em azul e laranja' },
  { id: 'photo-1762174092757-251b3e6a8eca', user: 'hassaanhre', alt: 'Curvas de papel azul' },
  { id: 'photo-1482784160316-6eb046863ece', user: 'jmsdono', alt: 'Pinheiros com neve' },
  { id: 'photo-1499678329028-101435549a4e', user: 'andersjilden', alt: 'Vernazza ao pôr do sol' },
  { id: 'photo-1501854140801-50d01698950b', user: 'ideasboom', alt: 'Montanhas verdes' },
  { id: 'photo-1764162085838-949ea3d283e4', user: 'olazarko', alt: 'Colinas verdes' },
  { id: 'photo-1507187632231-5beb21a654a2', user: 'danfreemanphoto', alt: 'Coqueiros refletidos na água' },
  { id: 'photo-1500673922987-e212871fec22', user: 'jplenio', alt: 'Luzes entre árvores' },
  { id: 'photo-1431440869543-efaf3388c585', user: 'brenomachado', alt: 'Tempestade de raios' },
];
const UTM = '?utm_source=orbita&utm_medium=referral';
let posTimer = null;
const unsplashSrc = (id, w = 2400) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;
const unsplashThumb = (id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=420&h=240&q=60`;

// Marcação da capa usada pelo Início.
export function coverArt() {
  const img = state.settings.coverImage;
  if (!img) return `<div class="cover-art" id="cover-slot"><div class="pixel-grid"></div><div class="cover-fade"></div></div>`;
  const credit = img.user
    ? `<a class="cover-credit" href="https://unsplash.com/@${esc(img.user)}${UTM}" target="_blank" rel="noopener">Foto: @${esc(img.user)} / Unsplash</a>`
    : '';
  return `<div class="cover-art photo"><img class="cover-img" src="${esc(img.src)}" alt="" style="object-position:center ${+img.pos || 50}%"><div class="cover-shade"></div><div class="cover-fade"></div></div>${credit}`;
}
export function mountDashCover() {
  if (state.settings.coverImage) return;
  mountCover(document.getElementById('cover-slot'), state.settings.cover || 'orbita');
}

// ---------- Seletor ----------
const swatch = (k) => {
  const p = COVERS[k], c = (a) => `rgb(${a.join(',')})`;
  return `radial-gradient(circle at 22% 50%, ${c(p.blobs[0])}, transparent 58%), radial-gradient(circle at 88% 12%, ${c(p.blobs[1])}, transparent 52%), radial-gradient(circle at 52% 20%, ${c(p.blobs[2])}88, transparent 40%), ${c(p.bg)}`;
};

function pickerBody() {
  const tab = ui.coverTab || 'animated';
  const cur = state.settings.coverImage;
  if (tab === 'animated') {
    return `<div class="cover-grid">${COVER_KEYS.map((k) => `
      <button class="cover-opt ${!cur && (state.settings.cover || 'orbita') === k ? 'on' : ''}" data-action="cover-animated" data-k="${k}">
        <span class="thumb pix" style="background:${swatch(k)}"></span><span class="name">${esc(COVERS[k].name)}</span></button>`).join('')}</div>`;
  }
  if (tab === 'unsplash') {
    return `<div class="cover-grid">${UNSPLASH.map((p) => `
      <button class="cover-opt ${cur?.id === p.id ? 'on' : ''}" data-action="cover-unsplash" data-id="${p.id}" title="${esc(p.alt)}">
        <span class="thumb"><img src="${unsplashThumb(p.id)}" alt="${esc(p.alt)}" loading="lazy"></span><span class="name">@${esc(p.user)}</span></button>`).join('')}</div>
      <form class="cover-url" data-submit="cover-url">
        <input class="input" name="url" type="url" required placeholder="Ou cole o link de uma imagem do Unsplash">
        <button class="btn">Usar</button>
      </form>
      <p class="cover-note">Fotos gratuitas do <a href="https://unsplash.com/pt-br/s/fotografias/plano-de-fundo-do-windows-10${UTM.replace('?', '&')}" target="_blank" rel="noopener">Unsplash ${icon('arrowUpRight')}</a>. Na página da foto, clique com o botão direito na imagem e copie o endereço dela.</p>`;
  }
  const mine = cur?.type === 'upload' ? cur : null;
  return `<label class="cover-drop" data-drop="cover">
      ${mine ? `<img src="${esc(mine.src)}" alt="Sua foto">` : `<span class="dempty-ico">${icon('image')}</span><b>Escolher uma foto</b><small>JPG, PNG ou WEBP. Também dá para arrastar e soltar aqui.</small>`}
      <input type="file" accept="image/*" data-change="cover-file" hidden>
    </label>
    ${mine ? '<div class="cover-actions"><label class="btn">Trocar foto<input type="file" accept="image/*" data-change="cover-file" hidden></label><button class="btn ghost" data-action="cover-reset">Remover</button></div>' : ''}
    <p class="cover-note">A foto fica salva só neste aparelho.</p>`;
}

function renderPicker() {
  const tab = ui.coverTab || 'animated';
  const cur = state.settings.coverImage;
  const tabs = [['animated', 'Animadas'], ['unsplash', 'Unsplash'], ['upload', 'Sua foto']];
  openOverlay(`<div class="modal cover-modal"><div class="modal-head"><h3>Capa do Início</h3><button class="icon-btn" data-action="close-overlay" aria-label="Fechar">${icon('x')}</button></div>
    <div class="cover-tabs" role="tablist">${tabs.map(([k, l]) => `<button class="cover-tab ${tab === k ? 'on' : ''}" role="tab" aria-selected="${tab === k}" data-action="cover-tab" data-t="${k}">${l}</button>`).join('')}</div>
    <div class="cover-body">${pickerBody()}</div>
    ${cur ? `<div class="cover-pos"><span>Posição da foto</span><input type="range" min="0" max="100" value="${+cur.pos || 50}" data-input="cover-pos" aria-label="Posição vertical da foto"></div>` : ''}
    <div class="modal-foot"><button class="btn primary" data-action="close-overlay">Pronto</button></div></div>`);
}

export function openCoverPicker() {
  ui.coverTab = state.settings.coverImage ? (state.settings.coverImage.type === 'upload' ? 'upload' : 'unsplash') : 'animated';
  renderPicker();
}

const setImage = (img) => {
  state.settings.coverImage = img;
  save();
  renderPicker();
};

on('cover-tab', (ds) => { ui.coverTab = ds.t; renderPicker(); });
on('cover-animated', (ds) => {
  state.settings.cover = ds.k;
  state.settings.coverImage = null;
  save();
  renderPicker();
});
on('cover-unsplash', (ds) => {
  const p = UNSPLASH.find((x) => x.id === ds.id);
  if (p) setImage({ type: 'unsplash', id: p.id, src: unsplashSrc(p.id), user: p.user, pos: 50 });
});
on('cover-url', (ds, form) => {
  let url;
  try { url = new URL(form.elements.url.value.trim()); } catch { return toast('Esse link não parece válido.'); }
  if (url.protocol !== 'https:') return toast('Use um link que comece com https://');
  // Link de página do Unsplash (unsplash.com/photos/...) → imagem da foto.
  // Vale para /photos/, /pt-br/fotografias/ e outros idiomas: o código da foto é o fim do último trecho.
  if (/(^|\.)unsplash\.com$/.test(url.hostname)) {
    const parts = url.pathname.split('/').filter((p) => p && p !== 'download');
    const id = (parts.pop() || '').split('-').pop();
    if (!id || parts.length === 0) return toast('Abra uma foto no Unsplash e copie o link dela.');
    url = new URL(`https://unsplash.com/photos/${id}/download?w=2400`);
  } else if (url.hostname === 'images.unsplash.com') {
    url.search = '?auto=format&fit=crop&w=2400&q=80';
  }
  const src = url.toString();
  const test = new Image();
  test.onload = () => setImage({ type: 'url', src, pos: 50 });
  test.onerror = () => toast('Não consegui abrir essa imagem. Copie o endereço da imagem, não da página.');
  test.src = src;
});
on('cover-reset', () => {
  state.settings.coverImage = null;
  save();
  ui.coverTab = 'animated';
  renderPicker();
  toast('Voltamos para a capa animada');
});
on('cover-pos', (ds, el) => {
  const img = state.settings.coverImage;
  if (!img) return;
  img.pos = +el.value;
  document.querySelector('.cover-img')?.style.setProperty('object-position', `center ${img.pos}%`);
  clearTimeout(posTimer);
  posTimer = setTimeout(save, 250);
});

// Foto da pessoa: reduz para no máximo 1920 px e salva como JPEG para caber no armazenamento do navegador.
function loadFile(file) {
  if (!file || !file.type.startsWith('image/')) return toast('Escolha um arquivo de imagem.');
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      let max = 1920, q = 0.82, data = '';
      for (let i = 0; i < 4; i++) {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        data = c.toDataURL('image/jpeg', q);
        if (data.length < 1_400_000) break;
        max = Math.round(max * 0.8); q -= 0.08;
      }
      const prev = state.settings.coverImage;
      state.settings.coverImage = { type: 'upload', src: data, pos: 50 };
      save();
      // save() ignora erro de armazenamento cheio; confere se a foto foi mesmo gravada.
      let ok = true;
      try { ok = (localStorage.getItem('orbita:data:v1') || '').includes(data.slice(-64)); } catch { ok = false; }
      if (!ok) {
        state.settings.coverImage = prev;
        save();
        toast('A foto é grande demais para salvar neste aparelho. Tente outra menor.');
      } else toast('Capa atualizada');
      ui.coverTab = 'upload';
      renderPicker();
    };
    img.onerror = () => toast('Não consegui ler essa imagem.');
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}
on('cover-file', (ds, el) => loadFile(el.files?.[0]));
document.addEventListener('dragover', (e) => { if (e.target.closest?.('[data-drop=cover]')) { e.preventDefault(); e.target.closest('[data-drop=cover]').classList.add('over'); } });
document.addEventListener('dragleave', (e) => e.target.closest?.('[data-drop=cover]')?.classList.remove('over'));
document.addEventListener('drop', (e) => {
  const z = e.target.closest?.('[data-drop=cover]');
  if (!z) return;
  e.preventDefault();
  z.classList.remove('over');
  loadFile(e.dataTransfer.files?.[0]);
});
