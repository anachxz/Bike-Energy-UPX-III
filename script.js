/* Bike Energy — protótipo acadêmico (UPX III). Todos os dados são DEMONSTRATIVOS e simulados. */
'use strict';

/* ---------- Utilidades ---------- */
const KEY = 'bikeenergy_v1';
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const brl = n => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const num = (n, d = 0) => n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const pad = v => String(v).padStart(2, '0');
const clock = s => `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s % 3600 / 60))}:${pad(s % 60)}`;
const hm = s => `${Math.floor(s / 3600)}h ${pad(Math.floor(s % 3600 / 60))}min`;
const dt = iso => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const toNum = v => { const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : NaN; };

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toast.id); toast.id = setTimeout(() => t.classList.remove('on'), 2800);
}

/* ---------- Dados (localStorage) ---------- */
function seed() {
  const now = new Date(), sessions = [];
  for (let d = 0; d < 190; d++) {            // sessões fictícias dos últimos ~6 meses
    if ((d * 7 + 3) % 4 === 0) continue;
    const min = 25 + (d * 11) % 35, p = 90 + (d * 37) % 90, x = new Date(now);
    x.setDate(now.getDate() - d); x.setHours(18, 0, 0, 0);
    sessions.push({ id: 's' + d, data: x.toISOString(), bike: 'BE-0' + (d % 8 + 1), seg: min * 60, pot: p, wh: +(p * min / 60).toFixed(1) });
  }
  const st = ['livre', 'livre', 'uso', 'livre', 'manutencao', 'uso', 'livre', 'livre'];
  const nomes = ['Marina Souza', 'Carlos Lima', 'Beatriz Alves', 'Rafael Costa', 'Juliana Rocha', 'Pedro Martins', 'Camila Dias', 'Lucas Ferreira', 'Aline Gomes', 'Thiago Ribeiro', 'Paula Nunes'];
  return {
    user: { nome: 'Aluno Demo', email: 'aluno@demo.com' },
    cfg: { mensalidade: 150, whReal: 100, limite: 20, meta: 3000 },
    sessions,
    bikes: st.map((s, i) => ({ id: 'BE-0' + (i + 1), status: s, usos: 40 + i * 7, wh: 6000 + i * 900 })),
    alunos: nomes.map((n, i) => ({ nome: n, sess: 12 + (i * 5) % 20, wh: 1200 + (i * 937) % 4200 }))
  };
}
function load() { try { const d = JSON.parse(localStorage.getItem(KEY)); if (d && d.cfg && d.sessions) return d; } catch (e) { /* ignora */ } return seed(); }
let S = load();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('Não foi possível salvar no navegador.'); } };

/* ---------- Cálculos ---------- */
const sameMonth = (iso, ref = new Date()) => { const d = new Date(iso); return d.getMonth() === ref.getMonth() && d.getFullYear() === ref.getFullYear(); };
const sum = (a, f) => a.reduce((t, x) => t + f(x), 0);
/** Crédito (R$) = Energia (Wh) ÷ Wh por R$ 1,00 */
const credito = wh => wh / S.cfg.whReal;
function mes() {
  const ss = S.sessions.filter(s => sameMonth(s.data));
  const wh = sum(ss, s => s.wh), cred = credito(wh), max = S.cfg.mensalidade * S.cfg.limite / 100, desc = Math.min(cred, max);
  return { ss, wh, seg: sum(ss, s => s.seg), n: ss.length, cred, max, desc, final: S.cfg.mensalidade - desc, pct: Math.min(100, wh / S.cfg.meta * 100) };
}

/* ---------- Gráfico de barras em SVG (sem bibliotecas) ---------- */
function bars(data, unit, label) {
  const W = 600, H = 230, p = 30, max = Math.max(...data.map(d => d.v), 1), bw = (W - p * 2) / data.length;
  const aria = label + ': ' + data.map(d => `${d.l} ${num(d.v)} ${unit}`).join(', ');
  const b = data.map((d, i) => {
    const h = d.v / max * (H - 70), x = p + i * bw + bw * .15, y = H - 35 - h;
    return `<g><rect class="${i === data.length - 1 ? 'hi' : ''}" x="${x}" y="${y}" width="${bw * .7}" height="${h}" rx="6" style="animation-delay:${i * 50}ms"><title>${esc(d.l)}: ${num(d.v)} ${unit}</title></rect>
    <text class="v" x="${x + bw * .35}" y="${y - 6}" text-anchor="middle">${num(d.v)}</text>
    <text x="${x + bw * .35}" y="${H - 14}" text-anchor="middle">${esc(d.l)}</text></g>`;
  }).join('');
  return `<svg class="ch" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(aria)}"><line x1="${p}" x2="${W - p}" y1="${H - 35}" y2="${H - 35}" stroke="#c9d3ce"/>${b}</svg>`;
}
/** Soma de Wh por dia dos últimos 7 dias */
function last7(extra) {
  const out = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const v = sum(S.sessions.filter(s => new Date(s.data).toDateString() === d.toDateString()), s => s.wh) + (extra ? extra[6 - i] : 0);
    out.push({ l: d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''), v: Math.round(v) });
  }
  return out;
}

