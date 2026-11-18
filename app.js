/* French Trainer — web/PWA version. Data lives in localStorage on each device.
   Export/import uses the same JSON format as the desktop app (data/cards.json). */
'use strict';

// ------------------------------------------------------------------ constants
const STORAGE_KEY = 'ft_state_v1';
const SESSION_KEY = 'ft_session_v1';
const NEW = 'new', DIFF = 'difficult', LEARNED = 'learned';
const LABELS = { new: 'Nueva', difficult: 'Difícil', learned: 'Aprendida' };
const ORDER = { difficult: 0, new: 1, learned: 2 };
const STATUS_COLORS = { new: '#7c8cff', difficult: '#ff9a4d', learned: '#22c58b' };
const IV = { NEW: 1, DIFF_WRONG: 2, DIFF_RIGHT: 3, LEARNED_BASE: 10, GROWTH: 1.5, MAX: 40 };
const STREAK_TO_LEARN = 3;
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const TOPIC_BG = ['#ffd6e8', '#d9e6ff', '#d4f5e6', '#fff0c7', '#e9dcff', '#ffe0cc', '#cff4f7', '#f1f7c9', '#ffd9d9', '#dfe3ff', '#d8f3dc', '#fde2f3'];
const TOPIC_INK = ['#b4246a', '#2f55c4', '#16815a', '#9a6b00', '#6a3fd1', '#b4531a', '#127b85', '#6a7a12', '#b3313a', '#3d48b8', '#2c7a3f', '#a3337c'];

// ------------------------------------------------------------------ helpers
const $ = (sel, root = document) => root.querySelector(sel);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
function todayIso() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function formatDate(iso) {
  if (!iso) return 'Nunca';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}
function uid() { return Math.random().toString(16).slice(2, 10); }
const clone = o => JSON.parse(JSON.stringify(o));

const CRC_TABLE = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(str) {
  const bytes = new TextEncoder().encode(str); let c = 0xFFFFFFFF;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function topicColors(topic) { const i = crc32(topic || '-') % TOPIC_BG.length; return [TOPIC_BG[i], TOPIC_INK[i]]; }
function topicChip(topic, extra = '') {
  if (!topic) return '';
  const [bg, ink] = topicColors(topic);
  return `<span class="chip" style="background:${bg};color:${ink};${extra}">${esc(topic)}</span>`;
}
function statusChip(status, extra = '') { return `<span class="chip" style="background:${STATUS_COLORS[status]};color:#fff;${extra}">${LABELS[status]}</span>`; }

let toastTimer;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
}

// ------------------------------------------------------------------ answer checking
const QUOTES = { '’': "'", '‘': "'", '`': "'", '´': "'", '«': '', '»': '', '“': '', '”': '', '"': '' };
function normalize(text) {
  let t = (text || '').normalize('NFC').toLowerCase();
  for (const [k, v] of Object.entries(QUOTES)) t = t.split(k).join(v);
  t = t.replace(/[  ]/g, ' ').replace(/\s*'\s*/g, "'").replace(/[.!?¿¡;:,…]/g, ' ').replace(/\s+/g, ' ').trim();
  return t;
}
const stripAccents = t => t.normalize('NFD').replace(/\p{M}/gu, '');
function similarity(a, b) {
  if (a === b) return 1;
  const m = a.length, n = b.length; if (!m || !n) return 0;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return 1 - prev[n] / Math.max(m, n);
}
function checkAnswer(userText, card) {
  const answers = [card.fr, ...(card.alt || [])].filter(Boolean);
  const u = normalize(userText);
  for (const a of answers) if (u === normalize(a)) return { verdict: 'correct', matched: a };
  for (const a of answers) if (stripAccents(u) === stripAccents(normalize(a))) return { verdict: 'accents', matched: a };
  let best = card.fr, bestR = 0;
  for (const a of answers) { const r = similarity(u, normalize(a)); if (r > bestR) { bestR = r; best = a; } }
  return bestR >= 0.88 ? { verdict: 'close', matched: best } : { verdict: 'wrong', matched: card.fr };
}

// ------------------------------------------------------------------ deck (same model as the desktop app)
function cardDefaults(c) {
  return Object.assign({
    id: uid(), alt: [], note: '', topic: '', status: NEW, created: todayIso(), last_practiced: null,
    next_session: 0, interval: IV.NEW, streak: 0, history: [], source: 'seed',
  }, c);
}
function normalizeState(raw) {
  if (Array.isArray(raw)) raw = { cards: raw };
  const cards = (raw.cards || []).filter(c => c && c.es && c.fr).map(cardDefaults);
  return { version: 1, session_count: Number(raw.session_count) || 0, cards };
}
function initialState() { return normalizeState({ session_count: 0, cards: clone(window.SEED_CARDS || []) }); }
function loadState() {
  try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) return normalizeState(JSON.parse(raw)); }
  catch (e) { console.error(e); }
  return initialState();
}
let state = loadState();
function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch (e) { console.error(e); toast('⚠️ No se pudo guardar (almacenamiento lleno)'); }
}
save();

