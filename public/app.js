// ---------- helpers ----------
const $ = (s) => document.querySelector(s);
const api = async (path, opts = {}) => {
  const r = await fetch(path, {
    ...opts,
    headers: opts.body && !(opts.body instanceof FormData) ? { 'Content-Type': 'application/json' } : undefined,
  });
  if (r.status === 204) return null;
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `Request failed (${r.status})`);
  return data;
};
const local = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};
const SVGNS = 'http://www.w3.org/2000/svg';
const svgEl = (tag, attrs) => { const e = document.createElementNS(SVGNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
const isTyping = (e) => e.target instanceof Element && e.target.matches('input, textarea, select');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- ghostwriting: formulas write themselves on the desk, then fade ----------
const FORMULAS = ['E = mc²', '∫ f(x) dx', 'O(n log n)', 'a² + b² = c²', 'Σ 1/n² = π²/6', 'PV = nRT', 'λ = h / p', "f'(x) = lim h→0",
  'F = ma', 'sin²θ + cos²θ = 1', 'T(n) = 2T(n/2) + n', '∇·E = ρ/ε₀', 'ΔG = ΔH − TΔS', 'e^(iπ) + 1 = 0', 'x = (−b ± √Δ) / 2a',
  'C₆H₁₂O₆ + 6O₂', 'P(A|B) = P(B|A)P(A)/P(B)', 'V = IR', 'log₂ 1024 = 10', 'dy/dx = ky'];
const board = $('#ghostwriting');
function ghostwrite() {
  if (document.hidden || board.childElementCount > 5) return;
  const s = document.createElement('span');
  s.textContent = FORMULAS[Math.floor(Math.random() * FORMULAS.length)];
  const size = 18 + Math.random() * 26;
  s.style.fontSize = `${size}px`;
  s.style.left = `${Math.random() * 85}vw`;
  s.style.top = `${Math.random() * 92}vh`;
  s.style.rotate = `${(Math.random() - 0.5) * 10}deg`;
  s.style.setProperty('--dur', `${8 + Math.random() * 5}s`);
  s.addEventListener('animationend', () => s.remove());
  board.append(s);
}
if (reduced) for (let i = 0; i < 5; i++) ghostwrite();
else { for (let i = 0; i < 3; i++) setTimeout(ghostwrite, i * 900); setInterval(ghostwrite, 2600); }

// ---------- dust drifting through the lamp light ----------
const dust = $('#dust');
for (let i = 0; i < (reduced ? 0 : 16); i++) {
  const m = document.createElement('i');
  m.style.left = `${Math.random() * 55}vw`;
  m.style.top = `${10 + Math.random() * 70}vh`;
  m.style.setProperty('--d', `${14 + Math.random() * 16}s`);
  m.style.setProperty('--dx', `${(Math.random() - 0.3) * 120}px`);
  m.style.setProperty('--dy', `${-60 - Math.random() * 160}px`);
  m.style.setProperty('--o', (0.25 + Math.random() * 0.55).toFixed(2));
  m.style.animationDelay = `${-Math.random() * 20}s`;
  const s = 1.5 + Math.random() * 2.5;
  m.style.width = m.style.height = `${s}px`;
  dust.append(m);
}

// ---------- stationery on the desk ----------
{ // ruler markings
  const g = $('#rulerTicks');
  for (let i = 0; i <= 30; i++) g.append(svgEl('line', { x1: i * 10, y1: 0, x2: i * 10, y2: i % 5 ? 7 : 13 }));
}

// every wrong answer becomes a crumpled ball tossed onto the desk
let crumpled = 0;
function crumple() {
  if (crumpled >= 9) return;
  const b = document.createElement('b');
  const s = 26 + Math.random() * 20;
  b.style.width = b.style.height = `${s}px`;
  const edge = Math.random() < 0.35;
  b.style.left = edge ? `${0.5 + Math.random() * 4}vw` : `${12 + Math.random() * 58}vw`;
  b.style.top = edge ? `${24 + Math.random() * 55}vh` : `${78 + Math.random() * 14}vh`;
  b.style.rotate = `${Math.random() * 360}deg`;
  $('#crumples').append(b);
  crumpled++;
}

// the cat does a lap of the desk now and then
const cat = $('#cat');
function prowl() {
  if (reduced || document.hidden || cat.classList.contains('go')) return;
  cat.classList.add('go');
  setTimeout(() => cat.classList.remove('go'), 17_500);
}
setInterval(() => Math.random() < 0.4 && prowl(), 110_000);
setTimeout(prowl, 50_000);

// ---------- theme: lamp (night) / daylight ----------
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  $('#themeBtn').textContent = t === 'day' ? 'lamp on' : 'lamp off';
}
applyTheme(local.get('theme') || (matchMedia('(prefers-color-scheme: light)').matches ? 'day' : 'night'));
$('#themeBtn').onclick = () => {
  const next = document.documentElement.dataset.theme === 'day' ? 'night' : 'day';
  local.set('theme', next);
  applyTheme(next);
};

// ---------- the ghost in the margin ----------
const ghost = $('#ghost');
const MOUTHS = { happy: 'M25 41q7 7 14 0', sad: 'M27 45q5 -4 10 0', thinking: 'M28 43q4 1 8 -1', idle: 'M27 42q5 4 10 0' };
let typing = null;
function mood(m, text) {
  ghost.classList.remove('happy', 'sad', 'thinking');
  if (m !== 'idle') { void ghost.getBBox(); ghost.classList.add(m); }
  ghost.querySelector('.g-mouth').setAttribute('d', MOUTHS[m] ?? MOUTHS.idle);
  if (text) write($('#speech'), text);
}
function write(el, text) { // handwriting appears letter by letter
  clearInterval(typing);
  if (reduced) { el.textContent = text; return; }
  let i = 0;
  el.textContent = '';
  typing = setInterval(() => {
    el.textContent = text.slice(0, ++i);
    if (i >= text.length) clearInterval(typing);
  }, 18);
}

// spiral binding rings, drawn to fit whatever height the page is
const binding = $('.binding');
for (let i = 0; i < 16; i++) binding.append(document.createElement('i'));

// the ghost occasionally wanders out of the margin and across the room
const roamer = $('#roamer');
roamer.innerHTML = ghost.innerHTML;
roamer.querySelector('.g-mouth')?.setAttribute('d', 'M27 43q5 3 10 0');
function roam() {
  if (reduced || document.hidden || roamer.classList.contains('go')) return;
  roamer.style.top = `${25 + Math.random() * 45}vh`;
  roamer.classList.add('go');
  setTimeout(() => roamer.classList.remove('go'), 9200);
}
setInterval(() => Math.random() < 0.45 && roam(), 75_000);
setTimeout(roam, 25_000);

// red ink soaking into the paper where a wrong answer sat
function bleed(el) {
  if (reduced || !el) return;
  const r = el.getBoundingClientRect();
  const blot = $('#blot');
  blot.classList.remove('go');
  blot.style.left = `${r.left + 18}px`;
  blot.style.top = `${r.top + r.height / 2}px`;
  void blot.offsetWidth;
  blot.classList.add('go');
}

// ---------- tabs ----------
document.querySelectorAll('.dividers button').forEach((b) => {
  b.onclick = () => {
    document.querySelectorAll('.dividers button').forEach((x) => {
      x.classList.toggle('active', x === b);
      x.setAttribute('aria-selected', x === b);
    });
    const old = $('.panel.active');
    const next = $(`#tab-${b.dataset.tab}`);
    if (old && old !== next && !reduced) {
      const leaf = old;
      leaf.classList.remove('active');
      leaf.classList.add('leaving');
      leaf.addEventListener('animationend', () => leaf.classList.remove('leaving'), { once: true });
      setTimeout(() => leaf.classList.remove('leaving'), 600); // belt and braces
    } else if (old) old.classList.remove('active');
    document.querySelectorAll('.panel').forEach((p) => p.classList.toggle('active', p === next));
    local.set('tab', b.dataset.tab);
    if (b.dataset.tab === 'progress') loadProgress();
    if (b.dataset.tab === 'plan') loadPlan();
  };
});
const goTab = (t) => document.querySelector(`.dividers [data-tab="${t}"]`).click();

// ---------- profile + notes ----------
let profile = null;
async function loadProfile() {
  profile = await api('/api/profile');
  $('#pName').value = profile.name === 'Friend' ? '' : profile.name;
  $('#pSubject').value = profile.subject === 'My subject' ? '' : profile.subject;
  $('#pExam').value = profile.examDate ?? '';
  ($(`.mood input[value="${profile.persona}"]`) ?? $('.mood input')).checked = true;
  const streak = profile.streak ?? 0;
  $('#streak').innerHTML = `streak <b>${streak}</b> night${streak === 1 ? '' : 's'}`;
  $('#topicList').innerHTML = profile.topics.map((t) => `<li>${esc(t)}</li>`).join('') || '<li class="muted">none yet</li>';
  $('#plateName').textContent = profile.name === 'Friend' ? '—' : profile.name;
  $('#plateSubject').textContent = profile.subject === 'My subject' ? 'no subject yet' : profile.subject;
  const has = profile.topics.length > 0;
  $('#startHint').innerHTML = has
    ? `${profile.topics.length} topics in the notebook. I'll start with whichever you're weakest at.`
    : 'Start in <b>Notes</b>: paste what you\'re studying.';
  const named = profile.name !== 'Friend';
  const subjected = profile.subject !== 'My subject';
  $('#kicker').textContent = [
    named ? `${profile.name}'s notebook` : 'Notebook',
    subjected ? profile.subject : 'no subject yet',
    profile.examDate ? `exam ${new Date(`${profile.examDate}T00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}` : null,
  ].filter(Boolean).join(' · ');
  const nudge = (profile.nudges ?? []).filter((n) => !n.seen).at(-1);
  $('#nudge').hidden = !nudge;
  if (nudge) {
    $('#nudgeText').textContent = nudge.text;
    $('#nudgePlay').onclick = () => speak(nudge.text);
  }
  loadDesk();
}
async function saveProfile() {
  await api('/api/profile', { method: 'POST', body: JSON.stringify({
    name: $('#pName').value.trim() || 'Friend', subject: $('#pSubject').value.trim() || 'My subject',
    examDate: $('#pExam').value || null, persona: $('.mood input:checked')?.value ?? 'gentle',
  }) });
  await loadProfile();
}
$('#saveProfile').onclick = async () => {
  await saveProfile();
  mood('happy', profile.persona === 'roast' ? `Noted, ${profile.name}. I will not be gentle.` : `Nice to meet you, ${profile.name}.`);
};
$('#nudgeClose').onclick = async () => { $('#nudge').hidden = true; await api('/api/nudge/dismiss', { method: 'POST' }); };
$('#notesFile').onchange = async (e) => { const f = e.target.files[0]; if (f) $('#notesText').value = await f.text(); };
$('#sampleBtn').onclick = async () => {
  $('#notesText').value = await (await fetch('sample-notes.md')).text();
  if (!$('#pSubject').value) $('#pSubject').value = 'Data Structures';
};
$('#uploadBtn').onclick = async () => {
  const btn = $('#uploadBtn');
  btn.disabled = true; btn.textContent = 'Reading…';
  $('#chomp').hidden = false;
  try {
    await saveProfile();
    const res = await api('/api/notes', { method: 'POST', body: JSON.stringify({ text: $('#notesText').value }) });
    $('#notesText').value = '';
    await loadProfile();
    mood('happy', `Read ${res.chunks} passages across ${res.topics.length} topics. Whenever you're ready.`);
    goTab('study');
  } catch (e) { mood('sad', e.message); goTab('study'); }
  $('#chomp').hidden = true;
  btn.disabled = false; btn.textContent = 'Add to notebook';
};
$('#clearNotes').onclick = async () => {
  if (!confirm('Erase all notes? Your quiz history stays.')) return;
  await api('/api/notes', { method: 'DELETE' });
  await loadProfile();
};

