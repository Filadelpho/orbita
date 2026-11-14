// Finanças: "disponível para gastar hoje", transações, bancos e cartões, assinaturas,
// lista de compras, metas com plano, orçamento, dívidas e análises.
import { state, items, upsert, remove, find, save, today, addDays, parseISO, uid } from './store.js';
import { escapeHtml as esc, brl, brlShort, MONTHS_FULL, monthShort, EXPENSE_CATS, INCOME_CATS, fmtDate } from './collections.js';
import { icon } from './icons.js';
import { on, openOverlay, closeOverlay, toast, confirmDialog, formHooks, openForm } from './ui.js';
import { groupedBars, areaLine, PALETTE } from './charts.js';

const TABS = [['today', 'Hoje'], ['tx', 'Transações'], ['accounts', 'Bancos e cartões'], ['subs', 'Assinaturas'], ['shop', 'Lista de compras'], ['goals', 'Metas'], ['budget', 'Orçamento'], ['debts', 'Dívidas'], ['analytics', 'Análises']];
const SHOP_CATS = ['Supermercado', 'Feira', 'Farmácia', 'Casa & Limpeza', 'Eletrônicos', 'Roupas', 'Outros'];
const CAT_ICON = { Alimentação: 'apple', Mercado: 'apple', Moradia: 'home', Transporte: 'plane', Saúde: 'heart', Educação: 'grad', Lazer: 'smile', Assinaturas: 'refresh', Compras: 'tag', Software: 'code', Impostos: 'file', Investimentos: 'chart', Salário: 'briefcase', Freelance: 'briefcase', Presente: 'spark' };
const KEYWORDS = [
  [/mercado|supermerc|carrefour|assai|atacad|pao de acucar|hortifruti|feira/i, 'Mercado'],
  [/ifood|rappi|restaur|lanch|padaria|cafe|burger|pizza|bar /i, 'Alimentação'],
  [/uber|99 ?app|99pop|posto|combust|shell|ipiranga|metro|onibus|estaciona|pedagio/i, 'Transporte'],
  [/aluguel|condominio|luz|enel|energia|sabesp|agua|gas |internet|vivo|claro|tim /i, 'Moradia'],
  [/farmac|drogaria|droga|raia|hospital|clinica|medic|dentist|academia|smartfit/i, 'Saúde'],
  [/netflix|spotify|disney|prime video|hbo|max|youtube|icloud|apple\.com|google one|deezer/i, 'Assinaturas'],
  [/figma|adobe|notion|github|openai|chatgpt|canva|aws|vercel/i, 'Software'],
  [/curso|escola|faculdade|udemy|alura|livro/i, 'Educação'],
  [/cinema|show|ingresso|steam|playstation|viagem|hotel|airbnb/i, 'Lazer'],
  [/iof|imposto|darf|iptu|ipva|tarifa/i, 'Impostos'],
  [/tesouro|cdb|invest|corretora|aplicac/i, 'Investimentos'],
  [/salario|salário|folha|pagamento recebido|pro labore/i, 'Salário'],
];
export const guessCategory = (desc, type) => (KEYWORDS.find(([re]) => re.test(desc)) || [null, type === 'Receita' ? 'Outros' : 'Outros'])[1];

const F = () => (state.settings.fin ||= { tab: 'today', sub: 'resumo', m: 0, period: 'Mês', type: 'all', cat: '', extra: 200, daily: true, shopCat: 'Supermercado', days: 30 });
const setF = (patch) => { Object.assign(F(), patch); save(); };
const sgn = (t) => (t.type === 'Receita' ? 1 : -1) * (+t.amount || 0);
const isCard = (a) => a.kind === 'Cartão de crédito';
const monthKey = (off = 0) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + off); return d.toISOString().slice(0, 7); };
const monthLabel = (off = 0) => { const [y, m] = monthKey(off).split('-'); return `${MONTHS_FULL[+m - 1]} de ${y}`; };
const lastDay = (key) => { const [y, m] = key.split('-').map(Number); return `${key}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`; };
const shortD = (d) => { const p = parseISO(d); return `${p.getDate()} de ${monthShort(p.getMonth()).toLowerCase()}`; };
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const tx = () => items('transactions');

function periodRange(period, off) {
  const key = monthKey(off);
  if (period === 'Trimestre') return [`${monthKey(off - 2)}-01`, lastDay(key)];
  if (period === 'Ano') return [`${key.slice(0, 4)}-01-01`, `${key.slice(0, 4)}-12-31`];
  return [`${key}-01`, lastDay(key)];
}
const prevOffset = (period) => (period === 'Trimestre' ? -3 : period === 'Ano' ? -12 : -1);
function sum(from, to) {
  const list = tx().filter((t) => t.date >= from && t.date <= to && !t.internal);
  const income = list.filter((t) => t.type === 'Receita').reduce((a, t) => a + +t.amount, 0);
  const expense = list.filter((t) => t.type === 'Despesa').reduce((a, t) => a + +t.amount, 0);
  const byCat = {};
  list.filter((t) => t.type === 'Despesa').forEach((t) => { const c = t.category || 'Outros'; byCat[c] = (byCat[c] || 0) + +t.amount; });
  const saved = list.filter((t) => t.type === 'Despesa' && t.category === 'Investimentos').reduce((a, t) => a + +t.amount, 0)
    + items('savings').flatMap((s) => s.deposits || []).filter((d) => d.date >= from && d.date <= to).reduce((a, d) => a + +d.amount, 0);
  return { list, income, expense, byCat, saved };
}

// ---------- Contas ----------
export function accountBalance(a) {
  const main = items('accounts').find((x) => !isCard(x));
  return (+a.balance || 0) + tx().filter((t) => (t.account || main?.id) === a.id).reduce((s, t) => s + sgn(t), 0);
}
function cardBill(a, key = monthKey()) { return tx().filter((t) => t.account === a.id && t.type === 'Despesa' && t.date.startsWith(key)).reduce((s, t) => s + +t.amount, 0); }
export function totalBalance() {
  const acc = items('accounts').filter((a) => !isCard(a));
  if (!acc.length) return tx().filter((t) => !items('accounts').some((a) => a.id === t.account && isCard(a))).reduce((s, t) => s + sgn(t), 0);
  return acc.reduce((s, a) => s + accountBalance(a), 0);
}

// ---------- O que vai sair até o fim do mês ----------
function upcoming(from = today(), to = lastDay(monthKey())) {
  const out = [];
  const dayIn = (day, key) => `${key}-${String(Math.min(+day || 1, +lastDay(key).slice(8))).padStart(2, '0')}`;
  const keys = []; for (let k = 0; k < 4; k++) { const key = monthKey(k); if (`${key}-01` <= to) keys.push(key); }
  items('bills').filter((b) => !b.paid && b.due && b.due <= to).forEach((b) => out.push({ date: b.due < from ? from : b.due, desc: b.title, amount: +b.amount, kind: b.type === 'Dívida' ? 'Dívida' : 'Conta', late: b.due < from }));
  items('subscriptions').forEach((s) => {
    if (!s.next) return;
    if (s.cycle === 'Anual') { if (s.next >= from && s.next <= to) out.push({ date: s.next, desc: s.name, amount: +s.amount, kind: 'Assinatura' }); return; }
    keys.forEach((key) => { const d = dayIn(s.next.slice(8), key); if (d >= from && d <= to && d >= s.next) out.push({ date: d, desc: s.name, amount: +s.amount, kind: 'Assinatura' }); });
  });
  items('recurring').forEach((r) => keys.forEach((key) => { const d = dayIn(r.day, key); if (d >= from && d <= to) out.push({ date: d, desc: r.desc, amount: +r.amount, kind: r.type === 'Receita' ? 'Receita' : 'Fixa', income: r.type === 'Receita' }); }));
  items('accounts').filter(isCard).forEach((a) => keys.forEach((key) => { if (!a.dueDay) return; const d = dayIn(a.dueDay, key); const v = cardBill(a, monthKey(-1 + keys.indexOf(key))); if (v && d >= from && d <= to) out.push({ date: d, desc: `Fatura ${a.name}`, amount: v, kind: 'Fatura' }); }));
  // Não conta duas vezes o que já foi lançado neste mês com o mesmo nome.
  const done = new Set(tx().filter((t) => t.date.startsWith(monthKey())).map((t) => (t.desc || '').toLowerCase()));
  return out.filter((x) => x.late || !(x.kind !== 'Fatura' && x.date.startsWith(monthKey()) && done.has(x.desc.toLowerCase()) && x.date <= today())).sort((a, b) => a.date.localeCompare(b.date));
}
const goalsMonthly = () => items('savings').reduce((s, g) => {
  const got = (g.deposits || []).filter((d) => d.date.startsWith(monthKey())).reduce((a, d) => a + +d.amount, 0);
  return s + Math.max(0, (+g.monthly || 0) - got);
}, 0);

export function available() {
  const saldo = totalBalance();
  const up = upcoming().filter((x) => !x.income);
  const next = up.reduce((s, x) => s + x.amount, 0);
  const aporte = goalsMonthly();
  const free = saldo - next - aporte;
  const daysLeft = +lastDay(monthKey()).slice(8) - new Date().getDate() + 1;
  return { saldo, next, up, aporte, free, daysLeft, perDay: free / daysLeft };
}

// ---------- Página ----------
export function financePage() {
  const f = F();
  const empty = !tx().length;
  const tabs = `<div class="fn-tabs" role="tablist">${TABS.map(([id, l]) => `<button role="tab" class="${f.tab === id ? 'on' : ''}" data-action="fn-tab" data-v="${id}">${l}</button>`).join('')}</div>`;
  const body = { today: todayTab, tx: txTab, accounts: accountsTab, subs: subsTab, shop: shopTab, goals: goalsTab, budget: budgetTab, debts: debtsTab, analytics: analyticsTab }[f.tab] || todayTab;
  return `<div class="pj-page fn">
    <div class="tk-head">
      <div><div class="tk-h1"><span class="tk-hico">${icon('wallet')}</span><h1>Finanças</h1></div><p>Quanto pode gastar hoje e o que falta para conquistar suas metas.</p></div>
      <div class="tk-head-actions"><label class="btn">${icon('upload')}Importar extrato<input type="file" accept=".csv,.ofx,.txt" data-change="fn-import" hidden></label><button class="btn primary" data-action="fn-new-tx">${icon('plus')}Nova transação</button></div>
    </div>
    ${empty ? `<div class="fn-start"><span class="fn-start-ico">${icon('wallet')}</span><b>Comece pelo seu extrato</b><p>Exporte o extrato do seu banco (CSV ou OFX) e importe aqui: o ORBITA categoriza, calcula o saldo e já monta o seu plano. Ou lance uma transação à mão.</p>
      <div><label class="btn primary">${icon('upload')}Importar extrato<input type="file" accept=".csv,.ofx,.txt" data-change="fn-import" hidden></label><button class="btn" data-action="fn-new-tx">${icon('plus')}Lançar à mão</button></div></div>` : ''}
    ${tabs}
    ${body()}
  </div>`;
}
const monthNav = () => `<div class="fn-month"><button class="icon-btn" data-action="fn-m" data-d="-1" aria-label="Mês anterior">${icon('chevL')}</button><b>${monthLabel(F().m)}</b><button class="icon-btn" data-action="fn-m" data-d="1" aria-label="Próximo mês">${icon('chevR')}</button></div>`;
const seg = (action, list, cur) => `<div class="fn-seg">${list.map(([v, l]) => `<button class="${cur === v ? 'on' : ''}" data-action="${action}" data-v="${v}">${l}</button>`).join('')}</div>`;
const card = (ico, title, right, inner, cls = '') => `<section class="fn-card ${cls}"><div class="fn-card-h"><h3>${icon(ico)}${title}</h3>${right || ''}</div>${inner}</section>`;
const linkBtn = (label, action, extra = '') => `<button class="fn-link" data-action="${action}" ${extra}>${label} →</button>`;
const emptyLine = (t) => `<p class="fn-empty">${t}</p>`;