const getCard = id => state.cards.find(c => c.id === id);
const exists = fr => { const n = normalize(fr); return state.cards.some(c => normalize(c.fr) === n); };
function addCard({ es, fr, note = '', topic = '', alt = [], source = 'manual' }) {
  const card = cardDefaults({ es: es.trim(), fr: fr.trim(), note: (note || '').trim(), topic: (topic || '').trim(), alt: [...alt], source });
  card.next_session = state.session_count ? state.session_count + 1 : 0;
  state.cards.push(card); save(); return card;
}
function deleteCard(id) { state.cards = state.cards.filter(c => c.id !== id); save(); }
function setStatus(id, status) {
  const c = getCard(id); if (!c) return;
  c.status = status;
  if (status === DIFF) { c.interval = IV.DIFF_WRONG; c.streak = 0; }
  else if (status === LEARNED) c.interval = Math.max(c.interval || 0, IV.LEARNED_BASE);
  else { c.interval = IV.NEW; c.streak = 0; }
  c.next_session = state.session_count + c.interval; save();
}
const dueCards = (session = state.session_count) => state.cards.filter(c => c.next_session <= session);
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function startSession(size, reviewAnyway) {
  state.session_count += 1;
  let due = dueCards();
  if (!due.length && reviewAnyway) due = [...state.cards].sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.next_session - b.next_session).slice(0, size);
  shuffle(due); due.sort((a, b) => ORDER[a.status] - ORDER[b.status]);
  save(); return due.slice(0, size).map(c => c.id);
}
function recordAnswer(id, correct) {
  const c = getCard(id); if (!c) return;
  c.history.push({ date: todayIso(), session: state.session_count, correct: !!correct });
  c.last_practiced = todayIso();
  if (correct) {
    c.streak += 1;
    if (c.status === DIFF) c.interval = IV.DIFF_RIGHT;
    else if (c.status === LEARNED) c.interval = Math.min(IV.MAX, Math.max(IV.LEARNED_BASE, Math.round(c.interval * IV.GROWTH)));
    else if (c.streak >= STREAK_TO_LEARN) { c.status = LEARNED; c.interval = IV.LEARNED_BASE; }
    else c.interval = IV.NEW;
  } else {
    c.streak = 0;
    if (c.status === DIFF) c.interval = IV.DIFF_WRONG;
    else { c.status = NEW; c.interval = IV.NEW; }
  }
  c.next_session = state.session_count + c.interval; save();
}
function restoreCard(snap) { const i = state.cards.findIndex(c => c.id === snap.id); if (i >= 0) { state.cards[i] = clone(snap); save(); } }
function stats() {
  const s = { new: 0, difficult: 0, learned: 0 };
  state.cards.forEach(c => s[c.status]++);
  s.total = state.cards.length; s.due = dueCards(state.session_count + 1).length; return s;
}

// ------------------------------------------------------------------ CSV / Anki import
function decodeFile(buf) {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf).replace(/^﻿/, ''); }
  catch { return new TextDecoder('windows-1252').decode(buf); }
}
function parseCsvLine(line, delim) {
  const out = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
    else if (ch === '"' && cur === '') q = true;
    else if (ch === delim) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur); return out;
}
const cleanCell = t => (t || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const HEADER_WORDS = new Set(['es', 'español', 'espanol', 'spanish', 'fr', 'francés', 'frances', 'french', 'front', 'recto']);
function parseImport(text, defaultTopic = 'importadas') {
  const lines = text.split(/\r?\n/).filter(l => l.trim() && !l.startsWith('#'));
  if (!lines.length) return [];
  const sample = lines.slice(0, 20).join('\n');
  const delim = ['\t', ';', ','].reduce((best, d) => (sample.split(d).length > sample.split(best).length ? d : best), '\t');
  let rows = lines.map(l => parseCsvLine(l, delim));
  if (rows[0] && HEADER_WORDS.has(cleanCell(rows[0][0]).toLowerCase())) rows = rows.slice(1);
  return rows.map(r => r.map(cleanCell)).filter(c => c.length >= 2 && c[0] && c[1]).map(c => ({
    es: c[0], fr: c[1], note: c[2] || '', topic: c[3] || defaultTopic,
    alt: c[4] ? c[4].split('|').map(s => s.trim()).filter(Boolean) : [],
  }));
}

// ------------------------------------------------------------------ tabs
let activeTab = 'practice';
function showTab(name) {
  activeTab = name;
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === `view-${name}`));
  ({ practice: renderPractice, list: renderList, suggest: renderSuggest, data: renderData })[name]();
  window.scrollTo({ top: 0 });
}
$('#tabs').addEventListener('click', e => { const b = e.target.closest('button[data-tab]'); if (b) showTab(b.dataset.tab); });
function updateHeader() { $('#header-pill').textContent = `${state.cards.length} tarjetas · sesión ${state.session_count}`; }