// ---------- voice ----------
let voiceMode = 'browser';
let audio = null;
async function speak(text) {
  audio?.pause();
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  if (voiceMode === 'elevenlabs') {
    try {
      const r = await fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
      if (r.status === 200) { audio = new Audio(URL.createObjectURL(await r.blob())); return audio.play(); }
    } catch { /* browser voice below */ }
  }
  if ('speechSynthesis' in window) {
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.97;
    speechSynthesis.speak(u);
  }
}
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
function matchSpoken(said, options) {
  const s = said.toLowerCase().trim();
  const letter = s.match(/\b(?:option\s*)?([abcd])\b/);
  if (letter) return 'abcd'.indexOf(letter[1]);
  const w = ['first', 'second', 'third', 'fourth'].findIndex((x) => s.includes(x));
  if (w >= 0) return w;
  let best = -1, bestScore = 0;
  options.forEach((o, i) => {
    const ow = o.toLowerCase().split(/\W+/).filter((x) => x.length > 2);
    const score = ow.filter((x) => s.includes(x)).length / (ow.length || 1);
    if (score > bestScore) { bestScore = score; best = i; }
  });
  return bestScore >= 0.5 ? best : -1;
}
$('#micBtn').onclick = () => {
  if (!question || answered) return;
  if (!Recognition) { mood('sad', "This browser can't hear me. Chrome or Edge can. Tap an answer instead."); return; }
  const rec = new Recognition();
  rec.lang = 'en-IN';
  $('#micBtn').classList.add('listening'); $('#micBtn').textContent = 'listening…';
  rec.onresult = (e) => {
    const said = e.results[0][0].transcript;
    const i = matchSpoken(said, question.options);
    if (i >= 0) answer(i); else mood('thinking', `I heard "${said}". Say A, B, C or D?`);
  };
  rec.onend = () => { $('#micBtn').classList.remove('listening'); $('#micBtn').textContent = 'answer by voice'; };
  rec.start();
};
$('#speakBtn').onclick = () => question && speak(`${question.question}. ${question.options.map((o, i) => `${'ABCD'[i]}: ${o}`).join('. ')}`);