// ---------- Hoje ----------
function todayTab() {
  const f = F();
  const subs = [['resumo', 'Resumo'], ['mudou', 'O que mudou'], ['gastos', 'Gastos'], ['previsao', 'Previsão']];
  const inner = { resumo: resumoView, mudou: mudouView, gastos: gastosView, previsao: previsaoView }[f.sub] || resumoView;
  return `<div class="fn-bar">${seg('fn-sub', subs, f.sub)}${f.sub === 'previsao' ? '' : f.sub === 'resumo' ? monthNav() : `<div class="fn-bar-r">${seg('fn-period', [['Mês', 'Mês'], ['Trimestre', 'Trimestre'], ['Ano', 'Ano']], f.period)}${monthNav()}</div>`}</div>${inner()}`;
}
function resumoView() {
  const a = available();
  const f = F();
  const monthExp = sum(`${monthKey()}-01`, today()).expense;
  const dayN = new Date().getDate();
  const pace = monthExp / dayN;
  const closes = a.free - pace * a.daysLeft;
  const spentToday = tx().filter((t) => t.date === today() && t.type === 'Despesa').reduce((s, t) => s + +t.amount, 0);
  const goals = items('savings');
  const reserve = goals.find((g) => g.kind === 'reserve');
  return `<section class="fn-card fn-hero">
      <div class="fn-hero-top"><span>Disponível para gastar hoje</span><em>Substitui o saldo como número principal</em></div>
      <div class="fn-big ${a.perDay < 0 ? 'neg' : ''}">${brl(Math.max(a.perDay, a.perDay < 0 ? a.perDay : 0))}</div>
      <p class="fn-hero-sub">${a.free >= 0 ? `${brl(a.free)} livres até o fim do mês · ${a.daysLeft} ${a.daysLeft === 1 ? 'dia' : 'dias'}` : `Faltam ${brl(-a.free)} para cobrir o mês`}</p>
      <div class="fn-break">
        <div><span>Saldo em conta</span><b>${brl(a.saldo)}</b><small>${items('accounts').filter((x) => !isCard(x)).length ? `${items('accounts').filter((x) => !isCard(x)).length} conta(s)` : 'Conta principal'}</small></div>
        <div><span>− Próximas despesas</span><b>${brl(a.next)}</b>${a.up.length ? `<small>${a.up.length} até o fim do mês</small>` : linkBtn('Cadastrar fixas', 'fn-go', 'data-tab="today" data-sub="previsao"')}</div>
        <div><span>− Aporte das metas</span><b>${brl(a.aporte)}</b>${goals.length ? `<small>${goals.length} meta(s)</small>` : linkBtn('Criar uma meta', 'fn-go', 'data-tab="goals"')}</div>
      </div>
      ${f.cap ? `<div class="fn-cap"><span>Teto diário <b>${brl(f.cap)}</b> · hoje: ${brl(spentToday)}</span><div class="bar ${spentToday > f.cap ? 'red' : spentToday > f.cap * 0.8 ? 'yellow' : ''}"><i style="width:${Math.min(100, pct(spentToday, f.cap))}%"></i></div><button class="fn-link" data-action="fn-cap">Mudar</button></div>` : ''}
      <div class="fn-risk ${closes < 0 ? 'bad' : 'ok'}">${icon(closes < 0 ? 'bell' : 'checkCircle')}<p><b>${closes < 0 ? 'Risco:' : 'No azul:'}</b> no ritmo de ${brl(pace)} por dia, o mês fecha em <em>${brl(closes)}</em>. Faltam ${a.daysLeft} dias.</p>${f.cap ? '' : '<button class="btn sm" data-action="fn-cap">Definir teto diário</button>'}</div>
    </section>
    ${card('calendar', 'Próximas despesas', `<b class="fn-total">${brl(a.next)}</b>`, a.up.length ? `<div class="fn-rows">${a.up.slice(0, 8).map((x) => `<div class="fn-row"><span class="fn-dt ${x.late ? 'late' : ''}">${x.late ? 'atrasada' : shortD(x.date)}</span><span class="fn-desc">${esc(x.desc)}<small>${x.kind}</small></span><b>${brl(x.amount)}</b></div>`).join('')}</div>` : `${emptyLine('Nenhuma despesa fixa até o fim do mês.')}${linkBtn('Cadastrar fixas', 'fn-go', 'data-tab="today" data-sub="previsao"')}`)}
    ${card('target', 'Metas em andamento', linkBtn('Ver todas', 'fn-go', 'data-tab="goals"'), `${reserve ? '' : `<div class="fn-goal"><div class="fn-goal-t"><b>Reserva de emergência</b><span>${brl(0)}</span></div><div class="bar"><i style="width:0"></i></div><div class="fn-goal-t"><small>Sem meta definida</small>${linkBtn('Definir meta', 'fn-reserve')}</div></div>`}
      ${goals.slice(0, 4).map(goalMini).join('')}${goals.length ? '' : `<div class="fn-dash">Nenhuma meta criada ainda. Crie na aba Metas: o que você guardar nela entra aqui na barra.<br>${linkBtn('Criar uma meta', 'fn-go', 'data-tab="goals"')}</div>`}`)}`;
}
const goalMini = (g) => `<div class="fn-goal"><div class="fn-goal-t"><b>${esc(g.title)}</b><span>${brl(g.saved)}${g.target ? ` <small>de ${brl(g.target)}</small>` : ''}</span></div><div class="bar"><i style="width:${Math.min(100, pct(+g.saved, +g.target))}%"></i></div><div class="fn-goal-t"><small>${g.target ? `${pct(+g.saved, +g.target)}%${g.monthly ? ` · ${brl(g.monthly)}/mês` : ''}` : 'Sem meta definida'}</small>${linkBtn('Guardar', 'fn-deposit', `data-id="${g.id}"`)}</div></div>`;