/* ---------- Ícones e navegação ---------- */
const IC = {
  home: 'M3 11l9-8 9 8v10H3z', bolt: 'M13 2L4 14h7l-1 8 9-12h-7z', list: 'M4 6h16M4 12h16M4 18h16',
  target: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 8a4 4 0 100 8 4 4 0 000-8z', wallet: 'M3 7h18v13H3zM3 7l3-4h12l3 4',
  user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0', bike: 'M5 18a3 3 0 100-6 3 3 0 000 6zM19 18a3 3 0 100-6 3 3 0 000 6zM12 18l-3-7h6l4 7M9 11l-1-3h3',
  users: 'M9 11a3 3 0 100-6 3 3 0 000 6zM3 20a6 6 0 0112 0M17 11a3 3 0 100-6M21 20a6 6 0 00-4-5.6', chart: 'M4 20V4M4 20h16M8 16v-5M12 16V8M16 16v-3',
  gear: 'M12 15a3 3 0 100-6 3 3 0 000 6zM12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2'
};
const NAV = {
  aluno: [['geral', 'Visão geral', 'home'], ['treino', 'Iniciar treino', 'bolt'], ['historico', 'Histórico', 'list'], ['metas', 'Metas', 'target'], ['mensalidade', 'Mensalidade', 'wallet'], ['perfil', 'Perfil', 'user']],
  admin: [['geral', 'Visão geral', 'home'], ['bikes', 'Bicicletas', 'bike'], ['alunos', 'Alunos', 'users'], ['relatorios', 'Relatórios', 'chart'], ['config', 'Configurações', 'gear']]
};
let role = 'aluno', cur = 'geral', H = { dias: 30, modo: 'sem' };

function go(v) {
  cur = v;
  $('#nav').innerHTML = NAV[role].map(([k, t, i]) => `<button data-act="go" data-arg="${k}" ${k === v ? 'aria-current="page"' : ''}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${IC[i]}"/></svg><span>${t}</span></button>`).join('');
  $('#view').innerHTML = V[role][v]();
  const h = $('#view h1'); if (h) { h.tabIndex = -1; $('#view').focus({ preventScroll: true }); }
  window.scrollTo(0, 0);
  if (v === 'treino') paintTreino();
}
const head = (t, sub) => `<header class="head"><div><h1>${t}</h1><p>${sub || ''}</p></div><button class="ghost only-m" data-act="sair">Sair</button></header>`;
const stat = (l, v, s, cls = '') => `<div class="card ${cls}"><div class="lbl">${l}</div><div class="val">${v}</div><div class="sub">${s || ''}</div></div>`;
const DEMO = '<span class="demo">Dados demonstrativos</span>';

/* ---------- Telas do ALUNO ---------- */
const V = { aluno: {}, admin: {} };
V.aluno.geral = () => {
  const m = mes(), h = new Date().getHours(), sd = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  return head(`${sd}, ${esc(S.user.nome.split(' ')[0])}!`, 'Seu resumo de energia do mês. ' + DEMO) + `
  <div class="grid">${stat('Energia gerada no mês', `${num(m.wh)} Wh`, `${num(m.wh / 1000, 2)} kWh`, 'hero')}
  ${stat('Tempo de exercício', hm(m.seg), 'neste mês')}${stat('Treinos', m.n, 'sessões no mês')}
  ${stat('Créditos acumulados', brl(m.cred), 'simulação')}${stat('Desconto previsto', brl(m.desc), `Mensalidade prevista: ${brl(m.final)}`)}</div>
  <div class="two"><div class="card"><h2>Meta mensal</h2><div class="bar" role="progressbar" aria-valuenow="${Math.round(m.pct)}" aria-valuemin="0" aria-valuemax="100" aria-label="Progresso da meta"><i style="width:${m.pct}%"></i></div>
  <p>${num(m.wh)} de ${num(S.cfg.meta)} Wh (${num(m.pct, 0)}%)</p><button class="btn dark" data-act="go" data-arg="treino">Iniciar treino</button></div>
  <div class="card"><h2>Energia nos últimos 7 dias (Wh)</h2>${bars(last7(), 'Wh', 'Energia gerada por dia')}</div></div>`;
};

