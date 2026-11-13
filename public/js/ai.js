// ORBITA AI — assistente local. Entende comandos em português, cria registros,
// cruza dados entre módulos e gera relatórios. Roda 100% no dispositivo.
import { state, items, upsert, today, addDays, iso, parseISO } from './store.js';
import { brl, relDate, EXPENSE_CATS } from './collections.js';

const norm = (s) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

// ---------- Métricas compartilhadas ----------
export function monthTx(offset = 0) {
  const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + offset);
  const key = iso(d).slice(0, 7);
  return items('transactions').filter((t) => t.date?.startsWith(key));
}

export function financeSummary(offset = 0) {
  const tx = monthTx(offset);
  const income = tx.filter((t) => t.type === 'Receita').reduce((a, t) => a + +t.amount, 0);
  const expense = tx.filter((t) => t.type === 'Despesa').reduce((a, t) => a + +t.amount, 0);
  const byCat = {};
  tx.filter((t) => t.type === 'Despesa').forEach((t) => { byCat[t.category || 'Outros'] = (byCat[t.category || 'Outros'] || 0) + +t.amount; });
  return { income, expense, balance: income - expense, byCat, count: tx.length };
}

export function habitStreak(h) {
  let n = 0;
  let d = h.log?.[today()] ? today() : addDays(-1);
  while (h.log?.[d]) { n++; d = addDays(-1, d); }
  return n;
}

export function weekHabitRate() {
  const hs = items('habits');
  if (!hs.length) return 0;
  let done = 0;
  for (const h of hs) for (let k = 0; k < 7; k++) if (h.log?.[addDays(-k)]) done++;
  return Math.round((done / (hs.length * 7)) * 100);
}

export function avg(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }

// ---------- Insights automáticos (usados no dashboard e na IA) ----------
export function insights() {
  const out = [];
  const T = today();
  const tasks = items('tasks');
  const overdue = tasks.filter((t) => !t.done && t.due && t.due < T);
  const todayTasks = tasks.filter((t) => !t.done && t.due === T);
  if (overdue.length) out.push({ kind: 'bad', text: `Você tem ${overdue.length} tarefa(s) atrasada(s). Que tal reagendar para hoje ou amanhã?` });
  if (todayTasks.length > 5) out.push({ kind: 'warn', text: `Dia cheio: ${todayTasks.length} tarefas para hoje. Priorize as 3 mais importantes.` });

  const f = financeSummary();
  const budgets = state.settings.budgets || {};
  for (const [cat, spent] of Object.entries(f.byCat)) {
    const lim = budgets[cat];
    if (lim && spent > lim) out.push({ kind: 'bad', text: `Gastos com ${cat} passaram do orçamento: ${brl(spent)} de ${brl(lim)}.` });
    else if (lim && spent > lim * 0.85) out.push({ kind: 'warn', text: `${cat} está em ${Math.round((spent / lim) * 100)}% do orçamento do mês.` });
  }
  const prev = financeSummary(-1);
  if (prev.expense && f.expense && new Date().getDate() >= 7) {
    // Projeção: gastos fixos entram uma vez, os variáveis seguem o ritmo diário.
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const FIXED = ['Moradia', 'Assinaturas', 'Educação'];
    const fixed = FIXED.reduce((a, c) => a + (f.byCat[c] || 0), 0);
    const projected = fixed + ((f.expense - fixed) / now.getDate()) * daysInMonth;
    if (projected > prev.expense * 1.1) out.push({ kind: 'warn', text: `No ritmo atual, seus gastos do mês devem fechar em ~${brl(projected)} (mês passado: ${brl(prev.expense)}).` });
  }

  const bills = items('bills').filter((b) => !b.paid && b.due && b.due <= addDays(3));
  bills.forEach((b) => out.push({ kind: b.due < T ? 'bad' : 'warn', text: `${b.title} (${brl(b.amount)}) vence ${relDate(b.due).toLowerCase()}.` }));

  const sleep = items('sleep').filter((s) => s.date >= addDays(-7)).map((s) => +s.hours);
  if (sleep.length >= 3 && avg(sleep) < 7) out.push({ kind: 'warn', text: `Média de sono da semana: ${avg(sleep).toFixed(1)} h. Tente dormir 30 min mais cedo.` });

  const moods = items('moods').filter((m) => m.date >= addDays(-7)).map((m) => +m.score);
  const workouts = items('workouts').filter((w) => w.date >= addDays(-7));
  if (moods.length >= 3 && avg(moods) < 3) out.push({ kind: 'warn', text: 'Seu humor esteve mais baixo esta semana. Uma caminhada ou pausa pode ajudar.' });
  if (workouts.length >= 3) out.push({ kind: 'good', text: `Ótimo! ${workouts.length} treinos nos últimos 7 dias.` });

  const rate = weekHabitRate();
  if (items('habits').length) out.push({ kind: rate >= 70 ? 'good' : 'info', text: `Consistência de hábitos na semana: ${rate}%.` });

  const best = items('habits').map((h) => [h, habitStreak(h)]).sort((a, b) => b[1] - a[1])[0];
  if (best && best[1] >= 3) out.push({ kind: 'good', text: `Sequência de ${best[1]} dias em “${best[0].name}”. Não quebre a corrente!` });

  const goals = items('goals').filter((g) => g.deadline && g.deadline <= addDays(30) && (+g.progress || 0) < 80);
  goals.forEach((g) => out.push({ kind: 'warn', text: `Meta “${g.title}” vence ${relDate(g.deadline).toLowerCase()} e está em ${g.progress || 0}%.` }));

  if (!out.length) out.push({ kind: 'good', text: 'Tudo em dia por aqui. Bom trabalho!' });
  return out;
}

