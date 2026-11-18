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
const DEFAULT_SETTINGS = { dailyGoal: 20, autoSpeak: false, updated: 0 };
const APP_VERSION = '2026-11-19';
const SYNC_KEY = 'ft_sync_v1';            // token + gist id: stays on this device, never exported
const GIST_FILE = 'french_trainer_sync.json';

// ------------------------------------------------------------------ helpers
const $ = (sel, root = document) => root.querySelector(sel);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const isoOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayIso = () => isoOf(new Date());
function formatDate(iso) {
  if (!iso) return 'Nunca';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}
const uid = () => Math.random().toString(16).slice(2, 10);
const clone = o => JSON.parse(JSON.stringify(o));
const isExercise = es => /^(Completa|Corrige):/.test(es || '');

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
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2000);
}

// ------------------------------------------------------------------ pronunciation (Web Speech API, works offline with system voices)
const canSpeak = 'speechSynthesis' in window;
let frVoice = null;
function pickVoice() {
  if (!canSpeak) return;
  const vs = speechSynthesis.getVoices();
  frVoice = vs.find(v => /^fr[-_]FR/i.test(v.lang)) || vs.find(v => /^fr/i.test(v.lang)) || null;
}
if (canSpeak) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
function speak(text) {
  if (!canSpeak || !text) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/…/g, '').replace(/____/g, ' '));
  u.lang = frVoice ? frVoice.lang : 'fr-FR'; if (frVoice) u.voice = frVoice; u.rate = 0.92;
  speechSynthesis.speak(u);
}
const speakBtn = (text, cls = 'icon-btn') => canSpeak ? `<button class="${cls}" data-speak="${esc(text)}" title="Escuchar">🔊</button>` : '';
document.addEventListener('click', e => { const b = e.target.closest('[data-speak]'); if (b) { e.stopPropagation(); speak(b.dataset.speak); } });

// ------------------------------------------------------------------ answer checking
const QUOTES = { '’': "'", '‘': "'", '`': "'", '´': "'", '«': '', '»': '', '“': '', '”': '', '"': '' };
function normalize(text) {
  let t = (text || '').normalize('NFC').toLowerCase();
  for (const [k, v] of Object.entries(QUOTES)) t = t.split(k).join(v);
  return t.replace(/[  ]/g, ' ').replace(/\s*'\s*/g, "'").replace(/[.!?¿¡;:,…]/g, ' ').replace(/\s+/g, ' ').trim();
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
    next_session: 0, interval: IV.NEW, streak: 0, history: [], source: 'seed', updated: 0,
  }, c);
}
function normalizeState(raw) {
  if (Array.isArray(raw)) raw = { cards: raw };
  const cards = (raw.cards || []).filter(c => c && c.es && c.fr).map(cardDefaults);
  return {
    version: 1, session_count: Number(raw.session_count) || 0, cards,
    packs: Array.isArray(raw.packs) ? raw.packs : ['base'],
    fixes: Array.isArray(raw.fixes) ? raw.fixes : [],
    settings: Object.assign({}, DEFAULT_SETTINGS, raw.settings || {}),
    defis: raw.defis && typeof raw.defis === 'object' ? raw.defis : {},
    deleted: raw.deleted && typeof raw.deleted === 'object' ? raw.deleted : {},
  };
}
function initialState() { return normalizeState({ session_count: 0, cards: clone(window.SEED_CARDS || []), packs: ['base'] }); }
/* Content packs (e.g. "Días 12–21") are added once to every device, without touching existing progress. */
function applyPacks(st) {
  let added = 0;
  for (const pack of window.CONTENT_PACKS || []) {
    if (st.packs.includes(pack.id)) continue;
    const es = new Set(st.cards.map(c => normalize(c.es))), fr = new Set(st.cards.map(c => normalize(c.fr)));
    for (const c of pack.cards) {
      if (es.has(normalize(c.es)) || (!isExercise(c.es) && fr.has(normalize(c.fr)))) continue;
      st.cards.push(cardDefaults(clone(c))); es.add(normalize(c.es)); fr.add(normalize(c.fr)); added++;
    }
    st.packs.push(pack.id);
  }
  return added;
}
/* Content corrections: matched by the original French text, never applied to cards you edited yourself. */
function applyFixes(st) {
  let fixed = 0;
  for (const fix of window.CONTENT_FIXES || []) {
    if (st.fixes.includes(fix.id)) continue;
    for (const ch of fix.changes) {
      const key = normalize(ch.match);
      st.cards.filter(c => !c.edited && normalize(c.fr) === key).forEach(c => { Object.assign(c, clone(ch.set)); fixed++; });
    }
    st.fixes.push(fix.id);
  }
  return fixed;
}
function loadState() {
  try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) return normalizeState(JSON.parse(raw)); }
  catch (e) { console.error(e); }
  return initialState();
}
let state = loadState();
const packsAdded = applyPacks(state);
applyFixes(state);
function save(fromSync = false) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch (e) { console.error(e); toast('⚠️ No se pudo guardar (almacenamiento lleno)'); }
  if (!fromSync) schedulePush();
}
const touch = c => { c.updated = Date.now(); return c; };
save(true);

const getCard = id => state.cards.find(c => c.id === id);
const exists = fr => { const n = normalize(fr); return state.cards.some(c => normalize(c.fr) === n); };
function addCard({ es, fr, note = '', topic = '', alt = [], source = 'manual' }) {
  const card = cardDefaults({ es: es.trim(), fr: fr.trim(), note: (note || '').trim(), topic: (topic || '').trim(), alt: [...alt], source });
  card.next_session = state.session_count ? state.session_count + 1 : 0;
  touch(card); state.cards.push(card); save(); return card;
}
function deleteCard(id) { state.cards = state.cards.filter(c => c.id !== id); state.deleted[id] = Date.now(); save(); }
function setStatus(id, status) {
  const c = getCard(id); if (!c) return;
  c.status = status;
  if (status === DIFF) { c.interval = IV.DIFF_WRONG; c.streak = 0; }
  else if (status === LEARNED) c.interval = Math.max(c.interval || 0, IV.LEARNED_BASE);
  else { c.interval = IV.NEW; c.streak = 0; }
  c.next_session = state.session_count + c.interval; touch(c); save();
}
const dueCards = (session = state.session_count) => state.cards.filter(c => c.next_session <= session);
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