/* Simulação de treino: potência varia e Energia (Wh) = Potência média (W) × Tempo (h) */
let T = null, timer = null;
V.aluno.treino = () => {
  const livres = S.bikes.filter(b => b.status === 'livre');
  return head('Iniciar treino', 'Simulação: os valores não são medições reais. ' + DEMO) + `
  <div class="card hero"><div class="lbl">${T ? 'Bicicleta ' + T.bike + (T.pausa ? ' · em pausa' : ' · em atividade') : 'Nenhuma sessão ativa'}</div>
  <div class="timer" id="t-time" aria-hidden="true">00:00:00</div>
  <div class="grid" style="margin:1rem 0 0"><div><div class="lbl">Potência instantânea</div><b class="val" id="t-pot">0 W</b></div>
  <div><div class="lbl">Potência média</div><b class="val" id="t-avg">0 W</b></div><div><div class="lbl">Energia acumulada</div><b class="val" id="t-wh">0,00 Wh</b></div></div>
  <div class="bar" aria-hidden="true"><i id="t-g" style="width:0"></i></div></div>
  <div class="card" style="margin-top:1rem">${T ? `<div class="row"><button class="btn dark" data-act="pausa">${T.pausa ? 'Retomar' : 'Pausar'}</button><button class="btn out" data-act="fim">Encerrar treino</button></div>` :
    `<form data-form="treino" novalidate><label for="bike">Bicicleta</label><select id="bike" aria-describedby="bike-e"><option value="">Selecione…</option>${livres.map(b => `<option>${b.id}</option>`).join('')}</select>
    <p class="err" id="bike-e" role="alert"></p><button class="btn" type="submit">Iniciar sessão</button></form>`}</div>`;
};
function paintTreino() {
  if (!$('#t-time') || !T) return;
  const avg = T.seg ? T.soma / T.seg : 0;
  $('#t-time').textContent = clock(T.seg);
  $('#t-pot').textContent = `${T.pausa ? 0 : T.pot} W`; $('#t-avg').textContent = `${num(avg)} W`;
  $('#t-wh').textContent = `${num(T.soma / 3600, 2)} Wh`; $('#t-g').style.width = (T.pausa ? 0 : T.pot / 300 * 100) + '%';
}
function tick() {
  if (!T || T.pausa) return;
  T.seg++; T.base = Math.max(60, Math.min(260, T.base + (Math.random() - .5) * 14));
  T.pot = Math.round(T.base + Math.sin(T.seg / 8) * 10);
  T.soma += T.pot;                        // soma de watts por segundo → Wh = soma/3600 = P média × t(h)
  if (cur === 'treino') paintTreino();
}
function setBike(id, status) { const b = S.bikes.find(x => x.id === id); if (b) b.status = status; }
function iniciar(id) { T = { bike: id, seg: 0, soma: 0, base: 130, pot: 130, pausa: false }; setBike(id, 'uso'); save(); clearInterval(timer); timer = setInterval(tick, 1000); toast('Treino iniciado.'); go('treino'); }
function encerrar() {
  clearInterval(timer); const t = T; T = null; setBike(t.bike, 'livre');
  if (t.seg < 5) { save(); toast('Sessão muito curta (menos de 5 s) e não foi salva.'); return go('treino'); }
  const wh = +(t.soma / 3600).toFixed(2), pot = Math.round(t.soma / t.seg);
  S.sessions.unshift({ id: 'u' + Date.now(), data: new Date().toISOString(), bike: t.bike, seg: t.seg, pot, wh });
  const b = S.bikes.find(x => x.id === t.bike); b.usos++; b.wh += wh;
  save(); toast(`Sessão salva: ${num(wh, 2)} Wh gerados.`); go('historico');
}

