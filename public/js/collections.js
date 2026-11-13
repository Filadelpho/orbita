// Definição declarativa de cada coleção: campos, exibição e regras.
import { today } from './store.js';

export const EXPENSE_CATS = ['Alimentação', 'Moradia', 'Transporte', 'Saúde', 'Educação', 'Lazer', 'Assinaturas', 'Compras', 'Outros'];
export const INCOME_CATS = ['Salário', 'Freelance', 'Investimentos', 'Presente', 'Outros'];
export const AREAS = ['Pessoal', 'Trabalho', 'Estudos', 'Finanças', 'Saúde', 'Carreira', 'Conteúdo'];

const PRIORITY_COLOR = { Alta: 'red', 'Média': 'yellow', Baixa: 'green' };
const STATUS_COLOR = {
  'Entregue': 'green', 'Concluído': 'green', 'Publicado': 'green', 'Lido': 'green', 'Realizada': 'green',
  'Em andamento': 'blue', 'Lendo': 'blue', 'Agendado': 'blue', 'Confirmada': 'blue', 'Em revisão': 'yellow', 'Gravação': 'yellow',
};

export const COLLECTIONS = {
  tasks: {
    label: 'Tarefas', singular: 'tarefa', icon: 'check', done: 'done',
    fields: [
      { name: 'title', label: 'Título', type: 'text', required: true, full: true },
      { name: 'due', label: 'Data', type: 'date', default: today },
      { name: 'time', label: 'Horário', type: 'time' },
      { name: 'priority', label: 'Prioridade', type: 'select', options: ['Alta', 'Média', 'Baixa'], default: 'Média' },
      { name: 'area', label: 'Área', type: 'select', options: AREAS },
      { name: 'project', label: 'Projeto', type: 'text' },
      { name: 'tags', label: 'Tags', type: 'text' },
      { name: 'notes', label: 'Notas', type: 'textarea', full: true },
    ],
    meta: ['due', 'time', 'priority', 'project', 'tags'],
    sort: (a, b) => (a.done - b.done) || (a.due || '9').localeCompare(b.due || '9') || (a.time || '').localeCompare(b.time || ''),
  },
  events: {
    label: 'Compromissos', singular: 'compromisso', icon: 'calendar',
    fields: [
      { name: 'title', label: 'Título', type: 'text', required: true, full: true },
      { name: 'date', label: 'Data', type: 'date', default: today, required: true },
      { name: 'time', label: 'Horário', type: 'time' },
      { name: 'location', label: 'Local', type: 'text', full: true },
      { name: 'notes', label: 'Notas', type: 'textarea', full: true },
    ],
    meta: ['date', 'time', 'location'],
    sort: (a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')),
  },
  habits: {
    label: 'Hábitos', singular: 'hábito', icon: 'repeat',
    fields: [
      { name: 'emoji', label: 'Emoji', type: 'text', default: '✨' },
      { name: 'target', label: 'Meta (dias/semana)', type: 'number', default: 5 },
      { name: 'name', label: 'Nome do hábito', type: 'text', required: true, full: true },
    ],
  },
  goals: {
    label: 'Metas', singular: 'meta', icon: 'target',
    fields: [
      { name: 'title', label: 'Meta', type: 'text', required: true, full: true },
      { name: 'area', label: 'Área', type: 'select', options: AREAS },
      { name: 'deadline', label: 'Prazo', type: 'date' },
      { name: 'progress', label: 'Progresso', type: 'progress', full: true, default: 0 },
    ],
    meta: ['area', 'deadline'], progress: 'progress',
    sort: (a, b) => (a.deadline || '9').localeCompare(b.deadline || '9'),
  },
  personalProjects: {
    label: 'Projetos pessoais', singular: 'projeto', icon: 'folder', kanban: 'status',
    fields: [
      { name: 'title', label: 'Projeto', type: 'text', required: true, full: true },
      { name: 'status', label: 'Status', type: 'select', options: ['Planejado', 'Em andamento', 'Pausado', 'Concluído'], default: 'Planejado' },
      { name: 'deadline', label: 'Prazo', type: 'date' },
      { name: 'notes', label: 'Notas', type: 'textarea', full: true },
    ],
    meta: ['deadline'],
  },
  workProjects: {
    label: 'Projetos e entregas', singular: 'projeto', icon: 'briefcase', kanban: 'status',
    fields: [
      { name: 'title', label: 'Projeto / entrega', type: 'text', required: true, full: true },
      { name: 'client', label: 'Cliente', type: 'text' },
      { name: 'status', label: 'Status', type: 'select', options: ['A fazer', 'Em andamento', 'Em revisão', 'Entregue'], default: 'A fazer' },
      { name: 'deadline', label: 'Prazo', type: 'date' },
      { name: 'value', label: 'Valor (R$)', type: 'money' },
      { name: 'notes', label: 'Notas', type: 'textarea', full: true },
    ],
    meta: ['client', 'deadline', 'value'],
  },
  career: {
    label: 'Carreira e portfólio', singular: 'item', icon: 'user',
    fields: [
      { name: 'title', label: 'Título', type: 'text', required: true, full: true },
      { name: 'type', label: 'Tipo', type: 'select', options: ['Habilidade', 'Certificação', 'Experiência', 'Portfólio', 'Formação', 'Objetivo'] },
      { name: 'date', label: 'Data', type: 'date' },
      { name: 'link', label: 'Link', type: 'url', full: true },
      { name: 'notes', label: 'Descrição', type: 'textarea', full: true },
    ],
    meta: ['type', 'date', 'link'], sub: 'notes',
  },
  studies: {
    label: 'Cursos e matérias', singular: 'estudo', icon: 'grad',
    fields: [
      { name: 'title', label: 'Curso / matéria', type: 'text', required: true, full: true },
      { name: 'category', label: 'Categoria', type: 'select', options: ['Faculdade', 'Programação', 'Idiomas', 'Curso', 'Certificação', 'Outro'] },
      { name: 'deadline', label: 'Prazo / prova', type: 'date' },
      { name: 'hours', label: 'Horas estudadas', type: 'number' },
      { name: 'progress', label: 'Progresso', type: 'progress', full: true, default: 0 },
    ],
    meta: ['category', 'deadline', 'hours'], progress: 'progress',
  },
  books: {
    label: 'Leituras', singular: 'livro', icon: 'book', kanban: 'status',
    fields: [
      { name: 'title', label: 'Livro', type: 'text', required: true, full: true },
      { name: 'author', label: 'Autor(a)', type: 'text' },
      { name: 'status', label: 'Status', type: 'select', options: ['Quero ler', 'Lendo', 'Lido'], default: 'Quero ler' },
      { name: 'pages', label: 'Páginas', type: 'number' },
      { name: 'read', label: 'Páginas lidas', type: 'number' },
    ],
    meta: ['author'],
    progressOf: (x) => (x.pages ? Math.round(((x.read || 0) / x.pages) * 100) : 0),
  },
  transactions: {
    label: 'Receitas e despesas', singular: 'lançamento', icon: 'wallet',
    fields: [
      { name: 'desc', label: 'Descrição', type: 'text', required: true, full: true },
      { name: 'type', label: 'Tipo', type: 'select', options: ['Despesa', 'Receita'], default: 'Despesa' },
      { name: 'amount', label: 'Valor (R$)', type: 'money', required: true },
      { name: 'category', label: 'Categoria', type: 'select', options: [...EXPENSE_CATS, ...INCOME_CATS.filter((c) => c !== 'Outros')] },
      { name: 'date', label: 'Data', type: 'date', default: today },
    ],
    primary: 'desc', meta: ['category', 'date'], amount: 'amount',
    sort: (a, b) => b.date.localeCompare(a.date),
  },
  bills: {
    label: 'Contas e dívidas', singular: 'conta', icon: 'clock', done: 'paid',
    fields: [
      { name: 'title', label: 'Conta / dívida', type: 'text', required: true, full: true },
      { name: 'type', label: 'Tipo', type: 'select', options: ['Conta', 'Dívida'] },
      { name: 'amount', label: 'Valor da parcela (R$)', type: 'money', required: true },
      { name: 'due', label: 'Vencimento', type: 'date', default: today },
      { name: 'remaining', label: 'Saldo devedor (R$)', type: 'money' },
    ],
    meta: ['type', 'due', 'remaining'], amount: 'amount',
    sort: (a, b) => (a.paid - b.paid) || a.due.localeCompare(b.due),
  },
  investments: {
    label: 'Investimentos', singular: 'investimento', icon: 'chart',
    fields: [
      { name: 'name', label: 'Ativo', type: 'text', required: true, full: true },
      { name: 'type', label: 'Tipo', type: 'select', options: ['Renda fixa', 'Ações', 'ETF', 'FII', 'Cripto', 'Caixa', 'Outro'] },
      { name: 'amount', label: 'Valor aplicado (R$)', type: 'money', required: true },
      { name: 'return', label: 'Rentabilidade anual (%)', type: 'number' },
    ],
    primary: 'name', meta: ['type', 'return'], amount: 'amount',
  },
  subscriptions: {
    label: 'Assinaturas', singular: 'assinatura', icon: 'refresh',
    fields: [
      { name: 'name', label: 'Serviço', type: 'text', required: true, full: true },
      { name: 'amount', label: 'Valor (R$)', type: 'money', required: true },
      { name: 'cycle', label: 'Ciclo', type: 'select', options: ['Mensal', 'Anual'] },
      { name: 'next', label: 'Próxima cobrança', type: 'date' },
      { name: 'category', label: 'Categoria', type: 'text' },
    ],
    primary: 'name', meta: ['cycle', 'next', 'category'], amount: 'amount',
  },
  moods: {
    label: 'Humor', singular: 'registro de humor', icon: 'smile',
    fields: [
      { name: 'date', label: 'Data', type: 'date', default: today },
      { name: 'score', label: 'Humor (1 a 5)', type: 'number', default: 3 },
      { name: 'energy', label: 'Energia (1 a 5)', type: 'number' },
      { name: 'note', label: 'Nota', type: 'textarea', full: true },
    ],
  },
  journal: {
    label: 'Diário', singular: 'entrada', icon: 'pen',
    fields: [
      { name: 'title', label: 'Título', type: 'text', required: true },
      { name: 'date', label: 'Data', type: 'date', default: today },
      { name: 'mood', label: 'Como você está?', type: 'select', options: ['Ótimo', 'Bem', 'Neutro', 'Cansado(a)', 'Triste', 'Ansioso(a)'] },
      { name: 'text', label: 'Escreva livremente', type: 'textarea', full: true },
    ],
    meta: ['date', 'mood'], sub: 'text',
    sort: (a, b) => b.date.localeCompare(a.date),
  },
  sleep: {
    label: 'Sono', singular: 'noite', icon: 'moon',
    fields: [
      { name: 'date', label: 'Data', type: 'date', default: today },
      { name: 'hours', label: 'Horas dormidas', type: 'number', required: true },
      { name: 'quality', label: 'Qualidade', type: 'select', options: ['Ruim', 'Ok', 'Boa', 'Ótima'] },
    ],
    primary: 'date', meta: ['hours', 'quality'],
    sort: (a, b) => b.date.localeCompare(a.date),
  },
  workouts: {
    label: 'Exercícios', singular: 'treino', icon: 'dumbbell',
    fields: [
      { name: 'type', label: 'Atividade', type: 'select', options: ['Musculação', 'Corrida', 'Caminhada', 'Bike', 'Natação', 'Yoga', 'Funcional', 'Outro'], required: true },
      { name: 'date', label: 'Data', type: 'date', default: today },
      { name: 'duration', label: 'Duração (min)', type: 'number' },
      { name: 'notes', label: 'Detalhes', type: 'text', full: true },
    ],
    primary: 'type', meta: ['date', 'duration'], sub: 'notes',
    sort: (a, b) => b.date.localeCompare(a.date),
  },
  meals: {
    label: 'Alimentação', singular: 'refeição', icon: 'heart',
    fields: [
      { name: 'meal', label: 'Refeição', type: 'select', options: ['Café da manhã', 'Lanche', 'Almoço', 'Jantar', 'Ceia'], required: true },
      { name: 'date', label: 'Data', type: 'date', default: today },
      { name: 'description', label: 'O que comeu', type: 'text', full: true },
      { name: 'kcal', label: 'Calorias (kcal)', type: 'number' },
    ],
    primary: 'meal', meta: ['date', 'kcal'], sub: 'description',
    sort: (a, b) => b.date.localeCompare(a.date),
  },
  posts: {
    label: 'Planejamento editorial', singular: 'publicação', icon: 'pen', kanban: 'status',
    fields: [
      { name: 'title', label: 'Título / tema', type: 'text', required: true, full: true },
      { name: 'platform', label: 'Plataforma', type: 'select', options: ['Instagram', 'TikTok', 'YouTube', 'LinkedIn', 'Blog', 'X', 'Outro'] },
      { name: 'status', label: 'Status', type: 'select', options: ['Ideia', 'Roteiro', 'Gravação', 'Agendado', 'Publicado'], default: 'Ideia' },
      { name: 'date', label: 'Data de publicação', type: 'date' },
      { name: 'script', label: 'Roteiro', type: 'textarea', full: true },
      { name: 'views', label: 'Visualizações', type: 'number' },
      { name: 'likes', label: 'Curtidas', type: 'number' },
    ],
    meta: ['platform', 'date'],
  },
  ideas: {
    label: 'Ideias e referências', singular: 'ideia', icon: 'bolt',
    fields: [
      { name: 'title', label: 'Ideia', type: 'text', required: true, full: true },
      { name: 'tags', label: 'Tags', type: 'text' },
      { name: 'link', label: 'Link de referência', type: 'url' },
      { name: 'notes', label: 'Notas', type: 'textarea', full: true },
    ],
    meta: ['tags', 'link'], sub: 'notes',
  },
  trips: {
    label: 'Viagens', singular: 'viagem', icon: 'plane',
    fields: [
      { name: 'destination', label: 'Destino', type: 'text', required: true, full: true },
      { name: 'start', label: 'Ida', type: 'date' },
      { name: 'end', label: 'Volta', type: 'date' },
      { name: 'budget', label: 'Orçamento (R$)', type: 'money' },
      { name: 'spent', label: 'Já gasto (R$)', type: 'money' },
      { name: 'status', label: 'Status', type: 'select', options: ['Sonho', 'Planejando', 'Confirmada', 'Realizada'] },
      { name: 'itinerary', label: 'Roteiro', type: 'textarea', full: true },
    ],
    primary: 'destination', meta: ['status', 'start', 'end'],
    progressOf: (x) => (x.budget ? Math.min(100, Math.round(((x.spent || 0) / x.budget) * 100)) : 0),
    progressLabel: (x) => `${brl(x.spent || 0)} de ${brl(x.budget || 0)}`,
    sub: 'itinerary',
    sort: (a, b) => (a.start || '9').localeCompare(b.start || '9'),
  },
  leisure: {
    label: 'Lazer', singular: 'atividade', icon: 'smile',
    fields: [
      { name: 'title', label: 'Atividade', type: 'text', required: true, full: true },
      { name: 'type', label: 'Tipo', type: 'select', options: ['Filme', 'Série', 'Evento', 'Passeio', 'Jogo', 'Restaurante', 'Outro'] },
      { name: 'date', label: 'Quando', type: 'date' },
    ],
    meta: ['type', 'date'],
  },
};

// ---------- Formatação ----------
const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const brl = (n) => BRL.format(+n || 0);
export const brlShort = (n) => {
  const v = +n || 0;
  if (Math.abs(v) >= 1000) return 'R$ ' + (v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + 'k';
  return 'R$ ' + Math.round(v);
};
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const MONTHS_FULL = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
export const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const monthShort = (m) => MONTHS[m];

export function fmtDate(s) {
  if (!s) return '';
  const [y, m, d] = s.split('-').map(Number);
  const cur = new Date().getFullYear();
  return `${d} ${MONTHS[m - 1]}${y !== cur ? ' ' + y : ''}`;
}

export function relDate(s) {
  if (!s) return '';
  const t = today();
  if (s === t) return 'Hoje';
  const diff = Math.round((new Date(s + 'T12:00') - new Date(t + 'T12:00')) / 86400000);
  if (diff === 1) return 'Amanhã';
  if (diff === -1) return 'Ontem';
  if (diff > 1 && diff < 7) return `Em ${diff} dias`;
  if (diff < -1 && diff > -7) return `Há ${-diff} dias`;
  return fmtDate(s);
}

export function chipFor(field, value, item) {
  if (value === undefined || value === null || value === '') return '';
  const esc = escapeHtml;
  switch (field.type) {
    case 'date': {
      const overdue = value < today() && !(item.done || item.paid);
      const isToday = value === today();
      return `<span class="chip ${overdue ? 'red' : isToday ? 'blue' : ''}">${relDate(value)}</span>`;
    }
    case 'time': return `<span class="chip">${esc(value)}</span>`;
    case 'money': return +value ? `<span class="chip">${brl(value)}</span>` : '';
    case 'url': return `<a class="chip blue" href="${esc(value)}" target="_blank" rel="noopener">Link ↗</a>`;
    case 'number': {
      const suffix = field.name === 'hours' ? ' h' : field.name === 'duration' ? ' min' : field.name === 'kcal' ? ' kcal' : field.name === 'return' ? '% a.a.' : '';
      return `<span class="chip">${esc(value)}${suffix}</span>`;
    }
    case 'select': {
      const color = PRIORITY_COLOR[value] && field.name === 'priority' ? PRIORITY_COLOR[value] : STATUS_COLOR[value] || '';
      return `<span class="chip ${color}">${esc(value)}</span>`;
    }
    default: return `<span class="chip">${esc(value)}</span>`;
  }
}

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export const primaryOf = (cfg, item) => item[cfg.primary || (cfg.fields.find((f) => f.name === 'title') ? 'title' : cfg.fields[0].name)];
