// Topic extraction, question generation, grading and spaced-repetition scheduling.
import crypto from 'node:crypto';
import { chat, chatJSON, llmAvailable } from './llm.js';
import { search } from './rag.js';

const id = () => crypto.randomBytes(6).toString('hex');
const STOP = new Set('the a an and or of to in on for with is are was were be been this that these those it its as by at from which into than then there their they we you your our can will would should could also such each other more most some any not but if when where while what who how why only very'.split(' '));

// ---------- topics ----------

function headingTopics(text) {
  const parts = [];
  let current = null;
  for (const line of text.replace(/\r/g, '').split('\n')) {
    const h = line.match(/^\s{0,3}#{1,3}\s+(.+?)\s*#*\s*$/) || line.match(/^([A-Z][A-Za-z0-9 ,&()'-]{3,60}):?\s*$/);
    if (h && line.trim().length < 70) {
      current = { topic: h[1].trim(), body: '' };
      parts.push(current);
    } else if (current) current.body += line + '\n';
    else { current = { topic: 'Overview', body: line + '\n' }; parts.push(current); }
  }
  return parts.filter((p) => p.body.trim().length > 40);
}

export async function splitIntoTopics(text, subject) {
  const byHeading = headingTopics(text);
  if (byHeading.length >= 2) return byHeading;
  if (await llmAvailable()) {
    try {
      const out = await chatJSON([
        { role: 'system', content: 'You split study notes into exam topics. Reply with JSON only.' },
        { role: 'user', content: `Subject: ${subject}\nSplit these notes into 3-8 topics. Return {"topics":[{"topic":"short name","body":"the exact note text for that topic"}]}.\n\nNOTES:\n${text.slice(0, 12000)}` },
      ]);
      const t = (out.topics ?? []).filter((x) => x.topic && x.body?.length > 40);
      if (t.length) return t;
    } catch { /* fall through */ }
  }
  return [{ topic: subject || 'Notes', body: text }];
}

// ---------- mastery + scheduling ----------

export function topicStats(topics, attempts) {
  const now = Date.now();
  return topics.map((topic) => {
    const mine = attempts.filter((a) => a.topic === topic);
    // Recency-weighted Beta posterior: recent answers count more.
    let a = 1, b = 1;
    for (const x of mine) {
      const w = Math.exp(-(now - x.at) / (1000 * 60 * 60 * 24 * 10));
      if (x.correct) a += w; else b += w;
    }
    const last = mine.at(-1)?.at ?? 0;
    return {
      topic,
      attempts: mine.length,
      correct: mine.filter((x) => x.correct).length,
      mastery: a / (a + b),
      daysSince: last ? (now - last) / 86_400_000 : null,
    };
  });
}

export function pickTopic(stats) {
  if (!stats.length) return null;
  const scored = stats.map((s) => ({
    ...s,
    priority: (1 - s.mastery) + (s.daysSince === null ? 0.6 : Math.min(s.daysSince / 3, 0.5)) + Math.random() * 0.15,
  }));
  return scored.sort((x, y) => y.priority - x.priority)[0].topic;
}

// ---------- question generation ----------

function clozeQuestion(chunk, others, difficulty) {
  const sentences = chunk.text.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/).filter((s) => s.split(' ').length >= 7);
  if (!sentences.length) return null;
  const idx = Math.floor(Math.random() * sentences.length);
  const sentence = sentences[idx];
  // "It/Its/This…" sentences are meaningless alone; show the sentence before as context.
  const all = chunk.text.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/);
  const prev = /^(it|its|this|these|they|their|the latter|the former)\b/i.test(sentence) ? all[all.indexOf(sentence) - 1] : null;
  const terms = (s) => [...new Set((s.match(/[A-Za-z][A-Za-z0-9-]{4,}/g) ?? []).filter((w) => !STOP.has(w.toLowerCase())))];
  const candidates = terms(sentence).sort((a, b) => b.length - a.length);
  if (!candidates.length) return null;
  const answer = candidates[Math.min(candidates.length - 1, Math.floor(Math.random() * 2))];
  const pool = [...new Set(others.flatMap((c) => terms(c.text)).concat(terms(chunk.text)))]
    .filter((w) => w.toLowerCase() !== answer.toLowerCase())
    .sort((a, b) => Math.abs(a.length - answer.length) - Math.abs(b.length - answer.length))
    .slice(0, 12)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);
  if (pool.length < 3) return null;
  const options = [...pool, answer].sort(() => Math.random() - 0.5);
  return {
    question: `${prev ? `${prev} ` : ''}Fill the gap: "${sentence.replace(new RegExp(`\\b${answer}\\b`), '_____')}"`,
    options,
    answer: options.indexOf(answer),
    explanation: `From your notes: "${sentence}"`,
    difficulty,
    source: 'cloze',
  };
}