// ------------------------------------------------------------------ PRACTICE
const P = Object.assign({ running: false, queue: [], idx: 0, answered: false, snapshot: null, verdict: null,
  ok: 0, ko: 0, size: 20, streak: 0, best: 0, lastInput: '' }, (() => {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)) || {}; } catch { return {}; }
})());
const saveSession = () => { try { localStorage.setItem(SESSION_KEY, JSON.stringify(P)); } catch {} };
function currentCard() {
  while (P.idx < P.queue.length) { const c = getCard(P.queue[P.idx]); if (c) return c; P.idx++; }
  return null;
}
const statTile = (label, num, color) =>
  `<div class="stat" style="background:linear-gradient(135deg, ${color}, ${color}cc)"><div class="num">${num}</div><div class="lbl">${label}</div></div>`;

function renderPractice() {
  updateHeader();
  const v = $('#view-practice');
  if (!P.running) return renderStart(v);
  const card = currentCard();
  if (!card) return renderSummary(v);
  renderCard(v, card);
}
function renderStart(v) {
  const s = stats();
  v.innerHTML = `
    <div class="card col anim-in" style="align-items:center;text-align:center">
      <div style="font-size:2.4rem">🃏</div>
      <div><div style="font-size:1.8rem;font-weight:800">¿Practicamos?</div><div class="muted">Sesión nº ${state.session_count + 1}</div></div>
      <div class="stats">
        ${statTile('Pendientes', s.due, '#6d5dfc')}${statTile('Difíciles', s.difficult, STATUS_COLORS.difficult)}
        ${statTile('Nuevas', s.new, STATUS_COLORS.new)}${statTile('Aprendidas', s.learned, STATUS_COLORS.learned)}
      </div>
      <div class="seg" id="size-seg">${[10, 20, 30, 50].map(n => `<button data-size="${n}" class="${P.size === n ? 'on' : ''}">${n}</button>`).join('')}</div>
      <div class="muted small" style="margin-top:-8px">tarjetas por sesión</div>
      ${s.due
        ? `<div class="row center"><button class="btn btn-grad btn-lg" id="start">▶ Empezar sesión</button><span class="kbd">Enter</span></div>`
        : `<div class="muted">No hay tarjetas pendientes. ¡Bien hecho!</div><button class="btn btn-soft" id="review">↻ Repasar igualmente</button>`}
    </div>`;
  $('#size-seg', v).onclick = e => { const b = e.target.closest('button'); if (!b) return; P.size = +b.dataset.size; saveSession(); renderStart(v); };
  if ($('#start', v)) $('#start', v).onclick = () => start(false);
  if ($('#review', v)) $('#review', v).onclick = () => start(true);
}
function start(reviewAnyway) {
  Object.assign(P, { queue: startSession(P.size, reviewAnyway), idx: 0, ok: 0, ko: 0, running: true, answered: false,
    snapshot: null, verdict: null, streak: 0, best: 0, lastInput: '' });
  saveSession(); renderPractice();
}
function renderSummary(v) {
  const total = P.ok + P.ko, pct = total ? Math.round(100 * P.ok / total) : 0;
  const msg = pct >= 90 ? '¡Increíble!' : pct >= 70 ? '¡Muy bien!' : pct >= 40 ? '¡Sigue así!' : 'Cada sesión cuenta';
  v.innerHTML = `
    <div class="card col anim-pop" style="align-items:center;text-align:center">
      <div style="font-size:3rem">🏆</div>
      <div style="font-size:1.8rem;font-weight:800">${msg}</div>
      <div class="ring" style="background:conic-gradient(var(--ok) ${pct * 3.6}deg, #ece9f8 0)"><div>${pct}%</div></div>
      <div class="stats">${statTile('Correctas', P.ok, '#1fb37a')}${statTile('Incorrectas', P.ko, '#f0506e')}${statTile('Mejor racha', P.best, '#ff9a4d')}</div>
      <div class="row center"><button class="btn btn-grad" id="home">🏠 Volver al inicio</button><span class="kbd">Enter</span></div>
    </div>`;
  $('#home', v).onclick = backHome;
}
function backHome() { P.running = false; P.queue = []; saveSession(); renderPractice(); }