// ---------- Interpretação de linguagem natural ----------
const WEEK = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
function parseDate(text) {
  const t = norm(text);
  if (/depois de amanha/.test(t)) return addDays(2);
  if (/amanha/.test(t)) return addDays(1);
  if (/hoje/.test(t)) return today();
  const m = t.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (m) {
    const y = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : new Date().getFullYear();
    return iso(new Date(y, +m[2] - 1, +m[1]));
  }
  for (let i = 0; i < 7; i++) {
    if (new RegExp(`\\b${WEEK[i]}`).test(t)) {
      const d = new Date();
      const diff = (i - d.getDay() + 7) % 7 || 7;
      return addDays(diff);
    }
  }
  return null;
}
function parseTime(text) {
  const m = norm(text).match(/\b(?:as|às)?\s*(\d{1,2})(?:h|:)(\d{2})?\b/);
  if (!m) return '';
  return `${m[1].padStart(2, '0')}:${(m[2] || '00').padStart(2, '0')}`;
}
function parseAmount(text) {
  const m = text.match(/(?:r\$\s*)?(\d+(?:[.,]\d{3})*(?:[.,]\d{1,2})?)/i);
  if (!m) return null;
  let v = m[1];
  if (/,\d{1,2}$/.test(v)) v = v.replace(/\./g, '').replace(',', '.');
  else v = v.replace(/,/g, '');
  return parseFloat(v);
}
const CAT_HINTS = {
  'Alimentação': ['mercado', 'supermercado', 'ifood', 'restaurante', 'lanche', 'almoco', 'jantar', 'padaria', 'cafe', 'comida', 'pizza'],
  'Transporte': ['uber', '99', 'gasolina', 'combustivel', 'onibus', 'metro', 'estacionamento', 'taxi', 'pedagio'],
  'Moradia': ['aluguel', 'condominio', 'luz', 'agua', 'gas', 'internet', 'energia'],
  'Saúde': ['farmacia', 'remedio', 'medico', 'consulta', 'academia', 'exame', 'dentista'],
  'Educação': ['curso', 'livro', 'faculdade', 'mensalidade', 'escola', 'udemy'],
  'Lazer': ['cinema', 'show', 'bar', 'viagem', 'jogo', 'festa', 'passeio'],
  'Assinaturas': ['netflix', 'spotify', 'assinatura', 'prime', 'icloud', 'disney'],
  'Compras': ['roupa', 'tenis', 'shopping', 'amazon', 'presente', 'compra'],
};
function guessCategory(text) {
  const t = norm(text);
  for (const [cat, words] of Object.entries(CAT_HINTS)) if (words.some((w) => t.includes(w))) return cat;
  return 'Outros';
}
function cleanTitle(text, words) {
  // Limites de palavra compatíveis com acentos (\b não reconhece "ã", "à" etc.).
  const W = (p) => new RegExp(`(^|\\s)(?:${p})(?=\\s|$|[,.;!?])`, 'giu');
  let t = ` ${text} `;
  for (const w of words) t = t.replace(W(w), ' ');
  t = t.replace(W('depois de amanh[ãa]|amanh[ãa]|hoje|ontem'), ' ');
  t = t.replace(W('(?:[àa]s?\\s+)?\\d{1,2}(?:h|:)\\d{0,2}'), ' ');
  t = t.replace(W('(?:em|dia)?\\s*\\d{1,2}\\/\\d{1,2}(?:\\/\\d{2,4})?'), ' ');
  t = t.replace(W('(?:(?:na|no|para|pra)\\s+)?(?:segunda|ter[çc]a|quarta|quinta|sexta|s[áa]bado|domingo)(?:-feira)?'), ' ');
  t = t.replace(W('urgente|importante'), ' ');
  return t.replace(/\s+/g, ' ').replace(/^[\s:,-]+|[\s:,.-]+$/g, '').replace(/^(de|que|uma?|o|a)\s+/i, '').trim();
}