const MCQ_SCHEMA = {
  type: 'object',
  properties: {
    question: { type: 'string' },
    correct: { type: 'string' },
    wrong: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 3 },
    explanation: { type: 'string' },
  },
  required: ['question', 'correct', 'wrong', 'explanation'],
};
const asked = new Map(); // topic -> recent question texts, to avoid repeats

const keyWords = (s) => (String(s).toLowerCase().match(/[a-z0-9]{3,}/g) ?? []).filter((w) => !STOP.has(w));

export function buildMcq(out, notes, difficulty) {
  const correct = String(out?.correct ?? '').trim();
  const wrong = (Array.isArray(out?.wrong) ? out.wrong : []).map((w) => String(w).trim()).filter(Boolean);
  if (!out?.question || !correct || wrong.length !== 3) return null;
  const all = [correct, ...wrong];
  if (new Set(all.map((o) => o.toLowerCase())).size !== 4) return null;
  // Grounding: most words of the correct answer must appear in the notes.
  const cw = keyWords(correct);
  const nw = new Set(keyWords(notes));
  if (cw.length && cw.filter((w) => nw.has(w)).length / cw.length < 0.5) return null;
  const options = all.sort(() => Math.random() - 0.5);
  return { question: String(out.question), options, answer: options.indexOf(correct), explanation: String(out.explanation ?? ''), difficulty, source: 'gemma' };
}

const PERSONAS = {
  gentle: 'a calm, kind tutor who encourages without pressure',
  hype: 'an energetic hype coach who celebrates every win like a sports commentator',
  roast: 'a playful friend who lovingly roasts wrong answers but never insults intelligence',
};