/* Session pool by mode: smart = due cards (spaced repetition), random = any card, topics = chosen topics. */
function sessionPool(opts, session = state.session_count + 1) {
  let pool;
  if (opts.mode === 'random') pool = [...state.cards];
  else if (opts.mode === 'topics') { const set = new Set(opts.topics); pool = state.cards.filter(c => set.has(c.topic)); }
  else pool = state.cards.filter(c => c.next_session <= session);
  if (opts.onlyDiff) pool = pool.filter(c => c.status === DIFF);
  return pool;
}
function startSession(opts) {
  let pool = sessionPool(opts);
  if (!pool.length && opts.mode === 'smart' && opts.reviewAnyway) {
    pool = [...state.cards].sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.next_session - b.next_session).slice(0, opts.size);
  }
  state.session_count += 1;
  shuffle(pool);
  if (opts.mode === 'smart') pool.sort((a, b) => ORDER[a.status] - ORDER[b.status]);
  else if (opts.mode === 'topics') pool.sort((a, b) => (a.next_session <= state.session_count ? 0 : 1) - (b.next_session <= state.session_count ? 0 : 1));
  save(); return pool.slice(0, opts.size).map(c => c.id);
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
  c.next_session = state.session_count + c.interval; touch(c); save();
}
function restoreCard(snap) { const i = state.cards.findIndex(c => c.id === snap.id); if (i >= 0) { state.cards[i] = clone(snap); save(); } }
function stats() {
  const s = { new: 0, difficult: 0, learned: 0 };
  state.cards.forEach(c => s[c.status]++);
  s.total = state.cards.length; s.due = dueCards(state.session_count + 1).length; return s;
}

// ------------------------------------------------------------------ topics (grouped for the pickers)
function topicGroups(cards = state.cards) {
  const counts = new Map();
  cards.forEach(c => { if (c.topic) counts.set(c.topic, (counts.get(c.topic) || 0) + 1); });
  const groups = [['Segunda tanda · días 12–21', []], ['Mis apuntes', []], ['Frases y banco', []]];
  for (const [t, n] of counts) groups[/^Día \d+/.test(t) ? 0 : /^apuntes · /.test(t) ? 1 : 2][1].push([t, n]);
  groups[0][1].sort((a, b) => parseInt(a[0].slice(4)) - parseInt(b[0].slice(4)));
  groups[1][1].sort(); groups[2][1].sort();
  return groups.filter(g => g[1].length);
}
const shortTopic = t => t.replace(/^apuntes · /, '');

// ------------------------------------------------------------------ daily activity, streaks, goal
function activityByDay() {
  const days = {};
  state.cards.forEach(c => c.history.forEach(h => { days[h.date] = (days[h.date] || 0) + 1; }));
  Object.values(state.defis).forEach(list => list.forEach(d => { days[d] = (days[d] || 0) + 1; }));
  return days;
}
function streakInfo() {
  const days = activityByDay(), d = new Date();
  if (!days[isoOf(d)]) d.setDate(d.getDate() - 1);
  let current = 0;
  while (days[isoOf(d)]) { current++; d.setDate(d.getDate() - 1); }
  let best = 0, run = 0, prev = null;
  Object.keys(days).sort().forEach(k => {
    const t = new Date(k + 'T12:00:00');
    run = prev && Math.round((t - prev) / 864e5) === 1 ? run + 1 : 1; best = Math.max(best, run); prev = t;
  });
  return { current, best, today: days[todayIso()] || 0, days };
}
function heatmapHtml(days, n = 28) {
  const goal = state.settings.dailyGoal, cells = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const k = days[isoOf(d)] || 0, lvl = k === 0 ? 0 : k < goal / 2 ? 1 : k < goal ? 2 : 3;
    cells.push(`<span class="hm hm${lvl}" title="${formatDate(isoOf(d))}: ${k}"></span>`);
  }
  return `<div class="heatmap">${cells.join('')}</div><div class="muted small" style="margin-top:4px">Últimas 4 semanas</div>`;
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

// ------------------------------------------------------------------ card editor (modal)
function openEditor(id, onDone) {
  const c = getCard(id); if (!c) return;
  const topics = [...new Set(state.cards.map(x => x.topic).filter(Boolean))].sort();
  const m = document.createElement('div'); m.className = 'modal';
  m.innerHTML = `
    <div class="modal-box anim-pop">
      <div style="font-size:1.2rem;font-weight:800;margin-bottom:10px">✏️ Editar tarjeta</div>
      <div class="col">
        <div><label class="lbl">Español (lo que ves)</label><input class="field" id="e-es" value="${esc(c.es)}"></div>
        <div><label class="lbl">Français (respuesta)</label><input class="field" id="e-fr" lang="fr" autocapitalize="off" value="${esc(c.fr)}"></div>
        <div><label class="lbl">Respuestas alternativas (separadas por ;)</label><input class="field" id="e-alt" lang="fr" autocapitalize="off" value="${esc(c.alt.join('; '))}"></div>
        <div><label class="lbl">Nota</label><textarea class="field" id="e-note" rows="3">${esc(c.note)}</textarea></div>
        <div><label class="lbl">Tema</label><input class="field" id="e-topic" list="e-topics" value="${esc(c.topic)}">
          <datalist id="e-topics">${topics.map(t => `<option value="${esc(t)}">`).join('')}</datalist></div>
      </div>
      <div class="row between" style="margin-top:16px">
        <button class="btn btn-ghost" id="e-cancel">Cancelar</button>
        <button class="btn btn-grad" id="e-save">Guardar</button>
      </div>
    </div>`;
  document.body.appendChild(m);
  const close = () => m.remove();
  m.addEventListener('click', e => { if (e.target === m) close(); });
  $('#e-cancel', m).onclick = close;
  $('#e-save', m).onclick = () => {
    const es = $('#e-es', m).value.trim(), fr = $('#e-fr', m).value.trim();
    if (!es || !fr) return toast('Español y francés son obligatorios');
    Object.assign(c, { es, fr, note: $('#e-note', m).value.trim(), topic: $('#e-topic', m).value.trim(),
      alt: $('#e-alt', m).value.split(';').map(s => s.trim()).filter(Boolean), edited: true, updated: Date.now() });
    save(); close(); toast('Tarjeta guardada'); onDone && onDone();
  };
  setTimeout(() => $('#e-fr', m).focus(), 50);
}

