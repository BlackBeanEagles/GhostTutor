import express from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import path from 'node:path';
import { config, ROOT } from './config.js';
import { createStore } from './store.js';
import { initRag, chunkText, indexChunks, logAttemptTimeseries, ragKind } from './rag.js';
import { llmAvailable, chat } from './llm.js';
import { splitIntoTopics, generateQuestion, reaction, updateStreak, topicStats } from './quiz.js';
import { predict } from './predict.js';
import { buildAgent, ask } from './agent.js';
import { tts, stt, voiceOn } from './voice.js';
import { findPractice, searchOn } from './search.js';
import { sentryOn, captureError } from './tracing.js';

const app = express();
const upload = multer({ limits: { fileSize: 8 * 1024 * 1024 } });
const store = await createStore();
await initRag();
const agent = buildAgent(store);

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(ROOT, 'public')));

const localDate = (offsetDays = 0) => {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const wrap = (fn) => (req, res) => fn(req, res).catch((e) => {
  captureError(e);
  console.error(e);
  res.status(500).json({ error: e.message });
});

app.get('/api/status', wrap(async (_req, res) => {
  res.json({
    llm: { online: await llmAvailable(), model: config.llm.model, agentModel: config.llm.agentModel, host: config.llm.host },
    store: store.kind,
    rag: ragKind,
    voice: voiceOn() ? 'elevenlabs' : 'browser',
    search: searchOn(),
    tabpfn: config.tabpfnToken ? 'cloud' : 'local-if-installed',
    sentry: sentryOn,
    temporal: Boolean(config.temporalAddress),
  });
}));

app.get('/api/profile', wrap(async (_req, res) => res.json(await store.getProfile())));

app.post('/api/profile', wrap(async (req, res) => {
  const { name, subject, examDate, persona } = req.body ?? {};
  const patch = {};
  if (typeof name === 'string') patch.name = name.slice(0, 40);
  if (typeof subject === 'string') patch.subject = subject.slice(0, 60);
  if (examDate === null || /^\d{4}-\d{2}-\d{2}$/.test(examDate ?? '')) patch.examDate = examDate;
  if (['gentle', 'hype', 'roast'].includes(persona)) patch.persona = persona;
  res.json(await store.saveProfile(patch));
}));

app.post('/api/notes', upload.single('file'), wrap(async (req, res) => {
  const text = (req.file ? req.file.buffer.toString('utf8') : req.body?.text ?? '').trim();
  if (text.length < 80) return res.status(400).json({ error: 'Give me at least a paragraph of notes.' });
  const profile = await store.getProfile();
  const parts = await splitIntoTopics(text, profile.subject);
  const chunks = parts.flatMap(({ topic, body }) =>
    chunkText(body).map((t) => ({ id: crypto.randomUUID(), topic: topic.slice(0, 60), text: t })));
  await indexChunks(chunks);
  await store.addChunks(chunks);
  const topics = [...new Set([...profile.topics, ...chunks.map((c) => c.topic)])];
  await store.saveProfile({ topics });
  res.json({ topics, chunks: chunks.length });
}));

app.delete('/api/notes', wrap(async (_req, res) => { await store.clearNotes(); res.json({ ok: true }); }));

app.post('/api/quiz/next', wrap(async (req, res) => {
  const q = await generateQuestion(store, await store.getProfile(), req.body?.topic);
  if (!q) return res.status(400).json({ error: 'Upload some notes first.' });
  const { answer, explanation, ...publicQ } = q;
  res.json(publicQ);
}));

app.post('/api/quiz/answer', wrap(async (req, res) => {
  const { id, choice, ms } = req.body ?? {};
  const q = await store.getQuestion(id);
  if (!q) return res.status(404).json({ error: 'Unknown question' });
  if (q.answeredAt) return res.status(409).json({ error: 'Already answered' });
  const correct = Number(choice) === q.answer;
  const attempt = { at: Date.now(), topic: q.topic, correct, ms: Math.min(Number(ms) || 0, 600000), difficulty: q.difficulty, source: q.source };
  await store.addAttempt(attempt);
  await logAttemptTimeseries(attempt);
  await store.saveQuestion({ ...q, answeredAt: attempt.at, choice });
  let profile = updateStreak(await store.getProfile());
  profile = await store.saveProfile({ streak: profile.streak, lastQuizDay: profile.lastQuizDay });
  res.json({ correct, answer: q.answer, explanation: q.explanation, reaction: await reaction(profile.persona, correct, q), streak: profile.streak });
}));

app.get('/api/progress', wrap(async (_req, res) => {
  const profile = await store.getProfile();
  const attempts = await store.attempts();
  res.json({ ...(await predict(profile, attempts)), streak: profile.streak, total: attempts.length });
}));

// Small numbers for the desk widgets: today's count, last 7 days, what to study next.
app.get('/api/desk', wrap(async (_req, res) => {
  const profile = await store.getProfile();
  const attempts = await store.attempts();
  const week = Array.from({ length: 7 }, (_, i) => {
    const date = localDate(i - 6);
    const day = attempts.filter((a) => localDate(Math.round((new Date(a.at).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86_400_000)) === date);
    return { date, answered: day.length, correct: day.filter((a) => a.correct).length };
  });
  const topics = topicStats(profile.topics, attempts).sort((a, b) => a.mastery - b.mastery);
  const weakest = topics[0] ?? null;
  const daysLeft = profile.examDate ? Math.ceil((new Date(`${profile.examDate}T00:00`) - new Date().setHours(0, 0, 0, 0)) / 86_400_000) : null;
  res.json({ today: week[6], week, weakest, topics, daysLeft, examDate: profile.examDate, streak: profile.streak ?? 0, goal: 20 });
}));

app.get('/api/plan', wrap(async (_req, res) => {
  const profile = await store.getProfile();
  const stats = topicStats(profile.topics, await store.attempts()).sort((a, b) => a.mastery - b.mastery);
  const daysLeft = profile.examDate ? Math.max(1, Math.ceil((new Date(profile.examDate) - Date.now()) / 86_400_000)) : 7;
  const days = Math.min(daysLeft, 14);
  const n = stats.length;
  const plan = Array.from({ length: days }, (_, i) => {
    const date = localDate(i);
    if (i === days - 1 && days > 1) return { date, focus: stats.map((s) => s.topic), kind: 'Mixed mock test', minutes: 40 };
    if (!n) return { date, focus: [], kind: 'Deep practice', minutes: 25 };
    // Weakest topics first, cycling through all of them; pair each with a spaced review.
    const focus = [stats[i % n].topic, stats[(i + Math.ceil(n / 2)) % n].topic];
    const minutes = 20 + Math.round((1 - stats[i % n].mastery) * 20);
    return { date, focus: [...new Set(focus)], kind: i % 3 === 2 ? 'Spaced review' : 'Deep practice', minutes };
  });
  res.json({ daysLeft: profile.examDate ? daysLeft : null, plan });
}));

app.get('/api/practice', wrap(async (req, res) => {
  const profile = await store.getProfile();
  res.json(await findPractice(profile.subject, String(req.query.topic ?? '')));
}));

app.post('/api/chat', wrap(async (req, res) => {
  const { message, history } = req.body ?? {};
  if (!message) return res.status(400).json({ error: 'Empty message' });
  res.json(await ask(agent, store, String(message).slice(0, 2000), Array.isArray(history) ? history : []));
}));

// Called by the Temporal study coach (temporal/activities.js) when the student hasn't studied tonight.
app.post('/api/nudge', wrap(async (req, res) => {
  const level = req.body?.level === 'escalate' ? 'escalate' : 'gentle';
  const profile = await store.getProfile();
  const stats = topicStats(profile.topics, await store.attempts()).sort((a, b) => a.mastery - b.mastery);
  const weakest = stats[0]?.topic ?? profile.subject;
  const fallback = level === 'gentle'
    ? `Hey ${profile.name}, ten quiet minutes on ${weakest} tonight? I saved you a question.`
    : `${profile.name}! ${weakest} is still haunting you. Five questions. Right now. I'll wait.`;
  let text = fallback;
  if (await llmAvailable()) {
    try {
      text = (await chat([
        { role: 'system', content: `You are Ghost Tutor, persona "${profile.persona}". Write ONE short voice-note nudge (max 30 words), no emojis.` },
        { role: 'user', content: `${profile.name} hasn't studied ${profile.subject} tonight. Weakest topic: ${weakest}. ${profile.examDate ? `Exam on ${profile.examDate}.` : ''} Tone: ${level === 'gentle' ? 'warm and gentle' : 'more urgent, still kind'}.` },
      ], { temperature: 0.8 })).trim() || fallback;
    } catch { /* keep fallback */ }
  }
  const nudge = { at: Date.now(), level, text, topic: weakest };
  await store.saveProfile({ nudges: [...(profile.nudges ?? []), nudge].slice(-10) });
  res.json(nudge);
}));

app.post('/api/nudge/dismiss', wrap(async (_req, res) => {
  const profile = await store.getProfile();
  await store.saveProfile({ nudges: (profile.nudges ?? []).map((n) => ({ ...n, seen: true })) });
  res.json({ ok: true });
}));

app.post('/api/tts', wrap(async (req, res) => {
  if (!voiceOn()) return res.status(204).end();
  res.type('audio/mpeg').send(await tts(String(req.body?.text ?? '')));
}));

app.post('/api/stt', upload.single('audio'), wrap(async (req, res) => {
  if (!voiceOn() || !req.file) return res.status(204).end();
  res.json({ text: await stt(req.file.buffer, req.file.mimetype) });
}));

app.listen(config.port, () => console.log(`👻 Ghost Tutor haunting http://localhost:${config.port}`))
  .on('error', (e) => {
    if (e.code === 'EADDRINUSE') console.error(`Port ${config.port} is already in use by another app. Set PORT=<free port> in .env and try again.`);
    else console.error(e);
    process.exit(1);
  });