function renderCard(v, card) {
  const n = P.idx + 1, total = P.queue.length, [bg] = topicColors(card.topic);
  v.innerHTML = `
    <div class="row between">
      <span class="pill">Tarjeta ${n} de ${total}</span>
      <span class="row"><span class="streak ${P.streak >= 2 ? '' : 'hidden'}" id="streak">🔥 ${P.streak}</span><span class="pill" id="score">✓ ${P.ok} &nbsp; ✗ ${P.ko}</span></span>
    </div>
    <div class="progress"><div style="width:${(100 * (n - 1) / total).toFixed(1)}%"></div></div>
    <div class="card anim-in" style="border-top:8px solid ${bg}">
      <div class="row between">${topicChip(card.topic) || '<span></span>'}<span id="status-chip">${statusChip(card.status)}</span></div>
      <div class="prompt">${esc(card.es)}</div>
      <input id="answer" class="answer" placeholder="Escribe la traducción en francés…" autocomplete="off" autocorrect="off"
             autocapitalize="off" spellcheck="false" enterkeyhint="done" lang="fr">
      <div id="feedback"></div>
      <div id="actions" class="row between actions"></div>
    </div>`;
  const inp = $('#answer', v);
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); P.answered ? nextCard() : check(); }
    else if ((e.key === 'Tab' || e.key === 'ArrowRight') && P.answered) { e.preventDefault(); nextCard(); }
    else if (e.key === 'Tab') e.preventDefault();
  });
  if (P.answered) { // restored after reload/app switch
    inp.value = P.lastInput || ''; inp.readOnly = true;
    showFeedback(card, { verdict: P.verdict, matched: card.fr }, false, true);
  } else renderActions(card);
  setTimeout(() => inp.focus({ preventScroll: true }), 0);
}
function renderActions(card) {
  const a = $('#actions'); if (!a) return;
  if (!P.answered) {
    a.innerHTML = `<span></span><span class="row"><span class="kbd">Enter</span><button class="btn btn-grad" id="check">✓ Comprobar</button></span>`;
    $('#check').onclick = check; return;
  }
  const left = [
    card.status === DIFF ? `<button class="btn btn-soft" data-mark="new">⚑ Quitar de difíciles</button>`
                         : `<button class="btn btn-diff" data-mark="difficult">⚑ Difícil</button>`,
    card.status !== LEARNED ? `<button class="btn btn-learned" data-mark="learned">✔ Ya me la sé</button>` : '',
  ].join('');
  a.innerHTML = `<span class="row">${left}</span><span class="row"><span class="kbd">Enter</span><span class="kbd">→</span><button class="btn btn-grad" id="next">Siguiente →</button></span>`;
  $('#next').onclick = nextCard;
  a.querySelectorAll('[data-mark]').forEach(b => b.onclick = () => mark(b.dataset.mark));
}
function bumpStreak(correct) {
  P.streak = correct ? P.streak + 1 : 0; P.best = Math.max(P.best, P.streak);
  if ([5, 10, 20, 30].includes(P.streak)) toast(`🔥 ¡${P.streak} seguidas!`);
  const s = $('#streak'); if (s) { s.textContent = `🔥 ${P.streak}`; s.classList.toggle('hidden', P.streak < 2); }
}
function updateScore() { const s = $('#score'); if (s) s.innerHTML = `✓ ${P.ok} &nbsp; ✗ ${P.ko}`; }
function check() {
  const card = currentCard(), inp = $('#answer'); if (!card || P.answered || !inp) return;
  const text = inp.value || '';
  if (!text.trim()) { toast('Escribe una respuesta primero'); inp.focus(); return; }
  const res = checkAnswer(text, card), correct = res.verdict === 'correct';
  P.snapshot = clone(card); recordAnswer(card.id, correct);
  correct ? P.ok++ : P.ko++; bumpStreak(correct);
  Object.assign(P, { answered: true, verdict: res.verdict, lastInput: text }); saveSession();
  inp.readOnly = true; updateScore(); updateHeader();
  showFeedback(getCard(card.id), res);
}
function showFeedback(card, res, overridden = false, quiet = false) {
  const map = {
    correct: ['fb-ok', overridden ? 'Contada como correcta' : '🎉 ¡Correcto!', 'anim-pop'],
    accents: ['fb-warn', '✏️ Casi: revisa los acentos', 'anim-shake'],
    close: ['fb-warn', '🤏 Casi: hay una pequeña diferencia', 'anim-shake'],
    wrong: ['fb-ko', '😕 No es correcto', 'anim-shake'],
  };
  const [cls, title, anim] = map[res.verdict] || map.wrong;
  const others = (card.alt || []).filter(a => a !== card.fr);
  $('#feedback').innerHTML = `
    <div class="fb ${cls} ${quiet ? '' : anim}">
      <div class="t">${title}</div>
      <div class="a">${esc(card.fr)}</div>
      ${others.length ? `<div class="small" style="opacity:.8;margin-top:4px">También válido: ${others.map(esc).join(' · ')}</div>` : ''}
      ${res.verdict !== 'correct' ? `<button class="btn btn-ghost" id="override" style="margin-top:6px;padding-left:0">👍 Mi respuesta era válida</button>` : ''}
    </div>
    ${card.note ? `<div class="note anim-in"><span>💡</span><span>${esc(card.note)}</span></div>` : ''}`;
  const o = $('#override'); if (o) o.onclick = overrideCorrect;
  const chip = $('#status-chip'); if (chip) chip.innerHTML = statusChip(card.status);
  renderActions(card);
}
function overrideCorrect() {
  const card = currentCard(); if (!card || !P.snapshot || P.verdict === 'correct') return;
  restoreCard(P.snapshot); recordAnswer(card.id, true);
  const c = getCard(card.id), user = (P.lastInput || '').trim();
  if (user && ![c.fr, ...c.alt].some(a => normalize(a) === normalize(user))) { c.alt.push(user); save(); }
  P.ok++; P.ko--; bumpStreak(true); P.verdict = 'correct'; saveSession(); updateScore();
  showFeedback(c, { verdict: 'correct', matched: c.fr }, true);
  $('#answer')?.focus({ preventScroll: true });
}
function mark(status) {
  const card = currentCard(); if (!card) return;
  setStatus(card.id, status); toast(`Marcada como ${LABELS[status].toLowerCase()}`);
  const c = getCard(card.id); $('#status-chip').innerHTML = statusChip(c.status); renderActions(c);
  $('#answer')?.focus({ preventScroll: true });
}
function nextCard() {
  if (!P.answered) return;
  Object.assign(P, { idx: P.idx + 1, answered: false, snapshot: null, verdict: null, lastInput: '' });
  saveSession(); renderPractice();
}
document.addEventListener('keydown', e => {
  if (activeTab !== 'practice' || e.repeat) return;
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
  if (e.key !== 'Enter' && e.key !== 'ArrowRight') return;
  if (e.target.tagName === 'BUTTON' && e.key === 'Enter') return; // the button handles it
  if (!P.running) { if (e.key === 'Enter' && stats().due) { e.preventDefault(); start(false); } return; }
  if (!currentCard()) { if (e.key === 'Enter') { e.preventDefault(); backHome(); } return; }
  if (P.answered) { e.preventDefault(); nextCard(); } else if (e.key === 'Enter') $('#answer')?.focus();
});