export function reply(input) {
  const raw = input.trim();
  const t = norm(raw);
  const T = today();

  // Criar tarefa
  if (/(adicion|cri|nova|novo|anot|lembr|coloc).*(tarefa|lembrete|to-?do)|^(tarefa|lembrar|lembre-me|me lembr)/.test(t)) {
    // O título é o que vem depois de "tarefa", "lembrete" ou "lembre de".
    const after = raw.match(/(?:tarefa|lembrete|to-?do|lembre(?:-me)?\s+de|lembrar\s+de)\s*:?\s+(.+)$/i)?.[1] ?? raw;
    const title = cleanTitle(after, ['me lembre de', 'lembre-me de', 'lembrar de', 'urgente', 'importante']);
    if (!title) return 'Qual é a tarefa? Ex.: “adicionar tarefa revisar contrato amanhã às 14h”.';
    const due = parseDate(raw) || T;
    const time = parseTime(raw);
    const priority = /urgente|importante|prioridade alta/.test(t) ? 'Alta' : 'Média';
    upsert('tasks', { title: capFirst(title.replace(/\b(urgente|importante)\b/gi, '').trim()), due, time, priority, area: 'Pessoal', done: false });
    return `Pronto! Criei a tarefa **${capFirst(title)}** para ${when(due)}${time ? ' às ' + time : ''}${priority === 'Alta' ? ' com prioridade alta' : ''}.`;
  }

  // Criar compromisso
  if (/(agend|marc|cri|adicion).*(compromisso|evento|reuniao|consulta)|^(reuniao|consulta)/.test(t)) {
    const after = raw.match(/(?:compromisso|evento)\s*:?\s+(.+)$/i)?.[1] ?? raw.replace(/^\s*(agend\w*|marc\w*|cri\w*|adicion\w*)\s+(uma?\s+)?/i, '');
    const title = cleanTitle(after, []);
    const date = parseDate(raw) || T;
    const time = parseTime(raw);
    upsert('events', { title: capFirst(title || 'Compromisso'), date, time, location: '' });
    return `Agendado: **${capFirst(title || 'Compromisso')}** para ${when(date)}${time ? ' às ' + time : ''}. Já aparece no seu calendário.`;
  }

  // Registrar despesa
  if (/(gastei|paguei|comprei|despesa|gasto de)/.test(t) && parseAmount(raw) != null) {
    const amount = parseAmount(raw);
    const m = raw.match(/(?:em|no|na|com|de)\s+([^\d]+?)(?:\s+(?:hoje|ontem|amanh)|$)/i);
    const desc = capFirst((m?.[1] || 'Despesa').trim());
    const category = guessCategory(raw);
    const date = /ontem/.test(t) ? addDays(-1) : parseDate(raw) || T;
    upsert('transactions', { desc, type: 'Despesa', amount, category, date });
    const f = financeSummary();
    const lim = state.settings.budgets?.[category];
    const spent = f.byCat[category] || 0;
    return `Registrei uma despesa de **${brl(amount)}** em ${category} (“${desc}”).` +
      (lim ? `\nVocê já usou ${Math.round((spent / lim) * 100)}% do orçamento de ${category} este mês (${brl(spent)} de ${brl(lim)}).` : '');
  }

  // Registrar receita
  if (/(recebi|ganhei|entrou|receita de)/.test(t) && parseAmount(raw) != null) {
    const amount = parseAmount(raw);
    const category = /salario/.test(t) ? 'Salário' : /freela|cliente|projeto/.test(t) ? 'Freelance' : 'Outros';
    const m = raw.match(/(?:de|do|da)\s+([^\d]+)$/i);
    upsert('transactions', { desc: capFirst((m?.[1] || category).trim()), type: 'Receita', amount, category, date: T });
    return `Receita de **${brl(amount)}** registrada. Saldo do mês agora: ${brl(financeSummary().balance)}.`;
  }

  // Humor
  const moodMap = [['otimo|incrivel|feliz demais|maravilh', 5], ['bem|feliz|tranquil|animad', 4], ['normal|ok|mais ou menos|neutro', 3], ['cansad|estressad|ansios|desanimad', 2], ['triste|pessim|mal\\b|horrivel|pessimo', 1]];
  if (/(estou|to|tô|me sinto|me sentindo|humor)/.test(t)) {
    const hit = moodMap.find(([re]) => new RegExp(re).test(t));
    if (hit) {
      const list = items('moods');
      const ex = list.find((m) => m.date === T);
      upsert('moods', { ...(ex || {}), date: T, score: hit[1], note: raw });
      const msg = hit[1] >= 4 ? 'Que bom! Registrei seu humor de hoje.' : hit[1] === 3 ? 'Registrei seu humor de hoje.' : 'Sinto muito que o dia esteja difícil. Registrei seu humor. Que tal uma pausa de 10 minutos, um copo de água e uma caminhada curta?';
      return msg;
    }
  }

  if (/(financ|dinheiro|saldo|gastos?|orcamento|economi)/.test(t)) return financeReport();
  if (/(semana|semanal|relatorio|report)/.test(t)) return weeklyReport();
  if (/(organiz|prioriz|reorganiz|atrasad)/.test(t)) return autoOrganize();
  if (/(sugest|dica|o que (eu )?fa|recomend|ajuda.*produt)/.test(t)) return suggestions();
  if (/(saude|sono|dormi|treino|academia|humor)/.test(t)) return healthReport();
  if (/(estud|curso|faculdade|leitura|livro|ingles)/.test(t)) return studyReport();
  if (/(hoje|meu dia|agenda|resumo|bom dia|ola|oi\b)/.test(t)) return dayBriefing();

  return `Posso te ajudar com:\n• **Criar** — “adicionar tarefa pagar boleto amanhã”, “agendar reunião sexta às 15h”\n• **Registrar** — “gastei 45 no ifood”, “recebi 1200 do cliente”, “estou cansado”\n• **Analisar** — “como estão minhas finanças?”, “relatório da semana”, “como está minha saúde?”\n• **Organizar** — “organize minhas tarefas atrasadas”, “me dê sugestões”`;
}

