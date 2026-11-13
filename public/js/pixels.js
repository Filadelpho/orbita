// Mosaico de pixels animado: manchas de luz que se movem devagar sobre um fundo escuro.
// Usado na tela de entrada e na capa do Início.

export const COVERS = {
  orbita: { name: 'Órbita', bg: [3, 6, 18], blobs: [[20, 140, 255], [70, 60, 255], [90, 200, 250], [20, 40, 160]] },
  nebula: { name: 'Nebulosa', bg: [10, 3, 16], blobs: [[235, 40, 170], [110, 40, 255], [200, 70, 240], [70, 20, 150]] },
  aurora: { name: 'Aurora', bg: [2, 10, 14], blobs: [[0, 190, 160], [30, 110, 255], [110, 240, 190], [10, 70, 100]] },
  sunset: { name: 'Pôr do sol', bg: [14, 4, 8], blobs: [[255, 110, 40], [235, 50, 120], [255, 180, 80], [110, 30, 90]] },
  grafite: { name: 'Grafite', bg: [6, 6, 8], blobs: [[150, 150, 165], [80, 80, 100], [210, 210, 225], [40, 40, 52]] },
};
export const COVER_KEYS = Object.keys(COVERS);

const LAYOUT = [
  { x: 0.2, y: 0.45, r: 0.36, a: 1.5, s: 0.28, p: 0 },
  { x: 0.88, y: 0.1, r: 0.4, a: 1.2, s: 0.2, p: 2 },
  { x: 0.5, y: 0.2, r: 0.22, a: 0.45, s: 0.36, p: 4 },
  { x: 0.75, y: 0.62, r: 0.3, a: 0.45, s: 0.24, p: 1 },
];

/**
 * Anima o canvas enquanto ele estiver na página. Retorna um controle para trocar a paleta.
 * `keepAlive` mantém o laço vivo mesmo fora da página (para a capa, que é reaproveitada entre renderizações).
 */
export function startPixels(canvas, cover = 'orbita', { cell = 4, keepAlive = false } = {}) {
  if (!canvas) return null;
  const ctx = canvas.getContext('2d');
  let pal = COVERS[cover] || COVERS.orbita;
  let w = 0, h = 0, noise = new Float32Array(0), img = null, observed = null;
  const resize = () => {
    const parent = canvas.parentElement;
    if (!parent) return;
    const r = parent.getBoundingClientRect();
    const nw = Math.max(1, Math.ceil(r.width / cell)), nh = Math.max(1, Math.ceil(r.height / cell));
    if (nw === w && nh === h) return;
    w = nw; h = nh;
    canvas.width = w; canvas.height = h;
    noise = new Float32Array(w * h).map(() => Math.random());
    img = ctx.createImageData(w, h);
  };
  const ro = new ResizeObserver(resize);
  const observe = () => {
    if (canvas.parentElement && observed !== canvas.parentElement) {
      if (observed) ro.unobserve(observed);
      observed = canvas.parentElement;
      ro.observe(observed);
      resize();
    }
  };
  observe();
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let last = -1e9, dead = false;
  const draw = (now) => {
    if (!img) return;
    const t = now / 1000, d = img.data, aspect = h / w, { bg, blobs } = pal;
    const pos = LAYOUT.map((b) => [b.x + 0.12 * Math.sin(t * b.s + b.p), b.y + 0.1 * Math.cos(t * b.s * 0.8 + b.p)]);
    for (let y = 0; y < h; y++) {
      const v = y / h;
      for (let x = 0; x < w; x++) {
        const i = y * w + x, u = x / w;
        if (Math.random() < 0.02) noise[i] = Math.random();
        let r = bg[0], g = bg[1], b = bg[2];
        for (let k = 0; k < LAYOUT.length; k++) {
          const L = LAYOUT[k], c = blobs[k], dx = u - pos[k][0], dy = (v - pos[k][1]) * aspect;
          const f = L.a * Math.exp(-(dx * dx + dy * dy) / (L.r * L.r));
          r += c[0] * f; g += c[1] * f; b += c[2] * f;
        }
        const band = 1 - 0.55 * Math.exp(-((u * 0.8 - v + 0.55 + 0.05 * Math.sin(t * 0.3)) ** 2) / 0.02);
        const m = band * (0.55 + noise[i] * 0.6);
        d[i * 4] = r * m; d[i * 4 + 1] = g * m; d[i * 4 + 2] = b * m; d[i * 4 + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  };
  const frame = (now) => {
    if (dead) return;
    if (!canvas.isConnected) {
      if (!keepAlive) { ro.disconnect(); return; }
      requestAnimationFrame(frame);
      return;
    }
    observe();
    if (now - last > 50) { last = now; draw(now); }
    if (!reduce) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  return {
    canvas,
    setCover(key) { pal = COVERS[key] || COVERS.orbita; if (reduce) draw(performance.now()); },
    stop() { dead = true; ro.disconnect(); },
  };
}

// A capa do Início usa sempre o mesmo canvas, para não piscar quando a tela é redesenhada.
let cover = null;
export function mountCover(slot, key) {
  if (!slot) return;
  if (!cover) {
    const c = document.createElement('canvas');
    c.className = 'pixel-canvas';
    slot.prepend(c);
    cover = startPixels(c, key, { keepAlive: true });
  } else {
    slot.prepend(cover.canvas);
    cover.setCover(key);
  }
}