// ---------- quiz ----------
let question = null, shownAt = 0, answered = false;
const SOURCE = { gemma: 'written by Gemma', cloze: 'offline · from your notes' };
const LEVEL = ['', '2B · recall', 'HB · understand', '4H · apply']; // pencil grades: soft is easy, hard is hard
let run = 0; // correct answers in a row this sitting
async function nextQuestion(topic) {
  mood('thinking', 'Looking through your notes…');
  $('#startBtn').disabled = true;
  try {
    question = await api('/api/quiz/next', { method: 'POST', body: JSON.stringify(topic ? { topic } : {}) });
  } catch (e) {
    mood('sad', e.message);
    $('#startBtn').disabled = false;
    return;
  }
  answered = false; shownAt = performance.now();
  $('#startCard').hidden = true; $('#quizCard').hidden = false;
  $('#qTopic').textContent = question.topic;
  $('#qDiff').textContent = LEVEL[question.difficulty] ?? '';
  $('#qSource').textContent = SOURCE[question.source] ?? question.source;
  $('#qRun').textContent = run >= 2 ? `${run} in a row` : '';
  $('#qText').textContent = question.question;
  $('#qOptions').innerHTML = question.options.map((o, i) =>
    `<li><button data-i="${i}"><span class="letter">${'ABCD'[i]}</span><span class="text">${esc(o)}</span></button></li>`).join('');
  document.querySelectorAll('#qOptions button').forEach((b) => (b.onclick = () => answer(Number(b.dataset.i))));
  $('#feedback').hidden = true; $('#nextBtn').hidden = true;
  mood('idle', ['Take your time.', 'You know this one.', 'Read it twice, answer once.'][Math.floor(Math.random() * 3)]);
  $('#startBtn').disabled = false;
}
async function answer(i) {
  if (answered) return;
  answered = true;
  const buttons = [...document.querySelectorAll('#qOptions button')];
  buttons.forEach((b) => (b.disabled = true));
  const res = await api('/api/quiz/answer', { method: 'POST', body: JSON.stringify({ id: question.id, choice: i, ms: Math.round(performance.now() - shownAt) }) });
  buttons.forEach((b, j) => b.classList.add(j === res.answer ? 'right' : j === i ? 'wrong' : 'dim'));
  run = res.correct ? run + 1 : 0;
  if (!res.correct) { bleed(buttons[i]); crumple(); }
  if (res.correct && res.streak && res.streak % 5 === 0) roam();
  mood(res.correct ? 'happy' : 'sad', res.reaction);
  speak(res.reaction);
  if (res.explanation) { $('#feedback').textContent = res.explanation; $('#feedback').hidden = false; }
  $('#streak').innerHTML = `streak <b>${res.streak}</b> night${res.streak === 1 ? '' : 's'}`;
  $('#nextBtn').hidden = false;
  $('#nextBtn').focus();
  loadDesk();
}
$('#startBtn').onclick = () => nextQuestion();
$('#nextBtn').onclick = () => nextQuestion();
addEventListener('keydown', (e) => {
  if (!$('#tab-study').classList.contains('active') || $('#quizCard').hidden || isTyping(e)) return;
  const k = 'abcd1234'.indexOf(e.key.toLowerCase());
  if (k >= 0 && !answered) answer(k % 4);
  if (e.key === 'Enter' && answered) nextQuestion();
});