// "hoje", "amanhã" ou "sexta, 20 nov"
function when(d) {
  if (d === today()) return 'hoje';
  if (d === addDays(1)) return 'amanhã';
  const dt = parseISO(d);
  return dt.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' }).replace('.', '');
}

const capFirst = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

export function dayBriefing() {
  const T = today();
  const name = state.user?.name?.split(' ')[0] || '';
  const h = new Date().getHours();
  const greet = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  const tasks = items('tasks').filter((x) => !x.done && x.due === T);
  const overdue = items('tasks').filter((x) => !x.done && x.due && x.due < T);
  const events = items('events').filter((e) => e.date === T).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  const habits = items('habits');
  const pending = habits.filter((x) => !x.log?.[T]);
  let s = `${greet}${name ? ', ' + name : ''}! Aqui está seu dia:\n`;
  s += `\n**Agenda** — ${events.length ? events.map((e) => `${e.time || '--:--'} ${e.title}`).join(' · ') : 'nenhum compromisso'}`;
  s += `\n**Tarefas** — ${tasks.length} para hoje${overdue.length ? `, ${overdue.length} atrasada(s)` : ''}`;
  if (tasks.length) s += `\n${tasks.slice(0, 5).map((x) => `  • ${x.title}${x.priority === 'Alta' ? ' (alta)' : ''}`).join('\n')}`;
  s += `\n**Hábitos** — ${habits.length - pending.length}/${habits.length} concluídos`;
  const f = financeSummary();
  s += `\n**Finanças** — saldo do mês ${brl(f.balance)}`;
  const top = insights()[0];
  if (top) s += `\n\n💡 ${top.text}`;
  return s;
}