V.aluno.historico = () => {
  const lim = new Date(); lim.setDate(lim.getDate() - H.dias);
  const ss = S.sessions.filter(s => H.dias === 0 || new Date(s.data) >= lim);
  const ev = [];
  for (let i = 5; i >= 0; i--) {
    if (H.modo === 'sem') { const a = new Date(), z = new Date(); a.setDate(a.getDate() - i * 7 - 6); z.setDate(z.getDate() - i * 7); a.setHours(0, 0, 0, 0); z.setHours(23, 59, 59, 999);
      ev.push({ l: i ? `-${i} sem` : 'Atual', v: Math.round(sum(S.sessions.filter(s => { const d = new Date(s.data); return d >= a && d <= z; }), s => s.wh)) }); }
    else { const r = new Date(); r.setDate(1); r.setMonth(r.getMonth() - i);
      ev.push({ l: r.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''), v: Math.round(sum(S.sessions.filter(s => sameMonth(s.data, r)), s => s.wh)) }); }
  }
  const ops = [[7, '7 dias'], [30, '30 dias'], [90, '90 dias'], [0, 'Tudo']];
  return head('Histórico de treinos', 'Filtre por período e acompanhe sua evolução. ' + DEMO) + `
  <div class="card"><h2>Evolução ${H.modo === 'sem' ? 'semanal' : 'mensal'} (Wh)</h2>
  <div class="chips" role="group" aria-label="Tipo de evolução"><button data-act="modo" data-arg="sem" aria-pressed="${H.modo === 'sem'}">Semanal</button><button data-act="modo" data-arg="mes" aria-pressed="${H.modo === 'mes'}">Mensal</button></div>
  ${bars(ev, 'Wh', 'Evolução de energia')}</div>
  <div class="card" style="margin-top:1rem"><h2>Treinos registrados (${ss.length})</h2>
  <div class="chips" role="group" aria-label="Filtrar por período">${ops.map(([d, t]) => `<button data-act="dias" data-arg="${d}" aria-pressed="${H.dias === d}">${t}</button>`).join('')}</div>
  ${ss.length ? `<div class="tw" tabindex="0" role="region" aria-label="Tabela de treinos"><table><thead><tr><th>Data</th><th>Bicicleta</th><th>Duração</th><th>Potência média</th><th>Energia</th><th>Crédito</th></tr></thead><tbody>
  ${ss.slice(0, 60).map(s => `<tr><td>${dt(s.data)}</td><td>${esc(s.bike)}</td><td>${hm(s.seg)}</td><td>${s.pot} W</td><td>${num(s.wh, 1)} Wh</td><td>${brl(credito(s.wh))}</td></tr>`).join('')}</tbody></table></div>` : '<p class="empty">Nenhum treino neste período. Que tal iniciar um agora?</p>'}</div>`;
};

V.aluno.metas = () => {
  const m = mes(), p = m.pct;
  const msg = p >= 100 ? 'Meta batida! Você é pura energia.' : p >= 75 ? 'Falta pouco! Mais um treino e você chega lá.' : p >= 40 ? 'Bom ritmo. Continue pedalando!' : 'Vamos começar? Cada Wh conta.';
  const tot = sum(S.sessions, s => s.seg);
  const A = [['🚴', 'Primeiro treino', S.sessions.length >= 1], ['🔥', '10 treinos', S.sessions.length >= 10], ['⚡', '1 kWh no mês', m.wh >= 1000], ['🎯', '50% da meta', p >= 50], ['🏆', 'Meta concluída', p >= 100], ['⏱️', '10 h de treino', tot >= 36000]];
  return head('Metas', 'Defina e acompanhe seu objetivo mensal. ' + DEMO) + `
  <div class="two"><div class="card hero"><div class="lbl">Progresso do mês</div><div class="val">${num(p, 0)}%</div>
  <div class="bar" role="progressbar" aria-valuenow="${Math.round(p)}" aria-valuemin="0" aria-valuemax="100" aria-label="Progresso da meta"><i style="width:${p}%"></i></div><p>${num(m.wh)} Wh de ${num(S.cfg.meta)} Wh</p><p><b>${msg}</b></p></div>
  <form class="card" data-form="meta" novalidate><h2>Meta mensal</h2><label for="meta">Energia (Wh)</label><input id="meta" inputmode="decimal" value="${S.cfg.meta}" aria-describedby="meta-e"><p class="err" id="meta-e" role="alert"></p><button class="btn dark" type="submit">Salvar meta</button></form></div>
  <div class="card"><h2>Conquistas</h2><div class="badges">${A.map(([i, t, on]) => `<div class="ach ${on ? 'on' : ''}"><b aria-hidden="true">${i}</b>${t}<br><small>${on ? 'Conquistada' : 'Bloqueada'}</small></div>`).join('')}</div></div>
  <div class="grid" style="margin-top:1rem">${stat('Potência média geral', num(sum(S.sessions, s => s.pot) / (S.sessions.length || 1)) + ' W')}${stat('Energia total', num(sum(S.sessions, s => s.wh) / 1000, 2) + ' kWh', 'desde o início')}${stat('Tempo total', hm(tot))}</div>`;
};