function mudouView() {
  const f = F();
  const [a, b] = periodRange(f.period, f.m);
  const [pa, pb] = periodRange(f.period, f.m + prevOffset(f.period));
  const cur = sum(a, b), prev = sum(pa, pb);
  const hasPrev = prev.list.length > 0;
  const delta = (x, y) => (!hasPrev ? '— sem histórico do período anterior' : y ? `${x >= y ? '+' : ''}${Math.round(((x - y) / y) * 100)}% vs. período anterior` : 'novo');
  const weigh = Object.keys({ ...cur.byCat, ...prev.byCat }).map((c) => [c, (cur.byCat[c] || 0) - (prev.byCat[c] || 0)]).filter((x) => x[1] > 0).sort((x, y) => y[1] - x[1]).slice(0, 3);
  const sobra = cur.income - cur.expense;
  const months = [];
  for (let k = -5; k <= 0; k++) { const [x, y] = periodRange('Mês', f.m + k); const s = sum(x, y); months.push({ label: monthShort(+monthKey(f.m + k).slice(5) - 1), values: [s.income, s.expense, s.saved] }); }
  return `${card('chart', 'O que mudou vs. período anterior', linkBtn('Ver análise completa', 'fn-go', 'data-tab="analytics"'), `
      <div class="fn-two"><div class="fn-kpi"><span>Receitas</span><b class="up">${brl(cur.income)}</b><small>${delta(cur.income, prev.income)}</small></div>
      <div class="fn-kpi"><span>Despesas</span><b>${brl(cur.expense)}</b><small>${delta(cur.expense, prev.expense)}</small></div></div>
      <p class="fn-cap-t">O que mais pesou:</p>${weigh.length ? `<div class="fn-rows">${weigh.map(([c, v]) => `<div class="fn-row"><span class="fn-desc">${esc(c)}</span><b class="down">+${brl(v)}</b></div>`).join('')}</div>` : emptyLine(cur.expense ? 'Nenhuma categoria subiu em relação ao período anterior.' : 'Sem despesas no período.')}`)}
    ${card('piggy', 'Sobra calculada × guardado de verdade', '', `
      <div class="fn-two"><div class="fn-kpi"><span>Sobra calculada</span><b class="${sobra < 0 ? 'down' : ''}">${brl(sobra)}</b><small>(receitas − despesas)</small></div>
      <div class="fn-kpi"><span>Guardado de verdade</span><b class="up">${brl(cur.saved)}</b><small>caixinhas, investimentos e metas</small></div></div>
      ${cur.income ? `<div class="fn-stack"><i style="flex:${cur.expense - Math.min(cur.saved, cur.expense)};background:var(--surface-3)" title="Despesas"></i><i style="flex:${cur.saved};background:var(--success)" title="Guardado"></i><i style="flex:${Math.max(0, sobra - cur.saved)};background:var(--warning)" title="Não aparece guardado"></i></div>
      <div class="fn-legend"><span><i style="background:var(--surface-3)"></i>Despesas ${brl(cur.expense)}</span><span><i style="background:var(--success)"></i>Guardado ${brl(cur.saved)}</span><span><i style="background:var(--warning)"></i>Não aparece guardado ${brl(Math.max(0, sobra - cur.saved))}</span></div>` : emptyLine('Sem receitas no período.')}
      <p class="fn-note">A sobra só vira conquista quando vai para uma caixinha, investimento ou meta.</p>`)}
    ${card('chart', 'Entradas × saídas × guardado', '', `${groupedBars(months, ['var(--accent)', 'var(--surface-3)', 'var(--success)'], { fmt: brlShort, height: 190 })}<div class="legend"><span><i style="background:var(--accent)"></i>Entradas</span><span><i style="background:var(--surface-3)"></i>Saídas</span><span><i style="background:var(--success)"></i>Guardado</span></div>`)}`;
}
function alerts() {
  const out = [];
  const budgets = state.settings.budgets || {};
  const cur = sum(`${monthKey()}-01`, lastDay(monthKey()));
  Object.entries(budgets).forEach(([c, lim]) => { const s = cur.byCat[c] || 0; if (s >= lim) out.push(['bad', `Orçamento de ${c} estourou: ${brl(s)} de ${brl(lim)}`, 'budget']); else if (s >= lim * 0.8) out.push(['warn', `${c} já usou ${pct(s, lim)}% do orçamento`, 'budget']); });
  items('bills').filter((b) => !b.paid && b.due < today()).forEach((b) => out.push(['bad', `${b.title} venceu ${fmtDate(b.due)}`, 'today']));
  if (!items('savings').some((g) => g.kind === 'reserve' && g.target)) out.push(['warn', 'Reserva de emergência sem meta definida', 'reserve']);
  const a = available(); if (a.free < 0) out.push(['bad', `O mês não fecha: faltam ${brl(-a.free)}`, 'today']);
  return out;
}
function gastosView() {
  const f = F();
  const [a, b] = periodRange(f.period, f.m);
  const top = sum(a, b).list.filter((t) => t.type === 'Despesa').sort((x, y) => y.amount - x.amount).slice(0, 6);
  const al = alerts();
  return `${card('bell', 'Atenção agora', '', al.length ? `<div class="fn-rows">${al.map(([k, t, go]) => `<div class="fn-alert ${k}">${icon(k === 'bad' ? 'bell' : 'eye')}<span>${esc(t)}</span>${go === 'reserve' ? linkBtn('Definir meta', 'fn-reserve') : linkBtn('Ver', 'fn-go', `data-tab="${go}"`)}</div>`).join('')}</div>` : emptyLine('Tudo em ordem por aqui.'))}
    ${card('arrowDown', 'Maiores gastos do período', linkBtn('Ver todas as transações', 'fn-go', 'data-tab="tx"'), top.length ? `<div class="fn-rows">${top.map(txRow).join('')}</div>` : emptyLine('Nenhum gasto registrado neste período.'))}`;
}
function forecast(days) {
  const start = totalBalance();
  const up = upcoming(addDays(1), addDays(days));
  // Gasto do dia a dia: média diária dos últimos 90 dias, tirando o que já é fixo.
  const hist = tx().filter((t) => t.date >= addDays(-90) && t.date <= today());
  const firstDay = hist.reduce((m, t) => (t.date < m ? t.date : m), today());
  const histDays = Math.round((parseISO(today()) - parseISO(firstDay)) / 864e5) + 1;
  const fixedMonth = items('recurring').filter((r) => r.type !== 'Receita').reduce((s, r) => s + +r.amount, 0) + items('subscriptions').reduce((s, x) => s + (x.cycle === 'Anual' ? x.amount / 12 : +x.amount), 0);
  const daily = histDays >= 30 && F().daily ? Math.max(0, hist.filter((t) => t.type === 'Despesa').reduce((s, t) => s + +t.amount, 0) / histDays - fixedMonth / 30) : 0;
  const pts = [start]; let bal = start, min = start, minD = today();
  for (let k = 1; k <= days; k++) {
    const d = addDays(k);
    up.filter((x) => x.date === d).forEach((x) => { bal += x.income ? x.amount : -x.amount; });
    bal -= daily;
    pts.push(bal);
    if (bal < min) { min = bal; minD = d; }
  }
  return { start, pts, min, minD, daily, histDays, up, endMonth: pts[Math.max(0, Math.round((parseISO(lastDay(monthKey())) - parseISO(today())) / 864e5))] ?? bal, at60: pts[Math.min(60, days)] ?? bal };
}
function previsaoView() {
  const f = F();
  const fc = forecast(Math.max(60, f.days));
  const view = fc.pts.slice(0, f.days + 1);
  const labels = view.map((_, i) => (i % Math.round(f.days / 6) === 0 ? shortD(addDays(i)) : ''));
  const rec = items('recurring');
  return `<div class="fn-kpis">
      <div class="fn-kpi"><span>Saldo hoje</span><b>${brl(fc.start)}</b></div>
      <div class="fn-kpi"><span>Fim do mês</span><b class="${fc.endMonth < 0 ? 'down' : ''}">${brl(fc.endMonth)}</b><small>em ${shortD(lastDay(monthKey()))}</small></div>
      <div class="fn-kpi"><span>Em 60 dias</span><b class="${fc.at60 < 0 ? 'down' : ''}">${brl(fc.at60)}</b></div>
      <div class="fn-kpi"><span>Menor saldo</span><b class="${fc.min < 0 ? 'down' : ''}">${brl(fc.min)}</b><small>${fc.minD === today() ? 'hoje' : shortD(fc.minD)}</small></div>
    </div>
    <div class="fn-risk ${fc.min < 0 ? 'bad' : 'ok'}">${icon(fc.min < 0 ? 'bell' : 'checkCircle')}<p><b>${fc.min < 0 ? 'Vai ficar no vermelho' : 'No azul'}</b> ${fc.min < 0 ? `em ${shortD(fc.minD)}, se nada mudar.` : 'Você deve fechar o período no azul.'}</p></div>
    ${card('chart', 'Saldo projetado', `<div class="fn-bar-r"><label class="fn-check"><input type="checkbox" data-change="fn-daily" ${f.daily ? 'checked' : ''}>incluir gasto do dia a dia</label>${seg('fn-days', [[30, '30 dias'], [60, '60 dias'], [90, '90 dias']].map(([v, l]) => [String(v), l]), String(f.days))}</div>`,
      `${areaLine(view.map((v) => Math.round(v)), { height: 170, labels, dots: false, color: fc.min < 0 ? 'var(--danger)' : 'var(--accent)' })}
      <p class="fn-note">${fc.histDays < 30 ? 'Ainda há poucos dias de lançamentos (menos de 30), então o gasto do dia a dia não entrou na projeção. Ela considera só os recorrentes, contas e faturas.' : fc.daily ? `Inclui ${brl(fc.daily)} por dia de gasto do dia a dia, pela média dos últimos 90 dias.` : 'Só recorrentes, contas e faturas.'}</p>`)}
    ${card('repeat', 'Recorrentes', `<button class="btn sm" data-action="fn-rec-new">${icon('plus')}Novo</button>`, rec.length ? `<div class="fn-rows">${rec.map((r) => `<button class="fn-row click" data-action="open-form" data-key="recurring" data-id="${r.id}"><span class="fn-dt">dia ${r.day}</span><span class="fn-desc">${esc(r.desc)}<small>${esc(r.category || r.type)}</small></span><b class="${r.type === 'Receita' ? 'up' : ''}">${r.type === 'Receita' ? '+' : '−'}${brl(r.amount)}</b></button>`).join('')}</div>` : emptyLine('Cadastre o que se repete todo mês (salário, aluguel, assinaturas) para a previsão ficar realista.'))}
    ${card('calendar', 'Próximos lançamentos previstos', '', fc.up.length ? `<div class="fn-rows">${fc.up.slice(0, 12).map((x) => `<div class="fn-row"><span class="fn-dt">${shortD(x.date)}</span><span class="fn-desc">${esc(x.desc)}<small>${x.kind}</small></span><b class="${x.income ? 'up' : ''}">${x.income ? '+' : '−'}${brl(x.amount)}</b></div>`).join('')}</div>` : emptyLine('Nada previsto no período.'))}`;
}