export function financeReport() {
  const f = financeSummary();
  const prev = financeSummary(-1);
  const cats = Object.entries(f.byCat).sort((a, b) => b[1] - a[1]);
  const subs = items('subscriptions').reduce((a, s) => a + (s.cycle === 'Anual' ? s.amount / 12 : +s.amount), 0);
  const inv = items('investments').reduce((a, i) => a + +i.amount, 0);
  const debts = items('bills').filter((b) => b.type === 'Dívida').reduce((a, b) => a + (+b.remaining || 0), 0);
  const savingRate = f.income ? Math.round((f.balance / f.income) * 100) : 0;
  let s = `**Resumo financeiro do mês**\nReceitas ${brl(f.income)} · Despesas ${brl(f.expense)} · Saldo ${brl(f.balance)}`;
  if (f.income) s += `\nTaxa de poupança: ${savingRate}%${savingRate >= 20 ? ' — excelente!' : savingRate >= 10 ? ' — dá para melhorar.' : ' — atenção.'}`;
  if (prev.expense) {
    const diff = ((f.expense - prev.expense) / prev.expense) * 100;
    s += `\nDespesas vs. mês passado: ${diff >= 0 ? '+' : ''}${diff.toFixed(0)}% (o mês atual ainda está em andamento).`;
  }
  if (cats.length) s += `\n\n**Onde foi o dinheiro**\n${cats.slice(0, 4).map(([c, v]) => `  • ${c}: ${brl(v)}`).join('\n')}`;
  s += `\n\nAssinaturas: ${brl(subs)}/mês · Investido: ${brl(inv)}${debts ? ` · Dívidas: ${brl(debts)}` : ''}`;
  const warn = insights().filter((i) => /orçamento|gastos|vence/.test(i.text)).slice(0, 2);
  if (warn.length) s += `\n\n💡 ${warn.map((w) => w.text).join('\n💡 ')}`;
  return s;
}

export function weeklyReport() {
  const from = addDays(-6);
  const T = today();
  const tasks = items('tasks').filter((t) => t.due >= from && t.due <= T);
  const done = tasks.filter((t) => t.done).length;
  const tx = items('transactions').filter((t) => t.date >= from && t.type === 'Despesa');
  const spent = tx.reduce((a, t) => a + +t.amount, 0);
  const workouts = items('workouts').filter((w) => w.date >= from);
  const sleep = items('sleep').filter((s) => s.date >= from).map((s) => +s.hours);
  const moods = items('moods').filter((m) => m.date >= from).map((m) => +m.score);
  const studyH = items('studies').reduce((a, s) => a + (+s.hours || 0), 0);
  return `**Relatório dos últimos 7 dias**\n` +
    `✅ Tarefas: ${done}/${tasks.length} concluídas${tasks.length ? ` (${Math.round((done / tasks.length) * 100)}%)` : ''}\n` +
    `🔁 Hábitos: ${weekHabitRate()}% de consistência\n` +
    `💸 Gastos: ${brl(spent)} em ${tx.length} lançamentos\n` +
    `🏋️ Treinos: ${workouts.length} (${workouts.reduce((a, w) => a + (+w.duration || 0), 0)} min)\n` +
    `😴 Sono médio: ${sleep.length ? avg(sleep).toFixed(1) + ' h' : 'sem registros'}\n` +
    `🙂 Humor médio: ${moods.length ? avg(moods).toFixed(1) + '/5' : 'sem registros'}\n` +
    `📚 Horas de estudo acumuladas: ${studyH} h\n\n` +
    `**Destaques**\n${insights().slice(0, 3).map((i) => '• ' + i.text).join('\n')}`;
}

export function autoOrganize() {
  const T = today();
  const overdue = items('tasks').filter((t) => !t.done && t.due && t.due < T);
  if (!overdue.length) return 'Nenhuma tarefa atrasada. Sua lista está organizada! ✨';
  const high = overdue.filter((t) => t.priority === 'Alta');
  const rest = overdue.filter((t) => t.priority !== 'Alta');
  high.forEach((t) => upsert('tasks', { id: t.id, due: T }));
  rest.forEach((t, i) => upsert('tasks', { id: t.id, due: addDays(1 + Math.floor(i / 3)) }));
  return `Reorganizei ${overdue.length} tarefa(s) atrasada(s):\n` +
    (high.length ? `• ${high.length} de prioridade alta foram para **hoje**\n` : '') +
    (rest.length ? `• ${rest.length} foram distribuídas a partir de **amanhã** (no máximo 3 por dia)` : '');
}