function cfgForm(extra = '') {
  const c = S.cfg;
  return `<form class="card" data-form="cfg" novalidate><h2>Regra de conversão (demonstrativa)</h2>
  <p class="rule">Os valores definitivos dependem da viabilidade financeira do projeto. Altere para simular cenários.</p>
  <div class="row"><div><label for="c1">Mensalidade (R$)</label><input id="c1" inputmode="decimal" value="${c.mensalidade}"></div>
  <div><label for="c2">Wh para cada R$ 1,00</label><input id="c2" inputmode="decimal" value="${c.whReal}"></div>
  <div><label for="c3">Desconto máximo (%)</label><input id="c3" inputmode="decimal" value="${c.limite}"></div></div>
  <p class="err" id="c-e" role="alert"></p><button class="btn dark" type="submit">Salvar regra</button>${extra}</form>`;
}
V.aluno.mensalidade = () => {
  const m = mes(), c = S.cfg;
  return head('Mensalidade e descontos', 'Cálculo automático com a regra abaixo. ' + DEMO) + `
  <div class="grid">${stat('Mensalidade original', brl(c.mensalidade))}${stat('Energia no mês', num(m.wh) + ' Wh')}${stat('Taxa de conversão', `${num(c.whReal)} Wh = R$ 1,00`)}
  ${stat('Créditos acumulados', brl(m.cred))}${stat('Limite de desconto', `${num(c.limite)}%`, `até ${brl(m.max)}`)}${stat('Mensalidade prevista', brl(m.final), `Desconto aplicado: ${brl(m.desc)}`, 'hero')}</div>
  <div class="card" style="margin-bottom:1rem"><h2>Uso do limite de desconto</h2><div class="bar" role="progressbar" aria-valuenow="${Math.round(m.desc / m.max * 100 || 0)}" aria-valuemin="0" aria-valuemax="100" aria-label="Uso do limite"><i style="width:${m.desc / m.max * 100 || 0}%"></i></div>
  <p>${m.cred > m.max ? 'Você atingiu o limite máximo de desconto.' : `Faltam ${brl(m.max - m.desc)} em créditos para o limite.`}</p></div>${cfgForm()}`;
};

V.aluno.perfil = () => head('Perfil', 'Seus dados de acesso (demonstrativo).') + `
  <form class="card" data-form="perfil" novalidate style="max-width:520px"><label for="pn">Nome</label><input id="pn" value="${esc(S.user.nome)}" aria-describedby="pn-e"><p class="err" id="pn-e" role="alert"></p>
  <label for="pe">E-mail</label><input id="pe" type="email" value="${esc(S.user.email)}" aria-describedby="pe-e"><p class="err" id="pe-e" role="alert"></p>
  <button class="btn dark" type="submit">Salvar perfil</button></form>`;

/* ---------- Telas do ADMINISTRADOR ---------- */
function acad() {
  const wh = sum(S.alunos, a => a.wh) + sum(S.sessions, s => s.wh);
  return { wh, sess: sum(S.alunos, a => a.sess) + S.sessions.length, cred: credito(wh) };
}
const BASE7 = [820, 640, 910, 780, 1020, 560, 730];   // contribuição fictícia dos demais alunos
const rank = () => [...S.alunos.map(a => ({ ...a, cred: credito(a.wh) })), { nome: S.user.nome + ' (você)', sess: S.sessions.length, wh: Math.round(sum(S.sessions, s => s.wh)), cred: credito(sum(S.sessions, s => s.wh)) }].sort((a, b) => b.wh - a.wh);
const bikeTable = () => `<div class="tw" tabindex="0" role="region" aria-label="Tabela de bicicletas"><table><thead><tr><th>Bicicleta</th><th>Status</th><th>Sessões</th><th>Energia</th><th>Ação</th></tr></thead><tbody>
  ${S.bikes.map(b => `<tr><td>${b.id}</td><td><span class="badge s-${b.status}">${{ livre: 'Disponível', uso: 'Em utilização', manutencao: 'Manutenção' }[b.status]}</span></td><td>${b.usos}</td><td>${num(b.wh / 1000, 2)} kWh</td>
  <td>${b.status === 'uso' ? '—' : `<button class="btn out" style="margin:0;padding:.3rem .8rem" data-act="bike" data-arg="${b.id}">${b.status === 'livre' ? 'Enviar p/ manutenção' : 'Liberar'}</button>`}</td></tr>`).join('')}</tbody></table></div>`;