// ---------- Transações ----------
const accName = (id) => find('accounts', id)?.name;
function txRow(t) {
  const c = t.category || 'Outros';
  return `<button class="fn-row click fn-tx" data-action="fn-edit-tx" data-id="${t.id}" data-q="${esc(`${t.desc} ${c} ${t.tags || ''}`.toLowerCase())}">
    <span class="fn-cat ${t.type === 'Receita' ? 'in' : ''}">${icon(CAT_ICON[c] || (t.type === 'Receita' ? 'arrowUp' : 'wallet'))}</span>
    <span class="fn-desc">${esc(t.desc)}<small>${esc(c)}${t.account && accName(t.account) ? ` · ${esc(accName(t.account))}` : ''}${t.tags ? ` · ${esc(t.tags)}` : ''}</small></span>
    <b class="${t.type === 'Receita' ? 'up' : ''}">${t.type === 'Receita' ? '+' : '−'}${brl(t.amount)}</b></button>`;
}
function txTab() {
  const f = F();
  const key = monthKey(f.m);
  let list = tx().filter((t) => t.date.startsWith(key));
  const cats = [...new Set(list.map((t) => t.category || 'Outros'))].sort();
  const internal = list.filter((t) => t.internal).length;
  if (!f.showInternal) list = list.filter((t) => !t.internal);
  if (f.type === 'in') list = list.filter((t) => t.type === 'Receita');
  if (f.type === 'out') list = list.filter((t) => t.type === 'Despesa');
  if (f.type === 'review') list = list.filter((t) => t.review);
  if (f.cat) list = list.filter((t) => (t.category || 'Outros') === f.cat);
  list.sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0));
  const days = [...new Set(list.map((t) => t.date))];
  const inc = list.filter((t) => t.type === 'Receita').reduce((s, t) => s + +t.amount, 0), out = list.filter((t) => t.type === 'Despesa').reduce((s, t) => s + +t.amount, 0);
  return `<div class="fn-bar">${monthNav()}<div class="fn-bar-r"><div class="hbm-select fn-sel"><select data-change="fn-cat" aria-label="Categoria"><option value="">Todas as categorias</option>${[...new Set([...cats, f.cat].filter(Boolean))].map((c) => `<option ${f.cat === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>${icon('chevD')}</div>
      ${seg('fn-type', [['all', 'Todas'], ['in', 'Entradas'], ['out', 'Saídas'], ['review', 'A revisar']], f.type)}</div></div>
    <div class="fn-bar"><label class="fn-search">${icon('search')}<input data-input="fn-search" placeholder="Buscar transação" aria-label="Buscar transação"></label>
      <div class="fn-bar-r"><label class="fn-check"><input type="checkbox" data-change="fn-internal" ${f.showInternal ? 'checked' : ''}>Mostrar movimentações internas (${internal} ocultas)</label><button class="btn sm" data-action="fn-export" data-scope="month">${icon('download')}Exportar</button></div></div>
    <div class="fn-sumline"><span>Entradas <b class="up">${brl(inc)}</b></span><span>Saídas <b>${brl(out)}</b></span><span>Resultado <b class="${inc - out < 0 ? 'down' : 'up'}">${brl(inc - out)}</b></span></div>
    ${list.length ? days.map((d) => { const dl = list.filter((t) => t.date === d); const tot = dl.reduce((s, t) => s + sgn(t), 0); return `<section class="fn-day"><div class="fn-day-h"><span>${d === today() ? 'Hoje' : d === addDays(-1) ? 'Ontem' : fmtDate(d)}</span><span class="${tot < 0 ? '' : 'up'}">${tot < 0 ? '−' : '+'}${brl(Math.abs(tot))}</span></div>${dl.map(txRow).join('')}</section>`; }).join('')
      : `<div class="pj-empty"><span class="pj-empty-ico">${icon('search')}</span><b>Nenhuma transação encontrada</b><p>Tente ajustar os filtros, mudar o mês ou lançar uma nova transação.</p></div>`}`;
}

// ---------- Bancos e cartões ----------
function accountsTab() {
  const acc = items('accounts');
  return `${card('wallet', 'Bancos e cartões', `<button class="btn sm primary" data-action="fn-acc-new">${icon('plus')}Nova conta ou cartão</button>`, `<p class="fn-note" style="margin-top:0">Cadastre onde está o seu dinheiro e os seus cartões. Ligue cada lançamento a um deles para ver o saldo de cada conta e a fatura de cada cartão.</p>
    ${acc.length ? `<div class="fn-accs">${acc.map((a) => {
      const card = isCard(a);
      const v = card ? cardBill(a) : accountBalance(a);
      const lim = +a.limit || 0;
      return `<button class="fn-acc" style="--ac:${esc(a.color || '#4a86c5')}" data-action="open-form" data-key="accounts" data-id="${a.id}">
        <span class="fn-acc-h">${icon(card ? 'card' : 'wallet')}<b>${esc(a.name)}</b><small>${esc(a.kind || 'Conta corrente')}</small></span>
        <span class="fn-acc-v"><small>${card ? 'Fatura do mês' : 'Saldo'}</small><b class="${!card && v < 0 ? 'down' : ''}">${brl(v)}</b></span>
        ${card && lim ? `<div class="bar ${v > lim * 0.8 ? 'yellow' : ''}"><i style="width:${Math.min(100, pct(v, lim))}%"></i></div><small class="muted">${brl(Math.max(0, lim - v))} de limite livre${a.dueDay ? ` · vence dia ${a.dueDay}` : ''}</small>` : card && a.dueDay ? `<small class="muted">vence dia ${a.dueDay}</small>` : ''}
      </button>`; }).join('')}</div>` : `<div class="fn-dash">Nenhuma conta ainda. Comece pela conta onde cai o seu salário e pelo cartão que você mais usa: depois é só importar o extrato e a fatura de cada um.<br><button class="btn sm primary" data-action="fn-acc-new">${icon('plus')}Cadastrar a primeira</button></div>`}`)}`;
}

// ---------- Assinaturas ----------
function subsTab() {
  const subs = items('subscriptions');
  const monthly = subs.reduce((s, x) => s + (x.cycle === 'Anual' ? x.amount / 12 : +x.amount), 0);
  const fixed = items('recurring').filter((r) => r.type !== 'Receita').reduce((s, r) => s + +r.amount, 0);
  return `<div class="fn-kpis three">
      <div class="fn-kpi"><span>Total mensal em assinaturas</span><b>${brl(monthly)}</b><small>${subs.length} assinatura(s) ativa(s)</small></div>
      <div class="fn-kpi"><span>Impacto anual estimado</span><b>${brl((monthly + fixed) * 12)}</b><small>12 meses de assinaturas e despesas fixas</small></div>
      <div class="fn-kpi act"><span>Cadastrar assinatura</span><small>Netflix, Spotify, academia, internet ou aluguel.</small><button class="btn sm primary" data-action="open-form" data-key="subscriptions">${icon('plus')}Nova assinatura</button></div>
    </div>
    ${card('refresh', 'Minhas despesas recorrentes e assinaturas', `<span class="muted">${subs.length} cadastrada(s)</span>`, subs.length ? `<div class="fn-rows">${subs.slice().sort((a, b) => (a.next || '9').localeCompare(b.next || '9')).map((s) => `<button class="fn-row click" data-action="open-form" data-key="subscriptions" data-id="${s.id}"><span class="fn-cat">${icon('refresh')}</span><span class="fn-desc">${esc(s.name)}<small>${esc(s.cycle || 'Mensal')}${s.next ? ` · próxima ${fmtDate(s.next)}` : ''}${s.category ? ` · ${esc(s.category)}` : ''}</small></span><b>${brl(s.amount)}<small>/${s.cycle === 'Anual' ? 'ano' : 'mês'}</small></b></button>`).join('')}</div>`
      : `<div class="fn-dash">Nenhuma assinatura registrada ainda. Cadastre seus serviços recorrentes para nunca ser pego de surpresa.<br><button class="btn sm primary" data-action="open-form" data-key="subscriptions">${icon('plus')}Adicionar primeira assinatura</button></div>`)}`;
}

// ---------- Lista de compras ----------
function shopTab() {
  const f = F();
  const list = items('shopping');
  const total = list.reduce((s, i) => s + (+i.price || 0) * (+i.qty || 1), 0);
  const got = list.filter((i) => i.got);
  const gotTotal = got.reduce((s, i) => s + (+i.price || 0) * (+i.qty || 1), 0);
  const pend = list.filter((i) => !i.got);
  return `<div class="fn-kpis three">
      <div class="fn-kpi"><span>Total previsto da lista</span><b>${brl(total)}</b><small>${list.length} itens (${pend.length} pendentes)</small></div>
      <div class="fn-kpi"><span>No carrinho / já comprado</span><b class="up">${brl(gotTotal)}</b><small>${got.length} itens marcados</small></div>
      <div class="fn-kpi act"><span>Ações rápidas</span><div class="fn-acts"><button class="btn sm" data-action="fn-shop-clear" ${got.length ? '' : 'disabled'}>Limpar comprados</button><button class="btn sm primary" data-action="fn-shop-spend" ${gotTotal ? '' : 'disabled'}>Lançar gasto</button></div></div>
    </div>
    ${card('tag', 'Adicionar item à lista', '', `<form class="fn-shop-form" data-submit="fn-shop-add">
      <input name="name" class="pjm-input sm" placeholder="Ex.: Café, detergente, pilhas" required autocomplete="off">
      <label>Qtd:<input name="qty" type="number" min="1" step="1" value="1" class="pjm-input sm"></label>
      <label>R$:<input name="price" type="number" min="0" step="0.01" placeholder="0,00" class="pjm-input sm"></label>
      <button class="btn primary">${icon('plus')}Adicionar</button></form>
      <div class="glm-sugg">${SHOP_CATS.map((c) => `<button class="${f.shopCat === c ? 'on' : ''}" data-action="fn-shop-cat" data-v="${c}">${c}</button>`).join('')}</div>`)}
    ${card('checkSquare', 'Itens a comprar', `<span class="muted">${pend.length} pendentes</span>`, list.length ? SHOP_CATS.filter((c) => list.some((i) => (i.cat || 'Outros') === c)).map((c) => `<p class="fn-cap-t">${c}</p><div class="fn-rows">${list.filter((i) => (i.cat || 'Outros') === c).sort((a, b) => a.got - b.got).map((i) => `<div class="fn-row fn-shop ${i.got ? 'got' : ''}"><button class="fn-tick" data-action="fn-shop-got" data-id="${i.id}" aria-label="${i.got ? 'Desmarcar' : 'Marcar como pego'}">${icon('check')}</button><span class="fn-desc">${esc(i.name)}<small>${i.qty || 1} × ${i.price ? brl(i.price) : 'sem preço'}</small></span><b>${i.price ? brl(i.price * (i.qty || 1)) : ''}</b><button class="icon-btn sm" data-action="fn-shop-del" data-id="${i.id}" aria-label="Tirar da lista">${icon('x')}</button></div>`).join('')}</div>`).join('')
      : emptyLine('Tudo comprado por aqui! Digite um produto acima para planejar suas próximas compras.'))}`;
}

// ---------- Metas financeiras ----------
let plan = null;
const avgSaving = () => { let s = 0; for (let k = 1; k <= 3; k++) { const [a, b] = periodRange('Mês', -k); const x = sum(a, b); s += x.income - x.expense; } return Math.max(0, s / 3); };
const avgIncome = () => { let s = 0; for (let k = 1; k <= 3; k++) { const [a, b] = periodRange('Mês', -k); s += sum(a, b).income; } return s / 3; };
const avgExpense = () => { let s = 0; for (let k = 1; k <= 3; k++) { const [a, b] = periodRange('Mês', -k); s += sum(a, b).expense; } return s / 3; };
const monthsBetween = (ym) => { const [y, m] = ym.split('-').map(Number); const n = new Date(); return Math.max(1, (y - n.getFullYear()) * 12 + (m - 1 - n.getMonth())); };
const addMonths = (n) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + n); return d.toISOString().slice(0, 7); };
const ymLabel = (ym) => `${monthShort(+ym.slice(5) - 1).toLowerCase()}/${ym.slice(0, 4)}`;
const round50 = (v) => Math.ceil(v / 50) * 50;
const MONTH_WORDS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
// "Viagem para o Chile de 8 mil até março" → título, valor e prazo.
export function parseGoalText(raw) {
  const s = raw.toLowerCase();
  let value = 0;
  const m = s.match(/r?\$?\s*(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:,\d+)?)\s*(mil|k)?/);
  if (m) { value = parseFloat(m[1].replace(/[.\s]/g, '').replace(',', '.')); if (m[2]) value *= 1000; }
  let deadline = '';
  const em = s.match(/em\s+(\d+)\s+mes/); const ano = s.match(/em\s+(\d+)\s+ano/);
  if (em) deadline = addMonths(+em[1]); else if (ano) deadline = addMonths(+ano[1] * 12);
  else {
    const tail = s.split(/\s(?:até|ate|em|no|na|para)\s/).slice(1).join(' ');
    const mi = MONTH_WORDS.findIndex((w) => new RegExp(`(?:^|\\s)${w}`).test(tail));
    if (mi >= 0) { const yr = (s.match(/20\d\d/) || [])[0]; const now = new Date(); let y = yr ? +yr : now.getFullYear(); if (!yr && mi <= now.getMonth()) y++; deadline = `${y}-${String(mi + 1).padStart(2, '0')}`; }
    else if (/fim do ano|final do ano/.test(s)) deadline = `${new Date().getFullYear()}-12`;
  }
  const kind = /reserva|emerg/.test(s) ? 'reserva' : /viagem|viajar|trip/.test(s) ? 'viagem' : /quitar|dívida|divida/.test(s) ? 'dívida' : 'compra';
  let title = raw.replace(/(?:\s(?:de|com))?\s*(?:r\$)?\s*(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:,\d+)?)\s*(?:mil|k|reais)?(?=\s|$)/i, ' ').replace(/(?:^|\s)(?:até|ate|em \d+|no fim|no final|fim do ano)(?=\s|$).*$/i, '').replace(/\s+/g, ' ').trim();
  title = title ? title[0].toUpperCase() + title.slice(1) : '';
  return { title, value, deadline, kind };
}
const pathValues = (need) => ({ keep: round50(need), mid: round50(need * 0.6), light: round50(need * 0.35) });
function goalsTab() {
  plan ||= { text: '', title: '', value: '', deadline: addMonths(6), saved: '', income: 'Fixa', path: '' };
  const goals = items('savings');
  const value = +plan.value || 0, saved = +plan.saved || 0;
  const months = monthsBetween(plan.deadline || addMonths(6));
  const rest = Math.max(0, value - saved);
  const need = rest / months;
  const now = avgSaving();
  const inc = avgIncome();
  const fits = need <= now;
  const rec = fits ? 'keep' : 'mid';
  const pv = pathValues(need);
  const paths = [['keep', 'Manter o prazo', pv.keep, 'O prazo que você escolheu.'], ['mid', 'Equilibrado', pv.mid, 'Sem mexer no essencial.'], ['light', 'Leve', pv.light, 'Devagar e sempre.']]
    .map(([id, l, v, d]) => ({ id, l, v: Math.max(50, v), d, months: Math.ceil(rest / Math.max(50, v)) }));
  const chosen = paths.find((p) => p.id === (plan.path || rec)) || paths[1];
  const steps = [1 / 3, 2 / 3, 1].map((q) => { const mo = Math.max(1, Math.ceil(chosen.months * q)); return { ym: addMonths(mo), v: Math.min(value, saved + chosen.v * mo) }; });
  const reserve = goals.find((g) => g.kind === 'reserve');
  return `${card('target', 'Metas', `<button class="btn sm" data-action="open-form" data-key="savings">${icon('plus')}Nova meta</button>`, `<p class="fn-note" style="margin-top:0">Diga o que você quer conquistar. O ORBITA monta o plano com os seus números.</p>
      <div class="fn-plan">
        <div class="fn-step"><span class="fn-n">1</span><div><b>Descreva sua meta com suas palavras</b>
          <input class="pjm-input" data-input="fn-plan-text" value="${esc(plan.text)}" placeholder="Ex.: Viagem para o Chile de 8 mil até março" autocomplete="off">
          <div class="fn-understood"><span>O que entendi:</span>
            <label>Nome<input class="pjm-input sm" data-input="fn-plan" data-f="title" value="${esc(plan.title)}" placeholder="Nome da meta"></label>
            <label>Valor R$<input class="pjm-input sm" type="number" min="0" step="100" data-input="fn-plan" data-f="value" value="${esc(plan.value)}" placeholder="0"></label>
            <label>Prazo<input class="pjm-input sm" type="month" data-change="fn-plan-dl" value="${esc(plan.deadline)}"></label>
            <label>Já guardado R$<input class="pjm-input sm" type="number" min="0" step="50" data-input="fn-plan" data-f="saved" value="${esc(plan.saved)}" placeholder="0"></label>
          </div>
          <div class="fn-income"><span>Sua renda é:</span>${seg('fn-plan-income', [['Fixa', 'Fixa'], ['Variável', 'Variável'], ['Mista', 'Mista']], plan.income)}${plan.income !== 'Fixa' ? '<small>Na variável, meses bons cobrem os fracos.</small>' : ''}</div></div></div>
        ${value ? `<div class="fn-step"><span class="fn-n">2</span><div><b>É viável com os seus números?</b>
          <p class="fn-verdict ${fits ? 'ok' : 'bad'}">${fits ? `Cabe: em ${ymLabel(plan.deadline)} você chega lá guardando ${brl(need)} por mês.` : `Apertado demais para ${ymLabel(plan.deadline)}.`}</p>
          <p class="fn-note">Hoje você guarda em média ${brl(now)} por mês (últimos 3 meses). Para chegar em ${ymLabel(plan.deadline)}, precisaria guardar ${brl(need)} por mês${inc ? ` (${pct(need, inc)}% da renda)` : ''}.</p>
          <div class="fn-vs"><div><span>Você guarda hoje</span><div class="bar"><i style="width:${Math.min(100, pct(now, Math.max(now, need)))}%"></i></div><b>${brl(now)}</b></div><div><span>Precisa (${ymLabel(plan.deadline)})</span><div class="bar ${fits ? '' : 'red'}"><i style="width:${Math.min(100, pct(need, Math.max(now, need)))}%"></i></div><b>${brl(need)}</b></div></div></div></div>
        <div class="fn-step"><span class="fn-n">3</span><div><b>Escolha um caminho</b><div class="fn-paths">${paths.map((p) => `<button class="${chosen.id === p.id ? 'on' : ''}" data-action="fn-plan-path" data-v="${p.id}"><span>${p.l}${p.id === rec ? '<em>Recomendado</em>' : ''}</span><b>${brl(p.v)} / mês</b><small>Conquista em ${ymLabel(addMonths(p.months))} · ${p.d}</small></button>`).join('')}</div></div></div>
        <div class="fn-step"><span class="fn-n">4</span><div><b>Plano “${chosen.l}” · ${chosen.months} ${chosen.months === 1 ? 'mês' : 'meses'}</b>
          <div class="fn-miles">${steps.map((s) => `<div><small>${ymLabel(s.ym).toUpperCase()}</small><b>${brl(s.v)}</b></div>`).join('')}</div>
          <p class="fn-note">O aporte de ${brl(chosen.v)} entra como linha obrigatória no orçamento e reduz o “disponível para gastar”. Se escorregar: gastar ${brl(round50(chosen.v * 0.3))} a mais por mês reduz o aporte para ${brl(chosen.v - round50(chosen.v * 0.3))} e empurra a meta para ${ymLabel(addMonths(Math.ceil(rest / Math.max(50, chosen.v - round50(chosen.v * 0.3)))))}.</p>
          <button class="btn primary" data-action="fn-plan-create" ${plan.title.trim() ? '' : 'disabled'}>Criar plano com ${brl(chosen.v)}/mês</button>${plan.title.trim() ? '' : ' <small class="muted">Dê um nome para a meta.</small>'}</div></div>` : ''}
      </div>`)}
    ${card('piggy', 'Minhas metas', '', `${reserve ? '' : `<div class="fn-goal"><div class="fn-goal-t"><b>Reserva de emergência</b><span>${brl(0)}</span></div><div class="bar"><i style="width:0"></i></div><div class="fn-goal-t"><small>Sugestão: ${brl(round50(avgExpense() * 6))} (6 meses de gastos)</small>${linkBtn('Definir meta', 'fn-reserve')}</div></div>`}
      ${goals.map((g) => `<div class="fn-goal big"><div class="fn-goal-t"><b>${esc(g.title)}</b><span>${brl(g.saved)}${g.target ? ` <small>de ${brl(g.target)}</small>` : ''}</span></div><div class="bar ${pct(+g.saved, +g.target) >= 100 ? 'green' : ''}"><i style="width:${Math.min(100, pct(+g.saved, +g.target))}%"></i></div>
        <div class="fn-goal-t"><small>${g.target ? `${pct(+g.saved, +g.target)}%` : 'Sem meta definida'}${g.monthly ? ` · ${brl(g.monthly)}/mês` : ''}${g.deadline ? ` · até ${ymLabel(g.deadline.slice(0, 7))}` : ''}</small><span class="fn-acts">${linkBtn('Guardar', 'fn-deposit', `data-id="${g.id}"`)}<button class="icon-btn sm" data-action="open-form" data-key="savings" data-id="${g.id}" aria-label="Editar">${icon('edit')}</button></span></div></div>`).join('')}
      ${goals.length ? '' : emptyLine('Nenhuma meta financeira ainda.')}`)}`;
}

// ---------- Orçamento ----------
function budgetTab() {
  const f = F();
  const b = state.settings.budgets || {};
  const cur = sum(`${monthKey(f.m)}-01`, lastDay(monthKey(f.m)));
  const goalLines = items('savings').filter((g) => +g.monthly);
  const rows = Object.entries(b).sort((x, y) => (cur.byCat[y[0]] || 0) / y[1] - (cur.byCat[x[0]] || 0) / x[1]);
  const total = Object.values(b).reduce((s, v) => s + v, 0) + goalLines.reduce((s, g) => s + +g.monthly, 0);
  const free = EXPENSE_CATS.filter((c) => !(c in b));
  return `<div class="fn-bar">${monthNav()}<span class="muted">Planejado ${brl(total)} · gasto ${brl(cur.expense)}</span></div>
    ${card('target', 'Orçamento do mês', '', `<p class="fn-note" style="margin-top:0">Um plano criado em “Metas” entra aqui como linha obrigatória.</p>
      ${goalLines.map((g) => { const got = (g.deposits || []).filter((d) => d.date.startsWith(monthKey(f.m))).reduce((s, d) => s + +d.amount, 0); return `<div class="fn-bud must"><span>${icon('piggy')}${esc(g.title)}<em>obrigatória</em></span><div class="bar green"><i style="width:${Math.min(100, pct(got, g.monthly))}%"></i></div><b>${brl(got)} <small>/ ${brl(g.monthly)}</small></b></div>`; }).join('')}
      ${rows.length ? rows.map(([c, lim]) => { const s = cur.byCat[c] || 0; const p = pct(s, lim); return `<div class="fn-bud"><span>${icon(CAT_ICON[c] || 'wallet')}${esc(c)}${p >= 100 ? '<em class="bad">estourou</em>' : p >= 80 ? '<em class="warn">80%+</em>' : ''}</span><div class="bar ${p >= 100 ? 'red' : p >= 80 ? 'yellow' : ''}"><i style="width:${Math.min(100, p)}%"></i></div><b>${brl(s)} <small>/ ${brl(lim)}</small></b><button class="icon-btn sm" data-action="fn-bud-del" data-c="${esc(c)}" aria-label="Tirar ${esc(c)}">${icon('x')}</button></div>`; }).join('')
        : goalLines.length ? '' : emptyLine('Nenhum orçamento ainda. Defina um limite para uma categoria e acompanhe o quanto já gastou. Você é avisado aos 80% e quando estourar.')}
      ${free.length ? `<form class="fn-bud-form" data-submit="fn-bud-add"><span class="pjm-label" style="margin:0">Novo orçamento</span><div class="hbm-select fn-sel"><select name="cat" aria-label="Categoria"><option value="">Categoria…</option>${free.map((c) => `<option>${c}</option>`).join('')}</select>${icon('chevD')}</div><input name="lim" type="number" min="1" step="10" class="pjm-input sm" placeholder="Limite R$" aria-label="Limite"><button class="btn primary sm">Adicionar</button></form>` : ''}`)}`;
}

// ---------- Dívidas ----------
function simulate(debts, extra, order) {
  let ds = debts.map((d) => ({ id: d.id, title: d.title, bal: +d.remaining || 0, pay: +d.amount || 0, rate: (+d.rate || 0) / 100 })).filter((d) => d.bal > 0);
  const payoff = {};
  let month = 0, interest = 0;
  const budget = ds.reduce((s, d) => s + d.pay, 0) + extra;
  while (ds.length && month < 600) {
    month++;
    ds.forEach((d) => { const j = d.bal * d.rate; interest += j; d.bal += j; });
    if (order === 'avalanche') ds.sort((a, b) => b.rate - a.rate || a.bal - b.bal); else if (order === 'snowball') ds.sort((a, b) => a.bal - b.bal);
    let left = order === 'none' ? Infinity : budget;
    ds.forEach((d) => { const p = Math.min(d.bal, d.pay, left); d.bal -= p; if (left !== Infinity) left -= p; });
    if (order !== 'none') for (const d of ds) { if (left <= 0) break; const p = Math.min(d.bal, left); d.bal -= p; left -= p; }
    ds.forEach((d) => { if (d.bal <= 0.01 && !payoff[d.id]) payoff[d.id] = month; });
    ds = ds.filter((d) => d.bal > 0.01);
    if (order === 'none' && ds.length && ds.every((d) => d.pay <= d.bal * d.rate)) { month = 600; break; }
  }
  return { months: month, interest, payoff, never: month >= 600 };
}
function debtsTab() {
  const f = F();
  const debts = items('bills').filter((b) => b.type === 'Dívida' && (+b.remaining || 0) > 0).sort((a, b) => (+b.rate || 0) - (+a.rate || 0));
  const total = debts.reduce((s, d) => s + +d.remaining, 0);
  const parcels = debts.reduce((s, d) => s + (+d.amount || 0), 0);
  const juros = debts.reduce((s, d) => s + (+d.remaining) * (+d.rate || 0) / 100, 0);
  const extra = +f.extra || 0;
  const base = simulate(debts, 0, 'none'), snow = simulate(debts, extra, 'snowball'), aval = simulate(debts, extra, 'avalanche');
  const mo = (r) => (r.never ? 'nunca' : `${r.months} ${r.months === 1 ? 'mês' : 'meses'}`);
  const best = aval.interest <= snow.interest ? 'avalanche' : 'snowball';
  return `<div class="fn-kpis">
      <div class="fn-kpi"><span>Total devido</span><b class="${total ? 'down' : ''}">${brl(total)}</b></div>
      <div class="fn-kpi"><span>Parcelas por mês</span><b>${brl(parcels)}</b></div>
      <div class="fn-kpi"><span>Juros que você paga por mês</span><b>≈ ${brl(juros)}</b></div>
      <div class="fn-kpi"><span>Quitação no ritmo atual</span><b>${debts.length ? mo(base) : '—'}</b><small>sem aportes extras</small></div>
    </div>
    ${card('arrowDown', 'Suas dívidas, da mais cara para a mais barata', `<button class="btn sm" data-action="fn-debt-new">${icon('plus')}Adicionar</button>`, debts.length ? `<div class="fn-rows">${debts.map((d) => `<button class="fn-row click" data-action="open-form" data-key="bills" data-id="${d.id}"><span class="fn-cat">${icon('card')}</span><span class="fn-desc">${esc(d.title)}<small>${d.rate ? `${String(d.rate).replace('.', ',')}% ao mês` : 'juros não informados'} · parcela ${brl(d.amount)}${aval.payoff[d.id] ? ` · quitada em ${ymLabel(addMonths(aval.payoff[d.id]))}` : ''}</small></span><b>${brl(d.remaining)}</b></button>`).join('')}</div>`
      : emptyLine('Nenhuma dívida cadastrada. Se você tem, adicione o saldo e os juros: o plano mostra a melhor ordem para quitar — e ninguém vê isto aqui além de você.'))}
    ${card('chart', 'Plano de quitação', '', `<p class="fn-note" style="margin-top:0">Simule como o método afeta o tempo e os juros pagos.</p>
      <label class="fn-extra">Valor extra por mês: R$ <input type="number" min="0" step="50" class="pjm-input sm" data-change="fn-extra" value="${extra}"></label>
      <div class="fn-sims">
        <div><small>Só as parcelas (ritmo atual)</small><b>${debts.length ? mo(base) : '0 mês'}</b><span>${base.never ? 'a parcela não vence os juros' : `${brl(base.interest)} de juros`}</span><em>Ponto de partida</em></div>
        <div class="${best === 'snowball' && debts.length ? 'best' : ''}"><small>Bola de neve + ${brl(extra)}</small><b>${debts.length ? mo(snow) : '0 mês'}</b><span>${brl(snow.interest)} de juros</span><em>Menor saldo primeiro</em></div>
        <div class="${best === 'avalanche' && debts.length ? 'best' : ''}"><small>Avalanche + ${brl(extra)}${best === 'avalanche' ? ' · Recomendado' : ''}</small><b>${debts.length ? mo(aval) : '0 mês'}</b><span>${brl(aval.interest)} de juros</span><em>Menos juros no total</em></div>
      </div>
      <p class="fn-note">${debts.length ? `A avalanche paga primeiro a dívida de maior juros: economiza ${brl(Math.max(0, base.interest - aval.interest))} frente ao ritmo atual. Quando uma dívida é quitada, a parcela dela passa para a próxima da fila sem aumentar seu gasto mensal.` : 'Adicione uma dívida para ver o plano.'}</p>`)}`;
}

// ---------- Análises ----------
function analyticsTab() {
  const f = F();
  const [a, b] = periodRange(f.period, f.m);
  const [pa, pb] = periodRange(f.period, f.m + prevOffset(f.period));
  const cur = sum(a, b), prev = sum(pa, pb);
  const cats = Object.entries(cur.byCat).sort((x, y) => y[1] - x[1]);
  const max = cats[0]?.[1] || 1;
  const days = Math.max(1, Math.round((Math.min(parseISO(b), parseISO(today())) - parseISO(a)) / 864e5) + 1);
  const top = cats[0];
  const sob = cur.income - cur.expense, psob = prev.income - prev.expense;
  const v = (x, y) => (y ? `${x >= y ? '+' : ''}${Math.round(((x - y) / Math.abs(y)) * 100)}%` : '—');
  // Gastos que aparecem em 2 dos últimos 3 meses e não estão como fixos.
  const known = new Set([...items('recurring').map((r) => r.desc), ...items('subscriptions').map((s) => s.name), ...items('bills').map((x) => x.title)].map((s) => (s || '').toLowerCase()));
  const seen = {};
  for (let k = 0; k < 3; k++) { const [x, y] = periodRange('Mês', -k); sum(x, y).list.filter((t) => t.type === 'Despesa').forEach((t) => { const d = (t.desc || '').toLowerCase(); (seen[d] ||= { desc: t.desc, months: new Set(), total: 0 }).months.add(k); seen[d].total += +t.amount; }); }
  const repeats = Object.values(seen).filter((x) => x.months.size >= 2 && !known.has(x.desc.toLowerCase())).map((x) => ({ ...x, avg: x.total / x.months.size })).sort((x, y) => y.avg - x.avg).slice(0, 6);
  const label = f.period === 'Mês' ? [monthShort(+monthKey(f.m + prevOffset(f.period)).slice(5) - 1), monthShort(+monthKey(f.m).slice(5) - 1)] : ['Anterior', 'Atual'];
  return `<div class="fn-bar">${seg('fn-period', [['Mês', 'Mês'], ['Trimestre', 'Trimestre'], ['Ano', 'Ano']], f.period)}<div class="fn-bar-r">${monthNav()}<button class="btn sm" data-action="fn-export" data-scope="period">${icon('download')}Exportar CSV</button><button class="btn sm" data-action="fn-print">${icon('file')}Exportar PDF</button></div></div>
    ${card('wallet', 'Despesas por categoria', `<span class="muted">${brl(cur.expense)} em ${cats.length} categorias</span>`, cats.length ? `<div class="fn-cats">${cats.slice(0, 10).map(([c, val], i) => `<button class="fn-catbar" data-action="fn-cat-go" data-c="${esc(c)}"><span>${icon(CAT_ICON[c] || 'wallet')}${esc(c)}</span><div class="bar"><i style="width:${(val / max) * 100}%;background:${PALETTE[i % PALETTE.length]}"></i></div><b>${brl(val)}</b><small>${pct(val, cur.expense)}%</small></button>`).join('')}</div><p class="fn-note">Clique numa categoria para ver as transações.</p>` : emptyLine('Nenhuma despesa registrada no período.'))}
    ${card('spark', 'O que os números dizem', '', `<div class="fn-insights">
      <div><b>Concentração</b><p>${top && pct(top[1], cur.expense) >= 35 ? `${esc(top[0])} leva ${pct(top[1], cur.expense)}% do que você gastou.` : 'Nenhuma categoria concentrando o gasto no período.'}</p></div>
      <div><b>Ritmo</b><p>Você gasta em média ${brl(cur.expense / days)} por dia.</p></div>
      <div><b>Poupança</b><p>${cur.income ? `Sobrou ${pct(sob, cur.income)}% da renda (${brl(sob)}).` : 'Sem receitas no período: sobra não calculada.'}</p></div></div>`)}
    ${card('chart', `Comparativo: ${label[0]} × ${label[1]}`, '', `<div class="fn-table-wrap"><table class="fn-table"><thead><tr><th>Indicador</th><th>${label[0]}</th><th>${label[1]}</th><th>Variação</th></tr></thead><tbody>
      <tr><td>Receitas</td><td>${brl(prev.income)}</td><td>${brl(cur.income)}</td><td>${v(cur.income, prev.income)}</td></tr>
      <tr><td>Despesas</td><td>${brl(prev.expense)}</td><td>${brl(cur.expense)}</td><td>${v(cur.expense, prev.expense)}</td></tr>
      <tr><td>Sobra calculada</td><td>${brl(psob)}</td><td>${brl(sob)}</td><td>${v(sob, psob)}</td></tr>
      <tr><td>% da renda que sobrou</td><td>${prev.income ? pct(psob, prev.income) + '%' : '—'}</td><td>${cur.income ? pct(sob, cur.income) + '%' : '—'}</td><td>—</td></tr></tbody></table></div>`)}
    ${card('repeat', 'Gastos que se repetem', `<span class="muted">≈ ${brl(repeats.reduce((s, r) => s + r.avg, 0))} por mês fora da previsão</span>`, repeats.length ? `<div class="fn-rows">${repeats.map((r) => `<div class="fn-row"><span class="fn-desc">${esc(r.desc)}<small>em ${r.months.size} dos últimos 3 meses</small></span><b>≈ ${brl(r.avg)}</b><button class="btn sm" data-action="fn-make-rec" data-desc="${esc(r.desc)}" data-v="${Math.round(r.avg * 100) / 100}">Virar fixa</button></div>`).join('')}</div>` : emptyLine('Nenhum gasto repetido sem conta fixa no momento.'))}`;
}

// ---------- Janela de transação ----------
let tm = null;
export function openTxModal(defaults = {}, id = null) {
  const t = id ? find('transactions', id) : null;
  tm = t ? { ...t, amount: String(t.amount) } : { type: defaults.type || 'Despesa', desc: defaults.desc || '', amount: defaults.amount ? String(defaults.amount) : '', category: defaults.category || '', tags: '', date: defaults.date || today(), account: defaults.account || '' };
  tm.tagList = (tm.tags || '').split(',').map((x) => x.trim()).filter(Boolean);
  renderTx();
  return true;
}
function renderTx(focus = '#txm-desc') {
  const cats = tm.type === 'Receita' ? INCOME_CATS : EXPENSE_CATS;
  const acc = items('accounts');
  openOverlay(`<div class="modal pjm txm" role="dialog" aria-label="${tm.id ? 'Editar transação' : 'Nova transação'}">
    <div class="pjm-head"><span class="pj-ico">${icon('wallet')}</span><div><h3>${tm.id ? 'Editar transação' : 'Nova transação'}</h3><p>${tm.id ? 'Ajuste o que precisar.' : 'Registre uma entrada ou saída.'}</p></div><button class="icon-btn" data-action="close-overlay" aria-label="Fechar">${icon('x')}</button></div>
    <div class="pjm-body">
      <div class="txm-type"><button class="out ${tm.type === 'Despesa' ? 'on' : ''}" data-action="txm-type" data-v="Despesa">${icon('arrowDown')}Despesa</button><button class="in ${tm.type === 'Receita' ? 'on' : ''}" data-action="txm-type" data-v="Receita">${icon('arrowUp')}Receita</button></div>
      <label class="pjm-label" for="txm-desc">Descrição <em class="req">*</em></label>
      <input id="txm-desc" class="pjm-input sm" data-input="txm-f" data-f="desc" value="${esc(tm.desc)}" placeholder="ex: Licença Figma ou Pagamento do projeto" autocomplete="off" maxlength="120">
      <div class="pjm-two">
        <div><label class="pjm-label" for="txm-amount">Valor (R$) <em class="req">*</em></label><input id="txm-amount" class="pjm-input sm mono" type="number" min="0" step="0.01" inputmode="decimal" data-input="txm-f" data-f="amount" value="${esc(tm.amount)}" placeholder="0,00"></div>
        <div><label class="pjm-label" for="txm-cat">Categoria</label><div class="hbm-select"><select id="txm-cat" data-change="txm-cat">${[...new Set([...cats, tm.category].filter(Boolean))].map((c) => `<option ${tm.category === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>${icon('chevD')}</div></div>
      </div>
      ${acc.length ? `<label class="pjm-label" for="txm-acc">Conta ou cartão</label><div class="hbm-select"><select id="txm-acc" data-change="txm-acc"><option value="">${esc(acc.find((a) => !isCard(a))?.name || 'Conta principal')} (padrão)</option>${acc.map((a) => `<option value="${a.id}" ${tm.account === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select>${icon('chevD')}</div>` : ''}
      <label class="pjm-label" for="txm-tag">${icon('tag')} Tags (opcional)</label>
      <div class="txm-tags"><input id="txm-tag" class="pjm-input sm" placeholder="Ex.: viagem, compras, projeto (Enter para adicionar)" autocomplete="off"><button class="btn" data-action="txm-tag-add">Adicionar</button></div>
      ${tm.tagList.length ? `<div class="glm-sugg">${tm.tagList.map((t, i) => `<button data-action="txm-tag-del" data-i="${i}">#${esc(t)} ×</button>`).join('')}</div>` : ''}
      <label class="pjm-label">Data <em class="req">*</em></label>
      <label class="pjm-date">${icon('calendar')}<span>${tm.date === today() ? `Hoje, ${shortD(tm.date)}` : tm.date === addDays(-1) ? `Ontem, ${shortD(tm.date)}` : fmtDate(tm.date)}</span><input type="date" data-change="txm-date" value="${tm.date}"></label>
      <label class="fn-check" style="margin-top:12px"><input type="checkbox" data-change="txm-internal" ${tm.internal ? 'checked' : ''}>Movimentação interna (entre suas contas, não conta como gasto)</label>
    </div>
    <div class="pjm-foot">${tm.id ? `<button class="btn danger" data-action="txm-delete" style="margin-right:auto">${icon('trash')}Excluir</button>` : ''}<button class="btn ghost" data-action="close-overlay">Cancelar</button><button class="btn primary" data-action="txm-save" ${tm.desc.trim() && +tm.amount > 0 ? '' : 'disabled'}>${tm.id ? 'Salvar alterações' : 'Salvar transação'}</button></div>
  </div>`, (bd) => { bd.classList.add('pjm-backdrop'); const el = focus && bd.querySelector(focus); if (el) { el.focus(); el.setSelectionRange?.(el.value.length, el.value.length); } });
}
const txOk = () => { const b = document.querySelector('[data-action="txm-save"]'); if (b) b.disabled = !(tm.desc.trim() && +tm.amount > 0); };
on('txm-f', (ds, el) => {
  tm[ds.f] = el.value;
  if (ds.f === 'desc' && !tm.catTouched && !tm.id) { const g = guessCategory(el.value, tm.type); const sel = document.getElementById('txm-cat'); if (g !== 'Outros' && sel && [...sel.options].some((o) => o.value === g)) { sel.value = g; tm.category = g; } }
  txOk();
});
on('txm-type', (ds) => { tm.type = ds.v; tm.category = ''; renderTx(null); });
on('txm-cat', (ds, el) => { tm.category = el.value; tm.catTouched = true; });
on('txm-acc', (ds, el) => { tm.account = el.value; });
on('txm-date', (ds, el) => { tm.date = el.value || today(); renderTx(null); });
on('txm-internal', (ds, el) => { tm.internal = el.checked; });
const addTag = () => { const el = document.getElementById('txm-tag'); const v = el?.value.trim().replace(/^#/, ''); if (v && !tm.tagList.includes(v)) { tm.tagList.push(v); renderTx('#txm-tag'); } };
on('txm-tag-add', addTag);
on('txm-tag-del', (ds) => { tm.tagList.splice(+ds.i, 1); renderTx(null); });
on('txm-save', () => {
  if (!(tm.desc.trim() && +tm.amount > 0)) return;
  const cats = tm.type === 'Receita' ? INCOME_CATS : EXPENSE_CATS;
  const data = { desc: tm.desc.trim(), type: tm.type, amount: Math.round(+tm.amount * 100) / 100, category: tm.category || (document.getElementById('txm-cat')?.value) || cats[0], date: tm.date, tags: tm.tagList.join(', '), account: tm.account || '', internal: !!tm.internal, review: false };
  upsert('transactions', tm.id ? { id: tm.id, ...data } : data);
  toast(tm.id ? 'Transação atualizada' : 'Transação registrada');
  tm = null;
  closeOverlay();
});
on('txm-delete', async () => {
  const t = tm && find('transactions', tm.id);
  if (!t) return;
  closeOverlay();
  if (await confirmDialog(`Excluir “${t.desc}”?`, 'A transação some do saldo e das análises.')) { remove('transactions', t.id); toast('Transação excluída'); }
  tm = null;
});
document.addEventListener('keydown', (e) => {
  if (!tm) return;
  if (e.key === 'Enter' && e.target.id === 'txm-tag') { e.preventDefault(); addTag(); }
  else if (e.key === 'Enter' && (e.target.id === 'txm-desc' || e.target.id === 'txm-amount')) { e.preventDefault(); document.querySelector('[data-action="txm-save"]')?.click(); }
});
formHooks.transactions = (d, id) => openTxModal(d, id);

// ---------- Pequena janela de valor ----------
let askCb = null;
function askValue(title, label, value, cb, hint = '') {
  askCb = cb;
  openOverlay(`<form class="modal fn-ask" data-submit="fn-ask"><div class="modal-head"><h3>${esc(title)}</h3><button type="button" class="icon-btn" data-action="close-overlay" aria-label="Fechar">${icon('x')}</button></div>
    <div class="modal-body"><label class="field full"><span>${esc(label)}</span><input name="v" type="number" min="0" step="0.01" inputmode="decimal" value="${value ?? ''}" required></label>${hint ? `<p class="fn-note">${hint}</p>` : ''}</div>
    <div class="modal-foot"><button type="button" class="btn" data-action="close-overlay">Cancelar</button><button class="btn primary">Salvar</button></div></form>`, (bd) => bd.querySelector('input')?.select());
}
on('fn-ask', (ds, form) => { const v = parseFloat(form.elements.v.value); closeOverlay(); if (askCb && !isNaN(v)) askCb(v); askCb = null; });

// ---------- Ações ----------
const showTab = () => requestAnimationFrame(() => document.querySelector('.fn-tabs .on')?.scrollIntoView({ block: 'nearest', inline: 'nearest' }));
on('fn-tab', (ds) => { setF({ tab: ds.v }); showTab(); });
on('fn-sub', (ds) => setF({ sub: ds.v }));
on('fn-go', (ds) => { setF({ tab: ds.tab, ...(ds.sub ? { sub: ds.sub } : {}) }); showTab(); window.scrollTo({ top: 0 }); });
on('fn-m', (ds) => setF({ m: F().m + +ds.d }));
on('fn-period', (ds) => setF({ period: ds.v }));
on('fn-days', (ds) => setF({ days: +ds.v }));
on('fn-daily', (ds, el) => setF({ daily: el.checked }));
on('fn-type', (ds) => setF({ type: ds.v }));
on('fn-cat', (ds, el) => setF({ cat: el.value }));
on('fn-internal', (ds, el) => setF({ showInternal: el.checked }));
on('fn-cat-go', (ds) => setF({ tab: 'tx', cat: ds.c, type: 'out' }));
on('fn-search', (ds, el) => {
  const q = el.value.trim().toLowerCase();
  document.querySelectorAll('.fn-tx').forEach((r) => { r.hidden = q && !r.dataset.q.includes(q); });
  document.querySelectorAll('.fn-day').forEach((d) => { d.hidden = ![...d.querySelectorAll('.fn-tx')].some((r) => !r.hidden); });
});
on('fn-new-tx', () => openTxModal());
on('fn-edit-tx', (ds) => openTxModal({}, ds.id));
on('fn-cap', () => askValue('Teto diário', 'Quanto você quer gastar no máximo por dia? (R$)', F().cap || Math.max(0, Math.floor(available().perDay)), (v) => setF({ cap: v || 0 }), 'Use 0 para tirar o teto.'));
on('fn-rec-new', () => openForm('recurring'));
on('fn-acc-new', () => openForm('accounts'));
on('fn-debt-new', () => openForm('bills', null, { type: 'Dívida' }));
on('fn-extra', (ds, el) => setF({ extra: Math.max(0, +el.value || 0) }));
on('fn-make-rec', (ds) => openForm('recurring', null, { desc: ds.desc, amount: ds.v, type: 'Despesa', day: new Date().getDate() }));
on('fn-reserve', () => {
  const sug = round50(avgExpense() * 6);
  askValue('Reserva de emergência', 'Quanto quer ter guardado? (R$)', sug || '', (v) => {
    const g = items('savings').find((x) => x.kind === 'reserve');
    upsert('savings', g ? { id: g.id, target: v } : { title: 'Reserva de emergência', kind: 'reserve', target: v, saved: 0, monthly: round50(v / 12), deadline: '', deposits: [] });
    toast('Meta da reserva definida');
  }, sug ? `Sugestão: 6 meses dos seus gastos médios (${brl(avgExpense())}/mês).` : '');
});
on('fn-deposit', (ds) => {
  const g = find('savings', ds.id);
  if (!g) return;
  askValue(`Guardar em “${g.title}”`, 'Quanto você guardou? (R$)', g.monthly || '', (v) => {
    if (!v) return;
    g.deposits = [...(g.deposits || []), { date: today(), amount: v }];
    upsert('savings', { id: g.id, saved: Math.round(((+g.saved || 0) + v) * 100) / 100, deposits: g.deposits });
    toast(+g.target && +g.saved + v >= +g.target ? 'Meta conquistada! 🎉' : `${brl(v)} guardados`);
  });
});
on('fn-plan-text', (ds, el) => {
  plan.text = el.value;
  const p = parseGoalText(el.value);
  if (p.title) plan.title = p.title;
  if (p.value) plan.value = String(p.value);
  if (p.deadline) plan.deadline = p.deadline;
  clearTimeout(plan.t);
  plan.t = setTimeout(() => { save(); requestAnimationFrame(() => { const i = document.querySelector('[data-input="fn-plan-text"]'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }); }, 450);
});
on('fn-plan', (ds, el) => {
  plan[ds.f] = el.value;
  clearTimeout(plan.t);
  plan.t = setTimeout(() => { save(); requestAnimationFrame(() => { const i = document.querySelector(`[data-input="fn-plan"][data-f="${ds.f}"]`); if (i) { i.focus(); try { i.setSelectionRange(i.value.length, i.value.length); } catch { /* number */ } } }); }, 600);
});
on('fn-plan-dl', (ds, el) => { plan.deadline = el.value || addMonths(6); save(); });
on('fn-plan-income', (ds) => { plan.income = ds.v; save(); });
on('fn-plan-path', (ds) => { plan.path = ds.v; save(); });
on('fn-plan-create', () => {
  const value = +plan.value || 0, saved = +plan.saved || 0;
  const rest = Math.max(0, value - saved);
  const months = monthsBetween(plan.deadline);
  const need = rest / months;
  const pv = pathValues(need);
  const v = pv[plan.path || (need <= avgSaving() ? 'keep' : 'mid')];
  const monthly = Math.max(50, v);
  upsert('savings', { title: plan.title.trim(), target: value, saved, monthly, deadline: `${addMonths(Math.ceil(rest / monthly))}-01`, deposits: [], plan: plan.path, income: plan.income });
  toast(`Plano criado: ${brl(monthly)}/mês`);
  plan = null;
  save();
});
on('fn-bud-add', (ds, form) => {
  const c = form.elements.cat.value, v = parseFloat(form.elements.lim.value);
  if (!c || !(v > 0)) { toast('Escolha a categoria e o limite'); return; }
  state.settings.budgets = { ...(state.settings.budgets || {}), [c]: v };
  save();
  toast(`Orçamento de ${c}: ${brl(v)}`);
});
on('fn-bud-del', (ds) => { const b = { ...(state.settings.budgets || {}) }; delete b[ds.c]; state.settings.budgets = b; save(); });
on('fn-shop-cat', (ds) => setF({ shopCat: ds.v }));
on('fn-shop-add', (ds, form) => {
  const name = form.elements.name.value.trim();
  if (!name) return;
  items('shopping').push({ id: uid(), name, qty: Math.max(1, +form.elements.qty.value || 1), price: +form.elements.price.value || 0, cat: F().shopCat || 'Outros', got: false, createdAt: Date.now() });
  save();
  requestAnimationFrame(() => document.querySelector('.fn-shop-form input[name=name]')?.focus());
});
on('fn-shop-got', (ds) => { const i = items('shopping').find((x) => x.id === ds.id); if (i) { i.got = !i.got; save(); } });
on('fn-shop-del', (ds) => { state.data.shopping = items('shopping').filter((x) => x.id !== ds.id); save(); });
on('fn-shop-clear', () => { state.data.shopping = items('shopping').filter((x) => !x.got); save(); toast('Comprados tirados da lista'); });
on('fn-shop-spend', () => {
  const got = items('shopping').filter((x) => x.got);
  const total = got.reduce((s, i) => s + (+i.price || 0) * (+i.qty || 1), 0);
  if (!total) return;
  const cat = got.every((i) => ['Supermercado', 'Feira'].includes(i.cat)) ? 'Mercado' : 'Compras';
  openTxModal({ type: 'Despesa', desc: `Compras: ${got.slice(0, 3).map((i) => i.name).join(', ')}${got.length > 3 ? '…' : ''}`, amount: Math.round(total * 100) / 100, category: cat });
  state.data.shopping = items('shopping').filter((x) => !x.got);
});

// ---------- Exportar ----------
function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
on('fn-export', (ds) => {
  const f = F();
  const [a, b] = ds.scope === 'month' ? periodRange('Mês', f.m) : periodRange(f.period, f.m);
  const rows = tx().filter((t) => t.date >= a && t.date <= b).sort((x, y) => x.date.localeCompare(y.date));
  const q = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const csv = ['Data;Descrição;Tipo;Categoria;Valor;Conta;Tags', ...rows.map((t) => [t.date, q(t.desc), t.type, q(t.category), String(t.type === 'Receita' ? t.amount : -t.amount).replace('.', ','), q(accName(t.account) || ''), q(t.tags || '')].join(';'))].join('\n');
  download(`orbita-transacoes-${a}-a-${b}.csv`, '﻿' + csv, 'text/csv;charset=utf-8');
  toast(`${rows.length} transações exportadas`);
});
on('fn-print', () => { document.body.classList.add('fn-printing'); window.print(); setTimeout(() => document.body.classList.remove('fn-printing'), 500); });

// ---------- Importar extrato (CSV ou OFX) ----------
const num = (s) => {
  let v = String(s).trim().replace(/[R$\s]/g, '');
  const neg = /^\(.*\)$/.test(v) || /-$/.test(v); v = v.replace(/[()]/g, '').replace(/-$/, '');
  if (/,\d{1,2}$/.test(v)) v = v.replace(/\./g, '').replace(',', '.'); else v = v.replace(/,/g, '');
  const n = parseFloat(v); return neg ? -Math.abs(n) : n;
};
const toISO = (s) => {
  s = String(s).trim();
  let m = s.match(/^(\d{4})-?(\d{2})-?(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/); if (m) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return '';
};
function splitCsv(line, sep) {
  const out = []; let cur = '', q = false;
  for (const ch of line) { if (ch === '"') q = !q; else if (ch === sep && !q) { out.push(cur); cur = ''; } else cur += ch; }
  out.push(cur); return out.map((x) => x.trim());
}
export function parseStatement(text, name = '') {
  const rows = [];
  if (/<OFX>|<STMTTRN>/i.test(text) || /\.ofx$/i.test(name)) {
    for (const blk of text.split(/<STMTTRN>/i).slice(1)) {
      const g = (tag) => (blk.match(new RegExp(`<${tag}>([^<\\r\\n]*)`, 'i')) || [])[1]?.trim() || '';
      const amount = num(g('TRNAMT').replace('.', ',').replace(/,(\d{3})/, '$1'));
      const date = toISO(g('DTPOSTED'));
      if (date && !isNaN(amount)) rows.push({ date, desc: g('MEMO') || g('NAME') || 'Lançamento', amount });
    }
    return rows;
  }
  const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.trim());
  if (!lines.length) return rows;
  const sep = (lines[0].match(/;/g) || []).length >= (lines[0].match(/,/g) || []).length ? ';' : (lines[0].includes('\t') ? '\t' : ',');
  const head = splitCsv(lines[0], sep).map((h) => h.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''));
  const idx = (re) => head.findIndex((h) => re.test(h));
  let iD = idx(/^data|date|dt/), iS = idx(/descri|historico|title|memo|lancamento|estabelecimento|nome/), iV = idx(/valor|amount|quantia|montante/);
  const iIn = idx(/credito|entrada/), iOut = idx(/debito|saida/);
  const hasHead = iD >= 0 && (iV >= 0 || iIn >= 0);
  if (!hasHead) { iD = 0; iS = 1; iV = 2; }
  for (const l of lines.slice(hasHead ? 1 : 0)) {
    const c = splitCsv(l, sep);
    const date = toISO(c[iD] || '');
    let amount = iV >= 0 ? num(c[iV] || '') : (num(c[iIn] || '0') || 0) - Math.abs(num(c[iOut] || '0') || 0);
    if (!date || isNaN(amount) || !amount) continue;
    rows.push({ date, desc: (c[iS] || 'Lançamento').replace(/\s+/g, ' ').trim(), amount });
  }
  return rows;
}
on('fn-import', (ds, el) => {
  const file = el.files?.[0];
  if (!file) return;
  const rd = new FileReader();
  rd.onload = () => {
    const rows = parseStatement(String(rd.result), file.name);
    el.value = '';
    if (!rows.length) { toast('Não encontrei lançamentos nesse arquivo'); return; }
    const key = (t) => `${t.date}|${Math.abs(+t.amount).toFixed(2)}|${(t.desc || '').toLowerCase()}`;
    const have = new Set(tx().map((t) => key(t)));
    let n = 0;
    rows.forEach((r) => {
      const t = { date: r.date, desc: r.desc, type: r.amount < 0 ? 'Despesa' : 'Receita', amount: Math.abs(Math.round(r.amount * 100) / 100) };
      if (have.has(key(t))) return;
      t.category = guessCategory(t.desc, t.type);
      t.review = t.category === 'Outros';
      t.imported = true;
      t.id = uid(); t.createdAt = Date.now();
      items('transactions').push(t); have.add(key(t)); n++;
    });
    const ms = rows.map((r) => r.date.slice(0, 7)).sort();
    F().tab = 'tx'; F().type = n && items('transactions').some((t) => t.review) ? 'review' : 'all';
    const last = ms.at(-1); const now = monthKey(); F().m = (+last.slice(0, 4) - +now.slice(0, 4)) * 12 + (+last.slice(5) - +now.slice(5));
    save();
    toast(n ? `${n} transações importadas${rows.length - n ? ` · ${rows.length - n} repetidas ignoradas` : ''}` : 'Tudo isso já estava importado');
  };
  rd.readAsText(file, /\.ofx$/i.test(file.name) ? 'latin1' : 'utf-8');
});
