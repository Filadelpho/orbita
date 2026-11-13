// Gráficos SVG leves, sem bibliotecas.
import { escapeHtml as esc } from './collections.js';

// Barras agrupadas: data = [{ label, values: [a, b] }], colors = [c1, c2]
export function groupedBars(data, colors, { height = 180, fmt = (v) => v } = {}) {
  const W = 560, H = height, padL = 44, padB = 24, padT = 8;
  const max = Math.max(1, ...data.flatMap((d) => d.values)) * 1.1;
  const gw = (W - padL) / data.length;
  const n = data[0]?.values.length || 1;
  const bw = Math.min(18, (gw * 0.6) / n);
  const y = (v) => padT + (H - padT - padB) * (1 - v / max);
  let s = '';
  for (let k = 0; k <= 3; k++) {
    const v = (max / 3) * k;
    s += `<line x1="${padL}" x2="${W}" y1="${y(v)}" y2="${y(v)}" stroke="var(--border)"/>`;
    s += `<text x="${padL - 8}" y="${y(v) + 4}" text-anchor="end">${esc(fmt(v))}</text>`;
  }
  data.forEach((d, i) => {
    const cx = padL + gw * i + gw / 2;
    d.values.forEach((v, j) => {
      const x = cx - (bw * n + 4 * (n - 1)) / 2 + j * (bw + 4);
      const h = Math.max(0, H - padB - y(v));
      s += `<rect x="${x}" y="${y(v)}" width="${bw}" height="${h}" rx="4" fill="${colors[j]}"><title>${esc(d.label)}: ${esc(fmt(v))}</title></rect>`;
    });
    s += `<text x="${cx}" y="${H - 6}" text-anchor="middle">${esc(d.label)}</text>`;
  });
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}">${s}</svg></div>`;
}

// Linha/área suave: values = [n...], labels opcionais
export function areaLine(values, { height = 120, min = null, max = null, color = 'var(--accent)', labels = [], dots = true } = {}) {
  const W = 560, H = height, pad = 10, padB = labels.length ? 22 : 8;
  if (!values.length) return '';
  const lo = min ?? Math.min(...values), hi = max ?? Math.max(...values);
  const range = hi - lo || 1;
  const x = (i) => pad + (i * (W - pad * 2)) / Math.max(1, values.length - 1);
  const y = (v) => pad + (H - pad - padB) * (1 - (v - lo) / range);
  const pts = values.map((v, i) => [x(i), y(v)]);
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    const cx = (x0 + x1) / 2;
    d += ` C${cx},${y0} ${cx},${y1} ${x1},${y1}`;
  }
  const gid = 'g' + Math.random().toString(36).slice(2, 7);
  const area = `${d} L${pts.at(-1)[0]},${H - padB} L${pts[0][0]},${H - padB} Z`;
  let s = `<defs><linearGradient id="${gid}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".35"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>`;
  s += `<path d="${area}" fill="url(#${gid})"/><path d="${d}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round"/>`;
  if (dots) pts.forEach(([px, py], i) => { s += `<circle cx="${px}" cy="${py}" r="3.5" fill="var(--surface)" stroke="${color}" stroke-width="2"><title>${esc(labels[i] ?? '')} ${values[i]}</title></circle>`; });
  labels.forEach((l, i) => { if (l) s += `<text x="${x(i)}" y="${H - 4}" text-anchor="middle">${esc(l)}</text>`; });
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}">${s}</svg></div>`;
}

// Anel de progresso
export function ring(pct, { size = 64, stroke = 7, color = 'var(--accent)', label = '' } = {}) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(100, pct)) / 100);
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="flex:none">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--surface-3)" stroke-width="${stroke}"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round"
      stroke-dasharray="${c}" stroke-dashoffset="${off}" transform="rotate(-90 ${size / 2} ${size / 2})" style="transition:stroke-dashoffset .8s"/>
    <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" fill="var(--text)" font-size="${size / 4.4}" font-weight="600" font-family="var(--font)">${esc(label || Math.round(pct) + '%')}</text>
  </svg>`;
}

// Rosca de categorias
export function donut(parts, { size = 150, stroke = 20 } = {}) {
  const total = parts.reduce((a, p) => a + p.value, 0) || 1;
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  let acc = 0, s = '';
  parts.forEach((p) => {
    const len = (p.value / total) * c;
    s += `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${p.color}" stroke-width="${stroke}"
      stroke-dasharray="${Math.max(0, len - 2)} ${c}" stroke-dashoffset="${-acc}" transform="rotate(-90 ${size / 2} ${size / 2})"><title>${esc(p.label)}</title></circle>`;
    acc += len;
  });
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="flex:none">${s}</svg>`;
}

export const PALETTE = ['#0a84ff', '#5ac8fa', '#bf5af2', '#30d158', '#ffd60a', '#ff9f0a', '#ff453a', '#64d2ff', '#8e8e93'];