// ------------------------------------------------------------------ LIST
const L = { q: '', status: 'all', limit: 80, open: null };
function renderList() {
  updateHeader();
  const s = stats(), v = $('#view-list');
  v.innerHTML = `
    <div class="stats">
      ${statTile('Total', s.total, '#b06ef5')}${statTile('Nuevas', s.new, STATUS_COLORS.new)}${statTile('Difíciles', s.difficult, STATUS_COLORS.difficult)}
      ${statTile('Aprendidas', s.learned, STATUS_COLORS.learned)}${statTile('Pendientes', s.due, '#6d5dfc')}
    </div>
    <div class="toolbar">
      <input class="search" id="q" type="search" placeholder="Buscar en español, francés o tema…" value="${esc(L.q)}">
      <div class="filters" id="filters">
        ${[['all', 'Todas'], [NEW, 'Nuevas'], [DIFF, 'Difíciles'], [LEARNED, 'Aprendidas']].map(([k, l]) => `<button data-f="${k}" class="${L.status === k ? 'on' : ''}">${l}</button>`).join('')}
      </div>
    </div>
    <div class="items" id="items"></div>
    <div class="row center" style="margin-top:12px"><button class="btn btn-soft hidden" id="more">Mostrar más</button></div>
    <details class="card" style="margin-top:16px" id="add-box">
      <summary>➕ Añadir frase manualmente</summary>
      <div class="col" style="margin-top:14px">
        <div><label class="lbl">Español</label><input class="field" id="a-es"></div>
        <div><label class="lbl">Français</label><input class="field" id="a-fr" lang="fr" autocapitalize="off"></div>
        <div><label class="lbl">Alternativas (separadas por ;)</label><input class="field" id="a-alt" lang="fr" autocapitalize="off"></div>
        <div><label class="lbl">Nota (opcional)</label><input class="field" id="a-note"></div>
        <div><label class="lbl">Tema (opcional)</label><input class="field" id="a-topic"></div>
        <div><button class="btn btn-grad" id="a-add">Añadir</button></div>
      </div>
    </details>`;
  $('#q', v).addEventListener('input', e => { L.q = e.target.value; L.limit = 80; renderItems(); });
  $('#filters', v).onclick = e => { const b = e.target.closest('button'); if (!b) return; L.status = b.dataset.f; L.limit = 80; renderList(); };
  $('#more', v).onclick = () => { L.limit += 80; renderItems(); };
  $('#a-add', v).onclick = () => {
    const es = $('#a-es').value.trim(), fr = $('#a-fr').value.trim();
    if (!es || !fr) return toast('Español y francés son obligatorios');
    if (exists(fr)) return toast('Esa frase ya está en el mazo');
    addCard({ es, fr, note: $('#a-note').value, topic: $('#a-topic').value, alt: $('#a-alt').value.split(';').map(s => s.trim()).filter(Boolean) });
    toast('Frase añadida'); renderList(); $('#add-box').open = true;
  };
  $('#items', v).onclick = onItemClick;
  renderItems();
}
function filteredCards() {
  const q = normalize(L.q);
  return state.cards.filter(c => (L.status === 'all' || c.status === L.status) &&
    (!q || normalize(`${c.es} ${c.fr} ${c.topic} ${(c.alt || []).join(' ')}`).includes(q)))
    .sort((a, b) => (b.last_practiced || '').localeCompare(a.last_practiced || ''));
}
function renderItems() {
  const list = filteredCards(), shown = list.slice(0, L.limit);
  $('#items').innerHTML = shown.length ? shown.map(c => {
    const ok = c.history.filter(h => h.correct).length;
    return `<div class="item" data-id="${c.id}">
      <div class="item-main" data-act="toggle">
        <div class="es">${esc(c.es)}</div><div class="fr">${esc(c.fr)}</div>
        <div class="meta">${topicChip(c.topic, 'font-size:.68rem;padding:2px 8px')}${statusChip(c.status, 'font-size:.68rem;padding:2px 8px')}
          <span>· ${formatDate(c.last_practiced)}</span>${c.history.length ? `<span>· ${ok}/${c.history.length} aciertos</span>` : ''}${c.note ? '<span>· 💡</span>' : ''}</div>
        ${L.open === c.id ? `<div class="xnote">${c.alt.length ? `<div><b>También:</b> ${c.alt.map(esc).join(' · ')}</div>` : ''}${c.note ? `<div>💡 ${esc(c.note)}</div>` : ''}${!c.alt.length && !c.note ? '<div class="muted">Sin notas</div>' : ''}</div>` : ''}
      </div>
      <div class="item-actions">
        <button class="icon-btn" title="Nueva" data-act="new">🆕</button>
        <button class="icon-btn" title="Difícil" data-act="difficult">⚑</button>
        <button class="icon-btn" title="Aprendida" data-act="learned">✔</button>
        <button class="icon-btn" title="Eliminar" data-act="del">🗑</button>
      </div></div>`;
  }).join('') : '<div class="card muted" style="text-align:center">No hay frases con ese filtro.</div>';
  $('#more').classList.toggle('hidden', list.length <= L.limit);
}
function onItemClick(e) {
  const btn = e.target.closest('[data-act]'), item = e.target.closest('.item'); if (!btn || !item) return;
  const id = item.dataset.id, act = btn.dataset.act;
  if (act === 'toggle') { L.open = L.open === id ? null : id; return renderItems(); }
  if (act === 'del') { const c = getCard(id); if (c && confirm(`¿Eliminar «${c.es}»?`)) { deleteCard(id); toast('Eliminada'); renderList(); } return; }
  setStatus(id, act); toast(`Marcada como ${LABELS[act].toLowerCase()}`); renderList();
}