// ---------- report card ----------
async function loadProgress() {
  const p = await api('/api/progress');
  $('#scoreNum').textContent = p.score === null || !p.total ? '–' : p.score;
  const circle = $('.circle-mark');
  circle.classList.remove('drawn'); void circle.getBBox(); if (p.total) circle.classList.add('drawn');
  const engine = { 'tabpfn-client': 'TabPFN (Prior Labs cloud)', 'tabpfn-local': 'TabPFN, running locally', 'beta-posterior': 'a mastery estimate' }[p.engine] ?? p.engine;
  $('#engineNote').textContent = p.total ? `From ${p.total} answers, predicted by ${engine}. ${p.note ?? ''}` : 'Answer a few questions first.';
  // the ghost stamps the report card like a tired teacher
  const stamp = $('#stamp');
  stamp.hidden = !p.total;
  if (p.total) {
    const verdict = p.score >= 75 ? 'READY' : p.score >= 55 ? 'NEARLY THERE' : p.score >= 35 ? 'NEEDS WORK' : 'SEE ME AFTER CLASS';
    $('#stampText').textContent = verdict;
    stamp.classList.toggle('pass', p.score >= 75);
    stamp.style.animation = 'none'; void stamp.offsetWidth; stamp.style.animation = '';
  }
  const rows = [...p.perTopic].sort((a, b) => a.predicted - b.predicted);
  $('#masteryList').innerHTML = rows.map((t) => `
    <tr>
      <td class="t">${esc(t.topic)}<br><span class="n">${t.attempts ? `${t.correct}/${t.attempts} right · ${t.daysSince < 1 ? 'today' : `${Math.round(t.daysSince)}d ago`}` : 'not tried yet'}</span></td>
      <td class="bar"><div class="hatch"><i style="width:${Math.round(t.predicted * 100)}%"></i></div></td>
      <td class="pct" style="color:${t.predicted < 0.5 ? 'var(--red)' : t.predicted >= 0.75 ? 'var(--green)' : 'var(--ink)'}">${Math.round(t.predicted * 100)}</td>
      <td class="acts"><button class="text-btn mono" data-drill="${esc(t.topic)}">drill</button>${status?.search ? `<button class="text-btn mono" data-web="${esc(t.topic)}">web</button>` : ''}</td>
    </tr>`).join('') || '<tr><td class="muted">No topics yet.</td></tr>';
  document.querySelectorAll('[data-drill]').forEach((b) => (b.onclick = () => { goTab('study'); nextQuestion(b.dataset.drill); }));
  document.querySelectorAll('[data-web]').forEach((b) => (b.onclick = () => loadPractice(b.dataset.web)));
}
async function loadPractice(topic) {
  $('#practiceCard').hidden = false;
  $('#practiceTopic').textContent = topic;
  $('#practiceList').innerHTML = '<li class="muted">searching…</li>';
  const links = await api(`/api/practice?topic=${encodeURIComponent(topic)}`);
  $('#practiceList').innerHTML = links.map((l) => `<li><a href="${esc(l.link)}" target="_blank" rel="noopener">${esc(l.title)}</a><br><span class="small muted">${esc(l.snippet)}</span></li>`).join('') || '<li class="muted">Nothing found.</li>';
}