V.admin.geral = () => {
  const a = acad(), r = rank().slice(0, 5), L = S.bikes.filter(b => b.status === 'livre').length, U = S.bikes.filter(b => b.status === 'uso').length;
  return head('Painel da academia', 'Indicadores gerais. ' + DEMO) + `
  <div class="grid">${stat('Energia total', num(a.wh / 1000, 1) + ' kWh', 'toda a academia', 'hero')}${stat('Alunos cadastrados', S.alunos.length + 1)}${stat('Bicicletas disponíveis', L, `de ${S.bikes.length}`)}${stat('Em utilização', U)}${stat('Sessões realizadas', num(a.sess))}${stat('Créditos concedidos', brl(a.cred))}</div>
  <div class="two"><div class="card"><h2>Energia gerada nos últimos 7 dias (Wh)</h2>${bars(last7(BASE7), 'Wh', 'Energia da academia por dia')}</div>
  <div class="card"><h2>Ranking de alunos</h2><ol>${r.map(x => `<li>${esc(x.nome)} — <b>${num(x.wh)} Wh</b></li>`).join('')}</ol></div></div>
  <div class="card"><h2>Bicicletas</h2>${bikeTable()}</div>`;
};
V.admin.bikes = () => head('Bicicletas', 'Status e histórico de utilização. ' + DEMO) + `<div class="card" style="margin-bottom:1rem">${bikeTable()}</div>
  <div class="card"><h2>Sessões por bicicleta</h2>${bars(S.bikes.map(b => ({ l: b.id.slice(3), v: b.usos })), 'sessões', 'Sessões por bicicleta')}</div>`;
V.admin.alunos = () => {
  const r = rank();
  return head('Alunos', `${r.length} alunos cadastrados. ` + DEMO) + `
  <form class="card" data-form="aluno" novalidate style="margin-bottom:1rem"><h2>Cadastrar aluno</h2><div class="row"><div><label for="an">Nome completo</label><input id="an" aria-describedby="an-e"></div><button class="btn dark" type="submit">Cadastrar</button></div><p class="err" id="an-e" role="alert"></p></form>
  <div class="card"><h2>Ranking por energia gerada</h2><div class="tw" tabindex="0" role="region" aria-label="Ranking de alunos"><table><thead><tr><th>#</th><th>Aluno</th><th>Sessões</th><th>Energia</th><th>Créditos</th></tr></thead><tbody>
  ${r.map((x, i) => `<tr><td>${i + 1}</td><td>${esc(x.nome)}</td><td>${x.sess}</td><td>${num(x.wh)} Wh</td><td>${brl(x.cred)}</td></tr>`).join('')}</tbody></table></div></div>`;
};
V.admin.relatorios = () => {
  const a = acad(), m = [];
  for (let i = 5; i >= 0; i--) { const r = new Date(); r.setDate(1); r.setMonth(r.getMonth() - i); m.push({ l: r.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''), v: Math.round(sum(S.sessions.filter(s => sameMonth(s.data, r)), s => s.wh) * 6) }); }
  return head('Relatórios', 'Resumo para apresentação. ' + DEMO) + `<div class="grid">${stat('Energia acumulada', num(a.wh / 1000, 1) + ' kWh')}${stat('Sessões', num(a.sess))}${stat('Créditos concedidos', brl(a.cred))}</div>
  <div class="card"><h2>Geração mensal estimada (Wh)</h2>${bars(m, 'Wh', 'Geração mensal da academia')}<button class="btn" data-act="csv">Baixar sessões (CSV)</button></div>`;
};
V.admin.config = () => head('Configurações', 'Regras do programa e dados do protótipo.') + cfgForm('<hr><button class="btn out" type="button" data-act="reset">Restaurar dados demonstrativos</button>');