// ------------------------------------------------------------------ tabs
let activeTab = 'practice';
const RENDER = {};
function showTab(name) {
  activeTab = name;
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === `view-${name}`));
  RENDER[name]();
  window.scrollTo({ top: 0 });
}
$('#tabs').addEventListener('click', e => { const b = e.target.closest('button[data-tab]'); if (b) showTab(b.dataset.tab); });
function updateHeader() { $('#header-pill').textContent = `${state.cards.length} tarjetas · 🔥 ${streakInfo().current}`; }
const statTile = (label, num, color) =>
  `<div class="stat" style="background:linear-gradient(135deg, ${color}, ${color}cc)"><div class="num">${num}</div><div class="lbl">${label}</div></div>`;

// ------------------------------------------------------------------ PRACTICE
const P = Object.assign({ running: false, queue: [], idx: 0, answered: false, snapshot: null, verdict: null,
  ok: 0, ko: 0, size: 20, streak: 0, best: 0, lastInput: '', mode: 'smart', topics: [], onlyDiff: false }, (() => {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)) || {}; } catch { return {}; }
})());
const saveSession = () => { try { localStorage.setItem(SESSION_KEY, JSON.stringify(P)); } catch {} };
function currentCard() {
  while (P.idx < P.queue.length) { const c = getCard(P.queue[P.idx]); if (c) return c; P.idx++; }
  return null;
}
RENDER.practice = function renderPractice() {
  updateHeader();
  const v = $('#view-practice');
  if (!P.running) return renderStart(v);
  const card = currentCard();
  if (!card) return renderSummary(v);
  renderCard(v, card);
};
function streakBlock() {
  const s = streakInfo(), goal = state.settings.dailyGoal, pct = Math.min(100, Math.round(100 * s.today / goal));
  return `<div class="streak-box">
    <div class="row between" style="width:100%">
      <div class="row"><span class="streak">🔥 ${s.current} ${s.current === 1 ? 'día' : 'días'}</span><span class="muted small">récord: ${s.best}</span></div>
      <span class="muted small">Hoy ${s.today}/${goal} ${s.today >= goal ? '🎯' : ''}</span>
    </div>
    <div class="progress" style="margin:8px 0 10px"><div style="width:${pct}%"></div></div>
    ${heatmapHtml(s.days)}
  </div>`;
}
function renderStart(v) {
  const s = stats(), available = sessionPool({ mode: P.mode, topics: P.topics, onlyDiff: P.onlyDiff }).length;
  const modeBtn = (k, l) => `<button data-mode="${k}" class="${P.mode === k ? 'on' : ''}">${l}</button>`;
  v.innerHTML = `
    <div class="card col anim-in" style="align-items:center;text-align:center">
      <div><div style="font-size:1.8rem;font-weight:800">¿Practicamos?</div><div class="muted">Sesión nº ${state.session_count + 1}</div></div>
      ${streakBlock()}
      <div class="stats">
        ${statTile('Pendientes', s.due, '#6d5dfc')}${statTile('Difíciles', s.difficult, STATUS_COLORS.difficult)}
        ${statTile('Nuevas', s.new, STATUS_COLORS.new)}${statTile('Aprendidas', s.learned, STATUS_COLORS.learned)}
      </div>
      <div class="seg" id="mode-seg">${modeBtn('smart', '🧠 Repaso')}${modeBtn('random', '🎲 Aleatorio')}${modeBtn('topics', '🏷️ Temas')}</div>
      <div class="muted small" style="margin-top:-6px">${{ smart: 'Las tarjetas que tocan hoy según tu progreso.', random: 'Tarjetas al azar de todo el mazo.', topics: 'Solo los temas que elijas (primero las que tocan hoy).' }[P.mode]}</div>
      ${P.mode === 'topics' ? topicPickerHtml() : ''}
      <label class="check"><input type="checkbox" id="only-diff" ${P.onlyDiff ? 'checked' : ''}> Solo las difíciles</label>
      <div class="seg" id="size-seg">${[10, 20, 30, 50].map(n => `<button data-size="${n}" class="${P.size === n ? 'on' : ''}">${n}</button>`).join('')}</div>
      <div class="muted small" style="margin-top:-8px">tarjetas por sesión · ${available} disponibles</div>
      ${available
        ? `<div class="row center"><button class="btn btn-grad btn-lg" id="start">▶ Empezar sesión</button><span class="kbd">Enter</span></div>`
        : P.mode === 'smart' && !P.onlyDiff
          ? `<div class="muted">No hay tarjetas pendientes. ¡Bien hecho!</div><button class="btn btn-soft" id="review">↻ Repasar igualmente</button>`
          : `<div class="muted">${P.mode === 'topics' && !P.topics.length ? 'Elige al menos un tema.' : 'No hay tarjetas con estos filtros.'}</div>`}
    </div>`;
  $('#mode-seg', v).onclick = e => { const b = e.target.closest('button'); if (!b) return; P.mode = b.dataset.mode; saveSession(); renderStart(v); };
  $('#size-seg', v).onclick = e => { const b = e.target.closest('button'); if (!b) return; P.size = +b.dataset.size; saveSession(); renderStart(v); };
  $('#only-diff', v).onchange = e => { P.onlyDiff = e.target.checked; saveSession(); renderStart(v); };
  if ($('#start', v)) $('#start', v).onclick = () => start(false);
  if ($('#review', v)) $('#review', v).onclick = () => start(true);
  const picker = $('#topic-picker', v);
  if (picker) picker.onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.t) { const t = b.dataset.t; P.topics = P.topics.includes(t) ? P.topics.filter(x => x !== t) : [...P.topics, t]; }
    else if (b.dataset.group) {
      const g = topicGroups().find(x => x[0] === b.dataset.group)[1].map(x => x[0]);
      const allOn = g.every(t => P.topics.includes(t));
      P.topics = allOn ? P.topics.filter(t => !g.includes(t)) : [...new Set([...P.topics, ...g])];
    } else if (b.dataset.clear) P.topics = [];
    saveSession(); renderStart(v);
  };
}
function topicPickerHtml() {
  return `<div id="topic-picker" class="picker">
    ${topicGroups().map(([g, ts]) => `
      <div class="picker-group">
        <div class="row between"><b>${esc(g)}</b><button class="btn btn-ghost small" data-group="${esc(g)}">${ts.every(([t]) => P.topics.includes(t)) ? 'Quitar todos' : 'Todos'}</button></div>
        <div class="topic-chips">${ts.map(([t, n]) => { const [bg, ink] = topicColors(t); return `<button data-t="${esc(t)}" class="${P.topics.includes(t) ? 'on' : ''}" style="background:${bg};color:${ink}">${esc(shortTopic(t))} <span style="opacity:.7">${n}</span></button>`; }).join('')}</div>
      </div>`).join('')}
    ${P.topics.length ? `<button class="btn btn-ghost small" data-clear="1">Quitar selección (${P.topics.length})</button>` : ''}
  </div>`;
}
function start(reviewAnyway) {
  const queue = startSession({ mode: P.mode, topics: P.topics, onlyDiff: P.onlyDiff, size: P.size, reviewAnyway });
  Object.assign(P, { queue, idx: 0, ok: 0, ko: 0, running: true, answered: false, snapshot: null, verdict: null, streak: 0, best: 0, lastInput: '' });
  saveSession(); RENDER.practice();
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
      ${streakBlock()}
      <div class="row center"><button class="btn btn-grad" id="home">🏠 Volver al inicio</button><span class="kbd">Enter</span></div>
    </div>`;
  $('#home', v).onclick = backHome;
  syncNow(true); // session finished: good moment to sync
}
function backHome() { P.running = false; P.queue = []; saveSession(); RENDER.practice(); }

function renderCard(v, card) {
  const n = P.idx + 1, total = P.queue.length, [bg] = topicColors(card.topic);
  v.innerHTML = `
    <div class="row between">
      <span class="row"><span class="pill">Tarjeta ${n} de ${total}</span><button class="btn btn-ghost small" id="quit">✕ Salir</button></span>
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
  $('#quit', v).onclick = () => { if (confirm('¿Terminar la sesión ahora? Lo que has respondido ya está guardado.')) backHome(); };
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
  const before = streakInfo().today;
  const res = checkAnswer(text, card), correct = res.verdict === 'correct';
  P.snapshot = clone(card); recordAnswer(card.id, correct);
  correct ? P.ok++ : P.ko++; bumpStreak(correct);
  Object.assign(P, { answered: true, verdict: res.verdict, lastInput: text }); saveSession();
  inp.readOnly = true; updateScore(); updateHeader();
  const goal = state.settings.dailyGoal;
  if (before < goal && before + 1 >= goal) setTimeout(() => toast('🎯 ¡Objetivo diario cumplido!'), 900);
  const c = getCard(card.id);
  showFeedback(c, res);
  if (state.settings.autoSpeak) speak(isExercise(c.es) && c.note ? c.note : c.fr);
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
  const sayText = isExercise(card.es) && card.note ? card.note : card.fr;
  $('#feedback').innerHTML = `
    <div class="fb ${cls} ${quiet ? '' : anim}">
      <div class="row between"><div class="t">${title}</div>${speakBtn(sayText, 'icon-btn icon-light')}</div>
      <div class="a">${esc(card.fr)}</div>
      ${others.length ? `<div class="small" style="opacity:.8;margin-top:4px">También válido: ${others.map(esc).join(' · ')}</div>` : ''}
      <div class="row" style="margin-top:6px;gap:4px">
        ${res.verdict !== 'correct' ? `<button class="btn btn-ghost" id="override" style="padding-left:0">👍 Mi respuesta era válida</button>` : ''}
        <button class="btn btn-ghost" id="edit-card" style="padding-left:0">✏️ Editar</button>
      </div>
    </div>
    ${card.note ? `<div class="note anim-in"><span>💡</span><span>${esc(card.note)}</span></div>` : ''}`;
  const o = $('#override'); if (o) o.onclick = overrideCorrect;
  $('#edit-card').onclick = () => openEditor(card.id, () => showFeedback(getCard(card.id), { verdict: P.verdict }, false, true));
  const chip = $('#status-chip'); if (chip) chip.innerHTML = statusChip(card.status);
  renderActions(card);
}
function overrideCorrect() {
  const card = currentCard(); if (!card || !P.snapshot || P.verdict === 'correct') return;
  restoreCard(P.snapshot); recordAnswer(card.id, true);
  const c = getCard(card.id), user = (P.lastInput || '').trim();
  if (user && ![c.fr, ...c.alt].some(a => normalize(a) === normalize(user))) { c.alt.push(user); touch(c); save(); }
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
  saveSession(); RENDER.practice();
}
document.addEventListener('keydown', e => {
  if (activeTab !== 'practice' || e.repeat || document.querySelector('.modal')) return;
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
  if (e.key !== 'Enter' && e.key !== 'ArrowRight') return;
  if (e.target.tagName === 'BUTTON' && e.key === 'Enter') return; // the button handles it
  if (!P.running) { if (e.key === 'Enter' && $('#start')) { e.preventDefault(); start(false); } return; }
  if (!currentCard()) { if (e.key === 'Enter') { e.preventDefault(); backHome(); } return; }
  if (P.answered) { e.preventDefault(); nextCard(); } else if (e.key === 'Enter') $('#answer')?.focus();
});