// ------------------------------------------------------------------ SUGGEST
const SG = { topics: new Set(), count: 10, results: [], title: '' };
const BANK = window.PHRASE_BANK || [];
const bankTopics = [...new Set(BANK.map(b => b.topic).filter(Boolean))].sort();
const bankRemaining = () => { const have = new Set(state.cards.map(c => normalize(c.fr))); return BANK.filter(b => !have.has(normalize(b.fr)) && (!SG.topics.size || SG.topics.has(b.topic))); };
function renderSuggest() {
  updateHeader();
  const v = $('#view-suggest');
  v.innerHTML = `
    <div class="card col">
      <div style="font-size:1.4rem;font-weight:800">✨ Frases nuevas del banco</div>
      <div class="muted small" id="remaining"></div>
      <div class="topic-chips" id="topics">${bankTopics.map(t => { const [bg, ink] = topicColors(t); return `<button data-t="${esc(t)}" class="${SG.topics.has(t) ? 'on' : ''}" style="background:${bg};color:${ink}">${esc(t)}</button>`; }).join('')}</div>
      <div class="muted small">Toca los temas que quieras (ninguno = todos).</div>
      <div class="row">
        <div class="seg" id="count-seg">${[5, 10, 15, 20].map(n => `<button data-n="${n}" class="${SG.count === n ? 'on' : ''}">${n}</button>`).join('')}</div>
        <button class="btn btn-grad" id="suggest">🔀 Sugerir</button>
      </div>
    </div>
    <details class="card" style="margin-top:14px">
      <summary>📄 Importar desde archivo (CSV / TXT / Anki)</summary>
      <div class="col" style="margin-top:12px">
        <div class="muted small">Una frase por línea: <b>español ; francés ; nota ; tema ; alternativas separadas por |</b>. Solo las dos primeras columnas son obligatorias. Separador <code>;</code>, <code>,</code> o tabulador.</div>
        <label class="btn btn-soft file-btn" style="width:fit-content">📂 Elegir archivo<input type="file" id="imp-file" accept=".txt,.csv,.tsv,text/plain,text/csv"></label>
      </div>
    </details>
    <div class="row between" style="margin:18px 0 10px" id="res-head"></div>
    <div class="col" id="results"></div>`;
  $('#topics', v).onclick = e => { const b = e.target.closest('button'); if (!b) return; const t = b.dataset.t; SG.topics.has(t) ? SG.topics.delete(t) : SG.topics.add(t); b.classList.toggle('on'); updateRemaining(); };
  $('#count-seg', v).onclick = e => { const b = e.target.closest('button'); if (!b) return; SG.count = +b.dataset.n; v.querySelectorAll('#count-seg button').forEach(x => x.classList.toggle('on', x === b)); };
  $('#suggest', v).onclick = () => {
    const pool = shuffle(bankRemaining()).slice(0, SG.count);
    if (!pool.length) toast('Ya has añadido todas las frases de esos temas');
    SG.results = pool.map(p => ({ ...p, source: 'bank' })); SG.title = 'sugerencias del banco'; renderResults();
  };
  $('#imp-file', v).onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const items = parseImport(decodeFile(await f.arrayBuffer()));
      if (!items.length) toast(`No se encontraron frases en ${f.name}`);
      SG.results = items.map(i => ({ ...i, source: 'import' })); SG.title = `frases en ${f.name}`; renderResults();
    } catch (err) { console.error(err); toast('No se pudo leer el archivo'); }
    e.target.value = '';
  };
  updateRemaining(); renderResults();
}
function updateRemaining() {
  const el = $('#remaining'); if (!el) return;
  el.textContent = `${BANK.length} frases B2 sin conexión · te quedan ${bankRemaining().length} por añadir ${SG.topics.size ? 'en los temas elegidos' : 'en total'}`;
}
function renderResults() {
  const head = $('#res-head'), box = $('#results'); if (!head) return;
  if (!SG.results.length) { head.innerHTML = ''; box.innerHTML = ''; return; }
  head.innerHTML = `<div style="font-weight:800;font-size:1.1rem">${SG.results.length} ${esc(SG.title)}</div><button class="btn btn-soft" id="add-all">＋ Añadir todas</button>`;
  box.innerHTML = SG.results.map((it, i) => {
    const [bg] = topicColors(it.topic), have = exists(it.fr);
    return `<div class="sugg" style="border-left:8px solid ${bg}">
      <div style="min-width:0">
        <div class="es">${esc(it.es)}</div><div class="fr">${esc(it.fr)}</div>
        ${it.alt?.length ? `<div class="alt">También: ${it.alt.map(esc).join(' · ')}</div>` : ''}
        ${it.note ? `<div class="n">${esc(it.note)}</div>` : ''}
        <div style="margin-top:6px">${topicChip(it.topic)}</div>
      </div>
      <button class="btn ${have ? 'btn-soft' : 'btn-grad'}" data-i="${i}" ${have ? 'disabled' : ''}>${have ? '✓ En el mazo' : '＋ Añadir'}</button>
    </div>`;
  }).join('');
  box.onclick = e => { const b = e.target.closest('button[data-i]'); if (b && !b.disabled) addResult(+b.dataset.i, b); };
  $('#add-all').onclick = () => {
    let n = 0; box.querySelectorAll('button[data-i]').forEach(b => { if (!b.disabled) { addResult(+b.dataset.i, b, true); n++; } });
    toast(n ? `${n} frases añadidas` : 'No había frases nuevas');
  };
}
function addResult(i, btn, quiet = false) {
  const it = SG.results[i];
  if (!exists(it.fr)) addCard(it); else if (!quiet) toast('Ya estaba en el mazo');
  btn.disabled = true; btn.className = 'btn btn-soft'; btn.textContent = '✓ Añadida';
  updateRemaining(); updateHeader();
}

