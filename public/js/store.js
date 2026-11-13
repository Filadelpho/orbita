// Estado do app + persistência local (localStorage). Tudo fica no dispositivo.
const KEY = 'orbita:data:v1';

export const iso = (d = new Date()) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
};
export const today = () => iso();
export const addDays = (n, base = new Date()) => {
  const d = typeof base === 'string' ? parseISO(base) : new Date(base);
  d.setDate(d.getDate() + n);
  return iso(d);
};
export const parseISO = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export const ALL_MODULES = [
  'tasks', 'calendar', 'habits', 'goals', 'work', 'studies',
  'finance', 'health', 'content', 'travel',
];

export const DEFAULT_SETTINGS = {
  theme: 'dark',
  modules: Object.fromEntries(ALL_MODULES.map((m) => [m, true])),
  widgets: { mood: true, habits: true, tasks: true, events: true, finance: true, focus: true, goals: true, ai: true, content: true, studies: true },
  cover: 'orbita',
  budgets: {
    'Alimentação': 1400, 'Moradia': 2200, 'Transporte': 450, 'Lazer': 500,
    'Saúde': 300, 'Educação': 400, 'Assinaturas': 150, 'Compras': 400,
  },
  notifications: true,
  twofa: false,
  currency: 'BRL',
};

const listeners = new Set();
export const subscribe = (fn) => listeners.add(fn);

export let state = load();

function blank() {
  return { user: null, onboarded: false, settings: structuredClone(DEFAULT_SETTINGS), data: {}, integrations: {}, ai: [] };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      const b = blank();
      return {
        ...b, ...s,
        settings: { ...b.settings, ...s.settings, modules: { ...b.settings.modules, ...(s.settings?.modules || {}) }, widgets: { ...b.settings.widgets, ...(s.settings?.widgets || {}) } },
        data: s.data || {},
      };
    }
  } catch (e) { /* dados corrompidos: recomeça */ }
  return blank();
}

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage cheio/bloqueado */ }
  listeners.forEach((fn) => fn());
}

export function replaceState(next) {
  state = next;
  save();
}

export function resetAll() {
  localStorage.removeItem(KEY);
  state = blank();
  save();
}

export const items = (key) => (state.data[key] ||= []);

export function upsert(key, obj) {
  const list = items(key);
  if (obj.id) {
    const i = list.findIndex((x) => x.id === obj.id);
    if (i >= 0) list[i] = { ...list[i], ...obj };
    else list.push(obj);
  } else {
    obj.id = uid();
    obj.createdAt = Date.now();
    list.push(obj);
  }
  save();
  return obj;
}

export function remove(key, id) {
  state.data[key] = items(key).filter((x) => x.id !== id);
  save();
}

export function find(key, id) {
  return items(key).find((x) => x.id === id);
}

// ---------- Dados de exemplo para a primeira experiência ----------
function rng(seed) {
  let s = seed;
  return () => ((s = (s * 9301 + 49297) % 233280) / 233280);
}