// ---------- plan ----------
async function loadPlan() {
  const p = await api('/api/plan');
  $('#planTitle').textContent = p.daysLeft ? `${p.daysLeft} day${p.daysLeft > 1 ? 's' : ''} to the exam` : 'This week';
  $('#planList').innerHTML = p.plan.map((d, i) => {
    const dt = new Date(`${d.date}T00:00`);
    const mock = /mock/i.test(d.kind);
    const done = i === 0 && (desk?.today?.answered ?? 0) >= (desk?.goal ?? 20);
    return `<tr class="${i === 0 ? 'today' : ''} ${mock ? 'mock' : ''} ${done ? 'done' : ''}">
      <td class="day">${dt.toLocaleDateString(undefined, { weekday: 'short' })} ${dt.getDate()}<small>${i === 0 ? 'tonight' : dt.toLocaleDateString(undefined, { month: 'short' })}</small></td>
      <td class="focus">${d.focus.map(esc).join(', ') || '<span class="muted">add notes first</span>'}</td>
      <td class="kind">${esc(d.kind.toLowerCase())}<br>${d.minutes} min</td></tr>`;
  }).join('');
}

// ---------- ask ----------
const history = [];
$('#chatForm').onsubmit = async (e) => {
  e.preventDefault();
  const text = $('#chatInput').value.trim();
  if (!text) return;
  $('#chatInput').value = '';
  const log = $('#chatLog');
  log.insertAdjacentHTML('beforeend', `<p class="msg me-msg">${esc(text)}</p><p class="msg ghost-msg" id="pending"><span class="pen"><i></i><i></i><i></i></span></p>`);
  log.scrollTop = log.scrollHeight;
  try {
    const res = await api('/api/chat', { method: 'POST', body: JSON.stringify({ message: text, history }) });
    history.push({ role: 'user', content: text }, { role: 'assistant', content: res.text });
    $('#pending').outerHTML = `<p class="msg ghost-msg">${esc(res.text)}<span class="via">${res.via === 'mastra-agent' ? 'mastra agent · gemma' : 'searched your notes'}</span></p>`;
  } catch (err) {
    $('#pending').outerHTML = `<p class="msg ghost-msg">${esc(err.message)}</p>`;
  }
  log.scrollTop = log.scrollHeight;
};