/* ---------- Eventos ---------- */
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return; const a = b.dataset.act, g = b.dataset.arg;
  if (a === 'go') go(g);
  else if (a === 'sair') { if (T) { clearInterval(timer); setBike(T.bike, 'livre'); T = null; save(); } $('#app').hidden = true; $('#login').hidden = false; $('#email').focus(); }
  else if (a === 'pausa') { T.pausa = !T.pausa; go('treino'); toast(T.pausa ? 'Treino pausado.' : 'Treino retomado.'); }
  else if (a === 'fim') encerrar();
  else if (a === 'modo') { H.modo = g; go('historico'); }
  else if (a === 'dias') { H.dias = +g; go('historico'); }
  else if (a === 'bike') { const k = S.bikes.find(x => x.id === g); k.status = k.status === 'livre' ? 'manutencao' : 'livre'; save(); go(cur); toast(`${g} atualizada.`); }
  else if (a === 'reset') { S = seed(); save(); go('config'); toast('Dados demonstrativos restaurados.'); }
  else if (a === 'csv') {
    const rows = ['data;bicicleta;duracao_s;potencia_media_w;energia_wh', ...S.sessions.map(s => `${s.data};${s.bike};${s.seg};${s.pot};${s.wh}`)];
    const l = document.createElement('a'); l.href = URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/csv' })); l.download = 'bike-energy-sessoes.csv'; l.click(); toast('Arquivo gerado.');
  }
});

/** Mostra/limpa mensagem de erro de um campo */
function erro(id, msg, errId) { const el = $('#' + id), er = $('#' + (errId || id + '-e')); if (er) er.textContent = msg || ''; if (el) el.setAttribute('aria-invalid', !!msg); if (msg && el) el.focus(); return !msg; }

$('#view').addEventListener('submit', e => {
  e.preventDefault(); const f = e.target.dataset.form;
  if (f === 'treino') { const v = $('#bike').value; if (!v) return erro('bike', 'Selecione uma bicicleta disponível para começar.'); iniciar(v); }
  else if (f === 'meta') { const n = toNum($('#meta').value); if (!(n >= 100 && n <= 100000)) return erro('meta', 'Informe uma meta entre 100 e 100.000 Wh.'); S.cfg.meta = n; save(); go('metas'); toast('Meta salva.'); }
  else if (f === 'cfg') {
    const m = toNum($('#c1').value), w = toNum($('#c2').value), l = toNum($('#c3').value);
    if (!(m > 0)) return erro('c1', 'A mensalidade deve ser maior que zero.', 'c-e');
    if (!(w > 0)) return erro('c2', 'Informe quantos Wh valem R$ 1,00 (maior que zero).', 'c-e');
    if (!(l >= 0 && l <= 100)) return erro('c3', 'O desconto máximo deve ficar entre 0 e 100%.', 'c-e');
    S.cfg.mensalidade = m; S.cfg.whReal = w; S.cfg.limite = l; save(); go(cur); toast('Regra atualizada.');
  }
  else if (f === 'perfil') {
    const n = $('#pn').value.trim(), m = $('#pe').value.trim();
    if (n.length < 2) return erro('pn', 'Digite seu nome (mínimo 2 letras).');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m)) return erro('pe', 'Digite um e-mail válido, como nome@exemplo.com.');
    S.user.nome = n; S.user.email = m; save(); go('perfil'); toast('Perfil atualizado.');
  }
  else if (f === 'aluno') { const n = $('#an').value.trim(); if (n.length < 3) return erro('an', 'Digite o nome completo do aluno.'); S.alunos.push({ nome: n, sess: 0, wh: 0 }); save(); go('alunos'); toast('Aluno cadastrado.'); }
});

/* Login demonstrativo */
$('#login-form').addEventListener('submit', e => {
  e.preventDefault();
  const m = $('#email').value.trim(), s = $('#senha').value;
  const okE = erro('email', /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m) ? '' : 'Digite um e-mail válido, como nome@exemplo.com.');
  const okS = okE && erro('senha', s.length >= 6 ? '' : 'A senha deve ter pelo menos 6 caracteres.');
  if (!okE) return; if (!okS) { $('#email-e').textContent = ''; return; }
  role = $('input[name=perfil]:checked').value;
  if (role === 'aluno') { S.user.email = m; S.user.nome = m.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); save(); }
  $('#login').hidden = true; $('#app').hidden = false; $('#senha').value = ''; go('geral');
});