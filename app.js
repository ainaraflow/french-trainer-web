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
const STREAK_TO_LEARN = 3;      // aciertos seguidos para pasar a «Aprendida» (desde nueva o difícil)
const MISSES_TO_DIFF = 2;       // fallos seguidos para pasar a «Difícil»
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const TOPIC_BG = ['#ffd6e8', '#d9e6ff', '#d4f5e6', '#fff0c7', '#e9dcff', '#ffe0cc', '#cff4f7', '#f1f7c9', '#ffd9d9', '#dfe3ff', '#d8f3dc', '#fde2f3'];
const TOPIC_INK = ['#b4246a', '#2f55c4', '#16815a', '#9a6b00', '#6a3fd1', '#b4531a', '#127b85', '#6a7a12', '#b3313a', '#3d48b8', '#2c7a3f', '#a3337c'];
const DEFAULT_SETTINGS = { dailyGoal: 20, autoSpeak: false, updated: 0 };
const APP_VERSION = '2026-12-05';
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
  return `<span class="chip" style="background:${bg};color:${ink};${extra}">${esc(topic.replace(/^C1 · /, ''))}</span>`;
}
function statusChip(status, extra = '') { return `<span class="chip" style="background:${STATUS_COLORS[status]};color:#fff;${extra}">${LABELS[status]}</span>`; }

let toastTimer;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2000);
}

// ------------------------------------------------------------------ pronunciation (Web Speech API, works offline with system voices)
const canSpeak = 'speechSynthesis' in window;
let frVoice = null, frVoices = [];
const VOICE_KEY = 'ft_voice_v1';                    // chosen voice + speed: per device (each device has its own voices)
const voicePref = Object.assign({ name: '', speed: 1 }, (() => { try { return JSON.parse(localStorage.getItem(VOICE_KEY)) || {}; } catch { return {}; } })());
const saveVoicePref = () => { try { localStorage.setItem(VOICE_KEY, JSON.stringify(voicePref)); } catch {} };
const NOVELTY = /grandma|grandpa|grand-m|grand-p|eddy|flo\b|reed|rocko|sandy|shelley|jacques|bad news|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|albert|bahh|fred|junior|kathy|ralph/i;
function voiceScore(v) {
  let s = 0;
  if (/natural|neural|online/i.test(v.name)) s += 6;          // Edge / Windows neural voices
  if (/premium|enhanced|améliorée|mejorada/i.test(v.name)) s += 5; // Apple downloaded voices
  if (/google/i.test(v.name)) s += 4;                          // Chrome / Android
  if (/^fr[-_]FR/i.test(v.lang)) s += 2;
  if (NOVELTY.test(v.name)) s -= 20;
  return s;
}
function pickVoice() {
  if (!canSpeak) return;
  frVoices = speechSynthesis.getVoices().filter(v => /^fr/i.test(v.lang)).sort((a, b) => voiceScore(b) - voiceScore(a) || a.name.localeCompare(b.name));
  frVoice = frVoices.find(v => v.name === voicePref.name) || frVoices[0] || null;
  try { if (activeTab === 'data') RENDER.data(); } catch {}   // voices load async; activeTab may not exist yet on first call
}
if (canSpeak) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
// iOS sometimes lists voices that cannot actually speak (silence, no error). If the chosen voice doesn't start,
// we retry with the system default French voice and remember that voice as broken for this session.
const badVoices = new Set(); let curUtter = null; const speechLog = [];
const synthState = () => canSpeak ? `speaking=${speechSynthesis.speaking} pending=${speechSynthesis.pending} paused=${speechSynthesis.paused}` : 'sin speechSynthesis';
const logSpeech = m => {
  speechLog.push(`${new Date().toLocaleTimeString()} ${m}`); if (speechLog.length > 14) speechLog.shift();
  const d = document.querySelector('.diag'); if (d && typeof diagText === 'function') d.textContent = diagText();
};
function speak(text, rate = 0.92, onend) {
  if (!canSpeak || !text) return;
  const synth = speechSynthesis, clean = text.replace(/…/g, '').replace(/____/g, ' ');
  const make = voice => {
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = voice ? voice.lang : 'fr-FR'; if (voice) u.voice = voice; u.rate = rate * (voicePref.speed || 1);
    return u;
  };
  const voice = frVoice && !badVoices.has(frVoice.name) ? frVoice : null;
  const u = make(voice); curUtter = u; let started = false, fell = false;
  const name = voice ? voice.name : 'voz por defecto';
  const fallback = why => {
    if (fell || started || curUtter !== u || !voice) return;
    fell = true; badVoices.add(voice.name); logSpeech(`«${voice.name}» no suena (${why}) → voz por defecto`);
    const u2 = make(null); curUtter = u2; let ok2 = false;
    u2.onstart = () => { ok2 = true; logSpeech('voz por defecto: empieza ✓'); }; u2.onerror = e => logSpeech('voz por defecto: error ' + e.error);
    if (onend) u2.onend = onend;
    try { synth.cancel(); } catch {}
    setTimeout(() => { synth.speak(u2); setTimeout(() => { if (!ok2 && curUtter === u2) { logSpeech(`nada en 3 s (${synthState()})`); try { synth.cancel(); } catch {} toast('🔇 No se ha podido reproducir la voz · mira Datos → 🩺 Diagnóstico'); } }, 3000); }, 150);
  };
  u.onstart = () => { started = true; logSpeech(`${name}: empieza ✓`); };
  u.onerror = e => { logSpeech(`${name}: error ${e.error}`); if (!/interrupted|canceled/.test(e.error)) fallback(e.error); };
  if (onend) u.onend = onend;
  const go = () => {
    if (curUtter !== u) return;
    logSpeech(`speak → ${name} (${synthState()})`);
    try { synth.resume(); } catch {}
    synth.speak(u);
    setTimeout(() => {
      if (started || fell || curUtter !== u) return;
      if (voice) return fallback('no empieza');
      logSpeech(`nada en 3 s (${synthState()})`); try { synth.cancel(); } catch {}
      toast('🔇 No se ha podido reproducir la voz · mira Datos → 🩺 Diagnóstico');
    }, voice ? 1800 : 3000);
  };
  // iOS drops an utterance queued in the same tick as cancel(): only cancel when needed, then wait a moment.
  if (synth.speaking || synth.pending) { synth.cancel(); setTimeout(go, 150); } else go();
}
document.addEventListener('touchstart', () => {}, { passive: true });   // iOS only shows :active (pressed) styles with a touch listener
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

/* Easy mode: one box per letter, ~30 % of letters revealed (stable per card), punctuation always shown. */
function hintHtml(text, seed) {
  let x = crc32(seed) || 1;
  const rnd = () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return (x >>> 0) / 4294967296; };
  return text.split(/\s+/).filter(Boolean).map(word => {
    const chars = [...word], letters = chars.map((ch, i) => /\p{L}/u.test(ch) ? i : -1).filter(i => i >= 0);
    const n = letters.length <= 2 ? 0 : Math.min(letters.length - 1, Math.max(1, Math.round(letters.length * 0.3)));
    const shown = new Set();
    while (shown.size < n) shown.add(letters[Math.floor(rnd() * letters.length)]);
    return `<span class="hw">${chars.map((ch, i) => /\p{L}/u.test(ch)
      ? `<span class="hl${shown.has(i) ? ' on' : ''}">${shown.has(i) ? esc(ch) : ''}</span>`
      : `<span class="hp">${esc(ch)}</span>`).join('')}</span>`;
  }).join('');
}
/* Highlights the letters that differ when both strings have the same shape (e.g. è vs é). */
function diffPair(user, target) {
  const u = [...user.trim().normalize('NFC')], t = [...target.trim().normalize('NFC')];
  if (u.length !== t.length) return null;
  let diffs = 0;
  const mark = (arr, other, cls) => arr.map((ch, i) => {
    const d = ch.toLowerCase() !== other[i].toLowerCase(); if (d && cls === 'ok') diffs++;
    return d ? `<mark class="${cls}">${esc(ch)}</mark>` : esc(ch);
  }).join('');
  const target_ = mark(t, u, 'ok'), user_ = mark(u, t, 'ko');
  return diffs && diffs <= 4 ? { user: user_, target: target_ } : null;
}