export function seed() {
  const r = rng(42);
  const T = today();
  const d = {};
  const id = (o) => ({ id: uid(), createdAt: Date.now(), ...o });

  d.tasks = [
    { title: 'Revisar proposta do cliente', due: T, time: '10:00', priority: 'Alta', area: 'Trabalho' },
    { title: 'Pagar fatura do cartão', due: T, priority: 'Alta', area: 'Finanças' },
    { title: 'Estudar capítulo 4 de Algoritmos', due: T, time: '19:00', priority: 'Média', area: 'Estudos' },
    { title: 'Agendar check-up anual', due: addDays(-1), priority: 'Média', area: 'Saúde' },
    { title: 'Comprar presente de aniversário', due: addDays(1), priority: 'Baixa', area: 'Pessoal' },
    { title: 'Gravar vídeo sobre produtividade', due: addDays(2), priority: 'Média', area: 'Conteúdo' },
    { title: 'Atualizar currículo no LinkedIn', due: addDays(-2), priority: 'Baixa', area: 'Carreira', done: true },
    { title: 'Organizar documentos da viagem', due: addDays(5), priority: 'Baixa', area: 'Pessoal' },
  ].map((t) => id({ done: false, ...t }));

  d.events = [
    { title: 'Daily com o time', date: T, time: '09:30', location: 'Google Meet' },
    { title: 'Academia — treino de pernas', date: T, time: '18:00', location: 'Smart Fit' },
    { title: 'Aula de inglês', date: addDays(1), time: '20:00', location: 'Online' },
    { title: 'Jantar com amigos', date: addDays(3), time: '20:30', location: 'Centro' },
    { title: 'Prova de Banco de Dados', date: addDays(6), time: '08:00', location: 'Faculdade' },
    { title: 'Reunião de feedback', date: addDays(8), time: '15:00', location: 'Escritório' },
  ].map(id);

  const habitDefs = [
    { name: 'Beber 2L de água', emoji: '💧', target: 7 },
    { name: 'Ler 20 páginas', emoji: '📚', target: 5 },
    { name: 'Treinar', emoji: '🏋️', target: 4 },
    { name: 'Meditar 10 min', emoji: '🧘', target: 5 },
    { name: 'Estudar inglês', emoji: '🗣️', target: 5 },
  ];
  d.habits = habitDefs.map((h, i) => {
    const log = {};
    for (let k = 1; k < 21; k++) if (r() < 0.55 + i * 0.05) log[addDays(-k)] = true;
    return id({ ...h, log });
  });

  d.goals = [
    { title: 'Juntar R$ 15.000 de reserva', area: 'Finanças', deadline: addDays(180), progress: 45 },
    { title: 'Ler 24 livros no ano', area: 'Pessoal', deadline: addDays(50), progress: 70 },
    { title: 'Conseguir certificação AWS', area: 'Carreira', deadline: addDays(120), progress: 30 },
    { title: 'Correr 10 km', area: 'Saúde', deadline: addDays(90), progress: 55 },
  ].map(id);

  d.personalProjects = [
    { title: 'Reformar o home office', status: 'Em andamento', deadline: addDays(30), notes: 'Mesa nova, iluminação e cadeira.' },
    { title: 'Aprender violão', status: 'Planejado', deadline: addDays(200), notes: '' },
  ].map(id);

  d.workProjects = [
    { title: 'Landing page — Cliente Aurora', client: 'Aurora', status: 'Em andamento', deadline: addDays(4), value: 4500 },
    { title: 'App de delivery — MVP', client: 'Fome Zero', status: 'A fazer', deadline: addDays(21), value: 12000 },
    { title: 'Relatório trimestral', client: 'Interno', status: 'Em revisão', deadline: addDays(2), value: 0 },
    { title: 'Identidade visual — Café Lua', client: 'Café Lua', status: 'Entregue', deadline: addDays(-6), value: 2800 },
  ].map(id);

  d.career = [
    { title: 'TypeScript avançado', type: 'Habilidade', date: addDays(-40), link: '', notes: 'Generics, tipos utilitários.' },
    { title: 'Portfólio 2026', type: 'Portfólio', date: addDays(-10), link: 'https://github.com', notes: '6 projetos publicados.' },
    { title: 'Desenvolvedora Front-end Pleno', type: 'Experiência', date: addDays(-400), link: '', notes: 'React, design systems.' },
  ].map(id);

  d.studies = [
    { title: 'Faculdade — Banco de Dados', category: 'Faculdade', progress: 65, deadline: addDays(6), hours: 32 },
    { title: 'React + TypeScript', category: 'Programação', progress: 80, deadline: addDays(25), hours: 41 },
    { title: 'Inglês B2 — Conversação', category: 'Idiomas', progress: 40, deadline: addDays(150), hours: 58 },
    { title: 'AWS Cloud Practitioner', category: 'Certificação', progress: 30, deadline: addDays(60), hours: 12 },
  ].map(id);

  d.books = [
    { title: 'Hábitos Atômicos', author: 'James Clear', pages: 320, read: 320, status: 'Lido' },
    { title: 'Código Limpo', author: 'Robert C. Martin', pages: 425, read: 190, status: 'Lendo' },
    { title: 'Essencialismo', author: 'Greg McKeown', pages: 272, read: 0, status: 'Quero ler' },
  ].map(id);

  const tx = [];
  for (let m = 5; m >= 0; m--) {
    const base = new Date(); base.setDate(1); base.setMonth(base.getMonth() - m);
    const day = (n) => { const x = new Date(base); x.setDate(n); return iso(x); };
    const cap = m === 0 ? new Date().getDate() : 28;
    const push = (o) => { if (+o.date.slice(8) <= cap) tx.push(id(o)); };
    push({ desc: 'Salário', type: 'Receita', amount: 6500, category: 'Salário', date: day(5) });
    if (r() > 0.4) push({ desc: 'Projeto freelance', type: 'Receita', amount: Math.round(800 + r() * 2200), category: 'Freelance', date: day(18) });
    push({ desc: 'Aluguel', type: 'Despesa', amount: 1800, category: 'Moradia', date: day(6) });
    push({ desc: 'Conta de luz', type: 'Despesa', amount: Math.round(140 + r() * 80), category: 'Moradia', date: day(10) });
    for (let k = 0; k < 4; k++) push({ desc: 'Mercado', type: 'Despesa', amount: Math.round(180 + r() * 220), category: 'Alimentação', date: day(3 + k * 7) });
    push({ desc: 'Restaurante', type: 'Despesa', amount: Math.round(60 + r() * 140), category: 'Alimentação', date: day(13) });
    push({ desc: 'Uber / transporte', type: 'Despesa', amount: Math.round(120 + r() * 200), category: 'Transporte', date: day(15) });
    push({ desc: 'Cinema e lazer', type: 'Despesa', amount: Math.round(80 + r() * 300), category: 'Lazer', date: day(20) });
    push({ desc: 'Farmácia', type: 'Despesa', amount: Math.round(40 + r() * 120), category: 'Saúde', date: day(11) });
    push({ desc: 'Curso online', type: 'Despesa', amount: 89, category: 'Educação', date: day(2) });
    push({ desc: 'Assinaturas', type: 'Despesa', amount: 112.7, category: 'Assinaturas', date: day(8) });
    if (r() > 0.5) push({ desc: 'Roupas', type: 'Despesa', amount: Math.round(150 + r() * 300), category: 'Compras', date: day(22) });
  }
  d.transactions = tx;

  d.bills = [
    { title: 'Fatura cartão Nubank', type: 'Conta', amount: 1840.5, due: T, paid: false },
    { title: 'Internet fibra', type: 'Conta', amount: 119.9, due: addDays(3), paid: false },
    { title: 'Financiamento do carro', type: 'Dívida', amount: 980, due: addDays(12), paid: false, remaining: 14700 },
    { title: 'Condomínio', type: 'Conta', amount: 520, due: addDays(-3), paid: true },
  ].map(id);

  d.investments = [
    { name: 'Tesouro Selic 2029', type: 'Renda fixa', amount: 4200, return: 10.6 },
    { name: 'CDB 110% CDI', type: 'Renda fixa', amount: 2500, return: 11.8 },
    { name: 'IVVB11', type: 'ETF', amount: 1800, return: 18.2 },
    { name: 'Reserva de emergência', type: 'Caixa', amount: 6750, return: 9.8 },
  ].map(id);

  d.subscriptions = [
    { name: 'Spotify', amount: 21.9, cycle: 'Mensal', next: addDays(2), category: 'Lazer' },
    { name: 'Netflix', amount: 44.9, cycle: 'Mensal', next: addDays(9), category: 'Lazer' },
    { name: 'iCloud 200 GB', amount: 14.9, cycle: 'Mensal', next: addDays(15), category: 'Serviços' },
    { name: 'ChatGPT / IA', amount: 31, cycle: 'Mensal', next: addDays(20), category: 'Trabalho' },
  ].map(id);

  d.moods = [];
  d.focus = [50, 75, 25, 100, 50, 75].map((minutes, i) => id({ date: addDays(-(i + 1)), minutes }));
  d.sleep = [];
  for (let k = 13; k >= 1; k--) {
    d.moods.push(id({ date: addDays(-k), score: Math.max(1, Math.min(5, Math.round(3 + (r() - 0.35) * 3))), energy: 1 + Math.floor(r() * 5), note: '' }));
    d.sleep.push(id({ date: addDays(-k), hours: +(5.5 + r() * 3).toFixed(1), quality: ['Ruim', 'Ok', 'Boa', 'Ótima'][Math.floor(r() * 4)] }));
  }

  d.workouts = [
    { date: addDays(-1), type: 'Musculação', duration: 60, notes: 'Peito e tríceps' },
    { date: addDays(-3), type: 'Corrida', duration: 35, notes: '5 km' },
    { date: addDays(-4), type: 'Musculação', duration: 55, notes: 'Costas e bíceps' },
    { date: addDays(-6), type: 'Yoga', duration: 30, notes: '' },
  ].map(id);

  d.meals = [
    { date: T, meal: 'Café da manhã', description: 'Ovos, pão integral e café', kcal: 420 },
    { date: T, meal: 'Almoço', description: 'Frango, arroz, feijão e salada', kcal: 680 },
  ].map(id);

  d.journal = [
    { date: addDays(-1), title: 'Dia produtivo', text: 'Consegui terminar a entrega e ainda treinar. Preciso dormir mais cedo.', mood: 'Bem' },
    { date: addDays(-4), title: 'Semana pesada', text: 'Muitas reuniões. Vou bloquear horários de foco no calendário.', mood: 'Cansado(a)' },
  ].map(id);

  d.posts = [
    { title: '5 hábitos que mudaram minha rotina', platform: 'Instagram', status: 'Roteiro', date: addDays(2), views: 0, likes: 0 },
    { title: 'Como organizo minhas finanças', platform: 'YouTube', status: 'Ideia', date: addDays(9), views: 0, likes: 0 },
    { title: 'Setup do home office', platform: 'TikTok', status: 'Gravação', date: addDays(4), views: 0, likes: 0 },
    { title: 'Rotina de estudos para a faculdade', platform: 'Instagram', status: 'Publicado', date: addDays(-5), views: 12400, likes: 980 },
    { title: 'Review: melhores apps de produtividade', platform: 'YouTube', status: 'Publicado', date: addDays(-12), views: 8300, likes: 610 },
    { title: 'Um dia comigo', platform: 'TikTok', status: 'Agendado', date: addDays(1), views: 0, likes: 0 },
  ].map(id);

  d.ideas = [
    { title: 'Série “30 dias organizando a vida”', tags: 'série, produtividade', link: '', notes: 'Um vídeo curto por dia mostrando um módulo.' },
    { title: 'Referência de paleta minimalista', tags: 'design', link: 'https://www.apple.com', notes: '' },
  ].map(id);

  d.trips = [
    { destination: 'Florianópolis, SC', start: addDays(40), end: addDays(45), budget: 3500, spent: 1200, status: 'Planejando', itinerary: 'Dia 1: Lagoa da Conceição\nDia 2: Praia Mole e Joaquina\nDia 3: Centro histórico' },
    { destination: 'Lisboa, Portugal', start: addDays(210), end: addDays(222), budget: 14000, spent: 0, status: 'Sonho', itinerary: '' },
  ].map(id);

  d.leisure = [
    { title: 'Assistir Duna: Parte 3', type: 'Filme', date: addDays(6) },
    { title: 'Show no fim de semana', type: 'Evento', date: addDays(10) },
  ].map(id);

  state.data = d;
  state.ai = [];
}