// ------------------------------------------------------------------ DATA (backup / sync)
function renderData() {
  updateHeader();
  const kb = Math.round((localStorage.getItem(STORAGE_KEY) || '').length / 1024);
  $('#view-data').innerHTML = `
    <div class="card col">
      <div style="font-size:1.4rem;font-weight:800">💾 Tus datos</div>
      <div class="muted">Las tarjetas y el progreso se guardan solo en este dispositivo (${state.cards.length} tarjetas, ${kb} KB).
        Para pasarlos a otro dispositivo o a la app de escritorio, exporta aquí e importa allí.</div>
      <div class="row"><button class="btn btn-grad" id="export">⬇️ Exportar progreso</button></div>
      <div class="muted small">El archivo tiene el mismo formato que <code>data/cards.json</code> de la app de escritorio: puedes copiarlo allí o importar aquí el de tu ordenador.</div>
      <hr style="border:0;border-top:1px solid #eee;width:100%">
      <div style="font-weight:800">Importar progreso</div>
      <div class="muted small">Sustituye todas las tarjetas y el progreso de este dispositivo por los del archivo (.json).</div>
      <label class="btn btn-soft file-btn" style="width:fit-content">📂 Elegir archivo .json<input type="file" id="imp-json" accept=".json,application/json"></label>
      <hr style="border:0;border-top:1px solid #eee;width:100%">
      <div style="font-weight:800">Empezar de cero</div>
      <div class="muted small">Borra el progreso y vuelve al mazo inicial (frases de ejemplo + tus apuntes).</div>
      <div><button class="btn btn-diff" id="reset">Restablecer</button></div>
    </div>`;
  $('#export').onclick = exportData;
  $('#imp-json').onchange = importData;
  $('#reset').onclick = () => {
    if (!confirm('¿Seguro? Se perderá todo el progreso de este dispositivo.')) return;
    state = initialState(); save(); backHomeSilent(); toast('Mazo restablecido'); renderData();
  };
}
function backHomeSilent() { P.running = false; P.queue = []; saveSession(); }
async function exportData() {
  const name = `french_trainer_${todayIso()}.json`;
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  try {
    const file = new File([blob], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); return; }
  } catch (e) { if (e.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast('Archivo exportado');
}
async function importData(e) {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try {
    const next = normalizeState(JSON.parse(decodeFile(await f.arrayBuffer())));
    if (!next.cards.length) return toast('El archivo no contiene tarjetas');
    if (!confirm(`Se sustituirán tus ${state.cards.length} tarjetas por las ${next.cards.length} del archivo. ¿Continuar?`)) return;
    state = next; save(); backHomeSilent(); toast('Progreso importado'); renderData();
  } catch (err) { console.error(err); toast('Archivo no válido'); }
}

// ------------------------------------------------------------------ boot
showTab('practice');
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(console.error));
}