// ------------------------------------------------------------------ LIST
const L = { q: '', status: 'all', topic: '', limit: 80, open: null };
RENDER.list = function renderList() {
  updateHeader();
  const s = stats(), v = $('#view-list');
  v.innerHTML = `
    <div class="stats">
      ${statTile('Total', s.total, '#b06ef5')}${statTile('Nuevas', s.new, STATUS_COLORS.new)}${statTile('Difíciles', s.difficult, STATUS_COLORS.difficult)}
      ${statTile('Aprendidas', s.learned, STATUS_COLORS.learned)}${statTile('Pendientes', s.due, '#6d5dfc')}
    </div>
    <div class="toolbar">
      <input class="search" id="q" type="search" placeholder="Buscar en español, francés o tema…" value="${esc(L.q)}">
      <select class="search" id="topic-sel" style="flex:0 1 240px">
        <option value="">Todos los temas</option>
        ${topicGroups().map(([g, ts]) => `<optgroup label="${esc(g)}">${ts.map(([t, n]) => `<option value="${esc(t)}" ${L.topic === t ? 'selected' : ''}>${esc(shortTopic(t))} (${n})</option>`).join('')}</optgroup>`).join('')}
      </select>
      <div class="filters" id="filters">
        ${[['all', 'Todas'], [NEW, 'Nuevas'], [DIFF, 'Difíciles'], [LEARNED, 'Aprendidas']].map(([k, l]) => `<button data-f="${k}" class="${L.status === k ? 'on' : ''}">${l}</button>`).join('')}
      </div>
    </div>
    <div class="muted small" id="count" style="margin:-4px 0 8px"></div>
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
  $('#topic-sel', v).onchange = e => { L.topic = e.target.value; L.limit = 80; renderItems(); };
  $('#filters', v).onclick = e => { const b = e.target.closest('button'); if (!b) return; L.status = b.dataset.f; L.limit = 80; RENDER.list(); };
  $('#more', v).onclick = () => { L.limit += 80; renderItems(); };
  $('#a-add', v).onclick = () => {
    const es = $('#a-es').value.trim(), fr = $('#a-fr').value.trim();
    if (!es || !fr) return toast('Español y francés son obligatorios');
    if (exists(fr)) return toast('Esa frase ya está en el mazo');
    addCard({ es, fr, note: $('#a-note').value, topic: $('#a-topic').value, alt: $('#a-alt').value.split(';').map(s => s.trim()).filter(Boolean) });
    toast('Frase añadida'); RENDER.list(); $('#add-box').open = true;
  };
  $('#items', v).onclick = onItemClick;
  renderItems();
};
function filteredCards() {
  const q = normalize(L.q);
  return state.cards.filter(c => (L.status === 'all' || c.status === L.status) && (!L.topic || c.topic === L.topic) &&
    (!q || normalize(`${c.es} ${c.fr} ${c.topic} ${(c.alt || []).join(' ')}`).includes(q)))
    .sort((a, b) => (b.last_practiced || '').localeCompare(a.last_practiced || ''));
}
function renderItems() {
  const list = filteredCards(), shown = list.slice(0, L.limit);
  $('#count').textContent = `${list.length} ${list.length === 1 ? 'tarjeta' : 'tarjetas'}`;
  $('#items').innerHTML = shown.length ? shown.map(c => {
    const ok = c.history.filter(h => h.correct).length;
    return `<div class="item" data-id="${c.id}">
      <div class="item-main" data-act="toggle">
        <div class="es">${esc(c.es)}</div><div class="fr">${esc(c.fr)}</div>
        <div class="meta">${topicChip(c.topic, 'font-size:.68rem;padding:2px 8px')}${statusChip(c.status, 'font-size:.68rem;padding:2px 8px')}
          <span>· ${formatDate(c.last_practiced)}</span>${c.history.length ? `<span>· ${ok}/${c.history.length} aciertos</span>` : ''}${c.note ? '<span>· 💡</span>' : ''}${c.edited ? '<span>· ✏️</span>' : ''}</div>
        ${L.open === c.id ? `<div class="xnote">${c.alt.length ? `<div><b>También:</b> ${c.alt.map(esc).join(' · ')}</div>` : ''}${c.note ? `<div>💡 ${esc(c.note)}</div>` : ''}${!c.alt.length && !c.note ? '<div class="muted">Sin notas</div>' : ''}</div>` : ''}
      </div>
      <div class="item-actions">
        ${speakBtn(isExercise(c.es) && c.note ? c.note : c.fr)}
        <button class="icon-btn" title="Editar" data-act="edit">✏️</button>
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
  if (act === 'edit') return openEditor(id, renderItems);
  if (act === 'del') { const c = getCard(id); if (c && confirm(`¿Eliminar «${c.es}»?`)) { deleteCard(id); toast('Eliminada'); RENDER.list(); } return; }
  setStatus(id, act); toast(`Marcada como ${LABELS[act].toLowerCase()}`); RENDER.list();
}