// ---------- desk widgets ----------

// clock
for (let i = 0; i < 12; i++) {
  const a = (i * Math.PI) / 6, r1 = i % 3 ? 40 : 36;
  $('#ticks').append(svgEl('line', { x1: 50 + Math.sin(a) * r1, y1: 50 - Math.cos(a) * r1, x2: 50 + Math.sin(a) * 43, y2: 50 - Math.cos(a) * 43 }));
}
function tickClock() {
  const d = new Date();
  const s = d.getSeconds(), m = d.getMinutes() + s / 60, h = (d.getHours() % 12) + m / 60;
  $('#hS').setAttribute('transform', `rotate(${s * 6} 50 50)`);
  $('#hM').setAttribute('transform', `rotate(${m * 6} 50 50)`);
  $('#hH').setAttribute('transform', `rotate(${h * 30} 50 50)`);
  const hr = d.getHours();
  $('#clockLabel').textContent = hr >= 23 || hr < 5 ? 'past midnight · sleep soon' : hr >= 18 ? 'evening study' : hr < 12 ? 'morning study' : 'afternoon study';
}
tickClock();
setInterval(tickClock, 1000);

// little sketches the ghost leaves down the margin, one per topic
const DOODLE = {
  star: 'M50 4l6 17h18l-15 11 6 18-15-11-15 11 6-18-15-11h18z',
  spiral: 'M50 30c-9 0-14-6-11-12 3-5 13-5 16 2 4 9-5 18-16 18-13 0-22-11-18-23',
  squiggle: 'M24 14c8-12 14 10 22 0s14 10 22 0M30 36c10 6 22 6 32 0',
  tick: 'M26 22l12 14 30-30',
  skull: 'M34 18c0-9 7-14 16-14s16 5 16 14c0 7-4 10-4 15H38c0-5-4-8-4-15zM42 20a4 4 0 108 0 4 4 0 10-8 0zM54 20a4 4 0 108 0 4 4 0 10-8 0z',
};
function drawDoodles(topics) {
  const svg = $('#doodles');
  const want = topics.map((t) => {
    if (!t.attempts) return null;
    if (t.mastery >= 0.75 && t.attempts >= 3) return 'star';
    if (t.mastery < 0.4) return 'skull';
    if (t.mastery < 0.6) return 'squiggle';
    return 'tick';
  });
  const key = want.join(',');
  if (svg.dataset.key === key) return;
  svg.dataset.key = key;
  svg.innerHTML = '';
  want.forEach((kind, i) => {
    if (!kind) return;
    const p = svgEl('path', { d: DOODLE[kind], transform: `translate(0 ${i * 88}) scale(0.62) rotate(${(i % 2 ? 7 : -9)} 50 24)` });
    if (kind === 'skull' || kind === 'squiggle') p.classList.add('ink');
    if (!reduced) { p.classList.add('drawn'); p.style.setProperty('--len', 320); p.style.animationDelay = `${i * 0.25}s`; }
    svg.append(p);
  });
}