export function suggestions() {
  const T = today();
  const s = [];
  const top = items('tasks').filter((t) => !t.done && t.due <= T).sort((a, b) => (a.priority === 'Alta' ? -1 : 1) - (b.priority === 'Alta' ? -1 : 1))[0];
  if (top) s.push(`Comece por **${top.title}** — é a tarefa mais importante pendente.`);
  const h = items('habits').find((x) => !x.log?.[T]);
  if (h) s.push(`Ainda dá tempo de marcar o hábito **${h.emoji || ''} ${h.name}** hoje.`);
  const study = items('studies').filter((x) => x.deadline && x.deadline >= T).sort((a, b) => a.deadline.localeCompare(b.deadline))[0];
  if (study) s.push(`Reserve 45 min para **${study.title}** — prazo ${relDate(study.deadline).toLowerCase()}.`);
  const f = financeSummary();
  const over = Object.entries(f.byCat).find(([c, v]) => state.settings.budgets?.[c] && v > state.settings.budgets[c] * 0.85);
  if (over) s.push(`Segure os gastos com **${over[0]}** até o fim do mês.`);
  const post = items('posts').filter((p) => p.status !== 'Publicado' && p.date && p.date <= addDays(3))[0];
  if (post) s.push(`O conteúdo **${post.title}** está previsto para ${relDate(post.date).toLowerCase()} e ainda está em “${post.status}”.`);
  if (!items('workouts').some((w) => w.date >= addDays(-2))) s.push('Faz alguns dias sem treinar. Que tal 30 minutos de exercício hoje?');
  return s.length ? `**Sugestões para agora**\n${s.map((x, i) => `${i + 1}. ${x}`).join('\n')}` : 'Você está em dia com tudo. Aproveite para descansar! 🌙';
}

export function healthReport() {
  const from = addDays(-13);
  const sleep = items('sleep').filter((s) => s.date >= from).map((s) => +s.hours);
  const moods = items('moods').filter((m) => m.date >= from).map((m) => +m.score);
  const workouts = items('workouts').filter((w) => w.date >= addDays(-6));
  const kcal = items('meals').filter((m) => m.date === today()).reduce((a, m) => a + (+m.kcal || 0), 0);
  return `**Saúde e bem-estar (14 dias)**\n` +
    `😴 Sono médio: ${sleep.length ? avg(sleep).toFixed(1) + ' h' : '—'}${sleep.length && avg(sleep) < 7 ? ' (abaixo das 7 h recomendadas)' : ''}\n` +
    `🙂 Humor médio: ${moods.length ? avg(moods).toFixed(1) + '/5' : '—'}\n` +
    `🏋️ Treinos na semana: ${workouts.length}\n` +
    `🍽️ Calorias registradas hoje: ${kcal || '—'}${kcal ? ' kcal' : ''}\n\n` +
    (sleep.length && moods.length ? `Observação: nos dias em que você dorme mais, seu humor tende a ser ${correlation() > 0.2 ? 'melhor' : 'parecido'}.` : '');
}

function correlation() {
  const byDate = {};
  items('sleep').forEach((s) => { byDate[s.date] = { s: +s.hours }; });
  items('moods').forEach((m) => { if (byDate[m.date]) byDate[m.date].m = +m.score; });
  const pairs = Object.values(byDate).filter((p) => p.m != null);
  if (pairs.length < 4) return 0;
  const ms = avg(pairs.map((p) => p.s)), mm = avg(pairs.map((p) => p.m));
  let num = 0, ds = 0, dm = 0;
  pairs.forEach((p) => { num += (p.s - ms) * (p.m - mm); ds += (p.s - ms) ** 2; dm += (p.m - mm) ** 2; });
  return ds && dm ? num / Math.sqrt(ds * dm) : 0;
}

export function studyReport() {
  const st = items('studies');
  const books = items('books');
  const reading = books.filter((b) => b.status === 'Lendo');
  return `**Estudos**\n${st.map((s) => `• ${s.title} — ${s.progress || 0}%${s.deadline ? ` (prazo ${relDate(s.deadline).toLowerCase()})` : ''}`).join('\n') || 'Nenhum curso cadastrado.'}\n\n` +
    `**Leitura** — ${books.filter((b) => b.status === 'Lido').length} livro(s) lido(s)` +
    (reading.length ? `, lendo agora: ${reading.map((b) => `${b.title} (${Math.round(((b.read || 0) / (b.pages || 1)) * 100)}%)`).join(', ')}` : '');
}

export { EXPENSE_CATS };