// ------------------------------------------------------------------ SUGGEST
const SG = { topics: new Set(), count: 10, results: [], title: '' };
const BANK = window.PHRASE_BANK || [];
const bankTopics = [...new Set(BANK.map(b => b.topic).filter(Boolean))].sort();
const bankRemaining = () => { const have = new Set(state.cards.map(c => normalize(c.fr))); return BANK.filter(b => !have.has(normalize(b.fr)) && (!SG.topics.size || SG.topics.has(b.topic))); };
RENDER.suggest = function renderSuggest() {
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
};
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
        <div class="es">${esc(it.es)}</div><div class="fr">${esc(it.fr)} ${speakBtn(it.fr, 'icon-btn icon-inline')}</div>
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

// ------------------------------------------------------------------ ORAL (défi oral: prompt + questions + timer + recorder)
const DEFIS = window.DEFIS || [];
const O = { day: null, seconds: 180, left: 180, timer: null, running: false, recorder: null, chunks: [], audioUrl: null, words: null };
RENDER.oral = function renderOral() {
  updateHeader();
  const v = $('#view-oral');
  if (O.day == null) O.day = (DEFIS.find(d => !(state.defis[d.day] || []).length) || DEFIS[0] || {}).day;
  const d = DEFIS.find(x => x.day === O.day);
  if (!d) { v.innerHTML = '<div class="card muted">No hay retos orales todavía.</div>'; return; }
  if (!O.words || O.words.day !== d.day) O.words = { day: d.day, list: pickWords(d.topic) };
  const done = state.defis[d.day] || [];
  v.innerHTML = `
    <div class="card col">
      <div style="font-size:1.4rem;font-weight:800">🎤 Défi oral</div>
      <div class="day-chips" id="day-chips">${DEFIS.map(x => `<button data-day="${x.day}" class="${x.day === d.day ? 'on' : ''}">Día ${x.day}${(state.defis[x.day] || []).length ? ' ✓' : ''}</button>`).join('')}</div>
      <div>${topicChip(d.topic)}</div>
      <div class="prompt" style="font-size:1.35rem">${esc(d.prompt)} ${speakBtn(d.prompt, 'icon-btn icon-inline')}</div>
      <ul class="questions">${d.questions.map(q => `<li>${esc(q)}</li>`).join('')}</ul>
      <div class="note"><span>💡</span><span>${esc(d.tip)} Habla 2–3 minutos.</span></div>
      <div>
        <div class="row between"><b>Intenta usar:</b><button class="btn btn-ghost small" id="reroll">🔀 Otras</button></div>
        <div class="word-chips">${O.words.list.map(c => `<button class="wchip" data-speak="${esc(c.fr)}" title="${esc(c.es)}">${esc(c.fr)}</button>`).join('')}</div>
        <div class="muted small">Toca una palabra para oírla.</div>
      </div>
    </div>
    <div class="card col" style="margin-top:14px;align-items:center;text-align:center">
      <div class="seg" id="dur-seg">${[120, 180].map(s => `<button data-s="${s}" class="${O.seconds === s ? 'on' : ''}">${s / 60} min</button>`).join('')}</div>
      <div class="timer" id="timer">${fmtTime(O.left)}</div>
      <div class="row center">
        <button class="btn btn-grad" id="t-start">${O.running ? '⏸ Pausa' : '▶ Empezar'}</button>
        <button class="btn btn-soft" id="t-reset">↺ Reiniciar</button>
      </div>
      <div class="row center" style="margin-top:6px">
        ${window.MediaRecorder ? `<button class="btn ${O.recorder ? 'btn-diff' : 'btn-soft'}" id="rec">${O.recorder ? '⏹ Parar grabación' : '🎙 Grabarme'}</button>` : '<span class="muted small">Tu navegador no permite grabar audio.</span>'}
      </div>
      ${O.audioUrl ? `<audio controls src="${O.audioUrl}" style="width:100%;margin-top:6px"></audio><div class="muted small">La grabación no se guarda: escúchala ahora.</div>` : ''}
      <button class="btn btn-learned" id="done" style="margin-top:8px">✔ Marcar como hecho${done.length ? ` (${done.length})` : ''}</button>
      ${done.length ? `<div class="muted small">Última vez: ${formatDate(done[done.length - 1])}</div>` : ''}
    </div>`;
  $('#day-chips', v).onclick = e => { const b = e.target.closest('button'); if (!b) return; O.day = +b.dataset.day; resetTimer(); RENDER.oral(); };
  $('#reroll', v).onclick = () => { O.words = null; RENDER.oral(); };
  $('#dur-seg', v).onclick = e => { const b = e.target.closest('button'); if (!b) return; O.seconds = +b.dataset.s; resetTimer(); RENDER.oral(); };
  $('#t-start', v).onclick = toggleTimer;
  $('#t-reset', v).onclick = () => { resetTimer(); RENDER.oral(); };
  if ($('#rec', v)) $('#rec', v).onclick = toggleRecording;
  $('#done', v).onclick = () => {
    (state.defis[d.day] = state.defis[d.day] || []).push(todayIso()); save();
    toast('🎤 ¡Reto oral completado!'); RENDER.oral();
  };
};
function pickWords(topic) {
  const cards = state.cards.filter(c => c.topic === topic && !isExercise(c.es) && !/^(Otro )?[Ss]inónimo/.test(c.es));
  const words = shuffle(cards.filter(c => c.fr.split(' ').length <= 3 && !/[.!?…]$/.test(c.fr))).slice(0, 8);
  const expr = shuffle(cards.filter(c => c.fr.split(' ').length >= 4 && c.fr.split(' ').length <= 7 && !/[.!?…]$/.test(c.fr) && !words.includes(c))).slice(0, 3);
  return [...words, ...expr];
}
const fmtTime = s => `${Math.floor(s / 60)}:${pad(s % 60)}`;
function resetTimer() { clearInterval(O.timer); O.timer = null; O.running = false; O.left = O.seconds; }
function toggleTimer() {
  if (O.running) { clearInterval(O.timer); O.running = false; RENDER.oral(); return; }
  if (O.left <= 0) O.left = O.seconds;
  O.running = true;
  O.timer = setInterval(() => {
    O.left--; const t = $('#timer'); if (t) t.textContent = fmtTime(Math.max(0, O.left));
    if (O.left <= 0) { clearInterval(O.timer); O.running = false; navigator.vibrate?.(300); toast('⏰ ¡Tiempo!'); if (activeTab === 'oral') RENDER.oral(); }
  }, 1000);
  RENDER.oral();
}
async function toggleRecording() {
  if (O.recorder) { O.recorder.stop(); return; }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const rec = new MediaRecorder(stream); O.chunks = [];
    rec.ondataavailable = e => e.data.size && O.chunks.push(e.data);
    rec.onstop = () => {
      stream.getTracks().forEach(t => t.stop());
      if (O.audioUrl) URL.revokeObjectURL(O.audioUrl);
      O.audioUrl = URL.createObjectURL(new Blob(O.chunks, { type: rec.mimeType || 'audio/webm' }));
      O.recorder = null; if (activeTab === 'oral') RENDER.oral();
    };
    rec.start(); O.recorder = rec; if (!O.running) toggleTimer(); else RENDER.oral();
  } catch (e) { console.error(e); toast('No se pudo acceder al micrófono'); }
}