export async function generateQuestion(store, profile, topicOverride) {
  const chunks = await store.allChunks();
  if (!chunks.length) return null;
  const stats = topicStats(profile.topics, await store.attempts());
  const topic = topicOverride || pickTopic(stats) || chunks[0].topic;
  const st = stats.find((s) => s.topic === topic);
  const difficulty = !st || st.mastery < 0.45 ? 1 : st.mastery < 0.75 ? 2 : 3;

  const topicChunks = chunks.filter((c) => c.topic === topic);
  const seed = topicChunks[Math.floor(Math.random() * topicChunks.length)] ?? chunks[0];
  const context = (await search(`${topic} ${seed.text.slice(0, 200)}`, chunks, 3, topic)).map((c) => c.text);
  if (!context.includes(seed.text)) context.unshift(seed.text);

  let q = null;
  if (await llmAvailable()) {
    const notes = context.join('\n---\n').slice(0, 5000);
    const recent = (asked.get(topic) ?? []).slice(-4);
    for (let attempt = 0; attempt < 2 && !q; attempt++) {
      try {
        // The model writes the correct answer and distractors as text; we shuffle and compute
        // the index ourselves. Small models are unreliable at picking "answer": <index>.
        const out = await chatJSON([
          { role: 'system', content: 'You write exam multiple-choice questions strictly grounded in the given notes.' },
          { role: 'user', content: `Subject: ${profile.subject}. Topic: ${topic}.
Difficulty: ${['', 'simple recall of a fact', 'understanding why or how something works', 'applying an idea to a small new case'][difficulty]}.
Write ONE question answerable only from these notes.
- "correct": the right answer, taken from the notes.
- "wrong": three plausible but wrong answers of similar length.
- "explanation": one sentence quoting the notes.
${recent.length ? `Do NOT repeat or rephrase these earlier questions:\n${recent.map((r) => `- ${r}`).join('\n')}\n` : ''}
NOTES:
${notes}` },
        ], MCQ_SCHEMA, 0.7, 500);
        q = buildMcq(out, notes, difficulty);
        if (!q) console.warn('[quiz] rejected ungrounded or malformed question:', JSON.stringify(out).slice(0, 200));
      } catch (e) { console.warn('[quiz] LLM question failed:', e.message); }
    }
    if (q) asked.set(topic, [...recent, q.question]);
  }
  if (!q) {
    for (let i = 0; i < 6 && !q; i++) {
      const c = topicChunks[Math.floor(Math.random() * topicChunks.length)] ?? seed;
      q = clozeQuestion(c, chunks.filter((x) => x !== c), difficulty);
    }
  }
  if (!q) return null;
  const full = { id: id(), topic, createdAt: Date.now(), ...q };
  await store.saveQuestion(full);
  return full;
}

const CANNED = {
  gentle: { right: ['Lovely. That one is sticking.', 'Exactly right, nicely done.', 'Yes! Calm and correct.'], wrong: ['Not quite, and that is okay. Read the note below once.', "Close. Let's look at why.", 'This is how learning feels. One more look.'] },
  hype: { right: ['GOAL! What a strike!', 'Unstoppable! The crowd is ON its feet!', 'That is a highlight-reel answer!'], wrong: ['Missed the net, but the season is long!', 'Shake it off, champ, next play!', 'Timeout! Quick tactics review below.'] },
  roast: { right: ['Okay fine, you actually studied. Suspicious.', 'Correct. I will allow it.', 'Look at you, using your brain cells.'], wrong: ['Bold answer. Wrong, but bold.', 'Your notes are crying right now.', 'That option was a decoy and you hugged it.'] },
};

export async function reaction(persona, correct, question) {
  const lines = CANNED[persona] ?? CANNED.gentle;
  const fallback = (correct ? lines.right : lines.wrong)[Math.floor(Math.random() * 3)];
  if (!(await llmAvailable())) return fallback;
  try {
    const t = await chat([
      { role: 'system', content: `You are Ghost Tutor, ${PERSONAS[persona] ?? PERSONAS.gentle}. Reply with ONE short line (max 14 words), no emojis, no quotes. React to the student's effort only. Never mention any fact about the subject.
Lines in exactly this voice, for a ${correct ? 'correct' : 'wrong'} answer:
${(correct ? lines.right : lines.wrong).map((l) => `- ${l}`).join('\n')}
Write a NEW line in the same voice. Do not copy the examples.` },
      { role: 'user', content: `The student just got a ${question.topic} question ${correct ? 'right' : 'wrong'}.` },
    ], { temperature: 0.9 });
    // Small models like to wrap the line in markdown and quotes; peel both off.
    const line = t.trim().split('\n')[0]
      .replace(/^[-•\s]+/, '')
      .replace(/^[*_`"“''\s]+|[*_`"”''\s]+$/g, '')
      .trim();
    return line.slice(0, 160) || fallback;
  } catch { return fallback; }
}

export function updateStreak(profile) {
  const day = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  const today = day(new Date());
  if (profile.lastQuizDay === today) return profile;
  const yesterday = day(new Date(Date.now() - 86_400_000));
  return { ...profile, streak: profile.lastQuizDay === yesterday ? profile.streak + 1 : 1, lastQuizDay: today };
}