// coffee rings soak into the desk, one per five questions today
let ringCount = 0;
function soakRings(n) {
  const want = Math.min(Math.floor(n / 5), 6);
  for (; ringCount < want; ringCount++) {
    const b = document.createElement('b');
    const size = 54 + Math.random() * 46;
    b.style.width = b.style.height = `${size}px`;
    // keep them on open desk: the bottom band below the notebook, or the far-left edge
    const edge = Math.random() < 0.3;
    b.style.left = edge ? `${0.5 + Math.random() * 4}vw` : `${10 + Math.random() * 62}vw`;
    b.style.top = edge ? `${20 + Math.random() * 55}vh` : `${74 + Math.random() * 18}vh`;
    b.style.animationDelay = `${ringCount * 0.1}s`;
    $('#rings').append(b);
  }
}

// calendar, mug, sticky, week, tally
let desk = null;
async function loadDesk() {
  try { desk = await api('/api/desk'); } catch { return; }
  // calendar
  if (desk.daysLeft === null) { $('#calNum').textContent = '?'; $('#calSub').textContent = 'set an exam date'; $('#calMonth').textContent = 'EXAM'; }
  else {
    $('#calNum').textContent = Math.max(desk.daysLeft, 0);
    $('#calSub').textContent = desk.daysLeft > 1 ? 'days to exam' : desk.daysLeft === 1 ? 'day to exam' : 'exam day';
    $('#calMonth').textContent = new Date(`${desk.examDate}T00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }).toUpperCase();
  }
  // the desk gets tense in the last three days
  document.body.classList.toggle('crunch', desk.daysLeft !== null && desk.daysLeft <= 3 && desk.daysLeft >= 0);
  // mug fills toward the daily goal
  const n = desk.today.answered, frac = Math.min(n / desk.goal, 1);
  const h = Math.round(frac * 60);
  $('#coffee').setAttribute('y', 104 - h); $('#coffee').setAttribute('height', h);
  $('.mug').classList.toggle('empty', n === 0);
  soakRings(n);
  drawDoodles(desk.topics);
  $('#ribbon').style.height = `${90 + frac * 150}px`;
  $('#mugNum').textContent = n; $('#mugGoal').textContent = desk.goal;
  $('#mugAcc').textContent = n ? `${Math.round((desk.today.correct / n) * 100)}% right` : 'nothing yet';
  // tonight's checklist on the study page
  const hr = new Date().getHours();
  $('#tonightTitle').textContent = hr >= 17 || hr < 4 ? 'Tonight' : 'Today';
  $('#tonightDate').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });
  $('#checklist').innerHTML = desk.topics.map((t) => {
    const done = t.attempts >= 3 && t.mastery >= 0.75, weak = t.attempts > 0 && t.mastery < 0.5;
    return `<li class="${done ? 'done' : weak ? 'weak' : ''}"><span class="box"></span><span class="name">${esc(t.topic)}</span><span class="pct">${t.attempts ? `${Math.round(t.mastery * 100)}%` : 'new'}</span></li>`;
  }).join('');
  // sticky
  if (desk.weakest) {
    $('#nextTopic').textContent = `${desk.weakest.topic}: ${Math.round(desk.weakest.mastery * 100)}%`;
    $('#nextDrill').hidden = false;
    $('#nextDrill').onclick = () => { goTab('study'); nextQuestion(desk.weakest.topic); };
  }
  // week sketch
  const chart = $('#weekChart'); chart.innerHTML = '';
  const max = Math.max(5, ...desk.week.map((d) => d.answered));
  desk.week.forEach((d, i) => {
    const bh = Math.round((d.answered / max) * 46), x = 6 + i * 29;
    if (bh) chart.append(svgEl('rect', { x, y: 52 - bh, width: 20, height: bh, class: `bar${i === 6 ? ' today' : ''}` }));
    else chart.append(svgEl('line', { x1: x, y1: 52, x2: x + 20, y2: 52, stroke: 'currentColor', 'stroke-width': 1, opacity: 0.4 }));
    const t = svgEl('text', { x: x + 10, y: 66, 'text-anchor': 'middle' });
    t.textContent = new Date(`${d.date}T00:00`).toLocaleDateString(undefined, { weekday: 'narrow' });
    chart.append(t);
  });
  // tally marks: groups of five, the fifth struck through in red
  const tally = $('#tally'); tally.innerHTML = ''; tally.classList.add('tally');
  const streak = Math.min(desk.streak, 30);
  for (let i = 0; i < streak; i++) {
    const g = Math.floor(i / 5), k = i % 5, gx = 8 + g * 34;
    if (k < 4) tally.append(svgEl('line', { x1: gx + k * 6, y1: 6, x2: gx + k * 6 + 1, y2: 28 }));
    else tally.append(svgEl('line', { x1: gx - 4, y1: 24, x2: gx + 24, y2: 9, class: 'cross' }));
  }
  if (!streak) { const t = svgEl('text', { x: 4, y: 22 }); t.textContent = 'answer a question to start'; tally.append(t); }
}
$('#wCal').onclick = () => {
  const s = $('#calSheet');
  if (s.classList.contains('tear')) return;
  s.classList.add('tear');
  setTimeout(() => { s.classList.remove('tear'); }, 750);
  mood('idle', desk?.daysLeft ? `${desk.daysLeft} pages left on that calendar. Let's make them count.` : 'Set an exam date in Notes and I will count down with you.');
};

// focus timer (25 minutes)
const FOCUS = 25 * 60;
let left = FOCUS, timer = null;
function renderTimer() {
  $('#tTime').textContent = `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`;
  $('#tFill').style.strokeDashoffset = 264 * (left / FOCUS);
}
$('#tBtn').onclick = () => {
  if (timer) { clearInterval(timer); timer = null; $('#tBtn').textContent = 'resume'; return; }
  if (left === 0) left = FOCUS;
  $('#tBtn').textContent = 'pause';
  mood('happy', 'Focus mode. I will haunt anyone who disturbs you.');
  timer = setInterval(() => {
    left = Math.max(0, left - 1);
    renderTimer();
    if (!left) {
      clearInterval(timer); timer = null; $('#tBtn').textContent = 'start again';
      mood('happy', 'Twenty-five minutes done. Stretch, drink water, come back.');
      speak('Twenty-five minutes done. Take a short break.');
    }
  }, 1000);
};
renderTimer();

// the ghost's eyes follow the cursor
if (!reduced) {
  const eyes = [...document.querySelectorAll('#ghost .g-eye')];
  addEventListener('pointermove', (e) => {
    const r = ghost.getBoundingClientRect();
    if (!r.width) return;
    const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height * 0.42);
    const d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / 300) * 2.2;
    eyes.forEach((el) => el.setAttribute('transform', `translate(${(dx / d) * k} ${(dy / d) * k})`));
  });
}