// ------------------------------------------------------------------ DATA (settings, backup / sync)
RENDER.data = function renderData() {
  updateHeader();
  const kb = Math.round((localStorage.getItem(STORAGE_KEY) || '').length / 1024), st = state.settings;
  $('#view-data').innerHTML = `
    <div class="card col">
      <div style="font-size:1.4rem;font-weight:800">⚙️ Ajustes</div>
      <div><label class="lbl">Objetivo diario (respuestas)</label>
        <div class="seg" id="goal-seg" style="margin-top:6px">${[10, 20, 30, 50].map(n => `<button data-g="${n}" class="${st.dailyGoal === n ? 'on' : ''}">${n}</button>`).join('')}</div></div>
      ${canSpeak ? `<label class="check"><input type="checkbox" id="auto-speak" ${st.autoSpeak ? 'checked' : ''}> Leer la respuesta en voz alta al comprobar</label>
        <div class="row"><button class="btn btn-soft" id="test-voice">🔊 Probar voz</button><span class="muted small">${frVoice ? `Voz: ${esc(frVoice.name)}` : 'Si no oyes nada, instala una voz francesa en los ajustes del sistema.'}</span></div>`
        : '<div class="muted small">Este navegador no permite leer en voz alta.</div>'}
    </div>
    ${syncCardHtml()}
    <div class="card col" style="margin-top:14px">
      <div style="font-size:1.4rem;font-weight:800">💾 Tus datos</div>
      <div class="muted">Las tarjetas y el progreso se guardan solo en este dispositivo (${state.cards.length} tarjetas, ${kb} KB).
        Para pasarlos a otro dispositivo o a la app de escritorio, exporta aquí e importa allí.</div>
      <div class="row"><button class="btn btn-grad" id="export">⬇️ Exportar progreso</button></div>
      <div class="muted small">El archivo tiene el mismo formato que <code>data/cards.json</code> de la app de escritorio.</div>
      <hr class="sep">
      <div style="font-weight:800">Importar progreso</div>
      <div class="muted small">Sustituye todas las tarjetas y el progreso de este dispositivo por los del archivo (.json).</div>
      <label class="btn btn-soft file-btn" style="width:fit-content">📂 Elegir archivo .json<input type="file" id="imp-json" accept=".json,application/json"></label>
      <hr class="sep">
      <div style="font-weight:800">Empezar de cero</div>
      <div class="muted small">Borra el progreso y vuelve al mazo inicial (frases de ejemplo, tus apuntes y los días 12–21).</div>
      <div><button class="btn btn-diff" id="reset">Restablecer</button></div>
    </div>
    <div class="card col" style="margin-top:14px">
      <div class="row between"><b>Versión ${APP_VERSION}</b><button class="btn btn-soft small" id="check-update">🔄 Buscar actualización</button></div>
      <div class="muted small">Si has subido archivos nuevos a GitHub y no ves los cambios, pulsa aquí.</div>
    </div>`;
  $('#goal-seg').onclick = e => { const b = e.target.closest('button'); if (!b) return; st.dailyGoal = +b.dataset.g; st.updated = Date.now(); save(); RENDER.data(); };
  if ($('#auto-speak')) $('#auto-speak').onchange = e => { st.autoSpeak = e.target.checked; st.updated = Date.now(); save(); };
  bindSyncUi();
  if ($('#test-voice')) $('#test-voice').onclick = () => speak('Bonjour ! On est dans les temps.');
  $('#export').onclick = exportData;
  $('#imp-json').onchange = importData;
  $('#check-update').onclick = forceUpdate;
  $('#reset').onclick = () => {
    if (!confirm('¿Seguro? Se perderá todo el progreso de este dispositivo.')) return;
    const settings = state.settings;
    const old = state.cards.map(c => c.id), now = Date.now();
    state = initialState(); applyPacks(state); applyFixes(state); state.settings = settings;
    state.cards.forEach(c => { c.updated = now; }); old.forEach(id => { if (!state.cards.some(c => c.id === id)) state.deleted[id] = now; });
    save(); backHomeSilent(); toast('Mazo restablecido'); RENDER.data();
  };
};
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
    const extra = applyPacks(next); applyFixes(next);
    const now = Date.now(); next.cards.forEach(c => { c.updated = now; }); state.cards.forEach(c => { if (!next.cards.some(n => n.id === c.id)) next.deleted[c.id] = now; });
    state = next; save(); backHomeSilent(); toast(`Progreso importado${extra ? ` (+${extra} tarjetas nuevas)` : ''}`); RENDER.data();
  } catch (err) { console.error(err); toast('Archivo no válido'); }
}