// ------------------------------------------------------------------ deck (same model as the desktop app)
const stripDay = t => (t || '').replace(/^Día \d+ · /, '');   // topics used to be "Día 12 · Le travail…"
function cardDefaults(c) {
  if (c && c.topic) c.topic = stripDay(c.topic);
  return Object.assign({
    id: uid(), alt: [], note: '', topic: '', status: NEW, created: todayIso(), last_practiced: null,
    next_session: 0, interval: IV.NEW, streak: 0, misses: 0, history: [], source: 'seed', updated: 0,
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
    social: Object.assign({ name: '', publish: false, friends: [], challenges: [], updated: 0 }, raw.social && typeof raw.social === 'object' ? raw.social : {}),
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
  c.status = status; c.misses = 0;
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
  if (opts.cefr && opts.cefr !== 'all') pool = pool.filter(c => levelOf(c) === opts.cefr);
  return pool;
}
function startSession(opts) {
  let pool = sessionPool(opts);
  if (!pool.length && opts.mode === 'smart' && opts.reviewAnyway) {
    pool = sessionPool({ mode: 'random', cefr: opts.cefr }).sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.next_session - b.next_session).slice(0, opts.size);
  }
  state.session_count += 1;
  shuffle(pool);
  if (opts.mode === 'smart') pool.sort((a, b) => ORDER[a.status] - ORDER[b.status]);
  else if (opts.mode === 'topics') pool.sort((a, b) => (a.next_session <= state.session_count ? 0 : 1) - (b.next_session <= state.session_count ? 0 : 1));
  save(); return pool.slice(0, opts.size).map(c => c.id);
}
function recordAnswer(id, result) {
  const c = getCard(id); if (!c) return;
  const correct = result === true, almost = result === 'almost';
  c.history.push(Object.assign({ date: todayIso(), session: state.session_count, correct }, almost ? { almost: true } : {}));
  c.last_practiced = todayIso();
  if (almost) {               // keeps status and streak, but comes back soon to fix the detail
    c.interval = c.status === DIFF ? IV.DIFF_WRONG : IV.NEW;
  } else if (correct) {
    c.streak += 1; c.misses = 0;
    if (c.status !== LEARNED && c.streak >= STREAK_TO_LEARN) { c.status = LEARNED; c.interval = IV.LEARNED_BASE; }
    else if (c.status === DIFF) c.interval = IV.DIFF_RIGHT;
    else if (c.status === LEARNED) c.interval = Math.min(IV.MAX, Math.max(IV.LEARNED_BASE, Math.round(c.interval * IV.GROWTH)));
    else c.interval = IV.NEW;
  } else {
    c.streak = 0; c.misses = (c.misses || 0) + 1;
    if (c.status === DIFF || c.misses >= MISSES_TO_DIFF) { c.status = DIFF; c.interval = IV.DIFF_WRONG; }
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
  const course = (window.DEFIS || []).map(d => stripDay(d.topic));
  const groups = [['Temas', []], ['Módulos', []], ['Nivel C1', []], ['Mis apuntes', []], ['Frases y banco', []], ['Básico (B1–B2)', []]];
  for (const [t, n] of counts) groups[course.includes(t) ? 0 : /^Módulo · /.test(t) ? 1 : /^C1 · /.test(t) ? 2 : /^apuntes · /.test(t) ? 3 : /^Básico · /.test(t) ? 5 : 4][1].push([t, n]);
  groups[0][1].sort((a, b) => course.indexOf(a[0]) - course.indexOf(b[0]));
  groups[1][1].sort(); groups[2][1].sort(); groups[3][1].sort(); groups[4][1].sort();
  const basic = groups.pop(); groups.unshift(basic);   // easiest first
  return groups.filter(g => g[1].length);
}
const shortTopic = t => t.replace(/^(apuntes|Módulo|C1|Básico) · /, '');

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
        <div><label class="lbl">Nivel</label><select class="field" id="e-level">${CEFR.map(l => `<option ${levelOf(c) === l ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div><label class="lbl">Traducción literal (opcional)</label><input class="field" id="e-lit" value="${esc(litOf(c))}"></div>
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
    Object.assign(c, { es, fr, level: $('#e-level', m).value, lit: $('#e-lit', m).value.trim(), note: $('#e-note', m).value.trim(), topic: $('#e-topic', m).value.trim(),
      alt: $('#e-alt', m).value.split(';').map(s => s.trim()).filter(Boolean), edited: true, updated: Date.now() });
    save(); close(); toast('Tarjeta guardada'); onDone && onDone();
  };
  setTimeout(() => $('#e-fr', m).focus(), 50);
}

const CEFR = ['B1', 'B2', 'C1'];
const levelOf = c => c.level || (window.CONTENT_LEVELS || {})[c.id] || 'B2';   // own level → reviewed map → B2
const levelChip = (c, extra = '') => `<span class="chip lvl lvl-${levelOf(c)}" style="${extra}">${levelOf(c)}</span>`;
const litOf = c => (c.lit != null ? c.lit : (window.CONTENT_LIT || {})[c.id]) || '';

// ------------------------------------------------------------------ tabs
let activeTab = 'practice';
const RENDER = {};
function showTab(name) {
  if (activeTab === 'sounds' && name !== 'sounds' && typeof stopSndMedia === 'function') stopSndMedia();
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
  ok: 0, ko: 0, almost: 0, size: 20, streak: 0, best: 0, lastInput: '', mode: 'smart', topics: [], onlyDiff: false, level: 'hard', cefr: 'all' }, (() => {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)) || {}; } catch { return {}; }
})());
P.topics = (P.topics || []).map(stripDay);
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
  const s = stats(), available = sessionPool({ mode: P.mode, topics: P.topics, onlyDiff: P.onlyDiff, cefr: P.cefr }).length;
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
      <div class="seg" id="cefr-seg">${[['all', 'Todos los niveles'], ...CEFR.map(l => [l, l])].map(([k, l]) => `<button data-cefr="${k}" class="${(P.cefr || 'all') === k ? 'on' : ''}">${k === 'all' ? '📶 ' : ''}${l}</button>`).join('')}</div>
      <div class="seg" id="level-seg"><button data-level="easy" class="${P.level === 'easy' ? 'on' : ''}">😊 Fácil</button><button data-level="hard" class="${P.level !== 'easy' ? 'on' : ''}">💪 Difícil</button></div>
      <div class="muted small" style="margin-top:-6px">${P.level === 'easy' ? 'Verás huecos con el número de letras de cada palabra y algunas letras de pista.' : 'Sin pistas: escribes la respuesta completa.'}</div>
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
  $('#cefr-seg', v).onclick = e => { const b = e.target.closest('button'); if (!b) return; P.cefr = b.dataset.cefr; saveSession(); renderStart(v); };
  $('#size-seg', v).onclick = e => { const b = e.target.closest('button'); if (!b) return; P.size = +b.dataset.size; saveSession(); renderStart(v); };
  $('#only-diff', v).onchange = e => { P.onlyDiff = e.target.checked; saveSession(); renderStart(v); };
  $('#level-seg', v).onclick = e => { const b = e.target.closest('button'); if (!b) return; P.level = b.dataset.level; saveSession(); renderStart(v); };
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
  const queue = startSession({ mode: P.mode, topics: P.topics, onlyDiff: P.onlyDiff, cefr: P.cefr, size: P.size, reviewAnyway });
  Object.assign(P, { queue, idx: 0, ok: 0, ko: 0, almost: 0, running: true, answered: false, snapshot: null, verdict: null, streak: 0, best: 0, lastInput: '' });
  saveSession(); RENDER.practice();
}
function renderSummary(v) {
  const total = P.ok + P.ko + P.almost, pct = total ? Math.round(100 * (P.ok + P.almost / 2) / total) : 0;
  const msg = pct >= 90 ? '¡Increíble!' : pct >= 70 ? '¡Muy bien!' : pct >= 40 ? '¡Sigue así!' : 'Cada sesión cuenta';
  v.innerHTML = `
    <div class="card col anim-pop" style="align-items:center;text-align:center">
      <div style="font-size:3rem">🏆</div>
      <div style="font-size:1.8rem;font-weight:800">${msg}</div>
      <div class="ring" style="background:conic-gradient(var(--ok) ${pct * 3.6}deg, #ece9f8 0)"><div>${pct}%</div></div>
      <div class="stats">${statTile('Correctas', P.ok, '#1fb37a')}${P.almost ? statTile('Casi', P.almost, '#e5a00d') : ''}${statTile('Incorrectas', P.ko, '#f0506e')}${statTile('Mejor racha', P.best, '#ff9a4d')}</div>
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
      <span class="row"><span class="streak ${P.streak >= 2 ? '' : 'hidden'}" id="streak">🔥 ${P.streak}</span><span class="pill" id="score">${scoreText()}</span></span>
    </div>
    <div class="progress"><div style="width:${(100 * (n - 1) / total).toFixed(1)}%"></div></div>
    <div class="card anim-in" style="border-top:8px solid ${bg}">
      <div class="row between"><span class="row" style="gap:6px">${levelChip(card)}${topicChip(card.topic)}</span><span id="status-chip">${statusChip(card.status)}</span></div>
      <div class="prompt">${esc(card.es)}</div>
      <div class="row between" style="margin:-2px 0 8px">
        <div class="hint ${P.level === 'easy' ? '' : 'hidden'}" id="hint">${hintHtml(card.fr, card.id + card.fr)}</div>
        <button class="btn btn-ghost small" id="lvl">${P.level === 'easy' ? '💪 Quitar pistas' : '💡 Pistas'}</button>
      </div>
      <input id="answer" class="answer" placeholder="Escribe la traducción en francés…" autocomplete="off" autocorrect="off"
             autocapitalize="off" spellcheck="false" enterkeyhint="done" lang="fr">
      <div id="feedback"></div>
      <div id="actions" class="row between actions"></div>
    </div>`;
  $('#lvl', v).onclick = () => { P.level = P.level === 'easy' ? 'hard' : 'easy'; saveSession();
    $('#hint').classList.toggle('hidden', P.level !== 'easy'); $('#lvl').textContent = P.level === 'easy' ? '💪 Quitar pistas' : '💡 Pistas'; $('#answer').focus(); };
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
const scoreText = () => `✓ ${P.ok}${P.almost ? ` &nbsp; ≈ ${P.almost}` : ''} &nbsp; ✗ ${P.ko}`;
function updateScore() { const s = $('#score'); if (s) s.innerHTML = scoreText(); }
function check() {
  const card = currentCard(), inp = $('#answer'); if (!card || P.answered || !inp) return;
  const text = inp.value || '';
  if (!text.trim()) { toast('Escribe una respuesta primero'); inp.focus(); return; }
  const before = streakInfo().today;
  const res = checkAnswer(text, card), correct = res.verdict === 'correct', almost = res.verdict === 'accents' || res.verdict === 'close';
  P.snapshot = clone(card); recordAnswer(card.id, correct ? true : almost ? 'almost' : false);
  if (correct) { P.ok++; bumpStreak(true); } else if (almost) P.almost++; else { P.ko++; bumpStreak(false); }
  Object.assign(P, { answered: true, verdict: res.verdict, lastInput: text }); saveSession();
  inp.readOnly = true; updateScore(); updateHeader();
  const now = getCard(card.id);
  if (now && now.status !== P.snapshot.status && now.status !== NEW) setTimeout(() => toast(now.status === LEARNED ? '🎉 ¡Pasa a aprendidas!' : now.status === DIFF ? '⚑ Pasa a difíciles: saldrá más a menudo' : ''), 400);
  const goal = state.settings.dailyGoal;
  if (before < goal && before + 1 >= goal) setTimeout(() => toast('🎯 ¡Objetivo diario cumplido!'), 900);
  const c = getCard(card.id);
  showFeedback(c, res);
  if (state.settings.autoSpeak) speak(isExercise(c.es) && c.note ? c.note : c.fr);
}
function showFeedback(card, res, overridden = false, quiet = false) {
  const map = {
    correct: ['fb-ok', overridden ? 'Contada como correcta' : '🎉 ¡Correcto!', 'anim-pop'],
    accents: ['fb-warn', '🟡 ¡Casi! Solo falla una tilde', 'anim-pop'],
    close: ['fb-warn', '🟡 ¡Casi! Hay una pequeña diferencia', 'anim-pop'],
    wrong: ['fb-ko', '😕 No es correcto', 'anim-shake'],
  };
  const [cls, title, anim] = map[res.verdict] || map.wrong;
  const others = (card.alt || []).filter(a => a !== card.fr);
  const sayText = isExercise(card.es) && card.note ? card.note : card.fr;
  $('#feedback').innerHTML = `
    <div class="fb ${cls} ${quiet ? '' : anim}">
      <div class="row between"><div class="t">${title}</div>${speakBtn(sayText, 'icon-btn icon-light')}</div>
      ${(() => {
        const dp = res.verdict !== 'correct' && P.lastInput ? diffPair(P.lastInput, res.matched || card.fr) : null;
        return dp ? `<div class="a">${dp.target}</div><div class="small" style="margin-top:4px">Tu respuesta: <span class="yours">${dp.user}</span></div>`
                  : `<div class="a">${esc(card.fr)}</div>${res.verdict !== 'correct' && P.lastInput ? `<div class="small" style="margin-top:4px;opacity:.85">Tu respuesta: <span class="yours">${esc(P.lastInput)}</span></div>` : ''}`;
      })()}
      ${others.length ? `<div class="small" style="opacity:.8;margin-top:4px">También válido: ${others.map(esc).join(' · ')}</div>` : ''}
      <div class="row" style="margin-top:6px;gap:4px">
        ${res.verdict !== 'correct' ? `<button class="btn btn-ghost" id="override" style="padding-left:0">👍 Mi respuesta era válida</button>` : ''}
        <button class="btn btn-ghost" id="edit-card" style="padding-left:0">✏️ Editar</button>
      </div>
    </div>
    ${litOf(card) ? `<div class="note lit-note anim-in"><span>🔤</span><span><b>Literal:</b> ${esc(litOf(card))}</span></div>` : ''}
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
  if (P.verdict === 'accents' || P.verdict === 'close') P.almost--; else P.ko--;
  P.ok++; bumpStreak(true); P.verdict = 'correct'; saveSession(); updateScore();
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
const L = { q: '', status: 'all', topic: '', cefr: 'all', limit: 80, open: null };
RENDER.list = function renderList() {
  updateHeader();
  const s = stats(), v = $('#view-list');
  v.innerHTML = `
    <div class="stats">
      ${statTile('Total', s.total, '#b06ef5')}${statTile('Nuevas', s.new, STATUS_COLORS.new)}${statTile('Difíciles', s.difficult, STATUS_COLORS.difficult)}
      ${statTile('Aprendidas', s.learned, STATUS_COLORS.learned)}${statTile('Pendientes', s.due, '#6d5dfc')}
    </div>
    <div class="row" style="margin:4px 0 10px"><button class="btn btn-soft small" id="go-suggest">✨ Sugerir frases nuevas</button></div>
    <div class="toolbar">
      <input class="search" id="q" type="search" placeholder="Buscar en español, francés o tema…" value="${esc(L.q)}">
      <select class="search" id="topic-sel" style="flex:0 1 240px">
        <option value="">Todos los temas</option>
        ${topicGroups().map(([g, ts]) => `<optgroup label="${esc(g)}">${ts.map(([t, n]) => `<option value="${esc(t)}" ${L.topic === t ? 'selected' : ''}>${esc(shortTopic(t))} (${n})</option>`).join('')}</optgroup>`).join('')}
      </select>
      <div class="filters" id="filters">
        ${[['all', 'Todas'], [NEW, 'Nuevas'], [DIFF, 'Difíciles'], [LEARNED, 'Aprendidas']].map(([k, l]) => `<button data-f="${k}" class="${L.status === k ? 'on' : ''}">${l}</button>`).join('')}
        <span class="fsep"></span>${[['all', 'Todos'], ...CEFR.map(l => [l, l])].map(([k, l]) => `<button data-cefr="${k}" class="${L.cefr === k ? 'on' : ''}">${l}</button>`).join('')}
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
  $('#go-suggest', v).onclick = () => showTab('suggest');
  $('#filters', v).onclick = e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.cefr) L.cefr = b.dataset.cefr; else L.status = b.dataset.f; L.limit = 80; RENDER.list(); };
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
  return state.cards.filter(c => (L.status === 'all' || c.status === L.status) && (!L.topic || c.topic === L.topic) && (L.cefr === 'all' || levelOf(c) === L.cefr) &&
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
        <div class="es">${esc(c.es)}</div><div class="fr">${esc(c.fr)}</div>${litOf(c) ? `<div class="lit">🔤 ${esc(litOf(c))}</div>` : ''}
        <div class="meta">${levelChip(c, 'font-size:.68rem;padding:2px 8px')}${topicChip(c.topic, 'font-size:.68rem;padding:2px 8px')}${statusChip(c.status, 'font-size:.68rem;padding:2px 8px')}
          <span>· ${formatDate(c.last_practiced)}</span>${c.history.length ? `<span>· ${ok}/${c.history.length} aciertos</span>` : ''}${c.note ? '<span>· 💡</span>' : ''}${c.edited ? '<span>· ✏️</span>' : ''}</div>
        ${L.open === c.id ? `<div class="xnote">${c.alt.length ? `<div><b>También:</b> ${c.alt.map(esc).join(' · ')}</div>` : ''}${c.note ? `<div>💡 ${esc(c.note)}</div>` : ''}${!c.alt.length && !c.note ? '<div class="muted">Sin notas</div>' : ''}</div>` : ''}
      </div>
      <div class="item-actions">
        ${speakBtn(isExercise(c.es) && c.note ? c.note : c.fr)}
        <button class="icon-btn" title="Editar" data-act="edit">✏️</button>
        <button class="icon-btn" title="Nueva" data-act="new">🆕</button>
        <button class="icon-btn ${c.status === DIFF ? 'flag-on' : ''}" title="${c.status === DIFF ? 'Quitar de difíciles' : 'Marcar como difícil'}" data-act="difficult">⚑</button>
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
  const cur = getCard(id);
  if (act === DIFF && cur && cur.status === DIFF) { setStatus(id, NEW); toast('Quitada de difíciles'); return RENDER.list(); }
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
      <select class="search" id="day-sel">${DEFIS.map(x => `<option value="${x.day}" ${x.day === d.day ? 'selected' : ''}>${esc(x.title)}${(state.defis[x.day] || []).length ? ' ✓' : ''}</option>`).join('')}</select>
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
  $('#day-sel', v).onchange = e => { O.day = +e.target.value; O.words = null; resetTimer(); RENDER.oral(); };
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

// ------------------------------------------------------------------ SOUNDS (pronunciation: tips + minimal pairs + speech recognition + record & compare)
const SOUNDS = window.SOUNDS || [], HOMO = window.SOUND_HOMOPHONES || {};
const SND_KEY = 'ft_sounds_v1';                       // listening-quiz stats, per device (not synced)
const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
const SN = { id: (SOUNDS[0] || {}).id, mode: 'listen', q: null, picked: null, round: 0, ok: 0, idx: 0,
  listening: false, heard: null, recObj: null, recorder: null, chunks: [], audioUrl: null, recTimer: null };
let sndStats = (() => { try { return JSON.parse(localStorage.getItem(SND_KEY)) || {}; } catch { return {}; } })();
const saveSnd = () => { try { localStorage.setItem(SND_KEY, JSON.stringify(sndStats)); } catch {} };
const ROUND = 10;
function sndItems(s) {
  const seen = new Set(), out = [];
  s.pairs.forEach(p => { [[p[0], p[1], p[2], p[3]], [p[2], p[3], p[0], p[1]]].forEach(([fr, es, other, otherEs]) => { if (!seen.has(fr)) { seen.add(fr); out.push({ fr, es, other, otherEs }); } }); });
  s.words.forEach(fr => { if (!seen.has(fr)) { seen.add(fr); out.push({ fr }); } });
  s.phrases.forEach(fr => out.push({ fr, phrase: true }));
  return out;
}
const sndNorm = t => normalize(t).replace(/-/g, ' ');
const sndForms = w => [w, ...(HOMO[w] || [])].map(sndNorm);
function newListenQ(s) {
  const p = s.pairs[Math.floor(Math.random() * s.pairs.length)], a = Math.random() < .5 ? 0 : 1;
  SN.q = { pair: p, answer: a }; SN.picked = null;
  speak(a ? p[2] : p[0], .85);
}
function stopSndMedia() {
  try { SN.recObj && SN.recObj.abort(); } catch {} SN.recObj = null; SN.listening = false;
  if (SN.recorder) { try { SN.recorder.stop(); } catch {} }
  clearTimeout(SN.recTimer);
}
function judgeHeard(item, alts) {
  // alts: transcripts from the recognizer, best first
  const norm = alts.map(sndNorm);
  if (item.phrase) {
    const target = sndNorm(item.fr).split(' '), said = norm[0].split(' ');
    const marks = target.map(w => said.some(x => x === w || similarity(stripAccents(x), stripAccents(w)) >= .8) ? `<mark class="ok">${esc(w)}</mark>` : `<mark class="ko">${esc(w)}</mark>`);
    const hits = marks.filter(m => m.includes('"ok"')).length;
    return { kind: hits === target.length ? 'ok' : hits >= target.length * .6 ? 'close' : 'ko', text: alts[0], detail: marks.join(' ') };
  }
  const mine = sndForms(item.fr), other = item.other ? sndForms(item.other) : [];
  const has = (forms, t) => forms.some(f => t === f || t.split(' ').includes(f));
  if (has(mine, norm[0])) return { kind: 'ok', text: alts[0] };
  if (other.length && has(other, norm[0])) return { kind: 'other', text: alts[0] };
  if (norm.slice(1).some(t => has(mine, t))) return { kind: 'close', text: alts[0] };
  return { kind: 'ko', text: alts[0] };
}
function startListening(item) {
  if (!SpeechRec) return;
  stopSndMedia();
  const r = new SpeechRec(); r.lang = 'fr-FR'; r.interimResults = false; r.maxAlternatives = 5; r.continuous = false;
  SN.recObj = r; SN.listening = true; SN.heard = null;
  r.onresult = e => {
    const res = e.results[0], alts = [...res].map(a => a.transcript.trim()).filter(Boolean);
    SN.heard = alts.length ? judgeHeard(item, alts) : { kind: 'none' };
  };
  r.onerror = e => { SN.heard = { kind: 'error', text: e.error }; };
  r.onend = () => { SN.listening = false; SN.recObj = null; if (!SN.heard) SN.heard = { kind: 'none' }; if (activeTab === 'sounds') RENDER.sounds(); };
  try { r.start(); } catch (e) { SN.listening = false; SN.heard = { kind: 'error', text: e.message }; }
  RENDER.sounds();
}
async function toggleSndRecording() {
  if (SN.recorder) { SN.recorder.stop(); return; }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const rec = new MediaRecorder(stream); SN.chunks = [];
    rec.ondataavailable = e => e.data.size && SN.chunks.push(e.data);
    rec.onstop = () => {
      clearTimeout(SN.recTimer); stream.getTracks().forEach(t => t.stop());
      if (SN.audioUrl) URL.revokeObjectURL(SN.audioUrl);
      SN.audioUrl = URL.createObjectURL(new Blob(SN.chunks, { type: rec.mimeType || 'audio/webm' }));
      SN.recorder = null; if (activeTab === 'sounds') RENDER.sounds();
    };
    rec.start(); SN.recorder = rec; SN.recTimer = setTimeout(() => rec.state === 'recording' && rec.stop(), 8000);
    RENDER.sounds();
  } catch (e) { console.error(e); toast('No se pudo acceder al micrófono'); }
}
function playModelThenMe(text) {
  if (!SN.audioUrl) return;
  const me = () => { const a = new Audio(SN.audioUrl); a.play().catch(() => {}); };
  if (!canSpeak) return me();
  let done = false; const go = () => { if (!done) { done = true; setTimeout(me, 350); } };
  speak(text, .92, go);
  setTimeout(go, 1200 + text.length * 110);              // some browsers never fire onend
}
RENDER.sounds = function renderSounds() {
  updateHeader();
  const v = $('#view-sounds');
  const s = SOUNDS.find(x => x.id === SN.id) || SOUNDS[0];
  if (!s) { v.innerHTML = '<div class="card muted">No hay contenido de sonidos.</div>'; return; }
  if (SN.mode === 'listen' && !s.pairs.length) SN.mode = 'repeat';
  const items = sndItems(s); SN.idx = Math.min(SN.idx, items.length - 1);
  const item = items[SN.idx];
  const pct = id => { const t = sndStats[id]; return t && t.n ? Math.round(100 * t.ok / t.n) : null; };
  const chip = x => { const p = pct(x.id); return `<button data-s="${x.id}" class="${x.id === s.id ? 'on' : ''}">${esc(x.title)}${p != null ? ` <small>${p}%</small>` : ''}</button>`; };
  const modes = [['listen', '👂 Escucha'], ['repeat', '🗣️ Repite'], ['record', '🎙 Grábate']].filter(([m]) => m !== 'listen' || s.pairs.length);
  let body = '';
  if (SN.mode === 'listen') {
    if (SN.round >= ROUND) {
      body = `<div class="col" style="align-items:center;text-align:center">
        <div style="font-size:2.6rem">${SN.ok >= 8 ? '🏆' : SN.ok >= 6 ? '👍' : '💪'}</div>
        <div style="font-size:1.3rem;font-weight:800">${SN.ok} / ${ROUND}</div>
        <div class="muted">${SN.ok >= 8 ? '¡Ya distingues bien este sonido!' : 'Repasa el truco de arriba y vuelve a intentarlo: oír la diferencia es el primer paso.'}</div>
        <button class="btn btn-grad" id="l-again">🔁 Otra ronda</button></div>`;
    } else if (!SN.q) {
      body = `<div class="col" style="align-items:center;text-align:center">
        <div class="muted">Oirás una palabra. Elige cuál de las dos es. Rondas de ${ROUND}.</div>
        <button class="btn btn-grad" id="l-start">▶ Empezar</button></div>`;
    } else {
      const p = SN.q.pair, opts = [[p[0], p[1]], [p[2], p[3]]];
      body = `<div class="col" style="align-items:center;text-align:center">
        <div class="muted small">Pregunta ${SN.round + 1} de ${ROUND} · ✓ ${SN.ok}</div>
        <div class="row center"><button class="btn btn-soft" id="l-play">🔊 Otra vez</button><button class="btn btn-ghost" id="l-slow">🐢 Lento</button></div>
        <div class="snd-opts">${opts.map(([fr, es], i) => {
          const cls = SN.picked == null ? '' : i === SN.q.answer ? 'right' : i === SN.picked ? 'wrong' : 'dim';
          return `<button class="snd-opt ${cls}" data-o="${i}" ${SN.picked != null ? 'disabled' : ''}><b>${esc(fr)}</b><span>${esc(es)}</span></button>`; }).join('')}</div>
        ${SN.picked != null ? `
          <div class="fb ${SN.picked === SN.q.answer ? 'fb-ok' : 'fb-ko'}" style="width:100%">${SN.picked === SN.q.answer ? '✓ ¡Bien!' : `✗ Era <b>${esc(opts[SN.q.answer][0])}</b>`}</div>
          <div class="row center">${opts.map(([fr]) => `<button class="btn btn-soft small" data-speak="${esc(fr)}">🔊 ${esc(fr)}</button>`).join('')}</div>
          <div class="muted small">Escucha las dos seguidas para notar la diferencia.</div>
          <button class="btn btn-grad" id="l-next">Siguiente →</button>` : ''}
      </div>`;
    }
  } else {
    const nav = `<div class="row between"><button class="btn btn-ghost small" id="i-prev">←</button>
      <span class="muted small">${SN.idx + 1} / ${items.length}</span><button class="btn btn-ghost small" id="i-next">→</button></div>`;
    const head = `<div class="snd-word ${item.phrase ? 'phrase' : ''}">${esc(item.fr)}</div>${item.es ? `<div class="muted">${esc(item.es)}</div>` : ''}
      <div class="row center"><button class="btn btn-soft" data-speak="${esc(item.fr)}">🔊 Escuchar</button><button class="btn btn-ghost" id="i-slow">🐢 Lento</button></div>`;
    if (SN.mode === 'repeat') {
      let fb = '';
      const h = SN.heard;
      if (h) {
        if (h.kind === 'ok') fb = `<div class="fb fb-ok">✓ Se ha entendido «${esc(h.text)}»</div>${h.detail ? `<div class="snd-detail">${h.detail}</div>` : ''}`;
        else if (h.kind === 'other') fb = `<div class="fb fb-warn">Se ha entendido «<b>${esc(h.text)}</b>» (${esc(item.otherEs)}), no «${esc(item.fr)}». Repasa el truco de arriba.</div>`;
        else if (h.kind === 'close') fb = `<div class="fb fb-warn">≈ Casi: se ha entendido «${esc(h.text)}»</div>${h.detail ? `<div class="snd-detail">${h.detail}</div>` : ''}`;
        else if (h.kind === 'ko') fb = `<div class="fb fb-ko">Se ha entendido «${esc(h.text)}»</div>${h.detail ? `<div class="snd-detail">${h.detail}</div>` : ''}`;
        else if (h.kind === 'error' && /not-allowed|service-not-allowed/.test(h.text)) fb = `<div class="fb fb-ko">El navegador no ha dado permiso al micrófono o al reconocimiento de voz.</div>`;
        else if (h.kind === 'error' && /network/.test(h.text)) fb = `<div class="fb fb-ko">El reconocimiento de voz necesita conexión a internet.</div>`;
        else fb = `<div class="fb fb-warn">No se ha oído nada. Toca 🎤 y habla justo después.</div>`;
      }
      body = `${nav}<div class="col" style="align-items:center;text-align:center">${head}
        ${SpeechRec ? `<button class="btn ${SN.listening ? 'btn-diff' : 'btn-grad'} big-mic" id="i-say" ${SN.listening ? 'disabled' : ''}>${SN.listening ? '👂 Escuchando…' : '🎤 Dilo'}</button>`
          : '<div class="note"><span>ℹ️</span><span>Este navegador no tiene reconocimiento de voz. Prueba en Chrome, o usa «🎙 Grábate».</span></div>'}
        ${fb}
        </div>
        <div class="muted small" style="margin-top:10px">El reconocimiento dice qué palabra ha entendido; no puntúa tu acento. Si se equivoca con algo que te sonó bien, no te preocupes: repite 2–3 veces y fíjate en la tendencia.</div>`;
    } else {
      body = `${nav}<div class="col" style="align-items:center;text-align:center">${head}
        ${window.MediaRecorder ? `<button class="btn ${SN.recorder ? 'btn-diff' : 'btn-grad'} big-mic" id="i-rec">${SN.recorder ? '⏹ Parar' : '🎙 Grabarme'}</button>` : '<span class="muted small">Tu navegador no permite grabar audio.</span>'}
        ${SN.audioUrl && !SN.recorder ? `<div class="row center"><button class="btn btn-learned" id="i-cmp">▶ Modelo y después yo</button><button class="btn btn-soft" id="i-me">▶ Solo yo</button></div>
          <div class="muted small">Fíjate sobre todo en el sonido de esta sección. La grabación no se guarda.</div>` : ''}
      </div>`;
    }
  }
  v.innerHTML = `
    <div class="card col">
      <div style="font-size:1.4rem;font-weight:800">🗣️ Sonidos</div>
      <div class="day-chips snd-chips" id="snd-chips">${SOUNDS.map(chip).join('')}</div>
    </div>
    <details class="card gram" id="snd-tip" ${SN.tipOpen !== false ? 'open' : ''} style="margin-top:14px">
      <summary>${esc(s.title)} <span class="muted small">· ${esc(s.sub)}</span></summary>
      <div class="gram-body">${s.tip}
        ${s.pairs.length ? `<div class="snd-pairs">${s.pairs.map(p => `<span class="snd-pair"><button class="wchip" data-speak="${esc(p[0])}">${esc(p[0])}</button><span class="muted">≠</span><button class="wchip" data-speak="${esc(p[2])}">${esc(p[2])}</button></span>`).join('')}</div>
          <div class="muted small">Toca para oír cada palabra.</div>` : ''}
      </div>
    </details>
    <div class="card col" style="margin-top:14px">
      <div class="seg" id="snd-mode" style="align-self:center">${modes.map(([m, l]) => `<button data-m="${m}" class="${SN.mode === m ? 'on' : ''}">${l}</button>`).join('')}</div>
      ${body}
    </div>`;

  $('#snd-chips', v).onclick = e => { const b = e.target.closest('button'); if (!b) return; stopSndMedia();
    Object.assign(SN, { id: b.dataset.s, q: null, picked: null, round: 0, ok: 0, idx: 0, heard: null, audioUrl: null }); RENDER.sounds(); };
  $('#snd-tip', v).addEventListener('toggle', e => { SN.tipOpen = e.target.open; });
  $('#snd-mode', v).onclick = e => { const b = e.target.closest('button'); if (!b) return; stopSndMedia();
    Object.assign(SN, { mode: b.dataset.m, heard: null, audioUrl: null }); RENDER.sounds(); };
  const on = (sel, fn) => { const el = $(sel, v); if (el) el.onclick = fn; };
  on('#l-start', () => { SN.round = 0; SN.ok = 0; newListenQ(s); RENDER.sounds(); });
  on('#l-again', () => { SN.round = 0; SN.ok = 0; newListenQ(s); RENDER.sounds(); });
  on('#l-play', () => speak(SN.q.answer ? SN.q.pair[2] : SN.q.pair[0], .85));
  on('#l-slow', () => speak(SN.q.answer ? SN.q.pair[2] : SN.q.pair[0], .6));
  on('#l-next', () => { SN.round++; if (SN.round < ROUND) newListenQ(s); else SN.q = null; RENDER.sounds(); });
  const opts = $('.snd-opts', v);
  if (opts) opts.onclick = e => {
    const b = e.target.closest('button[data-o]'); if (!b || SN.picked != null) return;
    SN.picked = +b.dataset.o; const right = SN.picked === SN.q.answer;
    if (right) SN.ok++;
    const t = sndStats[s.id] = sndStats[s.id] || { n: 0, ok: 0 }; t.n++; if (right) t.ok++; saveSnd();
    navigator.vibrate?.(right ? 30 : [60, 40, 60]);
    RENDER.sounds();
  };
  on('#i-prev', () => { stopSndMedia(); SN.idx = (SN.idx - 1 + items.length) % items.length; SN.heard = null; SN.audioUrl = null; RENDER.sounds(); });
  on('#i-next', () => { stopSndMedia(); SN.idx = (SN.idx + 1) % items.length; SN.heard = null; SN.audioUrl = null; RENDER.sounds(); });
  on('#i-slow', () => speak(item.fr, .6));
  on('#i-say', () => startListening(item));
  on('#i-rec', toggleSndRecording);
  on('#i-cmp', () => playModelThenMe(item.fr));
  on('#i-me', () => { if (SN.audioUrl) new Audio(SN.audioUrl).play().catch(() => {}); });
};

// ------------------------------------------------------------------ GRAMMAR EXERCISES (by topic)
const GEX_KEY = 'ft_gram_v1';
let gexStats = (() => { try { return JSON.parse(localStorage.getItem(GEX_KEY)) || {}; } catch { return {}; } })();
const saveGex = () => { try { localStorage.setItem(GEX_KEY, JSON.stringify(gexStats)); } catch {} };
const GX = { running: false, pick: [], size: 10, queue: [], idx: 0, answered: false, verdict: null, picked: null, ok: 0, almost: 0, ko: 0, wrong: [], opts: null };
const gexOf = id => (window.GRAMMAR_EX || {})[id] || [];
const gexPct = id => { const t = gexStats[id]; return t && t.n ? Math.round(100 * t.ok / t.n) : null; };
function gexStart(ids, items) {
  let pool = items || shuffle(ids.flatMap(id => gexOf(id).map((x, i) => ({ id, i }))));
  if (!items) {                                    // spread topics: round-robin so one topic doesn't eat the session
    const by = {}; pool.forEach(p => (by[p.id] = by[p.id] || []).push(p));
    const lists = Object.values(by); pool = [];
    while (lists.some(l => l.length)) lists.forEach(l => l.length && pool.push(l.shift()));
    pool = pool.slice(0, GX.size); shuffle(pool);
  }
  Object.assign(GX, { running: true, queue: pool, idx: 0, answered: false, verdict: null, picked: null, ok: 0, almost: 0, ko: 0, wrong: [], opts: null });
  GR.mode = 'ex'; RENDER.grammar(); window.scrollTo({ top: 0 });
}
function gexCheck(item, value) {
  if (item.t === 'c') return value === item.o[0] ? 'ok' : 'ko';
  const u = normalize(value);
  if (item.a.some(a => normalize(a) === u)) return 'ok';
  if (item.a.some(a => stripAccents(normalize(a)) === stripAccents(u))) return 'almost';
  return 'ko';
}
function gexAnswer(value) {
  const cur = GX.queue[GX.idx], item = gexOf(cur.id)[cur.i]; if (!item || GX.answered) return;
  const v = gexCheck(item, value);
  Object.assign(GX, { answered: true, verdict: v, picked: value });
  if (v === 'ok') GX.ok++; else if (v === 'almost') GX.almost++; else { GX.ko++; GX.wrong.push(cur); }
  const t = gexStats[cur.id] = gexStats[cur.id] || { n: 0, ok: 0 }; t.n++; if (v === 'ok') t.ok++; saveGex();
  navigator.vibrate?.(v === 'ok' ? 30 : [60, 40, 60]);
  RENDER.grammar();
}
function gexNext() { GX.idx++; Object.assign(GX, { answered: false, verdict: null, picked: null, opts: null }); RENDER.grammar(); }
function gexBlank(q, fill, cls) { return esc(q).replace('____', fill != null ? `<span class="gx-fill ${cls || ''}">${esc(fill)}</span>` : '<span class="gx-blank">____</span>'); }
function renderGex(v) {
  const all = window.GRAMMAR || [];
  if (!GX.running) {                               // topic picker
    const list = all.filter(g => gexOf(g.id).length && (GR.lvl === 'all' || grLevels(g).includes(GR.lvl)));
    const groups = [...new Set(list.map(g => g.group))];
    const nQ = GX.pick.reduce((a, id) => a + gexOf(id).length, 0);
    v.innerHTML = `
      <div class="card col">
        <div class="row between"><div style="font-size:1.4rem;font-weight:800">✏️ Ejercicios</div><button class="btn btn-ghost small" id="gx-ref">📖 Volver a las fichas</button></div>
        <div class="seg" id="gr-lvl" style="align-self:flex-start">${[['all', 'Todos'], ...CEFR.map(l => [l, l])].map(([k, l]) => `<button data-l="${k}" class="${GR.lvl === k ? 'on' : ''}">${l}</button>`).join('')}</div>
        <div class="muted small">Elige uno o varios temas. El % es tu acierto histórico en cada uno.</div>
        ${groups.map(gr => `<div class="picker-group"><div class="row between"><b>${esc(gr)}</b><button class="btn btn-ghost small" data-gxgroup="${esc(gr)}">Todos</button></div>
          <div class="topic-chips">${list.filter(g => g.group === gr).map(g => { const p = gexPct(g.id); return `<button data-gx="${g.id}" class="gx-chip ${GX.pick.includes(g.id) ? 'on' : ''}">${esc(g.title)} <span style="opacity:.7">${gexOf(g.id).length}${p != null ? ` · ${p}%` : ''}</span></button>`; }).join('')}</div></div>`).join('')}
        <div class="seg" id="gx-size" style="align-self:center">${[10, 20, 30].map(n => `<button data-n="${n}" class="${GX.size === n ? 'on' : ''}">${n}</button>`).join('')}</div>
        <div class="muted small" style="text-align:center">preguntas por sesión · ${nQ} disponibles</div>
        <button class="btn btn-grad btn-lg" id="gx-go" style="align-self:center" ${nQ ? '' : 'disabled'}>▶ Empezar</button>
      </div>`;
    $('#gx-ref', v).onclick = () => { GR.mode = 'ref'; RENDER.grammar(); };
    $('#gr-lvl', v).onclick = e => { const b = e.target.closest('button'); if (!b) return; GR.lvl = b.dataset.l; RENDER.grammar(); };
    v.querySelectorAll('[data-gx]').forEach(b => b.onclick = () => { const id = b.dataset.gx; GX.pick = GX.pick.includes(id) ? GX.pick.filter(x => x !== id) : [...GX.pick, id]; RENDER.grammar(); });
    v.querySelectorAll('[data-gxgroup]').forEach(b => b.onclick = () => { const ids = list.filter(g => g.group === b.dataset.gxgroup).map(g => g.id); const on = ids.every(i => GX.pick.includes(i)); GX.pick = on ? GX.pick.filter(i => !ids.includes(i)) : [...new Set([...GX.pick, ...ids])]; RENDER.grammar(); });
    $('#gx-size', v).onclick = e => { const b = e.target.closest('button'); if (!b) return; GX.size = +b.dataset.n; RENDER.grammar(); };
    $('#gx-go', v).onclick = () => gexStart(GX.pick);
    return;
  }
  if (GX.idx >= GX.queue.length) {                 // summary
    const total = GX.queue.length, score = GX.ok + GX.almost / 2;
    v.innerHTML = `<div class="card col" style="align-items:center;text-align:center">
      <div style="font-size:2.6rem">${score / total >= .8 ? '🏆' : score / total >= .6 ? '👍' : '💪'}</div>
      <div style="font-size:1.4rem;font-weight:800">${GX.ok} / ${total}${GX.almost ? ` <span class="muted small">(+${GX.almost} casi)</span>` : ''}</div>
      <div class="muted">${score / total >= .8 ? '¡Muy bien!' : 'Repasa las fichas de los fallos y vuelve a intentarlo.'}</div>
      <div class="row center">${GX.wrong.length ? `<button class="btn btn-diff" id="gx-wrong">↻ Repetir los ${GX.wrong.length} fallos</button>` : ''}<button class="btn btn-grad" id="gx-again">🔀 Otra ronda</button></div>
      <button class="btn btn-ghost" id="gx-exit">← Elegir temas</button></div>`;
    if ($('#gx-wrong', v)) $('#gx-wrong', v).onclick = () => gexStart(null, shuffle([...GX.wrong]));
    $('#gx-again', v).onclick = () => gexStart(GX.pick.length ? GX.pick : [...new Set(GX.queue.map(q => q.id))]);
    $('#gx-exit', v).onclick = () => { GX.running = false; RENDER.grammar(); };
    return;
  }
  const cur = GX.queue[GX.idx], item = gexOf(cur.id)[cur.i], sec = all.find(g => g.id === cur.id) || {};
  if (item.t === 'c' && !GX.opts) GX.opts = shuffle([...item.o]);
  const shown = GX.answered ? (item.t === 'c' ? item.o[0] : (GX.verdict === 'ok' ? GX.picked.trim() : item.a[0])) : null;
  const fb = !GX.answered ? '' : GX.verdict === 'ok' ? '<div class="fb fb-ok">✓ ¡Correcto!</div>'
    : GX.verdict === 'almost' ? `<div class="fb fb-warn">≈ Casi: revisa los acentos. Era <b>${esc(item.a[0])}</b>.</div>`
    : `<div class="fb fb-ko">✗ La respuesta correcta es <b>${esc(item.t === 'c' ? item.o[0] : item.a.join(' / '))}</b>${GX.picked && item.t === 'f' ? `<div class="small">Tu respuesta: ${esc(GX.picked)}</div>` : ''}</div>`;
  v.innerHTML = `
    <div class="row between" style="margin-bottom:10px"><span class="pill">Pregunta ${GX.idx + 1} de ${GX.queue.length}</span>
      <button class="btn btn-ghost small" id="gx-quit">✕ Salir</button><span class="pill">✓ ${GX.ok} · ✗ ${GX.ko}</span></div>
    <div class="progress"><div style="width:${Math.round(100 * GX.idx / GX.queue.length)}%"></div></div>
    <div class="card col" style="margin-top:12px">
      <div class="row" style="gap:6px">${grBadge(sec)}<span class="chip" style="background:#f2efff;color:var(--primary)">${esc(sec.title || '')}</span></div>
      <div class="gx-q">${gexBlank(item.q, shown, GX.answered ? (GX.verdict === 'ok' ? 'ok' : 'ko') : '')}</div>
      ${item.t === 'c'
        ? `<div class="gx-opts">${GX.opts.map(o => { const cls = !GX.answered ? '' : o === item.o[0] ? 'right' : o === GX.picked ? 'wrong' : 'dim'; return `<button class="gx-opt ${cls}" data-o="${esc(o)}" ${GX.answered ? 'disabled' : ''}>${esc(o)}</button>`; }).join('')}</div>`
        : `<div class="row"><input class="field" id="gx-in" lang="fr" autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="Escribe la respuesta…" style="flex:1" ${GX.answered ? `readonly value="${esc(GX.picked)}"` : ''}>${GX.answered ? '' : '<button class="btn btn-grad" id="gx-check">✓</button>'}</div>
           ${GX.answered ? '' : `<div class="accent-keys">${['é', 'è', 'ê', 'à', 'â', 'ç', 'î', 'ô', 'û', 'ù', 'ë', 'œ'].map(k => `<button data-k="${k}">${k}</button>`).join('')}</div>`}`}
      ${fb}
      ${GX.answered ? `<div class="note"><span>💡</span><span>${esc(item.e)}</span></div><button class="btn btn-grad" id="gx-next" style="align-self:flex-end">Siguiente →</button>` : ''}
    </div>`;
  $('#gx-quit', v).onclick = () => { GX.running = false; RENDER.grammar(); };
  v.querySelectorAll('.gx-opt').forEach(b => b.onclick = () => gexAnswer(b.dataset.o));
  const inp = $('#gx-in', v);
  if (inp && !GX.answered) {
    inp.focus({ preventScroll: true });
    inp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); if (inp.value.trim()) gexAnswer(inp.value); } };
    $('#gx-check', v).onclick = () => inp.value.trim() ? gexAnswer(inp.value) : toast('Escribe una respuesta primero');
    v.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { const s = inp.selectionStart ?? inp.value.length; inp.value = inp.value.slice(0, s) + b.dataset.k + inp.value.slice(inp.selectionEnd ?? s); inp.focus(); inp.setSelectionRange(s + 1, s + 1); });
  }
  const nx = $('#gx-next', v); if (nx) { nx.onclick = gexNext; nx.focus({ preventScroll: true }); }
}

// ------------------------------------------------------------------ GRAMMAR (quick reference)
const GR = { q: '', open: null, lvl: 'all', mode: 'ref' };
const grLevels = g => (g.level || 'B2').split('-');
const grBadge = g => { const l = grLevels(g); return `<span class="chip lvl lvl-${l.length > 1 ? 'mix' : l[0]}" style="font-size:.7rem;padding:2px 8px;vertical-align:middle">${l.join('–')}</span>`; };
RENDER.grammar = function renderGrammar() {
  updateHeader();
  const v = $('#view-grammar'), all = window.GRAMMAR || [];
  if (GR.mode === 'ex') return renderGex(v);
  const strip = h => h.replace(/<[^>]+>/g, ' ');
  const q = normalize(GR.q);
  const list = all.filter(g => (GR.lvl === 'all' || grLevels(g).includes(GR.lvl)) && (!q || normalize(g.title + ' ' + strip(g.html)).includes(q)));
  const groups = [...new Set(list.map(g => g.group))];
  v.innerHTML = `
    <div class="card col">
      <div class="row between"><div style="font-size:1.4rem;font-weight:800">📖 Gramática</div><button class="btn btn-grad small" id="gx-open">✏️ Ejercicios</button></div>
      <div class="seg" id="gr-lvl" style="align-self:flex-start">${[['all', 'Todos'], ...CEFR.map(l => [l, l])].map(([k, l]) => `<button data-l="${k}" class="${GR.lvl === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      <input class="search" id="gq" type="search" placeholder="Buscar: subjonctif, si, dont, futur…" value="${esc(GR.q)}">
      <div class="gram-index">${all.map(g => `<button data-g="${g.id}" class="${list.includes(g) ? '' : 'dim'}">${esc(g.title)}</button>`).join('')}</div>
    </div>
    ${groups.map(gr => `<div class="gram-group">${esc(gr)}</div>` + list.filter(g => g.group === gr).map(g => `
      <details class="card gram" id="g-${g.id}" ${GR.open === g.id || (q && list.length <= 3) ? 'open' : ''}>
        <summary>${esc(g.title)} ${grBadge(g)}</summary>
        <div class="gram-body">${g.html}</div>
        ${gexOf(g.id).length ? `<button class="btn btn-soft small" data-gxone="${g.id}" style="margin-top:12px">✏️ Practicar esta ficha (${gexOf(g.id).length})${gexPct(g.id) != null ? ` · ${gexPct(g.id)} %` : ''}</button>` : ''}
      </details>`).join('')).join('') || '<div class="card muted">Nada coincide con la búsqueda.</div>'}`;
  $('#gr-lvl', v).onclick = e => { const b = e.target.closest('button'); if (!b) return; GR.lvl = b.dataset.l; RENDER.grammar(); };
  $('#gx-open', v).onclick = () => { GR.mode = 'ex'; GX.running = false; RENDER.grammar(); window.scrollTo({ top: 0 }); };
  v.querySelectorAll('[data-gxone]').forEach(b => b.onclick = () => { GX.pick = [b.dataset.gxone]; gexStart([b.dataset.gxone]); });
  const gq = $('#gq', v);
  gq.addEventListener('input', e => { GR.q = e.target.value; const pos = e.target.selectionStart; RENDER.grammar(); const n = $('#gq'); n.focus(); n.setSelectionRange(pos, pos); });
  $('.gram-index', v).onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    const g0 = (window.GRAMMAR || []).find(x => x.id === b.dataset.g);
    if (g0 && GR.lvl !== 'all' && !grLevels(g0).includes(GR.lvl)) GR.lvl = 'all';
    GR.q = ''; GR.open = b.dataset.g; RENDER.grammar();
    const el = $(`#g-${b.dataset.g}`); if (el) { el.open = true; el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  };
  v.querySelectorAll('details.gram').forEach(d => d.addEventListener('toggle', () => { if (d.open) GR.open = d.id.slice(2); }));
};

// ------------------------------------------------------------------ DATA (settings, backup / sync)
function diagText() {
  return [
            `Navegador: ${navigator.userAgent}`,
            `App instalada (pantalla de inicio): ${matchMedia('(display-mode: standalone)').matches || navigator.standalone ? 'sí' : 'no'}`,
            `Voz elegida: ${frVoice ? frVoice.name + ' · ' + frVoice.lang : 'ninguna (por defecto)'}`,
            `Voces que no han sonado: ${[...badVoices].join(', ') || '—'}`,
            `Estado: ${synthState()}`, `Últimos eventos:`, ...(speechLog.length ? speechLog : ['(ninguno todavía)']),
            ``, `Todas las voces (${speechSynthesis.getVoices().length}):`,
            ...speechSynthesis.getVoices().map(v => `${/^fr/i.test(v.lang) ? '🇫🇷 ' : ''}${v.name} · ${v.lang}${v.localService === false ? ' · online' : ''}${v.default ? ' · por defecto' : ''}`),
          ].join('\n');
}
RENDER.data = function renderData() {
  updateHeader();
  const kb = Math.round((localStorage.getItem(STORAGE_KEY) || '').length / 1024), st = state.settings;
  $('#view-data').innerHTML = `
    <div class="card col">
      <div style="font-size:1.4rem;font-weight:800">⚙️ Ajustes</div>
      <div><label class="lbl">Objetivo diario (respuestas)</label>
        <div class="seg" id="goal-seg" style="margin-top:6px">${[10, 20, 30, 50].map(n => `<button data-g="${n}" class="${st.dailyGoal === n ? 'on' : ''}">${n}</button>`).join('')}</div></div>
      ${canSpeak ? `<label class="check"><input type="checkbox" id="auto-speak" ${st.autoSpeak ? 'checked' : ''}> Leer la respuesta en voz alta al comprobar</label>
        <div><label class="lbl">Voz francesa (${frVoices.length} en este dispositivo)</label>
          ${frVoices.length ? `<select class="search" id="voice-sel" style="margin-top:6px">${frVoices.map(v => `<option value="${esc(v.name)}" ${frVoice && v.name === frVoice.name ? 'selected' : ''}>${esc(v.name)} · ${esc(v.lang)}${v.localService === false ? ' · online' : ''}</option>`).join('')}</select>`
            : '<div class="muted small">No hay ninguna voz francesa instalada. Mira abajo cómo añadir una.</div>'}</div>
        <div><label class="lbl">Velocidad</label>
          <div class="seg" id="speed-seg" style="margin-top:6px">${[[.8, 'Lenta'], [.9, 'Algo lenta'], [1, 'Normal'], [1.1, 'Rápida']].map(([n, l]) => `<button data-sp="${n}" class="${voicePref.speed === n ? 'on' : ''}">${l}</button>`).join('')}</div></div>
        <div class="row"><button class="btn btn-soft" id="test-voice">🔊 Probar voz</button><button class="btn btn-ghost" id="test-default">🔊 Probar voz por defecto</button></div>
        <details class="voice-help" id="voice-diag"><summary>🩺 Diagnóstico de voz</summary>
          <div class="muted small" style="margin:8px 0">Pulsa «Probar voz» y luego abre esto. Si me mandas una captura, veo qué pasa.</div>
          <div class="diag">${esc(diagText())}</div>
          <button class="btn btn-soft small" id="diag-refresh" style="margin-top:8px">↻ Actualizar</button>
        </details>
        <details class="voice-help"><summary>¿Suena robótica? Cómo instalar una voz mejor</summary>
          <ul class="steps">
            <li><b>iPhone / iPad:</b> Ajustes → Accesibilidad → Contenido leído → Voces → Francés. Descarga una voz marcada como «mejorada» o «premium». Después cierra la app del todo, vuelve a abrirla y elígela aquí.</li>
            <li><b>Mac:</b> Ajustes del Sistema → Accesibilidad → Contenido leído → Voz del sistema → Gestionar voces → Francés. Descarga una voz «mejorada» o «premium» y reinicia el navegador.</li>
            <li><b>Windows:</b> abre la app en <b>Microsoft Edge</b>, que incluye voces «Natural» online muy buenas (por ejemplo, «Microsoft Denise Online (Natural)»). También puedes añadir voces en Configuración → Hora e idioma → Voz.</li>
            <li><b>Android / Chrome:</b> elige una voz «Google français». En Android, en Ajustes → Texto a voz → Motor de Google → Instalar datos de voz → Francés, descarga la voz de alta calidad.</li>
          </ul>
          <div class="muted small">Cada dispositivo tiene sus propias voces, así que la elección se guarda en cada uno por separado. Las voces «online» necesitan internet.</div>
        </details>`
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
      <div class="muted small">Borra el progreso y vuelve al mazo inicial (frases de ejemplo, tus apuntes, temas, módulos, básico y C1).</div>
      <div><button class="btn btn-diff" id="reset">Restablecer</button></div>
    </div>
    <div class="card col" style="margin-top:14px">
      <div class="row between"><b>Versión ${APP_VERSION}</b><button class="btn btn-soft small" id="check-update">🔄 Buscar actualización</button></div>
      <div class="muted small">Si has subido archivos nuevos a GitHub y no ves los cambios, pulsa aquí.</div>
    </div>`;
  $('#goal-seg').onclick = e => { const b = e.target.closest('button'); if (!b) return; st.dailyGoal = +b.dataset.g; st.updated = Date.now(); save(); RENDER.data(); };
  if ($('#auto-speak')) $('#auto-speak').onchange = e => { st.autoSpeak = e.target.checked; st.updated = Date.now(); save(); };
  bindSyncUi();
  if ($('#test-voice')) $('#test-voice').onclick = () => speak('Bonjour ! Je voudrais un croissant et un café, s’il vous plaît.');
  if ($('#test-default')) $('#test-default').onclick = () => { const keep = frVoice; frVoice = null; speak('Bonjour ! Ceci est la voix par défaut.'); frVoice = keep; };
  if ($('#diag-refresh')) $('#diag-refresh').onclick = () => { RENDER.data(); const d = $('#voice-diag'); if (d) { d.open = true; d.scrollIntoView({ block: 'start' }); } };
  if ($('#voice-sel')) $('#voice-sel').onchange = e => { voicePref.name = e.target.value; badVoices.delete(voicePref.name); saveVoicePref(); frVoice = frVoices.find(v => v.name === voicePref.name) || frVoice; speak('Bonjour ! Comment ça va ?'); };
  if ($('#speed-seg')) $('#speed-seg').onclick = e => { const b = e.target.closest('button'); if (!b) return; voicePref.speed = +b.dataset.sp; saveVoicePref(); RENDER.data(); speak('Bonjour ! Comment ça va ?'); };
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
    social: (local.social.updated || 0) >= (remote.social.updated || 0) ? local.social : remote.social,
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
    publishPublic().catch(() => {});
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
    Object.assign(SY, { token: '', gistId: '', last: 0, login: '', pubGistId: '', pubLast: 0, pubSig: '' }); saveSync(); syncError = ''; RENDER.data();
  };
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && SY.token && Date.now() - SY.last > 60000) syncNow(true);
  if (document.visibilityState === 'hidden' && syncTimer) syncNow(true);
});
window.addEventListener('online', () => syncNow(true));

// ------------------------------------------------------------------ FRIENDS (public stats gist + weekly ranking + trophies + 1v1 challenges)
// Each user publishes ONLY numbers (answers/correct per day, streak, challenges) in a public gist; friends read it.
const PUB_FILE = 'french_trainer_public.json';
const FR_CACHE_KEY = 'ft_friends_cache_v1';
let frCache = (() => { try { return JSON.parse(localStorage.getItem(FR_CACHE_KEY)) || {}; } catch { return {}; } })();
const saveFrCache = () => { try { localStorage.setItem(FR_CACHE_KEY, JSON.stringify(frCache)); } catch {} };
const FRS = { metric: 'ok', busy: false, pubError: '', target: 200, dur: 7 };
const touchSocial = () => { state.social.updated = Date.now(); save(); };
function dayStats() {
  const d = {};
  state.cards.forEach(c => c.history.forEach(h => { const x = d[h.date] = d[h.date] || { n: 0, ok: 0 }; x.n++; if (h.correct) x.ok++; }));
  return d;
}
function streakFrom(days) {
  const has = k => days[k] && days[k].n > 0, d = new Date();
  if (!has(isoOf(d))) d.setDate(d.getDate() - 1);
  let n = 0; while (has(isoOf(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
function weekStartIso(date = new Date()) { const x = new Date(date); x.setHours(12); x.setDate(x.getDate() - (x.getDay() + 6) % 7); return isoOf(x); }
function datesFrom(startIso, n) { const out = [], d = new Date(startIso + 'T12:00:00'); for (let i = 0; i < n; i++) { out.push(isoOf(d)); d.setDate(d.getDate() + 1); } return out; }
function isoWeekNo(iso) { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7); const y = new Date(d.getFullYear(), 0, 4); return 1 + Math.round(((d - y) / 864e5 - 3 + (y.getDay() + 6) % 7) / 7); }
function sumDays(days, dates) { let n = 0, ok = 0, active = 0; dates.forEach(k => { const x = days && days[k]; if (x && x.n) { n += x.n; ok += x.ok; active++; } }); return { n, ok, active }; }
function publicPayload() {
  const all = dayStats(), from = isoOf(new Date(Date.now() - 98 * 864e5)), days = {};
  Object.keys(all).filter(k => k >= from).forEach(k => { days[k] = all[k]; });
  const cutoff = isoOf(new Date(Date.now() - 30 * 864e5));
  return { app: 'french-trainer', v: 1, login: SY.login || '', name: state.social.name || SY.login || '', days,
    defis: Object.values(state.defis).reduce((a, l) => a + l.length, 0),
    challenges: state.social.challenges.filter(c => c.end >= cutoff) };
}
async function ensureLogin() { if (!SY.login && SY.token) { SY.login = (await gh('/user')).login; saveSync(); } return SY.login; }
async function publishPublic(force = false) {
  if (!SY.token || !state.social.publish) return;
  if (!force && Date.now() - (SY.pubLast || 0) < 5 * 60e3) return;
  try {
    await ensureLogin();
    const body = publicPayload(), sig = JSON.stringify(body);
    if (!force && sig === SY.pubSig) return;
    const content = JSON.stringify(Object.assign({ updated: Date.now() }, body));
    if (!SY.pubGistId) {
      const found = (await gh('/gists?per_page=100')).find(g => g.files && g.files[PUB_FILE]);
      if (found) SY.pubGistId = found.id;
    }
    if (SY.pubGistId) {
      try { await gh(`/gists/${SY.pubGistId}`, { method: 'PATCH', body: JSON.stringify({ files: { [PUB_FILE]: { content } } }) }); }
      catch (e) { if (e.status !== 404) throw e; SY.pubGistId = ''; }
    }
    if (!SY.pubGistId) {
      const g = await gh('/gists', { method: 'POST', body: JSON.stringify({ description: 'French Trainer · estadísticas públicas (solo números)', public: true, files: { [PUB_FILE]: { content } } }) });
      SY.pubGistId = g.id;
    }
    Object.assign(SY, { pubLast: Date.now(), pubSig: sig }); saveSync(); FRS.pubError = '';
  } catch (e) { console.error(e); FRS.pubError = e.message || 'Error de red'; }
}
async function unpublish() {
  try {
    if (!SY.pubGistId) { const f = (await gh('/gists?per_page=100')).find(g => g.files && g.files[PUB_FILE]); if (f) SY.pubGistId = f.id; }
    if (SY.pubGistId) await fetch(`https://api.github.com/gists/${SY.pubGistId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${SY.token}`, Accept: 'application/vnd.github+json' } });
  } catch (e) { console.error(e); }
  Object.assign(SY, { pubGistId: '', pubLast: 0, pubSig: '' }); saveSync();
}
async function fetchFriend(user) {
  const key = user.toLowerCase();
  try {
    const gists = await gh(`/users/${encodeURIComponent(user)}/gists?per_page=100`);
    const g = gists.find(x => x.files && x.files[PUB_FILE]);
    if (!g) { frCache[key] = { fetched: Date.now(), error: 'Todavía no publica sus estadísticas' }; return; }
    const full = await gh(`/gists/${g.id}`), f = full.files[PUB_FILE];
    const data = JSON.parse(f.truncated ? await (await fetch(f.raw_url)).text() : f.content);
    if (data.app !== 'french-trainer') throw new Error('Formato desconocido');
    frCache[key] = { fetched: Date.now(), data };
  } catch (e) {
    frCache[key] = { fetched: Date.now(), error: e.status === 404 ? 'No existe ese usuario de GitHub' : (e.message || 'Error de red'), data: (frCache[key] || {}).data };
  }
}
async function refreshFriends(force = false) {
  if (!SY.token || FRS.busy) return;
  const todo = state.social.friends.filter(u => force || !frCache[u.toLowerCase()] || Date.now() - frCache[u.toLowerCase()].fetched > 10 * 60e3);
  if (!todo.length) return;
  FRS.busy = true; if (activeTab === 'friends') RENDER.friends();
  try { await ensureLogin(); for (const u of todo) await fetchFriend(u); } catch (e) { console.error(e); }
  FRS.busy = false; saveFrCache(); if (activeTab === 'friends') RENDER.friends();
}
function people() {
  const me = { me: true, login: (SY.login || '').toLowerCase(), name: state.social.name || 'Tú', days: dayStats() };
  const fr = state.social.friends.map(u => { const c = frCache[u.toLowerCase()]; return c && c.data ? { login: u.toLowerCase(), name: c.data.name || u, days: c.data.days || {}, challenges: c.data.challenges || [], updated: c.data.updated } : null; }).filter(Boolean);
  return [me, ...fr];
}
function trophiesFor(p, group, weeks = 12) {
  const out = [], cur = weekStartIso();
  for (let i = 1; i <= weeks; i++) {
    const ws = isoOf(new Date(new Date(cur + 'T12:00:00').getTime() - i * 7 * 864e5)), dates = datesFrom(ws, 7), wk = isoWeekNo(ws);
    const s = sumDays(p.days, dates);
    const rivals = group.map(q => sumDays(q.days, dates)).filter(x => x.n > 0);
    if (rivals.length >= 2 && s.ok > 0 && s.ok >= Math.max(...rivals.map(x => x.ok))) out.push({ icon: '🥇', label: `Ganador/a · semana ${wk}` });
    if (s.active === 7) out.push({ icon: '🔥', label: `Semana perfecta · semana ${wk}` });
    if (s.n >= 50 && s.ok / s.n >= 0.9) out.push({ icon: '🎯', label: `90 % de aciertos · semana ${wk}` });
    if (s.n >= 300) out.push({ icon: '💪', label: `Maratón (300+) · semana ${wk}` });
  }
  return out;
}
function challengeState(c, group) {
  const by = l => group.find(p => p.login === (l || '').toLowerCase());
  const today = todayIso(), n = Math.round((new Date(c.end + 'T12:00:00') - new Date(c.start + 'T12:00:00')) / 864e5) + 1, dates = datesFrom(c.start, n);
  const prog = p => { if (!p) return null; let cum = 0, reached = null; for (const k of dates) { if (k > today) break; cum += ((p.days || {})[k] || {}).ok || 0; if (!reached && cum >= c.target) reached = k; } return { cum, reached, name: p.name }; };
  const a = prog(by(c.from)), b = prog(by(c.to));
  let winner = null, done = false;
  const ra = a && a.reached && a.reached < today ? a.reached : null, rb = b && b.reached && b.reached < today ? b.reached : null;
  if (ra || rb || today > c.end) {
    done = true;
    if (ra && rb) winner = ra < rb ? 'a' : rb < ra ? 'b' : a.cum > b.cum ? 'a' : b.cum > a.cum ? 'b' : 'tie';
    else if (ra) winner = 'a'; else if (rb) winner = 'b';
    else winner = !a || !b ? null : a.cum > b.cum ? 'a' : b.cum > a.cum ? 'b' : 'tie';
  }
  return { a, b, done, winner, daysLeft: Math.max(0, Math.round((new Date(c.end + 'T12:00:00') - new Date(today + 'T12:00:00')) / 864e5) + 1) };
}
function allChallenges(group) {
  const me = (SY.login || '').toLowerCase(), seen = new Set(), out = [];
  [...state.social.challenges, ...group.filter(p => !p.me).flatMap(p => (p.challenges || []).filter(c => (c.to || '').toLowerCase() === me))]
    .forEach(c => { if (!seen.has(c.id)) { seen.add(c.id); out.push(c); } });
  return out.sort((x, y) => (y.start || '').localeCompare(x.start || ''));
}
const agoText = t => { if (!t) return 'nunca'; const m = Math.round((Date.now() - t) / 60e3); return m < 1 ? 'ahora mismo' : m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.round(m / 60)} h` : `hace ${Math.round(m / 1440)} días`; };
RENDER.friends = function renderFriends() {
  updateHeader();
  const v = $('#view-friends'), so = state.social;
  if (!SY.token) {
    v.innerHTML = `<div class="card col"><div style="font-size:1.4rem;font-weight:800">👥 Amigos</div>
      <div class="muted">Para compartir estadísticas con tus amigos, primero conecta la sincronización con GitHub en <b>Datos → Sincronizar entre dispositivos</b>. Usa el mismo token.</div>
      <button class="btn btn-grad" id="go-data" style="align-self:flex-start">Ir a Datos</button></div>`;
    $('#go-data', v).onclick = () => showTab('data'); return;
  }
  refreshFriends(false);
  const group = people(), ws = weekStartIso(), wdates = datesFrom(ws, 7), today = todayIso();
  const daysLeft = 7 - wdates.indexOf(today);
  const metricLbl = { ok: 'aciertos', n: 'respuestas', active: 'días activos' };
  const rank = group.map(p => Object.assign({ p }, sumDays(p.days, wdates))).sort((a, b) => b[FRS.metric] - a[FRS.metric]);
  const max = Math.max(1, ...rank.map(r => r[FRS.metric]));
  const medal = i => ['🥇', '🥈', '🥉'][i] || `${i + 1}.`;
  const chs = allChallenges(group);
  const friendsWithData = group.filter(p => !p.me);
  v.innerHTML = `
    <div class="card col">
      <div class="row between"><div style="font-size:1.4rem;font-weight:800">👥 Amigos</div>
        <button class="btn btn-soft small" id="fr-refresh" ${FRS.busy ? 'disabled' : ''}>${FRS.busy ? 'Actualizando…' : '↻ Actualizar'}</button></div>
      <div class="muted small">Semana ${isoWeekNo(ws)} · ${daysLeft === 1 ? 'último día' : `quedan ${daysLeft} días`} · el ranking se reinicia cada lunes.</div>
      <div class="seg" id="fr-metric" style="align-self:flex-start">${Object.entries({ ok: '✓ Aciertos', n: '📝 Respuestas', active: '📅 Días' }).map(([k, l]) => `<button data-m="${k}" class="${FRS.metric === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div class="rank">${rank.map((r, i) => `
        <div class="rank-row ${r.p.me ? 'me' : ''}">
          <span class="rank-pos">${r[FRS.metric] ? medal(i) : '·'}</span>
          <span class="rank-name">${esc(r.p.name)}${r.p.me ? ' <span class="muted small">(tú)</span>' : ''}</span>
          <span class="rank-bar"><span style="width:${Math.round(100 * r[FRS.metric] / max)}%"></span></span>
          <span class="rank-val">${r[FRS.metric]}</span>
        </div>`).join('')}</div>
      ${friendsWithData.length ? '' : '<div class="muted small">Añade a alguien abajo para empezar a competir.</div>'}
    </div>

    <div class="card col" style="margin-top:14px">
      <div style="font-weight:800;font-size:1.1rem">📅 Hoy</div>
      ${group.map(p => { const t = (p.days || {})[today] || { n: 0, ok: 0 }; return `<div class="row between today-row"><span><b>${esc(p.name)}</b> <span class="muted small">🔥 ${streakFrom(p.days)}</span></span><span class="muted">${t.n} respuestas · ${t.ok} ✓${t.n ? ` · ${Math.round(100 * t.ok / t.n)} %` : ''}</span></div>`; }).join('')}
      ${friendsWithData.length ? `<div class="muted small">Datos de tus amigos: de su última sincronización.</div>` : ''}
    </div>

    <div class="card col" style="margin-top:14px">
      <div style="font-weight:800;font-size:1.1rem">⚔️ Retos</div>
      ${chs.length ? chs.map(c => {
        const s = challengeState(c, group), mine = (c.from || '').toLowerCase() === group[0].login;
        const bar = (x, who) => x ? `<div class="ch-line"><span>${esc(x.name)}</span><span class="rank-bar"><span style="width:${Math.min(100, Math.round(100 * x.cum / c.target))}%"></span></span><span class="rank-val">${x.cum}/${c.target}</span></div>` : `<div class="muted small">${esc(who)}: sin datos todavía</div>`;
        const res = !s.done ? `<span class="muted small">${s.daysLeft} ${s.daysLeft === 1 ? 'día' : 'días'} restantes</span>`
          : s.winner === 'tie' ? '<b>🤝 Empate</b>' : s.winner ? `<b>🏆 Gana ${esc((s.winner === 'a' ? s.a : s.b).name)}</b>` : '<span class="muted small">Terminado</span>';
        return `<div class="challenge ${s.done ? 'done' : ''}">
          <div class="row between"><b>${c.target} aciertos · del ${formatDate(c.start)} al ${formatDate(c.end)}</b>${mine ? `<button class="icon-btn" data-delch="${esc(c.id)}" title="Borrar reto">🗑</button>` : ''}</div>
          ${bar(s.a, c.from)}${bar(s.b, c.to)}
          <div>${res}</div></div>`;
      }).join('') : '<div class="muted small">Todavía no hay retos.</div>'}
      ${friendsWithData.length && so.publish ? `
        <details class="voice-help"><summary>＋ Nuevo reto</summary>
          <div class="col" style="margin-top:10px">
            <label class="lbl">Contra</label>
            <select class="field" id="ch-to">${friendsWithData.map(p => `<option value="${esc(p.login)}">${esc(p.name)} (@${esc(p.login)})</option>`).join('')}</select>
            <label class="lbl">Meta (aciertos)</label>
            <div class="seg" id="ch-target">${[100, 200, 300, 500].map(n => `<button data-n="${n}" class="${FRS.target === n ? 'on' : ''}">${n}</button>`).join('')}</div>
            <label class="lbl">Duración</label>
            <div class="seg" id="ch-dur">${[3, 7, 14].map(n => `<button data-d="${n}" class="${FRS.dur === n ? 'on' : ''}">${n} días</button>`).join('')}</div>
            <div class="muted small">Gana quien llegue antes a la meta; si nadie llega, quien tenga más aciertos al final.</div>
            <button class="btn btn-grad" id="ch-create" style="align-self:flex-start">⚔️ Lanzar reto</button>
          </div></details>` : friendsWithData.length ? '<div class="muted small">Activa «Publicar mis estadísticas» para poder lanzar retos.</div>' : ''}
    </div>

    <div class="card col" style="margin-top:14px">
      <div style="font-weight:800;font-size:1.1rem">🏆 Vitrina de trofeos</div>
      <div class="muted small">Se ganan cada semana (lunes a domingo): 🥇 más aciertos del grupo · 🔥 7 días seguidos · 🎯 90 % de aciertos (mín. 50) · 💪 300 respuestas o más.</div>
      ${group.map(p => { const t = trophiesFor(p, group); return `<div class="trophy-row"><b>${esc(p.name)}</b> ${t.length ? `<span class="trophies">${t.map(x => `<span title="${esc(x.label)}">${x.icon}</span>`).join('')}</span>` : '<span class="muted small">— todavía ninguno</span>'}
        ${p.me && t.length ? `<details><summary class="muted small">Ver detalle</summary><ul class="small">${t.map(x => `<li>${x.icon} ${esc(x.label)}</li>`).join('')}</ul></details>` : ''}</div>`; }).join('')}
    </div>

    <div class="card col" style="margin-top:14px">
      <div style="font-weight:800;font-size:1.1rem">🙋 Tu perfil</div>
      <div><label class="lbl">Apodo (lo que verán tus amigos)</label><input class="field" id="fr-name" maxlength="24" value="${esc(so.name)}" placeholder="${esc(SY.login || 'Tu apodo')}"></div>
      <label class="check"><input type="checkbox" id="fr-publish" ${so.publish ? 'checked' : ''}> Publicar mis estadísticas</label>
      <div class="muted small">Se publican en un Gist <b>público</b> de tu cuenta${SY.login ? ` (@${esc(SY.login)})` : ''}: tu apodo, respuestas y aciertos por día (últimas 14 semanas), retos orales hechos y tus retos. <b>Nunca tus tarjetas ni tus frases.</b> Cualquiera que conozca tu usuario podría verlo. Si lo desactivas, se borra.</div>
      ${so.publish ? `<div class="muted small">${FRS.pubError ? `⚠️ ${esc(FRS.pubError)}` : `Última publicación: ${agoText(SY.pubLast)}`}</div><button class="btn btn-soft small" id="fr-pub-now" style="align-self:flex-start">📤 Publicar ahora</button>` : ''}
    </div>

    <div class="card col" style="margin-top:14px">
      <div style="font-weight:800;font-size:1.1rem">➕ Amigos</div>
      <div class="row"><input class="field" id="fr-add" placeholder="Usuario de GitHub" autocapitalize="off" autocorrect="off" style="flex:1"><button class="btn btn-grad" id="fr-add-btn">Añadir</button></div>
      <div class="muted small">Tu amigo/a tiene que usar esta app con su propia cuenta de GitHub y activar «Publicar mis estadísticas».</div>
      ${so.friends.map(u => { const c = frCache[u.toLowerCase()] || {}; return `<div class="row between friend-row"><span><b>@${esc(u)}</b> <span class="muted small">${c.error ? `⚠️ ${esc(c.error)}` : c.data ? `· ${esc(c.data.name || u)} · actualizado ${agoText(c.data.updated)}` : '· cargando…'}</span></span><button class="icon-btn" data-delfr="${esc(u)}" title="Quitar">✕</button></div>`; }).join('')}
    </div>`;

  $('#fr-refresh', v).onclick = async () => { await publishPublic(true); refreshFriends(true); };
  $('#fr-metric', v).onclick = e => { const b = e.target.closest('button'); if (!b) return; FRS.metric = b.dataset.m; RENDER.friends(); };
  $('#fr-name', v).onchange = e => { so.name = e.target.value.trim().slice(0, 24); touchSocial(); publishPublic(true).then(() => activeTab === 'friends' && RENDER.friends()); };
  $('#fr-publish', v).onchange = async e => {
    if (e.target.checked) { so.publish = true; touchSocial(); toast('Publicando…'); await publishPublic(true); toast(FRS.pubError ? `⚠️ ${FRS.pubError}` : '📤 Estadísticas publicadas'); }
    else { if (!confirm('¿Dejar de publicar? Se borrará tu Gist público de estadísticas y tus amigos dejarán de verte.')) { e.target.checked = true; return; } so.publish = false; touchSocial(); await unpublish(); toast('Estadísticas retiradas'); }
    RENDER.friends();
  };
  if ($('#fr-pub-now', v)) $('#fr-pub-now', v).onclick = async () => { await publishPublic(true); toast(FRS.pubError ? `⚠️ ${FRS.pubError}` : '📤 Publicado'); RENDER.friends(); };
  $('#fr-add-btn', v).onclick = async () => {
    const u = $('#fr-add', v).value.trim().replace(/^@/, '');
    if (!/^[a-z\d](?:[a-z\d-]{0,38})$/i.test(u)) return toast('Escribe un usuario de GitHub válido');
    if (u.toLowerCase() === (SY.login || '').toLowerCase()) return toast('Ese usuario eres tú 🙂');
    if (so.friends.some(x => x.toLowerCase() === u.toLowerCase())) return toast('Ya está en tu lista');
    so.friends.push(u); touchSocial(); delete frCache[u.toLowerCase()]; RENDER.friends(); await refreshFriends(true);
    const c = frCache[u.toLowerCase()]; toast(c && c.data ? `👥 ${c.data.name || u} añadido/a` : `Añadido. ${c && c.error ? c.error : ''}`);
  };
  v.querySelectorAll('[data-delfr]').forEach(b => b.onclick = () => { if (!confirm(`¿Quitar a @${b.dataset.delfr}?`)) return; so.friends = so.friends.filter(x => x !== b.dataset.delfr); touchSocial(); RENDER.friends(); });
  v.querySelectorAll('[data-delch]').forEach(b => b.onclick = () => { if (!confirm('¿Borrar este reto?')) return; so.challenges = so.challenges.filter(c => c.id !== b.dataset.delch); touchSocial(); publishPublic(true); RENDER.friends(); });
  const tg = $('#ch-target', v); if (tg) tg.onclick = e => { const b = e.target.closest('button'); if (!b) return; FRS.target = +b.dataset.n; v.querySelectorAll('#ch-target button').forEach(x => x.classList.toggle('on', x === b)); };
  const du = $('#ch-dur', v); if (du) du.onclick = e => { const b = e.target.closest('button'); if (!b) return; FRS.dur = +b.dataset.d; v.querySelectorAll('#ch-dur button').forEach(x => x.classList.toggle('on', x === b)); };
  const cc = $('#ch-create', v); if (cc) cc.onclick = async () => {
    await ensureLogin().catch(() => {});
    const start = todayIso(), end = datesFrom(start, FRS.dur)[FRS.dur - 1];
    so.challenges.push({ id: uid(), from: (SY.login || '').toLowerCase(), to: $('#ch-to', v).value, target: FRS.target, start, end, created: Date.now() });
    touchSocial(); toast('⚔️ Reto lanzado'); await publishPublic(true); RENDER.friends();
  };
};

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