// say boo to the ghost
let typed = '';
addEventListener('keydown', (e) => {
  if (isTyping(e) || e.key.length !== 1) return;
  typed = (typed + e.key.toLowerCase()).slice(-3);
  if (typed !== 'boo') return;
  typed = '';
  roam();
  mood('happy', ["Boo yourself. Now answer a question.", "You cannot scare a ghost, but I admire the effort.", "AAAH! ...no, I was ready for that."][Math.floor(Math.random() * 3)]);
});

// ---------- status ----------
let status = null;
async function loadStatus() {
  try {
    status = await api('/api/status');
    voiceMode = status.voice;
    const line = $('#statusLine');
    line.classList.toggle('off', !status.llm.online);
    line.lastChild.textContent = status.llm.online ? ` ${status.llm.model} · on this machine` : ' Gemma offline · questions cut from your notes';
    line.title = status.llm.online
      ? `brain ${status.llm.model} · agent ${status.llm.agentModel ?? '—'} · memory ${status.store} · recall ${status.rag} · voice ${status.voice}`
      : 'Start Ollama to let Gemma write the questions.';
  } catch {
    const line = $('#statusLine');
    line.classList.add('off');
    line.lastChild.textContent = ' server unreachable';
  }
}

await Promise.all([loadProfile(), loadStatus()]);
const saved = local.get('tab');
if (saved && saved !== 'study') goTab(saved);
if (!profile.topics.length) mood('idle', "Hello. I'm the ghost who lives in this notebook. Give me your notes and I'll quiz you until you're ready.");
else mood('happy', `Welcome back, ${profile.name}.`);