// ------------------------------------------------------------------ SYNC (private GitHub Gist, free)
const SY = Object.assign({ token: '', gistId: '', last: 0 }, (() => { try { return JSON.parse(localStorage.getItem(SYNC_KEY)) || {}; } catch { return {}; } })());
const saveSync = () => localStorage.setItem(SYNC_KEY, JSON.stringify(SY));
let syncBusy = false, syncTimer = null, syncError = '';
function schedulePush() { if (!SY.token) return; clearTimeout(syncTimer); syncTimer = setTimeout(() => syncNow(true), 8000); }
async function gh(path, opts = {}) {
  const res = await fetch(`https://api.github.com${path}`, Object.assign({}, opts, {
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${SY.token}`, 'Content-Type': 'application/json' },
  }));
  if (res.status === 401) throw new Error('El token no es válido o ha caducado.');
  if (!res.ok) { const e = new Error(`GitHub respondió ${res.status}`); e.status = res.status; throw e; }
  return res.json();
}
async function readGist(g) {
  const f = g.files && g.files[GIST_FILE]; if (!f) return null;
  const text = f.truncated ? await (await fetch(f.raw_url)).text() : f.content;
  return text ? JSON.parse(text) : null;
}
async function findOrCreateGist() {
  const list = await gh('/gists?per_page=100');
  const found = list.find(g => g.files && g.files[GIST_FILE]);
  if (found) { SY.gistId = found.id; saveSync(); return readGist(await gh(`/gists/${found.id}`)); }
  const created = await gh('/gists', { method: 'POST', body: JSON.stringify({ description: 'French Trainer · progreso (no borrar)', public: false,
    files: { [GIST_FILE]: { content: JSON.stringify(state) } } }) });
  SY.gistId = created.id; saveSync(); return null;
}
function mergeHistory(a = [], b = []) {
  const seen = new Set(), out = [];
  [...a, ...b].forEach(h => { const k = `${h.date}|${h.session}|${h.correct}`; if (!seen.has(k)) { seen.add(k); out.push(h); } });
  return out.sort((x, y) => (x.date || '').localeCompare(y.date || ''));
}
function mergeStates(local, remote) {
  const byId = new Map(remote.cards.map(c => [c.id, c]));
  for (const c of local.cards) {
    const r = byId.get(c.id);
    if (!r) { byId.set(c.id, c); continue; }
    const win = clone((c.updated || 0) >= (r.updated || 0) ? c : r);
    win.history = mergeHistory(c.history, r.history); byId.set(c.id, win);
  }
  const deleted = Object.assign({}, remote.deleted);
  for (const [k, t] of Object.entries(local.deleted)) deleted[k] = Math.max(deleted[k] || 0, t);
  let cards = [...byId.values()].filter(c => !(deleted[c.id] >= (c.updated || 0)));
  const byKey = new Map(); // same phrase with different ids (e.g. imported on one device): keep the most practised
  for (const c of cards) {
    const k = normalize(c.es) + '|' + normalize(c.fr), o = byKey.get(k);
    if (!o || c.history.length > o.history.length || (c.history.length === o.history.length && (c.updated || 0) > (o.updated || 0))) byKey.set(k, c);
  }
  cards = [...byKey.values()];
  const defis = {};
  for (const src of [local.defis, remote.defis]) for (const [day, list] of Object.entries(src)) {
    const count = l => l.reduce((m, d) => (m[d] = (m[d] || 0) + 1, m), {});
    const a = count(defis[day] || []), b = count(list); const merged = [];
    new Set([...Object.keys(a), ...Object.keys(b)]).forEach(d => { for (let i = 0; i < Math.max(a[d] || 0, b[d] || 0); i++) merged.push(d); });
    defis[day] = merged.sort();
  }
  return {
    version: 1, cards, deleted, defis,
    session_count: Math.max(local.session_count, remote.session_count),
    packs: [...new Set([...local.packs, ...remote.packs])],
    fixes: [...new Set([...local.fixes, ...remote.fixes])],
    settings: (local.settings.updated || 0) >= (remote.settings.updated || 0) ? local.settings : remote.settings,
  };
}
async function syncNow(silent = false) {
  if (!SY.token || syncBusy || !navigator.onLine) return;
  syncBusy = true; clearTimeout(syncTimer); updateSyncStatus('Sincronizando…');
  try {
    let remote = null;
    if (SY.gistId) {
      try { remote = await readGist(await gh(`/gists/${SY.gistId}`)); }
      catch (e) { if (e.status === 404) { SY.gistId = ''; remote = await findOrCreateGist(); } else throw e; }
    } else remote = await findOrCreateGist();
    if (remote) {
      const before = JSON.stringify(state.cards.length) + state.session_count;
      state = mergeStates(state, normalizeState(remote)); applyPacks(state); applyFixes(state); save(true);
      if (!silent || before !== JSON.stringify(state.cards.length) + state.session_count) refreshView();
    }
    await gh(`/gists/${SY.gistId}`, { method: 'PATCH', body: JSON.stringify({ files: { [GIST_FILE]: { content: JSON.stringify(state) } } }) });
    SY.last = Date.now(); saveSync(); syncError = '';
    if (!silent) toast('☁️ Sincronizado');
  } catch (e) {
    console.error(e); syncError = e.message || 'Error de red';
    if (!silent) toast(`⚠️ No se pudo sincronizar: ${syncError}`);
  } finally { syncBusy = false; updateSyncStatus(); }
}
function refreshView() {
  if (activeTab === 'practice' && P.running) { updateHeader(); return; } // never interrupt a session
  if (!document.querySelector('.modal')) RENDER[activeTab]();
}
function syncStatusText() {
  if (!SY.token) return 'No conectado';
  if (syncError) return `⚠️ ${syncError}`;
  if (!SY.last) return 'Conectado · aún sin sincronizar';
  const d = new Date(SY.last);
  return `Última sincronización: ${formatDate(isoOf(d))}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function updateSyncStatus(text) { const el = $('#sync-status'); if (el) el.textContent = text || syncStatusText(); }
function syncCardHtml() {
  if (!SY.token) return `
    <div class="card col" style="margin-top:14px">
      <div style="font-size:1.4rem;font-weight:800">☁️ Sincronizar entre dispositivos</div>
      <div class="muted small">Guarda tu progreso en un Gist privado de tu cuenta de GitHub y lo comparte entre el móvil y el ordenador. Se hace una vez en cada dispositivo:</div>
      <ol class="steps">
        <li>Abre <a href="https://github.com/settings/tokens/new?scopes=gist&description=French%20Trainer" target="_blank" rel="noopener">este enlace</a> (crear token en GitHub; inicia sesión si te lo pide).</li>
        <li>Deja marcado <b>solo</b> «gist», elige la caducidad (p. ej. 1 año) y pulsa <b>Generate token</b>.</li>
        <li>Copia el token (empieza por <code>ghp_</code>) y pégalo aquí. Usa el mismo token en todos tus dispositivos.</li>
      </ol>
      <input class="field" id="sync-token" type="password" placeholder="ghp_…" autocomplete="off" autocapitalize="off" spellcheck="false">
      <div><button class="btn btn-grad" id="sync-connect">Conectar</button></div>
      <div class="muted small">El token se guarda solo en este dispositivo y no se incluye al exportar.</div>
    </div>`;
  return `
    <div class="card col" style="margin-top:14px">
      <div style="font-size:1.4rem;font-weight:800">☁️ Sincronización activada</div>
      <div class="muted small" id="sync-status">${esc(syncStatusText())}</div>
      <div class="muted small">Se sincroniza al abrir la app, al terminar cada sesión y unos segundos después de cada cambio.</div>
      <div class="row"><button class="btn btn-grad" id="sync-now">🔄 Sincronizar ahora</button><button class="btn btn-ghost" id="sync-off">Desconectar</button></div>
    </div>`;
}
function bindSyncUi() {
  const c = $('#sync-connect');
  if (c) c.onclick = async () => {
    const t = $('#sync-token').value.trim(); if (!t) return toast('Pega primero el token');
    SY.token = t; SY.gistId = ''; SY.last = 0; saveSync(); c.disabled = true; c.textContent = 'Conectando…';
    await syncNow(false);
    if (syncError) { SY.token = ''; saveSync(); }
    RENDER.data();
  };
  const n = $('#sync-now'); if (n) n.onclick = () => syncNow(false);
  const o = $('#sync-off'); if (o) o.onclick = () => {
    if (!confirm('¿Desconectar la sincronización en este dispositivo? Tu progreso local y el de GitHub se conservan.')) return;
    Object.assign(SY, { token: '', gistId: '', last: 0 }); saveSync(); syncError = ''; RENDER.data();
  };
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && SY.token && Date.now() - SY.last > 60000) syncNow(true);
  if (document.visibilityState === 'hidden' && syncTimer) syncNow(true);
});
window.addEventListener('online', () => syncNow(true));

async function forceUpdate() {
  toast('Buscando actualización…');
  try {
    const reg = await navigator.serviceWorker?.getRegistration(); if (reg) await reg.update();
    if (window.caches) for (const k of await caches.keys()) await caches.delete(k);
  } catch (e) { console.error(e); }
  setTimeout(() => location.reload(), 600);
}

// ------------------------------------------------------------------ boot
showTab('practice');
if (packsAdded) setTimeout(() => toast(`✨ ${packsAdded} tarjetas nuevas añadidas`), 400);
setTimeout(() => syncNow(true), 800);
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(console.error));
}
